/**
 * Owner admin authentication.
 *
 * Access is controlled by an env var allowlist of emails (NOT a DB flag).
 * This is deliberate: it means there's no DB row anyone can flip to escalate
 * to owner. To grant access, you set OWNER_EMAILS in the environment.
 *
 *   OWNER_EMAILS="krrcrypto@gmail.com,other@example.com"
 *
 * Used by:
 *   - app/admin/layout.tsx       — server-side gate for the UI
 *   - app/api/admin/* /route.ts  — gate for admin endpoints
 */

import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@/lib/supabase/server';

export interface AdminUser {
  id: string;
  email: string;
}

function getAllowedEmails(): string[] {
  return (process.env.OWNER_EMAILS || '')
    .split(',')
    .map(e => e.trim().toLowerCase())
    .filter(Boolean);
}

export function isOwnerEmail(email: string | null | undefined): boolean {
  if (!email) return false;
  const allow = getAllowedEmails();
  // Hard fail-closed: if the allowlist is empty (env not set), no one is
  // owner — never grant by accident. Log a warning so the operator knows.
  if (allow.length === 0) {
    console.warn('[admin-auth] OWNER_EMAILS is empty — owner access denied for all users');
    return false;
  }
  return allow.includes(email.trim().toLowerCase());
}

/**
 * Require owner access in an API route. Throws if not authorized.
 * Returns the owner's identity for logging.
 */
export async function requireOwnerAccess(_request: NextRequest): Promise<AdminUser> {
  const supabase = await createRouteHandlerClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user || !user.email) {
    throw new OwnerAuthError('not_authenticated');
  }
  if (!isOwnerEmail(user.email)) {
    throw new OwnerAuthError('not_owner');
  }
  return { id: user.id, email: user.email };
}

export class OwnerAuthError extends Error {
  constructor(public kind: 'not_authenticated' | 'not_owner') {
    super(kind);
  }
}

/**
 * Validate a shopId parameter from a URL or body. Shop IDs are cuid/cuid2
 * strings (or short legacy identifiers like 'shop-barber-free'). We accept
 * a safe character set and a length bound — rejects path traversal, NUL
 * bytes, SQL meta-chars, etc.
 */
export function isValidShopId(value: unknown): value is string {
  if (typeof value !== 'string') return false;
  if (value.length < 3 || value.length > 64) return false;
  return /^[a-z0-9-]+$/i.test(value);
}

/**
 * Wrap an admin route handler with owner auth. Returns 404 if unauthorized
 * (we don't want to leak the existence of admin endpoints to attackers).
 */
export function withOwnerAuth<T>(
  handler: (admin: AdminUser, req: NextRequest) => Promise<T>,
) {
  return async (req: NextRequest): Promise<T | NextResponse> => {
    try {
      const admin = await requireOwnerAccess(req);
      return await handler(admin, req);
    } catch (err) {
      if (err instanceof OwnerAuthError) {
        return NextResponse.json({ error: 'Not found' }, { status: 404 });
      }
      throw err;
    }
  };
}
