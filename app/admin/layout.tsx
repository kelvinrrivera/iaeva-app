import { redirect, notFound } from 'next/navigation';
import { createRouteHandlerClient } from '@/lib/supabase/server';
import { isOwnerEmail } from '@/lib/admin-auth';
import AdminSidebar from '@/components/admin/AdminSidebar';

export const dynamic = 'force-dynamic';

export default async function AdminLayout({ children }: { children: React.ReactNode }) {
  const supabase = await createRouteHandlerClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // Unauthenticated users → login (they'll come back if they have a session)
  if (!user || !user.email) redirect('/login');

  // Authenticated but not owner → respond 404 instead of redirecting to /dashboard.
  // Reasons:
  //  1. No info disclosure — the attacker cannot tell if /admin exists at all.
  //  2. Matches the behavior of /api/admin/* (withOwnerAuth also returns 404).
  if (!isOwnerEmail(user.email)) notFound();

  return (
    <div className="min-h-screen bg-gray-50 flex">
      <AdminSidebar />
      <div className="flex-1 flex flex-col min-w-0">
        <header className="h-14 border-b border-gray-200 bg-white flex items-center justify-between px-6">
          <div>
            <p className="text-xs text-gray-400 uppercase tracking-wider">Modo Owner</p>
            <p className="text-sm font-bold text-charcoal">{user.email}</p>
          </div>
          <span className="text-[11px] px-2.5 py-1 rounded-full bg-fuchsia-100 text-fuchsia-700 font-bold">
            Administración global
          </span>
        </header>
        <main className="flex-1 p-6 overflow-y-auto">{children}</main>
      </div>
    </div>
  );
}
