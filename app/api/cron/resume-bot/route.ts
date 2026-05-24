/**
 * Cron: revert HUMAN/BOT_PAUSED conversations back to BOT once botResumesAt
 * is in the past. Runs every hour.
 */

import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { db } from '@/lib/database';

function verifyCronSecret(request: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return false;
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

  const result = await db.whatsAppConversation.updateMany({
    where: {
      controlMode: { in: ['HUMAN', 'BOT_PAUSED'] },
      botResumesAt: { not: null, lte: new Date() },
    },
    data: {
      controlMode: 'BOT',
      botResumesAt: null,
      takeoverReason: null,
    },
  });

  return NextResponse.json({ resumed: result.count });
}
