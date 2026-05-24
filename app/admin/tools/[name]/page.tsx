import { db } from '@/lib/database';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ name: string }>;
}

function since(ms: number) {
  return new Date(Date.now() - ms);
}

export default async function ToolDetailPage({ params }: PageProps) {
  const { name: rawName } = await params;
  const toolName = decodeURIComponent(rawName);

  const d14d = since(14 * 24 * 60 * 60 * 1000);
  const d7d = since(7 * 24 * 60 * 60 * 1000);

  const [recentErrors, recentCalls, dailyCounts, errorBreakdown, topShops] = await Promise.all([
    db.toolCall.findMany({
      where: { toolName, status: 'error', createdAt: { gte: d7d } },
      orderBy: { createdAt: 'desc' },
      take: 20,
    }),
    db.toolCall.findMany({
      where: { toolName, createdAt: { gte: d7d } },
      orderBy: { createdAt: 'desc' },
      take: 20,
    }),
    db.toolCall.findMany({
      where: { toolName, createdAt: { gte: d14d } },
      select: { createdAt: true, status: true },
    }),
    db.toolCall.groupBy({
      by: ['errorCode'],
      where: { toolName, createdAt: { gte: d7d }, status: 'error' },
      _count: { _all: true },
      orderBy: { _count: { id: 'desc' } },
    }),
    db.toolCall.groupBy({
      by: ['shopId'],
      where: { toolName, createdAt: { gte: d7d }, shopId: { not: null } },
      _count: { _all: true },
      orderBy: { _count: { id: 'desc' } },
      take: 5,
    }),
  ]);

  // Build daily series (last 14 days)
  const day = 24 * 60 * 60 * 1000;
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const daily: { date: string; success: number; error: number }[] = [];
  for (let i = 13; i >= 0; i--) {
    const start = new Date(today.getTime() - i * day);
    const end = new Date(start.getTime() + day);
    const calls = dailyCounts.filter((c) => c.createdAt >= start && c.createdAt < end);
    daily.push({
      date: start.toISOString().slice(5, 10),
      success: calls.filter((c) => c.status === 'success').length,
      error: calls.filter((c) => c.status === 'error').length,
    });
  }
  const maxBar = Math.max(1, ...daily.map((d) => d.success + d.error));

  // Top shops with shop names
  const shopIds = topShops.map((t) => t.shopId).filter(Boolean) as string[];
  const shops = await db.shop.findMany({
    where: { id: { in: shopIds } },
    select: { id: true, name: true },
  });
  const shopMap = new Map(shops.map((s) => [s.id, s.name]));

  return (
    <div className="space-y-6 max-w-7xl">
      <Link href="/admin/tools" className="inline-flex items-center gap-2 text-xs text-gray-500 hover:text-charcoal">
        <ArrowLeft className="h-3.5 w-3.5" /> Volver a Tools
      </Link>

      <div>
        <h1 className="text-2xl font-black text-charcoal font-mono">{toolName}</h1>
        <p className="text-sm text-gray-500 mt-1">Detalle de uso y errores (últimos 7-14 días)</p>
      </div>

      {/* Chart */}
      <div className="bg-white border border-gray-200 rounded-2xl p-5">
        <p className="text-sm font-black text-charcoal mb-4">Llamadas por día — 14 días</p>
        <div className="flex items-end gap-1.5 h-32">
          {daily.map((d, i) => {
            const successH = (d.success / maxBar) * 100;
            const errorH = (d.error / maxBar) * 100;
            return (
              <div key={i} className="flex-1 flex flex-col items-center justify-end" title={`${d.date}: ${d.success} ok, ${d.error} err`}>
                <div className="w-full flex flex-col justify-end h-full">
                  {d.error > 0 && <div className="w-full bg-red-500" style={{ height: `${errorH}%` }} />}
                  {d.success > 0 && <div className="w-full bg-emerald-500" style={{ height: `${successH}%` }} />}
                </div>
                <p className="text-[9px] text-gray-400 mt-1">{d.date}</p>
              </div>
            );
          })}
        </div>
        <div className="flex items-center gap-4 mt-3 text-[11px] text-gray-500">
          <span className="inline-flex items-center gap-1"><span className="h-2 w-2 bg-emerald-500 rounded-sm"></span>Éxito</span>
          <span className="inline-flex items-center gap-1"><span className="h-2 w-2 bg-red-500 rounded-sm"></span>Error</span>
        </div>
      </div>

      {/* Two columns */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {/* Error breakdown */}
        <div className="bg-white border border-gray-200 rounded-2xl p-5">
          <p className="text-sm font-black text-charcoal mb-3">Errores por tipo (7d)</p>
          {errorBreakdown.length === 0 ? (
            <p className="text-xs text-gray-400">Sin errores en 7 días</p>
          ) : (
            <div className="space-y-2">
              {errorBreakdown.map((e) => {
                const total = errorBreakdown.reduce((a, b) => a + b._count._all, 0);
                const pct = (e._count._all / total) * 100;
                return (
                  <div key={e.errorCode} className="flex items-center gap-3 text-xs">
                    <span className="font-mono text-gray-700 w-48 truncate">{e.errorCode ?? 'unknown'}</span>
                    <div className="flex-1 h-5 bg-gray-100 rounded">
                      <div className="h-full bg-red-500 rounded" style={{ width: `${pct}%` }} />
                    </div>
                    <span className="font-bold text-gray-700 w-12 text-right">{e._count._all}</span>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Top shops */}
        <div className="bg-white border border-gray-200 rounded-2xl p-5">
          <p className="text-sm font-black text-charcoal mb-3">Top shops (7d)</p>
          {topShops.length === 0 ? (
            <p className="text-xs text-gray-400">Sin llamadas con shopId</p>
          ) : (
            <div className="space-y-2">
              {topShops.map((t) => (
                <div key={t.shopId} className="flex items-center justify-between text-xs">
                  <Link href={`/admin/shops/${t.shopId}`} className="text-fuchsia-600 hover:underline truncate">
                    {shopMap.get(t.shopId!) ?? t.shopId}
                  </Link>
                  <span className="font-bold text-gray-700">{t._count._all}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Recent errors */}
      <div className="bg-white border border-gray-200 rounded-2xl p-5">
        <p className="text-sm font-black text-charcoal mb-3">Errores recientes (20 últimos)</p>
        {recentErrors.length === 0 ? (
          <p className="text-xs text-gray-400">Sin errores en 7 días</p>
        ) : (
          <table className="w-full text-xs">
            <thead className="text-gray-400 uppercase tracking-wider text-[10px]">
              <tr>
                <th className="text-left py-2">Cuándo</th>
                <th className="text-left py-2">Shop</th>
                <th className="text-left py-2">Cliente</th>
                <th className="text-left py-2">Error</th>
                <th className="text-left py-2">Output</th>
                <th className="text-right py-2">ms</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {recentErrors.map((c) => (
                <tr key={c.id}>
                  <td className="py-2 text-gray-500 whitespace-nowrap font-mono">
                    {format(c.createdAt, 'MM-dd HH:mm:ss')}
                  </td>
                  <td className="py-2 font-mono text-gray-500">
                    {c.shopId ? <Link href={`/admin/shops/${c.shopId}`} className="hover:underline">{c.shopId.slice(0, 8)}…</Link> : '—'}
                  </td>
                  <td className="py-2 font-mono text-gray-500">{c.phoneNumber ?? '—'}</td>
                  <td className="py-2">
                    <span className="font-mono text-[10px] bg-red-50 text-red-700 px-1.5 py-0.5 rounded">{c.errorCode ?? 'unknown'}</span>
                  </td>
                  <td className="py-2 text-gray-600 font-mono text-[10px] max-w-md truncate">{c.outputPreview ?? ''}</td>
                  <td className="py-2 text-right text-gray-500">{c.durationMs}</td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Recent calls */}
      <div className="bg-white border border-gray-200 rounded-2xl p-5">
        <p className="text-sm font-black text-charcoal mb-3">Últimas llamadas (todas, 20)</p>
        <table className="w-full text-xs">
          <thead className="text-gray-400 uppercase tracking-wider text-[10px]">
            <tr>
              <th className="text-left py-2">Cuándo</th>
              <th className="text-left py-2">Status</th>
              <th className="text-left py-2">Shop</th>
              <th className="text-left py-2">Input</th>
              <th className="text-right py-2">ms</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {recentCalls.map((c) => (
              <tr key={c.id}>
                <td className="py-2 text-gray-500 whitespace-nowrap font-mono">{format(c.createdAt, 'MM-dd HH:mm:ss')}</td>
                <td className="py-2">
                  <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${
                    c.status === 'success' ? 'bg-emerald-100 text-emerald-700' : 'bg-red-100 text-red-700'
                  }`}>{c.status}</span>
                </td>
                <td className="py-2 font-mono text-gray-500">
                  {c.shopId ? <Link href={`/admin/shops/${c.shopId}`} className="hover:underline">{c.shopId.slice(0, 8)}…</Link> : '—'}
                </td>
                <td className="py-2 text-gray-600 font-mono text-[10px] max-w-md truncate">{c.inputPreview ?? ''}</td>
                <td className="py-2 text-right text-gray-500">{c.durationMs}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
