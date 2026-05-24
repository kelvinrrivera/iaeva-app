'use client';

import { useEffect, useState } from 'react';
import { Activity, CheckCircle2, AlertTriangle, XCircle, HelpCircle, RefreshCw } from 'lucide-react';

interface Check {
  name: string;
  status: 'ok' | 'degraded' | 'down' | 'unknown';
  latencyMs: number | null;
  detail?: string;
}

export default function HealthPage() {
  const [data, setData] = useState<{ overall: string; checks: Check[]; timestamp: string } | null>(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const load = async () => {
    setRefreshing(true);
    try {
      const res = await fetch('/api/admin/health');
      if (res.ok) setData(await res.json());
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  };

  useEffect(() => {
    load();
    const interval = setInterval(load, 30_000);
    return () => clearInterval(interval);
  }, []);

  const icon = (s: Check['status']) => {
    if (s === 'ok') return <CheckCircle2 className="h-5 w-5 text-emerald-500" />;
    if (s === 'degraded') return <AlertTriangle className="h-5 w-5 text-amber-500" />;
    if (s === 'down') return <XCircle className="h-5 w-5 text-red-500" />;
    return <HelpCircle className="h-5 w-5 text-gray-400" />;
  };

  if (loading) return <p className="text-sm text-gray-400">Cargando estado…</p>;

  return (
    <div className="space-y-6 max-w-5xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-charcoal">Salud del sistema</h1>
          <p className="text-sm text-gray-500 mt-1">Estado de dependencias externas. Auto-refresca cada 30s.</p>
        </div>
        <button
          onClick={load}
          disabled={refreshing}
          className="inline-flex items-center gap-2 px-4 py-2 bg-charcoal text-white rounded-lg text-sm font-bold disabled:opacity-50"
        >
          <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
          Refrescar
        </button>
      </div>

      {data && (
        <>
          <div className={`p-5 rounded-2xl border ${
            data.overall === 'ok' ? 'border-emerald-200 bg-emerald-50' :
            'border-amber-200 bg-amber-50'
          }`}>
            <div className="flex items-center gap-3">
              {data.overall === 'ok' ? (
                <CheckCircle2 className="h-6 w-6 text-emerald-600" />
              ) : (
                <AlertTriangle className="h-6 w-6 text-amber-600" />
              )}
              <div>
                <p className="text-sm font-black text-charcoal">
                  {data.overall === 'ok' ? 'Todos los servicios operativos' : 'Servicio(s) con problemas'}
                </p>
                <p className="text-xs text-gray-500">Actualizado {new Date(data.timestamp).toLocaleTimeString('es-DO')}</p>
              </div>
            </div>
          </div>

          <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-gray-50 text-[11px] uppercase tracking-wider text-gray-500">
                <tr>
                  <th className="px-4 py-3 text-left font-bold">Servicio</th>
                  <th className="px-4 py-3 text-left font-bold">Estado</th>
                  <th className="px-4 py-3 text-right font-bold">Latencia</th>
                  <th className="px-4 py-3 text-left font-bold">Detalle</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {data.checks.map((c, i) => (
                  <tr key={i} className="hover:bg-gray-50">
                    <td className="px-4 py-3 font-bold text-charcoal">{c.name}</td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-2">
                        {icon(c.status)}
                        <span className={`text-xs font-bold ${
                          c.status === 'ok' ? 'text-emerald-700' :
                          c.status === 'down' ? 'text-red-700' :
                          c.status === 'degraded' ? 'text-amber-700' :
                          'text-gray-500'
                        }`}>{c.status.toUpperCase()}</span>
                      </div>
                    </td>
                    <td className="px-4 py-3 text-right font-mono text-xs text-gray-600">
                      {c.latencyMs != null ? `${c.latencyMs} ms` : '—'}
                    </td>
                    <td className="px-4 py-3 text-xs text-gray-500">{c.detail || ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </div>
  );
}
