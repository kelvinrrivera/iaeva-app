import { db } from '@/lib/database';
import Link from 'next/link';
import { Wrench, TrendingUp, AlertTriangle, Clock } from 'lucide-react';

export const dynamic = 'force-dynamic';

function since(ms: number) {
  return new Date(Date.now() - ms);
}

interface ToolSummary {
  toolName: string;
  calls24h: number;
  calls7d: number;
  calls30d: number;
  success30d: number;
  error30d: number;
  successRate: number; // 0..1
  avgLatencyMs: number;
  p95LatencyMs: number;
  topErrors: { code: string; count: number }[];
}

async function loadSummaries(): Promise<ToolSummary[]> {
  const d24h = since(24 * 60 * 60 * 1000);
  const d7d = since(7 * 24 * 60 * 60 * 1000);
  const d30d = since(30 * 24 * 60 * 60 * 1000);

  // All distinct tools seen in the last 30 days
  const distinct = await db.toolCall.groupBy({
    by: ['toolName'],
    where: { createdAt: { gte: d30d } },
    _count: { _all: true },
  });

  const summaries: ToolSummary[] = await Promise.all(
    distinct.map(async (row) => {
      const toolName = row.toolName;

      const [c24h, c7d, c30d, success30d, latencies, errorGroups] = await Promise.all([
        db.toolCall.count({ where: { toolName, createdAt: { gte: d24h } } }),
        db.toolCall.count({ where: { toolName, createdAt: { gte: d7d } } }),
        db.toolCall.count({ where: { toolName, createdAt: { gte: d30d } } }),
        db.toolCall.count({ where: { toolName, createdAt: { gte: d30d }, status: 'success' } }),
        db.toolCall.findMany({
          where: { toolName, createdAt: { gte: d7d } },
          select: { durationMs: true },
          orderBy: { durationMs: 'asc' },
          take: 1000,
        }),
        db.toolCall.groupBy({
          by: ['errorCode'],
          where: { toolName, createdAt: { gte: d7d }, status: 'error' },
          _count: { _all: true },
          orderBy: { _count: { id: 'desc' } },
          take: 3,
        }),
      ]);

      const durations = latencies.map((l) => l.durationMs);
      const avgLatencyMs = durations.length
        ? durations.reduce((a, b) => a + b, 0) / durations.length
        : 0;
      const p95Index = Math.floor(durations.length * 0.95);
      const p95LatencyMs = durations.length ? durations[Math.min(p95Index, durations.length - 1)] : 0;

      return {
        toolName,
        calls24h: c24h,
        calls7d: c7d,
        calls30d: c30d,
        success30d,
        error30d: c30d - success30d,
        successRate: c30d > 0 ? success30d / c30d : 1,
        avgLatencyMs: Math.round(avgLatencyMs),
        p95LatencyMs: Math.round(p95LatencyMs),
        topErrors: errorGroups.map((g) => ({
          code: g.errorCode ?? 'unknown',
          count: g._count._all,
        })),
      };
    }),
  );

  return summaries.sort((a, b) => b.calls30d - a.calls30d);
}

export default async function ToolsPage() {
  const summaries = await loadSummaries();
  const totalCalls = summaries.reduce((acc, s) => acc + s.calls30d, 0);
  const totalErrors = summaries.reduce((acc, s) => acc + s.error30d, 0);
  const overallRate = totalCalls > 0 ? ((totalCalls - totalErrors) / totalCalls) * 100 : 100;

  return (
    <div className="space-y-6 max-w-7xl">
      <div>
        <h1 className="text-2xl font-black text-charcoal">Tools del chatbot</h1>
        <p className="text-sm text-gray-500 mt-1">
          Observabilidad de las llamadas que hace el LLM agent. Últimos 30 días.
        </p>
      </div>

      {/* Top KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white border border-gray-200 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-bold uppercase tracking-wider text-gray-400">Llamadas 30d</p>
            <Wrench className="h-4 w-4 text-gray-400" />
          </div>
          <p className="text-3xl font-black text-charcoal">{totalCalls.toLocaleString('en-US')}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-bold uppercase tracking-wider text-gray-400">Tasa éxito</p>
            <TrendingUp className="h-4 w-4 text-gray-400" />
          </div>
          <p className={`text-3xl font-black ${overallRate >= 90 ? 'text-emerald-600' : overallRate >= 75 ? 'text-amber-600' : 'text-red-600'}`}>
            {overallRate.toFixed(1)}%
          </p>
        </div>
        <div className="bg-white border border-gray-200 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-bold uppercase tracking-wider text-gray-400">Errores 30d</p>
            <AlertTriangle className="h-4 w-4 text-gray-400" />
          </div>
          <p className="text-3xl font-black text-charcoal">{totalErrors.toLocaleString('en-US')}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-2xl p-5">
          <div className="flex items-center justify-between mb-2">
            <p className="text-xs font-bold uppercase tracking-wider text-gray-400">Tools activas</p>
            <Clock className="h-4 w-4 text-gray-400" />
          </div>
          <p className="text-3xl font-black text-charcoal">{summaries.length}</p>
        </div>
      </div>

      {/* Per-tool table */}
      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-[11px] uppercase tracking-wider text-gray-500">
            <tr>
              <th className="px-4 py-3 text-left font-bold">Tool</th>
              <th className="px-4 py-3 text-right font-bold">24h</th>
              <th className="px-4 py-3 text-right font-bold">7d</th>
              <th className="px-4 py-3 text-right font-bold">30d</th>
              <th className="px-4 py-3 text-right font-bold">Tasa éxito</th>
              <th className="px-4 py-3 text-right font-bold">Latencia avg</th>
              <th className="px-4 py-3 text-right font-bold">p95</th>
              <th className="px-4 py-3 text-left font-bold">Top errores 7d</th>
              <th className="px-4 py-3 text-right font-bold"></th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {summaries.length === 0 && (
              <tr>
                <td colSpan={9} className="px-4 py-12 text-center text-gray-400">
                  Sin llamadas registradas todavía. Empieza a conversar con el bot y aparecerán aquí.
                </td>
              </tr>
            )}
            {summaries.map((s) => (
              <tr key={s.toolName} className="hover:bg-gray-50 transition-colors">
                <td className="px-4 py-3 font-mono font-bold text-charcoal">{s.toolName}</td>
                <td className="px-4 py-3 text-right text-gray-700">{s.calls24h}</td>
                <td className="px-4 py-3 text-right text-gray-700">{s.calls7d}</td>
                <td className="px-4 py-3 text-right text-gray-700">{s.calls30d}</td>
                <td className="px-4 py-3 text-right">
                  <span className={`text-xs font-bold ${
                    s.successRate >= 0.9 ? 'text-emerald-700' :
                    s.successRate >= 0.75 ? 'text-amber-700' :
                    'text-red-700'
                  }`}>
                    {(s.successRate * 100).toFixed(1)}%
                  </span>
                </td>
                <td className="px-4 py-3 text-right font-mono text-xs text-gray-600">{s.avgLatencyMs} ms</td>
                <td className="px-4 py-3 text-right font-mono text-xs text-gray-600">{s.p95LatencyMs} ms</td>
                <td className="px-4 py-3 text-xs text-gray-500">
                  {s.topErrors.length === 0 ? (
                    <span className="text-gray-300">—</span>
                  ) : (
                    <div className="space-y-0.5">
                      {s.topErrors.map((e) => (
                        <div key={e.code} className="flex items-center gap-1">
                          <span className="font-mono text-[10px] bg-red-50 text-red-700 px-1.5 py-0.5 rounded">{e.code}</span>
                          <span className="text-[10px] text-gray-400">×{e.count}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </td>
                <td className="px-4 py-3 text-right">
                  <Link href={`/admin/tools/${encodeURIComponent(s.toolName)}`} className="text-fuchsia-600 hover:text-fuchsia-700 font-bold text-xs">
                    Detalle →
                  </Link>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
