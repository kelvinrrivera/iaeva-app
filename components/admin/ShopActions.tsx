'use client';

import { useState, useTransition } from 'react';
import { useRouter } from 'next/navigation';
import { LogIn, RefreshCw, ChevronDown, Trash2 } from 'lucide-react';

interface Props {
  shopId: string;
  shopName: string;
  currentPlan: string;
  owner: { email: string | null; name: string | null } | null;
}

const PLANS = ['SOLO', 'TEAM', 'BUSINESS'] as const;

export default function ShopActions({ shopId, shopName, currentPlan, owner }: Props) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [showPlanMenu, setShowPlanMenu] = useState(false);

  const call = async (path: string, body?: any) => {
    const res = await fetch(path, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: body ? JSON.stringify(body) : undefined,
    });
    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      throw new Error(err.error || 'Acción fallida');
    }
    return res.json();
  };

  const changePlan = (plan: string) => {
    setShowPlanMenu(false);
    startTransition(async () => {
      try {
        await call(`/api/admin/shops/${shopId}/plan`, { plan });
        router.refresh();
      } catch (e: any) {
        alert(`Error: ${e.message}`);
      }
    });
  };

  const resetWa = () => {
    if (!confirm(`¿Desconectar WhatsApp de "${shopName}"? Esto deja el shop sin bot.`)) return;
    startTransition(async () => {
      try {
        await call(`/api/admin/shops/${shopId}/reset-wa`);
        router.refresh();
      } catch (e: any) {
        alert(`Error: ${e.message}`);
      }
    });
  };

  const impersonate = () => {
    if (!confirm(`¿Iniciar sesión como owner de "${shopName}"? Quedará registrado en logs.`)) return;
    startTransition(async () => {
      try {
        const res = await call(`/api/admin/shops/${shopId}/impersonate`);
        if (res.magicLink) {
          window.location.href = res.magicLink;
        } else {
          alert('No se pudo generar acceso');
        }
      } catch (e: any) {
        alert(`Error: ${e.message}`);
      }
    });
  };

  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-5 space-y-4">
      <div>
        <p className="text-[11px] uppercase tracking-wider text-gray-400">Owner</p>
        <p className="text-sm font-bold text-charcoal">{owner?.name || '—'}</p>
        <p className="text-xs text-gray-500">{owner?.email || 'Sin owner registrado'}</p>
      </div>

      <div className="flex flex-wrap gap-2 pt-2 border-t border-gray-100">
        {owner?.email && (
          <button
            onClick={impersonate}
            disabled={isPending}
            className="inline-flex items-center gap-2 px-3 py-2 bg-fuchsia-600 hover:bg-fuchsia-700 text-white text-xs font-bold rounded-lg disabled:opacity-50"
          >
            <LogIn className="h-3.5 w-3.5" /> Entrar como owner
          </button>
        )}

        <div className="relative">
          <button
            onClick={() => setShowPlanMenu(!showPlanMenu)}
            disabled={isPending}
            className="inline-flex items-center gap-2 px-3 py-2 bg-gray-100 hover:bg-gray-200 text-charcoal text-xs font-bold rounded-lg disabled:opacity-50"
          >
            Cambiar plan ({currentPlan}) <ChevronDown className="h-3 w-3" />
          </button>
          {showPlanMenu && (
            <div className="absolute top-full mt-1 left-0 bg-white border border-gray-200 rounded-lg shadow-lg z-10 min-w-[140px]">
              {PLANS.map(p => (
                <button
                  key={p}
                  onClick={() => changePlan(p)}
                  className={`w-full px-3 py-2 text-xs text-left hover:bg-gray-50 ${p === currentPlan ? 'font-bold text-fuchsia-700' : 'text-gray-700'}`}
                >
                  {p}
                </button>
              ))}
            </div>
          )}
        </div>

        <button
          onClick={resetWa}
          disabled={isPending}
          className="inline-flex items-center gap-2 px-3 py-2 bg-amber-100 hover:bg-amber-200 text-amber-800 text-xs font-bold rounded-lg disabled:opacity-50"
        >
          <RefreshCw className="h-3.5 w-3.5" /> Reset WhatsApp
        </button>
      </div>
    </div>
  );
}
