/**
 * Builds the "living memory" the agent sees in every turn.
 *
 * One query batch loads everything the LLM needs to answer like a barber
 * who knows their shop and their clients: services, hours, team, the calling
 * client's profile + history, FAQs, loyalty status, upcoming appointments,
 * recent chat history.
 *
 * Designed to be FAST — all queries run in parallel.
 */

import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import { db } from '@/lib/database';
import { formatDateTime12h } from '@/lib/whatsapp/time-format';

export interface BuiltContext {
  // Shop
  shopName: string;
  shopAddress: string | null;
  shopTimezone: string;
  personality: string;
  jerga: string;
  modelId: string | null;

  // Date/time (server-side truth)
  nowIso: string;
  nowLabel: string;     // "lunes 11 de mayo de 2026, 15:54 hora dominicana"
  todayDate: string;    // "yyyy-MM-dd"

  // Services & operations
  services: Array<{ id: string; name: string; price: number; duration: number; type: string }>;
  hours: Array<{ dayOfWeek: number; startTime: string; endTime: string }>;
  todayHours: { startTime: string; endTime: string } | null;
  stylists: Array<{ id: string; name: string }>;

  // Client
  clientId: string | null;
  clientName: string;          // best-known display name
  isReturning: boolean;
  visitCount: number;
  lastService: string | null;
  lastVisitDate: string | null;
  preferences: string | null;
  notes: string | null;
  loyaltyVisits: number;       // visits accumulated towards reward
  loyaltyTarget: number | null; // threshold for reward (if config exists)

  // Upcoming appointments
  upcomingAppointments: Array<{
    id: string;
    dateTime: string;
    dateLabel: string;
    service: string;
    stylist: string;
  }>;

  /**
   * If the shop sent the client a reminder template in the last 90 minutes,
   * this flag tells the LLM that short replies like "sí", "ok", "gracias" are
   * acknowledgments of that reminder — NOT a new booking intent.
   */
  recentlySentReminder: {
    appointmentId: string;
    cycle: '24h' | '6h' | '2h' | '1h';
    sentAt: string;
    appointmentDateLabel: string;
  } | null;

  // FAQ
  faqs: Array<{ question: string; answer: string }>;

  // Conversation history (last ~8 turns alternating user/assistant)
  history: Array<{ role: 'user' | 'assistant'; content: string }>;
}

const DAY_LABELS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado'];

export async function buildAgentContext(input: {
  shopId: string;
  phoneNumber: string;
  fallbackClientName?: string;
}): Promise<BuiltContext> {
  const { shopId, phoneNumber, fallbackClientName } = input;

  const [shop, services, hours, stylists, client, upcoming, faqs, historyRaw, loyaltyConfig] =
    await Promise.all([
      db.shop.findUnique({
        where: { id: shopId },
        select: {
          name: true,
          address: true,
          timezone: true,
          chatbotPersonality: true,
          chatbotJerga: true,
          chatbotModelId: true,
        },
      }),
      db.service.findMany({
        where: { shopId, isActive: true },
        orderBy: { price: 'asc' },
        select: { id: true, name: true, price: true, duration: true, serviceType: true },
      }),
      db.shopAvailability.findMany({
        where: { shopId },
        orderBy: { dayOfWeek: 'asc' },
      }),
      db.stylist.findMany({
        where: { shopId },
        select: { id: true, name: true },
      }),
      db.client.findFirst({
        where: { phoneNumber, shopId },
        select: {
          id: true,
          name: true,
          preferences: true,
          notes: true,
        },
      }),
      db.appointment.findMany({
        where: {
          shopId,
          clientWhatsApp: phoneNumber,
          startTime: { gte: new Date() },
          status: { in: ['SCHEDULED', 'CONFIRMED'] },
        },
        orderBy: { startTime: 'asc' },
        take: 5,
        include: { service: true, stylist: true },
      }),
      db.fAQ.findMany({
        where: { shopId },
        take: 20,
        select: { question: true, answer: true },
      }),
      db.chatHistory.findMany({
        where: { shopId, phoneNumber },
        orderBy: { createdAt: 'desc' },
        // 12 turns: enough room for a full booking flow (picker → reply → slots → reply → confirm → reply)
        // plus a couple of prior exchanges. Beyond this the model loses focus on relevance.
        take: 12,
      }),
      // Loyalty config — wrapped in try so a missing model doesn't blow up
      (async () => {
        try {
          return await db.loyaltyConfig?.findFirst?.({ where: { shopId } });
        } catch {
          return null;
        }
      })(),
    ]);

  // Visit history for the client (count + last service)
  let visitCount = 0;
  let lastService: string | null = null;
  let lastVisitDate: string | null = null;
  let loyaltyVisits = 0;
  if (client?.id) {
    const completed = await db.appointment.findMany({
      where: {
        shopId,
        clientWhatsApp: phoneNumber,
        status: { in: ['COMPLETED', 'CONFIRMED'] },
        startTime: { lt: new Date() },
      },
      orderBy: { startTime: 'desc' },
      take: 30,
      include: { service: true },
    });
    visitCount = completed.length;
    loyaltyVisits = completed.length;
    if (completed[0]) {
      lastService = completed[0].service?.name ?? null;
      lastVisitDate = format(completed[0].startTime, "d 'de' MMMM yyyy", { locale: es });
    }
  }

  const timezone = shop?.timezone || 'America/Santo_Domingo';
  const now = new Date();

  // Date label in shop timezone — try Intl, fall back to default formatting
  let nowLabel: string;
  let todayDate: string;
  try {
    const fmt = new Intl.DateTimeFormat('es-DO', {
      timeZone: timezone,
      weekday: 'long',
      day: 'numeric',
      month: 'long',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
    nowLabel = fmt.format(now);
    const dateFmt = new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    });
    todayDate = dateFmt.format(now); // yyyy-MM-dd
  } catch {
    nowLabel = format(now, "EEEE d 'de' MMMM yyyy, HH:mm", { locale: es });
    todayDate = format(now, 'yyyy-MM-dd');
  }

  const todayDow = new Date(`${todayDate}T12:00:00`).getDay();
  const todayHoursRecord = hours.find(h => h.dayOfWeek === todayDow);

  // Look for a reminder template sent in the last 90 minutes — if found, the
  // client's short reply is almost certainly an acknowledgment, not new intent.
  const ninetyMinAgo = new Date(Date.now() - 90 * 60 * 1000);
  const recentReminderAppt = await db.appointment.findFirst({
    where: {
      shopId,
      clientWhatsApp: phoneNumber,
      OR: [
        { reminder24hSentAt: { gte: ninetyMinAgo } },
        { reminder6hSentAt: { gte: ninetyMinAgo } },
        { reminder2hSentAt: { gte: ninetyMinAgo } },
        { reminder1hSentAt: { gte: ninetyMinAgo } },
      ],
    },
    orderBy: { startTime: 'asc' },
    select: {
      id: true,
      startTime: true,
      reminder24hSentAt: true,
      reminder6hSentAt: true,
      reminder2hSentAt: true,
      reminder1hSentAt: true,
    },
  });
  let recentlySentReminder: BuiltContext['recentlySentReminder'] = null;
  if (recentReminderAppt) {
    // Find the most recent reminder field
    const candidates: Array<{ cycle: '24h' | '6h' | '2h' | '1h'; at: Date | null }> = [
      { cycle: '1h', at: recentReminderAppt.reminder1hSentAt },
      { cycle: '2h', at: recentReminderAppt.reminder2hSentAt },
      { cycle: '6h', at: recentReminderAppt.reminder6hSentAt },
      { cycle: '24h', at: recentReminderAppt.reminder24hSentAt },
    ];
    const mostRecent = candidates
      .filter(c => c.at && c.at >= ninetyMinAgo)
      .sort((a, b) => (b.at!.getTime() - a.at!.getTime()))[0];
    if (mostRecent && mostRecent.at) {
      recentlySentReminder = {
        appointmentId: recentReminderAppt.id,
        cycle: mostRecent.cycle,
        sentAt: mostRecent.at.toISOString(),
        appointmentDateLabel: formatDateTime12h(recentReminderAppt.startTime, timezone),
      };
    }
  }

  // Reverse history into chronological order
  historyRaw.reverse();
  const history = historyRaw.map(h => ({
    role: (h.role === 'user' ? 'user' : 'assistant') as 'user' | 'assistant',
    content: h.content,
  }));

  return {
    shopName: shop?.name ?? 'el negocio',
    shopAddress: shop?.address ?? null,
    shopTimezone: timezone,
    personality: shop?.chatbotPersonality ?? '',
    jerga: shop?.chatbotJerga ?? '',
    modelId: shop?.chatbotModelId ?? null,
    nowIso: now.toISOString(),
    nowLabel,
    todayDate,
    services: services.map(s => ({
      id: s.id,
      name: s.name,
      price: s.price,
      duration: s.duration,
      type: String(s.serviceType),
    })),
    hours: hours.map(h => ({ dayOfWeek: h.dayOfWeek, startTime: h.startTime, endTime: h.endTime })),
    todayHours: todayHoursRecord
      ? { startTime: todayHoursRecord.startTime, endTime: todayHoursRecord.endTime }
      : null,
    stylists: stylists.map(s => ({ id: s.id, name: s.name })),
    clientId: client?.id ?? null,
    clientName: client?.name ?? fallbackClientName ?? 'Cliente',
    isReturning: visitCount > 0,
    visitCount,
    lastService,
    lastVisitDate,
    preferences: client?.preferences ?? null,
    notes: client?.notes ?? null,
    loyaltyVisits,
    loyaltyTarget: (loyaltyConfig as any)?.visitsRequired ?? null,
    upcomingAppointments: upcoming.map(a => ({
      id: a.id,
      dateTime: a.startTime.toISOString(),
      dateLabel: formatDateTime12h(a.startTime, timezone),
      service: a.service?.name ?? '',
      stylist: a.stylist?.name ?? '',
    })),
    recentlySentReminder,
    faqs,
    history,
  };
}

export { DAY_LABELS };
