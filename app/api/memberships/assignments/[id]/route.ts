import { NextResponse } from 'next/server';
import { db } from '@/lib/database';
import { withAuth, type AuthenticatedUser } from '@/lib/auth-middleware';
import { assertMembershipsEnabled } from '@/lib/memberships/guard';
import { z } from 'zod';

const patchSchema = z.object({
    status: z.enum(['ACTIVE', 'EXPIRED', 'EXHAUSTED', 'CANCELED']).optional(),
    servicesRemaining: z.number().int().min(0).optional(),
    expiresAt: z.string().datetime().nullable().optional(),
    notes: z.string().max(500).nullable().optional(),
});

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
    return withAuth(async (authUser: AuthenticatedUser) => {
        const { id } = await params;
        const shopId = authUser.shopId;
        if (!shopId) return NextResponse.json({ error: 'No shop' }, { status: 403 });

        const guard = await assertMembershipsEnabled(shopId);
        if (!guard.ok) return NextResponse.json({ error: guard.error, upgradeRequired: true }, { status: guard.status });

        const existing = await db.clientMembership.findFirst({ where: { id, shopId } });
        if (!existing) return NextResponse.json({ error: 'Assignment not found' }, { status: 404 });

        const body = await request.json();
        const parsed = patchSchema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 });
        }

        const data: any = { ...parsed.data };
        if (parsed.data.expiresAt) data.expiresAt = new Date(parsed.data.expiresAt);

        const assignment = await db.clientMembership.update({
            where: { id },
            data,
            include: { plan: true },
        });

        return NextResponse.json({ assignment });
    }, request as any);
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
    return withAuth(async (authUser: AuthenticatedUser) => {
        const { id } = await params;
        const shopId = authUser.shopId;
        if (!shopId) return NextResponse.json({ error: 'No shop' }, { status: 403 });

        const guard = await assertMembershipsEnabled(shopId);
        if (!guard.ok) return NextResponse.json({ error: guard.error, upgradeRequired: true }, { status: guard.status });

        const existing = await db.clientMembership.findFirst({ where: { id, shopId } });
        if (!existing) return NextResponse.json({ error: 'Assignment not found' }, { status: 404 });

        // Soft cancel — preserves history of redeemed appointments
        await db.clientMembership.update({
            where: { id },
            data: { status: 'CANCELED' },
        });

        return NextResponse.json({ canceled: true });
    }, request as any);
}
