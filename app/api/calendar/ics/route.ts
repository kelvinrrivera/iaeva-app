/**
 * POST /api/calendar/ics — Generate ICS feed token
 * DELETE /api/calendar/ics — Revoke ICS feed token
 *
 * Authenticated endpoints for managing the ICS calendar subscription feed.
 */

import { NextResponse } from 'next/server';
import crypto from 'crypto';
import { withAuth, type AuthenticatedUser } from '@/lib/auth-middleware';
import { prisma } from '@/lib/db';

export async function POST(request: Request) {
  return withAuth(async (authUser: AuthenticatedUser) => {
    const shopId = authUser.shopId;
    if (!shopId) {
      return NextResponse.json({ error: 'Shop not found' }, { status: 404 });
    }

    const token = crypto.randomBytes(32).toString('hex');

    await prisma.shop.update({
      where: { id: shopId },
      data: { icsToken: token },
    });

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://domicita.com';
    const feedUrl = `${baseUrl}/api/calendar/feed/${token}`;

    return NextResponse.json({ token, feedUrl });
  }, request as any);
}

export async function DELETE(request: Request) {
  return withAuth(async (authUser: AuthenticatedUser) => {
    const shopId = authUser.shopId;
    if (!shopId) {
      return NextResponse.json({ error: 'Shop not found' }, { status: 404 });
    }

    await prisma.shop.update({
      where: { id: shopId },
      data: { icsToken: null },
    });

    return NextResponse.json({ success: true });
  }, request as any);
}
