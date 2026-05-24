/**
 * Generate a one-time magic link for the shop owner so the admin can step
 * into their dashboard. Uses the Supabase Admin API.
 *
 * Always logs the impersonation. The owner can detect this in their account
 * activity later (Supabase records sign-ins).
 */

import { NextResponse, NextRequest } from 'next/server';
import { withOwnerAuth, isValidShopId, type AdminUser } from '@/lib/admin-auth';
import { db } from '@/lib/database';
import { logEvent } from '@/lib/system-log';
import { createClient } from '@supabase/supabase-js';
import { checkRateLimit, extractIP, rateLimitResponse } from '@/lib/rate-limit';

function getServiceClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!url || !key) throw new Error('Supabase service role env vars missing');
  return createClient(url, key, { auth: { persistSession: false } });
}

async function handler(admin: AdminUser, req: NextRequest) {
  // Strict rate limit: impersonation is a sensitive action. Cap to avoid abuse
  // if the admin session is ever compromised — attacker can't generate magic
  // links for every shop in seconds.
  const rl = await checkRateLimit(`admin-impersonate:${admin.id}`, 'api');
  if (!rl.success) return rateLimitResponse() as unknown as NextResponse;

  const segments = req.nextUrl.pathname.split('/');
  const shopId = segments[segments.indexOf('shops') + 1];
  if (!isValidShopId(shopId)) {
    return NextResponse.json({ error: 'Invalid shop id' }, { status: 400 });
  }

  const membership = await db.membership.findFirst({
    where: { shopId },
    include: { user: { select: { id: true, email: true } } },
    orderBy: { createdAt: 'asc' },
  });
  if (!membership?.user?.email) {
    return NextResponse.json({ error: 'No owner email found for this shop' }, { status: 404 });
  }

  const targetEmail = membership.user.email;

  try {
    const supabase = getServiceClient();
    const { data, error } = await supabase.auth.admin.generateLink({
      type: 'magiclink',
      email: targetEmail,
      options: {
        redirectTo: `${process.env.NEXT_PUBLIC_SITE_URL || 'https://domicitas.do'}/dashboard`,
      },
    });

    if (error || !data?.properties?.action_link) {
      console.error('[admin.impersonate] generateLink error:', error);
      return NextResponse.json({ error: 'Could not generate impersonation link' }, { status: 500 });
    }

    // CRITICAL audit trail — log as 'error' severity so it stands out and is
    // retained longest in cleanup. Includes IP/UA for forensic review.
    await logEvent({
      type: 'admin.shop.impersonated',
      severity: 'error',
      shopId,
      userId: admin.id,
      message: `🚨 IMPERSONATE: ${admin.email} entró como owner ${targetEmail}`,
      payload: {
        targetEmail,
        adminEmail: admin.email,
        ip: extractIP(req),
        userAgent: req.headers.get('user-agent') ?? null,
      },
    });

    return NextResponse.json({ magicLink: data.properties.action_link, targetEmail });
  } catch (err: any) {
    console.error('[admin.impersonate] error:', err);
    return NextResponse.json({ error: err?.message || 'Internal error' }, { status: 500 });
  }
}

export const POST = withOwnerAuth(handler);
