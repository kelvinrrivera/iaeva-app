/**
 * GET /api/finance/summary
 *
 * Returns real financial data for the shop:
 * - Collected revenue (paidAt set) broken down by payment method
 * - Pending revenue (appointments not yet paid)
 * - Outstanding debts (fiás) per client
 * - Daily revenue chart for the selected period
 *
 * Query params:
 *   period: "today" | "week" | "month" (default: "today")
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth, type AuthenticatedUser } from '@/lib/auth-middleware';
import { db } from '@/lib/database';
import { startOfDay, endOfDay, startOfWeek, endOfWeek, startOfMonth, endOfMonth, format, eachDayOfInterval } from 'date-fns';
import { es } from 'date-fns/locale';

export async function GET(request: NextRequest) {
    return withAuth(async (authUser: AuthenticatedUser) => {
        try {
            const shopId = authUser.shopId;
            if (!shopId) {
                return NextResponse.json({ error: 'Shop not found' }, { status: 404 });
            }

            const { searchParams } = new URL(request.url);
            const period = searchParams.get('period') || 'today';

            const now = new Date();
            let start: Date;
            let end: Date;

            switch (period) {
                case 'week':
                    start = startOfWeek(now, { weekStartsOn: 1 });
                    end = endOfWeek(now, { weekStartsOn: 1 });
                    break;
                case 'month':
                    start = startOfMonth(now);
                    end = endOfMonth(now);
                    break;
                default: // today
                    start = startOfDay(now);
                    end = endOfDay(now);
            }

            // 1. Cobros reales del período (paidAt dentro del rango)
            const paidAppointments = await db.appointment.findMany({
                where: {
                    shopId,
                    paidAt: { gte: start, lte: end },
                },
                select: {
                    id: true,
                    clientName: true,
                    paidAmount: true,
                    paidAt: true,
                    paymentMethod: true,
                    service: { select: { name: true, price: true } },
                    stylist: { select: { name: true } },
                },
                orderBy: { paidAt: 'desc' },
            });

            // 2. Citas pendientes de cobro (sin paidAt, no canceladas)
            const pendingAppointments = await db.appointment.findMany({
                where: {
                    shopId,
                    startTime: { gte: start, lte: end },
                    paidAt: null,
                    status: { notIn: ['CANCELLED', 'NO_SHOW'] },
                },
                select: {
                    id: true,
                    clientName: true,
                    startTime: true,
                    status: true,
                    service: { select: { name: true, price: true } },
                    stylist: { select: { name: true } },
                },
                orderBy: { startTime: 'asc' },
            });

            // 3. Clientes con deuda (fía) — del shop
            const clientsWithDebt = await db.client.findMany({
                where: {
                    shopId,
                    debtAmount: { gt: 0 },
                },
                select: {
                    id: true,
                    name: true,
                    phoneNumber: true,
                    debtAmount: true,
                },
                orderBy: { debtAmount: 'desc' },
            });

            // 4. Totales por método de pago
            const byMethod: Record<string, number> = { CASH: 0, CARD: 0, TRANSFER: 0, DEBT: 0, OTHER: 0 };
            let totalCollected = 0;

            for (const apt of paidAppointments) {
                const amount = apt.paidAmount ?? apt.service?.price ?? 0;
                const method = apt.paymentMethod ?? 'OTHER';
                byMethod[method] = (byMethod[method] ?? 0) + amount;
                totalCollected += amount;
            }

            const totalPending = pendingAppointments.reduce(
                (sum, apt) => sum + (apt.service?.price ?? 0), 0
            );
            const totalDebt = clientsWithDebt.reduce((sum, c) => sum + c.debtAmount, 0);

            // 5. Gráfico diario (solo para week y month)
            let dailyChart: { date: string; label: string; collected: number; pending: number }[] = [];

            if (period !== 'today') {
                const days = eachDayOfInterval({ start, end });
                dailyChart = await Promise.all(days.map(async (day) => {
                    const dayStart = startOfDay(day);
                    const dayEnd = endOfDay(day);

                    const [dayPaid, dayPending] = await Promise.all([
                        db.appointment.findMany({
                            where: { shopId, paidAt: { gte: dayStart, lte: dayEnd } },
                            select: { paidAmount: true, service: { select: { price: true } } }
                        }),
                        db.appointment.findMany({
                            where: { shopId, startTime: { gte: dayStart, lte: dayEnd }, paidAt: null, status: { notIn: ['CANCELLED', 'NO_SHOW'] } },
                            select: { service: { select: { price: true } } }
                        })
                    ]);

                    return {
                        date: format(day, 'yyyy-MM-dd'),
                        label: format(day, 'EEE d', { locale: es }),
                        collected: dayPaid.reduce((s, a) => s + (a.paidAmount ?? a.service?.price ?? 0), 0),
                        pending: dayPending.reduce((s, a) => s + (a.service?.price ?? 0), 0),
                    };
                }));
            }

            return NextResponse.json({
                period,
                summary: {
                    totalCollected,
                    totalPending,
                    totalDebt,
                    byPaymentMethod: byMethod,
                    transactionsCount: paidAppointments.length,
                    pendingCount: pendingAppointments.length,
                    clientsWithDebt: clientsWithDebt.length,
                },
                transactions: paidAppointments,
                pending: pendingAppointments,
                debtors: clientsWithDebt,
                dailyChart,
            });

        } catch (error: any) {
            console.error('[Finance Summary]', error);
            return NextResponse.json({ error: "Internal server error" }, { status: 500 });
        }
    }, request as any);
}
