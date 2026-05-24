/**
 * Time formatting helpers — Dominican Republic conventions.
 *
 * RD uses 12-hour AM/PM, NOT 24h. We render `2:30 PM` for users while
 * keeping `14:30` internally for IDs, DB queries and code logic.
 */

/**
 * Convert "HH:mm" (24h) → "h:mm AM/PM" (en mayúsculas, sin punto).
 * "09:00" → "9:00 AM"
 * "14:30" → "2:30 PM"
 * "00:15" → "12:15 AM"
 */
export function to12h(hhmm: string): string {
  const [hStr, mStr] = (hhmm || '').split(':');
  let h = parseInt(hStr, 10);
  const m = parseInt(mStr, 10);
  if (isNaN(h) || isNaN(m)) return hhmm;
  const period = h >= 12 ? 'PM' : 'AM';
  if (h === 0) h = 12;
  else if (h > 12) h -= 12;
  return `${h}:${String(m).padStart(2, '0')} ${period}`;
}

/**
 * Format a Date as "h:mm AM/PM" in the shop's timezone.
 */
export function formatTime12h(d: Date, timezone: string): string {
  try {
    return new Intl.DateTimeFormat('en-US', {
      timeZone: timezone,
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    }).format(d).replace(/ /g, ' '); // normalize NBSP
  } catch {
    return d.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit', hour12: true });
  }
}

/**
 * Format a Date as "HH:mm" in the given timezone (24h). Used internally
 * to compare against scratch.lastSlotsOffered which stores HH:mm shop-local.
 */
export function formatHHmm(d: Date, timezone: string): string {
  try {
    return new Intl.DateTimeFormat('en-GB', {
      timeZone: timezone,
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    }).format(d);
  } catch {
    const h = String(d.getHours()).padStart(2, '0');
    const m = String(d.getMinutes()).padStart(2, '0');
    return `${h}:${m}`;
  }
}

/**
 * Format a Date as "yyyy-MM-dd" in the given timezone. Used internally to
 * compare against scratch.lastSlotsDate.
 */
export function formatYMD(d: Date, timezone: string): string {
  try {
    return new Intl.DateTimeFormat('en-CA', {
      timeZone: timezone,
      year: 'numeric',
      month: '2-digit',
      day: '2-digit',
    }).format(d);
  } catch {
    return d.toISOString().slice(0, 10);
  }
}

/**
 * Format a Date as "EEEE d 'de' MMMM 'a las' h:mm AM/PM" in Spanish.
 * Used for human-facing date+time labels in conversation messages.
 */
export function formatDateTime12h(d: Date, timezone: string = 'America/Santo_Domingo'): string {
  try {
    const datePart = new Intl.DateTimeFormat('es-DO', {
      timeZone: timezone,
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    }).format(d);
    const timePart = formatTime12h(d, timezone);
    return `${datePart} a las ${timePart}`;
  } catch {
    return d.toString();
  }
}
