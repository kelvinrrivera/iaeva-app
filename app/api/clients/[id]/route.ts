import { NextResponse } from 'next/server';
import { db } from '@/lib/database';
import { withAuth, type AuthenticatedUser } from '@/lib/auth-middleware';
import { z } from 'zod';

const patchSchema = z.object({
    name: z.string().max(120).nullable().optional(),
    phoneNumber: z.string().max(30).optional(),
    email: z.string().email().nullable().optional(),
    notes: z.string().max(2000).nullable().optional(),
    isActive: z.boolean().optional(),
});

/**
 * GET /api/clients/[id]
 * Returns the client with all aggregated data needed for the detail page:
 * memberships (active + history), appointments (history + stats),
 * favorite services, fidelity progress.
 */
export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
    return withAuth(async (authUser: AuthenticatedUser) => {
        const { id } = await params;
        const shopId = authUser.shopId;
        if (!shopId) return NextResponse.json({ error: 'No shop' }, { status: 403 });

        const client = await db.client.findFirst({
            where: { id, shopId },
            include: {
                memberships: {
                    include: { plan: true },
                    orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
                },
                appointments: {
                    include: {
                        service: { select: { id: true, name: true, price: true } },
                        stylist: { select: { id: true, name: true } },
                    },
                    orderBy: { startTime: 'desc' },
                    take: 200,
                },
                chatHistory: {
                    orderBy: { createdAt: 'asc' },
                    take: 500,
                    select: { id: true, role: true, content: true, createdAt: true },
                },
            },
        });

        if (!client) {
            return NextResponse.json({ error: 'Client not found' }, { status: 404 });
        }

        // Aggregate stats from appointments
        const completed = client.appointments.filter(a => a.status === 'COMPLETED');
        const cancelled = client.appointments.filter(a => a.status === 'CANCELLED');
        const noShows = client.appointments.filter(a => a.status === 'NO_SHOW');
        const upcoming = client.appointments.filter(
            a => a.status === 'SCHEDULED' || a.status === 'CONFIRMED'
        );

        const totalSpent = completed.reduce((sum, a) => sum + (a.paidAmount || 0), 0);

        // Frequency: average days between completed visits
        let avgDaysBetween: number | null = null;
        if (completed.length >= 2) {
            const sorted = [...completed].sort(
                (a, b) => new Date(a.startTime).getTime() - new Date(b.startTime).getTime()
            );
            let totalDays = 0;
            for (let i = 1; i < sorted.length; i++) {
                totalDays += (new Date(sorted[i].startTime).getTime() - new Date(sorted[i - 1].startTime).getTime()) / 86400000;
            }
            avgDaysBetween = Math.round(totalDays / (sorted.length - 1));
        }

        // Top services by occurrence
        const serviceCounts = new Map<string, { id: string; name: string; price: number; count: number; revenue: number }>();
        for (const a of completed) {
            if (!a.service) continue;
            const cur = serviceCounts.get(a.service.id) || { ...a.service, count: 0, revenue: 0 };
            cur.count += 1;
            cur.revenue += a.paidAmount || 0;
            serviceCounts.set(a.service.id, cur);
        }
        const favoriteServices = Array.from(serviceCounts.values())
            .sort((a, b) => b.count - a.count)
            .slice(0, 5);

        // Loyalty progress
        const loyalty = await db.loyaltyConfig.findUnique({ where: { shopId } });
        let loyaltyProgress: {
            enabled: boolean;
            visitsRequired: number;
            currentVisits: number;
            visitsToReward: number;
            rewardLabel: string;
            rewardEarned: boolean;
        } | null = null;
        if (loyalty?.enabled) {
            const required = loyalty.visitsRequired;
            const visits = client.visitCount;
            const remainder = visits % required;
            loyaltyProgress = {
                enabled: true,
                visitsRequired: required,
                currentVisits: visits,
                visitsToReward: remainder === 0 && visits > 0 ? 0 : required - remainder,
                rewardLabel: loyalty.rewardLabel,
                rewardEarned: visits > 0 && remainder === 0,
            };
        }

        // Next appointment
        const nextAppointment = upcoming.length > 0
            ? upcoming.reduce((soonest, a) =>
                new Date(a.startTime) < new Date(soonest.startTime) ? a : soonest
            )
            : null;

        // Last visit
        const lastVisit = completed.length > 0 ? completed[0] : null; // appointments are desc-sorted

        return NextResponse.json({
            client: {
                id: client.id,
                name: client.name,
                phoneNumber: client.phoneNumber,
                email: client.email,
                notes: client.notes,
                isActive: client.isActive,
                debtAmount: client.debtAmount,
                visitCount: client.visitCount,
                createdAt: client.createdAt,
                preferredContact: client.preferredContact,
            },
            stats: {
                totalAppointments: client.appointments.length,
                completedCount: completed.length,
                cancelledCount: cancelled.length,
                noShowCount: noShows.length,
                totalSpent,
                avgDaysBetween,
                lastVisitAt: lastVisit?.startTime ?? null,
                nextAppointmentAt: nextAppointment?.startTime ?? null,
                nextAppointmentService: nextAppointment?.service?.name ?? null,
            },
            favoriteServices,
            loyalty: loyaltyProgress,
            memberships: client.memberships,
            appointments: client.appointments,
            chatHistory: client.chatHistory,
        });
    }, request as any);
}

/**
 * PATCH /api/clients/[id]
 * Update client fields (name, phone, email, notes, isActive).
 */
export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
    return withAuth(async (authUser: AuthenticatedUser) => {
        const { id } = await params;
        const shopId = authUser.shopId;
        if (!shopId) return NextResponse.json({ error: 'No shop' }, { status: 403 });

        const existing = await db.client.findFirst({ where: { id, shopId } });
        if (!existing) return NextResponse.json({ error: 'Client not found' }, { status: 404 });

        const body = await request.json();
        const parsed = patchSchema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 });
        }

        try {
            const client = await db.client.update({
                where: { id },
                data: parsed.data,
            });
            return NextResponse.json({ client });
        } catch (err: any) {
            // P2002 unique constraint (shopId+phoneNumber)
            if (err?.code === 'P2002') {
                return NextResponse.json({ error: 'Ya existe otro cliente con ese número en este negocio.' }, { status: 409 });
            }
            throw err;
        }
    }, request as any);
}
