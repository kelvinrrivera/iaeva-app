import { NextResponse } from 'next/server';
import { db } from '@/lib/database';
import { withAuth, type AuthenticatedUser } from '@/lib/auth-middleware';
import { markHumanTakeover, returnControlToBot } from '@/lib/whatsapp/bot-control';
import { z } from 'zod';

const bodySchema = z.object({
    action: z.enum(['take', 'release']),
});

const PHONE_RE = /^\+?[\d\s\-().]{7,20}$/;

export async function GET(request: Request, { params }: { params: Promise<{ phone: string }> }) {
    return withAuth(async (authUser: AuthenticatedUser) => {
        const { phone } = await params;
        const shopId = authUser.shopId;
        if (!shopId) return NextResponse.json({ error: 'No shop' }, { status: 403 });

        const decoded = decodeURIComponent(phone);
        if (!PHONE_RE.test(decoded)) return NextResponse.json({ error: 'Invalid phone' }, { status: 400 });

        const conv = await db.whatsAppConversation.findUnique({
            where: { phoneNumber_shopId: { phoneNumber: decoded, shopId } },
            select: { controlMode: true, botResumesAt: true, humanTookOverAt: true, takeoverReason: true },
        });

        return NextResponse.json(conv ?? { controlMode: 'BOT', botResumesAt: null, humanTookOverAt: null, takeoverReason: null });
    }, request as any);
}

export async function POST(request: Request, { params }: { params: Promise<{ phone: string }> }) {
    return withAuth(async (authUser: AuthenticatedUser) => {
        const { phone } = await params;
        const shopId = authUser.shopId;
        if (!shopId) return NextResponse.json({ error: 'No shop' }, { status: 403 });

        const body = await request.json();
        const parsed = bodySchema.safeParse(body);
        if (!parsed.success) {
            return NextResponse.json({ error: 'Invalid input' }, { status: 400 });
        }

        const decoded = decodeURIComponent(phone);
        if (!PHONE_RE.test(decoded)) return NextResponse.json({ error: 'Invalid phone' }, { status: 400 });

        if (parsed.data.action === 'take') {
            await markHumanTakeover(shopId, decoded, 'dashboard', authUser.id);
            return NextResponse.json({ success: true, controlMode: 'HUMAN' });
        }

        await returnControlToBot(shopId, decoded);
        return NextResponse.json({ success: true, controlMode: 'BOT' });
    }, request as any);
}
