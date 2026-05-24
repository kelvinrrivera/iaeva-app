import { NextRequest, NextResponse } from 'next/server';
import { getTokensFromCode } from '@/lib/integrations/google-calendar';
import { prisma } from '@/lib/db';

import { withAuth, type AuthenticatedUser } from "@/lib/auth-middleware";
export async function GET(request: NextRequest) {
    return withAuth(async (authUser: AuthenticatedUser) => {
  try {
    const searchParams = request.nextUrl.searchParams;
    const code = searchParams.get('code');
    const state = searchParams.get('state');
    const error = searchParams.get('error');

    if (error) {
      return NextResponse.redirect(
        new URL(`/dashboard/settings?calendar_error=${error}`, request.url)
      );
    }

    if (!code) {
      return NextResponse.redirect(
        new URL('/dashboard/settings?calendar_error=no_code', request.url)
      );
    }

    // Get tokens from Google
    const { refreshToken } = await getTokensFromCode(code);

    // Find shop by state (temporary storage)
    const shop = await prisma.shop.findFirst({
      where: { language: state || undefined },
    });

    if (!shop) {
      return NextResponse.redirect(
        new URL('/dashboard/settings?calendar_error=invalid_state', request.url)
      );
    }

    // Update shop with refresh token and enable sync
    await prisma.shop.update({
      where: { id: shop.id },
      data: {
        googleCalendarRefreshToken: refreshToken,
        googleCalendarSyncEnabled: true,
        googleCalendarSyncDirection: 'BIDIRECTIONAL',
        language: 'es', // Reset language to default
      },
    });

    return NextResponse.redirect(
      new URL('/dashboard/settings?calendar_success=connected', request.url)
    );
  } catch (error) {
    console.error('Error in calendar callback:', error);
    return NextResponse.redirect(
      new URL('/dashboard/settings?calendar_error=failed', request.url)
    );
  }
}, request as any);
}
