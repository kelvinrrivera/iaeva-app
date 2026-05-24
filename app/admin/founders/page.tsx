import { db } from '@/lib/database';
import { getFounderStatus } from '@/lib/founder-program';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';
import Link from 'next/link';
import { Sparkles, CheckCircle2 } from 'lucide-react';

export const dynamic = 'force-dynamic';

export default async function FoundersAdminPage() {
  const [status, founders] = await Promise.all([
    getFounderStatus(),
    db.shop.findMany({
      where: { isFounder: true },
      orderBy: { foundedAt: 'asc' },
      include: {
        memberships: {
          take: 1,
          orderBy: { createdAt: 'asc' },
          include: { user: { select: { email: true, name: true } } },
        },
      },
    }),
  ]);

  const percentClaimed = Math.round((status.claimedSlots / status.totalSlots) * 100);

  return (
    <div className="space-y-6 max-w-5xl">
      <div>
        <h1 className="text-2xl font-black text-charcoal">Programa Fundadores</h1>
        <p className="text-sm text-gray-500 mt-1">
          Primeros {status.totalSlots} negocios con {status.discountPct}% de descuento de por vida.
        </p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        <div className="bg-white border border-gray-200 rounded-2xl p-5">
          <div className="flex items-center gap-2 mb-1">
            <Sparkles className="h-4 w-4 text-emerald-500" />
            <p className="text-[10px] uppercase tracking-wider text-gray-400 font-bold">Reclamados</p>
          </div>
          <p className="text-3xl font-black text-charcoal">
            {status.claimedSlots} <span className="text-base text-gray-400">/ {status.totalSlots}</span>
          </p>
          <div className="mt-3 h-2 bg-gray-100 rounded-full overflow-hidden">
            <div className="h-full bg-emerald-500" style={{ width: `${percentClaimed}%` }} />
          </div>
        </div>
        <div className="bg-white border border-gray-200 rounded-2xl p-5">
          <p className="text-[10px] uppercase tracking-wider text-gray-400 font-bold">Cupos restantes</p>
          <p className="text-3xl font-black text-charcoal mt-1">{status.remainingSlots}</p>
          <p className="text-xs text-gray-500 mt-1">
            {status.isOpen ? '🟢 Programa abierto' : '🔴 Programa cerrado'}
          </p>
        </div>
        <div className="bg-white border border-gray-200 rounded-2xl p-5">
          <p className="text-[10px] uppercase tracking-wider text-gray-400 font-bold">Conversión a pago</p>
          <p className="text-3xl font-black text-charcoal mt-1">
            {founders.filter(f => f.stripeSubscriptionId).length}
          </p>
          <p className="text-xs text-gray-500 mt-1">de {founders.length} fundadores</p>
        </div>
      </div>

      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-100">
          <h2 className="text-sm font-black text-charcoal">Fundadores ({founders.length})</h2>
        </div>
        <table className="w-full text-sm">
          <thead className="bg-gray-50 text-[10px] uppercase tracking-wider text-gray-500">
            <tr>
              <th className="px-4 py-2 text-left font-bold">#</th>
              <th className="px-4 py-2 text-left font-bold">Negocio</th>
              <th className="px-4 py-2 text-left font-bold">Owner</th>
              <th className="px-4 py-2 text-left font-bold">Plan</th>
              <th className="px-4 py-2 text-left font-bold">Status</th>
              <th className="px-4 py-2 text-left font-bold">Se unió</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {founders.length === 0 && (
              <tr>
                <td colSpan={6} className="px-4 py-12 text-center text-gray-400">
                  Sin fundadores todavía. ¡Hay que conseguir el primero!
                </td>
              </tr>
            )}
            {founders.map((s, i) => {
              const owner = s.memberships[0]?.user;
              const paid = !!s.stripeSubscriptionId;
              return (
                <tr key={s.id} className="hover:bg-gray-50">
                  <td className="px-4 py-3 text-gray-400 font-mono text-xs">#{i + 1}</td>
                  <td className="px-4 py-3">
                    <Link href={`/admin/shops/${s.id}`} className="font-bold text-charcoal hover:text-fuchsia-600">
                      {s.name}
                    </Link>
                  </td>
                  <td className="px-4 py-3 text-gray-600">
                    {owner ? (
                      <div>
                        <p className="text-xs">{owner.name || '—'}</p>
                        <p className="text-[11px] text-gray-400">{owner.email}</p>
                      </div>
                    ) : (
                      <span className="text-gray-400">—</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <span className="text-[11px] px-1.5 py-0.5 rounded font-bold bg-gray-100 text-gray-700">
                      {s.plan}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {paid ? (
                      <span className="inline-flex items-center gap-1 text-[11px] text-emerald-700 font-bold">
                        <CheckCircle2 className="h-3 w-3" /> Pagando
                      </span>
                    ) : (
                      <span className="text-[11px] text-amber-700 font-bold">
                        Trial / Sin pago
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-gray-500 text-xs">
                    {s.foundedAt ? format(s.foundedAt, "d MMM yyyy", { locale: es }) : '—'}
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
