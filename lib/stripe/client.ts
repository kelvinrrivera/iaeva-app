/**
 * Stripe Client Configuration
 *
 * Pricing model (May 2026):
 *   - NO permanent free plan. Every new shop starts a 14-day trial with full
 *     features of the TEAM plan, no credit card required.
 *   - After the trial they must pick a paid plan (SOLO/TEAM/BUSINESS) or the
 *     account moves to "trial_expired" and WhatsApp dispatch is suspended.
 *   - First-50 founder offer: 50% off for life via a Stripe coupon applied
 *     at the customer level when subscription is created.
 *
 * Plans (USD/month, list price BEFORE founder discount):
 *   SOLO     — $19  · 1 professional
 *   TEAM     — $39  · up to 5 professionals
 *   BUSINESS — $79  · unlimited professionals, multi-location
 */

import Stripe from 'stripe';

export const stripe = new Stripe(process.env.STRIPE_SECRET_KEY || '', {
  apiVersion: '2026-01-28.clover',
  typescript: true,
});

/**
 * Stripe Price IDs (configure in Stripe Dashboard, then expose via env vars).
 *
 * Annual prices = monthly price × 12 × 0.80 (20% off — industry standard).
 * Example for TEAM ($39/mes):
 *   monthly: $39/mo
 *   annual:  $374.40/yr ≈ $31.20/mo equivalent
 */
export const STRIPE_PRICE_IDS = {
  SOLO: process.env.STRIPE_PRICE_SOLO || '',
  TEAM: process.env.STRIPE_PRICE_TEAM || '',
  BUSINESS: process.env.STRIPE_PRICE_BUSINESS || '',
} as const;

export const STRIPE_PRICE_IDS_ANNUAL = {
  SOLO: process.env.STRIPE_PRICE_SOLO_ANNUAL || '',
  TEAM: process.env.STRIPE_PRICE_TEAM_ANNUAL || '',
  BUSINESS: process.env.STRIPE_PRICE_BUSINESS_ANNUAL || '',
} as const;

// Re-export pure pricing helpers from a client-safe module. This keeps server
// code (Stripe SDK) out of the client bundle when components import these.
import type { BillingCycle } from '@/lib/billing/pricing';
export { ANNUAL_DISCOUNT_PCT, getAnnualPrice, getAnnualMonthlyEquivalent } from '@/lib/billing/pricing';
export type { BillingCycle };

/**
 * Founder-program Stripe coupon ID. Apply this coupon to a customer to get
 * the lifetime founder discount. Create the coupon in Stripe Dashboard
 * (50% off, forever, duration: forever).
 */
export const STRIPE_FOUNDER_COUPON_ID = process.env.STRIPE_FOUNDER_COUPON_ID || '';

/**
 * Trial config — applies to every new shop.
 */
export const TRIAL_DAYS = 14;

/**
 * Founder program config — first N shops get the lifetime discount.
 *
 * 25 slots chosen over 50 deliberately:
 *   - Higher scarcity → stronger urgency in the landing banner
 *   - "23 of 25" reads more urgent than "23 of 50" (same number left)
 *   - Easier to manage individually (WhatsApp follow-ups, testimonials)
 *   - Lower opportunity cost (each over-50 sale at full price is +$11.70/yr ARR)
 *
 * Future expansion: when these 25 fill, launch "Wave 2 — Pioneros" at 30% off,
 * then "Wave 3 — Embajadores" at 20% off. Three waves > one slow burn.
 */
export const FOUNDER_PROGRAM = {
  totalSlots: 25,
  discountPct: 50,
} as const;

/**
 * Plan limits enforced server-side.
 */
export const PLAN_LIMITS = {
  SOLO:     { professionals: 1,        whatsappMessages: 1000, multiLocation: false },
  TEAM:     { professionals: 5,        whatsappMessages: 3000, multiLocation: false },
  BUSINESS: { professionals: Infinity, whatsappMessages: 10000, multiLocation: true  },
} as const;

/**
 * Plan metadata for UI rendering.
 */
export const PLAN_DETAILS = {
  SOLO: {
    name: 'SOLO',
    displayName: 'Solo',
    price: 19,
    currency: 'USD',
    interval: 'month' as const,
    stripePriceId: STRIPE_PRICE_IDS.SOLO,
    tagline: 'Para barberos independientes',
    features: [
      '1 profesional',
      'Hasta 1,000 mensajes WhatsApp/mes',
      'Chatbot 24/7 en español dominicano',
      'Recordatorios automáticos (24h, 6h, 2h, 1h)',
      'Calendario, walk-ins y cola del día',
      'Soporte por WhatsApp',
    ],
  },
  TEAM: {
    name: 'TEAM',
    displayName: 'Equipo',
    price: 39,
    currency: 'USD',
    interval: 'month' as const,
    stripePriceId: STRIPE_PRICE_IDS.TEAM,
    popular: true,
    tagline: 'Para salones con equipo',
    features: [
      'Hasta 5 profesionales',
      'Hasta 3,000 mensajes WhatsApp/mes',
      'Todo lo de SOLO',
      'Gestión de equipo y roles',
      'Analítica por profesional',
      'Multi-servicio por cita',
      'Soporte prioritario',
    ],
  },
  BUSINESS: {
    name: 'BUSINESS',
    displayName: 'Negocios',
    price: 79,
    currency: 'USD',
    interval: 'month' as const,
    stripePriceId: STRIPE_PRICE_IDS.BUSINESS,
    tagline: 'Para cadenas y multi-sucursal',
    features: [
      'Profesionales ilimitados',
      'Hasta 10,000 mensajes WhatsApp/mes',
      'Multi-sucursal',
      'Bot personalizable con IA',
      'Acceso a API',
      'Soporte dedicado',
    ],
  },
} as const;

export type PlanName = keyof typeof PLAN_DETAILS;
export const PLAN_NAMES: readonly PlanName[] = ['SOLO', 'TEAM', 'BUSINESS'] as const;

export function getPriceIdForPlan(plan: PlanName, cycle: BillingCycle = 'monthly'): string {
  const map = cycle === 'annual' ? STRIPE_PRICE_IDS_ANNUAL : STRIPE_PRICE_IDS;
  return map[plan] || '';
}

/**
 * Reverse lookup: get plan name + billing cycle from Stripe price_id.
 */
export function getPlanFromPriceId(priceId: string): { plan: PlanName; cycle: BillingCycle } | null {
  for (const plan of PLAN_NAMES) {
    if (STRIPE_PRICE_IDS[plan] && STRIPE_PRICE_IDS[plan] === priceId) {
      return { plan, cycle: 'monthly' };
    }
    if (STRIPE_PRICE_IDS_ANNUAL[plan] && STRIPE_PRICE_IDS_ANNUAL[plan] === priceId) {
      return { plan, cycle: 'annual' };
    }
  }
  return null;
}

/**
 * Apply founder discount to a list price.
 */
export function applyFounderDiscount(price: number, discountPct: number): number {
  if (discountPct <= 0) return price;
  const discounted = price * (1 - discountPct / 100);
  return Math.round(discounted * 100) / 100;
}

/**
 * Validate Stripe webhook signature.
 */
export function constructWebhookEvent(payload: string, signature: string) {
  const webhookSecret = process.env.STRIPE_WEBHOOK_SECRET;
  if (!webhookSecret) {
    throw new Error('STRIPE_WEBHOOK_SECRET is not set');
  }
  return stripe.webhooks.constructEvent(payload, signature, webhookSecret);
}

/**
 * Format price for display in USD.
 */
export function formatPrice(amount: number, currency: string = 'USD'): string {
  if (amount === 0) return '$0';
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency,
    minimumFractionDigits: amount % 1 === 0 ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(amount);
}
