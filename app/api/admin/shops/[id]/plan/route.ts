import { NextResponse, NextRequest } from 'next/server';
import { withOwnerAuth, isValidShopId, type AdminUser } from '@/lib/admin-auth';
import { db } from '@/lib/database';
import { logEvent } from '@/lib/system-log';

const VALID_PLANS = new Set(['SOLO', 'TEAM', 'BUSINESS']);

async function handler(admin: AdminUser, req: NextRequest) {
  const segments = req.nextUrl.pathname.split('/');
  const shopId = segments[segments.indexOf('shops') + 1];
  if (!isValidShopId(shopId)) {
    return NextResponse.json({ error: 'Invalid shop id' }, { status: 400 });
  }

  const { plan } = await req.json();
  if (!VALID_PLANS.has(plan)) {
    return NextResponse.json({ error: 'Invalid plan' }, { status: 400 });
  }

  const shop = await db.shop.findUnique({ where: { id: shopId }, select: { plan: true } });
  if (!shop) return NextResponse.json({ error: 'Shop not found' }, { status: 404 });

  await db.shop.update({ where: { id: shopId }, data: { plan } });

  await logEvent({
    type: 'admin.shop.plan_changed',
    severity: 'info',
    shopId,
    userId: admin.id,
    message: `${admin.email} cambió plan de ${shop.plan} a ${plan}`,
    payload: { from: shop.plan, to: plan },
  });

  return NextResponse.json({ ok: true });
}

export const POST = withOwnerAuth(handler);
