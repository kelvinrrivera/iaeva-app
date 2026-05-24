/**
 * Analytics Metrics Engine
 *
 * Functions for calculating business metrics and KPIs.
 */

import { prisma } from '@/lib/db';

/**
 * Get total revenue for a shop in a period
 */
export async function getTotalRevenue(
  shopId: string,
  period: { start: Date; end: Date }
): Promise<number> {
  const appointments = await prisma.appointment.findMany({
    where: {
      shopId,
      startTime: {
        gte: period.start,
        lte: period.end,
      },
      status: { in: ['COMPLETED', 'CONFIRMED'] },
    },
    include: {
      service: true,
    },
  });

  return appointments.reduce((total, apt) => total + apt.service.price, 0);
}

/**
 * Get appointments count for a shop in a period
 */
export async function getAppointmentsCount(
  shopId: string,
  period: { start: Date; end: Date }
): Promise<number> {
  return await prisma.appointment.count({
    where: {
      shopId,
      startTime: {
        gte: period.start,
        lte: period.end,
      },
    },
  });
}

/**
 * Get new clients in a period
 */
export async function getNewClients(
  shopId: string,
  period: { start: Date; end: Date }
): Promise<number> {
  return await prisma.client.count({
    where: {
      shopId,
      createdAt: {
        gte: period.start,
        lte: period.end,
      },
    },
  });
}

/**
 * Get top performing services
 */
export async function getTopServices(
  shopId: string,
  period: { start: Date; end: Date },
  limit: number = 5
): Promise<{ name: string; count: number; revenue: number }[]> {
  const appointments = await prisma.appointment.findMany({
    where: {
      shopId,
      startTime: {
        gte: period.start,
        lte: period.end,
      },
      status: { in: ['COMPLETED', 'CONFIRMED'] },
    },
    include: {
      service: true,
    },
  });

  // Group by service
  const serviceMap = new Map<string, { count: number; revenue: number }>();

  for (const apt of appointments) {
    const serviceName = apt.service.name;
    const existing = serviceMap.get(serviceName) || { count: 0, revenue: 0 };
    serviceMap.set(serviceName, {
      count: existing.count + 1,
      revenue: existing.revenue + apt.service.price,
    });
  }

  // Sort by revenue and limit
  return Array.from(serviceMap.entries())
    .map(([name, data]) => ({ name, ...data }))
    .sort((a, b) => b.revenue - a.revenue)
    .slice(0, limit);
}

/**
 * Get stylist performance metrics
 */
export async function getStylistPerformance(
  shopId: string,
  period: { start: Date; end: Date }
): Promise<Array<{ name: string; appointments: number; revenue: number }>> {
  const appointments = await prisma.appointment.findMany({
    where: {
      shopId,
      startTime: {
        gte: period.start,
        lte: period.end,
      },
      status: { in: ['COMPLETED', 'CONFIRMED'] },
    },
    include: {
      stylist: true,
      service: true,
    },
  });

  // Group by stylist
  const stylistMap = new Map<string, { appointments: number; revenue: number }>();

  for (const apt of appointments) {
    const stylistName = apt.stylist.name;
    const existing = stylistMap.get(stylistName) || { appointments: 0, revenue: 0 };
    stylistMap.set(stylistName, {
      appointments: existing.appointments + 1,
      revenue: existing.revenue + apt.service.price,
    });
  }

  return Array.from(stylistMap.entries()).map(([name, data]) => ({ name, ...data }));
}

/**
 * Get daily revenue for a chart
 */
export async function getDailyRevenue(
  shopId: string,
  days: number
): Promise<Array<{ date: string; revenue: number }>> {
  const endDate = new Date();
  endDate.setHours(23, 59, 59, 999);
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  startDate.setHours(0, 0, 0, 0);

  const appointments = await prisma.appointment.findMany({
    where: {
      shopId,
      startTime: {
        gte: startDate,
        lte: endDate,
      },
      status: { in: ['COMPLETED', 'CONFIRMED'] },
    },
    include: {
      service: true,
    },
    orderBy: {
      startTime: 'asc',
    },
  });

  // Group by day
  const dailyMap = new Map<string, number>();

  for (const apt of appointments) {
    const dateKey = apt.startTime.toISOString().split('T')[0];
    const existing = dailyMap.get(dateKey) || 0;
    dailyMap.set(dateKey, existing + apt.service.price);
  }

  // Fill in missing days with 0
  const result = [];
  const currentDate = new Date(startDate);
  while (currentDate <= endDate) {
    const dateKey = currentDate.toISOString().split('T')[0];
    result.push({
      date: dateKey,
      revenue: dailyMap.get(dateKey) || 0,
    });
    currentDate.setDate(currentDate.getDate() + 1);
  }

  return result;
}

/**
 * Get outstanding debt across all clients
 */
export async function getPendingDebt(shopId: string): Promise<{ totalDebt: number; clientsWithDebt: number }> {
  const clients = await prisma.client.findMany({
    where: { shopId, debtAmount: { gt: 0 } },
    select: { debtAmount: true },
  });

  return {
    totalDebt: clients.reduce((sum, c) => sum + c.debtAmount, 0),
    clientsWithDebt: clients.length,
  };
}

/**
 * Get peak hour (most appointments) and strongest day of week
 */
export async function getPeakPatterns(
  shopId: string,
  period: { start: Date; end: Date }
): Promise<{ peakHour: number | null; peakHourCount: number; strongestDay: number | null; strongestDayCount: number; hourlyDistribution: number[]; dailyDistribution: number[] }> {
  const appointments = await prisma.appointment.findMany({
    where: {
      shopId,
      startTime: { gte: period.start, lte: period.end },
      status: { notIn: ['CANCELLED', 'NO_SHOW'] },
    },
    select: { startTime: true },
  });

  const hourCounts = new Array(24).fill(0);
  const dayCounts = new Array(7).fill(0);

  for (const apt of appointments) {
    hourCounts[apt.startTime.getHours()]++;
    dayCounts[apt.startTime.getDay()]++;
  }

  const maxHourCount = Math.max(...hourCounts);
  const peakHour = maxHourCount > 0 ? hourCounts.indexOf(maxHourCount) : null;

  const maxDayCount = Math.max(...dayCounts);
  const strongestDay = maxDayCount > 0 ? dayCounts.indexOf(maxDayCount) : null;

  return {
    peakHour,
    peakHourCount: maxHourCount,
    strongestDay,
    strongestDayCount: maxDayCount,
    hourlyDistribution: hourCounts,
    dailyDistribution: dayCounts,
  };
}

/**
 * Get inactive clients (no appointment in last 30 days but had one before)
 */
export async function getInactiveClients(shopId: string): Promise<number> {
  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

  const inactiveClients = await prisma.client.count({
    where: {
      shopId,
      appointments: {
        some: { startTime: { lt: thirtyDaysAgo } },
        none: { startTime: { gte: thirtyDaysAgo } },
      },
    },
  });

  return inactiveClients;
}

/**
 * Get no-show and attendance metrics for a period
 */
export async function getNoShowMetrics(
  shopId: string,
  period: { start: Date; end: Date }
): Promise<{
  noShows: number;
  cancelled: number;
  completed: number;
  total: number;
  noShowRate: number;
  attendanceRate: number;
}> {
  const appointments = await prisma.appointment.groupBy({
    by: ['status'],
    where: {
      shopId,
      startTime: { gte: period.start, lte: period.end },
    },
    _count: { id: true },
  });

  const countByStatus: Record<string, number> = {};
  for (const row of appointments) {
    countByStatus[row.status] = row._count.id;
  }

  const noShows   = countByStatus['NO_SHOW']   ?? 0;
  const cancelled = countByStatus['CANCELLED'] ?? 0;
  const completed = countByStatus['COMPLETED'] ?? 0;
  const total     = Object.values(countByStatus).reduce((a, b) => a + b, 0);

  const noShowRate    = total > 0 ? Math.round((noShows   / total) * 100) : 0;
  const attendanceRate = total > 0 ? Math.round((completed / total) * 100) : 0;

  return { noShows, cancelled, completed, total, noShowRate, attendanceRate };
}

export async function getAnalyticsData(
  shopId: string,
  period: { start: Date; end: Date }
) {
  const days = Math.ceil((period.end.getTime() - period.start.getTime()) / (1000 * 60 * 60 * 24));

  const [
    totalRevenue,
    appointmentsCount,
    newClients,
    topServices,
    stylistPerformance,
    dailyRevenue,
    noShowMetrics,
    pendingDebt,
    peakPatterns,
    inactiveClients,
  ] = await Promise.all([
    getTotalRevenue(shopId, period),
    getAppointmentsCount(shopId, period),
    getNewClients(shopId, period),
    getTopServices(shopId, period),
    getStylistPerformance(shopId, period),
    getDailyRevenue(shopId, days),
    getNoShowMetrics(shopId, period),
    getPendingDebt(shopId),
    getPeakPatterns(shopId, period),
    getInactiveClients(shopId),
  ]);

  return {
    totalRevenue,
    appointmentsCount,
    newClients,
    topServices,
    stylistPerformance,
    dailyRevenue,
    noShows:      noShowMetrics.noShows,
    noShowRate:   noShowMetrics.noShowRate,
    cancelled:    noShowMetrics.cancelled,
    attendanceRate: noShowMetrics.attendanceRate,
    completedCount: noShowMetrics.completed,
    pendingDebt,
    peakPatterns,
    inactiveClients,
  };
}
