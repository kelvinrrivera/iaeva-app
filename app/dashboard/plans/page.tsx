'use client';

import { useEffect, useState } from 'react';
import { useSearchParams } from 'next/navigation';
import {
  Loader2,
  CheckCircle2,
  ArrowRight,
} from 'lucide-react';
import PricingPlans from '@/components/ui/PricingPlans';
import { useToast } from '@/contexts/ToastContext';

interface UsageData {
  plan: string;
}

const COMPARISON_ROWS = [
  { feature: 'Profesionales', values: ['1', '1', 'Hasta 5', 'Ilimitados'] },
  { feature: 'WhatsApp mensajes/mes', values: ['1,000', '1,000', '1,000', '1,000'] },
  { feature: 'Citas', values: ['✓', '✓', '✓', '✓'] },
  { feature: 'Recordatorios automáticos', values: ['—', '✓', '✓ Config.', '✓ Config.'] },
  { feature: 'Analytics', values: ['—', '✓', 'Por prof.', 'Por prof.'] },
  { feature: 'Cola walk-ins', values: ['—', '✓', '✓', '✓'] },
  { feature: 'Gestión de equipo', values: ['—', '—', '✓', '✓'] },
  { feature: 'Multi-sucursal', values: ['—', '—', '—', '✓'] },
  { feature: 'Bot IA personalizado', values: ['—', '—', '—', '✓'] },
  { feature: 'API access', values: ['—', '—', '—', '✓'] },
  { feature: 'Soporte', values: ['Email', 'Email', 'Prioritario', '24/7'] },
];

const PLAN_HEADERS = [
  { name: 'Free', color: 'text-gray-500' },
  { name: 'Solo', color: 'text-primary' },
  { name: 'Team', color: 'text-emerald-600' },
  { name: 'Business', color: 'text-accent' },
];

const TESTIMONIALS = [
  {
    name: 'Rafael Díaz',
    business: 'Barbería El Conde, Santo Domingo',
    plan: 'Solo',
    text: 'Desde que activé el WhatsApp ilimitado mis clientes me agendan solos. Ya no pierdo citas por no contestar.',
    avatar: 'RD',
  },
  {
    name: 'María Santos',
    business: 'Salón Elegance, Santiago',
    plan: 'Team',
    text: 'Tengo 3 estilistas y ahora cada una maneja su agenda. Los recordatorios automáticos redujeron los no-shows a la mitad.',
    avatar: 'MS',
  },
];

const FAQ = [
  {
    q: '¿Puedo cancelar en cualquier momento?',
    a: 'Sí. Sin penalidades ni contratos. Al cancelar mantienes acceso hasta el fin del período pagado y luego pasas a FREE.',
  },
  {
    q: '¿Hay periodo de prueba?',
    a: 'El plan Free es gratuito para siempre. Puedes usarlo indefinidamente y hacer upgrade cuando quieras crecer.',
  },
  {
    q: '¿Los precios incluyen impuestos?',
    a: 'Los precios son en USD y no incluyen impuestos locales. El cobro se hace a través de Stripe de forma segura.',
  },
  {
    q: '¿Qué pasa con mis datos si cancelo?',
    a: 'Tus datos (clientes, citas, servicios) se mantienen disponibles en el plan Free. No se borran al hacer downgrade.',
  },
];

export default function PlansPage() {
  const searchParams = useSearchParams();
  const toast = useToast();
  const [currentPlan, setCurrentPlan] = useState<string>('TEAM');
  const [upgradeLoading, setUpgradeLoading] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  useEffect(() => {
    fetch('/api/billing/usage')
      .then(r => r.json())
      .then((d: UsageData) => { if (d.plan) setCurrentPlan(d.plan); })
      .catch(() => {});

    if (searchParams.get('checkout') === 'success') {
      setSuccessMessage('¡Pago exitoso! Tu plan ha sido activado.');
    }
  }, [searchParams]);

  const handleUpgrade = async (plan: 'SOLO' | 'TEAM' | 'BUSINESS', billingCycle: 'monthly' | 'annual' = 'monthly') => {
    setUpgradeLoading(plan);
    try {
      const res = await fetch('/api/stripe/create-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan, billingCycle }),
      });
      const data = await res.json();

      if (!res.ok) {
        toast.error(data.error || 'No se pudo iniciar el pago. Inténtalo de nuevo.');
        return;
      }

      if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
      } else {
        toast.error('No se recibió el enlace de pago. Verifica la configuración de Stripe.');
      }
    } catch {
      toast.error('Error de conexión. Inténtalo de nuevo.');
    } finally {
      setUpgradeLoading(null);
    }
  };

  return (
    <div className="max-w-5xl mx-auto space-y-12">

      {/* Success banner */}
      {successMessage && (
        <div className="flex items-center gap-3 p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
          <CheckCircle2 className="h-5 w-5 text-emerald-600 shrink-0" />
          <p className="text-sm font-semibold text-emerald-800">{successMessage}</p>
        </div>
      )}

      {/* Header */}
      <div className="text-center space-y-3">
        <h1 className="text-3xl font-black text-charcoal">
          Elige el plan que hace crecer tu negocio
        </h1>
        <p className="text-gray-500 font-medium max-w-xl mx-auto">
          Sin contratos · Sin sorpresas · Cancela cuando quieras
          {currentPlan !== 'TRIAL_EXPIRED' && (
            <span className="block mt-1 text-primary font-semibold text-sm">
              Plan actual: {currentPlan.charAt(0) + currentPlan.slice(1).toLowerCase()}
            </span>
          )}
        </p>
      </div>

      {/* Shared pricing component */}
      <PricingPlans
        mode="upgrade"
        currentPlan={currentPlan}
        onUpgrade={handleUpgrade}
        upgradeLoading={upgradeLoading}
        showDop={true}
      />

      {/* Feature comparison table */}
      <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
        <div className="px-6 py-5 border-b border-gray-100">
          <h2 className="text-lg font-black text-charcoal">Comparativa detallada</h2>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-gray-100">
                <th className="text-left px-6 py-4 font-semibold text-gray-500 w-1/3">Función</th>
                {PLAN_HEADERS.map(p => (
                  <th key={p.name} className={`px-4 py-4 text-center font-black text-xs uppercase tracking-wider ${p.color} ${p.name.toUpperCase() === currentPlan ? 'bg-primary/5' : ''}`}>
                    {p.name}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {COMPARISON_ROWS.map(({ feature, values }) => (
                <tr key={feature} className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-6 py-3 font-medium text-gray-700">{feature}</td>
                  {values.map((val, i) => (
                    <td key={i} className={`px-4 py-3 text-center text-xs font-semibold
                      ${PLAN_HEADERS[i].name.toUpperCase() === currentPlan ? 'bg-primary/5' : ''}
                      ${val === '✓' || val.startsWith('✓') ? 'text-emerald-600' : val === '—' ? 'text-gray-300' : 'text-charcoal'}
                    `}>
                      {val}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* WhatsApp messaging note */}
      <p className="text-xs text-gray-400 px-1">
        ¿Necesitas más de 1,000 mensajes al mes? Contáctanos y te ayudamos a configurarlo sin coste adicional de DomiCita.
      </p>

      {/* Testimonials */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
        {TESTIMONIALS.map((t) => (
          <div key={t.name} className="bg-white rounded-2xl border border-gray-200 p-6 space-y-4">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-full bg-primary text-white flex items-center justify-center text-sm font-black shrink-0">
                {t.avatar}
              </div>
              <div>
                <p className="text-sm font-bold text-charcoal">{t.name}</p>
                <p className="text-xs text-gray-400 font-medium">{t.business}</p>
              </div>
              <div className="ml-auto">
                <span className="text-[10px] font-black uppercase tracking-wider px-2 py-1 bg-primary/10 text-primary rounded-full">
                  Plan {t.plan}
                </span>
              </div>
            </div>
            <p className="text-sm text-gray-600 leading-relaxed italic">"{t.text}"</p>
          </div>
        ))}
      </div>

      {/* FAQ */}
      <div className="space-y-4">
        <h2 className="text-xl font-black text-charcoal text-center">Preguntas frecuentes</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {FAQ.map(({ q, a }) => (
            <div key={q} className="bg-white rounded-2xl border border-gray-200 p-5 space-y-2">
              <p className="text-sm font-bold text-charcoal">{q}</p>
              <p className="text-sm text-gray-500 leading-relaxed">{a}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Bottom CTA — only shown on FREE plan */}
      {false && (
        <div className="bg-primary rounded-2xl p-8 text-center text-white space-y-4">
          <h2 className="text-2xl font-black">¿Listo para hacer crecer tu negocio?</h2>
          <p className="text-white/70 font-medium">
            Únete a cientos de negocios en República Dominicana que ya usan DomiCita.
          </p>
          <button
            onClick={() => handleUpgrade('SOLO')}
            disabled={!!upgradeLoading}
            className="inline-flex items-center gap-2 px-6 py-3 bg-white text-primary font-black rounded-xl hover:bg-gray-50 transition-colors disabled:opacity-50"
          >
            {upgradeLoading === 'SOLO' ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <>Empezar por $19/mes <ArrowRight className="h-4 w-4" /></>
            )}
          </button>
          <p className="text-xs text-white/50 font-medium">Sin contratos · Cancela cuando quieras · Soporte en español</p>
        </div>
      )}

    </div>
  );
}
