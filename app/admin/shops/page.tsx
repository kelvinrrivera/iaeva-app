import { db } from '@/lib/database';
import Link from 'next/link';
import { Store, Search } from 'lucide-react';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

export const dynamic = 'force-dynamic';

interface PageProps {
  searchParams: Promise<{ q?: string; plan?: string; wa?: string }>;
}

export default async function ShopsListPage({ searchParams }: PageProps) {
  const { q = '', plan = '', wa = '' } = await searchParams;

  const where: any = {};
  if (q) {
    where.OR = [
      { name: { contains: q, mode: 'insensitive' } },
      { whatsappPhoneNumber: { contains: q } },
    ];
  }
  if (plan) where.plan = plan;
  if (wa === 'yes') where.whatsappEnabled = true;
  if (wa === 'no') where.whatsappEnabled = false;

  const shops = await db.shop.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    take: 200,
    include: {
      memberships: {
        take: 1,
        include: { user: { select: { email: true, name: true } } },
      },
      _count: {
        select: {
          appointments: true,
          stylists: true,
        },
      },
    },
  });

  return (
    <div className="space-y-6 max-w-7xl">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-black text-charcoal">Negocios</h1>
          <p className="text-sm text-gray-500 mt-1">{shops.length} mostrados (límite 200)</p>
        </div>
      </div>

      {/* Filtros */}
      <form className="bg-white border border-gray-200 rounded-2xl p-4 flex flex-wrap gap-3 items-end">
        <div className="flex-1 min-w-[200px]">
          <label className="text-[11px] font-bold text-gray-500 mb-1 block">Buscar</label>
          <div className="relative">
            <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
            <input
              type="text"
              name="q"
              defaultValue={q}
              placeholder="Nombre o teléfono..."
              className="w-full pl-9 pr-3 py-2 border border-gray-200 rounded-lg text-sm"
            />
          </div>
        </div>
        <div>
          <label className="text-[11px] font-bold text-gray-500 mb-1 block">Plan</label>
          <select name="plan" defaultValue={plan} className="px-3 py-2 border border-gray-200 rounded-lg text-sm">
            <option value="">Todos</option>
            <option value="SOLO">SOLO</option>
            <option value="TEAM">TEAM</option>
            <option value="BUSINESS">BUSINESS</option>
          </select>
        </div>
        <div>
          <label className="text-[11px] font-bold text-gray-500 mb-1 block">WhatsApp</label>
          <select name="wa" defaultValue={wa} className="px-3 py-2 border border-gray-200 rounded-lg text-sm">
            <option value="">Cualquiera</option>
            <option value="yes">Conectado</option>
            <option value="no">Desconectado</option>
          </select>
        </div>
        <button type="submit" className="px-4 py-2 bg-charcoal text-white rounded-lg text-sm font-bold">
          Filtrar
        </button>
      </form>

      {/* Tabla */}
      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-[11px] uppercase tracking-wider text-gray-500">
            <tr>
              <th className="px-4 py-3 text-left font-bold">Negocio</th>
              <th className="px-4 py-3 text-left font-bold">Owner</th>
              <th className="px-4 py-3 text-left font-bold">Plan</th>
              <th className="px-4 py-3 text-left font-bold">WA</th>
              <th className="px-4 py-3 text-right font-bold">Citas</th>
              <th className="px-4 py-3 text-right font-bold">Equipo</th>
              <th className="px-4 py-3 text-left font-bold">Creado</th>
              <th className="px-4 py-3 text-right font-bold">Acciones</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {shops.length === 0 && (
              <tr>
                <td colSpan={8} className="px-4 py-12 text-center text-gray-400">
                  No hay shops que coincidan con los filtros.
                </td>
              </tr>
            )}
            {shops.map(s => {
              const owner = s.memberships[0]?.user;
              return (
                <tr key={s.id} className="hover:bg-gray-50 transition-colors">
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-2">
                      <div className="h-8 w-8 rounded-lg bg-fuchsia-100 text-fuchsia-700 flex items-center justify-center">
                        <Store className="h-4 w-4" />
                      </div>
                      <div>
                        <p className="font-bold text-charcoal">{s.name}</p>
                        <p className="text-[11px] text-gray-400 font-mono">{s.id.slice(0, 12)}...</p>
                      </div>
                    </div>
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {owner ? (
                      <div>
                        <p>{owner.name || '—'}</p>
                        <p className="text-[11px] text-gray-400">{owner.email}</p>
                      </div>
                    ) : <span className="text-gray-400">—</span>}
                  </td>
                  <td className="px-4 py-3">
                    <span className={`text-[11px] px-2 py-0.5 rounded font-bold ${
                      s.plan === 'BUSINESS' ? 'bg-fuchsia-100 text-fuchsia-700' :
                      s.plan === 'TEAM' ? 'bg-blue-100 text-blue-700' :
                      s.plan === 'SOLO' ? 'bg-emerald-100 text-emerald-700' :
                      'bg-gray-100 text-gray-600'
                    }`}>{s.plan}</span>
                  </td>
                  <td className="px-4 py-3">
                    {s.whatsappEnabled && s.wabaId ? (
                      <span className="inline-flex items-center gap-1 text-[11px] text-emerald-700 font-bold">
                        <span className="h-1.5 w-1.5 rounded-full bg-emerald-500"></span>
                        Conectado
                      </span>
                    ) : (
                      <span className="inline-flex items-center gap-1 text-[11px] text-gray-400">
                        <span className="h-1.5 w-1.5 rounded-full bg-gray-300"></span>
                        Desconectado
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-right text-gray-700">{s._count.appointments}</td>
                  <td className="px-4 py-3 text-right text-gray-700">{s._count.stylists}</td>
                  <td className="px-4 py-3 text-gray-500 text-xs">
                    {format(s.createdAt, "d MMM yyyy", { locale: es })}
                  </td>
                  <td className="px-4 py-3 text-right">
                    <Link
                      href={`/admin/shops/${s.id}`}
                      className="text-fuchsia-600 hover:text-fuchsia-700 font-bold text-xs"
                    >
                      Ver detalle →
                    </Link>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
