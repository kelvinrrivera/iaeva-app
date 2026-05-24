import { db } from '@/lib/database';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import Link from 'next/link';

export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: Promise<{ severity?: string; type?: string; shopId?: string; page?: string }>;
}

const PAGE_SIZE = 50;

export default async function LogsPage({ searchParams }: PageProps) {
  const { severity = '', type = '', shopId = '', page = '1' } = await searchParams;
  const pageNum = Math.max(1, parseInt(page, 10) || 1);

  const where: any = {};
  if (severity) where.severity = severity;
  if (type) where.type = { contains: type, mode: 'insensitive' };
  if (shopId) where.shopId = shopId;

  const [logs, total] = await Promise.all([
    db.systemLog.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (pageNum - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
    }),
    db.systemLog.count({ where }),
  ]);
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-6 max-w-7xl">
      <div>
        <h1 className="text-2xl font-black text-charcoal">Logs del sistema</h1>
        <p className="text-sm text-gray-500 mt-1">{total.toLocaleString('en-US')} eventos totales</p>
      </div>

      <form className="bg-white border border-gray-200 rounded-2xl p-4 flex flex-wrap gap-3 items-end">
        <div>
          <label className="text-[11px] font-bold text-gray-500 mb-1 block">Severidad</label>
          <select name="severity" defaultValue={severity} className="px-3 py-2 border border-gray-200 rounded-lg text-sm">
            <option value="">Todas</option>
            <option value="info">Info</option>
            <option value="warn">Warn</option>
            <option value="error">Error</option>
          </select>
        </div>
        <div className="flex-1 min-w-[200px]">
          <label className="text-[11px] font-bold text-gray-500 mb-1 block">Tipo</label>
          <input
            type="text"
            name="type"
            defaultValue={type}
            placeholder="ej. admin.shop.wa_reset"
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
          />
        </div>
        <div className="flex-1 min-w-[200px]">
          <label className="text-[11px] font-bold text-gray-500 mb-1 block">Shop ID</label>
          <input
            type="text"
            name="shopId"
            defaultValue={shopId}
            placeholder="cm... o vacío"
            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
          />
        </div>
        <button type="submit" className="px-4 py-2 bg-charcoal text-white rounded-lg text-sm font-bold">
          Filtrar
        </button>
      </form>

      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
        <table className="w-full text-xs">
          <thead className="bg-gray-50 text-[10px] uppercase tracking-wider text-gray-500">
            <tr>
              <th className="px-3 py-2 text-left font-bold">Cuándo</th>
              <th className="px-3 py-2 text-left font-bold">Sev</th>
              <th className="px-3 py-2 text-left font-bold">Tipo</th>
              <th className="px-3 py-2 text-left font-bold">Shop</th>
              <th className="px-3 py-2 text-left font-bold">Mensaje</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {logs.length === 0 && (
              <tr>
                <td colSpan={5} className="px-3 py-12 text-center text-gray-400">
                  No hay logs que coincidan.
                </td>
              </tr>
            )}
            {logs.map(l => (
              <tr key={l.id} className="hover:bg-gray-50">
                <td className="px-3 py-2 text-gray-500 whitespace-nowrap font-mono">
                  {format(l.createdAt, "yyyy-MM-dd HH:mm:ss")}
                </td>
                <td className="px-3 py-2">
                  <span className={`text-[10px] px-1.5 py-0.5 rounded font-bold ${
                    l.severity === 'error' ? 'bg-red-100 text-red-700' :
                    l.severity === 'warn' ? 'bg-amber-100 text-amber-700' :
                    'bg-gray-100 text-gray-600'
                  }`}>{l.severity}</span>
                </td>
                <td className="px-3 py-2 font-mono text-charcoal font-bold">{l.type}</td>
                <td className="px-3 py-2 font-mono text-gray-500">
                  {l.shopId ? (
                    <Link href={`/admin/shops/${l.shopId}`} className="hover:underline">
                      {l.shopId.slice(0, 10)}…
                    </Link>
                  ) : '—'}
                </td>
                <td className="px-3 py-2 text-gray-700">{l.message || ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between text-xs text-gray-500">
          <p>Página {pageNum} de {totalPages}</p>
          <div className="flex gap-2">
            {pageNum > 1 && (
              <Link href={`?severity=${severity}&type=${type}&shopId=${shopId}&page=${pageNum - 1}`} className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-lg font-bold">
                ← Anterior
              </Link>
            )}
            {pageNum < totalPages && (
              <Link href={`?severity=${severity}&type=${type}&shopId=${shopId}&page=${pageNum + 1}`} className="px-3 py-1.5 bg-gray-100 hover:bg-gray-200 rounded-lg font-bold">
                Siguiente →
              </Link>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
