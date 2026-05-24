import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-middleware';
import { getAnalyticsData } from '@/lib/analytics/metrics';
import { canUseFeature } from '@/lib/plan-enforcement';
import { prisma } from '@/lib/db';

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request);

    if (!user.shopId) {
      return NextResponse.json(
        { error: 'No shop selected' },
        { status: 400 }
      );
    }

    // Enforce analytics feature gate (SOLO+ only)
    const shop = await prisma.shop.findUnique({ where: { id: user.shopId } });
    if (!shop || !canUseFeature(shop, 'analytics')) {
      return NextResponse.json(
        { error: 'Analytics requiere plan SOLO o superior.', upgradeRequired: true },
        { status: 403 }
      );
    }

    const searchParams = request.nextUrl.searchParams;
    const periodParam = searchParams.get('period') || '30d';

    // Calculate period dates
    const days = periodParam === '7d' ? 7 : periodParam === '90d' ? 90 : 30;
    const end = new Date();
    end.setHours(23, 59, 59, 999);
    const start = new Date();
    start.setDate(start.getDate() - days);
    start.setHours(0, 0, 0, 0);

    const period = { start, end };

    // Get analytics data
    const analyticsData = await getAnalyticsData(user.shopId, period);

    return NextResponse.json(analyticsData);
  } catch (error) {
    console.error('Error fetching analytics:', error);
    return NextResponse.json(
      { error: 'Failed to fetch analytics' },
      { status: 500 }
    );
  }
}
