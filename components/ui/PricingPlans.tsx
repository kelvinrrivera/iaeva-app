'use client';

/**
 * PricingPlans — Shared pricing component
 *
 * Used in:
 * - app/page.tsx (landing)
 * - app/onboarding/page.tsx (step 6 plan selector)
 * - app/dashboard/billing/page.tsx
 * - app/dashboard/plans/page.tsx
 */

import { useEffect, useState } from 'react';
import { Check, Loader2, Zap } from 'lucide-react';
import { ANNUAL_DISCOUNT_PCT, getAnnualMonthlyEquivalent, getAnnualPrice, type BillingCycle } from '@/lib/billing/pricing';

export interface PlanDef {
  id: 'SOLO' | 'TEAM' | 'BUSINESS';
  name: string;
  usd: number;
  period: string;
  description: string;
  features: string[];
  popular?: boolean;
  highlight?: boolean; // dark card style
  cta?: string;
}

export const PLAN_DEFS: PlanDef[] = [
  {
    id: 'SOLO',
    name: 'Solo',
    usd: 19,
    period: '/mes',
    description: 'Para el profesional independiente',
    features: [
      '1 profesional',
      '1,000 mensajes WhatsApp/mes',
      'Chatbot 24/7 en español dominicano',
      'Recordatorios automáticos',
      'Cola de walk-ins',
      'Analytics básico',
    ],
  },
  {
    id: 'TEAM',
    name: 'Team',
    usd: 39,
    period: '/mes',
    description: 'Para salones con equipo',
    features: [
      'Hasta 5 profesionales',
      '3,000 mensajes WhatsApp/mes',
      'Todo lo del plan Solo',
      'Multi-servicio por cita',
      'Gestión de equipo y roles',
      'Soporte prioritario',
    ],
    popular: true,
    highlight: true,
  },
  {
    id: 'BUSINESS',
    name: 'Business',
    usd: 79,
    period: '/mes',
    description: 'Para cadenas y multi-sucursal',
    features: [
      'Profesionales ilimitados',
      '10,000 mensajes WhatsApp/mes',
      'Multi-sucursal',
      'Bot personalizado con IA',
      'Acceso a API',
      'Soporte dedicado',
    ],
  },
];

interface PricingPlansProps {
  /** Current active plan id — highlights "Plan Actual" */
  currentPlan?: string;
  /**
   * Mode:
   * - "select": radio-style selection (onboarding)
   * - "upgrade": button per plan that calls onUpgrade (dashboard)
   * - "landing": link-based CTAs pointing to /onboarding
   */
  mode: 'select' | 'upgrade' | 'landing';
  /** For mode="select" */
  selectedPlan?: string;
  onSelect?: (planId: string) => void;
  /** For mode="upgrade" */
  onUpgrade?: (planId: 'SOLO' | 'TEAM' | 'BUSINESS', billingCycle: BillingCycle) => void;
  upgradeLoading?: string | null;
  /** Hide the monthly/annual toggle (e.g. in onboarding where we keep it simple) */
  hideBillingToggle?: boolean;
  /** Show DOP rate conversion */
  showDop?: boolean;
  /** Optional external dopRate (if parent already fetched it) */
  dopRate?: number | null;
  /** Error from parent */
  error?: string | null;
}

function useDopRate(enabled: boolean, external?: number | null) {
  const [rate, setRate] = useState<number | null>(external ?? null);
  useEffect(() => {
    if (!enabled || external !== undefined) return;
    fetch('/api/exchange-rate')
      .then(r => r.json())
      .then(d => { if (d.rate) setRate(d.rate); })
      .catch(() => setRate(60));
  }, [enabled, external]);
  return rate;
}

export default function PricingPlans({
  currentPlan,
  mode,
  selectedPlan,
  onSelect,
  onUpgrade,
  upgradeLoading,
  showDop = true,
  dopRate: externalDopRate,
  error,
  hideBillingToggle = false,
}: PricingPlansProps) {
  const dopRate = useDopRate(showDop, externalDopRate);
  const [billingCycle, setBillingCycle] = useState<BillingCycle>('monthly');
  const isAnnual = billingCycle === 'annual';

  return (
    <div>
      {/* Monthly / Annual toggle — only shown if not explicitly hidden */}
      {!hideBillingToggle && (
        <div className="flex justify-center mb-6">
          <div className="inline-flex items-center bg-gray-100 rounded-full p-1 text-sm">
            <button
              type="button"
              onClick={() => setBillingCycle('monthly')}
              className={`px-4 py-1.5 rounded-full font-bold transition-all ${
                !isAnnual
                  ? 'bg-white text-charcoal shadow-sm'
                  : 'text-gray-500 hover:text-charcoal'
              }`}
            >
              Mensual
            </button>
            <button
              type="button"
              onClick={() => setBillingCycle('annual')}
              className={`px-4 py-1.5 rounded-full font-bold transition-all flex items-center gap-1.5 ${
                isAnnual
                  ? 'bg-white text-charcoal shadow-sm'
                  : 'text-gray-500 hover:text-charcoal'
              }`}
            >
              Anual
              <span className={`text-[10px] font-black px-1.5 py-0.5 rounded ${
                isAnnual ? 'bg-emerald-100 text-emerald-700' : 'bg-gray-200 text-gray-500'
              }`}>
                -{ANNUAL_DISCOUNT_PCT}%
              </span>
            </button>
          </div>
        </div>
      )}

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 items-stretch">
        {PLAN_DEFS.map((plan) => {
          const isActive = plan.id === currentPlan;
          const isSelected = plan.id === selectedPlan;
          const isLoading = upgradeLoading === plan.id;

          // Visual state
          const darkCard = plan.highlight && (
            mode === 'landing' ||
            (mode === 'select' && isSelected) ||
            (mode === 'upgrade' && !isActive)
          );

          return (
            <div
              key={plan.id}
              className={`relative flex flex-col p-5 rounded-2xl border-2 transition-all duration-200
                ${isActive
                  ? 'border-primary bg-primary/5 shadow-md shadow-primary/10'
                  : plan.highlight
                    ? darkCard
                      ? 'border-primary bg-primary shadow-xl shadow-primary/20'
                      : 'border-primary/30 bg-white hover:border-primary/60'
                    : 'border-gray-100 bg-white hover:border-gray-300'
                }
                ${mode === 'select' && isSelected && !plan.highlight ? 'border-primary bg-primary/5 shadow-md shadow-primary/10' : ''}
                ${mode === 'select' ? 'cursor-pointer' : ''}
                ${plan.highlight && mode !== 'landing' ? 'lg:-mt-2' : ''}
              `}
              onClick={mode === 'select' ? () => onSelect?.(plan.id) : undefined}
            >
              {/* Badges */}
              {plan.popular && isActive && (
                <div className="absolute -top-3.5 inset-x-0 flex justify-center">
                  <span className="inline-flex items-center gap-1 px-3 py-1 bg-primary text-white text-[10px] font-black uppercase tracking-widest rounded-full">
                    Plan Actual
                  </span>
                </div>
              )}
              {plan.popular && !isActive && (
                <div className="absolute -top-3.5 inset-x-0 flex justify-center">
                  <span className="inline-flex items-center gap-1 px-3 py-1 bg-accent text-white text-[10px] font-black uppercase tracking-widest rounded-full shadow">
                    <Zap className="h-2.5 w-2.5" /> Más popular
                  </span>
                </div>
              )}

              {/* Plan name */}
              <p className={`text-[10px] font-bold uppercase tracking-widest mb-2 ${darkCard ? 'text-white/60' : 'text-gray-400'}`}>
                {plan.name}
              </p>

              {/* Price (varies by billing cycle) */}
              {(() => {
                const displayMonthly = isAnnual ? getAnnualMonthlyEquivalent(plan.usd) : plan.usd;
                const annualTotal = getAnnualPrice(plan.usd);
                return (
                  <>
                    <div className="flex items-end gap-1 mb-0.5">
                      <span className={`text-3xl font-black ${darkCard ? 'text-white' : 'text-charcoal'}`}>
                        ${displayMonthly}
                      </span>
                      <span className={`text-sm mb-1 ${darkCard ? 'text-white/60' : 'text-gray-400'}`}>
                        USD/mes
                      </span>
                    </div>
                    {isAnnual ? (
                      <p className={`text-[11px] -mt-0.5 mb-1 font-bold ${darkCard ? 'text-emerald-200' : 'text-emerald-600'}`}>
                        ${annualTotal} facturado anual · ahorras ${(plan.usd * 12 - annualTotal).toFixed(0)}
                      </p>
                    ) : (
                      dopRate && (
                        <p className={`text-[11px] -mt-0.5 mb-1 ${darkCard ? 'text-white/50' : 'text-gray-400'}`}>
                          ≈ RD$ {Math.round(plan.usd * dopRate).toLocaleString('es-DO')}/mes
                        </p>
                      )
                    )}
                  </>
                );
              })()}

              {/* Description */}
              <p className={`text-xs mb-4 ${darkCard ? 'text-white/60' : 'text-gray-500'}`}>
                {plan.description}
              </p>

              {/* Features */}
              <ul className="space-y-2 flex-1 mb-5">
                {plan.features.map((f) => (
                  <li key={f} className={`flex items-start gap-2 text-xs ${darkCard ? 'text-white/90' : 'text-gray-600'}`}>
                    <Check className={`h-3.5 w-3.5 shrink-0 mt-0.5 ${darkCard ? 'text-white/70' : 'text-primary'}`} />
                    {f}
                  </li>
                ))}
              </ul>

              {/* CTA */}
              {mode === 'landing' && (
                <a
                  href={`/onboarding?plan=${plan.id}&billing=${billingCycle}`}
                  className={`block w-full py-2.5 text-center text-sm font-semibold rounded-xl transition-all duration-200
                    ${plan.highlight
                      ? 'bg-white text-primary hover:bg-white/90'
                      : 'border border-primary text-primary hover:bg-primary/5'
                    }
                  `}
                >
                  Probar 14 días gratis
                </a>
              )}

              {mode === 'select' && (
                <div className={`w-full py-2 rounded-xl text-center text-xs font-bold transition-all
                  ${isSelected
                    ? darkCard
                      ? 'bg-white/20 text-white'
                      : 'bg-primary text-white'
                    : 'bg-gray-100 text-gray-400'
                  }
                `}>
                  {isSelected ? '✓ Seleccionado' : 'Seleccionar'}
                </div>
              )}

              {mode === 'upgrade' && (
                isActive ? (
                  <div className="w-full py-2.5 rounded-xl bg-primary/10 text-center">
                    <span className="text-xs font-bold text-primary">Plan Activo</span>
                  </div>
                ) : (
                  <button
                    onClick={() => onUpgrade?.(plan.id, billingCycle)}
                    disabled={!!upgradeLoading}
                    className={`w-full py-2.5 rounded-xl text-sm font-bold transition-all duration-200 flex items-center justify-center gap-2
                      ${plan.highlight
                        ? 'bg-white text-primary hover:bg-white/90'
                        : plan.id === 'BUSINESS'
                          ? 'bg-charcoal text-white hover:bg-charcoal/90'
                          : 'bg-emerald-600 text-white hover:bg-emerald-700'
                      }
                      disabled:opacity-50 disabled:cursor-not-allowed
                    `}
                  >
                    {isLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : `Activar ${plan.name}`}
                  </button>
                )
              )}
            </div>
          );
        })}
      </div>

      {/* DOP footnote */}
      {showDop && dopRate && (
        <p className="text-center text-[11px] text-gray-400 mt-4">
          * Equivalencia en DOP referencial · Tasa actual: 1 USD = RD$ {dopRate.toFixed(2)} · Se actualiza cada 4 horas
        </p>
      )}

      {/* Error */}
      {error && (
        <p className="mt-4 p-3 bg-red-50 border border-red-200 rounded-xl text-sm font-bold text-red-600">
          {error}
        </p>
      )}
    </div>
  );
}
