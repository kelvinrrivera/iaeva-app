import { db } from '@/lib/database';
import twilio from 'twilio';
import crypto from 'crypto';

const TWILIO_WHATSAPP_NUMBER = process.env.TWILIO_WHATSAPP_NUMBER;
const OTP_EXPIRY_MINUTES = 5;
const MAX_ATTEMPTS = 3;

function generateCode(): string {
  return crypto.randomInt(100000, 999999).toString();
}

/**
 * Hash the 6-digit code with HMAC-SHA256 before storing.
 * The pepper is stored server-side only, never in the DB.
 */
function hashCode(code: string): string {
  const pepper = process.env.OTP_PEPPER || 'domicita-otp-default-pepper';
  return crypto.createHmac('sha256', pepper).update(code).digest('hex');
}

export async function sendWhatsAppOtp(phoneNumber: string): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;

    if (!accountSid || !authToken) {
      console.error('[WhatsApp OTP] Missing Twilio credentials');
      return { success: false, error: 'Servicio de verificación no disponible' };
    }

    if (!TWILIO_WHATSAPP_NUMBER) {
      console.error('[WhatsApp OTP] Missing TWILIO_WHATSAPP_NUMBER env var');
      return { success: false, error: 'Número de WhatsApp no configurado' };
    }

    const normalized = phoneNumber.startsWith('+') ? phoneNumber : `+${phoneNumber}`;

    if (!/^\+\d{10,15}$/.test(normalized)) {
      return { success: false, error: 'Formato de número inválido' };
    }

    // Clean up expired codes for this phone
    await db.otpCode.deleteMany({
      where: {
        phoneNumber: normalized,
        expiresAt: { lt: new Date() },
      },
    });

    // Rate limit: max 3 codes in 5 minutes
    const recentCodes = await db.otpCode.count({
      where: {
        phoneNumber: normalized,
        createdAt: { gte: new Date(Date.now() - OTP_EXPIRY_MINUTES * 60 * 1000) },
      },
    });

    if (recentCodes >= MAX_ATTEMPTS) {
      return { success: false, error: 'Demasiados intentos. Espera unos minutos.' };
    }

    const code = generateCode();
    const expiresAt = new Date(Date.now() + OTP_EXPIRY_MINUTES * 60 * 1000);

    // Store hashed code — plaintext never persisted
    await db.otpCode.create({
      data: {
        phoneNumber: normalized,
        code: hashCode(code),
        expiresAt,
      },
    });

    const client = twilio(accountSid, authToken);
    const fromNumber = TWILIO_WHATSAPP_NUMBER.startsWith('whatsapp:')
      ? TWILIO_WHATSAPP_NUMBER
      : `whatsapp:${TWILIO_WHATSAPP_NUMBER}`;

    const contentSid = process.env.TWILIO_OTP_CONTENT_SID;

    if (contentSid) {
      await client.messages.create({
        from: fromNumber,
        to: `whatsapp:${normalized.replace(/\D/g, '')}`,
        contentSid: contentSid,
        contentVariables: JSON.stringify({ 1: code, 2: String(OTP_EXPIRY_MINUTES) }),
      });
    } else {
      await client.messages.create({
        from: fromNumber,
        to: `whatsapp:${normalized.replace(/\D/g, '')}`,
        body: `DomiCita: Tu código de verificación es: ${code}. Válido por ${OTP_EXPIRY_MINUTES} minutos.`,
      });
    }

    console.log(`[WhatsApp OTP] Sent to ${normalized.slice(0, 4)}****, expires at ${expiresAt.toISOString()}`);

    return { success: true };
  } catch (error: any) {
    console.error('[WhatsApp OTP] Error:', error?.message || error);

    if (error.code === 21614) {
      return { success: false, error: 'Número de teléfono inválido' };
    }
    if (error.code === 21612) {
      return { success: false, error: 'El número no tiene WhatsApp activo' };
    }

    return { success: false, error: error?.message || 'Error al enviar código. Intenta de nuevo.' };
  }
}

export async function verifyWhatsAppOtp(
  phoneNumber: string,
  code: string
): Promise<{
  success: boolean;
  error?: string;
}> {
  try {
    const normalized = phoneNumber.startsWith('+') ? phoneNumber : `+${phoneNumber}`;
    const hashedInput = hashCode(code.trim());

    // Find valid unverified record matching the hashed code
    const otpRecord = await db.otpCode.findFirst({
      where: {
        phoneNumber: normalized,
        code: hashedInput,
        verifiedAt: null,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });

    if (!otpRecord) {
      // Increment attempts on the most recent unverified code
      await db.otpCode.updateMany({
        where: {
          phoneNumber: normalized,
          verifiedAt: null,
        },
        data: {
          attempts: { increment: 1 },
        },
      });

      return { success: false, error: 'Código incorrecto o expirado' };
    }

    if (otpRecord.attempts >= MAX_ATTEMPTS) {
      return { success: false, error: 'Máximo de intentos alcanzado. Solicita un nuevo código.' };
    }

    await db.otpCode.update({
      where: { id: otpRecord.id },
      data: { verifiedAt: new Date() },
    });

    console.log(`[WhatsApp OTP] Verified for ${normalized.slice(0, 4)}****`);

    return { success: true };
  } catch (error: any) {
    console.error('[WhatsApp OTP] Verify error:', error);
    return { success: false, error: 'Error al verificar código' };
  }
}

export async function cleanupExpiredOtps(): Promise<number> {
  const result = await db.otpCode.deleteMany({
    where: {
      expiresAt: { lt: new Date() },
    },
  });

  console.log(`[WhatsApp OTP] Cleaned up ${result.count} expired codes`);
  return result.count;
}
