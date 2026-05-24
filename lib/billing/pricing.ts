/**
 * Pure pricing helpers — safe to import from client components.
 *
 * NO Stripe SDK, NO Prisma. Just math and types so client UI can compute
 * displayed prices without pulling in the full Stripe client bundle.
 */

export type BillingCycle = 'monthly' | 'annual';

/**
 * Annual billing config — 20% discount over monthly × 12 (industry standard).
 */
export const ANNUAL_DISCOUNT_PCT = 20;

/**
 * Compute the annual price (full year) given the monthly list price.
 *   monthly × 12 × (1 - 20/100)
 */
export function getAnnualPrice(monthlyPrice: number): number {
  return Math.round(monthlyPrice * 12 * (1 - ANNUAL_DISCOUNT_PCT / 100) * 100) / 100;
}

/**
 * Compute the "monthly equivalent" of an annual plan for display
 * ("$31.20/mo, billed annually").
 */
export function getAnnualMonthlyEquivalent(monthlyPrice: number): number {
  return Math.round(monthlyPrice * (1 - ANNUAL_DISCOUNT_PCT / 100) * 100) / 100;
}
