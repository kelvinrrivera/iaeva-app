/**
 * Authorization Middleware for API Routes
 *
 * This module provides a centralized authorization system for protecting
 * API routes and ensuring proper access control.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createRouteHandlerClient } from '@/lib/supabase/server';
import type { Role } from '@prisma/client';

/**
 * Authenticated user with shop info
 */
export interface AuthenticatedUser {
  id: string;
  email: string;
  phone: string;
  name?: string | null;
  shopId?: string | null;
  role?: Role | null;
}

/**
 * Verify user authentication and return user info
 *
 * @param request - NextRequest object
 * @returns AuthenticatedUser with id, email, and optional shopId
 * @throws Error if not authenticated
 */
export async function requireAuth(request: NextRequest): Promise<AuthenticatedUser> {
  const supabase = await createRouteHandlerClient();

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    console.log('[requireAuth] No user found:', { error: error?.message, hasUser: !!user });
    throw new Error('Unauthorized');
  }

  console.log('[requireAuth] Supabase Auth user:', { id: user.id, email: user.email });

  // Get user's active shop (first one)
  const { prisma } = await import('@/lib/db');

  // First, try to find membership by userId
  let membership = await prisma.membership.findFirst({
    where: {
      userId: user.id,
    },
    include: {
      shop: true,
    },
  });

  // If not found, try to find User by phone and then get membership
  if (!membership && user.phone) {
    console.log('[requireAuth] Membership not found by userId, trying phone lookup...');

    const dbUser = await prisma.user.findUnique({
      where: { phoneNumber: user.phone },
      select: { id: true }
    });

    if (dbUser) {
      console.log('[requireAuth] Found DB user by phone:', { supabaseId: user.id, dbId: dbUser.id });

      membership = await prisma.membership.findFirst({
        where: {
          userId: dbUser.id,
        },
        include: {
          shop: true,
        },
      });

      if (membership) {
        console.log('[requireAuth] Found membership via phone lookup');
      }
    }
  }

  if (!membership) {
    console.error('[requireAuth] ✗ NO MEMBERSHIP FOUND for user:', {
      supabaseId: user.id,
      email: user.email
    });
  } else {
    console.log('[requireAuth] ✓ User authenticated:', {
      userId: user.id,
      email: user.email,
      shopId: membership.shopId,
      role: membership.role,
      shopName: membership.shop?.name
    });
  }

  return {
    id: user.id,
    email: user.email || '',
    phone: user.phone || '',
    name: user.user_metadata?.name || null,
    shopId: membership?.shopId || null,
    role: membership?.role || null,
  };
}

/**
 * Verify user has one of the required roles
 *
 * @param request - NextRequest object
 * @param roles - Array of allowed roles
 * @returns AuthenticatedUser
 * @throws Error if not authenticated or insufficient permissions
 */
export async function requireRole(
  request: NextRequest,
  roles: Role[]
): Promise<AuthenticatedUser> {
  const user = await requireAuth(request);

  if (!user.role || !roles.includes(user.role)) {
    throw new Error('Forbidden');
  }

  return user;
}

/**
 * Verify user has access to a specific shop
 *
 * @param request - NextRequest object
 * @param shopId - Shop ID to verify access to
 * @returns AuthenticatedUser
 * @throws Error if not authenticated or no access to shop
 */
export async function requireShopAccess(
  request: NextRequest,
  shopId: string
): Promise<AuthenticatedUser> {
  const user = await requireAuth(request);

  const { prisma } = await import('@/lib/db');

  const membership = await prisma.membership.findFirst({
    where: {
      userId: user.id,
      shopId: shopId,
    },
  });

  if (!membership) {
    throw new Error('Forbidden');
  }

  return user;
}

/**
 * Higher-order function wrapper for authenticated route handlers
 *
 * @param handler - The route handler function that receives AuthenticatedUser
 * @param request - NextRequest object
 * @returns NextResponse
 *
 * @example
 * export async function GET(request: Request) {
 *   return withAuth(async (user: AuthenticatedUser) => {
 *     return NextResponse.json({ data: 'protected' });
 *   }, request as any);
 * }
 */
export async function withAuth(
  handler: (user: AuthenticatedUser) => Promise<Response>,
  request: NextRequest
): Promise<Response> {
  try {
    const user = await requireAuth(request);
    return await handler(user);
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return new NextResponse(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }
    if (error.message === 'Forbidden') {
      return new NextResponse(
        JSON.stringify({ error: 'Forbidden' }),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      );
    }
    return new NextResponse(
      JSON.stringify({ error: 'Internal Server Error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}

/**
 * Higher-order function wrapper for authenticated route handlers with role requirements
 *
 * @param handler - The route handler function that receives AuthenticatedUser
 * @param request - NextRequest object
 * @param roles - Array of allowed roles
 * @returns NextResponse
 *
 * @example
 * export async function POST(request: Request) {
 *   return withAuthAndRole(async (user: AuthenticatedUser) => {
 *     return NextResponse.json({ data: 'protected' });
 *   }, request as any, ['ORG_ADMIN', 'TEAM_LEADER']);
 * }
 */
export async function withAuthAndRole(
  handler: (user: AuthenticatedUser) => Promise<Response>,
  request: NextRequest,
  roles: Role[]
): Promise<Response> {
  try {
    const user = await requireRole(request, roles);
    return await handler(user);
  } catch (error: any) {
    if (error.message === 'Unauthorized') {
      return new NextResponse(
        JSON.stringify({ error: 'Unauthorized' }),
        { status: 401, headers: { 'Content-Type': 'application/json' } }
      );
    }
    if (error.message === 'Forbidden') {
      return new NextResponse(
        JSON.stringify({ error: 'Forbidden - Insufficient permissions' }),
        { status: 403, headers: { 'Content-Type': 'application/json' } }
      );
    }
    return new NextResponse(
      JSON.stringify({ error: 'Internal Server Error' }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
