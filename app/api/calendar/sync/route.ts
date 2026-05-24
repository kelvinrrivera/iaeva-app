import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-middleware';
import { syncAllAppointments, getCalendarList } from '@/lib/integrations/google-calendar';

/**
 * POST - Trigger manual sync
 */
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request);

    if (!user.shopId) {
      return NextResponse.json(
        { error: 'No shop selected' },
        { status: 400 }
      );
    }

    const results = await syncAllAppointments(user.shopId);

    return NextResponse.json({
      success: true,
      results,
    });
  } catch (error) {
    console.error('Error syncing calendar:', error);
    return NextResponse.json(
      { error: 'Failed to sync calendar' },
      { status: 500 }
    );
  }
}

/**
 * GET - Get list of user's calendars
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

    const calendars = await getCalendarList(user.shopId);

    return NextResponse.json({ calendars });
  } catch (error) {
    console.error('Error fetching calendars:', error);
    return NextResponse.json(
      { error: 'Failed to fetch calendars' },
      { status: 500 }
    );
  }
}
