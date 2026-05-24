/**
 * Stripe Payment Functions
 *
 * Functions for creating checkout sessions and managing subscriptions.
 *
 * Pricing model (May 2026):
 *   - Every new subscription includes a 14-day trial (no card required).
 *   - First-50 "founder" shops get a 50% off forever coupon applied
 *     automatically when they reach Stripe Checkout.
 */

import { stripe, STRIPE_PRICE_IDS, STRIPE_PRICE_IDS_ANNUAL, STRIPE_FOUNDER_COUPON_ID, TRIAL_DAYS, type BillingCycle } from './client';
import { prisma } from '@/lib/db';

export interface CreateCheckoutSessionParams {
  shopId: string;
  plan: 'SOLO' | 'TEAM' | 'BUSINESS';
  billingCycle?: BillingCycle;  // 'monthly' (default) or 'annual'
  successUrl: string;
  cancelUrl: string;
  customerEmail?: string;
  shopName?: string;
}

/**
 * Create a Stripe checkout session for plan upgrade.
 *
 * Automatically applies the founder coupon if the shop is marked as a founder
 * (isFounder=true) and the coupon ID is configured.
 *
 * @param params - Checkout parameters
 * @returns Checkout session URL
 */
export async function createCheckoutSession(params: CreateCheckoutSessionParams): Promise<{
  url: string;
  sessionId: string;
}> {
  const { shopId, plan, billingCycle = 'monthly', successUrl, cancelUrl, customerEmail, shopName } = params;
  const priceMap = billingCycle === 'annual' ? STRIPE_PRICE_IDS_ANNUAL : STRIPE_PRICE_IDS;
  const priceId = priceMap[plan];

  if (!priceId) {
    throw new Error(`No Stripe Price ID configured for plan: ${plan} (${billingCycle})`);
  }

  // Check if this shop qualifies for the founder discount. We don't trust
  // a client-provided flag — we read straight from the DB.
  const shop = await prisma.shop.findUnique({
    where: { id: shopId },
    select: { isFounder: true, founderDiscountPct: true, trialEnd: true, stripeSubscriptionId: true },
  });

  // Founder coupon applies ONLY to monthly billing. Annual already has a 20%
  // discount baked into the price; stacking founder 50% × annual 20% = 60% off
  // is too generous and confuses positioning. The founder's 50%/mo is already
  // a better deal than annual's 20% — let them keep it as monthly.
  const isFounder = !!shop?.isFounder && (shop.founderDiscountPct ?? 0) > 0;
  const applyCoupon = isFounder && billingCycle === 'monthly' && !!STRIPE_FOUNDER_COUPON_ID;

  // Determine remaining trial days. If the shop is still inside its initial
  // 14-day trial window, we honor whatever's left. If the trial already
  // expired or doesn't exist, we don't pass a trial (Stripe will start billing
  // immediately on subscription).
  let trialDaysRemaining: number | undefined = undefined;
  if (!shop?.stripeSubscriptionId) {
    // No prior subscription — first-time checkout. Honor remaining trial.
    if (shop?.trialEnd) {
      const msLeft = shop.trialEnd.getTime() - Date.now();
      const daysLeft = Math.ceil(msLeft / (24 * 60 * 60 * 1000));
      if (daysLeft > 0) trialDaysRemaining = Math.min(daysLeft, TRIAL_DAYS);
    } else {
      // No trial recorded (legacy shop) — give them the full 14 days.
      trialDaysRemaining = TRIAL_DAYS;
    }
  }

  const session = await stripe.checkout.sessions.create({
    payment_method_types: ['card'],
    line_items: [
      {
        price: priceId,
        quantity: 1,
      },
    ],
    mode: 'subscription',
    success_url: successUrl,
    cancel_url: cancelUrl,
    ...(customerEmail && { customer_email: customerEmail }),
    client_reference_id: shopId,
    // Apply founder coupon if applicable. NOTE: Stripe checkout sessions
    // accept either `discounts` OR `allow_promotion_codes`, not both. We
    // pre-apply our specific coupon so the discount is irrevocable from
    // the customer's side.
    ...(applyCoupon && {
      discounts: [{ coupon: STRIPE_FOUNDER_COUPON_ID }],
    }),
    metadata: {
      shopId,
      plan,
      billingCycle,
      shopName: shopName || '',
      isFounder: String(isFounder),
    },
    subscription_data: {
      ...(trialDaysRemaining && { trial_period_days: trialDaysRemaining }),
      metadata: {
        shopId,
        plan,
        billingCycle,
        isFounder: String(isFounder),
      },
    },
  });

  if (!session.url) {
    throw new Error('Failed to create checkout session URL');
  }

  return {
    url: session.url,
    sessionId: session.id,
  };
}

/**
 * Create a portal session for managing subscription
 *
 * @param customerId - Stripe customer ID
 * @param returnUrl - URL to return to after portal session
 * @returns Portal session URL
 */
export async function createPortalSession(
  customerId: string,
  returnUrl: string
): Promise<string> {
  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: returnUrl,
  });

  return session.url;
}

/**
 * Get subscription details
 *
 * @param subscriptionId - Stripe subscription ID
 * @returns Subscription details
 */
export async function getSubscription(subscriptionId: string) {
  return await stripe.subscriptions.retrieve(subscriptionId, {
    expand: ['default_payment_method', 'items.data.price.product'],
  });
}

/**
 * Cancel subscription at end of period
 *
 * @param subscriptionId - Stripe subscription ID
 * @returns Updated subscription
 */
export async function cancelSubscription(subscriptionId: string) {
  return await stripe.subscriptions.update(subscriptionId, {
    cancel_at_period_end: true,
  });
}

/**
 * Reactivate cancelled subscription
 *
 * @param subscriptionId - Stripe subscription ID
 * @returns Updated subscription
 */
export async function reactivateSubscription(subscriptionId: string) {
  return await stripe.subscriptions.update(subscriptionId, {
    cancel_at_period_end: false,
  });
}

/**
 * Update subscription plan
 *
 * @param subscriptionId - Stripe subscription ID
 * @param newPriceId - New price ID
 * @returns Updated subscription
 */
export async function updateSubscriptionPlan(
  subscriptionId: string,
  newPriceId: string
) {
  const subscription = await stripe.subscriptions.retrieve(subscriptionId);

  return await stripe.subscriptions.update(subscriptionId, {
    items: [
      {
        id: subscription.items.data[0].id,
        price: newPriceId,
      },
    ],
  });
}

/**
 * Get or create Stripe customer
 *
 * @param email - Customer email
 * @param name - Customer name
 * @param metadata - Additional metadata
 * @returns Stripe customer
 */
export async function getOrCreateCustomer(
  email: string,
  name?: string,
  metadata?: Record<string, string>
) {
  // Try to find existing customer by email
  const existingCustomers = await stripe.customers.list({
    email: email.toLowerCase(),
    limit: 1,
  });

  if (existingCustomers.data.length > 0) {
    return existingCustomers.data[0];
  }

  // Create new customer
  return await stripe.customers.create({
    email: email.toLowerCase(),
    name,
    metadata,
  });
}

/**
 * Calculate prorated amount for plan upgrade
 *
 * @param subscriptionId - Current subscription ID
 * @param newPriceId - New price ID
 * @returns Prorated amount
 */
export async function calculateProratedAmount(
  subscriptionId: string,
  newPriceId: string
): Promise<number> {
  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  const invoice = await stripe.invoices.create({
    subscription: subscriptionId,
    description: 'Plan upgrade proration',
  });

  // This is a simplified calculation
  // In production, use Stripe's built-in proration with subscription update
  return invoice.total || 0;
}
