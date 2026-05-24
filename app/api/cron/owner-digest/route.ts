/**
 * GET /api/cron/owner-digest
 * Runs every 15 minutes. For each shop with ownerNotificationPhone set,
 * sends a morning digest ~15 min before opening and an evening digest ~15 min after closing.
 */

import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { db } from '@/lib/database';
import { sendOwnerMorningDigest, sendOwnerEveningDigest } from '@/lib/whatsapp/owner-notifier';

function verifyCronSecret(request: NextRequest): boolean {
    const cronSecret = process.env.CRON_SECRET;
    if (!cronSecret) {
        console.error('[owner-digest] CRON_SECRET not set');
        return false;
    }
    const authHeader = request.headers.get('authorization');
    if (!authHeader) return false;
    const expected = `Bearer ${cronSecret}`;
    if (authHeader.length !== expected.length) return false;
    return timingSafeEqual(Buffer.from(authHeader), Buffer.from(expected));
}

function nowInTz(tz: string): { dayOfWeek: number; hhmm: string } {
    const fmt = new Intl.DateTimeFormat('en-US', {
        timeZone: tz,
        weekday: 'short',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
    });
    const parts = fmt.formatToParts(new Date());
    const weekday = parts.find(p => p.type === 'weekday')?.value ?? 'Sun';
    const hour = parts.find(p => p.type === 'hour')?.value ?? '00';
    const minute = parts.find(p => p.type === 'minute')?.value ?? '00';
    const days: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
    return { dayOfWeek: days[weekday] ?? 0, hhmm: `${hour === '24' ? '00' : hour}:${minute}` };
}

function minutesDiff(a: string, b: string): number {
    const [ah, am] = a.split(':').map(Number);
    const [bh, bm] = b.split(':').map(Number);
    return (ah * 60 + am) - (bh * 60 + bm);
}

export async function GET(request: NextRequest) {
    if (!verifyCronSecret(request)) {
        return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }

    const shops = await db.shop.findMany({
        where: { ownerNotificationPhone: { not: null } },
        select: {
            id: true,
            timezone: true,
            ownerNotificationPhone: true,
            hours: { select: { dayOfWeek: true, startTime: true, endTime: true } },
        },
    });

    let morningCount = 0;
    let eveningCount = 0;

    await Promise.allSettled(
        shops.map(async (shop) => {
            if (!shop.ownerNotificationPhone) return;
            const tz = shop.timezone ?? 'America/Santo_Domingo';
            const now = nowInTz(tz);
            const todayHours = shop.hours.filter(h => h.dayOfWeek === now.dayOfWeek);

            for (const slot of todayHours) {
                const minsToOpen = minutesDiff(slot.startTime, now.hhmm);
                // Morning: 0–15 minutes before opening
                if (minsToOpen >= 0 && minsToOpen <= 15) {
                    const today = new Date();
                    const tzDate = new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(today);
                    const startOfToday = new Date(`${tzDate}T00:00:00`);
                    const endOfToday = new Date(`${tzDate}T23:59:59`);

                    const appointments = await db.appointment.findMany({
                        where: {
                            shopId: shop.id,
                            startTime: { gte: startOfToday, lte: endOfToday },
                            status: { in: ['CONFIRMED', 'SCHEDULED'] },
                        },
                        orderBy: { startTime: 'asc' },
                        select: { startTime: true },
                    });

                    if (appointments.length === 0) return;

                    const fmt = (d: Date) => new Intl.DateTimeFormat('es-DO', {
                        timeZone: tz, hour: '2-digit', minute: '2-digit', hour12: true,
                    }).format(d);

                    await sendOwnerMorningDigest({
                        shopId: shop.id,
                        totalAppointments: appointments.length,
                        firstAppointment: fmt(appointments[0].startTime),
                        lastAppointment: fmt(appointments[appointments.length - 1].startTime),
                    });
                    morningCount++;
                }

                const minsSinceClose = minutesDiff(now.hhmm, slot.endTime);
                // Evening: 0–15 minutes after closing
                if (minsSinceClose >= 0 && minsSinceClose <= 15) {
                    const today = new Date();
                    const tzDate = new Intl.DateTimeFormat('en-CA', { timeZone: tz }).format(today);
                    const startOfToday = new Date(`${tzDate}T00:00:00`);
                    const endOfToday = new Date(`${tzDate}T23:59:59`);

                    const [completed, total, noShows, revenue] = await Promise.all([
                        db.appointment.count({
                            where: { shopId: shop.id, startTime: { gte: startOfToday, lte: endOfToday }, status: 'COMPLETED' },
                        }),
                        db.appointment.count({
                            where: { shopId: shop.id, startTime: { gte: startOfToday, lte: endOfToday }, status: { not: 'CANCELLED' } },
                        }),
                        db.appointment.count({
                            where: { shopId: shop.id, startTime: { gte: startOfToday, lte: endOfToday }, status: 'NO_SHOW' },
                        }),
                        db.appointment.aggregate({
                            where: { shopId: shop.id, startTime: { gte: startOfToday, lte: endOfToday }, status: 'COMPLETED' },
                            _sum: { paidAmount: true },
                        }),
                    ]);

                    const newClients = await db.client.count({
                        where: { shopId: shop.id, createdAt: { gte: startOfToday, lte: endOfToday } },
                    });

                    const revenueAmount = revenue._sum.paidAmount ?? 0;
                    const revenueStr = `RD$${Number(revenueAmount).toLocaleString('es-DO')}`;

                    await sendOwnerEveningDigest({
                        shopId: shop.id,
                        completed,
                        total,
                        noShows,
                        newClients,
                        revenue: revenueStr,
                    });
                    eveningCount++;
                }
            }
        })
    );

    return NextResponse.json({ ok: true, morningCount, eveningCount });
}
