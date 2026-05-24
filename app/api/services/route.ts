import { NextResponse } from "next/server";
import { db } from "@/lib/database";
import { withAuth, withAuthAndRole, type AuthenticatedUser } from "@/lib/auth-middleware";
import { validateCreateService, validateUpdateService, validateServiceQuery } from "@/lib/validations";
import type { Role } from "@prisma/client";

/**
 * GET /api/services
 * Get all services for the authenticated user's shop
 */
export async function GET(request: Request) {
    return withAuth(async (authUser: AuthenticatedUser) => {
        try {
            const { searchParams } = new URL(request.url);
            const queryParams = Object.fromEntries(searchParams);

            // Validate query params
            const queryValidation = validateServiceQuery(queryParams);
            if (!queryValidation.success) {
                return NextResponse.json(
                    {
                        error: "Invalid query parameters",
                        details: queryValidation.error.issues
                    },
                    { status: 400 }
                );
            }

            const shopId = authUser.shopId; // 🔒 SECURITY: User's shop ID

            if (!shopId) {
                return NextResponse.json(
                    { error: "User has no shop assigned" },
                    { status: 403 }
                );
            }

            // Build where clause
            const where: any = {
                shopId, // 🔒 SECURITY: Only services from user's shop
            };

            if (queryValidation.data.serviceType) {
                where.serviceType = queryValidation.data.serviceType;
            }

            if (queryValidation.data.isActive !== undefined) {
                where.isActive = queryValidation.data.isActive;
            }

            if (queryValidation.data.isBookable !== undefined) {
                where.isBookable = queryValidation.data.isBookable;
            }

            if (queryValidation.data.search) {
                where.name = { contains: queryValidation.data.search, mode: 'insensitive' };
            }

            const services = await db.service.findMany({
                where,
                orderBy: queryValidation.data.sortBy
                    ? { [queryValidation.data.sortBy]: queryValidation.data.sortOrder || 'asc' }
                    : { createdAt: "asc" },
                take: queryValidation.data.limit || 50,
                skip: queryValidation.data.page ? (queryValidation.data.page - 1) * (queryValidation.data.limit || 50) : 0,
            });

            return NextResponse.json(services);
        } catch (error: any) {
            console.error("DEBUG: Fetch Services Failed:", error);
            return NextResponse.json(
                { error: "Failed to fetch services" },
                { status: 500 }
            );
        }
    }, request as any);
}

/**
 * POST /api/services
 * Create a new service for the authenticated user's shop
 * Requires: ORG_ADMIN or TEAM_LEADER role
 */
export async function POST(request: Request) {
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

            // ✅ Validate input with Zod
            const validation = validateCreateService(data);
            if (!validation.success) {
                return NextResponse.json(
                    {
                        error: "Validation failed",
                        details: validation.error.issues
                    },
                    { status: 400 }
                );
            }

            const serviceData = validation.data;

            const service = await db.service.create({
                data: {
                    name: serviceData.name,
                    description: serviceData.description,
                    price: serviceData.price,
                    duration: serviceData.duration,
                    bufferTime: serviceData.bufferTime || 0,
                    shopId, // 🔒 SECURITY: Assign to user's shop
                    serviceType: serviceData.serviceType,
                    isActive: serviceData.isActive !== undefined ? serviceData.isActive : true,
                    isBookable: serviceData.isBookable !== undefined ? serviceData.isBookable : true,
                }
            });

            return NextResponse.json(service, { status: 201 });
        } catch (error: any) {
            console.error("Create Service Error:", error);
            return NextResponse.json(
                { error: "Failed to create service" },
                { status: 500 }
            );
        }
    }, request as any, ['ORG_ADMIN', 'TEAM_LEADER'] as Role[]);
}

/**
 * PUT /api/services
 * Update a service
 * Requires: ORG_ADMIN or TEAM_LEADER role
 * Security: Only services from user's shop can be updated
 */
export async function PUT(request: Request) {
    return withAuthAndRole(async (authUser: AuthenticatedUser) => {
        try {
            const { searchParams } = new URL(request.url);
            const id = searchParams.get("id");

            if (!id) {
                return NextResponse.json(
                    { error: "Service ID is required" },
                    { status: 400 }
                );
            }

            const shopId = authUser.shopId; // 🔒 SECURITY: User's shop ID

            if (!shopId) {
                return NextResponse.json(
                    { error: "User has no shop assigned" },
                    { status: 403 }
                );
            }

            // Verify service belongs to user's shop
            const existingService = await db.service.findFirst({
                where: {
                    id,
                    shopId, // 🔒 SECURITY: Must belong to user's shop
                }
            });

            if (!existingService) {
                return NextResponse.json(
                    { error: "Service not found" },
                    { status: 404 }
                );
            }

            const data = await request.json();

            // ✅ Validate input with Zod
            const validation = validateUpdateService(data);
            if (!validation.success) {
                return NextResponse.json(
                    {
                        error: "Validation failed",
                        details: validation.error.issues
                    },
                    { status: 400 }
                );
            }

            const updateData = validation.data;

            const service = await db.service.update({
                where: { id },
                data: {
                    ...(updateData.name !== undefined && { name: updateData.name }),
                    ...(updateData.description !== undefined && { description: updateData.description }),
                    ...(updateData.price !== undefined && { price: updateData.price }),
                    ...(updateData.duration !== undefined && { duration: updateData.duration }),
                    ...(updateData.bufferTime !== undefined && { bufferTime: updateData.bufferTime }),
                    ...(updateData.serviceType !== undefined && { serviceType: updateData.serviceType }),
                    ...(updateData.isActive !== undefined && { isActive: updateData.isActive }),
                    ...(updateData.isBookable !== undefined && { isBookable: updateData.isBookable }),
                }
            });

            return NextResponse.json(service);
        } catch (error: any) {
            console.error("Update Service Error:", error);
            return NextResponse.json(
                { error: "Failed to update service" },
                { status: 500 }
            );
        }
    }, request as any, ['ORG_ADMIN', 'TEAM_LEADER'] as Role[]);
}

/**
 * DELETE /api/services
 * Delete a service
 * Requires: ORG_ADMIN or TEAM_LEADER role
 * Security: Only services from user's shop can be deleted
 */
export async function DELETE(request: Request) {
    return withAuthAndRole(async (authUser: AuthenticatedUser) => {
        try {
            const { searchParams } = new URL(request.url);
            const id = searchParams.get("id");

            if (!id) {
                return NextResponse.json(
                    { error: "Service ID is required" },
                    { status: 400 }
                );
            }

            const shopId = authUser.shopId; // 🔒 SECURITY: User's shop ID

            if (!shopId) {
                return NextResponse.json(
                    { error: "User has no shop assigned" },
                    { status: 403 }
                );
            }

            // Verify service belongs to user's shop
            const existingService = await db.service.findFirst({
                where: {
                    id,
                    shopId, // 🔒 SECURITY: Must belong to user's shop
                }
            });

            if (!existingService) {
                return NextResponse.json(
                    { error: "Service not found" },
                    { status: 404 }
                );
            }

            await db.service.delete({ where: { id } });

            return NextResponse.json({ success: true });
        } catch (error: any) {
            console.error("Delete Service Error:", error);
            return NextResponse.json(
                { error: "Failed to delete service" },
                { status: 500 }
            );
        }
    }, request as any, ['ORG_ADMIN', 'TEAM_LEADER'] as Role[]);
}
