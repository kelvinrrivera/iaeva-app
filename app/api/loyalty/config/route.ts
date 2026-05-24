import { NextResponse } from "next/server";
import { db } from "@/lib/database";
import { withAuth, type AuthenticatedUser } from "@/lib/auth-middleware";

/**
 * GET /api/loyalty/config
 * Returns the loyalty program config for the authenticated shop.
 */
export async function GET(request: Request) {
  return withAuth(async (authUser: AuthenticatedUser) => {
    const shopId = authUser.shopId;
    if (!shopId) {
      return NextResponse.json({ error: "Shop not found" }, { status: 404 });
    }

    const config = await db.loyaltyConfig.findUnique({
      where: { shopId },
      include: { rewardService: { select: { id: true, name: true, price: true } } },
    });

    return NextResponse.json(
      config ?? { enabled: false, visitsRequired: 5, rewardLabel: "", rewardServiceId: null, countMembershipVisits: true }
    );
  }, request as any);
}

/**
 * POST /api/loyalty/config
 * Upserts loyalty program config for the authenticated shop.
 */
export async function POST(request: Request) {
  return withAuth(async (authUser: AuthenticatedUser) => {
    const shopId = authUser.shopId;
    if (!shopId) {
      return NextResponse.json({ error: "Shop not found" }, { status: 404 });
    }

    const body = await request.json();
    const { enabled, visitsRequired, rewardServiceId, countMembershipVisits } = body;

    if (typeof enabled !== "boolean") {
      return NextResponse.json({ error: "enabled is required (boolean)" }, { status: 400 });
    }
    if (visitsRequired !== undefined && (typeof visitsRequired !== "number" || visitsRequired < 2 || visitsRequired > 50)) {
      return NextResponse.json({ error: "visitsRequired must be between 2 and 50" }, { status: 400 });
    }
    if (countMembershipVisits !== undefined && typeof countMembershipVisits !== "boolean") {
      return NextResponse.json({ error: "countMembershipVisits must be boolean" }, { status: 400 });
    }

    // "ANY" = any service of client's choice; otherwise validate the specific service
    let rewardLabel = "";
    let resolvedServiceId: string | null = null;

    if (rewardServiceId === "ANY") {
      rewardLabel = "un servicio a su elección";
      resolvedServiceId = null; // No FK needed for "any"
    } else if (rewardServiceId) {
      const service = await db.service.findFirst({
        where: { id: rewardServiceId, shopId },
        select: { name: true },
      });
      if (!service) {
        return NextResponse.json({ error: "Reward service not found in this shop" }, { status: 400 });
      }
      rewardLabel = service.name;
      resolvedServiceId = rewardServiceId;
    }

    try {
      const config = await db.loyaltyConfig.upsert({
        where: { shopId },
        update: {
          enabled,
          ...(visitsRequired !== undefined && { visitsRequired }),
          rewardServiceId: resolvedServiceId,
          rewardLabel,
          ...(countMembershipVisits !== undefined && { countMembershipVisits }),
        },
        create: {
          shopId,
          enabled,
          visitsRequired: visitsRequired ?? 5,
          rewardServiceId: resolvedServiceId,
          rewardLabel,
          countMembershipVisits: countMembershipVisits ?? true,
        },
      });
      return NextResponse.json(config);
    } catch (err: any) {
      console.error('[loyalty/config POST] Prisma error:', err?.message, err?.code, JSON.stringify(err?.meta));
      return NextResponse.json({ error: err?.message || 'Database error' }, { status: 500 });
    }
  }, request as any);
}
