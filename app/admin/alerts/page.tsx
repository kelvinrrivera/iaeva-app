import { db } from '@/lib/database';
import Link from 'next/link';
import { AlertTriangle, AlertCircle } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

export const dynamic = 'force-dynamic';

interface Alert {
  severity: 'error' | 'warning';
  title: string;
  detail: string;
  href?: string;
}

async function computeAlerts(): Promise<Alert[]> {
  const alerts: Alert[] = [];
  const now = new Date();
  const day = 24 * 60 * 60 * 1000;

  // 1. Errors in the last 24h
  const errorCount = await db.systemLog.count({
    where: { severity: 'error', createdAt: { gte: new Date(now.getTime() - day) } },
  });
  if (errorCount > 0) {
    alerts.push({
      severity: 'error',
      title: `${errorCount} errores en las últimas 24h`,
      detail: 'Revisa los logs del sistema para detalle.',
      href: '/admin/logs?severity=error',
    });
  }

  // 2. Failed cron runs in the last 24h
  const failedCrons = await db.cronRun.findMany({
    where: { status: 'failed', startedAt: { gte: new Date(now.getTime() - day) } },
    orderBy: { startedAt: 'desc' },
    take: 5,
  });
  for (const c of failedCrons) {
    alerts.push({
      severity: 'error',
      title: `Cron "${c.name}" falló`,
      detail: `${format(c.startedAt, "d MMM HH:mm", { locale: es })} — ${c.errorMessage || 'sin detalle'}`,
      href: '/admin/crons',
    });
  }

  // 3. Shops on paid plan WITHOUT WhatsApp connected
  const shopsPaidNoWa = await db.shop.findMany({
    where: {
      plan: { in: ['SOLO', 'TEAM', 'BUSINESS'] },
      whatsappEnabled: false,
    },
    select: { id: true, name: true, plan: true, createdAt: true },
    take: 10,
  });
  for (const s of shopsPaidNoWa) {
    const daysOld = Math.floor((now.getTime() - s.createdAt.getTime()) / day);
    if (daysOld > 2) {
      alerts.push({
        severity: 'warning',
        title: `"${s.name}" (${s.plan}) sin WhatsApp tras ${daysOld} días`,
        detail: 'Cliente pagó pero no completó setup. Buen momento para contactar.',
        href: `/admin/shops/${s.id}`,
      });
    }
  }

  // 4. Templates rejected (recent)
  const rejected = await db.whatsAppTemplate.findMany({
    where: { status: 'REJECTED', updatedAt: { gte: new Date(now.getTime() - 7 * day) } },
    include: { shop: { select: { name: true } } },
    take: 5,
  });
  for (const t of rejected) {
    alerts.push({
      severity: 'warning',
      title: `Plantilla "${t.name}" rechazada por Meta`,
      detail: `${t.shop?.name ?? '?'} — ${t.rejectionReason || 'sin razón'}`,
      href: `/admin/shops/${t.shopId}`,
    });
  }

  // 5. Reminders deferred massively (last cron run)
  const lastReminderCron = await db.cronRun.findFirst({
    where: { name: 'reminders' },
    orderBy: { startedAt: 'desc' },
  });
  if (lastReminderCron && lastReminderCron.itemsDeferred > 20) {
    alerts.push({
      severity: 'warning',
      title: `${lastReminderCron.itemsDeferred} recordatorios diferidos en última corrida`,
      detail: 'Volumen alto de quiet hours. Verifica que sea esperado.',
      href: '/admin/crons',
    });
  }

  return alerts;
}

export default async function AlertsPage() {
  const alerts = await computeAlerts();
  const errors = alerts.filter(a => a.severity === 'error');
  const warnings = alerts.filter(a => a.severity === 'warning');

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-2xl font-black text-charcoal">Alertas activas</h1>
        <p className="text-sm text-gray-500 mt-1">{alerts.length} situaciones que requieren atención</p>
      </div>

      {alerts.length === 0 && (
        <div className="bg-emerald-50 border border-emerald-200 rounded-2xl p-8 text-center">
          <AlertCircle className="h-8 w-8 text-emerald-500 mx-auto mb-2" />
          <p className="text-sm font-bold text-emerald-800">Todo en orden</p>
          <p className="text-xs text-emerald-700 mt-1">No hay alertas activas en este momento.</p>
        </div>
      )}

      {errors.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-wider text-red-600 font-black">Errores · {errors.length}</p>
          {errors.map((a, i) => (
            <Link
              key={i}
              href={a.href || '#'}
              className="block bg-white border-l-4 border-red-500 border border-gray-200 rounded-r-xl p-4 hover:shadow-sm transition-shadow"
            >
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-red-500 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-bold text-charcoal">{a.title}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{a.detail}</p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}

      {warnings.length > 0 && (
        <div className="space-y-2">
          <p className="text-xs uppercase tracking-wider text-amber-600 font-black">Avisos · {warnings.length}</p>
          {warnings.map((a, i) => (
            <Link
              key={i}
              href={a.href || '#'}
              className="block bg-white border-l-4 border-amber-500 border border-gray-200 rounded-r-xl p-4 hover:shadow-sm transition-shadow"
            >
              <div className="flex items-start gap-3">
                <AlertTriangle className="h-5 w-5 text-amber-500 shrink-0 mt-0.5" />
                <div>
                  <p className="text-sm font-bold text-charcoal">{a.title}</p>
                  <p className="text-xs text-gray-500 mt-0.5">{a.detail}</p>
                </div>
              </div>
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}
