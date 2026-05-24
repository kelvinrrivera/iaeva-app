/**
 * POST /api/admin/crons/run
 * Body: { path: '/api/cron/<known-name>' }
 *
 * Invokes a known cron internally with the CRON_SECRET. Uses a strict
 * whitelist of allowed paths — NOT startsWith() — to prevent path
 * traversal, query-string injection or SSRF to non-cron endpoints.
 */

import { NextResponse, NextRequest } from 'next/server';
import { withOwnerAuth, type AdminUser } from '@/lib/admin-auth';
import { logEvent } from '@/lib/system-log';

/**
 * Strict allow-list of cron paths. To enable a new cron, add it here.
 * Any value outside this set is rejected before we even build the URL.
 */
const ALLOWED_CRON_PATHS = new Set<string>([
  '/api/cron/reminders',
  '/api/cron/walkin-notify',
  '/api/cron/owner-digest',
  '/api/cron/whatsapp-health',
  '/api/cron/refresh-meta-tokens',
  '/api/cron/expire-memberships',
  '/api/cron/resume-bot',
  '/api/cron/downgrade-grace-expired',
  '/api/cron/cleanup-logs',
]);

async function handler(admin: AdminUser, req: NextRequest) {
  let body: any;
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON body' }, { status: 400 });
  }

  const path = body?.path;
  if (typeof path !== 'string' || !ALLOWED_CRON_PATHS.has(path)) {
    return NextResponse.json(
      { error: 'Unknown cron path. Must be one of the registered jobs.' },
      { status: 400 },
    );
  }

  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) {
    return NextResponse.json({ error: 'CRON_SECRET not configured' }, { status: 500 });
  }

  // Build URL only AFTER validating the path against the allow-list.
  const base = process.env.NEXT_PUBLIC_SITE_URL || `http://localhost:${process.env.PORT || 3000}`;
  const url = `${base}${path}`;

  try {
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${cronSecret}` },
    });
    const result = await res.json().catch(() => ({}));

    await logEvent({
      type: 'admin.cron.manual_run',
      severity: res.ok ? 'info' : 'warn',
      userId: admin.id,
      message: `${admin.email} ejecutó manualmente ${path}`,
      payload: { path, status: res.status, result },
    });

    return NextResponse.json({ ok: res.ok, status: res.status, result });
  } catch (err: any) {
    return NextResponse.json({ error: err?.message || 'Failed to invoke cron' }, { status: 500 });
  }
}

export const POST = withOwnerAuth(handler);
