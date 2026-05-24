import { NextResponse } from "next/server";
import { db } from "@/lib/database";
import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { withAuth, type AuthenticatedUser } from "@/lib/auth-middleware";

export async function POST(request: Request) {
    return withAuth(async (authUser: AuthenticatedUser) => {
        try {
            const body = await request.json().catch(() => ({}));
            const { intent } = body;

            const cookieStore = await cookies();
            const supabase = createServerClient(
                process.env.NEXT_PUBLIC_SUPABASE_URL!,
                process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
                {
                    cookies: {
                        getAll() {
                            return cookieStore.getAll().map(({ name, value }) => ({ name, value }));
                        },
                        setAll(cookiesToSet) {
                            cookiesToSet.forEach(({ name, value, options }) =>
                                cookieStore.set(name, value, options)
                            );
                        },
                    },
                }
            );
            const { data: { user }, error: authError } = await supabase.auth.getUser();

            if (authError || !user) {
                return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
            }

            const phone = user.phone || null;
            const email = user.email || null;

            // First try to find user by Supabase ID
            let dbUser = await db.user.findUnique({
                where: { id: user.id },
                include: {
                    memberships: {
                        include: { shop: true, team: true }
                    }
                }
            });

            // If not found by ID, try by email or phone (for seeded users or existing records)
            if (!dbUser && email) {
                const userByEmail = await db.user.findUnique({
                    where: { email },
                    include: {
                        memberships: {
                            include: { shop: true, team: true }
                        }
                    }
                });
                if (userByEmail) {
                    dbUser = userByEmail;
                }
            }

            if (!dbUser && phone) {
                const userByPhone = await db.user.findUnique({
                    where: { phoneNumber: phone },
                    include: {
                        memberships: {
                            include: { shop: true, team: true }
                        }
                    }
                });
                if (userByPhone) {
                    dbUser = userByPhone;
                }
            }

            // If still not found, create new user
            if (!dbUser) {
                dbUser = await db.user.create({
                    data: {
                        id: user.id,
                        phoneNumber: phone,
                        email,
                        name: user.user_metadata?.full_name || user.user_metadata?.name || null,
                        avatarUrl: user.user_metadata?.avatar_url,
                    },
                    include: {
                        memberships: {
                            include: { shop: true, team: true }
                        }
                    }
                });
            } else {
                // Update existing user data.
                // Only migrate IDs that were generated as placeholders by admins
                // (prefix pending_ or temp_). Never overwrite a real Supabase UID.
                const isPlaceholderId = dbUser.id.startsWith('pending_') || dbUser.id.startsWith('temp_');
                const needsIdSync = dbUser.id !== user.id && isPlaceholderId;
                if (dbUser.id !== user.id && !isPlaceholderId) {
                    console.warn("[Profile API] ID mismatch but source is not a placeholder — skipping migration", { dbId: dbUser.id });
                }
                if (needsIdSync) {
                    console.log("[Profile API] Syncing placeholder DB ID to Supabase UID:", { old: dbUser.id, new: user.id });
                    // Update memberships to new ID first, then update user ID
                    await db.membership.updateMany({
                        where: { userId: dbUser.id },
                        data: { userId: user.id },
                    });
                    // Delete old user record and create with new ID
                    await db.user.delete({ where: { id: dbUser.id } });
                    dbUser = await db.user.create({
                        data: {
                            id: user.id,
                            phoneNumber: dbUser.phoneNumber,
                            email: user.email || dbUser.email || null,
                            name: user.user_metadata?.full_name || user.user_metadata?.name || dbUser.name,
                            avatarUrl: user.user_metadata?.avatar_url || dbUser.avatarUrl,
                        },
                        include: {
                            memberships: {
                                include: { shop: true, team: true }
                            }
                        }
                    });
                } else {
                    dbUser = await db.user.update({
                        where: { id: dbUser.id },
                        data: {
                            name: user.user_metadata?.full_name || user.user_metadata?.name || dbUser.name,
                            avatarUrl: user.user_metadata?.avatar_url || dbUser.avatarUrl,
                        },
                        include: {
                            memberships: {
                                include: { shop: true, team: true }
                            }
                        }
                    });
                }
            }

            if (dbUser.memberships.length === 0 && intent === "CREATE") {
                const shopName = `${dbUser.name}'s Shop`;
                // Every new shop starts with a 14-day full-featured trial on
                // the TEAM plan. No credit card required. After the trial they
                // must subscribe via Stripe or the account is suspended.
                const trialMs = 14 * 24 * 60 * 60 * 1000;
                const shop = await db.shop.create({
                    data: {
                        name: shopName,
                        plan: "TEAM",
                        subscriptionStatus: "trialing",
                        trialEnd: new Date(Date.now() + trialMs),
                    }
                });

                await db.membership.create({
                    data: {
                        userId: dbUser.id,
                        shopId: shop.id,
                        role: "ORG_ADMIN"
                    }
                });

                await db.stylist.create({
                    data: {
                        name: dbUser.name || "Owner",
                        email: dbUser.email || null,
                        shopId: shop.id,
                        userId: dbUser.id
                    }
                });

                // Founder program: first N signups get a 50% lifetime discount
                // applied to whichever paid plan they choose after trial. Atomic
                // — won't grant beyond the cap even if two signups race.
                const { assignFounderIfAvailable } = await import('@/lib/founder-program');
                await assignFounderIfAvailable(shop.id).catch(err => {
                    console.error('[auth/profile] founder assignment failed:', err);
                });
            }

            return NextResponse.json({
                ...dbUser,
                needsOnboarding: dbUser.memberships.length === 0
            });
        } catch (error: any) {
            console.error("Profile Sync Error:", error);
            return NextResponse.json({ error: "Internal server error", details: error.message }, { status: 500 });
        }
    }, request as any);
}
