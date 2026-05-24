/**
 * Cron run tracking. Wraps a cron handler with timing + result persistence
 * into the CronRun table so the admin panel can show history per job.
 *
 * Usage:
 *   const runId = await startCronRun('reminders');
 *   ...do work...
 *   await finishCronRun(runId, { status: 'success', itemsSent: 10, ... });
 *
 * Or use trackCron() which wraps both start/finish + catches errors.
 */

import { db } from '@/lib/database';

export interface CronResult {
  status: 'success' | 'partial' | 'failed';
  itemsSent?: number;
  itemsErrors?: number;
  itemsDeferred?: number;
  details?: unknown;
  errorMessage?: string;
}

export async function startCronRun(name: string): Promise<string | null> {
  try {
    const run = await db.cronRun.create({
      data: {
        name,
        startedAt: new Date(),
        status: 'running',
      },
      select: { id: true },
    });
    return run.id;
  } catch (err) {
    console.error('[cron-run] startCronRun failed:', err);
    return null;
  }
}

export async function finishCronRun(runId: string | null, result: CronResult): Promise<void> {
  if (!runId) return;
  try {
    const now = new Date();
    const run = await db.cronRun.findUnique({ where: { id: runId }, select: { startedAt: true } });
    const durationMs = run ? now.getTime() - run.startedAt.getTime() : null;
    await db.cronRun.update({
      where: { id: runId },
      data: {
        finishedAt: now,
        durationMs,
        status: result.status,
        itemsSent: result.itemsSent ?? 0,
        itemsErrors: result.itemsErrors ?? 0,
        itemsDeferred: result.itemsDeferred ?? 0,
        details: result.details != null ? JSON.stringify(result.details).slice(0, 8000) : null,
        errorMessage: result.errorMessage?.slice(0, 1000) ?? null,
      },
    });
  } catch (err) {
    console.error('[cron-run] finishCronRun failed:', err);
  }
}

/**
 * Convenience wrapper: track an async cron handler with automatic timing and
 * error capture. Returns the handler's return value, or rethrows after logging.
 */
export async function trackCron<T extends CronResult>(
  name: string,
  handler: () => Promise<T>,
): Promise<T> {
  const runId = await startCronRun(name);
  try {
    const result = await handler();
    await finishCronRun(runId, result);
    return result;
  } catch (err: any) {
    await finishCronRun(runId, {
      status: 'failed',
      errorMessage: err?.message || String(err),
    });
    throw err;
  }
}
