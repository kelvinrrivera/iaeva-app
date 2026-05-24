import { db } from '@/lib/database';
import { Clock, CheckCircle2, AlertTriangle, XCircle } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import RunCronButton from '@/components/admin/RunCronButton';

export const dynamic = 'force-dynamic';

const KNOWN_CRONS = [
  { name: 'reminders', label: 'Recordatorios de citas', schedule: 'Cada 30 min', path: '/api/cron/reminders' },
  { name: 'walkin-notify', label: 'Avisos de walk-ins', schedule: 'Cada 5 min', path: '/api/cron/walkin-notify' },
  { name: 'owner-digest', label: 'Resumen al dueño', schedule: 'Diario', path: '/api/cron/owner-digest' },
  { name: 'whatsapp-health', label: 'Salud de WhatsApp', schedule: 'Cada hora', path: '/api/cron/whatsapp-health' },
  { name: 'refresh-meta-tokens', label: 'Refresh tokens Meta', schedule: 'Diario', path: '/api/cron/refresh-meta-tokens' },
  { name: 'expire-memberships', label: 'Expirar membresías', schedule: 'Diario', path: '/api/cron/expire-memberships' },
  { name: 'resume-bot', label: 'Reanudar bots pausados', schedule: 'Cada hora', path: '/api/cron/resume-bot' },
  { name: 'downgrade-grace-expired', label: 'Downgrade tras gracia', schedule: 'Diario', path: '/api/cron/downgrade-grace-expired' },
  { name: 'cleanup-logs', label: 'Limpieza de logs antiguos', schedule: 'Diario', path: '/api/cron/cleanup-logs' },
];

export default async function CronsPage() {
  const runs = await db.cronRun.findMany({
    orderBy: { startedAt: 'desc' },
    take: 100,
  });

  // Agrupar por nombre
  const byName = new Map<string, typeof runs>();
  for (const r of runs) {
    const arr = byName.get(r.name) || [];
    arr.push(r);
    byName.set(r.name, arr);
  }

  return (
    <div className="space-y-6 max-w-7xl">
      <div>
        <h1 className="text-2xl font-black text-charcoal">Cron jobs</h1>
        <p className="text-sm text-gray-500 mt-1">Ejecuciones programadas del sistema</p>
      </div>

      <div className="space-y-3">
        {KNOWN_CRONS.map(cron => {
          const cronRuns = byName.get(cron.name) || [];
          const last = cronRuns[0];

          return (
            <div key={cron.name} className="bg-white border border-gray-200 rounded-2xl p-5">
              <div className="flex items-start justify-between gap-4 mb-3">
                <div>
                  <div className="flex items-center gap-2">
                    <Clock className="h-4 w-4 text-gray-400" />
                    <h2 className="text-sm font-black text-charcoal">{cron.label}</h2>
                  </div>
                  <p className="text-[11px] text-gray-400 font-mono mt-0.5">{cron.path} · {cron.schedule}</p>
                </div>
                <RunCronButton path={cron.path} label="Ejecutar ahora" />
              </div>

              {last ? (
                <div className="flex items-center gap-4 text-xs mt-3 pt-3 border-t border-gray-100">
                  {last.status === 'success' ? (
                    <CheckCircle2 className="h-4 w-4 text-emerald-500" />
                  ) : last.status === 'partial' ? (
                    <AlertTriangle className="h-4 w-4 text-amber-500" />
                  ) : (
                    <XCircle className="h-4 w-4 text-red-500" />
                  )}
                  <div>
                    <p className="text-charcoal font-bold">Última: {format(last.startedAt, "d MMM HH:mm:ss", { locale: es })}</p>
                    <p className="text-gray-500">
                      {last.itemsSent} enviados · {last.itemsErrors} errores · {last.itemsDeferred} diferidos · {last.durationMs ? `${last.durationMs}ms` : '—'}
                    </p>
                  </div>
                </div>
              ) : (
                <p className="text-xs text-gray-400 mt-2">Sin ejecuciones registradas todavía.</p>
              )}

              {cronRuns.length > 1 && (
                <details className="mt-3 text-xs">
                  <summary className="cursor-pointer text-gray-500 hover:text-charcoal">
                    Historial ({cronRuns.length - 1} ejecuciones más)
                  </summary>
                  <table className="w-full mt-2 text-xs">
                    <thead className="text-gray-400 uppercase tracking-wider text-[10px]">
                      <tr>
                        <th className="text-left py-1">Inicio</th>
                        <th className="text-left py-1">Estado</th>
                        <th className="text-right py-1">Enviados</th>
                        <th className="text-right py-1">Errores</th>
                        <th className="text-right py-1">Diferidos</th>
                        <th className="text-right py-1">Duración</th>
                      </tr>
                    </thead>
                    <tbody>
                      {cronRuns.slice(1, 20).map(r => (
                        <tr key={r.id} className="border-t border-gray-50">
                          <td className="py-1 text-gray-600">{format(r.startedAt, "d MMM HH:mm:ss", { locale: es })}</td>
                          <td className="py-1">
                            <span className={`px-1.5 py-0.5 rounded font-bold text-[10px] ${
                              r.status === 'success' ? 'bg-emerald-100 text-emerald-700' :
                              r.status === 'partial' ? 'bg-amber-100 text-amber-700' :
                              r.status === 'failed' ? 'bg-red-100 text-red-700' :
                              'bg-gray-100 text-gray-600'
                            }`}>{r.status}</span>
                          </td>
                          <td className="py-1 text-right">{r.itemsSent}</td>
                          <td className="py-1 text-right text-red-600">{r.itemsErrors}</td>
                          <td className="py-1 text-right text-amber-600">{r.itemsDeferred}</td>
                          <td className="py-1 text-right text-gray-500">{r.durationMs ? `${r.durationMs}ms` : '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </details>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}
