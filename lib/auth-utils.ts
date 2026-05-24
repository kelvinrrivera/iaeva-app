import { createServerClient } from "@supabase/ssr";
import { cookies } from "next/headers";
import { db } from "./database";

export async function getCurrentUser() {
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
    const { data: { user } } = await supabase.auth.getUser();
    return user;
}

export async function getProfileWithMembership() {
    const user = await getCurrentUser();
    if (!user) {
        console.log("[Auth-Utils] No user found in Supabase auth");
        return null;
    }

    console.log("[Auth-Utils] Current Supabase user:", { id: user.id, email: user.email });

    if (!db.user) {
        console.error("[Auth-Utils] DB 'user' model is missing at runtime. Keys:", Object.keys(db));
        throw new Error("Base de datos no disponible. Por favor, reinicia el servidor de desarrollo.");
    }

    const profile = await db.user.findUnique({
        where: { id: user.id },
        include: {
            memberships: {
                include: {
                    shop: true,
                    team: true
                }
            }
        }
    });

    if (!profile) {
        console.log("[Auth-Utils] User not found in DB by ID, trying email lookup for:", user.email);
        // Try to find by email instead
        const profileByEmail = await db.user.findUnique({
            where: { email: user.email },
            include: {
                memberships: {
                    include: {
                        shop: true,
                        team: true
                    }
                }
            }
        });
        if (profileByEmail) {
            console.warn("[Auth-Utils] ID mismatch — found user via email fallback");
            console.log("[Auth-Utils] Found user:", {
                id: profileByEmail.id,
                email: profileByEmail.email,
                membershipsCount: profileByEmail.memberships?.length,
                memberships: profileByEmail.memberships?.map(m => ({ role: m.role, shopId: m.shopId, shopPlan: m.shop?.plan }))
            });
        } else {
            console.error("[Auth-Utils] User NOT found by email either:", user.email);
        }
        return profileByEmail;
    }

    console.log("[Auth-Utils] Found user by ID:", {
        id: profile.id,
        email: profile.email,
        membershipsCount: profile.memberships?.length
    });

    return profile;
}

export async function getActiveRole(shopId?: string) {
    const profile = await getProfileWithMembership();
    if (!profile) return null;

    // If super admin, they have it globally
    const isSuper = profile.memberships.find(m => m.role === "SUPER_ADMIN");
    if (isSuper) return "SUPER_ADMIN";

    // Otherwise, check for specific shop or first membership
    const membership = shopId
        ? profile.memberships.find(m => m.shopId === shopId)
        : profile.memberships[0];

    return membership?.role || null;
}
