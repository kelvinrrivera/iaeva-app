import { NextResponse } from 'next/server';
import { db } from '@/lib/database';
import { withAuth, type AuthenticatedUser } from '@/lib/auth-middleware';
import { assertMembershipsEnabled } from '@/lib/memberships/guard';
import { z } from 'zod';

const updateSchema = z.object({
    name: z.string().min(1).max(100).optional(),
    description: z.string().max(500).nullable().optional(),
    totalServices: z.number().int().min(1).max(100).optional(),
    price: z.number().nonnegative().optional(),
    validityDays: z.number().int().positive().nullable().optional(),
    applicableServiceIds: z.array(z.string()).optional(),
    active: z.boolean().optional(),
});

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
    return withAuth(async (authUser: AuthenticatedUser) => {
        const { id } = await params;
        const shopId = authUser.shopId;
        if (!shopId) return NextResponse.json({ error: 'No shop' }, { status: 403 });

        const guard = await assertMembershipsEnabled(shopId);
        if (!guard.ok) return NextResponse.json({ error: guard.error, upgradeRequired: true }, { status: guard.status });

        const existing = await db.membershipPlan.findFirst({ where: { id, shopId } });
        if (!existing) return NextResponse.json({ error: 'Plan not found' }, { status: 404 });

        const body = await request.json();
        const parsed = updateSchema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 });
        }

        const plan = await db.membershipPlan.update({
            where: { id },
            data: parsed.data,
        });

        return NextResponse.json({ plan });
    }, request as any);
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
    return withAuth(async (authUser: AuthenticatedUser) => {
        const { id } = await params;
        const shopId = authUser.shopId;
        if (!shopId) return NextResponse.json({ error: 'No shop' }, { status: 403 });

        const guard = await assertMembershipsEnabled(shopId);
        if (!guard.ok) return NextResponse.json({ error: guard.error, upgradeRequired: true }, { status: guard.status });

        const existing = await db.membershipPlan.findFirst({
            where: { id, shopId },
            include: { _count: { select: { assignments: true } } },
        });
        if (!existing) return NextResponse.json({ error: 'Plan not found' }, { status: 404 });

        // If plan has any assignments, soft-delete (deactivate) instead of hard-delete
        if (existing._count.assignments > 0) {
            await db.membershipPlan.update({ where: { id }, data: { active: false } });
            return NextResponse.json({ deactivated: true });
        }

        await db.membershipPlan.delete({ where: { id } });
        return NextResponse.json({ deleted: true });
    }, request as any);
}
