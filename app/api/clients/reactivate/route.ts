import { NextResponse } from "next/server";
import { db } from "@/lib/database";
import { withAuth, type AuthenticatedUser } from "@/lib/auth-middleware";
import { sendTemplateByPurpose, sanitizeUserText } from "@/lib/whatsapp/sender";

/**
 * POST /api/clients/reactivate
 * Body: { clientIds: string[] }   — one or many
 *
 * Sends reactivation WhatsApp message to each client.
 * Uses approved template if available, falls back to plain text.
 * Records reactivationSentAt so we don't spam.
 */
export async function POST(request: Request) {
    return withAuth(async (authUser: AuthenticatedUser) => {
        const shopId = authUser.shopId;
        if (!shopId) {
            return NextResponse.json({ error: "Shop not found" }, { status: 404 });
        }

        const body = await request.json();
        const { clientIds } = body;

        if (!Array.isArray(clientIds) || clientIds.length === 0) {
            return NextResponse.json({ error: "clientIds array required" }, { status: 400 });
        }

        const shop = await db.shop.findUnique({
            where: { id: shopId },
            select: { name: true, whatsappEnabled: true },
        });

        if (!shop?.whatsappEnabled) {
            return NextResponse.json(
                { error: "WhatsApp no está conectado en este negocio." },
                { status: 400 }
            );
        }

        const clients = await db.client.findMany({
            where: { id: { in: clientIds }, shopId },
            select: { id: true, name: true, phoneNumber: true },
        });

        if (clients.length === 0) {
            return NextResponse.json({ error: "No se encontraron clientes válidos" }, { status: 404 });
        }

        const results = await Promise.allSettled(
            clients.map(async (client) => {
                const clientName = sanitizeUserText(client.name, 80) || "cliente";
                const safeShopName = sanitizeUserText(shop.name, 120);

                const result = await sendTemplateByPurpose({
                    shopId,
                    to: client.phoneNumber,
                    purpose: 'reactivation',
                    variables: { '1': clientName },
                    fallbackText: `Hola ${clientName}! Hace tiempo que no te vemos por *${safeShopName}*. Esta semana tenemos disponibilidad. Te agendamos algo?`,
                });

                if (result.success) {
                    await db.client.update({
                        where: { id: client.id },
                        data: { reactivationSentAt: new Date() },
                    });
                }

                return { clientId: client.id, success: result.success, error: result.error };
            })
        );

        const sent = results.filter(r => r.status === "fulfilled" && (r.value as any).success).length;
        const failed = clients.length - sent;

        return NextResponse.json({ sent, failed, total: clients.length });
    }, request as any);
}
