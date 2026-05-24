'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import {
  CreditCard,
  AlertTriangle,
  Loader2,
} from 'lucide-react';
import { Button } from '@/components/ui/Button';
import { Card, CardHeader, CardTitle, CardContent, CardFooter } from '@/components/ui/Card';
import PricingPlans from '@/components/ui/PricingPlans';

interface UsageData {
  plan: string;
  professionals: number;
  whatsappMessages: number;
  appointments: number;
  currentPeriodEnd?: Date;
  subscriptionStatus?: string;
  stripeSubscriptionId?: string | null;
  trialEnd?: string | Date | null;
  isFounder?: boolean;
  founderDiscountPct?: number;
}

interface PlanConfig {
  name: string;
  displayName: string;
  professionals: number | string;
  whatsappMessages: string;
}

const PLANS: PlanConfig[] = [
  { name: 'SOLO',     displayName: 'Solo',    professionals: 1,   whatsappMessages: '1,000/mes'  },
  { name: 'TEAM',     displayName: 'Equipo',  professionals: 5,   whatsappMessages: '3,000/mes'  },
  { name: 'BUSINESS', displayName: 'Negocios', professionals: '∞', whatsappMessages: '10,000/mes' },
];

export default function BillingPage() {
  const router = useRouter();
  const [usage, setUsage] = useState<UsageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [actionError, setActionError] = useState<string | null>(null);
  const [showCancelConfirm, setShowCancelConfirm] = useState(false);

  useEffect(() => {
    fetchUsage();
  }, []);

  const fetchUsage = async () => {
    try {
      const response = await fetch('/api/billing/usage');
      const data = await response.json();
      setUsage(data);
    } catch (error) {
      console.error('Error fetching usage:', error);
    } finally {
      setLoading(false);
    }
  };

  const handleUpgrade = async (plan: 'SOLO' | 'TEAM' | 'BUSINESS', billingCycle: 'monthly' | 'annual' = 'monthly') => {
    setActionLoading(plan);
    setActionError(null);
    try {
      const response = await fetch('/api/stripe/create-checkout', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ plan, billingCycle }),
      });

      const data = await response.json();

      if (!response.ok) {
        setActionError(data.error || 'No se pudo iniciar el pago. Inténtalo de nuevo.');
        return;
      }

      if (data.checkoutUrl) {
        window.location.href = data.checkoutUrl;
      } else {
        setActionError('No se recibió el enlace de pago. Revisa que Stripe esté configurado.');
      }
    } catch (error) {
      console.error('Error initiating checkout:', error);
      setActionError('Error de conexión al intentar procesar el pago. Inténtalo de nuevo.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleManagePayment = async () => {
    setActionLoading('portal');
    setActionError(null);
    try {
      const response = await fetch('/api/stripe/portal', {
        method: 'POST',
        credentials: 'include',
      });

      const data = await response.json();

      if (!response.ok) {
        setActionError(data.error || 'No se pudo abrir el portal de pagos.');
        return;
      }

      if (data.portalUrl) {
        window.location.href = data.portalUrl;
      } else {
        setActionError('No se pudo abrir el portal de pagos. Inténtalo de nuevo.');
      }
    } catch (error) {
      console.error('Error opening portal:', error);
      setActionError('Error de conexión al abrir el portal de pagos.');
    } finally {
      setActionLoading(null);
    }
  };

  const handleCancelSubscription = async () => {
    setActionLoading('cancel');
    setActionError(null);
    try {
      const response = await fetch('/api/billing/subscription', {
        method: 'DELETE',
        credentials: 'include',
      });

      if (response.ok) {
        router.push('/dashboard/billing?canceled=true');
        fetchUsage();
      } else {
        const data = await response.json();
        setActionError(data.error || 'No se pudo cancelar la suscripción. Inténtalo de nuevo.');
      }
    } catch (error) {
      console.error('Error canceling subscription:', error);
      setActionError('Error de conexión al cancelar la suscripción.');
    } finally {
      setActionLoading(null);
      setShowCancelConfirm(false);
    }
  };

  const currentPlan = PLANS.find((p) => p.name === usage?.plan) || PLANS[0];
  const profLimit = typeof currentPlan.professionals === 'number' ? currentPlan.professionals : Infinity;
  const usagePercentage = profLimit === Infinity ? 100 : ((usage?.professionals || 0) / profLimit) * 100;

  return (
    <div className="space-y-8">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-black text-charcoal mb-1">Facturación y Planes</h1>
        <p className="text-sm text-gray-500 font-medium">Gestiona tu suscripción y método de pago</p>
      </div>

      {/* Action error banner */}
      {actionError && (
        <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-xl">
          <AlertTriangle className="h-5 w-5 text-red-600 flex-shrink-0 mt-0.5" />
          <div className="flex-1">
            <p className="text-sm text-red-900 font-semibold">{actionError}</p>
          </div>
          <button
            onClick={() => setActionError(null)}
            className="text-red-400 hover:text-red-600 text-lg leading-none"
          >
            ×
          </button>
        </div>
      )}

      {/* Current Plan Card */}
      <Card variant="elevated">
        <CardHeader>
          <div className="flex items-start justify-between">
            <div>
              <CardTitle>
                Plan Actual:{' '}
                <span className="text-primary">{currentPlan.displayName}</span>
              </CardTitle>
              {usage?.subscriptionStatus === 'active' && (
                <span className="inline-flex items-center gap-1 px-2 py-1 bg-green-100 text-green-700 rounded-full text-xs font-semibold mt-2">
                  <div className="w-2 h-2 rounded-full bg-green-500" />
                  Activo
                </span>
              )}
            </div>
            <Button
              variant="outline"
              size="sm"
              onClick={handleManagePayment}
              disabled={!!actionLoading}
            >
              {actionLoading === 'portal' ? <Loader2 className="h-4 w-4 animate-spin" /> : <CreditCard className="h-4 w-4" />}
              Gestionar Pago
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-6">
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-gray-600">Profesionales</span>
                <span className="text-sm font-bold text-charcoal">
                  {usage?.professionals || 0} / {currentPlan.professionals}
                </span>
              </div>
              <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-primary rounded-full transition-all"
                  style={{ width: `${Math.min(usagePercentage, 100)}%` }}
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-gray-600">Mensajes WhatsApp</span>
                <span className="text-sm font-bold text-charcoal">
                  {usage?.whatsappMessages || 0}
                  {currentPlan.whatsappMessages !== 'Ilimitados' && ` / ${currentPlan.whatsappMessages}`}
                </span>
              </div>
              <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className="h-full bg-emerald-500 rounded-full transition-all"
                  style={{ width: currentPlan.whatsappMessages === 'Ilimitados' ? '100%' : '50%' }}
                />
              </div>
            </div>

            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-sm font-semibold text-gray-600">Citas este mes</span>
                <span className="text-sm font-bold text-charcoal">{usage?.appointments || 0}</span>
              </div>
              <div className="h-2 bg-gray-200 rounded-full overflow-hidden">
                <div className="h-full bg-primary/60 rounded-full" style={{ width: '60%' }} />
              </div>
            </div>
          </div>

          {usage?.currentPeriodEnd && (
            <div className="p-4 bg-gray-50 rounded-xl border border-gray-200">
              <p className="text-sm text-gray-500">
                Próximo cobro:{' '}
                <span className="font-bold text-charcoal">
                  {new Date(usage.currentPeriodEnd).toLocaleDateString('es-DO', {
                    day: 'numeric',
                    month: 'long',
                    year: 'numeric',
                  })}
                </span>
              </p>
            </div>
          )}
        </CardContent>
      </Card>

      {/* Plan Comparison */}
      <div>
        <h2 className="text-xl font-black text-charcoal mb-6">Comparativa de Planes</h2>
        <PricingPlans
          mode="upgrade"
          currentPlan={usage?.plan}
          onUpgrade={handleUpgrade}
          upgradeLoading={actionLoading}
          showDop={true}
        />
      </div>

      {/* Cancel Subscription */}
      {usage?.stripeSubscriptionId && (
        <Card variant="bordered">
          <CardHeader>
            <CardTitle className="text-charcoal">Cancelar Suscripción</CardTitle>
          </CardHeader>
          <CardContent>
            <div className="flex items-start gap-3 p-4 bg-amber-50 border border-amber-200 rounded-xl">
              <AlertTriangle className="h-5 w-5 text-amber-600 flex-shrink-0 mt-0.5" />
              <div className="flex-1">
                <p className="text-sm text-amber-900 font-semibold mb-1">
                  Al cancelar tu suscripción:
                </p>
                <ul className="text-sm text-amber-800 space-y-1">
                  <li>• Tu cuenta pasará al plan Gratis</li>
                  <li>• Perderás acceso a las funciones del plan actual</li>
                  <li>• El cambio se efectuará al final del período actual</li>
                </ul>
              </div>
            </div>
          </CardContent>
          <CardFooter>
            {!showCancelConfirm ? (
              <Button
                variant="danger"
                onClick={() => setShowCancelConfirm(true)}
                disabled={!!actionLoading}
              >
                Cancelar Suscripción
              </Button>
            ) : (
              <div className="flex gap-3">
                <Button
                  variant="secondary"
                  onClick={() => setShowCancelConfirm(false)}
                  disabled={!!actionLoading}
                >
                  Volver
                </Button>
                <Button
                  variant="danger"
                  onClick={handleCancelSubscription}
                  disabled={!!actionLoading}
                >
                  {actionLoading === 'cancel' ? <Loader2 className="h-4 w-4 animate-spin" /> : 'Confirmar Cancelación'}
                </Button>
              </div>
            )}
          </CardFooter>
        </Card>
      )}
    </div>
  );
}
