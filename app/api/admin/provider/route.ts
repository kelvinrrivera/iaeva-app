import { NextResponse } from "next/server";
import { db } from "@/lib/database";
import { withAuth, type AuthenticatedUser } from "@/lib/auth-middleware";
import { timingSafeEqual } from "crypto";

/**
 * Verify the caller has both SUPER_ADMIN role AND provides the
 * PLATFORM_ADMIN_SECRET env variable in the Authorization header.
 * This double-factor prevents a compromised SUPER_ADMIN account from
 * silently switching the provider for all shops.
 */
function verifyPlatformAdmin(authUser: AuthenticatedUser, request: Request): boolean {
  if (authUser.role !== "SUPER_ADMIN") return false;

  const platformSecret = process.env.PLATFORM_ADMIN_SECRET;
  if (!platformSecret) {
    // If env var is not set, the endpoint is effectively disabled for writes
    console.error("[Admin] PLATFORM_ADMIN_SECRET is not configured — POST blocked");
    return false;
  }

  const authHeader = request.headers.get("authorization") || "";
  const expected = `Bearer ${platformSecret}`;

  if (authHeader.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(authHeader), Buffer.from(expected));
}

/**
 * GET /api/admin/provider
 * Returns the current global WhatsApp provider.
 * Any authenticated user can read.
 */
export async function GET(request: Request) {
  return withAuth(async (authUser: AuthenticatedUser) => {
    const shop = await db.shop.findFirst({
      select: { whatsappProvider: true },
      orderBy: { createdAt: "asc" },
    });

    return NextResponse.json({
      provider: shop?.whatsappProvider || "TWILIO",
      isSuperAdmin: authUser.role === "SUPER_ADMIN",
    });
  }, request as any);
}

/**
 * POST /api/admin/provider
 * Switch ALL shops to a new WhatsApp provider.
 * Body: { provider: "META" | "TWILIO" }
 * Requires: SUPER_ADMIN role + PLATFORM_ADMIN_SECRET in Authorization header.
 */
export async function POST(request: Request) {
  return withAuth(async (authUser: AuthenticatedUser) => {
    if (!verifyPlatformAdmin(authUser, request)) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const body = await request.json().catch(() => ({}));
    const { provider } = body;

    if (!provider || !["META", "TWILIO"].includes(provider)) {
      return NextResponse.json(
        { error: "Invalid provider. Must be META or TWILIO." },
        { status: 400 }
      );
    }

    const result = await db.shop.updateMany({
      data: { whatsappProvider: provider },
    });

    console.log(`[Admin] WhatsApp provider switched to ${provider} for ${result.count} shops`);

    return NextResponse.json({
      success: true,
      provider,
      shopsUpdated: result.count,
    });
  }, request as any);
}
