/**
 * Slot optimizer.
 *
 * Returns available slot times (HH:mm) for a given (stylist, date, service),
 * sorted by score so the best ones for the BUSINESS appear first.
 *
 * Considers:
 *  - Shop hours + stylist availability (intersection of both windows)
 *  - Existing appointments + time blocks (vacations, breaks)
 *  - Active walk-ins (block the stylist until their estimated end)
 *  - Service duration + buffer
 *
 * Scoring (higher score = surfaced first):
 *  - Base: 50
 *  - Hot hours (9-11, 14-17): +10
 *  - "Pegado-después" — slot starts right after an existing booking (gap ≤ 60min):
 *    +30 scaled down to 0 as the gap grows. Encourages back-to-back work.
 *  - "Pegado-antes" — slot ends right before the next booking (gap ≤ 60min): same scale.
 *  - "Orphan gap" PENALTY — if accepting this slot would leave a 5-45min hole
 *    against the next/previous occupied block or against open/close, -40.
 *    These tiny gaps almost never sell and waste the day.
 *  - Edge bonus — first slot of the day or last slot before closing: +15.
 */

import { startOfDay, endOfDay, areIntervalsOverlapping, addMinutes, isBefore, format } from 'date-fns';
import { db } from '@/lib/database';

export async function getOptimizedSlots(
  shopId: string,
  stylistId: string,
  dateStr: string,
  serviceId?: string,
): Promise<string[]> {
  try {
    if (!serviceId) return [];

    const date = new Date(dateStr + 'T12:00:00');
    const dayOfWeek = date.getDay();

    const [service, availability, shopHours] = await Promise.all([
      db.service.findFirst({ where: { id: serviceId, shopId } }),
      db.availability.findFirst({ where: { stylistId, dayOfWeek } }),
      db.shopAvailability.findFirst({ where: { shopId, dayOfWeek } }),
    ]);

    if (!service || !shopHours) return [];
    // If the stylist has no per-day Availability configured, fall back to
    // the shop hours. Without this, fresh shops that only set ShopAvailability
    // would never return slots.
    const effectiveAvailability = availability ?? {
      startTime: shopHours.startTime,
      endTime: shopHours.endTime,
    };

    const dayStart = startOfDay(date);
    const dayEnd = endOfDay(date);

    const [appointments, timeBlocks, activeWalkIns] = await Promise.all([
      db.appointment.findMany({
        where: { stylistId, startTime: { gte: dayStart, lte: dayEnd }, status: { notIn: ['CANCELLED'] } },
      }),
      db.timeBlock.findMany({
        where: { stylistId, startTime: { gte: dayStart, lte: dayEnd } },
      }),
      db.walkIn.findMany({
        where: {
          shopId,
          stylistId,
          arrivedAt: { gte: dayStart, lte: dayEnd },
          status: { in: ['WAITING', 'IN_PROGRESS'] },
          estimatedEnd: { not: null },
        },
      }),
    ]);

    const occupiedBlocks = [
      ...appointments.map(a => ({ start: new Date(a.startTime), end: new Date(a.endTime) })),
      ...timeBlocks.map(b => ({ start: new Date(b.startTime), end: new Date(b.endTime) })),
      ...activeWalkIns.map(w => ({ start: new Date(w.arrivedAt), end: new Date(w.estimatedEnd!) })),
    ];

    const [sH, sM] = shopHours.startTime.split(':').map(Number);
    const [eH, eM] = shopHours.endTime.split(':').map(Number);
    const [aH, aM] = effectiveAvailability.startTime.split(':').map(Number);
    const [bH, bM] = effectiveAvailability.endTime.split(':').map(Number);

    const effectiveStartMin = Math.max(sH * 60 + sM, aH * 60 + aM);
    const effectiveEndMin = Math.min(eH * 60 + eM, bH * 60 + bM);
    const totalDuration = service.duration + (service.bufferTime ?? 0);
    const now = new Date();

    // Day open/close as Date objects so we can compute edge bonuses + orphan gaps
    const dayOpen = new Date(date);
    dayOpen.setHours(Math.floor(effectiveStartMin / 60), effectiveStartMin % 60, 0, 0);
    const dayClose = new Date(date);
    dayClose.setHours(Math.floor(effectiveEndMin / 60), effectiveEndMin % 60, 0, 0);

    const scored: { time: string; score: number }[] = [];

    for (let min = effectiveStartMin; min + totalDuration <= effectiveEndMin; min += 15) {
      const slotStart = new Date(date);
      slotStart.setHours(Math.floor(min / 60), min % 60, 0, 0);
      const slotEnd = addMinutes(slotStart, totalDuration);

      if (!isBefore(now, slotStart)) continue;

      const hasConflict = occupiedBlocks.some(b =>
        areIntervalsOverlapping({ start: slotStart, end: slotEnd }, b),
      );
      if (hasConflict) continue;

      let score = 50;
      const hour = slotStart.getHours();
      if ((hour >= 9 && hour < 11) || (hour >= 14 && hour < 17)) score += 10;

      // Find immediate neighbors (closest occupied block before and after this slot)
      const prevBlock = occupiedBlocks
        .filter(b => b.end <= slotStart)
        .sort((a, b) => b.end.getTime() - a.end.getTime())[0];
      const nextBlock = occupiedBlocks
        .filter(b => b.start >= slotEnd)
        .sort((a, b) => a.start.getTime() - b.start.getTime())[0];

      // Pegado-después: slot starts right after a previous booking
      if (prevBlock) {
        const gapBefore = (slotStart.getTime() - prevBlock.end.getTime()) / 60000;
        if (gapBefore >= 0 && gapBefore <= 60) score += Math.max(0, 30 - gapBefore / 2);
      }

      // Pegado-antes: slot ends right before the next booking
      if (nextBlock) {
        const gapAfter = (nextBlock.start.getTime() - slotEnd.getTime()) / 60000;
        if (gapAfter >= 0 && gapAfter <= 60) score += Math.max(0, 30 - gapAfter / 2);
      }

      // Orphan gap penalty — applied to the gap left ON EITHER SIDE of this slot
      // against the neighbor block OR against open/close. 5-45min holes are
      // the hardest to sell, so we actively avoid creating them.
      const leftNeighborEnd = prevBlock ? prevBlock.end : dayOpen;
      const rightNeighborStart = nextBlock ? nextBlock.start : dayClose;
      const leftGap = (slotStart.getTime() - leftNeighborEnd.getTime()) / 60000;
      const rightGap = (rightNeighborStart.getTime() - slotEnd.getTime()) / 60000;
      if (leftGap >= 5 && leftGap <= 45) score -= 40;
      if (rightGap >= 5 && rightGap <= 45) score -= 40;

      // Edge bonus — first slot at opening or last slot before closing
      const isFirst = slotStart.getTime() === dayOpen.getTime();
      const isLast = slotEnd.getTime() === dayClose.getTime();
      if (isFirst || isLast) score += 15;

      scored.push({ time: format(slotStart, 'HH:mm'), score });
    }

    return scored.sort((a, b) => b.score - a.score).map(s => s.time);
  } catch (err) {
    console.error('[getOptimizedSlots]', err);
    return [];
  }
}
