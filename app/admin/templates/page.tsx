import { db } from '@/lib/database';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: Promise<{ status?: string; purpose?: string }>;
}

export default async function TemplatesPage({ searchParams }: PageProps) {
  const { status = '', purpose = '' } = await searchParams;

  const where: any = {};
  if (status) where.status = status;
  if (purpose) where.purpose = purpose;

  const [templates, byStatus] = await Promise.all([
    db.whatsAppTemplate.findMany({
      where,
      orderBy: { updatedAt: 'desc' },
      take: 200,
      include: { shop: { select: { name: true, id: true } } },
    }),
    db.whatsAppTemplate.groupBy({
      by: ['status'],
      _count: { _all: true },
    }),
  ]);

  const counts: Record<string, number> = {};
  for (const r of byStatus) counts[r.status] = r._count._all;

  return (
    <div className="space-y-6 max-w-7xl">
      <div>
        <h1 className="text-2xl font-black text-charcoal">Plantillas WhatsApp</h1>
        <p className="text-sm text-gray-500 mt-1">Vista global de plantillas en todos los shops</p>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
        {(['DRAFT', 'PENDING', 'APPROVED', 'REJECTED', 'PAUSED', 'DEPRECATED'] as const).map(s => (
          <div key={s} className="bg-white border border-gray-200 rounded-xl p-3">
            <p className="text-[10px] uppercase tracking-wider text-gray-400">{s}</p>
            <p className="text-xl font-black text-charcoal mt-0.5">{counts[s] || 0}</p>
          </div>
        ))}
      </div>

      <form className="bg-white border border-gray-200 rounded-2xl p-4 flex flex-wrap gap-3 items-end">
        <div>
          <label className="text-[11px] font-bold text-gray-500 mb-1 block">Status</label>
          <select name="status" defaultValue={status} className="px-3 py-2 border border-gray-200 rounded-lg text-sm">
            <option value="">Todos</option>
            <option value="DRAFT">DRAFT</option>
            <option value="PENDING">PENDING</option>
            <option value="APPROVED">APPROVED</option>
            <option value="REJECTED">REJECTED</option>
            <option value="PAUSED">PAUSED</option>
            <option value="DEPRECATED">DEPRECATED</option>
          </select>
        </div>
        <div>
          <label className="text-[11px] font-bold text-gray-500 mb-1 block">Purpose</label>
          <input type="text" name="purpose" defaultValue={purpose} placeholder="appointment_reminder_24h..." className="px-3 py-2 border border-gray-200 rounded-lg text-sm w-72" />
        </div>
        <button type="submit" className="px-4 py-2 bg-charcoal text-white rounded-lg text-sm font-bold">Filtrar</button>
      </form>

      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
        <table className="w-full text-xs">
          <thead className="bg-gray-50 text-[10px] uppercase tracking-wider text-gray-500">
            <tr>
              <th className="px-3 py-2 text-left font-bold">Nombre</th>
              <th className="px-3 py-2 text-left font-bold">Shop</th>
              <th className="px-3 py-2 text-left font-bold">Purpose</th>
              <th className="px-3 py-2 text-left font-bold">Status</th>
              <th className="px-3 py-2 text-left font-bold">Actualizado</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {templates.length === 0 && (
              <tr><td colSpan={5} className="px-3 py-12 text-center text-gray-400">Sin plantillas.</td></tr>
            )}
            {templates.map(t => (
              <tr key={t.id} className="hover:bg-gray-50">
                <td className="px-3 py-2 font-mono text-charcoal">{t.name}</td>
                <td className="px-3 py-2">
                  {t.shop ? (
                    <Link href={`/admin/shops/${t.shopId}`} className="text-fuchsia-600 hover:underline">{t.shop.name}</Link>
                  ) : '—'}
                </td>
                <td className="px-3 py-2 text-gray-500 font-mono">{t.purpose}</td>
                <td className="px-3 py-2">
                  <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${
                    t.status === 'APPROVED' ? 'bg-emerald-100 text-emerald-700' :
                    t.status === 'PENDING' ? 'bg-amber-100 text-amber-700' :
                    t.status === 'REJECTED' ? 'bg-red-100 text-red-700' :
                    t.status === 'DEPRECATED' ? 'bg-gray-200 text-gray-600' :
                    'bg-gray-100 text-gray-600'
                  }`}>{t.status}</span>
                </td>
                <td className="px-3 py-2 text-gray-500 whitespace-nowrap">{format(t.updatedAt, "d MMM HH:mm", { locale: es })}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
