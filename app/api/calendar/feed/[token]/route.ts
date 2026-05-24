/**
 * GET /api/calendar/feed/[token]
 *
 * Public ICS calendar feed — no authentication required.
 * Calendar apps (Apple, Android, Outlook) subscribe to this URL
 * and periodically fetch the latest appointments.
 *
 * Security: Protected by a unique token per shop.
 */

import { NextRequest, NextResponse } from 'next/server';
import { prisma } from '@/lib/db';

function formatICSDate(date: Date): string {
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}

function escapeICS(text: string): string {
  return text.replace(/\\/g, '\\\\').replace(/;/g, '\\;').replace(/,/g, '\\,').replace(/\n/g, '\\n');
}

function mapStatus(status: string): string {
  switch (status) {
    case 'CONFIRMED':
    case 'SCHEDULED':
      return 'CONFIRMED';
    case 'CANCELLED':
      return 'CANCELLED';
    case 'COMPLETED':
      return 'CONFIRMED';
    default:
      return 'TENTATIVE';
  }
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  const { token } = await params;

  if (!token || token.length < 16) {
    return new NextResponse('Not Found', { status: 404 });
  }

  const shop = await prisma.shop.findUnique({
    where: { icsToken: token },
    select: { id: true, name: true, timezone: true },
  });

  if (!shop) {
    return new NextResponse('Not Found', { status: 404 });
  }

  // Fetch appointments: last 30 days + all future, excluding cancelled/no-show
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const appointments = await prisma.appointment.findMany({
    where: {
      shopId: shop.id,
      startTime: { gte: thirtyDaysAgo },
      status: { in: ['SCHEDULED', 'CONFIRMED', 'COMPLETED', 'IN_PROGRESS'] },
    },
    include: {
      service: { select: { name: true } },
      stylist: { select: { name: true } },
    },
    orderBy: { startTime: 'asc' },
    take: 500,
  });

  // Build ICS content
  const events = appointments.map(apt => {
    const summary = escapeICS(`${apt.service.name} - ${apt.clientName}`);
    // Omit WhatsApp number and free-text notes from public feed to protect client PII
    const description = escapeICS(
      `Servicio: ${apt.service.name}\nCliente: ${apt.clientName}${apt.stylist ? `\nBarbero: ${apt.stylist.name}` : ''}`
    );

    return [
      'BEGIN:VEVENT',
      `UID:${apt.id}@domicita.com`,
      `DTSTAMP:${formatICSDate(new Date())}`,
      `DTSTART:${formatICSDate(apt.startTime)}`,
      `DTEND:${formatICSDate(apt.endTime)}`,
      `SUMMARY:${summary}`,
      `DESCRIPTION:${description}`,
      `STATUS:${mapStatus(apt.status)}`,
      'END:VEVENT',
    ].join('\r\n');
  });

  const calendarName = escapeICS(`${shop.name} - Citas`);
  const ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//DomiCita//Calendar//ES',
    'CALSCALE:GREGORIAN',
    'METHOD:PUBLISH',
    `X-WR-CALNAME:${calendarName}`,
    `X-WR-TIMEZONE:${shop.timezone || 'America/Santo_Domingo'}`,
    ...events,
    'END:VCALENDAR',
  ].join('\r\n');

  return new NextResponse(ics, {
    status: 200,
    headers: {
      'Content-Type': 'text/calendar; charset=utf-8',
      'Content-Disposition': `attachment; filename="${shop.name.replace(/[^a-zA-Z0-9]/g, '_')}_citas.ics"`,
      'Cache-Control': 'no-cache, no-store, must-revalidate',
    },
  });
}
