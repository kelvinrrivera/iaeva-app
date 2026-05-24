/**
 * Subscription Management API
 *
 * Handles subscription cancellation and reactivation.
 *
 * DELETE /api/billing/subscription - Cancel subscription
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-middleware';
import { cancelSubscription } from '@/lib/stripe/payments';
import { prisma } from '@/lib/db';

export async function DELETE(request: NextRequest) {
  try {
    const user = await requireAuth(request);

    // Use shopId from requireAuth (handles Supabase UUID ↔ DB ID mismatch)
    if (!user.shopId || !user.role || !['SUPER_ADMIN', 'ORG_ADMIN'].includes(user.role)) {
      return NextResponse.json(
        { error: 'No active subscription found' },
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

    if (!membership || !membership.shop.stripeSubscriptionId) {
      return NextResponse.json(
        { error: 'No active subscription found' },
        { status: 404 }
      );
    }

    // Cancel subscription in Stripe
    await cancelSubscription(membership.shop.stripeSubscriptionId);

    // Update shop
    await prisma.shop.update({
      where: { id: membership.shopId },
      data: {
        subscriptionStatus: 'canceled',
      },
    });

    return NextResponse.json({
      success: true,
      message: 'Subscription will be canceled at period end',
    });

  } catch (error: any) {
    console.error('Error canceling subscription:', error);

    return NextResponse.json(
      { error: 'Error al cancelar suscripción' },
      { status: 500 }
    );
  }
}
