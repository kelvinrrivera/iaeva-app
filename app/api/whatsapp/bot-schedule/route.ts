import { NextResponse } from 'next/server';
import { db } from '@/lib/database';
import { withAuth, type AuthenticatedUser } from '@/lib/auth-middleware';
import { z } from 'zod';

const customWindowSchema = z.object({
    day: z.number().int().min(0).max(6),
    start: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
    end: z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/),
});

const bodySchema = z.object({
    mode: z.enum(['ALWAYS', 'OFF_HOURS', 'BUSINESS_HOURS', 'CUSTOM', 'DISABLED']),
    customWindows: z.array(customWindowSchema).max(50).nullable().optional(),
    closedAutoReply: z.string().max(500).nullable().optional(),
    closedAutoReplyEnabled: z.boolean().optional(),
});

const DEFAULT_CONFIG = {
    mode: 'ALWAYS' as const,
    customWindows: null,
    closedAutoReply: null,
    closedAutoReplyEnabled: false,
};

export async function GET(request: Request) {
    return withAuth(async (authUser: AuthenticatedUser) => {
        const shopId = authUser.shopId;
        if (!shopId) return NextResponse.json({ error: 'No shop' }, { status: 403 });

        const config = await db.botSchedule.findUnique({ where: { shopId } });
        return NextResponse.json(config ?? DEFAULT_CONFIG);
    }, request as any);
}

export async function POST(request: Request) {
    return withAuth(async (authUser: AuthenticatedUser) => {
        const shopId = authUser.shopId;
        if (!shopId) return NextResponse.json({ error: 'No shop' }, { status: 403 });

        const body = await request.json();
        const parsed = bodySchema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json({ error: 'Invalid input', details: parsed.error.flatten() }, { status: 400 });
        }

        const config = await db.botSchedule.upsert({
            where: { shopId },
            update: {
                mode: parsed.data.mode,
                customWindows: parsed.data.customWindows ?? undefined,
                closedAutoReply: parsed.data.closedAutoReply ?? undefined,
                closedAutoReplyEnabled: parsed.data.closedAutoReplyEnabled ?? undefined,
            },
            create: {
                shopId,
                mode: parsed.data.mode,
                customWindows: parsed.data.customWindows ?? undefined,
                closedAutoReply: parsed.data.closedAutoReply ?? null,
                closedAutoReplyEnabled: parsed.data.closedAutoReplyEnabled ?? false,
            },
        });

        return NextResponse.json(config);
    }, request as any);
}
