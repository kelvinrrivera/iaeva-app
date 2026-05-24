import { NextResponse } from "next/server";
import { db } from "@/lib/database";
import { startOfDay, endOfDay, parseISO, format } from "date-fns";
import { es } from "date-fns/locale";
import { withAuth, withAuthAndRole, type AuthenticatedUser } from "@/lib/auth-middleware";
import { validateCreateAppointment, validateAppointmentQuery } from "@/lib/validations";
import { sendWhatsAppMessage } from "@/lib/whatsapp/sender";
import { pushAppointmentToCalendar } from "@/lib/integrations/google-calendar";
import { notifyOwnerNewBooking } from "@/lib/whatsapp/owner-notifier";
import type { Role, Prisma } from "@prisma/client";

/**
 * GET /api/appointments
 * Get appointments for the authenticated user's shop
 * Query params: date (optional) - Filter by date
 */
export async function GET(request: Request) {
    return withAuth(async (authUser: AuthenticatedUser) => {
        try {
            const { searchParams } = new URL(request.url);
            const queryParams = Object.fromEntries(searchParams);

            // Validate query params
            const queryValidation = validateAppointmentQuery(queryParams);
            if (!queryValidation.success) {
                return NextResponse.json(
                    {
                        error: "Invalid query parameters",
                        details: queryValidation.error.issues
                    },
                    { status: 400 }
                );
            }

            const shopId = authUser.shopId; // 🔒 SECURITY: User's shop ID
            if (!shopId) {
                return NextResponse.json({ error: "No shop assigned" }, { status: 403 });
            }

            // Build where clause with shop filter
            const where: Prisma.AppointmentWhereInput = {
                shopId, // 🔒 SECURITY: Always filter by user's shop
            };

            if (queryParams.date) {
                const date = parseISO(queryParams.date);
                where.startTime = {
                    gte: startOfDay(date),
                    lte: endOfDay(date)
                };
            }

            if (queryValidation.data.status) {
                where.status = queryValidation.data.status;
            }

            if (queryValidation.data.stylistId) {
                where.stylistId = queryValidation.data.stylistId;
            }

            if (queryValidation.data.clientId) {
                where.clientId = queryValidation.data.clientId;
            }

            const appointments = await db.appointment.findMany({
                where,
                include: {
                    service: true,
                    client: true,
                    stylist: true,
                },
                orderBy: {
                    startTime: "asc"
                },
                take: queryValidation.data.limit || 50,
                skip: queryValidation.data.page ? (queryValidation.data.page - 1) * (queryValidation.data.limit || 50) : 0,
            });

            return NextResponse.json(appointments);
        } catch (error) {
            console.error('Error fetching appointments:', error);
            return NextResponse.json(
                { error: "Failed to fetch appointments" },
                { status: 500 }
            );
        }
    }, request as any);
}

/**
 * POST /api/appointments
 * Create a new appointment for the authenticated user's shop
 * Requires: ORG_ADMIN, TEAM_LEADER, or PROFESSIONAL role
 */
export async function POST(request: Request) {
    return withAuthAndRole(async (authUser: AuthenticatedUser) => {
        try {
            const data = await request.json();

            // ✅ Validate input with Zod
            const validation = validateCreateAppointment(data);
            if (!validation.success) {
                return NextResponse.json(
                    {
                        error: "Validation failed",
                        details: validation.error.issues
                    },
                    { status: 400 }
                );
            }

            const appointmentData = validation.data;
            const shopId = authUser.shopId; // 🔒 SECURITY: Use user's shop ID
            if (!shopId) {
                return NextResponse.json({ error: "No shop assigned" }, { status: 403 });
            }

            // Verify service belongs to user's shop
            const service = await db.service.findFirst({
                where: {
                    id: appointmentData.serviceId,
                    shopId, // 🔒 SECURITY: Service must belong to user's shop
                }
            });

            if (!service) {
                return NextResponse.json(
                    { error: "Service not found" },
                    { status: 404 }
                );
            }

            // Verify stylist belongs to user's shop
            const stylist = await db.stylist.findFirst({
                where: {
                    id: appointmentData.stylistId,
                    shopId, // 🔒 SECURITY: Stylist must belong to user's shop
                }
            });

            if (!stylist) {
                return NextResponse.json(
                    { error: "Stylist not found" },
                    { status: 404 }
                );
            }

            // Find or create client by phone within user's shop
            let client = await db.client.findFirst({
                where: {
                    phoneNumber: appointmentData.clientWhatsApp,
                    shopId, // 🔒 SECURITY: Client must belong to user's shop
                }
            });

            if (!client) {
                client = await db.client.create({
                    data: {
                        name: appointmentData.clientName,
                        phoneNumber: appointmentData.clientWhatsApp,
                        shopId, // 🔒 SECURITY: Assign to user's shop
                    }
                });
            }

            // Create appointment
            const appointment = await db.appointment.create({
                data: {
                    clientName: appointmentData.clientName,
                    clientWhatsApp: appointmentData.clientWhatsApp,
                    serviceId: appointmentData.serviceId,
                    stylistId: appointmentData.stylistId,
                    startTime: new Date(appointmentData.startTime),
                    endTime: new Date(appointmentData.endTime),
                    clientId: client.id,
                    shopId, // 🔒 SECURITY: Assign to user's shop
                    status: appointmentData.status || 'CONFIRMED',
                    notes: appointmentData.notes,
                },
                include: {
                    service: true,
                    client: true,
                    stylist: true,
                }
            });

            // 📢 Send WhatsApp confirmation notification
            try {
                const formattedDate = format(appointment.startTime, "EEEE d 'de' MMMM 'a las' HH:mm", { locale: es });
                await sendWhatsAppMessage({
                    to: appointment.clientWhatsApp,
                    message: `¡Hola ${appointment.clientName}! 📅 Tu cita para *${appointment.service.name}* ha sido confirmada para el *${formattedDate}*. ¡Te esperamos!`,
                    shopId,
                });
            } catch (notifyError) {
                console.error("Error sending WhatsApp notification:", notifyError);
                // We don't fail the request if notification fails
            }

            // 📅 Sync to Google Calendar (fire-and-forget)
            pushAppointmentToCalendar(appointment.id).catch((err) =>
                console.error("Google Calendar sync error:", err)
            );

            // 🔔 Notify owner (fire-and-forget)
            notifyOwnerNewBooking({
                shopId,
                appointmentId: appointment.id,
                clientName: appointment.clientName,
                serviceName: appointment.service.name,
                date: appointment.startTime,
                professionalName: appointment.stylist.name,
            }).catch((err) => console.error("Owner new booking notify error:", err));

            return NextResponse.json(appointment, { status: 201 });
        } catch (error) {
            console.error("Create Appointment Error:", error);
            return NextResponse.json(
                { error: "Failed to create appointment" },
                { status: 500 }
            );
        }
    }, request as any, ['ORG_ADMIN', 'TEAM_LEADER', 'PROFESSIONAL'] as Role[]);
}
