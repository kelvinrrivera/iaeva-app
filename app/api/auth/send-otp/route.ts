import { NextRequest, NextResponse } from 'next/server';
import { sendWhatsAppOtp } from '@/lib/auth/whatsapp-otp';
import { checkRateLimit, extractIP, rateLimitResponse } from '@/lib/rate-limit';

/**
 * POST /api/auth/send-otp
 * Sends a WhatsApp verification code for login.
 * Rate-limited by IP and by phone number.
 */
export async function POST(request: NextRequest) {
    try {
        const ip = extractIP(request);
        const ipRl = await checkRateLimit(`send-otp:ip:${ip}`, 'auth');
        if (!ipRl.success) return rateLimitResponse();

        const body = await request.json().catch(() => ({}));
        const { phone } = body;

        if (!phone) {
            return NextResponse.json(
                { error: 'Ingresa un número de teléfono' },
                { status: 400 }
            );
        }

        const normalized = phone.startsWith('+') ? phone : `+${phone}`;

        if (!/^\+\d{10,15}$/.test(normalized)) {
            return NextResponse.json(
                { error: 'Formato de número inválido. Usa +18091234567' },
                { status: 400 }
            );
        }

        // Rate limit by phone number — prevents targeting a specific number
        const phoneKey = normalized.replace(/\D/g, '');
        const phoneRl = await checkRateLimit(`send-otp:phone:${phoneKey}`, 'auth');
        if (!phoneRl.success) return rateLimitResponse();

        const result = await sendWhatsAppOtp(normalized);

        if (!result.success) {
            return NextResponse.json(
                { error: result.error },
                { status: result.error?.includes('Demasiados intentos') ? 429 : 400 }
            );
        }

        return NextResponse.json({
            success: true,
            message: 'Código enviado por WhatsApp',
        });
    } catch (error: any) {
        console.error('[Auth SendOTP] Error:', error?.message || error);
        return NextResponse.json(
            { error: 'Error al enviar código de verificación' },
            { status: 500 }
        );
    }
}
