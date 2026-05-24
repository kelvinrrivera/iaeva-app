/**
 * GET /api/cron/downgrade-grace-expired
 * Runs once per day. Downgrades shops whose payment grace period has expired
 * (subscriptionStatus = 'past_due' and gracePeriodEndsAt <= now) to FREE plan.
 */

import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { prisma } from '@/lib/db';

function verifyCronSecret(request: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    console.error('[downgrade-grace-expired] CRON_SECRET not set');
    return false;
  }
  const authHeader = request.headers.get('authorization');
  if (!authHeader) return false;
  const expected = `Bearer ${cronSecret}`;
  if (authHeader.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(authHeader), Buffer.from(expected));
}

export async function GET(request: NextRequest) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const now = new Date();

  // No more "downgrade to FREE" — paid plans only. When the grace period
  // ends without payment, we mark the shop as suspended and disable WhatsApp
  // dispatch until the owner reactivates by subscribing again.
  const result = await prisma.shop.updateMany({
    where: {
      subscriptionStatus: 'past_due',
      gracePeriodEndsAt: { not: null, lte: now },
    },
    data: {
      subscriptionStatus: 'suspended',
      whatsappEnabled: false,
      gracePeriodEndsAt: null,
    },
  });

  console.log(`[downgrade-grace-expired] Suspended ${result.count} shop(s)`);
  return NextResponse.json({ ok: true, suspended: result.count });
}
