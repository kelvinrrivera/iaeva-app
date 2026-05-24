/**
 * Plan Enforcement System
 *
 * Plan Limits:
 * - SOLO:     1 professional, 1,000 WhatsApp messages/month
 * - TEAM:     5 professionals, 3,000 WhatsApp messages/month
 * - BUSINESS: unlimited professionals, 10,000 WhatsApp messages/month, multi-location, API access
 *
 * Every new shop starts with a 14-day TEAM-equivalent trial. There is no
 * permanent free plan.
 */

import { prisma } from '@/lib/db';
import type { Plan, Shop } from '@prisma/client';

const PLAN_LIMITS: Record<string, {
  maxProfessionals: number;
  maxWhatsAppMessages: number;
  maxAppointments: number;
  features: string[];
}> = {
  SOLO: {
    maxProfessionals: 1,
    maxWhatsAppMessages: 1000,
    maxAppointments: Infinity,
    features: ['basic_calendar', 'basic_appointments', 'analytics', 'reminders', 'walk_ins', 'whatsapp_chatbot'],
  },
  TEAM: {
    maxProfessionals: 5,
    maxWhatsAppMessages: 3000,
    maxAppointments: Infinity,
    features: ['basic_calendar', 'basic_appointments', 'analytics', 'reminders', 'walk_ins', 'team_management', 'multi_service', 'whatsapp_chatbot', 'memberships'],
  },
  BUSINESS: {
    maxProfessionals: Infinity,
    maxWhatsAppMessages: 10000,
    maxAppointments: Infinity,
    features: ['basic_calendar', 'basic_appointments', 'analytics', 'reminders', 'walk_ins', 'team_management', 'multi_service', 'multi_location', 'custom_bot', 'api_access', 'whatsapp_chatbot', 'memberships'],
  },
};

/**
 * Get plan limits safely — falls back to SOLO if unknown plan (defensive).
 */
function getPlanLimits(plan: string) {
  return PLAN_LIMITS[plan] ?? PLAN_LIMITS.SOLO;
}

/**
 * Check if shop can add another professional
 */
export async function canAddProfessional(shopId: string): Promise<{
  allowed: boolean;
  current: number;
  max: number;
  reason?: string;
}> {
  const shop = await prisma.shop.findUnique({
    where: { id: shopId },
    include: {
      memberships: {
        where: { role: 'PROFESSIONAL' },
      },
    },
  });

  if (!shop) {
    return { allowed: false, current: 0, max: 0, reason: 'Shop not found' };
  }

  const limits = getPlanLimits(shop.plan);
  const currentCount = shop.memberships.length;

  if (currentCount >= limits.maxProfessionals) {
    return {
      allowed: false,
      current: currentCount,
      max: limits.maxProfessionals,
      reason: `El plan ${shop.plan} permite máximo ${limits.maxProfessionals} profesional(es). Actualiza tu plan para añadir más.`,
    };
  }

  return { allowed: true, current: currentCount, max: limits.maxProfessionals };
}

/**
 * Check if shop can send WhatsApp message
 */
export async function canSendWhatsAppMessage(shopId: string): Promise<{
  allowed: boolean;
  current: number;
  max: number;
  reason?: string;
}> {
  const shop = await prisma.shop.findUnique({ where: { id: shopId } });

  if (!shop) {
    return { allowed: false, current: 0, max: 0, reason: 'Shop not found' };
  }

  const limits = getPlanLimits(shop.plan);

  if (limits.maxWhatsAppMessages === Infinity) {
    return { allowed: true, current: 0, max: Infinity };
  }

  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  let usageStats = await prisma.usageStats.findUnique({
    where: { shopId_month: { shopId, month: currentMonth } },
  });

  if (!usageStats) {
    usageStats = await prisma.usageStats.create({
      data: { shopId, month: currentMonth, whatsappMessagesSent: 0, appointmentsCreated: 0, professionalsCount: 0 },
    });
  }

  const currentCount = usageStats.whatsappMessagesSent;

  if (currentCount >= limits.maxWhatsAppMessages) {
    return {
      allowed: false,
      current: currentCount,
      max: limits.maxWhatsAppMessages,
      reason: `El plan ${shop.plan} incluye ${limits.maxWhatsAppMessages} mensajes de WhatsApp/mes. Actualiza tu plan para mensajes ilimitados.`,
    };
  }

  return { allowed: true, current: currentCount, max: limits.maxWhatsAppMessages };
}

/**
 * Track WhatsApp message sent
 */
export async function trackWhatsAppMessage(shopId: string): Promise<void> {
  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  await prisma.usageStats.upsert({
    where: { shopId_month: { shopId, month: currentMonth } },
    create: { shopId, month: currentMonth, whatsappMessagesSent: 1 },
    update: { whatsappMessagesSent: { increment: 1 } },
  });
}

/**
 * Track appointment created
 */
export async function trackAppointmentCreated(shopId: string): Promise<void> {
  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  await prisma.usageStats.upsert({
    where: { shopId_month: { shopId, month: currentMonth } },
    create: { shopId, month: currentMonth, appointmentsCreated: 1 },
    update: { appointmentsCreated: { increment: 1 } },
  });
}

/**
 * Check if shop can use a feature
 */
export function canUseFeature(shop: Shop, feature: string): boolean {
  const limits = getPlanLimits(shop.plan);
  return limits.features.includes(feature);
}

/**
 * Get plan upgrade suggestion
 */
export function getUpgradeSuggestion(shop: Shop, currentUsage: {
  professionals: number;
  messages: number;
}): {
  needsUpgrade: boolean;
  suggestedPlan?: Plan;
  reason: string;
} {
  const currentLimits = getPlanLimits(shop.plan);

  if (
    currentUsage.professionals <= currentLimits.maxProfessionals &&
    (currentLimits.maxWhatsAppMessages === Infinity ||
      currentUsage.messages <= currentLimits.maxWhatsAppMessages)
  ) {
    return { needsUpgrade: false, reason: 'El plan actual es suficiente' };
  }

  if (currentUsage.professionals <= 1) {
    return {
      needsUpgrade: true,
      suggestedPlan: 'SOLO' as Plan,
      reason: 'Actualiza a SOLO para mensajes de WhatsApp ilimitados y analytics.',
    };
  }

  if (currentUsage.professionals <= 5) {
    return {
      needsUpgrade: true,
      suggestedPlan: 'TEAM' as Plan,
      reason: `Necesitas ${currentUsage.professionals} profesionales. Actualiza a TEAM para hasta 5.`,
    };
  }

  return {
    needsUpgrade: true,
    suggestedPlan: 'BUSINESS' as Plan,
    reason: `Necesitas ${currentUsage.professionals} profesionales. Actualiza a BUSINESS para ilimitados.`,
  };
}

/**
 * Get current usage for shop
 */
export async function getShopUsage(shopId: string) {
  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;

  const [shop, usageStats, professionalsCount] = await Promise.all([
    prisma.shop.findUnique({
      where: { id: shopId },
      include: { memberships: { where: { role: 'PROFESSIONAL' } } },
    }),
    prisma.usageStats.findUnique({
      where: { shopId_month: { shopId, month: currentMonth } },
    }),
    prisma.membership.count({ where: { shopId, role: 'PROFESSIONAL' } }),
  ]);

  if (!shop) return null;

  const limits = getPlanLimits(shop.plan);

  return {
    plan: shop.plan,
    professionals: professionalsCount,
    maxProfessionals: limits.maxProfessionals,
    whatsappMessages: usageStats?.whatsappMessagesSent || 0,
    maxWhatsAppMessages: limits.maxWhatsAppMessages,
    appointments: usageStats?.appointmentsCreated || 0,
    currentPeriodEnd: shop.currentPeriodEnd,
    subscriptionStatus: shop.subscriptionStatus,
    stripeSubscriptionId: shop.stripeSubscriptionId,
    trialEnd: shop.trialEnd,
    isFounder: shop.isFounder,
    founderDiscountPct: shop.founderDiscountPct,
  };
}

/**
 * Middleware to enforce plan limits
 */
export function enforcePlanLimits(feature: string) {
  return async (shopId: string, action: () => Promise<void>) => {
    const shop = await prisma.shop.findUnique({ where: { id: shopId } });

    if (!shop) throw new Error('Shop not found');

    if (!canUseFeature(shop, feature)) {
      throw new Error(`La función "${feature}" no está disponible en tu plan actual. Actualiza tu plan para acceder.`);
    }

    await action();
  };
}
