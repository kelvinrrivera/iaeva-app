import { NextResponse } from 'next/server';
import { db } from '@/lib/database';
import { withAuth, type AuthenticatedUser } from '@/lib/auth-middleware';
import { assertMembershipsEnabled } from '@/lib/memberships/guard';
import { z } from 'zod';

const createPlanSchema = z.object({
    name: z.string().min(1).max(100),
    description: z.string().max(500).optional(),
    totalServices: z.number().int().min(1).max(100),
    price: z.number().nonnegative(),
    validityDays: z.number().int().positive().nullable().optional(),
    applicableServiceIds: z.array(z.string()).default([]),
    active: z.boolean().default(true),
});

export async function GET(request: Request) {
    return withAuth(async (authUser: AuthenticatedUser) => {
        const shopId = authUser.shopId;
        if (!shopId) return NextResponse.json({ error: 'No shop' }, { status: 403 });

        const guard = await assertMembershipsEnabled(shopId);
        if (!guard.ok) return NextResponse.json({ error: guard.error, upgradeRequired: true }, { status: guard.status });

        const plans = await db.membershipPlan.findMany({
            where: { shopId },
            orderBy: [{ active: 'desc' }, { createdAt: 'desc' }],
            include: { _count: { select: { assignments: true } } },
        });

        return NextResponse.json({ plans });
    }, request as any);
}

export async function POST(request: Request) {
    return withAuth(async (authUser: AuthenticatedUser) => {
        const shopId = authUser.shopId;
        if (!shopId) return NextResponse.json({ error: 'No shop' }, { status: 403 });

        const guard = await assertMembershipsEnabled(shopId);
        if (!guard.ok) return NextResponse.json({ error: guard.error, upgradeRequired: true }, { status: guard.status });

        const body = await request.json();
        const parsed = createPlanSchema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 });
        }

        const plan = await db.membershipPlan.create({
            data: { shopId, ...parsed.data },
        });

        return NextResponse.json({ plan }, { status: 201 });
    }, request as any);
}
