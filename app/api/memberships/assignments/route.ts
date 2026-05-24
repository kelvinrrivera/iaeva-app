import { NextResponse } from 'next/server';
import { db } from '@/lib/database';
import { withAuth, type AuthenticatedUser } from '@/lib/auth-middleware';
import { assertMembershipsEnabled } from '@/lib/memberships/guard';
import { z } from 'zod';

const createSchema = z.object({
    clientId: z.string(),
    planId: z.string(),
    notes: z.string().max(500).optional(),
});

export async function GET(request: Request) {
    return withAuth(async (authUser: AuthenticatedUser) => {
        const shopId = authUser.shopId;
        if (!shopId) return NextResponse.json({ error: 'No shop' }, { status: 403 });

        const guard = await assertMembershipsEnabled(shopId);
        if (!guard.ok) return NextResponse.json({ error: guard.error, upgradeRequired: true }, { status: guard.status });

        const url = new URL(request.url);
        const clientId = url.searchParams.get('clientId') || undefined;
        const status = url.searchParams.get('status') || undefined;

        const assignments = await db.clientMembership.findMany({
            where: {
                shopId,
                ...(clientId && { clientId }),
                ...(status && { status }),
            },
            include: {
                plan: true,
                client: { select: { id: true, name: true, phoneNumber: true } },
            },
            orderBy: [{ status: 'asc' }, { createdAt: 'desc' }],
        });

        return NextResponse.json({ assignments });
    }, request as any);
}

export async function POST(request: Request) {
    return withAuth(async (authUser: AuthenticatedUser) => {
        const shopId = authUser.shopId;
        if (!shopId) return NextResponse.json({ error: 'No shop' }, { status: 403 });

        const guard = await assertMembershipsEnabled(shopId);
        if (!guard.ok) return NextResponse.json({ error: guard.error, upgradeRequired: true }, { status: guard.status });

        const body = await request.json();
        const parsed = createSchema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 });
        }

        // Verify plan + client belong to this shop
        const [plan, client] = await Promise.all([
            db.membershipPlan.findFirst({ where: { id: parsed.data.planId, shopId } }),
            db.client.findFirst({ where: { id: parsed.data.clientId, shopId } }),
        ]);
        if (!plan) return NextResponse.json({ error: 'Plan not found' }, { status: 404 });
        if (!client) return NextResponse.json({ error: 'Client not found' }, { status: 404 });
        if (!plan.active) return NextResponse.json({ error: 'Plan is inactive' }, { status: 400 });

        const expiresAt = plan.validityDays
            ? new Date(Date.now() + plan.validityDays * 24 * 60 * 60 * 1000)
            : null;

        const assignment = await db.clientMembership.create({
            data: {
                shopId,
                clientId: parsed.data.clientId,
                planId: parsed.data.planId,
                servicesRemaining: plan.totalServices,
                expiresAt,
                notes: parsed.data.notes,
                status: 'ACTIVE',
            },
            include: { plan: true },
        });

        return NextResponse.json({ assignment }, { status: 201 });
    }, request as any);
}
