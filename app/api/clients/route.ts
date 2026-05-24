import { NextResponse } from "next/server";
import { db } from "@/lib/database";
import { withAuth, withAuthAndRole, type AuthenticatedUser } from "@/lib/auth-middleware";
import { validateCreateClient, validateClientQuery } from "@/lib/validations";
import type { Role } from "@prisma/client";

/**
 * GET /api/clients
 * Get all clients for the authenticated user's shop
 */
export async function GET(request: Request) {
    return withAuth(async (authUser: AuthenticatedUser) => {
        try {
            const { searchParams } = new URL(request.url);
            const queryParams = Object.fromEntries(searchParams);

            // Validate query params
            const queryValidation = validateClientQuery(queryParams);
            if (!queryValidation.success) {
                return NextResponse.json(
                    {
                        error: "Invalid query parameters",
                        details: queryValidation.error.issues
                    },
                    { status: 400 }
                );
            }

            const shopId = authUser.shopId; // 🔒 SECURITY: Filter by user's shop

            if (!shopId) {
                return NextResponse.json(
                    { error: "User has no shop assigned" },
                    { status: 403 }
                );
            }

            // Build where clause
            const where: any = {
                shopId, // 🔒 SECURITY: Filter by user's shop
            };

            if (queryValidation.data.search) {
                where.OR = [
                    { name: { contains: queryValidation.data.search, mode: 'insensitive' } },
                    { phoneNumber: { contains: queryValidation.data.search } },
                ];
            }

            if (queryValidation.data.isActive !== undefined) {
                where.isActive = queryValidation.data.isActive;
            }

            const [clients, loyaltyConfig, shop] = await Promise.all([
                db.client.findMany({
                    where,
                    include: {
                        appointments: {
                            where: { shopId },
                            orderBy: { startTime: "desc" },
                            take: 1,
                            include: { service: true }
                        }
                    },
                    orderBy: queryValidation.data.sortBy
                        ? { [queryValidation.data.sortBy]: queryValidation.data.sortOrder || 'asc' }
                        : { name: "asc" },
                    take: queryValidation.data.limit || 50,
                    skip: queryValidation.data.page ? (queryValidation.data.page - 1) * (queryValidation.data.limit || 50) : 0,
                }),
                db.loyaltyConfig.findUnique({ where: { shopId } }),
                db.shop.findUnique({ where: { id: shopId }, select: { plan: true } }),
            ]);

            // Loyalty is only active for TEAM+ plans with config enabled
            const loyaltyActive =
                loyaltyConfig?.enabled === true &&
                ['TEAM', 'BUSINESS', 'ENTERPRISE'].includes(shop?.plan || '');

            // Map to include totalSpent, lastVisit, loyalty progress, and reactivation segment
            const now = Date.now();
            const mappedClients = clients.map(client => {
                const lastApt = client.appointments[0];
                const loyaltyProgress = loyaltyActive && loyaltyConfig
                    ? {
                        visitCount: client.visitCount,
                        visitsRequired: loyaltyConfig.visitsRequired,
                        rewardLabel: loyaltyConfig.rewardLabel,
                        progressPct: Math.min(100, Math.round(
                            ((client.visitCount % loyaltyConfig.visitsRequired) / loyaltyConfig.visitsRequired) * 100
                        )),
                        cyclesCompleted: Math.floor(client.visitCount / loyaltyConfig.visitsRequired),
                    }
                    : null;

                const daysSinceLastVisit = lastApt
                    ? Math.floor((now - new Date(lastApt.startTime).getTime()) / 86_400_000)
                    : null;

                // active ≤30d | at_risk 31–60d | lost >60d | new = no visit ever
                const segment: 'active' | 'at_risk' | 'lost' | 'new' =
                    daysSinceLastVisit === null ? 'new'
                    : daysSinceLastVisit <= 30  ? 'active'
                    : daysSinceLastVisit <= 60  ? 'at_risk'
                    : 'lost';

                return {
                    id: client.id,
                    name: client.name || "Sin nombre",
                    phoneNumber: client.phoneNumber,
                    email: client.email,
                    lastVisit: lastApt ? lastApt.startTime : null,
                    daysSinceLastVisit,
                    segment,
                    reactivationSentAt: (client as any).reactivationSentAt ?? null,
                    totalSpent: 0,
                    isActive: client.isActive,
                    loyaltyProgress,
                };
            });

            return NextResponse.json({ clients: mappedClients, loyaltyActive });
        } catch (error) {
            console.error('Error fetching clients:', error);
            return NextResponse.json(
                { error: "Failed to fetch clients" },
                { status: 500 }
            );
        }
    }, request as any);
}

/**
 * POST /api/clients
 * Create a new client for the authenticated user's shop
 * Requires: ORG_ADMIN or TEAM_LEADER role
 */
export async function POST(request: Request) {
    return withAuthAndRole(async (authUser: AuthenticatedUser) => {
        try {
            const body = await request.json();

            // ✅ Validate input with Zod
            const validation = validateCreateClient(body);
            if (!validation.success) {
                return NextResponse.json(
                    {
                        error: "Validation failed",
                        details: validation.error.issues
                    },
                    { status: 400 }
                );
            }

            const clientData = validation.data;
            const shopId = authUser.shopId; // 🔒 SECURITY: User's shop ID

            if (!shopId) {
                return NextResponse.json(
                    { error: "User has no shop assigned" },
                    { status: 403 }
                );
            }

            // Check if client already exists
            const existingClient = await db.client.findFirst({
                where: {
                    phoneNumber: clientData.phoneNumber,
                    shopId,
                }
            });

            if (existingClient) {
                return NextResponse.json(
                    {
                        error: "Client already exists",
                        client: existingClient
                    },
                    { status: 409 }
                );
            }

            // Create client for the user's shop
            const client = await db.client.create({
                data: {
                    name: clientData.name,
                    phoneNumber: clientData.phoneNumber,
                    email: clientData.email,
                    notes: clientData.notes,
                    preferredContact: clientData.preferredContact,
                    shopId, // 🔒 SECURITY: Assign to user's shop
                }
            });

            return NextResponse.json(client, { status: 201 });
        } catch (error) {
            console.error('Error creating client:', error);
            return NextResponse.json(
                { error: "Failed to create client" },
                { status: 500 }
            );
        }
    }, request as any, ['ORG_ADMIN', 'TEAM_LEADER'] as Role[]);
}
