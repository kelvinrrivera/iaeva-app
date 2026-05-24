/**
 * GET /api/admin/founders
 *
 * Admin-only view of the founder program: who has the discount, how many
 * slots are left, when each one joined.
 */

import { NextResponse, NextRequest } from 'next/server';
import { withOwnerAuth, type AdminUser } from '@/lib/admin-auth';
import { db } from '@/lib/database';
import { getFounderStatus } from '@/lib/founder-program';

async function handler(_admin: AdminUser, _req: NextRequest) {
  const [status, founders] = await Promise.all([
    getFounderStatus(),
    db.shop.findMany({
      where: { isFounder: true },
      orderBy: { foundedAt: 'asc' },
      select: {
        id: true,
        name: true,
        plan: true,
        founderDiscountPct: true,
        foundedAt: true,
        subscriptionStatus: true,
        stripeSubscriptionId: true,
        memberships: {
          take: 1,
          orderBy: { createdAt: 'asc' },
          include: { user: { select: { email: true, name: true } } },
        },
      },
    }),
  ]);

  return NextResponse.json({
    status,
    founders: founders.map((s) => ({
      shopId: s.id,
      shopName: s.name,
      plan: s.plan,
      discountPct: s.founderDiscountPct,
      joinedAt: s.foundedAt,
      subscriptionStatus: s.subscriptionStatus,
      hasPaid: !!s.stripeSubscriptionId,
      ownerEmail: s.memberships[0]?.user?.email ?? null,
      ownerName: s.memberships[0]?.user?.name ?? null,
    })),
  });
}

export const GET = withOwnerAuth(handler);
