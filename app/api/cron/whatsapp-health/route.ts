/**
 * GET /api/cron/whatsapp-health
 * Runs hourly. For each shop with whatsappEnabled OR needsReconnect:
 *  - Run health-check
 *  - Auto-repair recoverable
 *  - Notify owner if new critical or warning vs last check
 *  - Transition PENDING → CONNECTED when phone status flips
 */

import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { db } from '@/lib/database';
import { runHealthCheck } from '@/lib/whatsapp/health-check';
import { autoRepair } from '@/lib/whatsapp/auto-repair';
import { sendWhatsAppMessage } from '@/lib/whatsapp/sender';

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

  const shops = await db.shop.findMany({
    where: {
      OR: [{ whatsappEnabled: true }, { needsReconnect: true }],
      metaPhoneNumberId: { not: null },
    },
    select: {
      id: true, name: true, ownerNotificationPhone: true,
      coexistenceMode: true, whatsappReadyAt: true,
    },
  });

  let processed = 0, repaired = 0, transitioned = 0, notified = 0;

  for (const shop of shops) {
    try {
      const health = await runHealthCheck(shop.id);

      if (health.recoverable.length > 0) {
        const repairResults = await autoRepair(shop.id, health.recoverable);
        if (repairResults.some(r => r.autoRepairResult === 'repaired')) {
          repaired++;
        }
      }

      const onlyPending =
        health.critical.length === 1 && health.critical[0].code === 'PHONE_PENDING';

      // Transition PENDING → CONNECTED
      if (shop.whatsappReadyAt === null && health.ready) {
        await db.shop.update({
          where: { id: shop.id },
          data: {
            whatsappReadyAt: new Date(),
            whatsappEnabled: true,
            needsReconnect: false,
          },
        });
        transitioned++;
        if (shop.ownerNotificationPhone) {
          await sendWhatsAppMessage({
            to: shop.ownerNotificationPhone,
            message: `🎉 Tu bot de DomiCita ya está activo en ${shop.name}. ¡Listo para vender!`,
            shopId: shop.id,
          }).catch(() => null);
          notified++;
        }
      }

      await db.shop.update({
        where: { id: shop.id },
        data: { whatsappLastHealthCheckAt: new Date() },
      });

      // Notify on critical (non-PENDING) or warning
      const hasActionable =
        (health.critical.length > 0 && !onlyPending) ||
        health.warnings.length > 0;
      if (hasActionable && shop.ownerNotificationPhone) {
        const issues = [...health.critical, ...health.warnings];
        const message = `⚠️ Tu WhatsApp en DomiCita necesita atención:\n\n${issues.map(i => `• ${i.message}`).join('\n')}\n\nResuelve esto en tu dashboard: ${process.env.APP_URL || 'https://domicita.com'}/dashboard`;
        await sendWhatsAppMessage({
          to: shop.ownerNotificationPhone,
          message,
          shopId: shop.id,
        }).catch(() => null);
        notified++;
      }

      processed++;
    } catch (err: any) {
      console.error(`[cron whatsapp-health] error for ${shop.id}:`, err?.message);
    }
  }

  return NextResponse.json({
    ok: true, processed, repaired, transitioned, notified,
  });
}
