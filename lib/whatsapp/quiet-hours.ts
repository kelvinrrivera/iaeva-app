/**
 * Quiet hours — protect clients from being pinged at hours that would
 * be considered intrusive (late night, early morning, configured days off).
 *
 * Why this matters:
 * - Meta drops quality_rating when clients block/report messages, which
 *   they do far more often when pinged at 2 AM.
 * - Some markets (MX, BR, EU) have legal restrictions on commercial
 *   messaging hours.
 * - It's basic respect for the end-user.
 *
 * Defaults (set in Prisma schema):
 *   start = 21:00, end = 08:00, no quiet days, urgent reminders blocked too.
 *
 * Categories:
 *   - URGENT: 1h/2h reminders. Can bypass quiet hours if shop opted in.
 *   - REGULAR: 24h/6h reminders, cancellation notices, reactivation. Always blocked.
 *   - SYSTEM: confirmations of just-created appointments, walk-in turn notice.
 *     Never blocked — the client is actively interacting.
 */

export type MessageCategory = 'urgent' | 'regular' | 'system';

export interface QuietHoursConfig {
  quietHoursEnabled: boolean;
  quietHoursStart: string;  // "HH:mm"
  quietHoursEnd: string;    // "HH:mm"
  quietDaysJson: string;    // JSON array string, e.g. "[0,6]"
  allowUrgentInQuiet: boolean;
}

function parseHM(hm: string): { h: number; m: number } {
  const [hStr, mStr] = (hm || '00:00').split(':');
  return { h: parseInt(hStr, 10) || 0, m: parseInt(mStr, 10) || 0 };
}

function parseQuietDays(json: string): number[] {
  try {
    const arr = JSON.parse(json || '[]');
    if (!Array.isArray(arr)) return [];
    return arr.filter(n => typeof n === 'number' && n >= 0 && n <= 6);
  } catch {
    return [];
  }
}

/**
 * Get the current local time in the shop's timezone.
 * Returns { dayOfWeek (0-6, Sunday=0), minutesOfDay (0-1439) }.
 */
function getShopLocalTime(now: Date, timezone: string): { dayOfWeek: number; minutesOfDay: number } {
  try {
    const fmt = new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      weekday: 'short',
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
    const parts = fmt.formatToParts(now);
    const weekdayShort = parts.find(p => p.type === 'weekday')?.value ?? 'Sun';
    const hour = parseInt(parts.find(p => p.type === 'hour')?.value ?? '0', 10);
    const minute = parseInt(parts.find(p => p.type === 'minute')?.value ?? '0', 10);
    const dayMap: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
    return {
      dayOfWeek: dayMap[weekdayShort] ?? 0,
      minutesOfDay: (hour === 24 ? 0 : hour) * 60 + minute,
    };
  } catch {
    // Fallback to UTC if timezone is invalid
    return {
      dayOfWeek: now.getUTCDay(),
      minutesOfDay: now.getUTCHours() * 60 + now.getUTCMinutes(),
    };
  }
}

/**
 * Decide whether a message of `category` can be sent right NOW given the
 * shop's quiet hours config and timezone.
 *
 * Returns:
 *   { quiet: false } → send immediately
 *   { quiet: true, reason: 'quiet_hours' | 'quiet_day' } → defer
 */
export function isWithinQuietHours(
  now: Date,
  config: QuietHoursConfig | null | undefined,
  shopTimezone: string,
  category: MessageCategory = 'regular',
): { quiet: boolean; reason?: 'quiet_hours' | 'quiet_day' | 'disabled' | 'urgent_bypass' | 'system_bypass' } {
  // System messages (confirmations, walk-in alerts) never get muted.
  if (category === 'system') return { quiet: false, reason: 'system_bypass' };

  if (!config || !config.quietHoursEnabled) {
    return { quiet: false, reason: 'disabled' };
  }

  // Urgent reminders can bypass if shop opted in
  if (category === 'urgent' && config.allowUrgentInQuiet) {
    return { quiet: false, reason: 'urgent_bypass' };
  }

  const { dayOfWeek, minutesOfDay } = getShopLocalTime(now, shopTimezone);

  // Day off
  const quietDays = parseQuietDays(config.quietDaysJson);
  if (quietDays.includes(dayOfWeek)) {
    return { quiet: true, reason: 'quiet_day' };
  }

  // Hours
  const start = parseHM(config.quietHoursStart);
  const end = parseHM(config.quietHoursEnd);
  const startMin = start.h * 60 + start.m;
  const endMin = end.h * 60 + end.m;

  if (startMin === endMin) {
    // Same start and end → no quiet window
    return { quiet: false };
  }

  const isQuiet =
    startMin < endMin
      ? // Same-day window: quiet if start <= now < end
        minutesOfDay >= startMin && minutesOfDay < endMin
      : // Wraps midnight: quiet if now >= start OR now < end
        minutesOfDay >= startMin || minutesOfDay < endMin;

  return isQuiet ? { quiet: true, reason: 'quiet_hours' } : { quiet: false };
}
