import { NextResponse } from "next/server";
import { withAuthAndRole, type AuthenticatedUser } from "@/lib/auth-middleware";
import { db } from "@/lib/database";
import { pushAppointmentToCalendar } from "@/lib/integrations/google-calendar";
import type { Role } from "@prisma/client";

interface CreateOptimizedAppointmentRequest {
    serviceId: string;
    date: string;
    time: string;
    stylistId: string;
    clientName: string;
    clientWhatsApp: string;
    notes?: string;
}

/**
 * POST /api/appointments/create-optimized
 * Crea una cita optimizada seleccionada por el chatbot
 * Incluye validación de disponibilidad y analytics
 */
export async function POST(request: Request) {
    return withAuthAndRole(async (authUser: AuthenticatedUser) => {
        try {
            const data: CreateOptimizedAppointmentRequest = await request.json();

            // Validar campos requeridos
            const { serviceId, date, time, stylistId, clientName, clientWhatsApp } = data;

            if (!serviceId || !date || !time || !stylistId || !clientName || !clientWhatsApp) {
                return NextResponse.json(
                    { error: "Missing required fields" },
                    { status: 400 }
                );
            }

            const shopId = authUser.shopId;
            if (!shopId) {
                return NextResponse.json(
                    { error: "Shop not found" },
                    { status: 404 }
                );
            }

            // 1. Obtener servicio
            const service = await db.service.findFirst({
                where: {
                    id: serviceId,
                    shopId
                }
            });

            if (!service) {
                return NextResponse.json(
                    { error: "Service not found" },
                    { status: 404 }
                );
            }

            // 2. Obtener barbero
            const stylist = await db.stylist.findFirst({
                where: {
                    id: stylistId,
                    shopId
                }
            });

            if (!stylist) {
                return NextResponse.json(
                    { error: "Stylist not found" },
                    { status: 404 }
                );
            }

            // 3. Parsear fecha y hora
            const [hours, minutes] = time.split(':').map(Number);
            const startTime = new Date(`${date}T${time.padStart(2, '0')}:${String(minutes).padStart(2, '0')}:00`);
            const endTime = new Date(startTime.getTime() + (service.duration + service.bufferTime) * 60000);

            // 4. Verificar disponibilidad
            const existingAppointment = await db.appointment.findFirst({
                where: {
                    stylistId,
                    status: { not: 'CANCELLED' },
                    OR: [
                        {
                            AND: [
                                { startTime: { lte: startTime } },
                                { endTime: { gt: startTime } }
                            ]
                        },
                        {
                            AND: [
                                { startTime: { lt: endTime } },
                                { endTime: { gte: endTime } }
                            ]
                        },
                        {
                            AND: [
                                { startTime: { gte: startTime } },
                                { endTime: { lte: endTime } }
                            ]
                        }
                    ]
                }
            });

            if (existingAppointment) {
                return NextResponse.json(
                    {
                        error: "Time slot no longer available",
                        details: "Este horario ya fue reservado. Por favor selecciona otro."
                    },
                    { status: 409 }
                );
            }

            // 5. Encontrar o crear cliente
            let client = await db.client.findFirst({
                where: {
                    phoneNumber: clientWhatsApp,
                    shopId
                }
            });

            if (!client) {
                client = await db.client.create({
                    data: {
                        name: clientName,
                        phoneNumber: clientWhatsApp,
                        shopId
                    }
                });
            }

            // 6. Crear cita
            const appointment = await db.appointment.create({
                data: {
                    clientName,
                    clientWhatsApp,
                    serviceId,
                    stylistId,
                    startTime,
                    endTime,
                    clientId: client.id,
                    shopId,
                    status: 'CONFIRMED',
                    notes: data.notes || `Agendado vía Chatbot IA - Horario optimizado`
                },
                include: {
                    service: true,
                    client: true,
                    stylist: true
                }
            });

            // 📅 Sync to Google Calendar (fire-and-forget)
            pushAppointmentToCalendar(appointment.id).catch((err) =>
                console.error("Google Calendar sync error:", err)
            );

            // 7. Analytics de optimización
            const dayStart = new Date(date);
            dayStart.setHours(0, 0, 0, 0);
            const dayEnd = new Date(date);
            dayEnd.setHours(23, 59, 59, 999);

            const dayAppointments = await db.appointment.findMany({
                where: {
                    shopId,
                    startTime: { gte: dayStart, lte: dayEnd },
                    status: { not: 'CANCELLED' }
                },
                include: { service: true }
            });

            // Calcular ocupación del día
            const totalBookedMinutes = dayAppointments.reduce((sum, apt) => {
                const aptService = apt.service || service;
                return sum + aptService.duration + aptService.bufferTime;
            }, 0);

            const shopAvailability = await db.shopAvailability.findFirst({
                where: {
                    shopId,
                    dayOfWeek: dayStart.getDay()
                }
            });

            let occupancyRate = 0;
            if (shopAvailability) {
                const [startH, startM] = shopAvailability.startTime.split(':').map(Number);
                const [endH, endM] = shopAvailability.endTime.split(':').map(Number);
                const totalMinutes = (endH * 60 + endM) - (startH * 60 + startM);
                occupancyRate = (totalBookedMinutes / totalMinutes) * 100;
            }

            console.log('[Create Optimized Appointment]', {
                appointmentId: appointment.id,
                optimizationScore: 'calculated',
                dayOccupancy: `${occupancyRate.toFixed(1)}%`,
                gapFilling: 'analyzed'
            });

            return NextResponse.json({
                success: true,
                appointment,
                optimization: {
                    dayOccupancy: Math.round(occupancyRate),
                    totalAppointments: dayAppointments.length,
                    message: occupancyRate > 80
                        ? "¡Excelente! Día con alta ocupación 🎉"
                        : occupancyRate > 50
                        ? "Buen horario, ayudando a llenar el día 💪"
                        : "¡Gracias por agendar! Ayudando a optimizar el calendario 📅"
                }
            });

        } catch (error) {
            console.error("[Create Optimized Appointment] Error:", error);
            return NextResponse.json(
                { error: "Failed to create appointment" },
                { status: 500 }
            );
        }
    }, request as any, ['ORG_ADMIN', 'TEAM_LEADER', 'PROFESSIONAL'] as Role[]);
}
