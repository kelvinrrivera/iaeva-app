import { NextResponse } from "next/server";
import { db } from "@/lib/database";
import { withAuth, type AuthenticatedUser } from "@/lib/auth-middleware";

export async function GET(request: Request) {
    return withAuth(async (authUser: AuthenticatedUser) => {
        try {
            const shopId = authUser.shopId;

            if (!shopId) {
                return NextResponse.json(
                    { error: "No shop found for user" },
                    { status: 404 }
                );
            }

            const now = new Date();
            const upcoming = await db.appointment.findMany({
                where: {
                    shopId,
                    startTime: {
                        gte: now
                    }
                },
                include: {
                    service: true,
                    client: true
                },
                orderBy: {
                    startTime: "asc"
                },
                take: 10
            });

            return NextResponse.json(upcoming);
        } catch (error) {
            return NextResponse.json({ error: "Failed to fetch upcoming appointments" }, { status: 500 });
        }
    }, request as any);
}
