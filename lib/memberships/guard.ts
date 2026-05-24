import { db } from '@/lib/database';
import { canUseFeature } from '@/lib/plan-enforcement';

/**
 * Returns the shop if the authenticated user's shop has access to the
 * 'memberships' feature, or null + an error message otherwise.
 *
 * Centralized so that all four membership endpoints enforce the same rule:
 * memberships are TEAM/BUSINESS only.
 */
export async function assertMembershipsEnabled(shopId: string): Promise<
    { ok: true } | { ok: false; status: number; error: string }
> {
    const shop = await db.shop.findUnique({ where: { id: shopId } });
    if (!shop) {
        return { ok: false, status: 404, error: 'Shop not found' };
    }
    if (!canUseFeature(shop, 'memberships')) {
        return {
            ok: false,
            status: 403,
            error: 'Las membresías requieren el plan TEAM o superior.',
        };
    }
    return { ok: true };
}
