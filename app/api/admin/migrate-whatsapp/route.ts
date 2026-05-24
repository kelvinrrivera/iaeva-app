import { NextResponse } from 'next/server';
import { withAuth, type AuthenticatedUser } from '@/lib/auth-middleware';
import { db } from '@/lib/database';
import { migrateWhatsAppConnections } from '@/scripts/migrate-whatsapp-connections';

export async function POST(request: Request) {
  return withAuth(async (authUser: AuthenticatedUser) => {
    // SUPER_ADMIN only — check across all memberships
    const memberships = await db.membership.findMany({
      where: { userId: authUser.id },
      select: { role: true },
    });
    const isSuperAdmin = memberships.some(m => m.role === 'SUPER_ADMIN');
    if (!isSuperAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const result = await migrateWhatsAppConnections();
    return NextResponse.json(result);
  }, request as any);
}
