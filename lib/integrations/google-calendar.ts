/**
 * Google Calendar Integration
 *
 * Handles OAuth flow and sync logic with Google Calendar API
 */

import { google } from 'googleapis';
import { prisma } from '@/lib/db';

// OAuth2 configuration
const OAuth2 = google.auth.OAuth2;

function getOAuth2Client() {
  return new OAuth2(
    process.env.GOOGLE_CALENDAR_CLIENT_ID,
    process.env.GOOGLE_CALENDAR_CLIENT_SECRET,
    process.env.GOOGLE_CALENDAR_REDIRECT_URI || `${process.env.NEXT_PUBLIC_APP_URL}/api/calendar/callback`
  );
}

/**
 * Generate authorization URL for OAuth flow
 */
export function getAuthUrl(state: string): string {
  const oauth2Client = getOAuth2Client();

  return oauth2Client.generateAuthUrl({
    access_type: 'offline', // Required for refresh token
    scope: ['https://www.googleapis.com/auth/calendar.events'],
    state,
    prompt: 'consent', // Force consent to get refresh token
  });
}

/**
 * Exchange authorization code for tokens
 */
export async function getTokensFromCode(code: string): Promise<{
  accessToken: string;
  refreshToken: string;
}> {
  const oauth2Client = getOAuth2Client();

  const { tokens } = await oauth2Client.getToken(code);

  if (!tokens.access_token || !tokens.refresh_token) {
    throw new Error('Failed to get tokens from Google');
  }

  return {
    accessToken: tokens.access_token,
    refreshToken: tokens.refresh_token,
  };
}

/**
 * Get authenticated calendar client
 */
export async function getCalendarClient(shopId: string) {
  const shop = await prisma.shop.findUnique({
    where: { id: shopId },
    select: { googleCalendarRefreshToken: true },
  });

  if (!shop?.googleCalendarRefreshToken) {
    throw new Error('Google Calendar not connected for this shop');
  }

  const oauth2Client = getOAuth2Client();
  oauth2Client.setCredentials({
    refresh_token: shop.googleCalendarRefreshToken,
  });

  // Refresh access token if needed
  const { credentials } = await oauth2Client.refreshAccessToken();
  oauth2Client.setCredentials(credentials);

  const calendar = google.calendar({ version: 'v3', auth: oauth2Client });

  return calendar;
}

/**
 * Push appointment to Google Calendar
 */
export async function pushAppointmentToCalendar(appointmentId: string) {
  const appointment = await prisma.appointment.findUnique({
    where: { id: appointmentId },
    include: {
      service: true,
      stylist: true,
      shop: true,
    },
  });

  if (!appointment) {
    throw new Error('Appointment not found');
  }

  const shop = appointment.shop;

  if (!shop.googleCalendarSyncEnabled || !shop.googleCalendarRefreshToken) {
    return { skipped: true, reason: 'Calendar sync not enabled' };
  }

  // Check sync direction
  if (shop.googleCalendarSyncDirection === 'PULL') {
    return { skipped: true, reason: 'Sync direction is PULL only' };
  }

  const calendar = await getCalendarClient(shop.id);

  const calendarId = shop.googleCalendarId || 'primary';

  const event = {
    summary: `${appointment.service.name} - ${appointment.clientName}`,
    description: `Cita para ${appointment.service.name}
Cliente: ${appointment.clientName}
Teléfono: ${appointment.clientWhatsApp}
${appointment.notes ? `Notas: ${appointment.notes}` : ''}`,
    start: {
      dateTime: appointment.startTime.toISOString(),
      timeZone: shop.timezone,
    },
    end: {
      dateTime: appointment.endTime.toISOString(),
      timeZone: shop.timezone,
    },
    reminders: {
      useDefault: false,
      overrides: [
        { method: 'popup', minutes: 24 * 60 }, // 1 day before
        { method: 'popup', minutes: 60 }, // 1 hour before
      ],
    },
  };

  // If event already exists in Google Calendar, update it
  if (appointment.googleCalendarEventId) {
    const response = await calendar.events.update({
      calendarId,
      eventId: appointment.googleCalendarEventId,
      requestBody: event,
    });

    return {
      updated: true,
      eventId: response.data.id,
    };
  }

  // Create new event
  const response = await calendar.events.insert({
    calendarId,
    requestBody: event,
  });

  // Save Google Calendar event ID to appointment
  await prisma.appointment.update({
    where: { id: appointmentId },
    data: { googleCalendarEventId: response.data.id },
  });

  return {
    created: true,
    eventId: response.data.id,
  };
}

/**
 * Delete appointment from Google Calendar
 */
export async function deleteAppointmentFromCalendar(appointmentId: string) {
  const appointment = await prisma.appointment.findUnique({
    where: { id: appointmentId },
    include: { shop: true },
  });

  if (!appointment) {
    throw new Error('Appointment not found');
  }

  if (!appointment.googleCalendarEventId) {
    return { skipped: true, reason: 'No Google Calendar event linked' };
  }

  const shop = appointment.shop;

  if (!shop.googleCalendarSyncEnabled || !shop.googleCalendarRefreshToken) {
    return { skipped: true, reason: 'Calendar sync not enabled' };
  }

  const calendar = await getCalendarClient(shop.id);
  const calendarId = shop.googleCalendarId || 'primary';

  await calendar.events.delete({
    calendarId,
    eventId: appointment.googleCalendarEventId,
  });

  return { deleted: true };
}

/**
 * Pull events from Google Calendar and create/update appointments
 */
export async function pullEventsFromCalendar(shopId: string, startDate: Date, endDate: Date) {
  const shop = await prisma.shop.findUnique({
    where: { id: shopId },
    include: { services: true, stylists: true },
  });

  if (!shop) {
    throw new Error('Shop not found');
  }

  if (!shop.googleCalendarSyncEnabled || !shop.googleCalendarRefreshToken) {
    return { skipped: true, reason: 'Calendar sync not enabled' };
  }

  // Check sync direction
  if (shop.googleCalendarSyncDirection === 'PUSH') {
    return { skipped: true, reason: 'Sync direction is PUSH only' };
  }

  const calendar = await getCalendarClient(shopId);
  const calendarId = shop.googleCalendarId || 'primary';

  const response = await calendar.events.list({
    calendarId,
    timeMin: startDate.toISOString(),
    timeMax: endDate.toISOString(),
    singleEvents: true,
    orderBy: 'startTime',
  });

  const events = response.data.items || [];
  let created = 0;
  let updated = 0;

  for (const event of events) {
    if (!event.id || !event.start?.dateTime || !event.end?.dateTime) {
      continue;
    }

    // Check if event already exists
    const existingAppointment = await prisma.appointment.findFirst({
      where: { googleCalendarEventId: event.id },
    });

    const startTime = new Date(event.start.dateTime);
    const endTime = new Date(event.end.dateTime);

    // Try to extract info from event description
    const summary = event.summary || '';
    const description = event.description || '';

    // Simple parsing - in production, you'd use AI or regex
    const clientName = extractClientName(summary, description);
    const clientWhatsApp = extractPhoneNumber(description);

    // Default service and stylist
    const defaultService = shop.services[0];
    const defaultStylist = shop.stylists[0];

    if (!defaultService || !defaultStylist) {
      continue;
    }

    if (existingAppointment) {
      // Update existing appointment
      await prisma.appointment.update({
        where: { id: existingAppointment.id },
        data: {
          startTime,
          endTime,
          clientName: clientName || existingAppointment.clientName,
          clientWhatsApp: clientWhatsApp || existingAppointment.clientWhatsApp,
        },
      });
      updated++;
    } else {
      // Create new appointment
      await prisma.appointment.create({
        data: {
          startTime,
          endTime,
          clientName: clientName || 'Cliente de Google Calendar',
          clientWhatsApp: clientWhatsApp || 'N/A',
          serviceId: defaultService.id,
          stylistId: defaultStylist.id,
          shopId,
          googleCalendarEventId: event.id,
          status: 'SCHEDULED',
        },
      });
      created++;
    }
  }

  return {
    processed: events.length,
    created,
    updated,
  };
}

/**
 * Get list of user's calendars
 */
export async function getCalendarList(shopId: string) {
  const calendar = await getCalendarClient(shopId);

  const response = await calendar.calendarList.list();

  return response.data.items || [];
}

// Helper functions
function extractClientName(summary: string, description: string): string | null {
  // Try to extract from summary (format: "Service - Client Name")
  const match = summary.match(/-\s*(.+)$/);
  if (match && match[1]) {
    return match[1].trim();
  }

  // Try to extract from description
  const clientMatch = description.match(/Cliente:\s*(.+)/);
  if (clientMatch && clientMatch[1]) {
    return clientMatch[1].trim();
  }

  return null;
}

function extractPhoneNumber(text: string): string | null {
  // Extract phone number from text
  const phoneMatch = text.match(/Teléfono:\s*(.+)/);
  if (phoneMatch && phoneMatch[1]) {
    return phoneMatch[1].trim();
  }

  // Try to find any phone number pattern
  const phoneRegex = /(\+?1?[-.\s]?\(?\d{3}\)?[-.\s]?\d{3}[-.\s]?\d{4})/;
  const match = text.match(phoneRegex);
  return match ? match[1] : null;
}

/**
 * Sync all appointments to Google Calendar
 */
export async function syncAllAppointments(shopId: string) {
  const appointments = await prisma.appointment.findMany({
    where: {
      shopId,
      status: { in: ['SCHEDULED', 'CONFIRMED'] },
      startTime: { gte: new Date() },
    },
    include: {
      shop: true,
    },
  });

  const results = {
    success: 0,
    failed: 0,
    skipped: 0,
  };

  for (const appointment of appointments) {
    try {
      await pushAppointmentToCalendar(appointment.id);
      results.success++;
    } catch (error) {
      console.error(`Failed to sync appointment ${appointment.id}:`, error);
      results.failed++;
    }
  }

  return results;
}
