import { NextRequest, NextResponse } from 'next/server';
import { db } from '@/lib/database';
import twilio from 'twilio';
import { getVerifyServiceSid } from '@/lib/whatsapp/verify-service';
import { seedDefaultTemplates } from '@/lib/whatsapp/template-seeder';
import { checkRateLimit, extractIP, rateLimitResponse } from '@/lib/rate-limit';

/**
 * POST /api/whatsapp/verify/check
 * Checks the WhatsApp verification code and activates WhatsApp for the shop.
 * No auth required — used during onboarding before session exists.
 * Rate-limited by IP and by phone to prevent brute-force.
 */
export async function POST(request: NextRequest) {
    try {
        // Rate limit by IP
        const ip = extractIP(request);
        const ipRl = await checkRateLimit(`verify-check:ip:${ip}`, 'auth');
        if (!ipRl.success) return rateLimitResponse();

        const body = await request.json().catch(() => ({}));
        const { phoneNumber, code, shopId } = body;

        if (!phoneNumber || !code) {
            return NextResponse.json(
                { error: 'Número y código son requeridos' },
                { status: 400 }
            );
        }

        const normalized = phoneNumber.startsWith('+') ? phoneNumber : `+${phoneNumber}`;

        // Rate limit by phone number — prevents brute-forcing a specific code
        const phoneKey = normalized.replace(/\D/g, '');
        const phoneRl = await checkRateLimit(`verify-check:phone:${phoneKey}`, 'auth');
        if (!phoneRl.success) return rateLimitResponse();

        const accountSid = process.env.TWILIO_ACCOUNT_SID;
        const authToken = process.env.TWILIO_AUTH_TOKEN;

        if (!accountSid || !authToken) {
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

        const check = await client.verify.v2
            .services(verifySid)
            .verificationChecks.create({
                to: normalized,
                code: code.trim(),
            });

        if (check.status !== 'approved') {
            return NextResponse.json(
                { error: 'Código incorrecto o expirado. Intenta de nuevo.' },
                { status: 400 }
            );
        }

        // Activate WhatsApp for the shop (skip during onboarding — shop doesn't exist yet)
        if (shopId) {
            // Verify the shopId actually exists before updating it
            const shop = await db.shop.findUnique({
                where: { id: shopId },
                select: { id: true },
            });

            if (!shop) {
                return NextResponse.json({ error: 'Negocio no encontrado' }, { status: 404 });
            }

            await db.shop.update({
                where: { id: shopId },
                data: {
                    whatsappEnabled: true,
                    whatsappPhoneNumber: normalized,
                },
            });

            seedDefaultTemplates(shopId).catch(err => {
                console.error('[Verify Check] Template seeding failed:', err);
            });
        }

        return NextResponse.json({
            success: true,
            phoneNumber: normalized,
            message: 'Número verificado y WhatsApp activado',
        });
    } catch (error: any) {
        console.error('[Verify Check] Error:', error);

        if (error.code === 60200) {
            return NextResponse.json({ error: 'Código inválido' }, { status: 400 });
        }

        return NextResponse.json({ error: 'Error al verificar código' }, { status: 500 });
    }
}
