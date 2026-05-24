import { NextResponse } from "next/server";
import { db } from "@/lib/database";
import { withAuth, type AuthenticatedUser } from "@/lib/auth-middleware";

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
    return withAuth(async (authUser: AuthenticatedUser) => {
        try {
            const { id } = await params;
            const { role, teamId } = await request.json();

            if (!authUser.shopId) {
                return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
            }

            const updated = await db.membership.update({
                where: { id },
                data: {
                    role: role,
                    teamId: teamId || null
                }
            });

            return NextResponse.json(updated);
        } catch (error: any) {
            console.error("Update Member Error:", error);
            return NextResponse.json({ error: "Internal server error" }, { status: 500 });
        }
    }, request as any);
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
    return withAuth(async (authUser: AuthenticatedUser) => {
        try {
            const { id } = await params;

            if (!authUser.shopId) {
                return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
            }

            await db.membership.delete({
                where: { id }
            });

            return NextResponse.json({ success: true });
        } catch (error: any) {
            console.error("Delete Member Error:", error);
            return NextResponse.json({ error: "Internal server error" }, { status: 500 });
        }
    }, request as any);
}
