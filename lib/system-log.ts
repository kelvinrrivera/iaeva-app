/**
 * System-wide event logger.
 *
 * Writes to the SystemLog table. Fire-and-forget by default — failures
 * never block the caller. Use to record:
 *
 *   - Shop lifecycle: created, deleted, plan changes
 *   - WhatsApp: connected, disconnected, webhook failed
 *   - Templates: submitted, approved, rejected
 *   - Cron: failed runs (success rows are tracked in CronRun)
 *   - Errors that the user shouldn't see but the operator should
 *
 * Cheap and indexed. Don't worry about volume — even a busy SaaS produces
 * <1k events/day, which is nothing for Postgres.
 */

import { db } from '@/lib/database';

export type LogSeverity = 'info' | 'warn' | 'error';

export interface LogEntry {
  type: string;
  message?: string;
  severity?: LogSeverity;
  shopId?: string | null;
  userId?: string | null;
  payload?: unknown;
}

/**
 * Record a system event. Never throws.
 */
export async function logEvent(entry: LogEntry): Promise<void> {
  try {
    await db.systemLog.create({
      data: {
        type: entry.type,
        severity: entry.severity ?? 'info',
        shopId: entry.shopId ?? null,
        userId: entry.userId ?? null,
        message: entry.message ?? null,
        payload: entry.payload != null ? JSON.stringify(entry.payload).slice(0, 8000) : null,
      },
    });
  } catch (err) {
    // Logging must NEVER break the caller. Fall back to console.
    console.error('[system-log] failed to persist log:', err, entry);
  }
}

/**
 * Convenience helpers for common event types.
 */
export const SystemLog = {
  info: (type: string, opts: Omit<LogEntry, 'type' | 'severity'> = {}) =>
    logEvent({ type, severity: 'info', ...opts }),
  warn: (type: string, opts: Omit<LogEntry, 'type' | 'severity'> = {}) =>
    logEvent({ type, severity: 'warn', ...opts }),
  error: (type: string, opts: Omit<LogEntry, 'type' | 'severity'> = {}) =>
    logEvent({ type, severity: 'error', ...opts }),
};
