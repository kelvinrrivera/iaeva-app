/**
 * Migrate existing WhatsApp connections to the new schema fields.
 *
 * Idempotent. For each shop with whatsappEnabled=true and metaPhoneNumberId set:
 *  1. Call Meta to get phone status, WABA info, subscribed apps
 *  2. Backfill metaPlatformType, coexistenceMode, metaSubscribedFields
 *  3. Auto-repair: re-subscribe webhooks if our app is missing or fields incomplete
 *  4. Classify: healthy / withWarnings / needsReconnect
 */

import { db } from '@/lib/database';
import {
  getPhoneNumberStatus,
  getSubscribedApps,
  subscribeApp,
} from '@/lib/whatsapp/meta-graph';
import { runHealthCheck } from '@/lib/whatsapp/health-check';
import { autoRepair } from '@/lib/whatsapp/auto-repair';

const SYSTEM_USER_TOKEN = process.env.WHATSAPP_SYSTEM_USER_TOKEN || process.env.WHATSAPP_ACCESS_TOKEN;
const META_APP_ID = process.env.META_APP_ID || process.env.NEXT_PUBLIC_APP_ID || '1599970834652215';

const REQUIRED_FIELDS_CLOUD = ['messages', 'message_template_status_update'];
const REQUIRED_FIELDS_COEX = ['messages', 'smb_message_echoes', 'message_template_status_update'];

export interface MigrationResult {
  total: number;
  healthy: number;
  withWarnings: number;
  flaggedForReconnect: number;
  errors: number;
  details: Array<{ shopId: string; action: string; details?: any }>;
}

export async function migrateWhatsAppConnections(): Promise<MigrationResult> {
  const out: MigrationResult = {
    total: 0, healthy: 0, withWarnings: 0, flaggedForReconnect: 0, errors: 0, details: [],
  };
  if (!SYSTEM_USER_TOKEN) {
    throw new Error('WHATSAPP_SYSTEM_USER_TOKEN missing');
  }

  const shops = await db.shop.findMany({
    where: { whatsappEnabled: true, metaPhoneNumberId: { not: null } },
    select: { id: true, metaPhoneNumberId: true, metaBusinessAccountId: true, coexistenceMode: true },
  });
  out.total = shops.length;

  for (const shop of shops) {
    if (!shop.metaPhoneNumberId || !shop.metaBusinessAccountId) {
      out.errors++;
      out.details.push({ shopId: shop.id, action: 'skipped_missing_ids' });
      continue;
    }

    try {
      // 1. Read state from Meta
      const phone = await getPhoneNumberStatus(shop.metaPhoneNumberId, SYSTEM_USER_TOKEN);
      const apps = await getSubscribedApps(shop.metaBusinessAccountId, SYSTEM_USER_TOKEN);
      const ours = apps.find(a => a.whatsapp_business_api_data?.id === META_APP_ID);

      // 2. Backfill schema (heuristic for coexistence)
      const inferredCoexistence = phone.platform_type === 'NOT_APPLICABLE';
      const required = inferredCoexistence ? REQUIRED_FIELDS_COEX : REQUIRED_FIELDS_CLOUD;

      await db.shop.update({
        where: { id: shop.id },
        data: {
          metaPlatformType: (phone.platform_type as any) ?? null,
          coexistenceMode: inferredCoexistence,
          metaSubscribedFields: ours?.subscribed_fields ?? [],
        },
      });

      // 3. Auto-repair if our app missing or fields incomplete
      const fieldsMissing = !ours || required.some(f => !ours.subscribed_fields?.includes(f));
      if (fieldsMissing) {
        try {
          await subscribeApp(shop.metaBusinessAccountId, SYSTEM_USER_TOKEN, required);
          await db.shop.update({
            where: { id: shop.id },
            data: { metaSubscribedFields: required },
          });
        } catch (e: any) {
          console.warn(`[migrate] auto-repair failed for ${shop.id}:`, e?.message);
        }
      }

      // 4. Classify via health-check
      const health = await runHealthCheck(shop.id);

      // Auto-repair recoverable that may remain
      if (health.recoverable.length > 0) {
        await autoRepair(shop.id, health.recoverable);
      }

      const onlyPending =
        health.critical.length === 1 && health.critical[0].code === 'PHONE_PENDING';

      if (health.critical.length > 0 && !onlyPending) {
        await db.shop.update({
          where: { id: shop.id },
          data: { whatsappEnabled: false, needsReconnect: true },
        });
        out.flaggedForReconnect++;
        out.details.push({
          shopId: shop.id,
          action: 'flagged_for_reconnect',
          details: { critical: health.critical.map(c => c.code) },
        });
      } else if (health.warnings.length > 0) {
        await db.shop.update({
          where: { id: shop.id },
          data: { whatsappLastHealthCheckAt: new Date() },
        });
        out.withWarnings++;
        out.details.push({
          shopId: shop.id,
          action: 'kept_with_warnings',
          details: { warnings: health.warnings.map(w => w.code) },
        });
      } else {
        await db.shop.update({
          where: { id: shop.id },
          data: {
            whatsappLastHealthCheckAt: new Date(),
            whatsappReadyAt: new Date(),
          },
        });
        out.healthy++;
        out.details.push({ shopId: shop.id, action: 'healthy' });
      }
    } catch (err: any) {
      console.error(`[migrate] error for ${shop.id}:`, err?.message);
      out.errors++;
      out.details.push({ shopId: shop.id, action: 'error', details: err?.message });
    }
  }

  return out;
}

// CLI runner
if (require.main === module) {
  migrateWhatsAppConnections()
    .then(result => {
      console.log(JSON.stringify(result, null, 2));
      process.exit(0);
    })
    .catch(err => {
      console.error(err);
      process.exit(1);
    });
}
