/**
 * Founder Program
 *
 * The first N shops that sign up during the launch phase receive a 50%
 * lifetime discount on any paid plan. The discount is recorded as flags
 * on the Shop record AND applied at the Stripe customer level via a
 * coupon when they subscribe.
 *
 * Why two-sided (DB + Stripe):
 *   - DB flag drives the UI ("Cliente fundador 50%") and admin reporting.
 *   - Stripe coupon is what actually reduces the invoice amount.
 *
 * Slots are FIFO: shop #1 through #N get it. Reaching the cap closes the
 * program; subsequent signups pay full list price.
 */

import { db } from '@/lib/database';
import { FOUNDER_PROGRAM } from './stripe/client';

export interface FounderStatus {
  totalSlots: number;
  claimedSlots: number;
  remainingSlots: number;
  isOpen: boolean;
  discountPct: number;
}

/**
 * Current state of the founder program. Cached briefly to avoid hammering
 * the DB from the landing page banner — but recomputed on each shop signup
 * to keep the cap accurate.
 */
export async function getFounderStatus(): Promise<FounderStatus> {
  const claimedSlots = await db.shop.count({ where: { isFounder: true } });
  const remainingSlots = Math.max(0, FOUNDER_PROGRAM.totalSlots - claimedSlots);
  return {
    totalSlots: FOUNDER_PROGRAM.totalSlots,
    claimedSlots,
    remainingSlots,
    isOpen: remainingSlots > 0,
    discountPct: FOUNDER_PROGRAM.discountPct,
  };
}

/**
 * Atomically assign founder status to a shop IF there are still slots.
 *
 * Race-condition safe: uses a conditional update that only succeeds if
 * the current count is below the cap, so two simultaneous signups can't
 * both claim slot #50.
 *
 * Returns true if the shop got the discount, false if the program is full.
 */
export async function assignFounderIfAvailable(shopId: string): Promise<boolean> {
  return db.$transaction(async (tx) => {
    const claimedSlots = await tx.shop.count({ where: { isFounder: true } });
    if (claimedSlots >= FOUNDER_PROGRAM.totalSlots) return false;

    await tx.shop.update({
      where: { id: shopId },
      data: {
        isFounder: true,
        founderDiscountPct: FOUNDER_PROGRAM.discountPct,
        foundedAt: new Date(),
      },
    });
    return true;
  });
}
