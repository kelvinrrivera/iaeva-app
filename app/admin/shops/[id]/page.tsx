import { db } from '@/lib/database';
import { notFound } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import ShopActions from '@/components/admin/ShopActions';

export const dynamic = 'force-dynamic';

interface PageProps {
  params: Promise<{ id: string }>;
}

function since24h() {
  return new Date(Date.now() - 24 * 60 * 60 * 1000);
}

export default async function ShopDetailPage({ params }: PageProps) {
  const { id } = await params;
  const shop = await db.shop.findUnique({
    where: { id },
    include: {
      memberships: { include: { user: true } },
      _count: {
        select: {
          appointments: true,
          stylists: true,
          services: true,
          clients: true,
          whatsappTemplates: true,
        },
      },
      reminderConfig: true,
    },
  });
  if (!shop) notFound();

  const [recentAppts, recentMessages, recentLogs] = await Promise.all([
    db.appointment.findMany({
      where: { shopId: id },
      orderBy: { createdAt: 'desc' },
      take: 10,
      include: { service: { select: { name: true } }, stylist: { select: { name: true } } },
    }),
    db.chatHistory.count({ where: { shopId: id, createdAt: { gte: since24h() } } }),
    db.systemLog.findMany({
      where: { shopId: id },
      orderBy: { createdAt: 'desc' },
      take: 15,
    }),
  ]);

  return (
    <div className="space-y-6 max-w-6xl">
      <Link href="/admin/shops" className="inline-flex items-center gap-2 text-xs text-gray-500 hover:text-charcoal">
        <ArrowLeft className="h-3.5 w-3.5" /> Volver a Negocios
      </Link>

      <div className="flex items-start justify-between gap-6">
        <div>
          <h1 className="text-2xl font-black text-charcoal">{shop.name}</h1>
          <p className="text-xs text-gray-400 font-mono mt-1">{shop.id}</p>
          <p className="text-sm text-gray-500 mt-1">
            Creado el {format(shop.createdAt, "d 'de' MMMM yyyy", { locale: es })}
          </p>
        </div>
        <span className={`text-[11px] px-2.5 py-1 rounded font-bold ${
          shop.plan === 'BUSINESS' ? 'bg-fuchsia-100 text-fuchsia-700' :
          shop.plan === 'TEAM' ? 'bg-blue-100 text-blue-700' :
          shop.plan === 'SOLO' ? 'bg-emerald-100 text-emerald-700' :
          'bg-gray-100 text-gray-600'
        }`}>{shop.plan}</span>
      </div>

      {/* Owner / acciones */}
      <ShopActions shopId={shop.id} shopName={shop.name} currentPlan={shop.plan} owner={shop.memberships[0]?.user ?? null} />

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <p className="text-[10px] uppercase tracking-wider text-gray-400">Citas totales</p>
          <p className="text-xl font-black text-charcoal mt-1">{shop._count.appointments}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <p className="text-[10px] uppercase tracking-wider text-gray-400">Mensajes 24h</p>
          <p className="text-xl font-black text-charcoal mt-1">{recentMessages}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <p className="text-[10px] uppercase tracking-wider text-gray-400">Equipo</p>
          <p className="text-xl font-black text-charcoal mt-1">{shop._count.stylists}</p>
        </div>
        <div className="bg-white border border-gray-200 rounded-xl p-4">
          <p className="text-[10px] uppercase tracking-wider text-gray-400">Clientes</p>
          <p className="text-xl font-black text-charcoal mt-1">{shop._count.clients}</p>
        </div>
      </div>

      {/* WhatsApp status */}
      <div className="bg-white border border-gray-200 rounded-2xl p-5">
        <h2 className="text-sm font-black text-charcoal mb-3">WhatsApp</h2>
        <div className="grid grid-cols-2 md:grid-cols-3 gap-4 text-sm">
          <div>
            <p className="text-[11px] text-gray-400">Estado</p>
            {shop.whatsappEnabled && shop.wabaId ? (
              <p className="text-emerald-700 font-bold">Conectado</p>
            ) : (
              <p className="text-gray-400 font-bold">Desconectado</p>
            )}
          </div>
          <div>
            <p className="text-[11px] text-gray-400">Número</p>
            <p className="font-mono text-xs">{shop.whatsappPhoneNumber || '—'}</p>
          </div>
          <div>
            <p className="text-[11px] text-gray-400">WABA ID</p>
            <p className="font-mono text-xs">{shop.wabaId || '—'}</p>
          </div>
          <div>
            <p className="text-[11px] text-gray-400">Templates</p>
            <p>{shop._count.whatsappTemplates}</p>
          </div>
          <div>
            <p className="text-[11px] text-gray-400">Timezone</p>
            <p>{shop.timezone || '—'}</p>
          </div>
          <div>
            <p className="text-[11px] text-gray-400">Tipo</p>
            <p>{shop.shopType}</p>
          </div>
        </div>
      </div>

      {/* Recent appointments */}
      <div className="bg-white border border-gray-200 rounded-2xl p-5">
        <h2 className="text-sm font-black text-charcoal mb-3">Últimas citas</h2>
        {recentAppts.length === 0 ? (
          <p className="text-xs text-gray-400">No hay citas.</p>
        ) : (
          <table className="w-full text-xs">
            <thead className="text-gray-400 uppercase tracking-wider text-[10px]">
              <tr>
                <th className="text-left py-2">Cliente</th>
                <th className="text-left py-2">Servicio</th>
                <th className="text-left py-2">Cuándo</th>
                <th className="text-left py-2">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {recentAppts.map(a => (
                <tr key={a.id}>
                  <td className="py-2">{a.clientName}</td>
                  <td className="py-2 text-gray-500">{a.service?.name}</td>
                  <td className="py-2 text-gray-500">{format(a.startTime, "d MMM HH:mm", { locale: es })}</td>
                  <td className="py-2">
                    <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${
                      a.status === 'CONFIRMED' ? 'bg-emerald-100 text-emerald-700' :
                      a.status === 'CANCELLED' ? 'bg-red-100 text-red-700' :
                      a.status === 'COMPLETED' ? 'bg-blue-100 text-blue-700' :
                      'bg-gray-100 text-gray-600'
                    }`}>{a.status}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Logs */}
      <div className="bg-white border border-gray-200 rounded-2xl p-5">
        <h2 className="text-sm font-black text-charcoal mb-3">Eventos recientes</h2>
        {recentLogs.length === 0 ? (
          <p className="text-xs text-gray-400">Sin eventos registrados todavía.</p>
        ) : (
          <ul className="text-xs space-y-1.5 font-mono">
            {recentLogs.map(l => (
              <li key={l.id} className="flex gap-3">
                <span className="text-gray-400">{format(l.createdAt, 'MM-dd HH:mm:ss')}</span>
                <span className={`font-bold ${
                  l.severity === 'error' ? 'text-red-600' :
                  l.severity === 'warn' ? 'text-amber-600' :
                  'text-gray-700'
                }`}>{l.type}</span>
                {l.message && <span className="text-gray-600">— {l.message}</span>}
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
