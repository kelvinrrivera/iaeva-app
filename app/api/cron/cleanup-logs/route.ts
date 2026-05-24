/**
 * Cron: cleanup old logs.
 *
 * Deletes:
 *  - ToolCall rows older than 30 days
 *  - SystemLog rows older than 90 days (kept longer; less volume)
 *  - CronRun rows older than 90 days
 *
 * Runs daily. Keeps the DB lean without losing recent diagnostic info.
 */

import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { prisma } from '@/lib/db';
import { startCronRun, finishCronRun } from '@/lib/cron-run';

function verifyCronSecret(request: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return false;
  const authHeader = request.headers.get('authorization');
  if (!authHeader) return false;
  const expected = `Bearer ${cronSecret}`;
  if (authHeader.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(authHeader), Buffer.from(expected));
}

export async function GET(request: NextRequest) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const runId = await startCronRun('cleanup-logs');
  const day = 24 * 60 * 60 * 1000;
  const d30 = new Date(Date.now() - 30 * day);
  const d90 = new Date(Date.now() - 90 * day);

  try {
    const [toolDeleted, systemDeleted, cronDeleted] = await Promise.all([
      prisma.toolCall.deleteMany({ where: { createdAt: { lt: d30 } } }),
      prisma.systemLog.deleteMany({ where: { createdAt: { lt: d90 } } }),
      prisma.cronRun.deleteMany({ where: { startedAt: { lt: d90 } } }),
    ]);

    const total = toolDeleted.count + systemDeleted.count + cronDeleted.count;

    await finishCronRun(runId, {
      status: 'success',
      itemsSent: total,
      details: {
        toolCallDeleted: toolDeleted.count,
        systemLogDeleted: systemDeleted.count,
        cronRunDeleted: cronDeleted.count,
      },
    });

    return NextResponse.json({
      success: true,
      deleted: {
        toolCall: toolDeleted.count,
        systemLog: systemDeleted.count,
        cronRun: cronDeleted.count,
      },
    });
  } catch (err: any) {
    await finishCronRun(runId, { status: 'failed', errorMessage: err?.message });
    return NextResponse.json({ error: err?.message || 'Cleanup failed' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  return GET(request);
}
