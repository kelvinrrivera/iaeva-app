import { NextResponse } from "next/server";
import { db } from "@/lib/database";
import { withAuth, type AuthenticatedUser } from "@/lib/auth-middleware";

export async function GET(request: Request) {
    return withAuth(async (authUser: AuthenticatedUser) => {
        try {
            const { searchParams } = new URL(request.url);
            const stylistId = searchParams.get("stylistId");

            if (!stylistId) {
                return NextResponse.json({ error: "stylistId is required" }, { status: 400 });
            }

            const shopId = authUser.shopId;

            if (!shopId) {
                return NextResponse.json(
                    { error: "User has no shop assigned" },
                    { status: 403 }
                );
            }

            // 🔒 SECURITY: Verificar que el barbero pertenezca al shop
            const stylist = await db.stylist.findFirst({
                where: {
                    id: stylistId,
                    shopId
                }
            });

            if (!stylist) {
                return NextResponse.json({ error: "Stylist not found" }, { status: 404 });
            }

            const settings = await db.availability.findMany({
                where: { stylistId },
                orderBy: { dayOfWeek: "asc" }
            });

            return NextResponse.json(settings);
        } catch (error) {
            console.error("Fetch Settings Error:", error);
            return NextResponse.json({ error: "Failed to fetch availability settings" }, { status: 500 });
        }
    }, request as any);
}

export async function POST(request: Request) {
    return withAuth(async (authUser: AuthenticatedUser) => {
        try {
            const data = await request.json();
            const { stylistId, schedules } = data;

            if (!stylistId) {
                return NextResponse.json({ error: "stylistId is required" }, { status: 400 });
            }

            const shopId = authUser.shopId;

            if (!shopId) {
                return NextResponse.json(
                    { error: "User has no shop assigned" },
                    { status: 403 }
                );
            }

            // 🔒 SECURITY: Verificar que el barbero pertenezca al shop
            const stylist = await db.stylist.findFirst({
                where: {
                    id: stylistId,
                    shopId
                }
            });

            if (!stylist) {
                return NextResponse.json({ error: "Stylist not found in your shop" }, { status: 404 });
            }

            // Transactions to clear and set new availability
            await db.$transaction(async (tx) => {
                await tx.availability.deleteMany({
                    where: { stylistId }
                });

                const activeSchedules = schedules.filter((s: any) => s.active);
                if (activeSchedules.length > 0) {
                    await tx.availability.createMany({
                        data: activeSchedules.map((s: any) => ({
                            stylistId,
                            dayOfWeek: s.dayOfWeek,
                            startTime: s.startTime,
                            endTime: s.endTime
                        }))
                    });
                }
            });

            return NextResponse.json({ success: true });
        } catch (error: any) {
            console.error("Save Settings Error:", error);
            return NextResponse.json({ error: "Failed to save availability settings" }, { status: 500 });
        }
    }, request as any);
}
