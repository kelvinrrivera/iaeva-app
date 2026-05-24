/**
 * Auth Middleware Tests
 *
 * Tests for authorization middleware functionality.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';

// Mock dependencies before importing
vi.mock('@/lib/db', () => ({
  prisma: {
    membership: {
      findFirst: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
    },
  },
}));

vi.mock('@/lib/supabase/server', () => ({
  createRouteHandlerClient: vi.fn(() => Promise.resolve({
    auth: {
      getUser: vi.fn(),
    },
  })),
}));

import { requireAuth, requireRole, requireShopAccess } from '@/lib/auth-middleware';
import { prisma } from '@/lib/db';
import { createRouteHandlerClient } from '@/lib/supabase/server';

describe('requireAuth', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return user when valid token is provided', async () => {
    const mockUser = {
      id: 'user_123',
      email: 'test@example.com',
      user_metadata: {
        name: 'Test User',
      },
    };

    const mockCookieStore = {
      get: vi.fn(),
    };

    const mockRequest = {
      cookies: mockCookieStore,
      nextUrl: new URL('http://localhost:3000/api/test'),
    } as any;

    const mockSupabase = {
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: mockUser }, error: null }),
      },
    };

    (createRouteHandlerClient as any).mockResolvedValue(mockSupabase);
    (prisma.membership.findFirst as any).mockResolvedValue({
      shopId: 'shop_123',
      role: 'PROFESSIONAL',
    });

    const user = await requireAuth(mockRequest);

    expect(user).toBeDefined();
    expect(user.id).toBe('user_123');
  });

  it('should throw error when no token is provided', async () => {
    const mockCookieStore = {
      get: vi.fn(),
    };

    const mockRequest = {
      cookies: mockCookieStore,
      nextUrl: new URL('http://localhost:3000/api/test'),
    } as any;

    const mockSupabase = {
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: null }, error: null }),
      },
    };

    (createRouteHandlerClient as any).mockResolvedValue(mockSupabase);

    await expect(requireAuth(mockRequest)).rejects.toThrow('Unauthorized');
  });
});

describe('requireRole', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return user when user has required role', async () => {
    const mockUser = {
      id: 'user_123',
      email: 'test@example.com',
      user_metadata: {
        name: 'Test User',
      },
    };

    const mockCookieStore = {
      get: vi.fn(),
    };

    const mockRequest = {
      cookies: mockCookieStore,
      nextUrl: new URL('http://localhost:3000/api/test'),
    } as any;

    const mockSupabase = {
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: mockUser }, error: null }),
      },
    };

    (createRouteHandlerClient as any).mockResolvedValue(mockSupabase);
    (prisma.membership.findFirst as any).mockResolvedValue({
      shopId: 'shop_123',
      role: 'ORG_ADMIN',
    });

    const user = await requireRole(mockRequest, ['ORG_ADMIN']);

    expect(user).toBeDefined();
    expect(user.id).toBe('user_123');
  });

  it('should throw error when user does not have required role', async () => {
    const mockUser = {
      id: 'user_123',
      email: 'test@example.com',
      user_metadata: {
        name: 'Test User',
      },
    };

    const mockCookieStore = {
      get: vi.fn(),
    };

    const mockRequest = {
      cookies: mockCookieStore,
      nextUrl: new URL('http://localhost:3000/api/test'),
    } as any;

    const mockSupabase = {
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: mockUser }, error: null }),
      },
    };

    (createRouteHandlerClient as any).mockResolvedValue(mockSupabase);
    (prisma.membership.findFirst as any).mockResolvedValue({
      shopId: 'shop_123',
      role: 'PROFESSIONAL',
    });

    await expect(requireRole(mockRequest, ['ORG_ADMIN'])).rejects.toThrow('Forbidden');
  });
});

describe('requireShopAccess', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should return user when user has access to shop', async () => {
    const mockUser = {
      id: 'user_123',
      email: 'test@example.com',
      user_metadata: {
        name: 'Test User',
      },
    };

    const mockCookieStore = {
      get: vi.fn(),
    };

    const mockRequest = {
      cookies: mockCookieStore,
      nextUrl: new URL('http://localhost:3000/api/test'),
    } as any;

    const mockSupabase = {
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: mockUser }, error: null }),
      },
    };

    (createRouteHandlerClient as any).mockResolvedValue(mockSupabase);
    (prisma.membership.findFirst as any).mockResolvedValue({
      userId: 'user_123',
      shopId: 'shop_123',
    });

    const user = await requireShopAccess(mockRequest, 'shop_123');

    expect(user).toBeDefined();
    expect(user.id).toBe('user_123');
  });

  it('should throw error when user does not have access to shop', async () => {
    const mockUser = {
      id: 'user_123',
      email: 'test@example.com',
      user_metadata: {
        name: 'Test User',
      },
    };

    const mockCookieStore = {
      get: vi.fn(),
    };

    const mockRequest = {
      cookies: mockCookieStore,
      nextUrl: new URL('http://localhost:3000/api/test'),
    } as any;

    const mockSupabase = {
      auth: {
        getUser: vi.fn().mockResolvedValue({ data: { user: mockUser }, error: null }),
      },
    };

    (createRouteHandlerClient as any).mockResolvedValue(mockSupabase);
    (prisma.membership.findFirst as any).mockResolvedValue(null);

    await expect(requireShopAccess(mockRequest, 'shop_123')).rejects.toThrow('Forbidden');
  });
});
