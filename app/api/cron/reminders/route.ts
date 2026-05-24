/**
 * Cron Job Endpoint for Multi-cycle Appointment Reminders
 *
 * Runs every 30 minutes. Sends reminders for each active cycle (24h, 6h, 2h, 1h)
 * respecting each shop's ReminderConfig preferences.
 *
 * GET /api/cron/reminders
 *
 * Schedule (Vercel Cron or similar):
 * - Every 30 min: GET /api/cron/reminders
 */

import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { prisma } from '@/lib/db';
import { sendWhatsAppMessage, sendTemplateByPurpose, sanitizeUserText } from '@/lib/whatsapp/sender';
import { isWithinQuietHours, type MessageCategory } from '@/lib/whatsapp/quiet-hours';
import { startCronRun, finishCronRun } from '@/lib/cron-run';

function verifyCronSecret(request: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    console.error('[Cron] CRON_SECRET environment variable is not set');
    return false;
  }
  const authHeader = request.headers.get('authorization');
  if (!authHeader) return false;
  const expected = `Bearer ${cronSecret}`;
  if (authHeader.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(authHeader), Buffer.from(expected));
}

/**
 * Reminder cycle configuration
 */
const REMINDER_CYCLES = [
  {
    key: 'remind24h' as const,
    field: 'reminder24hSentAt' as const,
    purpose: 'appointment_reminder_24h',
    hoursAhead: 24,
    windowMinutes: 30, // ±30 min window
    category: 'regular' as MessageCategory,
    buildMessage: (clientName: string, time: string, professional: string, shopName: string) =>
      `⏰ ${clientName}, te recordamos tu cita *mañana a las ${time}* con ${professional}.\n\n📍 ${shopName}\n\nTe esperamos puntual. Si necesitas reagendar, escríbenos cuanto antes.`,
  },
  {
    key: 'remind6h' as const,
    field: 'reminder6hSentAt' as const,
    purpose: 'appointment_reminder_6h',
    hoursAhead: 6,
    windowMinutes: 30,
    category: 'regular' as MessageCategory,
    buildMessage: (clientName: string, time: string, professional: string, shopName: string) =>
      `⏰ ${clientName}, en *6 horas* tienes tu cita con ${professional} a las ${time}.\n\n📍 ${shopName}\n\nTe esperamos.`,
  },
  {
    key: 'remind2h' as const,
    field: 'reminder2hSentAt' as const,
    purpose: 'appointment_reminder_2h',
    hoursAhead: 2,
    windowMinutes: 20,
    category: 'urgent' as MessageCategory,
    buildMessage: (clientName: string, time: string, _professional: string, shopName: string) =>
      `🔔 ${clientName}, en *2 horas* te esperamos a las ${time}.\n\n📍 ${shopName}`,
  },
  {
    key: 'remind1h' as const,
    field: 'reminder1hSentAt' as const,
    purpose: 'appointment_reminder_1h',
    hoursAhead: 1,
    windowMinutes: 15,
    category: 'urgent' as MessageCategory,
    buildMessage: (clientName: string, time: string, _professional: string, shopName: string) =>
      `🚨 ${clientName}, en *1 hora* te esperamos a las ${time} en ${shopName}.`,
  },
] as const;


export async function GET(request: NextRequest) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const runId = await startCronRun('reminders');
  const now = new Date();
  const results: Record<string, { sent: number; errors: number; deferred: number }> = {};
  let totalSent = 0;
  let totalErrors = 0;
  let totalDeferred = 0;

  for (const cycle of REMINDER_CYCLES) {
    const sent = { count: 0, errors: 0 };

    // Window: appointments starting between (now + hoursAhead - window) and (now + hoursAhead + window)
    const windowStart = new Date(now.getTime() + cycle.hoursAhead * 60 * 60 * 1000 - cycle.windowMinutes * 60 * 1000);
    const windowEnd = new Date(now.getTime() + cycle.hoursAhead * 60 * 60 * 1000 + cycle.windowMinutes * 60 * 1000);

    // Find appointments in this window that haven't received this reminder yet
    const appointments = await prisma.appointment.findMany({
      where: {
        startTime: { gte: windowStart, lte: windowEnd },
        status: { in: ['SCHEDULED', 'CONFIRMED'] },
        [cycle.field]: null, // Not sent yet
        shop: {
          whatsappEnabled: true,
          reminderConfig: {
            [cycle.key]: true,
          },
        },
      },
      include: {
        shop: {
          select: {
            name: true,
            whatsappEnabled: true,
            whatsappPhoneNumber: true,
            timezone: true,
            reminderConfig: true,
          },
        },
        stylist: { select: { name: true } },
        service: { select: { name: true } },
      },
    });

    // Filter eligible appointments + quiet hours check.
    // Citas en quiet hours NO se marcan como enviadas — el siguiente run las re-intenta.
    let deferred = 0;
    const eligible = appointments.filter((a) => {
      if (!a.shop.whatsappEnabled || !a.shop.whatsappPhoneNumber || !a.clientWhatsApp) return false;
      const quiet = isWithinQuietHours(
        now,
        a.shop.reminderConfig,
        a.shop.timezone || 'America/Santo_Domingo',
        cycle.category,
      );
      if (quiet.quiet) {
        deferred++;
        return false;
      }
      return true;
    });

    // Send in batches of 5 concurrent requests — avoids hammering Meta/Twilio
    // and keeps the cron within serverless time limits even with hundreds of reminders.
    const CONCURRENCY = 5;
    for (let i = 0; i < eligible.length; i += CONCURRENCY) {
      const chunk = eligible.slice(i, i + CONCURRENCY);
      const outcomes = await Promise.allSettled(
        chunk.map(async (appt) => {
          const shopTz = appt.shop.timezone || 'America/Santo_Domingo';
          // 12h AM/PM in shop timezone (e.g. "2:30 PM") — RD does not use 24h.
          const timeStr = appt.startTime.toLocaleTimeString('en-US', {
            hour: 'numeric',
            minute: '2-digit',
            hour12: true,
            timeZone: shopTz,
          });

          const clientName = sanitizeUserText(appt.clientName, 80);
          const professional = sanitizeUserText(appt.stylist?.name, 80) || 'tu profesional';
          const shopName = sanitizeUserText(appt.shop.name, 120);
          const serviceName = sanitizeUserText(appt.service?.name, 80) || 'tu cita';
          const fallbackText = cycle.buildMessage(clientName, timeStr, professional, shopName);

          // Build variables ordered to match each template's body params
          let variables: Record<string, string>;
          switch (cycle.purpose) {
            case 'appointment_reminder_24h':
            case 'appointment_reminder_6h':
              variables = { '1': clientName, '2': serviceName, '3': timeStr };
              break;
            case 'appointment_reminder_2h':
              variables = { '1': clientName, '2': timeStr };
              break;
            case 'appointment_reminder_1h':
              variables = { '1': clientName };
              break;
            default:
              variables = { '1': clientName, '2': serviceName, '3': timeStr };
          }

          await sendTemplateByPurpose({
            shopId: appt.shopId,
            to: appt.clientWhatsApp!,
            purpose: cycle.purpose,
            variables,
            fallbackText,
          });

          return appt.id;
        })
      );

      // Collect IDs of successful sends for a single batched DB update
      const successIds: string[] = [];
      outcomes.forEach((o, idx) => {
        if (o.status === 'fulfilled') {
          successIds.push(o.value);
          sent.count++;
          totalSent++;
        } else {
          console.error(
            `Reminder ${cycle.key} failed for appt ${chunk[idx].id}:`,
            (o.reason as any)?.message || o.reason
          );
          sent.errors++;
          totalErrors++;
        }
      });

      if (successIds.length > 0) {
        await prisma.appointment.updateMany({
          where: { id: { in: successIds } },
          data: { [cycle.field]: now },
        });
      }
    }

    results[cycle.key] = { sent: sent.count, errors: sent.errors, deferred };
    totalDeferred += deferred;
  }

  await finishCronRun(runId, {
    status: totalErrors === 0 ? 'success' : 'partial',
    itemsSent: totalSent,
    itemsErrors: totalErrors,
    itemsDeferred: totalDeferred,
    details: results,
  });

  return NextResponse.json({
    success: true,
    timestamp: now.toISOString(),
    totalSent,
    totalErrors,
    totalDeferred,
    cycles: results,
  });
}

// Also support POST for flexibility
export async function POST(request: NextRequest) {
  return GET(request);
}
