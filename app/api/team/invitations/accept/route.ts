import { NextResponse } from "next/server";
import { db } from "@/lib/database";
import { z } from "zod";
import { withAuth, type AuthenticatedUser } from "@/lib/auth-middleware";
import { checkRateLimit, extractIP, rateLimitResponse } from "@/lib/rate-limit";

const acceptSchema = z.object({
    code: z.string().min(4).max(64),
});

export async function POST(request: Request) {
    return withAuth(async (authUser: AuthenticatedUser) => {
        try {
            const ip = extractIP(request);
            const rl = await checkRateLimit(`invite-accept:${authUser.id}:${ip}`, 'auth');
            if (!rl.success) return rateLimitResponse();

            const body = await request.json().catch(() => ({}));
            const parsed = acceptSchema.safeParse(body);
            if (!parsed.success) {
                return NextResponse.json({ error: "Código inválido" }, { status: 400 });
            }

            const { code } = parsed.data;

            const invitation = await db.invitation.findUnique({
                where: { code },
                include: { shop: { select: { id: true, name: true } } }
            });

            if (!invitation || invitation.isUsed) {
                return NextResponse.json({ error: "Código de invitación inválido" }, { status: 400 });
            }

            if (!invitation.expiresAt || invitation.expiresAt < new Date()) {
                return NextResponse.json({ error: "Invitación expirada" }, { status: 400 });
            }

            const existing = await db.membership.findFirst({
                where: { userId: authUser.id, shopId: invitation.shopId }
            });
            if (existing) {
                return NextResponse.json(
                    { error: "Ya perteneces a este negocio" },
                    { status: 409 }
                );
            }

            const result = await db.$transaction(async (tx) => {
                const claim = await tx.invitation.updateMany({
                    where: { id: invitation.id, isUsed: false },
                    data: { isUsed: true },
                });
                if (claim.count === 0) {
                    return null;
                }
                await tx.membership.create({
                    data: {
                        userId: authUser.id,
                        shopId: invitation.shopId,
                        role: invitation.role,
                    },
                });
                return invitation.shop.name;
            });

            if (!result) {
                return NextResponse.json({ error: "Código de invitación inválido" }, { status: 400 });
            }

            return NextResponse.json({ success: true, shopName: result });
        } catch (error: any) {
            console.error("Accept Invitation Error:", error);
            return NextResponse.json({ error: "Internal server error" }, { status: 500 });
        }
    }, request as any);
}
