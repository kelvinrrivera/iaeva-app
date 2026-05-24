/**
 * Cron: Notificación automática a walk-ins 15 min antes de su turno
 *
 * GET /api/cron/walkin-notify
 * Ejecutar cada 5 minutos (Vercel Cron o similar)
 *
 * Lógica:
 * - Busca walk-ins WAITING con estimatedEnd entre ahora+10min y ahora+20min
 * - Que no hayan sido notificados aún (notifiedAt == null)
 * - Que tengan whatsappNumber
 * - Envía: "Juan, en ~15 minutos es tu turno. ¡Ya puedes venir!"
 * - Marca notifiedAt = now para no re-enviar
 */

import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { prisma } from '@/lib/db';
import { sendWhatsAppMessage } from '@/lib/whatsapp/sender';
import { addMinutes } from 'date-fns';

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

export async function GET(request: NextRequest) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const now = new Date();
  // Ventana: walk-ins cuyo turno estimado es entre 10 y 20 min desde ahora
  const windowStart = addMinutes(now, 10);
  const windowEnd = addMinutes(now, 20);

  const walkIns = await prisma.walkIn.findMany({
    where: {
      status: 'WAITING',
      notifiedAt: null,
      whatsappNumber: { not: null },
      estimatedEnd: { gte: windowStart, lte: windowEnd },
    },
    include: {
      shop: { select: { name: true, whatsappEnabled: true, whatsappPhoneNumber: true } },
    },
  });

  let sent = 0;
  let errors = 0;

  for (const w of walkIns) {
    if (!w.shop.whatsappEnabled || !w.shop.whatsappPhoneNumber) continue;
    if (!w.whatsappNumber) continue;

    const minutesLeft = Math.round(
      (new Date(w.estimatedEnd!).getTime() - now.getTime()) / 60000
    );

    const message =
      `👋 *${w.clientName}*, en aproximadamente *${minutesLeft} minutos* es tu turno en *${w.shop.name}*.\n\n` +
      `¡Ya puedes venir o estar listo! Te esperamos 💈`;

    try {
      await sendWhatsAppMessage({ to: w.whatsappNumber, message, shopId: w.shopId });
      await prisma.walkIn.update({
        where: { id: w.id },
        data: { notifiedAt: now },
      });
      sent++;
    } catch (err: any) {
      console.error(`[walkin-notify] Error para walk-in ${w.id}:`, err.message);
      errors++;
    }
  }

  return NextResponse.json({
    success: true,
    timestamp: now.toISOString(),
    sent,
    errors,
  });
}

export async function POST(request: NextRequest) {
  return GET(request);
}
