import { NextResponse } from "next/server";
import { db } from "@/lib/database";
import { startOfDay, endOfDay } from "date-fns";
import { withAuth, type AuthenticatedUser } from "@/lib/auth-middleware";

export async function GET(request: Request) {
    return withAuth(async (authUser: AuthenticatedUser) => {
        try {
            const shopId = authUser.shopId;

            if (!shopId) {
                return NextResponse.json(
                    { error: "No shop found for user" },
                    { status: 404 }
                );
            }

            const now = new Date();
            const start = startOfDay(now);
            const end = endOfDay(now);

            // 1. Appointments Today (solo del shop del usuario)
            const appointmentsToday = await db.appointment.count({
                where: {
                    shopId,
                    startTime: {
                        gte: start,
                        lte: end
                    }
                }
            });

            // 2. Revenue Today — real collected (paidAt today) + pending (scheduled, not paid)
            const [paidToday, scheduledToday] = await Promise.all([
                db.appointment.findMany({
                    where: { shopId, paidAt: { gte: start, lte: end } },
                    select: { paidAmount: true, service: { select: { price: true } } }
                }),
                db.appointment.findMany({
                    where: { shopId, startTime: { gte: start, lte: end }, status: { notIn: ['CANCELLED', 'NO_SHOW'] } },
                    select: { paidAt: true, service: { select: { price: true } } }
                })
            ]);

            const revenueToday = paidToday.reduce((sum, apt) => sum + (apt.paidAmount ?? apt.service?.price ?? 0), 0);
            const revenuePending = scheduledToday
                .filter(apt => !apt.paidAt)
                .reduce((sum, apt) => sum + (apt.service?.price ?? 0), 0);

            // 3. Chatbot Queries (Total count in ChatHistory for today, del shop)
            const chatbotQueries = await db.chatHistory.count({
                where: {
                    shopId,
                    createdAt: {
                        gte: start,
                        lte: end
                    }
                }
            });

            // 4. New Clients Today (del shop)
            const newClientsToday = await db.client.count({
                where: {
                    shopId,
                    createdAt: {
                        gte: start,
                        lte: end
                    }
                }
            });

            // 5. Onboarding: services count, hours configured, chatbot ever used
            const servicesCount = await db.service.count({ where: { shopId, isActive: true } });
            const hoursConfigured = (await db.shopAvailability.count({ where: { shopId } })) > 0;
            const chatbotEverUsed = (await db.chatHistory.count({ where: { shopId }, take: 1 })) > 0;

            return NextResponse.json({
                appointmentsToday,
                revenueToday,
                revenuePending,
                chatbotQueries,
                chatbotEverUsed,
                newClientsToday,
                servicesCount,
                hoursConfigured,
            });
        } catch (error) {
            console.error("Dashboard Stats Error:", error);
            return NextResponse.json({ error: "Failed to fetch dashboard stats" }, { status: 500 });
        }
    }, request as any);
}
