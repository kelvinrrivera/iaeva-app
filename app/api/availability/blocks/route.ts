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

            // 🔒 SECURITY: Verificar que el barbero pertenezca al shop del usuario
            const stylist = await db.stylist.findFirst({
                where: {
                    id: stylistId,
                    shopId
                }
            });

            if (!stylist) {
                return NextResponse.json({ error: "Stylist not found" }, { status: 404 });
            }

            const blocks = await db.timeBlock.findMany({
                where: { stylistId },
                orderBy: { startTime: "asc" }
            });

            return NextResponse.json(blocks);
        } catch (error) {
            return NextResponse.json({ error: "Failed to fetch time blocks" }, { status: 500 });
        }
    }, request as any);
}

export async function POST(request: Request) {
    return withAuth(async (authUser: AuthenticatedUser) => {
        try {
            const data = await request.json();

            const shopId = authUser.shopId;

            if (!shopId) {
                return NextResponse.json(
                    { error: "User has no shop assigned" },
                    { status: 403 }
                );
            }

            // 🔒 SECURITY: Verificar que el barbero pertenezca al shop del usuario
            const stylist = await db.stylist.findFirst({
                where: {
                    id: data.stylistId,
                    shopId
                }
            });

            if (!stylist) {
                return NextResponse.json({ error: "Stylist not found in your shop" }, { status: 404 });
            }

            const block = await db.timeBlock.create({
                data: {
                    name: data.name || data.reason || "Bloqueo Administrativo",
                    type: (data.type || "BREAK").toUpperCase(),
                    startTime: new Date(data.startTime),
                    endTime: new Date(data.endTime),
                    stylistId: data.stylistId
                }
            });

            return NextResponse.json(block);
        } catch (error: any) {
            console.error("Block Creation Failed:", error);
            return NextResponse.json({
                error: "Failed to create time block"
            }, { status: 500 });
        }
    }, request as any);
}

export async function DELETE(request: Request) {
    return withAuth(async (authUser: AuthenticatedUser) => {
        try {
            const { searchParams } = new URL(request.url);
            const id = searchParams.get("id");

            if (!id) return NextResponse.json({ error: "ID is required" }, { status: 400 });

            const shopId = authUser.shopId;

            if (!shopId) {
                return NextResponse.json(
                    { error: "User has no shop assigned" },
                    { status: 403 }
                );
            }

            // 🔒 SECURITY: Verificar que el block pertenezca a un barbero del shop
            const block = await db.timeBlock.findUnique({
                where: { id },
                include: {
                    stylist: true
                }
            });

            if (!block || block.stylist.shopId !== shopId) {
                return NextResponse.json({ error: "Time block not found" }, { status: 404 });
            }

            await db.timeBlock.delete({ where: { id } });
            return NextResponse.json({ success: true });
        } catch (error) {
            return NextResponse.json({ error: "Failed to delete time block" }, { status: 500 });
        }
    }, request as any);
}
