import { NextResponse } from 'next/server';
import { db } from '@/lib/database';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

/**
 * GET /api/health
 * Lightweight readiness probe. Checks DB connectivity and reports basic build info.
 * Returns 200 when healthy, 503 when any critical dependency is down.
 */
export async function GET() {
  const checks: Record<string, { ok: boolean; latencyMs?: number; error?: string }> = {};
  let overallOk = true;

  // Database
  const dbStart = Date.now();
  try {
    await db.$queryRaw`SELECT 1`;
    checks.database = { ok: true, latencyMs: Date.now() - dbStart };
  } catch (err: any) {
    overallOk = false;
    checks.database = { ok: false, latencyMs: Date.now() - dbStart, error: err?.message || 'unknown' };
  }

  // Supabase (optional — only check if URL is set)
  if (process.env.NEXT_PUBLIC_SUPABASE_URL) {
    const supaStart = Date.now();
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_SUPABASE_URL}/auth/v1/health`, {
        headers: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY
          ? { apikey: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY }
          : {},
        signal: AbortSignal.timeout(3000),
      });
      checks.supabase = { ok: res.ok, latencyMs: Date.now() - supaStart };
      if (!res.ok) overallOk = false;
    } catch (err: any) {
      overallOk = false;
      checks.supabase = { ok: false, latencyMs: Date.now() - supaStart, error: err?.message || 'timeout' };
    }
  }

  return NextResponse.json(
    {
      status: overallOk ? 'ok' : 'degraded',
      timestamp: new Date().toISOString(),
      version: process.env.VERCEL_GIT_COMMIT_SHA?.slice(0, 7) || 'local',
      checks,
    },
    { status: overallOk ? 200 : 503 }
  );
}
