/**
 * Stripe Customer Portal API
 *
 * Creates a portal session for managing subscription.
 *
 * POST /api/stripe/portal
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-middleware';
import { createPortalSession, getOrCreateCustomer } from '@/lib/stripe/payments';
import { prisma } from '@/lib/db';

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request);

    // Use shopId from requireAuth (handles Supabase UUID ↔ DB ID mismatch)
    if (!user.shopId || !user.role || !['SUPER_ADMIN', 'ORG_ADMIN'].includes(user.role)) {
      return NextResponse.json(
        { error: 'No Stripe customer found' },
        { status: 404 }
      );
    }

    const membership = await prisma.membership.findFirst({
      where: {
        shopId: user.shopId,
        role: { in: ['SUPER_ADMIN', 'ORG_ADMIN'] },
      },
      include: {
        shop: true,
      },
    });

    if (!membership || !membership.shop.stripeCustomerId) {
      return NextResponse.json(
        { error: 'No Stripe customer found' },
        { status: 404 }
      );
    }

    // Create portal session
    const portalUrl = await createPortalSession(
      membership.shop.stripeCustomerId,
      `${process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'}/dashboard/settings?portal=true`
    );

    return NextResponse.json({
      success: true,
      portalUrl,
    });

  } catch (error: any) {
    console.error('Error creating portal session:', error);

    return NextResponse.json(
      { error: 'Error al crear sesión del portal' },
      { status: 500 }
    );
  }
}
