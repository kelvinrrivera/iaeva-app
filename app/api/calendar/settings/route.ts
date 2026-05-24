import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-middleware';
import { prisma } from '@/lib/db';
import {
  pushAppointmentToCalendar,
  deleteAppointmentFromCalendar,
  syncAllAppointments,
  getCalendarList,
} from '@/lib/integrations/google-calendar';

/**
 * GET - Get calendar settings
 */
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request);

    if (!user.shopId) {
      return NextResponse.json(
        { error: 'No shop selected' },
        { status: 400 }
      );
    }

    const shop = await prisma.shop.findUnique({
      where: { id: user.shopId },
      select: {
        googleCalendarSyncEnabled: true,
        googleCalendarId: true,
        googleCalendarSyncDirection: true,
        icsToken: true,
      },
    });

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'https://domicita.com';

    return NextResponse.json({
      connected: !!shop?.googleCalendarSyncEnabled,
      settings: shop,
      icsToken: shop?.icsToken || null,
      icsFeedUrl: shop?.icsToken ? `${baseUrl}/api/calendar/feed/${shop.icsToken}` : null,
    });
  } catch (error) {
    console.error('Error fetching calendar settings:', error);
    return NextResponse.json(
      { error: 'Failed to fetch calendar settings' },
      { status: 500 }
    );
  }
}

/**
 * PUT - Update calendar settings
 */
export async function PUT(request: NextRequest) {
  try {
    const user = await requireAuth(request);

    if (!user.shopId) {
      return NextResponse.json(
        { error: 'No shop selected' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const { enabled, calendarId, direction } = body;

    await prisma.shop.update({
      where: { id: user.shopId },
      data: {
        googleCalendarSyncEnabled: enabled,
        googleCalendarId: calendarId || null,
        googleCalendarSyncDirection: direction || 'BIDIRECTIONAL',
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error updating calendar settings:', error);
    return NextResponse.json(
      { error: 'Failed to update calendar settings' },
      { status: 500 }
    );
  }
}

/**
 * DELETE - Disconnect calendar
 */
export async function DELETE(request: NextRequest) {
  try {
    const user = await requireAuth(request);

    if (!user.shopId) {
      return NextResponse.json(
        { error: 'No shop selected' },
        { status: 400 }
      );
    }

    await prisma.shop.update({
      where: { id: user.shopId },
      data: {
        googleCalendarSyncEnabled: false,
        googleCalendarRefreshToken: null,
        googleCalendarId: null,
        googleCalendarSyncDirection: null,
      },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error disconnecting calendar:', error);
    return NextResponse.json(
      { error: 'Failed to disconnect calendar' },
      { status: 500 }
    );
  }
}
