import { db } from '@/lib/database';
import { sendTemplateByPurpose } from './sender';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

// ---------------------------------------------------------------------------
// Internal helpers
// ---------------------------------------------------------------------------

async function getOwnerPhone(shopId: string): Promise<string | null> {
    const shop = await db.shop.findUnique({
        where: { id: shopId },
        select: { ownerNotificationPhone: true },
    });
    return shop?.ownerNotificationPhone ?? null;
}

async function alreadySentToday(shopId: string, type: string): Promise<boolean> {
    const midnight = new Date();
    midnight.setHours(0, 0, 0, 0);
    const count = await db.ownerNotificationLog.count({
        where: { shopId, type, sentAt: { gte: midnight } },
    });
    return count > 0;
}

async function alreadySentLastHour(shopId: string, type: string, refId?: string): Promise<boolean> {
    const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000);
    const count = await db.ownerNotificationLog.count({
        where: { shopId, type, refId: refId ?? null, sentAt: { gte: oneHourAgo } },
    });
    return count > 0;
}

async function logSent(shopId: string, type: string, refId?: string): Promise<void> {
    await db.ownerNotificationLog.create({
        data: { shopId, type, refId: refId ?? null },
    });
}

// ---------------------------------------------------------------------------
// Exported notification functions
// ---------------------------------------------------------------------------

export async function notifyOwnerNewBooking(params: {
    shopId: string;
    appointmentId: string;
    clientName: string;
    serviceName: string;
    date: Date;
    professionalName: string;
}): Promise<void> {
    const { shopId, appointmentId, clientName, serviceName, date, professionalName } = params;

    const phone = await getOwnerPhone(shopId);
    if (!phone) return;

    if (await alreadySentLastHour(shopId, 'new_booking', appointmentId)) return;

    const fechaStr = format(date, "EEEE d 'de' MMMM", { locale: es });
    const horaStr = format(date, 'h:mm a');

    await sendTemplateByPurpose({
        shopId,
        to: phone,
        purpose: 'owner_new_booking',
        variables: {
            '1': clientName,
            '2': serviceName,
            '3': fechaStr,
            '4': horaStr,
            '5': professionalName,
        },
        fallbackText: `Nueva reserva: ${clientName} — ${serviceName} el ${fechaStr} a las ${horaStr} con ${professionalName}.`,
    });

    await logSent(shopId, 'new_booking', appointmentId);
}

export async function notifyOwnerCancellation(params: {
    shopId: string;
    appointmentId: string;
    clientName: string;
    serviceName: string;
    date: Date;
}): Promise<void> {
    const { shopId, appointmentId, clientName, serviceName, date } = params;

    const phone = await getOwnerPhone(shopId);
    if (!phone) return;

    if (await alreadySentLastHour(shopId, 'cancellation', appointmentId)) return;

    const fechaHoraStr = format(date, "d MMM 'a las' h:mm a", { locale: es });

    await sendTemplateByPurpose({
        shopId,
        to: phone,
        purpose: 'owner_cancellation',
        variables: {
            '1': clientName,
            '2': fechaHoraStr,
            '3': serviceName,
        },
        fallbackText: `Cancelacion: ${clientName} cancelo su cita de ${fechaHoraStr} para ${serviceName}.`,
    });

    await logSent(shopId, 'cancellation', appointmentId);
}

export async function notifyOwnerSentimentEscalation(params: {
    shopId: string;
    clientPhone: string;
}): Promise<void> {
    const { shopId, clientPhone } = params;

    const phone = await getOwnerPhone(shopId);
    if (!phone) return;

    if (await alreadySentLastHour(shopId, 'sentiment_escalation', clientPhone)) return;

    await sendTemplateByPurpose({
        shopId,
        to: phone,
        purpose: 'owner_sentiment_alert',
        variables: { '1': clientPhone },
        fallbackText: `Alerta: un cliente (${clientPhone}) esta molesto en WhatsApp. Revisa la conversacion en tu app.`,
    });

    await logSent(shopId, 'sentiment_escalation', clientPhone);
}

export async function sendOwnerMorningDigest(params: {
    shopId: string;
    totalAppointments: number;
    firstAppointment: string;
    lastAppointment: string;
}): Promise<void> {
    const { shopId, totalAppointments, firstAppointment, lastAppointment } = params;

    const phone = await getOwnerPhone(shopId);
    if (!phone) return;

    if (await alreadySentToday(shopId, 'morning_digest')) return;

    await sendTemplateByPurpose({
        shopId,
        to: phone,
        purpose: 'owner_morning_digest',
        variables: {
            '1': String(totalAppointments),
            '2': firstAppointment,
            '3': lastAppointment,
        },
        fallbackText: `Buenos dias! Hoy tienes ${totalAppointments} citas. Primera: ${firstAppointment}. Ultima: ${lastAppointment}.`,
    });

    await logSent(shopId, 'morning_digest');
}

export async function sendOwnerEveningDigest(params: {
    shopId: string;
    completed: number;
    total: number;
    noShows: number;
    newClients: number;
    revenue: string;
}): Promise<void> {
    const { shopId, completed, total, noShows, newClients, revenue } = params;

    const phone = await getOwnerPhone(shopId);
    if (!phone) return;

    if (await alreadySentToday(shopId, 'evening_digest')) return;

    await sendTemplateByPurpose({
        shopId,
        to: phone,
        purpose: 'owner_evening_digest',
        variables: {
            '1': String(completed),
            '2': String(total),
            '3': String(noShows),
            '4': String(newClients),
            '5': revenue,
        },
        fallbackText: `Cierre del dia: ${completed}/${total} citas completadas, ${noShows} no-shows, ${newClients} clientes nuevos, ingresos: ${revenue}.`,
    });

    await logSent(shopId, 'evening_digest');
}
