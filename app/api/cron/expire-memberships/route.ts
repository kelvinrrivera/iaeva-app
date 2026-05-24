/**
 * Cron: Marca memberships como EXPIRED cuando se pasa expiresAt.
 * GET /api/cron/expire-memberships
 * Ejecutar una vez al día.
 */

import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { prisma } from '@/lib/db';

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

  const now = new Date();

  const result = await prisma.clientMembership.updateMany({
    where: {
      status: 'ACTIVE',
      expiresAt: { not: null, lte: now },
    },
    data: { status: 'EXPIRED' },
  });

  return NextResponse.json({ expired: result.count });
}
