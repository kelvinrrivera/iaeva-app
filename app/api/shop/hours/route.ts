import { NextResponse } from "next/server";
import { db } from "@/lib/database";
import { withAuth, type AuthenticatedUser } from "@/lib/auth-middleware";

export async function GET(request: Request) {
    return withAuth(async (authUser: AuthenticatedUser) => {
        try {
            const shopId = authUser.shopId;

            if (!shopId) {
                return NextResponse.json(
                    { error: "User has no shop assigned" },
                    { status: 403 }
                );
            }

            const shop = await db.shop.findFirst({
                where: { id: shopId },
                include: { hours: { orderBy: { dayOfWeek: "asc" } } }
            });

            if (!shop) {
                return NextResponse.json({ error: "Shop not found" }, { status: 404 });
            }

            return NextResponse.json(shop.hours);
        } catch (error) {
            console.error("Fetch Shop Hours Error:", error);
            return NextResponse.json({ error: "Failed to fetch shop hours" }, { status: 500 });
        }
    }, request as any);
}

export async function POST(request: Request) {
    return withAuth(async (authUser: AuthenticatedUser) => {
        try {
            const data = await request.json();
            const { schedules } = data;

            if (!authUser.shopId) {
                return NextResponse.json({ error: "Shop not found" }, { status: 404 });
            }

            const shopId = authUser.shopId;

            await db.$transaction(async (tx) => {
                // Remove existing
                await tx.shopAvailability.deleteMany({
                    where: { shopId }
                });

                // Add new active schedules
                const activeSchedules = schedules.filter((s: any) => s.active);
                if (activeSchedules.length > 0) {
                    await tx.shopAvailability.createMany({
                        data: activeSchedules.map((s: any) => ({
                            shopId,
                            dayOfWeek: s.dayOfWeek,
                            startTime: s.startTime,
                            endTime: s.endTime
                        }))
                    });
                }
            });

            return NextResponse.json({ success: true });
        } catch (error: any) {
            console.error("Save Shop Hours Error:", error);
            return NextResponse.json({
                error: "Failed to save shop hours",
            }, { status: 500 });
        }
    }, request as any);
}
