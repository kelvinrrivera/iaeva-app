/**
 * Notification Scheduler
 *
 * Scheduled jobs for sending appointment reminders and notifications.
 * Uses cron-like scheduling with Next.js route handlers.
 *
 * In production, this should be run as a separate cron job or
 * using Vercel Cron Jobs / GitHub Actions.
 */

import { prisma } from '@/lib/db';
import { sendAppointmentReminder } from '@/lib/whatsapp/templates';

/**
 * Get appointments that need reminders
 *
 * @param hoursBefore - Hours before appointment to send reminder
 * @returns List of appointments needing reminders
 */
async function getAppointmentsNeedingReminders(hoursBefore: number) {
  const now = new Date();
  const reminderTime = new Date(now.getTime() + hoursBefore * 60 * 60 * 1000);
  const reminderEndTime = new Date(reminderTime.getTime() + 60 * 60 * 1000); // 1 hour window

  return await prisma.appointment.findMany({
    where: {
      status: 'SCHEDULED',
      startTime: {
        gte: reminderTime,
        lt: reminderEndTime,
      },
      // Only get appointments that haven't had a recent reminder
      // This prevents duplicate reminders
      reminder24hSentAt: null,
    },
    include: {
      client: true,
      service: true,
      stylist: true,
      shop: true,
    },
  });
}

/**
 * Send reminder for a single appointment
 */
async function sendReminder(appointment: any) {
  try {
    const result = await sendAppointmentReminder(
      appointment.client.phone,
      {
        clientName: appointment.client.name,
        serviceName: appointment.service.name,
        date: new Date(appointment.startTime).toLocaleDateString('es-DO', {
          weekday: 'long',
          year: 'numeric',
          month: 'long',
          day: 'numeric',
        }),
        time: new Date(appointment.startTime).toLocaleTimeString('es-DO', {
          hour: '2-digit',
          minute: '2-digit',
        }),
        shopName: appointment.shop.name,
      },
      appointment.shop.shopType,
      appointment.shop.id,
      false // Use text message for now (template approval pending)
    );

    if (result.success) {
      // Update appointment with reminder timestamp
      await prisma.appointment.update({
        where: { id: appointment.id },
        data: { reminder24hSentAt: new Date() },
      });

      console.log(`Reminder sent for appointment ${appointment.id}`);
      return { success: true, appointmentId: appointment.id };
    } else {
      console.error(`Failed to send reminder for appointment ${appointment.id}:`, result.error);
      return { success: false, appointmentId: appointment.id, error: result.error };
    }
  } catch (error: any) {
    console.error(`Error sending reminder for appointment ${appointment.id}:`, error);
    return { success: false, appointmentId: appointment.id, error: error.message };
  }
}

/**
 * Send 24-hour reminders
 *
 * Should be run daily at 9 AM
 */
export async function send24HourReminders() {
  console.log('Starting 24-hour reminder job...');

  const appointments = await getAppointmentsNeedingReminders(24);

  console.log(`Found ${appointments.length} appointments needing 24h reminders`);

  const results = await Promise.all(
    appointments.map((appointment) => sendReminder(appointment))
  );

  const successCount = results.filter((r) => r.success).length;
  const failureCount = results.filter((r) => !r.success).length;

  console.log(`24-hour reminders completed: ${successCount} sent, ${failureCount} failed`);

  return {
    total: appointments.length,
    sent: successCount,
    failed: failureCount,
    results,
  };
}

/**
 * Send 2-hour reminders
 *
 * Should be run every hour
 */
export async function send2HourReminders() {
  console.log('Starting 2-hour reminder job...');

  const appointments = await getAppointmentsNeedingReminders(2);

  console.log(`Found ${appointments.length} appointments needing 2h reminders`);

  const results = await Promise.all(
    appointments.map((appointment) => sendReminder(appointment))
  );

  const successCount = results.filter((r) => r.success).length;
  const failureCount = results.filter((r) => !r.success).length;

  console.log(`2-hour reminders completed: ${successCount} sent, ${failureCount} failed`);

  return {
    total: appointments.length,
    sent: successCount,
    failed: failureCount,
    results,
  };
}

/**
 * Send daily appointment summary to shop owners
 *
 * Should be run at 8 AM daily
 */
export async function sendDailySummary() {
  console.log('Starting daily summary job...');

  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const tomorrow = new Date(today);
  tomorrow.setDate(tomorrow.getDate() + 1);

  // Get all shops
  const shops = await prisma.shop.findMany({
    where: {
      whatsappNumber: { not: null },
    },
  });

  const results = [];

  for (const shop of shops) {
    try {
      // Get today's appointments
      const appointments = await prisma.appointment.findMany({
        where: {
          shopId: shop.id,
          startTime: {
            gte: today,
            lt: tomorrow,
          },
          status: { in: ['SCHEDULED', 'CONFIRMED'] },
        },
        include: {
          client: true,
          service: true,
        },
        orderBy: { startTime: 'asc' },
      });

      if (appointments.length === 0) {
        continue;
      }

      // Build summary message
      const summary = `📅 Resumen del Día - ${shop.name}

Tienes ${appointments.length} cita${appointments.length > 1 ? 's' : ''} agendada${appointments.length > 1 ? 's' : ''} para hoy:

${appointments.map((apt, i) => {
        const time = new Date(apt.startTime).toLocaleTimeString('es-DO', {
          hour: '2-digit',
          minute: '2-digit',
        });
        return `${i + 1}. ${time} - ${apt.client?.name || 'Cliente'} (${apt.service?.name || 'Servicio'})`;
      }).join('\n')}

¡Buen día!`;

      // Send summary to shop
      const { sendWhatsAppMessage } = await import('@/lib/whatsapp/sender');
      const result = await sendWhatsAppMessage({
        to: shop.whatsappNumber!,
        message: summary,
        shopId: shop.id,
      });

      results.push({
        shopId: shop.id,
        success: result.success,
        appointmentsCount: appointments.length,
      });

      console.log(`Daily summary sent to shop ${shop.id}`);
    } catch (error: any) {
      console.error(`Error sending daily summary to shop ${shop.id}:`, error);
      results.push({
        shopId: shop.id,
        success: false,
        error: error.message,
      });
    }
  }

  return results;
}
