/**
 * Reminder Configuration API
 *
 * GET  /api/reminders/config  — Get shop reminder config
 * POST /api/reminders/config  — Save shop reminder config
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-middleware';
import { prisma } from '@/lib/db';
import { z } from 'zod';

const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;

const reminderConfigSchema = z.object({
  remind24h: z.boolean(),
  remind6h:  z.boolean(),
  remind2h:  z.boolean(),
  remind1h:  z.boolean(),
  // Quiet hours (optional for backwards-compat with older clients)
  quietHoursEnabled:  z.boolean().optional(),
  quietHoursStart:    z.string().regex(HHMM).optional(),
  quietHoursEnd:      z.string().regex(HHMM).optional(),
  quietDaysJson:      z.string().optional(),
  allowUrgentInQuiet: z.boolean().optional(),
});

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    if (!user.shopId) return NextResponse.json({ error: 'No shop found' }, { status: 404 });

    const config = await prisma.reminderConfig.findUnique({
      where: { shopId: user.shopId },
    });

    return NextResponse.json({
      remind24h: config?.remind24h ?? true,
      remind6h:  config?.remind6h  ?? true,
      remind2h:  config?.remind2h  ?? false,
      remind1h:  config?.remind1h  ?? false,
      quietHoursEnabled:  config?.quietHoursEnabled  ?? true,
      quietHoursStart:    config?.quietHoursStart    ?? '21:00',
      quietHoursEnd:      config?.quietHoursEnd      ?? '08:00',
      quietDaysJson:      config?.quietDaysJson      ?? '[]',
      allowUrgentInQuiet: config?.allowUrgentInQuiet ?? false,
    });
  } catch (error: any) {
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    if (!user.shopId) return NextResponse.json({ error: 'No shop found' }, { status: 404 });

    const body = await request.json();
    const data = reminderConfigSchema.parse(body);

    // Validate quietDaysJson is a JSON array of ints 0-6 (Sunday-Saturday)
    if (data.quietDaysJson) {
      try {
        const arr = JSON.parse(data.quietDaysJson);
        if (!Array.isArray(arr) || arr.some(n => typeof n !== 'number' || n < 0 || n > 6)) {
          return NextResponse.json({ error: 'quietDaysJson must be [0..6] integers' }, { status: 400 });
        }
      } catch {
        return NextResponse.json({ error: 'quietDaysJson invalid' }, { status: 400 });
      }
    }

    const config = await prisma.reminderConfig.upsert({
      where: { shopId: user.shopId },
      update: data,
      create: { shopId: user.shopId!, ...data },
    });

    return NextResponse.json({ success: true, config });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Invalid data', details: error.issues }, { status: 400 });
    }
    return NextResponse.json({ error: 'Internal server error' }, { status: 500 });
  }
}
