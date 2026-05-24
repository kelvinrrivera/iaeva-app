import { NextResponse } from "next/server";
import { withAuth, withAuthAndRole, type AuthenticatedUser } from "@/lib/auth-middleware";
import { db } from "@/lib/database";
import type { Role } from "@prisma/client";

/**
 * POST /api/chatbot/train
 * Train the chatbot AI with shop's knowledge base
 */
export async function POST(request: Request) {
    return withAuthAndRole(async (authUser: AuthenticatedUser) => {
        try {
            const shopId = authUser.shopId;

            if (!shopId) {
                return NextResponse.json(
                    { error: "Shop not found" },
                    { status: 404 }
                );
            }

            // Get shop's services and FAQs for training
            const [services, faqs] = await Promise.all([
                db.service.findMany({
                    where: {
                        shopId,
                        isActive: true
                    },
                    select: {
                        name: true,
                        description: true,
                        price: true,
                        duration: true
                    }
                }),
                db.fAQ.findMany({
                    where: { shopId }
                })
            ]);

            // The chatbot uses personality + FAQs saved via /api/chatbot/config,
            // injected into the system prompt on every conversation in real time.
            // No separate "training" step is needed — config is applied immediately.
            return NextResponse.json({
                success: true,
                message: "Tu configuración ya está activa. El chatbot usa tu personalidad y FAQs en tiempo real.",
                stats: {
                    servicesAvailable: services.length,
                    faqsConfigured: faqs.length,
                    updatedAt: new Date().toISOString()
                }
            });
        } catch (error) {
            console.error("Error training chatbot:", error);
            return NextResponse.json(
                { error: "Failed to train chatbot" },
                { status: 500 }
            );
        }
    }, request as any, ['ORG_ADMIN', 'TEAM_LEADER'] as Role[]);
}
