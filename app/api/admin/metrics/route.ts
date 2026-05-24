/**
 * GET /api/admin/metrics
 * High-level KPIs for the owner dashboard.
 */

import { NextResponse, NextRequest } from 'next/server';
import { withOwnerAuth } from '@/lib/admin-auth';
import { db } from '@/lib/database';
import { PLAN_DETAILS } from '@/lib/stripe/client';

const PRICE_BY_PLAN: Record<string, number> = {
  SOLO: PLAN_DETAILS.SOLO.price,
  TEAM: PLAN_DETAILS.TEAM.price,
  BUSINESS: PLAN_DETAILS.BUSINESS.price,
};

async function handler(_admin: { id: string; email: string }, _req: NextRequest) {
  const now = new Date();
  const day = 24 * 60 * 60 * 1000;
  const d30 = new Date(now.getTime() - 30 * day);
  const d7 = new Date(now.getTime() - 7 * day);
  const d1 = new Date(now.getTime() - day);

  const [
    shopsTotal,
    shopsByPlan,
    appts30d,
    appts7d,
    appts1d,
    messages1d,
    shopsWaConnected,
    shopsActiveLast30,
    recentErrorsCount,
    activeAlertsCount,
  ] = await Promise.all([
    db.shop.count(),
    db.shop.groupBy({ by: ['plan'], _count: { _all: true } }),
    db.appointment.count({ where: { createdAt: { gte: d30 } } }),
    db.appointment.count({ where: { createdAt: { gte: d7 } } }),
    db.appointment.count({ where: { createdAt: { gte: d1 } } }),
    db.chatHistory.count({ where: { createdAt: { gte: d1 } } }),
    db.shop.count({ where: { whatsappEnabled: true, wabaId: { not: null } } }),
    db.shop.count({
      where: {
        appointments: { some: { createdAt: { gte: d30 } } },
      },
    }),
    db.systemLog.count({ where: { severity: 'error', createdAt: { gte: d1 } } }),
    db.systemLog.count({ where: { severity: { in: ['error', 'warn'] }, createdAt: { gte: d7 } } }),
  ]);

  const planCounts: Record<string, number> = { SOLO: 0, TEAM: 0, BUSINESS: 0 };
  for (const row of shopsByPlan) {
    const key = String((row as any).plan ?? 'SOLO');
    planCounts[key] = (row as any)._count?._all ?? 0;
  }

  const mrr =
    planCounts.SOLO * PRICE_BY_PLAN.SOLO +
    planCounts.TEAM * PRICE_BY_PLAN.TEAM +
    planCounts.BUSINESS * PRICE_BY_PLAN.BUSINESS;

  // Citas por día (últimos 14 días) — para gráfica
  const dailyAppointments: { date: string; count: number }[] = [];
  for (let i = 13; i >= 0; i--) {
    const start = new Date(now.getTime() - i * day);
    start.setHours(0, 0, 0, 0);
    const end = new Date(start.getTime() + day);
    const count = await db.appointment.count({ where: { createdAt: { gte: start, lt: end } } });
    dailyAppointments.push({
      date: start.toISOString().slice(5, 10), // MM-DD
      count,
    });
  }

  return NextResponse.json({
    mrr,
    arr: mrr * 12,
    shops: {
      total: shopsTotal,
      activeLast30: shopsActiveLast30,
      waConnected: shopsWaConnected,
      byPlan: planCounts,
    },
    appointments: {
      last24h: appts1d,
      last7d: appts7d,
      last30d: appts30d,
    },
    messages: {
      last24h: messages1d,
    },
    health: {
      errorsLast24h: recentErrorsCount,
      activeAlerts: activeAlertsCount,
    },
    charts: {
      dailyAppointments,
    },
    timestamp: now.toISOString(),
  });
}

export const GET = withOwnerAuth(handler);
