import { NextResponse } from "next/server";
import { db } from "@/lib/database";
import { withAuth, type AuthenticatedUser } from "@/lib/auth-middleware";
import { getDefaultJerga } from "@/lib/whatsapp/jerga-defaults";

/**
 * GET /api/chatbot/config
 * Get chatbot configuration for the user's shop
 */
export async function GET(request: Request) {
    return withAuth(async (authUser: AuthenticatedUser) => {
        try {
            const shopId = authUser.shopId;
            if (!shopId) {
                return NextResponse.json(
                    { error: "Shop not found" },
                    { status: 404 }
                );
            }

            const [faqs, shop] = await Promise.all([
                db.fAQ.findMany({
                    where: { shopId },
                    orderBy: { createdAt: 'asc' }
                }),
                db.shop.findUnique({
                    where: { id: shopId },
                    select: { chatbotPersonality: true, chatbotJerga: true, chatbotModelId: true, country: true }
                })
            ]);

            const defaultJerga = getDefaultJerga(shop?.country);

            return NextResponse.json({
                personality: shop?.chatbotPersonality || "",
                jerga: shop?.chatbotJerga || defaultJerga,
                chatbotModelId: shop?.chatbotModelId || null,
                defaultJerga,
                country: shop?.country || "DO",
                faqs: (faqs || []).map(f => ({ q: f.question, a: f.answer }))
            });
        } catch (error) {
            console.error("Error fetching chatbot config:", error);
            return NextResponse.json(
                { error: "Failed to fetch configuration" },
                { status: 500 }
            );
        }
    }, request as any);
}

/**
 * POST /api/chatbot/config
 * Save chatbot configuration
 */
export async function POST(request: Request) {
    return withAuth(async (authUser: AuthenticatedUser) => {
        try {
            const { faqs, personality, jerga, chatbotModelId } = await request.json();
            const shopId = authUser.shopId;

            if (!shopId) {
                return NextResponse.json(
                    { error: "Shop not found" },
                    { status: 404 }
                );
            }

            // Save personality, jerga and FAQs in parallel
            await Promise.all([
                db.shop.update({
                    where: { id: shopId },
                    data: {
                        chatbotPersonality: personality || null,
                        chatbotJerga: jerga || null,
                        ...(chatbotModelId !== undefined && { chatbotModelId: chatbotModelId || null }),
                    }
                }),
                db.fAQ.deleteMany({ where: { shopId } }).then(() => {
                    if (faqs && Array.isArray(faqs) && faqs.length > 0) {
                        return db.fAQ.createMany({
                            data: faqs.map((faq: any) => ({
                                shopId,
                                question: faq.q,
                                answer: faq.a
                            }))
                        });
                    }
                })
            ]);

            return NextResponse.json({ success: true });
        } catch (error) {
            console.error("Error saving chatbot config:", error);
            return NextResponse.json(
                { error: "Failed to save configuration" },
                { status: 500 }
            );
        }
    }, request as any);
}
