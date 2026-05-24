/**
 * Walk-in Queue API
 *
 * GET  /api/walkins  — Lista unificada: walk-ins activos + citas agendadas de hoy
 * POST /api/walkins  — Agrega walk-in. Auto-completa el anterior (Opción B).
 *                     Calcula estimatedEnd basado en duración del servicio.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-middleware';
import { prisma } from '@/lib/db';
import { z } from 'zod';
import { startOfDay, endOfDay, addMinutes } from 'date-fns';

const createWalkInSchema = z.object({
  clientName:     z.string().min(1, 'Nombre requerido'),
  serviceId:      z.string().optional(),
  stylistId:      z.string().optional(),
  whatsappNumber: z.string().optional(),
  notes:          z.string().optional(),
});

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    if (!user.shopId) return NextResponse.json({ error: 'No shop found' }, { status: 404 });

    const now = new Date();
    const dayStart = startOfDay(now);
    const dayEnd = endOfDay(now);

    // Walk-ins activos del día
    const walkIns = await prisma.walkIn.findMany({
      where: {
        shopId: user.shopId,
        arrivedAt: { gte: dayStart, lte: dayEnd },
        status: { in: ['WAITING', 'IN_PROGRESS'] },
      },
      orderBy: { position: 'asc' },
    });

    // Citas agendadas del día (pendientes/confirmadas)
    const appointments = await prisma.appointment.findMany({
      where: {
        shopId: user.shopId,
        startTime: { gte: dayStart, lte: dayEnd },
        status: { in: ['SCHEDULED', 'CONFIRMED', 'IN_PROGRESS'] },
      },
      include: {
        service: { select: { name: true, duration: true } },
        stylist: { select: { id: true } },
      },
      orderBy: { startTime: 'asc' },
    });

    return NextResponse.json({ walkIns, appointments });
  } catch (error: any) {
    console.error('[walkins GET]', error.message);
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    if (!user.shopId) return NextResponse.json({ error: 'No shop found' }, { status: 404 });

    const body = await request.json();
    const data = createWalkInSchema.parse(body);

    const now = new Date();
    const dayStart = startOfDay(now);

    // ── Opción B: auto-completar el walk-in IN_PROGRESS anterior ──
    // Cuando el barbero agrega un cliente nuevo, el que está IN_PROGRESS
    // se asume terminado. Así el barbero solo hace UNA acción.
    await prisma.walkIn.updateMany({
      where: {
        shopId: user.shopId,
        arrivedAt: { gte: dayStart },
        status: 'IN_PROGRESS',
        ...(data.stylistId ? { stylistId: data.stylistId } : {}),
      },
      data: {
        status: 'DONE',
        servedAt: now,
      },
    });

    // ── Calcular estimatedEnd ──
    // Suma la duración de todos los WAITING activos antes de este + duración del nuevo
    const activeWaitingBefore = await prisma.walkIn.findMany({
      where: {
        shopId: user.shopId,
        arrivedAt: { gte: dayStart },
        status: 'WAITING',
        ...(data.stylistId ? { stylistId: data.stylistId } : {}),
      },
      orderBy: { position: 'asc' },
    });

    // Obtener duraciones de los servicios de los que esperan (bulk query, no N+1)
    const serviceIds = [
      ...activeWaitingBefore.map(w => w.serviceId).filter(Boolean) as string[],
      ...(data.serviceId ? [data.serviceId] : []),
    ];
    const servicesMap = serviceIds.length > 0
      ? await prisma.service.findMany({
          where: { id: { in: serviceIds } },
          select: { id: true, duration: true },
        }).then(svcs => Object.fromEntries(svcs.map(s => [s.id, s.duration])))
      : {} as Record<string, number>;

    let minutesAhead = 0;
    for (const w of activeWaitingBefore) {
      minutesAhead += w.serviceId ? (servicesMap[w.serviceId] ?? 30) : 30;
    }

    // Duración del nuevo cliente
    const newDuration = data.serviceId ? (servicesMap[data.serviceId] ?? 30) : 30;

    // estimatedEnd = ahora + tiempo de todos los anteriores + duración propia
    const estimatedEnd = addMinutes(now, minutesAhead + newDuration);

    // Siguiente posición
    const lastWalkIn = await prisma.walkIn.findFirst({
      where: {
        shopId: user.shopId,
        arrivedAt: { gte: dayStart },
        status: { in: ['WAITING', 'IN_PROGRESS'] },
      },
      orderBy: { position: 'desc' },
    });
    const nextPosition = (lastWalkIn?.position ?? 0) + 1;

    // ── El primer WAITING pasa automáticamente a IN_PROGRESS ──
    // Si no hay nadie esperando, este cliente es atendido de inmediato
    const hasActiveQueue = activeWaitingBefore.length > 0;
    const initialStatus = hasActiveQueue ? 'WAITING' : 'IN_PROGRESS';

    const walkIn = await prisma.walkIn.create({
      data: {
        shopId:         user.shopId,
        clientName:     data.clientName,
        serviceId:      data.serviceId,
        stylistId:      data.stylistId,
        whatsappNumber: data.whatsappNumber,
        notes:          data.notes,
        position:       nextPosition,
        status:         initialStatus,
        estimatedEnd,
        ...(initialStatus === 'IN_PROGRESS' && { servedAt: now }),
      },
    });

    return NextResponse.json(walkIn, { status: 201 });
  } catch (error: any) {
    console.error('[walkins POST]', error.message);
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Datos inválidos', details: error.issues }, { status: 400 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
