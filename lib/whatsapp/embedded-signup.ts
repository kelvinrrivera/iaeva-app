import { db } from '@/lib/database';
import { seedDefaultTemplates } from '@/lib/whatsapp/template-seeder';
import {
  exchangeCodeForToken,
  verifyToken,
  getPhoneNumberStatus,
  subscribeApp,
  registerPhone,
  MetaGraphError,
} from './meta-graph';
import { runHealthCheck } from './health-check';
import type { HealthCheckResult } from './health-types';

const META_APP_ID = process.env.META_APP_ID || process.env.NEXT_PUBLIC_APP_ID;
const META_APP_SECRET = process.env.FACEBOOK_APP_SECRET;
const SYSTEM_USER_TOKEN = process.env.WHATSAPP_SYSTEM_USER_TOKEN || process.env.WHATSAPP_ACCESS_TOKEN;

const SUBSCRIBED_FIELDS_CLOUD = ['messages', 'message_template_status_update'];
const SUBSCRIBED_FIELDS_COEX = ['messages', 'smb_message_echoes', 'message_template_status_update'];

export type FeatureType = 'coexistence' | 'cloud_api';

export interface ConnectWhatsAppParams {
  shopId: string;
  code: string;            // authorization code from FB.login response_type=code
  wabaId: string;          // from postMessage hints
  phoneNumberId: string;   // from postMessage hints
  featureType: FeatureType;
}

export interface ConnectWhatsAppResult {
  phoneNumber: string;
  wabaId: string;
  phoneNumberId: string;
  health: HealthCheckResult;
}

/**
 * Connect a WhatsApp number to a shop via Embedded Signup.
 *
 * Authoritative source: System User token (DomiCita Tech Provider).
 * The user code is exchanged once for verification; we never store user tokens.
 */
export async function connectWhatsAppToShop(params: ConnectWhatsAppParams): Promise<ConnectWhatsAppResult> {
  const { shopId, code, wabaId, phoneNumberId, featureType } = params;

  if (!META_APP_ID || !META_APP_SECRET) {
    throw new Error('Missing META_APP_ID or FACEBOOK_APP_SECRET env vars');
  }
  if (!SYSTEM_USER_TOKEN) {
    throw new Error('Missing WHATSAPP_SYSTEM_USER_TOKEN — DomiCita Tech Provider token required');
  }

  // 1. Exchange code for user token (verification only — discarded)
  const userToken = await exchangeCodeForToken(code, META_APP_ID, META_APP_SECRET);
  await verifyToken(userToken);

  // 2. Read phone status using System User token (DomiCita TP sees this WABA)
  const phone = await getPhoneNumberStatus(phoneNumberId, SYSTEM_USER_TOKEN);

  // 3. Subscribe webhooks with explicit fields based on featureType
  const subscribedFields = featureType === 'coexistence' ? SUBSCRIBED_FIELDS_COEX : SUBSCRIBED_FIELDS_CLOUD;
  await subscribeApp(wabaId, SYSTEM_USER_TOKEN, subscribedFields);

  // 4. /register only for Cloud API (Coexistence: phone is owned by the WB app)
  if (featureType === 'cloud_api') {
    await registerPhone(phoneNumberId, SYSTEM_USER_TOKEN);
  }

  const phoneNumberRaw = phone.display_phone_number ?? '';
  const phoneNumberDigits = phoneNumberRaw.replace(/\D/g, '');

  // 5. Persist shop. whatsappEnabled stays false until health-check confirms ready.
  await db.shop.update({
    where: { id: shopId },
    data: {
      whatsappProvider: 'META',
      metaAccessToken: SYSTEM_USER_TOKEN,         // global System User token
      metaTokenExpiresAt: null,                    // System User tokens never expire
      metaPhoneNumberId: phoneNumberId,
      metaBusinessAccountId: wabaId,
      wabaId,
      whatsappPhoneNumberId: phoneNumberId,
      whatsappPhoneNumber: phoneNumberDigits,
      coexistenceMode: featureType === 'coexistence',
      metaPlatformType: (phone.platform_type as any) ?? null,
      metaSubscribedFields: subscribedFields,
      needsReconnect: false,
      whatsappEnabled: false,                      // wait for health-check
    },
  });

  // 6. Seed templates (fire-and-forget)
  seedDefaultTemplates(shopId).catch(err =>
    console.error('[connectWhatsAppToShop] Template seeding failed:', err)
  );

  // 7. Run health-check and decide whatsappEnabled
  const health = await runHealthCheck(shopId);

  const finalEnabled = health.ready || (
    health.critical.length === 1 &&
    health.critical[0].code === 'PHONE_PENDING'
  ) || (health.critical.length === 0 && health.warnings.length > 0);

  await db.shop.update({
    where: { id: shopId },
    data: {
      whatsappEnabled: finalEnabled,
      whatsappLastHealthCheckAt: new Date(),
      whatsappReadyAt: health.ready ? new Date() : null,
    },
  });

  return {
    phoneNumber: phoneNumberRaw,
    wabaId,
    phoneNumberId,
    health,
  };
}

export { MetaGraphError };
