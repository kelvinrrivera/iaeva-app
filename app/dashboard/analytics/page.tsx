'use client';

import { useState, useEffect } from 'react';
import { useTerminology } from '@/contexts/TerminologyContext';
import {
  AreaChart, Area, BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip,
  ResponsiveContainer, PieChart, Pie, Cell,
} from 'recharts';

/* ── Types ── */
interface AnalyticsData {
  totalRevenue: number;
  appointmentsCount: number;
  newClients: number;
  topServices: Array<{ name: string; count: number; revenue: number }>;
  stylistPerformance: Array<{ name: string; appointments: number; revenue: number }>;
  dailyRevenue: Array<{ date: string; revenue: number }>;
  noShows?: number;
  noShowRate?: number;
  cancelled?: number;
  attendanceRate?: number;
  completedCount?: number;
  pendingDebt?: { totalDebt: number; clientsWithDebt: number };
  peakPatterns?: {
    peakHour: number | null;
    peakHourCount: number;
    strongestDay: number | null;
    strongestDayCount: number;
    hourlyDistribution: number[];
    dailyDistribution: number[];
  };
  inactiveClients?: number;
}

const DAY_NAMES = ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'];
const PIE_COLORS = ['#0E2A47', '#A61E2E', '#2563eb', '#059669', '#d97706', '#7c3aed', '#db2777', '#0891b2'];

/* ── Helpers ── */
function formatRD(value: number) {
  return `RD$${value.toLocaleString('es-DO', { maximumFractionDigits: 0 })}`;
}

function formatHour(h: number | null) {
  if (h === null) return '—';
  const ampm = h >= 12 ? 'PM' : 'AM';
  const hour12 = h === 0 ? 12 : h > 12 ? h - 12 : h;
  return `${hour12}:00 ${ampm}`;
}

/* ── KPI Card ── */
function KpiCard({ label, value, sub, accent }: { label: string; value: string; sub?: string; accent?: string }) {
  return (
    <div className="bg-white rounded-[1.5rem] p-5 shadow-sm border border-gray-100">
      <p className="text-xs font-bold text-gray-400 uppercase tracking-wider mb-1">{label}</p>
      <p className={`text-2xl font-black ${accent || 'text-charcoal'}`}>{value}</p>
      {sub && <p className="text-xs text-gray-500 mt-1">{sub}</p>}
    </div>
  );
}

/* ── Custom Tooltip ── */
function RevenueTooltip({ active, payload, label }: { active?: boolean; payload?: Array<{ value: number }>; label?: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-charcoal text-white text-xs font-bold px-3 py-2 rounded-xl shadow-lg">
      <p className="text-white/60 mb-0.5">{label}</p>
      <p>{formatRD(payload[0].value)}</p>
    </div>
  );
}

/* ── Main Component ── */
export default function AnalyticsPage() {
  const { terminology: t } = useTerminology();
  const [period, setPeriod] = useState<'7d' | '30d' | '90d'>('30d');
  const [loading, setLoading] = useState(true);
  const [data, setData] = useState<AnalyticsData | null>(null);
  const [upgradeRequired, setUpgradeRequired] = useState(false);

  useEffect(() => {
    async function fetchAnalytics() {
      setLoading(true);
      try {
        const response = await fetch(`/api/analytics?period=${period}`, { credentials: 'include' });
        if (response.status === 403) { setUpgradeRequired(true); return; }
        if (response.ok) setData(await response.json());
      } catch (error) {
        console.error('Error fetching analytics:', error);
      } finally {
        setLoading(false);
      }
    }
    fetchAnalytics();
  }, [period]);

  /* ── Loading ── */
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
      </div>
    );
  }

  /* ── Upgrade Gate ── */
  if (upgradeRequired) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-5 text-center">
        <div className="w-16 h-16 rounded-2xl bg-primary/10 flex items-center justify-center">
          <svg className="w-8 h-8 text-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 19v-6a2 2 0 00-2-2H5a2 2 0 00-2 2v6a2 2 0 002 2h2a2 2 0 002-2zm0 0V9a2 2 0 012-2h2a2 2 0 012 2v10m-6 0a2 2 0 002 2h2a2 2 0 002-2m0 0V5a2 2 0 012-2h2a2 2 0 012 2v14a2 2 0 01-2 2h-2a2 2 0 01-2-2z" />
          </svg>
        </div>
        <div>
          <h2 className="text-xl font-black text-charcoal mb-1">Analíticas disponibles en SOLO+</h2>
          <p className="text-sm text-gray-500 max-w-xs">
            Accede a métricas de ingresos, asistencia y rendimiento por profesional.
          </p>
        </div>
        <a href="/dashboard/plans" className="inline-flex items-center gap-2 px-5 py-2.5 bg-primary text-white text-sm font-bold rounded-xl hover:bg-primary/90 transition-colors">
          Ver planes — desde $19/mes
        </a>
      </div>
    );
  }

  if (!data) {
    return (
      <div className="text-center py-12">
        <p className="text-gray-500">No hay datos disponibles para el período seleccionado.</p>
      </div>
    );
  }

  const averageTicket = data.appointmentsCount > 0 ? data.totalRevenue / data.appointmentsCount : 0;
  const peak = data.peakPatterns;
  const debt = data.pendingDebt;

  /* Chart data */
  const dailyChartData = data.dailyRevenue.map(d => ({
    date: new Date(d.date).toLocaleDateString('es-DO', { day: '2-digit', month: 'short' }),
    revenue: d.revenue,
  }));

  const hourlyChartData = (peak?.hourlyDistribution || []).map((count, hour) => ({
    hour: `${hour}h`,
    citas: count,
  })).filter((_, i) => i >= 7 && i <= 21); // only business hours

  const dayChartData = (peak?.dailyDistribution || []).map((count, day) => ({
    day: DAY_NAMES[day],
    citas: count,
  }));

  const servicesPieData = data.topServices.slice(0, 6).map(s => ({
    name: s.name,
    value: s.revenue,
    count: s.count,
  }));

  return (
    <div className="space-y-6">
      {/* ── Header ── */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-charcoal">Analíticas</h1>
          <p className="text-sm text-gray-500 mt-0.5">Métricas clave de tu negocio</p>
        </div>
        <div className="flex bg-gray-100 rounded-xl p-1">
          {(['7d', '30d', '90d'] as const).map(p => (
            <button
              key={p}
              onClick={() => setPeriod(p)}
              className={`px-3.5 py-1.5 text-xs font-bold rounded-lg transition-all ${
                period === p ? 'bg-white text-charcoal shadow-sm' : 'text-gray-500 hover:text-charcoal'
              }`}
            >
              {p === '7d' ? '7 días' : p === '30d' ? '30 días' : '90 días'}
            </button>
          ))}
        </div>
      </div>

      {/* ── KPI Row 1: Revenue & Activity ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard label="Ingresos" value={formatRD(data.totalRevenue)} />
        <KpiCard label="Citas" value={String(data.appointmentsCount)} />
        <KpiCard label="Nuevos Clientes" value={String(data.newClients)} />
        <KpiCard label="Ticket Promedio" value={formatRD(averageTicket)} />
      </div>

      {/* ── KPI Row 2: Health Metrics ── */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        <KpiCard
          label="Tasa Asistencia"
          value={`${data.attendanceRate ?? 0}%`}
          sub={`${data.completedCount ?? 0} completadas`}
          accent="text-emerald-600"
        />
        <KpiCard
          label="No-Shows"
          value={String(data.noShows ?? 0)}
          sub={`${data.noShowRate ?? 0}% de las citas`}
          accent="text-accent"
        />
        <KpiCard
          label="Deuda Pendiente"
          value={debt ? formatRD(debt.totalDebt) : 'RD$0'}
          sub={debt && debt.clientsWithDebt > 0 ? `${debt.clientsWithDebt} cliente${debt.clientsWithDebt > 1 ? 's' : ''} con fía` : 'Sin deudas'}
          accent={debt && debt.totalDebt > 0 ? 'text-amber-600' : 'text-charcoal'}
        />
        <KpiCard
          label="Clientes Inactivos"
          value={String(data.inactiveClients ?? 0)}
          sub="Sin visita en 30+ días"
          accent={data.inactiveClients && data.inactiveClients > 0 ? 'text-amber-600' : 'text-charcoal'}
        />
      </div>

      {/* ── Revenue Chart ── */}
      <div className="bg-white rounded-[1.5rem] p-6 shadow-sm border border-gray-100">
        <h3 className="text-sm font-black text-charcoal uppercase tracking-wider mb-4">Ingresos Diarios</h3>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <AreaChart data={dailyChartData} margin={{ top: 5, right: 5, left: -20, bottom: 0 }}>
              <defs>
                <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#0E2A47" stopOpacity={0.15} />
                  <stop offset="95%" stopColor="#0E2A47" stopOpacity={0} />
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
              <XAxis dataKey="date" tick={{ fontSize: 10, fill: '#9ca3af' }} tickLine={false} axisLine={false} interval="preserveStartEnd" />
              <YAxis tick={{ fontSize: 10, fill: '#9ca3af' }} tickLine={false} axisLine={false} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
              <Tooltip content={<RevenueTooltip />} />
              <Area type="monotone" dataKey="revenue" stroke="#0E2A47" strokeWidth={2.5} fill="url(#revenueGradient)" />
            </AreaChart>
          </ResponsiveContainer>
        </div>
      </div>

      {/* ── Peak Patterns Row ── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Peak Hour + Strongest Day */}
        <div className="bg-white rounded-[1.5rem] p-6 shadow-sm border border-gray-100 flex flex-col justify-center items-center text-center gap-3">
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Hora Pico</p>
          <p className="text-3xl font-black text-primary">{formatHour(peak?.peakHour ?? null)}</p>
          {peak?.peakHourCount ? <p className="text-xs text-gray-500">{peak.peakHourCount} citas en este horario</p> : null}
          <div className="w-full h-px bg-gray-100 my-1" />
          <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">Día Más Fuerte</p>
          <p className="text-3xl font-black text-primary">
            {peak?.strongestDay !== null && peak?.strongestDay !== undefined ? DAY_NAMES[peak.strongestDay] : '—'}
          </p>
          {peak?.strongestDayCount ? <p className="text-xs text-gray-500">{peak.strongestDayCount} citas</p> : null}
        </div>

        {/* Hourly Distribution */}
        <div className="bg-white rounded-[1.5rem] p-6 shadow-sm border border-gray-100">
          <h3 className="text-xs font-black text-charcoal uppercase tracking-wider mb-3">Citas por Hora</h3>
          <div className="h-44">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={hourlyChartData} margin={{ top: 5, right: 5, left: -25, bottom: 0 }}>
                <XAxis dataKey="hour" tick={{ fontSize: 9, fill: '#9ca3af' }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 9, fill: '#9ca3af' }} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip formatter={(v) => [`${v} citas`, 'Citas'] as [string, string]} contentStyle={{ borderRadius: 12, fontSize: 11, fontWeight: 700 }} />
                <Bar dataKey="citas" fill="#0E2A47" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>

        {/* Daily Distribution */}
        <div className="bg-white rounded-[1.5rem] p-6 shadow-sm border border-gray-100">
          <h3 className="text-xs font-black text-charcoal uppercase tracking-wider mb-3">Citas por Día</h3>
          <div className="h-44">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={dayChartData} margin={{ top: 5, right: 5, left: -25, bottom: 0 }}>
                <XAxis dataKey="day" tick={{ fontSize: 10, fill: '#9ca3af' }} tickLine={false} axisLine={false} />
                <YAxis tick={{ fontSize: 9, fill: '#9ca3af' }} tickLine={false} axisLine={false} allowDecimals={false} />
                <Tooltip formatter={(v) => [`${v} citas`, 'Citas'] as [string, string]} contentStyle={{ borderRadius: 12, fontSize: 11, fontWeight: 700 }} />
                <Bar dataKey="citas" fill="#A61E2E" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </div>
      </div>

      {/* ── Services + Stylist Row ── */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Top Services — Pie + List */}
        <div className="bg-white rounded-[1.5rem] p-6 shadow-sm border border-gray-100">
          <h3 className="text-sm font-black text-charcoal uppercase tracking-wider mb-4">Servicios Populares</h3>
          <div className="flex items-center gap-4">
            <div className="w-36 h-36 shrink-0">
              <ResponsiveContainer width="100%" height="100%">
                <PieChart>
                  <Pie data={servicesPieData} dataKey="value" cx="50%" cy="50%" innerRadius={30} outerRadius={60} paddingAngle={2} strokeWidth={0}>
                    {servicesPieData.map((_, i) => (
                      <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />
                    ))}
                  </Pie>
                  <Tooltip formatter={(v) => formatRD(Number(v))} contentStyle={{ borderRadius: 12, fontSize: 11, fontWeight: 700 }} />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="flex-1 space-y-2.5 min-w-0">
              {data.topServices.slice(0, 5).map((s, i) => (
                <div key={i} className="flex items-center gap-2">
                  <div className="w-2.5 h-2.5 rounded-full shrink-0" style={{ backgroundColor: PIE_COLORS[i % PIE_COLORS.length] }} />
                  <span className="text-xs font-bold text-charcoal truncate flex-1">{s.name}</span>
                  <span className="text-[10px] text-gray-400 font-bold shrink-0">{s.count} · {formatRD(s.revenue)}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Stylist Performance */}
        <div className="bg-white rounded-[1.5rem] p-6 shadow-sm border border-gray-100">
          <h3 className="text-sm font-black text-charcoal uppercase tracking-wider mb-4">
            Rendimiento del {t.professional.professionals}
          </h3>
          <div className="space-y-3">
            {data.stylistPerformance
              .sort((a, b) => b.revenue - a.revenue)
              .map((stylist, i) => {
                const maxRev = Math.max(...data.stylistPerformance.map(s => s.revenue));
                const pct = maxRev > 0 ? (stylist.revenue / maxRev) * 100 : 0;
                const avgTicket = stylist.appointments > 0 ? stylist.revenue / stylist.appointments : 0;
                return (
                  <div key={i}>
                    <div className="flex items-center justify-between mb-1">
                      <div className="flex items-center gap-2">
                        <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-[10px] font-black text-primary">
                          {stylist.name.charAt(0).toUpperCase()}
                        </div>
                        <span className="text-xs font-bold text-charcoal">{stylist.name}</span>
                      </div>
                      <span className="text-[10px] text-gray-400 font-bold">
                        {stylist.appointments} citas · {formatRD(stylist.revenue)} · Avg {formatRD(avgTicket)}
                      </span>
                    </div>
                    <div className="w-full bg-gray-100 rounded-full h-1.5">
                      <div className="bg-primary h-1.5 rounded-full transition-all" style={{ width: `${pct}%` }} />
                    </div>
                  </div>
                );
              })}
            {data.stylistPerformance.length === 0 && (
              <p className="text-xs text-gray-400 text-center py-4">Sin datos de profesionales para este período</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
