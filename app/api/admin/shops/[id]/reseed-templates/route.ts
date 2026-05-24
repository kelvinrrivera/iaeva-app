/**
 * POST /api/admin/shops/[id]/reseed-templates
 *
 * Force a re-seed of default templates for a shop. Uses the canonical
 * seedDefaultTemplates() so the bodies match the current code.
 *
 * Admin-only. Always logs the action.
 */

import { NextResponse, NextRequest } from 'next/server';
import { withOwnerAuth, isValidShopId, type AdminUser } from '@/lib/admin-auth';
import { seedDefaultTemplates } from '@/lib/whatsapp/template-seeder';
import { logEvent } from '@/lib/system-log';

async function handler(admin: AdminUser, req: NextRequest) {
  const segments = req.nextUrl.pathname.split('/');
  const shopId = segments[segments.indexOf('shops') + 1];
  if (!isValidShopId(shopId)) {
    return NextResponse.json({ error: 'Invalid shop id' }, { status: 400 });
  }

  const result = await seedDefaultTemplates(shopId);

  await logEvent({
    type: 'admin.shop.templates_reseeded',
    severity: 'info',
    shopId,
    userId: admin.id,
    message: `${admin.email} reseed templates: created=${result.created}, registered=${result.registered}, errors=${result.errors.length}`,
    payload: result,
  });

  return NextResponse.json(result);
}

export const POST = withOwnerAuth(handler);
