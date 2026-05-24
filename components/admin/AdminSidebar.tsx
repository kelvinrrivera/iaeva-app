'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import {
  LayoutDashboard,
  Store,
  Activity,
  ScrollText,
  Clock,
  AlertTriangle,
  FileText,
  ArrowLeft,
  Wrench,
  Sparkles,
} from 'lucide-react';

const items = [
  { href: '/admin', label: 'Resumen', icon: LayoutDashboard, exact: true },
  { href: '/admin/shops', label: 'Negocios', icon: Store },
  { href: '/admin/founders', label: 'Fundadores', icon: Sparkles },
  { href: '/admin/tools', label: 'Tools del bot', icon: Wrench },
  { href: '/admin/health', label: 'Salud', icon: Activity },
  { href: '/admin/crons', label: 'Cron jobs', icon: Clock },
  { href: '/admin/logs', label: 'Logs', icon: ScrollText },
  { href: '/admin/templates', label: 'Plantillas', icon: FileText },
  { href: '/admin/alerts', label: 'Alertas', icon: AlertTriangle },
];

export default function AdminSidebar() {
  const pathname = usePathname();

  return (
    <aside className="w-60 shrink-0 bg-charcoal text-white min-h-screen border-r border-white/10 flex flex-col">
      <div className="px-5 py-5 border-b border-white/10">
        <div className="flex items-center gap-2">
          <div className="h-8 w-8 rounded-lg bg-fuchsia-500/20 flex items-center justify-center text-fuchsia-300 text-xs font-black">
            DC
          </div>
          <div>
            <p className="text-sm font-bold leading-tight">DomiCita</p>
            <p className="text-[10px] uppercase tracking-wider text-fuchsia-300">Owner Console</p>
          </div>
        </div>
      </div>

      <nav className="flex-1 py-4 px-3 space-y-0.5">
        {items.map(({ href, label, icon: Icon, exact }) => {
          const active = exact ? pathname === href : pathname.startsWith(href);
          return (
            <Link
              key={href}
              href={href}
              className={`flex items-center gap-2.5 px-3 py-2 rounded-lg text-sm transition-colors ${
                active
                  ? 'bg-fuchsia-500/15 text-white font-semibold'
                  : 'text-white/60 hover:text-white hover:bg-white/5'
              }`}
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          );
        })}
      </nav>

      <div className="p-3 border-t border-white/10">
        <Link
          href="/dashboard"
          className="flex items-center gap-2 px-3 py-2 rounded-lg text-xs text-white/50 hover:text-white hover:bg-white/5 transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Volver al dashboard
        </Link>
      </div>
    </aside>
  );
}
