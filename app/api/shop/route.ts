import { NextResponse } from "next/server";
import { db } from "@/lib/database";
import { withAuth, withAuthAndRole, type AuthenticatedUser } from "@/lib/auth-middleware";
import type { Role } from "@prisma/client";

/**
 * GET /api/shop
 * Get the authenticated user's shop information
 */
export async function GET(request: Request) {
    return withAuth(async (authUser: AuthenticatedUser) => {
        try {
            const shopId = authUser.shopId; // 🔒 SECURITY: User's shop ID

            if (!shopId) {
                return NextResponse.json(
                    { error: "User has no shop assigned" },
                    { status: 403 }
                );
            }

            const shop = await db.shop.findUnique({
                where: { id: shopId }, // 🔒 SECURITY: Only user's shop
                include: {
                    services: {
                        orderBy: { createdAt: "asc" }
                    },
                    stylists: {
                        orderBy: { createdAt: "asc" }
                    },
                }
            });

            if (!shop) {
                return NextResponse.json(
                    { error: "Shop not found" },
                    { status: 404 }
                );
            }

            return NextResponse.json(shop);
        } catch (error) {
            console.error("Fetch Shop Error:", error);
            return NextResponse.json(
                { error: "Failed to fetch shop settings" },
                { status: 500 }
            );
        }
    }, request as any);
}

/**
 * PUT /api/shop
 * Update the authenticated user's shop information
 * Requires: ORG_ADMIN role
 * Security: Only ORG_ADMIN can update shop settings
 */
export async function PUT(request: Request) {
    return withAuthAndRole(async (authUser: AuthenticatedUser) => {
        try {
            const shopId = authUser.shopId; // 🔒 SECURITY: User's shop ID

            if (!shopId) {
                return NextResponse.json(
                    { error: "User has no shop assigned" },
                    { status: 403 }
                );
            }

            const data = await request.json();

            const updatedShop = await db.shop.update({
                where: { id: shopId }, // 🔒 SECURITY: Only user's shop
                data: {
                    ...(data.name !== undefined && { name: data.name }),
                    ...(data.address !== undefined && { address: data.address }),
                    ...(data.latitude !== undefined && { latitude: data.latitude }),
                    ...(data.longitude !== undefined && { longitude: data.longitude }),
                    ...(data.placeId !== undefined && { placeId: data.placeId }),
                    ...(data.phoneNumber !== undefined && { phoneNumber: data.phoneNumber }),
                    ...(data.whatsappNumber !== undefined && { whatsappNumber: data.whatsappNumber }),
                    ...(data.shopType !== undefined && { shopType: data.shopType }),
                    ...(data.whatsappEnabled !== undefined && { whatsappEnabled: data.whatsappEnabled }),
                    ...(data.whatsappPhoneNumber !== undefined && { whatsappPhoneNumber: data.whatsappPhoneNumber }),
                    ...(data.logoUrl !== undefined && { logoUrl: data.logoUrl }),
                    ...(data.ownerNotificationPhone !== undefined && { ownerNotificationPhone: data.ownerNotificationPhone || null }),
                }
            });

            return NextResponse.json(updatedShop);
        } catch (error) {
            console.error("Update Shop Error:", error);
            return NextResponse.json(
                { error: "Failed to update shop" },
                { status: 500 }
            );
        }
    }, request as any, ['SUPER_ADMIN', 'ORG_ADMIN'] as Role[]);
}
