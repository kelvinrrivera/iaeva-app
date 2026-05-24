import { NextRequest, NextResponse } from 'next/server';
import twilio from 'twilio';
import { getVerifyServiceSid } from '@/lib/whatsapp/verify-service';
import { checkRateLimit, extractIP, rateLimitResponse } from '@/lib/rate-limit';

/**
 * POST /api/whatsapp/verify/send
 * Sends a WhatsApp verification code to the user's phone number.
 * No auth required — used during onboarding before session exists.
 * Rate-limited by IP (10/min) and by phone number (auth preset = 10/min).
 */
export async function POST(request: NextRequest) {
    try {
        // Rate limit by IP
        const ip = extractIP(request);
        const ipRl = await checkRateLimit(`verify-send:ip:${ip}`, 'auth');
        if (!ipRl.success) return rateLimitResponse();

        const body = await request.json().catch(() => ({}));
        const { phoneNumber } = body;

        if (!phoneNumber) {
            return NextResponse.json(
                { error: 'Ingresa un número de teléfono' },
                { status: 400 }
            );
        }

        const normalized = phoneNumber.startsWith('+') ? phoneNumber : `+${phoneNumber}`;

        if (!/^\+\d{10,15}$/.test(normalized)) {
            return NextResponse.json(
                { error: 'Formato de número inválido. Usa formato internacional: +18091112222' },
                { status: 400 }
            );
        }

        // Rate limit by phone number — prevents SMS bombing a specific target
        const phoneKey = normalized.replace(/\D/g, '');
        const phoneRl = await checkRateLimit(`verify-send:phone:${phoneKey}`, 'auth');
        if (!phoneRl.success) return rateLimitResponse();

        const accountSid = process.env.TWILIO_ACCOUNT_SID;
        const authToken = process.env.TWILIO_AUTH_TOKEN;

        if (!accountSid || !authToken) {
            console.error('[Verify] Missing TWILIO_ACCOUNT_SID or TWILIO_AUTH_TOKEN');
            return NextResponse.json(
                { error: 'Servicio de verificación no disponible' },
                { status: 503 }
            );
        }

        const verifySid = await getVerifyServiceSid();
        if (!verifySid) {
            return NextResponse.json(
                { error: 'Servicio de verificación no disponible' },
                { status: 503 }
            );
        }

        const client = twilio(accountSid, authToken);

        const verification = await client.verify.v2
            .services(verifySid)
            .verifications.create({
                to: normalized,
                channel: 'whatsapp',
            });

        return NextResponse.json({
            success: true,
            status: verification.status,
            message: 'Código de verificación enviado por WhatsApp',
        });
    } catch (error: any) {
        console.error('[Verify Send] Error:', error);

        if (error.code === 60200) {
            return NextResponse.json({ error: 'Número de teléfono inválido' }, { status: 400 });
        }
        if (error.code === 60203) {
            return NextResponse.json(
                { error: 'Demasiados intentos. Espera unos minutos e intenta de nuevo.' },
                { status: 429 }
            );
        }

        return NextResponse.json(
            { error: 'Error al enviar código de verificación' },
            { status: 500 }
        );
    }
}
