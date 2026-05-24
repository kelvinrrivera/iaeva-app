import { NextResponse } from "next/server";
import { db } from "@/lib/database";
import { getProfileWithMembership } from "@/lib/auth-utils";
import { z } from "zod";

import { withAuth, type AuthenticatedUser } from "@/lib/auth-middleware";

export async function GET(request: Request) {
    return withAuth(async (authUser: AuthenticatedUser) => {
        try {
            const profile = await getProfileWithMembership();
            const membership = profile?.memberships[0];

            if (!membership || !["SUPER_ADMIN", "ORG_ADMIN"].includes(membership.role)) {
                return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
            }

            const members = await db.membership.findMany({
                where: { shopId: membership.shopId },
                include: {
                    user: true,
                    team: true
                },
                orderBy: {
                    role: 'asc'
                }
            });

            return NextResponse.json(members);
        } catch (error: any) {
            console.error("Fetch Team Error:", error);
            return NextResponse.json({ error: "Internal server error" }, { status: 500 });
        }
    }, request as any);
}

const addMemberSchema = z.object({
    name: z.string().min(2, "El nombre debe tener al menos 2 caracteres"),
    phone: z.string().min(8, "Numero de telefono invalido"),
    role: z.enum(["PROFESSIONAL", "TEAM_LEADER"]).default("PROFESSIONAL"),
});

/**
 * POST /api/team/members — Admin adds a team member directly by phone number.
 * Creates a User record (with temp ID) + Membership. When the member logs in
 * with Supabase OTP using this phone, /api/auth/profile syncs the ID.
 */
export async function POST(request: Request) {
    return withAuth(async (authUser: AuthenticatedUser) => {
        try {
            const profile = await getProfileWithMembership();
            const membership = profile?.memberships[0];

            if (!membership || !["SUPER_ADMIN", "ORG_ADMIN"].includes(membership.role)) {
                return NextResponse.json({ error: "No autorizado" }, { status: 401 });
            }

            const body = await request.json();
            const parsed = addMemberSchema.safeParse(body);
            if (!parsed.success) {
                return NextResponse.json(
                    { error: "Datos invalidos", details: parsed.error.flatten().fieldErrors },
                    { status: 400 }
                );
            }

            const { name, phone, role } = parsed.data;

            // Normalize phone to digits only (E.164 without +)
            const normalizedPhone = phone.replace(/\D/g, "");

            // Enforce plan limits
            const { canAddProfessional } = await import("@/lib/plan-enforcement");
            const limitCheck = await canAddProfessional(membership.shopId);
            if (!limitCheck.allowed) {
                return NextResponse.json({ error: limitCheck.reason }, { status: 403 });
            }

            // Check if user with this phone already exists
            let user = await db.user.findFirst({
                where: {
                    OR: [
                        { phoneNumber: normalizedPhone },
                        { phoneNumber: `+${normalizedPhone}` },
                        { phoneNumber: phone },
                    ]
                }
            });

            if (user) {
                // Check if they already belong to this shop
                const existingMembership = await db.membership.findFirst({
                    where: { userId: user.id, shopId: membership.shopId }
                });
                if (existingMembership) {
                    return NextResponse.json(
                        { error: "Este numero ya pertenece a tu equipo" },
                        { status: 409 }
                    );
                }
            } else {
                // Create user with temp ID — will be synced to Supabase UID on first login
                user = await db.user.create({
                    data: {
                        id: `pending_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`,
                        phoneNumber: normalizedPhone,
                        name,
                    }
                });
            }

            // Create membership
            const newMembership = await db.membership.create({
                data: {
                    userId: user.id,
                    shopId: membership.shopId,
                    role,
                },
                include: {
                    user: true,
                    team: true,
                }
            });

            // Also create a Stylist record so they appear in scheduling
            const existingStylist = await db.stylist.findFirst({
                where: { shopId: membership.shopId, userId: user.id }
            });
            if (!existingStylist) {
                await db.stylist.create({
                    data: {
                        name,
                        shopId: membership.shopId,
                        userId: user.id,
                    }
                });
            }

            return NextResponse.json(newMembership, { status: 201 });
        } catch (error: any) {
            console.error("Add Member Error:", error);
            return NextResponse.json(
                { error: error.message || "Error al añadir miembro" },
                { status: 500 }
            );
        }
    }, request as any);
}
