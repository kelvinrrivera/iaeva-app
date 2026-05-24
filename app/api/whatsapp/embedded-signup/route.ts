import { NextResponse } from 'next/server';
import { withAuth, type AuthenticatedUser } from '@/lib/auth-middleware';
import { connectWhatsAppToShop, type FeatureType } from '@/lib/whatsapp/embedded-signup';

export async function POST(request: Request) {
    return withAuth(async (authUser: AuthenticatedUser) => {
        try {
            const body = await request.json();
            const { code, wabaId, phoneNumberId, featureType } = body;

            if (!code || !wabaId || !phoneNumberId) {
                return NextResponse.json({ error: 'Faltan datos del registro de Meta' }, { status: 400 });
            }
            if (featureType !== 'coexistence' && featureType !== 'cloud_api') {
                return NextResponse.json({ error: 'featureType inválido' }, { status: 400 });
            }

            const shopId = authUser.shopId;
            if (!shopId) {
                return NextResponse.json({ error: 'No shop assigned' }, { status: 403 });
            }

            const result = await connectWhatsAppToShop({
                shopId,
                code,
                wabaId,
                phoneNumberId,
                featureType: featureType as FeatureType,
            });

            const onlyPending =
                result.health.critical.length === 1 &&
                result.health.critical[0].code === 'PHONE_PENDING';

            return NextResponse.json({
                success: true,
                phoneNumber: result.phoneNumber,
                ready: result.health.ready,
                syncing: onlyPending,
                critical: result.health.critical,
                warnings: result.health.warnings,
            });
        } catch (error: any) {
            console.error('[Embedded Signup API] Error:', error);
            const status =
                error?.code === 'PHONE_IN_USE' ? 409 :
                error?.code === 'TOKEN_EXCHANGE_FAILED' ? 401 :
                500;
            return NextResponse.json(
                { error: error?.message || 'Internal server error', code: error?.code },
                { status }
            );
        }
    }, request as any);
}
