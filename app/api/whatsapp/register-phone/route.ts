import { NextResponse } from 'next/server';
import { db } from '@/lib/database';
import { withAuth, type AuthenticatedUser } from '@/lib/auth-middleware';
import { registerPhone } from '@/lib/whatsapp/meta-graph';

/**
 * POST /api/whatsapp/register-phone
 *
 * Re-runs the Cloud API /register call for the current shop's connected phone.
 * Only valid for Cloud API mode shops — Coexistence numbers are owned by the
 * tenant's WhatsApp Business app and registering them always fails 2388001.
 */
export async function POST(request: Request) {
    return withAuth(async (authUser: AuthenticatedUser) => {
        const shopId = authUser.shopId;
        if (!shopId) return NextResponse.json({ error: 'No shop' }, { status: 403 });

        const shop = await db.shop.findUnique({
            where: { id: shopId },
            select: { metaPhoneNumberId: true, metaAccessToken: true, coexistenceMode: true },
        });
        if (!shop?.metaPhoneNumberId) {
            return NextResponse.json({ error: 'Este negocio no tiene un número de WhatsApp conectado.' }, { status: 400 });
        }
        if (shop.coexistenceMode) {
            return NextResponse.json({
                error: 'Tu WhatsApp está en modo Coexistence — no necesita registrarse manualmente. Si tu bot no responde, contacta a soporte.',
                code: 'COEXISTENCE_MODE',
            }, { status: 409 });
        }

        const token = process.env.WHATSAPP_SYSTEM_USER_TOKEN || process.env.WHATSAPP_ACCESS_TOKEN || shop.metaAccessToken || '';
        if (!token) {
            return NextResponse.json({ error: 'Falta el token de Meta' }, { status: 500 });
        }

        try {
            await registerPhone(shop.metaPhoneNumberId, token);
            return NextResponse.json({ success: true });
        } catch (err: any) {
            if (err?.code === 'PHONE_IN_USE') {
                return NextResponse.json({ error: err.message, code: 'PHONE_IN_USE' }, { status: 409 });
            }
            return NextResponse.json({ error: err?.message || 'No se pudo registrar el número' }, { status: 502 });
        }
    }, request as any);
}
