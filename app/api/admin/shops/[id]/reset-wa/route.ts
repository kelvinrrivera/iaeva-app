import { NextResponse, NextRequest } from 'next/server';
import { withOwnerAuth, isValidShopId, type AdminUser } from '@/lib/admin-auth';
import { db } from '@/lib/database';
import { logEvent } from '@/lib/system-log';

async function handler(admin: AdminUser, req: NextRequest) {
  const segments = req.nextUrl.pathname.split('/');
  const shopId = segments[segments.indexOf('shops') + 1];
  if (!isValidShopId(shopId)) {
    return NextResponse.json({ error: 'Invalid shop id' }, { status: 400 });
  }

  const shop = await db.shop.findUnique({
    where: { id: shopId },
    select: { wabaId: true, whatsappPhoneNumber: true, whatsappEnabled: true },
  });
  if (!shop) return NextResponse.json({ error: 'Shop not found' }, { status: 404 });

  await db.shop.update({
    where: { id: shopId },
    data: {
      whatsappEnabled: false,
      whatsappPhoneNumber: null,
      whatsappPhoneNumberId: null,
      wabaId: null,
    },
  });

  await logEvent({
    type: 'admin.shop.wa_reset',
    severity: 'warn',
    shopId,
    userId: admin.id,
    message: `${admin.email} reseteó WhatsApp del shop`,
    payload: { wasConnected: shop.whatsappEnabled, wabaId: shop.wabaId },
  });

  return NextResponse.json({ ok: true });
}

export const POST = withOwnerAuth(handler);
