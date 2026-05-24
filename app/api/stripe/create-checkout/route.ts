/**
 * Create Stripe Checkout Session API
 *
 * Creates a checkout session for plan upgrade.
 *
 * POST /api/stripe/create-checkout
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-middleware';
import { createCheckoutSession } from '@/lib/stripe/payments';
import { prisma } from '@/lib/db';
import { z } from 'zod';

const createCheckoutSchema = z.object({
  plan: z.enum(['SOLO', 'TEAM', 'BUSINESS']),
  billingCycle: z.enum(['monthly', 'annual']).optional().default('monthly'),
});

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request);

    // Verify user has admin role for their shop
    // requireAuth already handles Supabase UUID ↔ DB ID mismatch via email fallback
    if (!user.shopId || !user.role || !['SUPER_ADMIN', 'ORG_ADMIN'].includes(user.role)) {
      return NextResponse.json(
        { error: 'No shop found' },
        { status: 404 }
      );
    }

    // Fetch shop details
    const membership = await prisma.membership.findFirst({
      where: {
        shopId: user.shopId,
        role: { in: ['SUPER_ADMIN', 'ORG_ADMIN'] },
      },
      include: {
        shop: true,
      },
    });

    if (!membership) {
      return NextResponse.json(
        { error: 'No shop found' },
        { status: 404 }
      );
    }

    // Parse request body
    const body = await request.json();
    const { plan, billingCycle } = createCheckoutSchema.parse(body);

    // Create checkout session
    const appUrl = process.env.NEXT_PUBLIC_APP_URL;
    if (!appUrl) {
      console.error('[Stripe Checkout] NEXT_PUBLIC_APP_URL is not set');
      return NextResponse.json({ error: 'Server misconfiguration' }, { status: 500 });
    }

    const { url, sessionId } = await createCheckoutSession({
      shopId: membership.shopId,
      plan,
      billingCycle,
      successUrl: `${appUrl}/dashboard?checkout=success`,
      cancelUrl: `${appUrl}/dashboard?checkout=canceled`,
      customerEmail: user.email || undefined,
      shopName: membership.shop.name,
    });

    return NextResponse.json({
      success: true,
      checkoutUrl: url,
      sessionId,
    });

  } catch (error: any) {
    console.error('[Stripe Checkout] Error:', error?.message || error);

    if (error.message === 'Unauthorized') {
      return NextResponse.json(
        { error: 'No autenticado' },
        { status: 401 }
      );
    }

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Datos inválidos', details: error.issues },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: error.message || 'Error al crear sesión de checkout' },
      { status: 500 }
    );
  }
}
