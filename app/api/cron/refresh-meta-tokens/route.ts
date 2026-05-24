/**
 * GET /api/cron/refresh-meta-tokens
 *
 * Refreshes Meta long-lived access tokens for all shops using META provider
 * that have < 35 days remaining before expiry.
 *
 * Should be called every 30 days via Vercel Cron.
 * A 5-day overlap between cron interval (30d) and refresh window (35d)
 * ensures tokens are always renewed before expiry even if one cron run fails.
 */

import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import { exchangeForLongLivedToken, shouldRefreshToken } from '@/lib/whatsapp/meta-token';

export const dynamic = 'force-dynamic';

const CRON_SECRET = process.env.CRON_SECRET;

export async function GET(request: Request) {
  // Verify cron secret to prevent unauthorized calls
  const auth = request.headers.get('authorization');
  if (CRON_SECRET && auth !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const shops = await prisma.shop.findMany({
    where: {
      whatsappProvider: 'META',
      whatsappEnabled: true,
      metaAccessToken: { not: null },
    },
    select: {
      id: true,
      name: true,
      metaAccessToken: true,
      metaTokenExpiresAt: true,
    },
  });

  const results = {
    total: shops.length,
    refreshed: 0,
    skipped: 0,
    failed: 0,
    failures: [] as { shopId: string; shopName: string; error: string }[],
  };

  await Promise.allSettled(
    shops.map(async (shop) => {
      if (!shouldRefreshToken(shop.metaTokenExpiresAt)) {
        results.skipped++;
        return;
      }

      try {
        const { accessToken, expiresAt } = await exchangeForLongLivedToken(shop.metaAccessToken!);

        await prisma.shop.update({
          where: { id: shop.id },
          data: {
            metaAccessToken: accessToken,
            metaTokenExpiresAt: expiresAt,
          },
        });

        results.refreshed++;
        console.log(`[meta-token-refresh] ✓ ${shop.name} (${shop.id}) — expires ${expiresAt.toISOString()}`);
      } catch (err: any) {
        results.failed++;
        results.failures.push({
          shopId: shop.id,
          shopName: shop.name,
          error: err.message,
        });
        console.error(`[meta-token-refresh] ✗ ${shop.name} (${shop.id}):`, err.message);

        // Mark token as expired so the dashboard alert triggers
        await prisma.shop.update({
          where: { id: shop.id },
          data: { metaTokenExpiresAt: new Date(0) },
        }).catch(() => {});
      }
    })
  );

  console.log(`[meta-token-refresh] Done — ${results.refreshed} refreshed, ${results.skipped} skipped, ${results.failed} failed`);

  return NextResponse.json({
    ok: true,
    timestamp: new Date().toISOString(),
    ...results,
  });
}
