/**
 * Billing Usage API
 *
 * Returns current usage metrics for the shop.
 *
 * GET /api/billing/usage
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-middleware';
import { getShopUsage } from '@/lib/plan-enforcement';

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request);

    // Use shopId from requireAuth (handles Supabase UUID ↔ DB ID mismatch)
    if (!user.shopId) {
      return NextResponse.json(
        { error: 'No shop found' },
        { status: 404 }
      );
    }

    // Get usage data
    const usage = await getShopUsage(user.shopId);

    if (!usage) {
      return NextResponse.json(
        { error: 'Failed to fetch usage data' },
        { status: 500 }
      );
    }

    return NextResponse.json(usage);

  } catch (error: any) {
    console.error('Error fetching billing usage:', error);

    return NextResponse.json(
      { error: 'Error al obtener datos de uso' },
      { status: 500 }
    );
  }
}
