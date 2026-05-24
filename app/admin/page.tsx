import { db } from '@/lib/database';
import { PLAN_DETAILS } from '@/lib/stripe/client';
import { TrendingUp, Store, MessageSquare, Calendar, AlertTriangle, Activity } from 'lucide-react';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

const PRICE_BY_PLAN: Record<string, number> = {
  SOLO: PLAN_DETAILS.SOLO.price,
  TEAM: PLAN_DETAILS.TEAM.price,
  BUSINESS: PLAN_DETAILS.BUSINESS.price,
};

async function loadMetrics() {
  const now = new Date();
  const day = 24 * 60 * 60 * 1000;
  const d30 = new Date(now.getTime() - 30 * day);
  const d7 = new Date(now.getTime() - 7 * day);
  const d1 = new Date(now.getTime() - day);

  const [
    shopsTotal,
    shopsByPlanRows,
    appts30d,
    appts7d,
    appts1d,
    messages1d,
    shopsWaConnected,
    shopsActiveLast30,
    recentErrorsCount,
  ] = await Promise.all([
    db.shop.count(),
    db.shop.groupBy({ by: ['plan'], _count: { _all: true } }),
    db.appointment.count({ where: { createdAt: { gte: d30 } } }),
    db.appointment.count({ where: { createdAt: { gte: d7 } } }),
    db.appointment.count({ where: { createdAt: { gte: d1 } } }),
    db.chatHistory.count({ where: { createdAt: { gte: d1 } } }),
    db.shop.count({ where: { whatsappEnabled: true, wabaId: { not: null } } }),
    db.shop.count({ where: { appointments: { some: { createdAt: { gte: d30 } } } } }),
    db.systemLog.count({ where: { severity: 'error', createdAt: { gte: d1 } } }),
  ]);

  const planCounts: Record<string, number> = { SOLO: 0, TEAM: 0, BUSINESS: 0 };
  for (const row of shopsByPlanRows) {
    planCounts[String(row.plan)] = row._count._all;
  }
  const mrr =
    planCounts.SOLO * PRICE_BY_PLAN.SOLO +
    planCounts.TEAM * PRICE_BY_PLAN.TEAM +
    planCounts.BUSINESS * PRICE_BY_PLAN.BUSINESS;

  // Daily appointments last 14 days
  const dailyAppointments: { date: string; count: number }[] = [];
  for (let i = 13; i >= 0; i--) {
    const start = new Date(now.getTime() - i * day);
    start.setHours(0, 0, 0, 0);
    const end = new Date(start.getTime() + day);
    const count = await db.appointment.count({ where: { createdAt: { gte: start, lt: end } } });
    dailyAppointments.push({ date: start.toISOString().slice(5, 10), count });
  }

  return {
    mrr,
    shopsTotal,
    shopsActiveLast30,
    shopsWaConnected,
    planCounts,
    appts30d,
    appts7d,
    appts1d,
    messages1d,
    recentErrorsCount,
    dailyAppointments,
  };
}

function Kpi({
  label,
  value,
  hint,
  icon: Icon,
  tone = 'default',
  href,
}: {
  label: string;
  value: string | number;
  hint?: string;
  icon: any;
  tone?: 'default' | 'success' | 'warning' | 'danger';
  href?: string;
}) {
  const toneClasses = {
    default: 'border-gray-200',
    success: 'border-emerald-200 bg-emerald-50/40',
    warning: 'border-amber-200 bg-amber-50/40',
    danger: 'border-red-200 bg-red-50/40',
  }[tone];

  const inner = (
    <div className={`p-5 bg-white border ${toneClasses} rounded-2xl hover:shadow-md transition-shadow`}>
      <div className="flex items-center justify-between mb-3">
        <p className="text-xs font-bold uppercase tracking-wider text-gray-400">{label}</p>
        <Icon className="h-4 w-4 text-gray-400" />
      </div>
      <p className="text-3xl font-black text-charcoal">{value}</p>
      {hint && <p className="text-[11px] text-gray-400 mt-1">{hint}</p>}
    </div>
  );

  return href ? <Link href={href}>{inner}</Link> : inner;
}

export default async function AdminDashboard() {
  const m = await loadMetrics();
  const max = Math.max(1, ...m.dailyAppointments.map(d => d.count));

  return (
    <div className="space-y-6 max-w-7xl">
      <div>
        <h1 className="text-2xl font-black text-charcoal">Resumen general</h1>
        <p className="text-sm text-gray-500 mt-1">Salud del SaaS al minuto.</p>
      </div>

      {/* Financial KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Kpi label="MRR" value={`$${m.mrr.toLocaleString('en-US')}`} hint={`ARR $${(m.mrr * 12).toLocaleString('en-US')}`} icon={TrendingUp} tone="success" />
        <Kpi label="Shops totales" value={m.shopsTotal} hint={`${m.shopsActiveLast30} activos en 30d`} icon={Store} href="/admin/shops" />
        <Kpi label="Citas 30d" value={m.appts30d} hint={`${m.appts1d} hoy · ${m.appts7d} esta semana`} icon={Calendar} />
        <Kpi label="Mensajes 24h" value={m.messages1d.toLocaleString('en-US')} hint="WhatsApp procesados" icon={MessageSquare} />
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Kpi label="WhatsApp conectado" value={m.shopsWaConnected} hint={`${Math.round((m.shopsWaConnected / Math.max(1, m.shopsTotal)) * 100)}% del total`} icon={Activity} />
        <Kpi label="Errores 24h" value={m.recentErrorsCount} icon={AlertTriangle} tone={m.recentErrorsCount > 0 ? 'danger' : 'default'} href="/admin/logs" />
        <Kpi label="Total pagos" value={m.planCounts.SOLO + m.planCounts.TEAM + m.planCounts.BUSINESS} hint={`SOLO ${m.planCounts.SOLO} · TEAM ${m.planCounts.TEAM} · BIZ ${m.planCounts.BUSINESS}`} icon={TrendingUp} />
      </div>

      {/* Chart: appointments last 14 days */}
      <div className="bg-white border border-gray-200 rounded-2xl p-5">
        <div className="flex items-center justify-between mb-4">
          <div>
            <p className="text-sm font-black text-charcoal">Citas creadas por día</p>
            <p className="text-xs text-gray-400">Últimos 14 días</p>
          </div>
        </div>
        <div className="flex items-end gap-1.5 h-32">
          {m.dailyAppointments.map((d, idx) => {
            const h = (d.count / max) * 100;
            return (
              <div key={idx} className="flex-1 flex flex-col items-center justify-end group" title={`${d.date}: ${d.count}`}>
                <div
                  className="w-full bg-fuchsia-500/80 hover:bg-fuchsia-600 rounded-t transition-colors min-h-[2px]"
                  style={{ height: `${h}%` }}
                />
                <p className="text-[9px] text-gray-400 mt-1">{d.date}</p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Distribución por plan */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white border border-gray-200 rounded-2xl p-5">
          <p className="text-sm font-black text-charcoal mb-4">Distribución por plan</p>
          <div className="space-y-2">
            {(['SOLO', 'TEAM', 'BUSINESS'] as const).map(p => {
              const count = m.planCounts[p];
              const pct = m.shopsTotal === 0 ? 0 : Math.round((count / m.shopsTotal) * 100);
              return (
                <div key={p} className="flex items-center gap-3">
                  <span className="w-20 text-xs font-bold text-gray-600">{p}</span>
                  <div className="flex-1 h-6 bg-gray-100 rounded-lg overflow-hidden">
                    <div className="h-full bg-fuchsia-500" style={{ width: `${pct}%` }} />
                  </div>
                  <span className="text-xs font-bold text-gray-700 w-14 text-right">{count}</span>
                  <span className="text-xs text-gray-400 w-10 text-right">{pct}%</span>
                </div>
              );
            })}
          </div>
        </div>

        <div className="bg-white border border-gray-200 rounded-2xl p-5">
          <p className="text-sm font-black text-charcoal mb-4">Acciones rápidas</p>
          <div className="space-y-2 text-sm">
            <Link href="/admin/shops" className="flex items-center justify-between p-3 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors">
              <span>Ver todos los negocios</span>
              <span className="text-xs text-gray-400">{m.shopsTotal}</span>
            </Link>
            <Link href="/admin/health" className="flex items-center justify-between p-3 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors">
              <span>Estado de servicios externos</span>
              <Activity className="h-3.5 w-3.5 text-gray-400" />
            </Link>
            <Link href="/admin/crons" className="flex items-center justify-between p-3 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors">
              <span>Cron jobs e histórico</span>
              <span className="text-xs text-gray-400">8 jobs</span>
            </Link>
            <Link href="/admin/logs" className="flex items-center justify-between p-3 bg-gray-50 hover:bg-gray-100 rounded-lg transition-colors">
              <span>Logs del sistema</span>
              {m.recentErrorsCount > 0 && (
                <span className="text-[10px] px-1.5 py-0.5 bg-red-100 text-red-700 rounded font-bold">{m.recentErrorsCount} err</span>
              )}
            </Link>
          </div>
        </div>
      </div>
    </div>
  );
}
