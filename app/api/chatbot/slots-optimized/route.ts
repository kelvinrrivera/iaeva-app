import { NextResponse } from "next/server";
import { withAuth, type AuthenticatedUser } from "@/lib/auth-middleware";
import { db } from "@/lib/database";
import { timingSafeEqual } from "crypto";
import {
    addMinutes,
    format,
    startOfDay,
    endOfDay,
    isBefore,
    isAfter,
    areIntervalsOverlapping,
    setHours,
    setMinutes,
    differenceInMinutes,
    parse
} from "date-fns";
import { prisma } from "@/lib/db";

interface OptimizedSlot {
    time: string;
    stylistId: string;
    stylistName: string;
    score: number; // 0-100, higher is better
    reasons: string[];
    hotScore: number; // 0-100, demand level
    gapFilling: boolean; // true if fills a gap
    gapBefore?: number; // minutes of gap before
    gapAfter?: number; // minutes of gap after
}

interface DayAnalytics {
    date: string;
    occupancy: number; // 0-100%
    hotSlots: string[]; // times with high demand
    coldSlots: string[]; // times with low demand
    totalGaps: number; // total minutes of empty time
    gaps: Array<{ start: string; end: string; duration: number }>;
}

/**
 * GET /api/chatbot/slots-optimized
 * Obtiene huecos disponibles con análisis de optimización
 * Query params:
 * - date: YYYY-MM-DD
 * - serviceId: ID del servicio
 * - stylistId: (opcional) ID del barbero
 * - preferredTime: (opcional) HH:mm preferencia del cliente
 */
export async function GET(request: Request) {
    return withAuth(async (authUser: AuthenticatedUser) => {
        try {
            const { searchParams } = new URL(request.url);
            const dateStr = searchParams.get("date");
            const serviceId = searchParams.get("serviceId");
            const stylistId = searchParams.get("stylistId");
            const preferredTime = searchParams.get("preferredTime");

            if (!dateStr || !serviceId) {
                return NextResponse.json(
                    { error: "Missing required params: date, serviceId" },
                    { status: 400 }
                );
            }

            // Internal server-to-server calls use INTERNAL_API_KEY (separate from CRON_SECRET)
            let shopId = authUser.shopId;
            if (!shopId) {
                const internalApiKey = process.env.INTERNAL_API_KEY;
                const internalKey = request.headers.get('x-internal-key');
                const internalShopId = request.headers.get('x-shop-id');
                if (
                    internalApiKey &&
                    internalKey &&
                    internalShopId &&
                    internalApiKey.length === internalKey.length &&
                    timingSafeEqual(Buffer.from(internalApiKey), Buffer.from(internalKey))
                ) {
                    shopId = internalShopId;
                } else {
                    return NextResponse.json(
                        { error: "Shop not found" },
                        { status: 404 }
                    );
                }
            }

            const date = new Date(dateStr);
            const dayOfWeek = date.getDay();

            // 1. Obtener detalles del servicio
            const service = await db.service.findUnique({
                where: { id: serviceId }
            });

            if (!service || service.shopId !== shopId) {
                return NextResponse.json(
                    { error: "Service not found" },
                    { status: 404 }
                );
            }

            const totalDuration = service.duration + service.bufferTime;

            // 2. Obtener barberos disponibles
            const stylists = await db.stylist.findMany({
                where: {
                    shopId,
                    ...(stylistId ? { id: stylistId } : {})
                },
                select: { id: true, name: true, shopId: true }
            });

            if (stylists.length === 0) {
                return NextResponse.json(
                    { error: "No stylists available" },
                    { status: 404 }
                );
            }

            // 3. Obtener disponibilidad del shop
            const shopAvailability = await db.shopAvailability.findFirst({
                where: { shopId, dayOfWeek }
            });

            if (!shopAvailability) {
                return NextResponse.json({
                    slots: [],
                    analytics: null,
                    message: "Shop closed on this day"
                });
            }

            // 4. Analizar cada barbero
            const allSlots: OptimizedSlot[] = [];
            let totalOccupancyMinutes = 0;
            let totalAvailableMinutes = 0;

            for (const stylist of stylists) {
                // 4.1 Disponibilidad del barbero
                const availability = await db.availability.findFirst({
                    where: { stylistId: stylist.id, dayOfWeek }
                });

                if (!availability) continue; // Barbero no trabaja este día

                // 4.2 Citas existentes
                const appointments = await db.appointment.findMany({
                    where: {
                        stylistId: stylist.id,
                        startTime: { gte: startOfDay(date), lte: endOfDay(date) },
                        status: { not: "CANCELLED" }
                    },
                    include: { service: true }
                });

                // 4.3 Bloques de tiempo (descansos, vacaciones)
                const blocks = await db.timeBlock.findMany({
                    where: {
                        stylistId: stylist.id,
                        startTime: { gte: startOfDay(date), lte: endOfDay(date) }
                    }
                });

                // 4.3b Walk-ins activos (WAITING + IN_PROGRESS) — ocupan tiempo real del barbero
                // Se convierten en bloques virtuales para que el motor no ofrezca esos slots
                const activeWalkIns = await prisma.walkIn.findMany({
                    where: {
                        shopId,
                        arrivedAt: { gte: startOfDay(date), lte: endOfDay(date) },
                        status: { in: ['WAITING', 'IN_PROGRESS'] },
                        ...(stylist.id ? { stylistId: stylist.id } : {}),
                    },
                });

                // Construir bloques virtuales a partir de estimatedEnd de walk-ins
                const walkInBlocks = activeWalkIns
                    .filter(w => w.estimatedEnd)
                    .map(w => ({
                        startTime: w.arrivedAt,
                        endTime: w.estimatedEnd as Date,
                    }));

                const allBlocks = [...blocks, ...walkInBlocks];

                // 4.4 Calcular rango efectivo
                const [shopStartH, shopStartM] = shopAvailability.startTime.split(":").map(Number);
                const [shopEndH, shopEndM] = shopAvailability.endTime.split(":").map(Number);
                const [stylistStartH, stylistStartM] = availability.startTime.split(":").map(Number);
                const [stylistEndH, stylistEndM] = availability.endTime.split(":").map(Number);

                const effectiveStart = setMinutes(
                    setHours(startOfDay(date), Math.max(shopStartH, stylistStartH)),
                    Math.max(shopStartM, stylistStartM)
                );
                const effectiveEnd = setMinutes(
                    setHours(startOfDay(date), Math.min(shopEndH, stylistEndH)),
                    Math.min(shopEndM, stylistEndM)
                );

                const workDayMinutes = differenceInMinutes(effectiveEnd, effectiveStart);
                totalAvailableMinutes += workDayMinutes;

                // 4.5 Calcular ocupación actual
                const bookedMinutes = appointments.reduce((sum, apt) => {
                    const aptService = apt.service || service;
                    return sum + aptService.duration + aptService.bufferTime;
                }, 0);
                totalOccupancyMinutes += bookedMinutes;

                // 4.6 Encontrar huecos disponibles y puntuarlos
                const slots = await findOptimizedSlots({
                    date,
                    effectiveStart,
                    effectiveEnd,
                    appointments,
                    blocks: allBlocks,
                    serviceDuration: totalDuration,
                    stylist,
                    preferredTime,
                    allAppointments: appointments // Para detectar patrones
                });

                allSlots.push(...slots);
            }

            // 5. Analizar huecos (gaps) del día
            const analytics = generateDayAnalytics({
                date,
                shopAvailability,
                appointments: await db.appointment.findMany({
                    where: {
                        shopId,
                        startTime: { gte: startOfDay(date), lte: endOfDay(date) },
                        status: { not: "CANCELLED" }
                    }
                }),
                totalAvailableMinutes,
                totalOccupancyMinutes
            });

            // 6. Ordenar por score (mejor primero)
            allSlots.sort((a, b) => b.score - a.score);

            // 7. Retornar top 20 slots
            return NextResponse.json({
                slots: allSlots.slice(0, 20),
                analytics,
                totalSlots: allSlots.length
            });

        } catch (error) {
            console.error("[Slots Optimized] Error:", error);
            return NextResponse.json(
                { error: "Failed to fetch optimized slots" },
                { status: 500 }
            );
        }
    }, request as any);
}

/**
 * Encuentra huecos disponibles y los puntúa según optimización
 */
async function findOptimizedSlots(params: {
    date: Date;
    effectiveStart: Date;
    effectiveEnd: Date;
    appointments: any[];
    blocks: any[];
    serviceDuration: number;
    stylist: any;
    preferredTime: string | null;
    allAppointments: any[];
}): Promise<OptimizedSlot[]> {
    const {
        date,
        effectiveStart,
        effectiveEnd,
        appointments,
        blocks,
        serviceDuration,
        stylist,
        preferredTime,
        allAppointments
    } = params;

    const slots: OptimizedSlot[] = [];
    let currentSlot = new Date(effectiveStart);

    while (isBefore(currentSlot, effectiveEnd)) {
        const slotEnd = addMinutes(currentSlot, serviceDuration);

        if (isAfter(slotEnd, effectiveEnd)) break;

        // Verificar disponibilidad
        const hasOverlap = appointments.some(apt =>
            areIntervalsOverlapping(
                { start: currentSlot, end: slotEnd },
                { start: new Date(apt.startTime), end: new Date(apt.endTime) }
            )
        );

        const hasBlockOverlap = blocks.some(block =>
            areIntervalsOverlapping(
                { start: currentSlot, end: slotEnd },
                { start: new Date(block.startTime), end: new Date(block.endTime) }
            )
        );

        if (!hasOverlap && !hasBlockOverlap) {
            // Calcular score de optimización
            const analysis = analyzeSlot({
                slotStart: currentSlot,
                slotEnd,
                appointments,
                allAppointments,
                preferredTime,
                timeOfDay: currentSlot.getHours()
            });

            slots.push({
                time: format(currentSlot, "HH:mm"),
                stylistId: stylist.id,
                stylistName: stylist.user.name,
                score: analysis.score,
                reasons: analysis.reasons,
                hotScore: analysis.hotScore,
                gapFilling: analysis.gapFilling,
                gapBefore: analysis.gapBefore,
                gapAfter: analysis.gapAfter
            });
        }

        // Siguiente slot de 15 min
        currentSlot = addMinutes(currentSlot, 15);
    }

    return slots;
}

/**
 * Analiza la calidad de un slot para la optimización
 */
function analyzeSlot(params: {
    slotStart: Date;
    slotEnd: Date;
    appointments: any[];
    allAppointments: any[];
    preferredTime: string | null;
    timeOfDay: number;
}) {
    const { slotStart, slotEnd, appointments, preferredTime, timeOfDay } = params;

    let score = 50; // Base score
    const reasons: string[] = [];
    let gapFilling = false;
    let gapBefore = 0;
    let gapAfter = 0;

    // 1. Buscar hueco antes del slot
    const prevApt = appointments
        .filter(a => new Date(a.endTime) <= slotStart)
        .sort((a, b) => new Date(b.endTime).getTime() - new Date(a.endTime).getTime())[0];

    if (prevApt) {
        gapBefore = differenceInMinutes(slotStart, new Date(prevApt.endTime));
        if (gapBefore > 0 && gapBefore <= 60) {
            // Llena un hueco pequeño
            score += 30 - (gapBefore / 2);
            gapFilling = true;
            reasons.push(`Llena hueco de ${gapBefore} min`);
        }
    }

    // 2. Buscar hueco después del slot
    const nextApt = appointments
        .filter(a => new Date(a.startTime) >= slotEnd)
        .sort((a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime())[0];

    if (nextApt) {
        gapAfter = differenceInMinutes(new Date(nextApt.startTime), slotEnd);
        if (gapAfter > 0 && gapAfter <= 60) {
            score += 30 - (gapAfter / 2);
            gapFilling = true;
            reasons.push(`Evita hueco de ${gapAfter} min después`);
        }
    }

    // 3. Preferencia del cliente
    if (preferredTime) {
        const [prefH, prefM] = preferredTime.split(":").map(Number);
        const prefDate = setMinutes(setHours(slotStart, prefH), prefM);
        const diffMinutes = Math.abs(differenceInMinutes(slotStart, prefDate));

        if (diffMinutes <= 15) {
            score += 40;
            reasons.push("Coincide con tu preferencia");
        } else if (diffMinutes <= 30) {
            score += 20;
            reasons.push("Cerca de tu preferencia");
        } else if (diffMinutes > 120) {
            score -= 10;
            reasons.push("Lejos de tu preferencia");
        }
    }

    // 4. Hora del día (hot score)
    let hotScore = 50;

    // Horas pico (9-11 AM, 2-5 PM)
    if ((timeOfDay >= 9 && timeOfDay < 11) || (timeOfDay >= 14 && timeOfDay < 17)) {
        hotScore = 80;
        score += 10;
        reasons.push("Hora popular");
    }
    // Horas menos populares (11 AM - 1 PM, después de 6 PM)
    else if ((timeOfDay >= 11 && timeOfDay < 14) || timeOfDay >= 18) {
        hotScore = 40;
        score += 15; // Bonus por llenar horas frías
        reasons.push("Hora con buena disponibilidad");
    }

    // 5. Agrupamiento con citas cercanas
    if (prevApt && gapBefore <= 15) {
        score += 10;
        reasons.push("Seguido de otra cita");
    }
    if (nextApt && gapAfter <= 15) {
        score += 10;
        reasons.push("Antes de otra cita");
    }

    // 6. Bonus por primera cita del día
    if (!prevApt && timeOfDay <= 10) {
        score += 5;
        reasons.push("Primera cita del día");
    }

    return {
        score: Math.min(100, Math.max(0, score)),
        reasons,
        hotScore,
        gapFilling,
        gapBefore,
        gapAfter
    };
}

/**
 * Genera analytics del día
 */
function generateDayAnalytics(params: {
    date: Date;
    shopAvailability: any;
    appointments: any[];
    totalAvailableMinutes: number;
    totalOccupancyMinutes: number;
}): DayAnalytics {
    const { date, shopAvailability, appointments, totalAvailableMinutes, totalOccupancyMinutes } = params;

    const occupancy = totalAvailableMinutes > 0
        ? (totalOccupancyMinutes / totalAvailableMinutes) * 100
        : 0;

    // Detectar huecos (gaps) significativos
    const gaps: Array<{ start: string; end: string; duration: number }> = [];

    // Agrupar citas por barbero
    const appointmentsByStylist = appointments.reduce((acc, apt) => {
        if (!acc[apt.stylistId]) acc[apt.stylistId] = [];
        acc[apt.stylistId].push(apt);
        return acc;
    }, {} as Record<string, any[]>);

    // Encontrar gaps por barbero
    Object.entries(appointmentsByStylist).forEach(([stylistId, stylistAppointments]) => {
        const sorted = (stylistAppointments as any[]).sort((a, b) =>
            new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
        );

        for (let i = 0; i < sorted.length - 1; i++) {
            const currentEnd = new Date(sorted[i].endTime);
            const nextStart = new Date(sorted[i + 1].startTime);
            const gap = differenceInMinutes(nextStart, currentEnd);

            if (gap >= 30) {
                gaps.push({
                    start: format(currentEnd, "HH:mm"),
                    end: format(nextStart, "HH:mm"),
                    duration: gap
                });
            }
        }
    });

    // Calcular slots calientes y fríos
    const hourlyCount: Record<number, number> = {};
    appointments.forEach(apt => {
        const hour = new Date(apt.startTime).getHours();
        hourlyCount[hour] = (hourlyCount[hour] || 0) + 1;
    });

    const avgCount = Object.keys(hourlyCount).length > 0
        ? Object.values(hourlyCount).reduce((a, b) => a + b, 0) / Object.keys(hourlyCount).length
        : 0;

    const hotSlots = Object.entries(hourlyCount)
        .filter(([_, count]) => count > avgCount * 1.3)
        .map(([hour, _]) => `${hour.padStart(2, '0')}:00`);

    const coldSlots = Object.entries(hourlyCount)
        .filter(([_, count]) => count < avgCount * 0.7)
        .map(([hour, _]) => `${hour.padStart(2, '0')}:00`);

    return {
        date: format(date, "yyyy-MM-dd"),
        occupancy: Math.round(occupancy),
        hotSlots,
        coldSlots,
        totalGaps: gaps.reduce((sum, g) => sum + g.duration, 0),
        gaps: gaps.slice(0, 5) // Top 5 gaps más grandes
    };
}
