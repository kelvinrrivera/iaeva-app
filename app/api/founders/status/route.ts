/**
 * GET /api/founders/status
 *
 * Public endpoint — returns how many founder slots remain. Used by the
 * landing-page banner to show urgency ("27/50 cupos restantes").
 *
 * Cached on the edge for 60 seconds — the number doesn't need to be
 * exactly real-time and we don't want to hammer the DB on every landing visit.
 */

import { NextResponse } from 'next/server';
import { getFounderStatus } from '@/lib/founder-program';

export const revalidate = 60;

export async function GET() {
  try {
    const status = await getFounderStatus();
    return NextResponse.json(status, {
      headers: {
        'Cache-Control': 'public, s-maxage=60, stale-while-revalidate=300',
      },
    });
  } catch (err) {
    console.error('[founders/status] error:', err);
    // Fail open with a safe default so the landing banner never breaks the page.
    return NextResponse.json({
      totalSlots: 50,
      claimedSlots: 0,
      remainingSlots: 50,
      isOpen: true,
      discountPct: 50,
    });
  }
}
