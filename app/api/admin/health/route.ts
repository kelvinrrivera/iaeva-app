/**
 * GET /api/admin/health
 * Pings each external dependency and reports status + latency.
 */

import { NextResponse, NextRequest } from 'next/server';
import { withOwnerAuth, type AdminUser } from '@/lib/admin-auth';
import { db } from '@/lib/database';
import { checkRateLimit, rateLimitResponse } from '@/lib/rate-limit';

type ServiceStatus = 'ok' | 'degraded' | 'down' | 'unknown';

interface HealthCheck {
  name: string;
  status: ServiceStatus;
  latencyMs: number | null;
  detail?: string;
}

const TIMEOUT_MS = 4000;

async function withTimeout<T>(p: Promise<T>, ms: number): Promise<T> {
  return await Promise.race([
    p,
    new Promise<T>((_, reject) => setTimeout(() => reject(new Error('timeout')), ms)),
  ]);
}

async function timed(fn: () => Promise<{ status: ServiceStatus; detail?: string }>): Promise<{ status: ServiceStatus; detail?: string; latencyMs: number }> {
  const start = Date.now();
  try {
    const r = await withTimeout(fn(), TIMEOUT_MS);
    return { ...r, latencyMs: Date.now() - start };
  } catch (e: any) {
    return { status: 'down', detail: e?.message || 'error', latencyMs: Date.now() - start };
  }
}

async function checkDb(): Promise<HealthCheck> {
  const r = await timed(async () => {
    await db.$queryRaw`SELECT 1`;
    return { status: 'ok' as ServiceStatus };
  });
  return { name: 'PostgreSQL (Supabase)', ...r };
}

async function checkMeta(): Promise<HealthCheck> {
  const token = process.env.WHATSAPP_SYSTEM_USER_TOKEN || process.env.WHATSAPP_ACCESS_TOKEN;
  if (!token) return { name: 'Meta WhatsApp Cloud API', status: 'unknown', latencyMs: null, detail: 'No system user token configured' };
  const r = await timed(async () => {
    const res = await fetch('https://graph.facebook.com/v22.0/me', {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) return { status: 'ok' as ServiceStatus };
    return { status: 'down' as ServiceStatus, detail: `HTTP ${res.status}` };
  });
  return { name: 'Meta WhatsApp Cloud API', ...r };
}

async function checkOpenAI(): Promise<HealthCheck> {
  const key = process.env.OPENAI_API_KEY;
  if (!key) return { name: 'OpenAI', status: 'unknown', latencyMs: null, detail: 'OPENAI_API_KEY missing' };
  const r = await timed(async () => {
    const res = await fetch('https://api.openai.com/v1/models', {
      headers: { Authorization: `Bearer ${key}` },
    });
    if (res.ok) return { status: 'ok' as ServiceStatus };
    return { status: 'down' as ServiceStatus, detail: `HTTP ${res.status}` };
  });
  return { name: 'OpenAI', ...r };
}

async function checkStripe(): Promise<HealthCheck> {
  const key = process.env.STRIPE_SECRET_KEY;
  if (!key) return { name: 'Stripe', status: 'unknown', latencyMs: null, detail: 'STRIPE_SECRET_KEY missing' };
  const r = await timed(async () => {
    const res = await fetch('https://api.stripe.com/v1/balance', {
      headers: { Authorization: `Bearer ${key}` },
    });
    if (res.ok) return { status: 'ok' as ServiceStatus };
    return { status: 'down' as ServiceStatus, detail: `HTTP ${res.status}` };
  });
  return { name: 'Stripe', ...r };
}

async function checkDeepgram(): Promise<HealthCheck> {
  const key = process.env.DEEPGRAM_API_KEY;
  if (!key) return { name: 'Deepgram', status: 'unknown', latencyMs: null, detail: 'DEEPGRAM_API_KEY missing' };
  const r = await timed(async () => {
    const res = await fetch('https://api.deepgram.com/v1/projects', {
      headers: { Authorization: `Token ${key}` },
    });
    if (res.ok) return { status: 'ok' as ServiceStatus };
    return { status: 'down' as ServiceStatus, detail: `HTTP ${res.status}` };
  });
  return { name: 'Deepgram', ...r };
}

async function checkSupabaseAuth(): Promise<HealthCheck> {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const anon = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anon) return { name: 'Supabase Auth', status: 'unknown', latencyMs: null, detail: 'env vars missing' };
  const r = await timed(async () => {
    const res = await fetch(`${url}/auth/v1/health`, {
      headers: { apikey: anon, Authorization: `Bearer ${anon}` },
    });
    if (res.ok) return { status: 'ok' as ServiceStatus };
    return { status: 'down' as ServiceStatus, detail: `HTTP ${res.status}` };
  });
  return { name: 'Supabase Auth', ...r };
}

async function handler(admin: AdminUser, _req: NextRequest) {
  // Cap to 30 req/min per admin to avoid burning paid API quotas on UI refresh.
  const rl = await checkRateLimit(`admin-health:${admin.id}`, 'api');
  if (!rl.success) {
    return rateLimitResponse() as unknown as NextResponse;
  }

  const results = await Promise.all([
    checkDb(),
    checkMeta(),
    checkOpenAI(),
    checkStripe(),
    checkDeepgram(),
    checkSupabaseAuth(),
  ]);
  const anyDown = results.some(r => r.status === 'down');
  return NextResponse.json({
    overall: anyDown ? 'degraded' : 'ok',
    checks: results,
    timestamp: new Date().toISOString(),
  });
}

export const GET = withOwnerAuth(handler);
