import { NextResponse } from "next/server";
import { randomBytes } from "crypto";
import { z } from "zod";
import { db } from "@/lib/database";
import { getProfileWithMembership } from "@/lib/auth-utils";
import { withAuth, type AuthenticatedUser } from "@/lib/auth-middleware";
import { sendInvitationEmail } from "@/lib/email";

const invitationSchema = z.object({
    role: z.enum(["PROFESSIONAL", "ORG_ADMIN"]).optional().default("PROFESSIONAL"),
    email: z.string().email().max(255).optional().nullable(),
});

const INVITATION_TTL_HOURS = 72;

export async function GET(request: Request) {
    return withAuth(async (_authUser: AuthenticatedUser) => {
        try {
            const profile = await getProfileWithMembership();
            const membership = profile?.memberships[0];

            if (!membership || !["SUPER_ADMIN", "ORG_ADMIN"].includes(membership.role)) {
                return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
            }

            const invitations = await db.invitation.findMany({
                where: {
                    shopId: membership.shopId,
                    isUsed: false,
                    expiresAt: { gt: new Date() },
                },
                orderBy: { createdAt: "desc" },
            });

            return NextResponse.json(invitations);
        } catch (error: any) {
            console.error("List Invitations Error:", error);
            return NextResponse.json({ error: "Failed to list invitations" }, { status: 500 });
        }
    }, request as any);
}

/**
 * POST /api/team/invitations — Create a new invitation code.
 * ORG_ADMIN or SUPER_ADMIN only.
 */
export async function POST(request: Request) {
    return withAuth(async (_authUser: AuthenticatedUser) => {
        try {
            const profile = await getProfileWithMembership();
            const membership = profile?.memberships[0];

            if (!membership || !["SUPER_ADMIN", "ORG_ADMIN"].includes(membership.role)) {
                return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
            }

            const body = await request.json().catch(() => ({}));
            const parsed = invitationSchema.safeParse(body);

            if (!parsed.success) {
                return NextResponse.json(
                    { error: "Invalid input", details: parsed.error.flatten().fieldErrors },
                    { status: 400 }
                );
            }

            const { role, email } = parsed.data;

            const { canAddProfessional } = await import('@/lib/plan-enforcement');
            const limitCheck = await canAddProfessional(membership.shopId);
            if (!limitCheck.allowed) {
                return NextResponse.json({ error: limitCheck.reason }, { status: 403 });
            }

            const code = "BIA-" + randomBytes(4).toString('hex').toUpperCase();
            const expiresAt = new Date(Date.now() + INVITATION_TTL_HOURS * 60 * 60 * 1000);

            const invitation = await db.invitation.create({
                data: {
                    code,
                    shopId: membership.shopId,
                    role,
                    email: email || null,
                    expiresAt,
                }
            });

            // Fire-and-forget: send invitation email if an address was provided
            if (invitation.email) {
                const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? 'https://domicita.com';
                const inviteLink = `${appUrl}/invitacion?code=${invitation.code}`;
                const shopName = (membership as any).shop?.name ?? 'tu negocio';
                sendInvitationEmail({
                    to: invitation.email,
                    inviteLink,
                    shopName,
                    role: invitation.role,
                }).catch((err) => console.error('[invitations] Email send error:', err));
            }

            return NextResponse.json(invitation, { status: 201 });
        } catch (error: any) {
            console.error("Create Invitation Error:", error);
            return NextResponse.json({ error: "Failed to create invitation" }, { status: 500 });
        }
    }, request as any);
}
