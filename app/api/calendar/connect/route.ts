import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-middleware';
import { getAuthUrl } from '@/lib/integrations/google-calendar';
import { prisma } from '@/lib/db';
import crypto from 'crypto';

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request);

    if (!user.shopId) {
      return NextResponse.json(
        { error: 'No shop selected' },
        { status: 400 }
      );
    }

    // Generate state parameter for security
    const state = crypto.randomBytes(16).toString('hex');

    // Store state in shop temporarily (for verification in callback)
    await prisma.shop.update({
      where: { id: user.shopId },
      data: { language: state }, // Using language field temporarily to store state
    });

    // Generate authorization URL
    const authUrl = getAuthUrl(state);

    return NextResponse.json({ authUrl });
  } catch (error) {
    console.error('Error initiating calendar connect:', error);
    return NextResponse.json(
      { error: 'Failed to initiate calendar connection' },
      { status: 500 }
    );
  }
}
