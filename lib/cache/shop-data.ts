/**
 * Shop-level cache using Next.js unstable_cache (persists across requests on the same instance).
 * Use these wrappers for data that changes infrequently (services, availability, shop metadata)
 * to reduce DB pressure on hot paths like the chatbot and public booking page.
 */
import { unstable_cache } from 'next/cache';
import { db } from '@/lib/database';

/** Services by shop — 5-minute TTL. Invalidate via revalidateTag('shop-services-<shopId>') after CRUD. */
export const getCachedServices = (shopId: string) =>
  unstable_cache(
    async () => {
      return db.service.findMany({
        where: { shopId },
        orderBy: { name: 'asc' },
      });
    },
    ['shop-services', shopId],
    { revalidate: 300, tags: [`shop-services-${shopId}`] }
  )();

/** Shop availability (hours) by day — 10-minute TTL. */
export const getCachedShopAvailability = (shopId: string, dayOfWeek: number) =>
  unstable_cache(
    async () => {
      return db.shopAvailability.findFirst({
        where: { shopId, dayOfWeek },
      });
    },
    ['shop-availability', shopId, String(dayOfWeek)],
    { revalidate: 600, tags: [`shop-availability-${shopId}`] }
  )();

/** Shop metadata (name, logo, plan) — 5-minute TTL. */
export const getCachedShopMeta = (shopId: string) =>
  unstable_cache(
    async () => {
      return db.shop.findUnique({
        where: { id: shopId },
        select: {
          id: true,
          name: true,
          logoUrl: true,
          plan: true,
          shopType: true,
          whatsappEnabled: true,
          whatsappPhoneNumber: true,
        },
      });
    },
    ['shop-meta', shopId],
    { revalidate: 300, tags: [`shop-meta-${shopId}`] }
  )();
