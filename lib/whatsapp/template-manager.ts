/**
 * WhatsApp Template Manager
 *
 * Dual-provider proxy for managing WhatsApp message templates.
 * Supports Twilio Content API (current) and Meta Graph API (future).
 *
 * Twilio docs: https://www.twilio.com/docs/content/content-api-resources
 * Meta docs: https://developers.facebook.com/docs/whatsapp/business-management-api/message-templates
 */

import { db } from '@/lib/database';
import type { WhatsAppProvider } from '@prisma/client';

// ─── Types ───────────────────────────────────────────────────────────

export interface CreateTemplateInput {
  name: string;
  language?: string;
  category: 'UTILITY' | 'MARKETING' | 'AUTHENTICATION';
  bodyText: string;
  variables?: Record<string, string>; // {"1": "Cliente", "2": "hora"}
  purpose?: string;
}

export interface TemplateRecord {
  id: string;
  name: string;
  language: string;
  category: string;
  bodyText: string;
  variables: Record<string, string> | null;
  twilioContentSid: string | null;
  metaTemplateId: string | null;
  provider: WhatsAppProvider;
  status: string;
  rejectionReason: string | null;
  purpose: string | null;
  createdAt: Date;
  updatedAt: Date;
}

// ─── Twilio Content API helpers ──────────────────────────────────────

const TWILIO_CONTENT_BASE = 'https://content.twilio.com/v1/Content';

function getTwilioAuth(shop?: { twilioAccountSid: string | null; twilioAuthToken: string | null }) {
  const sid = shop?.twilioAccountSid || process.env.TWILIO_ACCOUNT_SID;
  const token = shop?.twilioAuthToken || process.env.TWILIO_AUTH_TOKEN;
  if (!sid || !token) return null;
  return { sid, token, header: 'Basic ' + Buffer.from(`${sid}:${token}`).toString('base64') };
}

async function twilioCreateContent(
  auth: { header: string },
  input: CreateTemplateInput
): Promise<{ contentSid: string }> {
  const res = await fetch(TWILIO_CONTENT_BASE, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: auth.header,
    },
    body: JSON.stringify({
      friendly_name: input.name,
      language: input.language || 'es',
      variables: input.variables || {},
      types: {
        'twilio/text': { body: input.bodyText },
      },
    }),
    signal: AbortSignal.timeout(15000),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`Twilio Content API error: ${err.message || res.statusText}`);
  }

  const data = await res.json();
  return { contentSid: data.sid };
}

async function twilioSubmitApproval(
  auth: { header: string },
  contentSid: string,
  name: string,
  category: string
): Promise<{ status: string }> {
  const res = await fetch(`${TWILIO_CONTENT_BASE}/${contentSid}/ApprovalRequests/whatsapp`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Authorization: auth.header,
    },
    body: JSON.stringify({ name, category }),
    signal: AbortSignal.timeout(15000),
  });

  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(`Twilio approval error: ${err.message || res.statusText}`);
  }

  const data = await res.json();
  return { status: data.status || 'PENDING' };
}

async function twilioCheckStatus(
  auth: { header: string },
  contentSid: string
): Promise<{ status: string; rejectionReason?: string }> {
  const res = await fetch(`${TWILIO_CONTENT_BASE}/${contentSid}/ApprovalRequests`, {
    method: 'GET',
    headers: { Authorization: auth.header },
    signal: AbortSignal.timeout(15000),
  });

  if (!res.ok) {
    return { status: 'UNKNOWN' };
  }

  const data = await res.json();
  // Twilio returns an array of approval requests; use the latest whatsapp one
  const whatsappApproval = data.results?.find(
    (r: { channel: string }) => r.channel === 'whatsapp'
  );

  if (!whatsappApproval) return { status: 'DRAFT' };

  const statusMap: Record<string, string> = {
    received: 'PENDING',
    pending: 'PENDING',
    approved: 'APPROVED',
    rejected: 'REJECTED',
    paused: 'PAUSED',
    disabled: 'PAUSED',
  };

  return {
    status: statusMap[whatsappApproval.status] || whatsappApproval.status.toUpperCase(),
    rejectionReason: whatsappApproval.rejection_reason || undefined,
  };
}

async function twilioDeleteContent(
  auth: { header: string },
  contentSid: string
): Promise<void> {
  const res = await fetch(`${TWILIO_CONTENT_BASE}/${contentSid}`, {
    method: 'DELETE',
    headers: { Authorization: auth.header },
    signal: AbortSignal.timeout(15000),
  });

  if (!res.ok && res.status !== 404) {
    throw new Error(`Twilio delete error: ${res.statusText}`);
  }
}

// ─── Meta Graph API helpers ──────────────────────────────────────────

const META_API_VERSION = 'v22.0';

/**
 * Resolve Meta auth from a shop record. Each tenant has their own WABA
 * and access token (stored after Embedded Signup). Falls back to env vars
 * only for backward compatibility with the old single-WABA setup.
 */
function getMetaAuth(shop?: {
  metaAccessToken?: string | null;
  metaBusinessAccountId?: string | null;
  wabaId?: string | null;
}) {
  const token = shop?.metaAccessToken || process.env.WHATSAPP_ACCESS_TOKEN;
  const wabaId =
    shop?.metaBusinessAccountId || shop?.wabaId || process.env.WHATSAPP_WABA_ID;
  if (!token || !wabaId) return null;
  return { token, wabaId };
}

async function metaCreateTemplate(
  auth: { token: string; wabaId: string },
  input: CreateTemplateInput
): Promise<{ metaTemplateId: string; status: string }> {
  const cleanName = input.name.toLowerCase().replace(/[^a-z0-9_]/g, '_');

  // Find the highest variable index in the body — Meta wants example.body_text
  // to have exactly N entries where N is the largest {{N}} found (variables
  // must be consecutive 1..N, but we defend against gaps by sizing to max).
  const matches = Array.from(input.bodyText.matchAll(/\{\{(\d+)\}\}/g));
  const maxVarIndex = matches.reduce((m, x) => Math.max(m, parseInt(x[1], 10) || 0), 0);

  const bodyComponent: Record<string, any> = {
    type: 'BODY',
    text: input.bodyText,
  };
  if (maxVarIndex > 0) {
    const exampleValues: string[] = [];
    for (let i = 1; i <= maxVarIndex; i++) {
      exampleValues.push(input.variables?.[String(i)] || `Ejemplo${i}`);
    }
    bodyComponent.example = { body_text: [exampleValues] };
  }

  const payload = {
    name: cleanName,
    language: input.language || 'es',
    category: input.category,
    components: [bodyComponent],
  };

  const res = await fetch(
    `https://graph.facebook.com/${META_API_VERSION}/${auth.wabaId}/message_templates`,
    {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${auth.token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(30000),
    }
  );

  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    console.error('[metaCreateTemplate] Meta rejected', cleanName, JSON.stringify(data));
    const meta = data.error || {};
    const detail = meta.error_user_msg || meta.message || meta.error_user_title || res.statusText;
    const lower = `${detail}`.toLowerCase();

    // "Already exists" — the template was created in a previous attempt but
    // we lost the metaTemplateId. Fetch it back and treat as success.
    if (lower.includes('already exists') || lower.includes('ya existe')) {
      try {
        const lookup = await fetch(
          `https://graph.facebook.com/${META_API_VERSION}/${auth.wabaId}/message_templates?name=${cleanName}&fields=id,status`,
          { headers: { Authorization: `Bearer ${auth.token}` } }
        );
        if (lookup.ok) {
          const lookupData = await lookup.json();
          const found = lookupData.data?.[0];
          if (found?.id) {
            console.log(`[metaCreateTemplate] Recovered existing template ${cleanName} → ${found.id}`);
            return { metaTemplateId: found.id, status: found.status || 'PENDING' };
          }
        }
      } catch {
        /* fall through to throw */
      }
    }

    throw new Error(`Meta API error: ${detail}`);
  }

  return {
    metaTemplateId: data.id,
    status: data.status || 'PENDING',
  };
}

async function metaCheckStatus(
  auth: { token: string; wabaId: string },
  templateName: string
): Promise<{ status: string; rejectionReason?: string }> {
  const cleanName = templateName.toLowerCase().replace(/[^a-z0-9_]/g, '_');
  const res = await fetch(
    `https://graph.facebook.com/${META_API_VERSION}/${auth.wabaId}/message_templates?name=${cleanName}&fields=name,status,rejected_reason`,
    {
      headers: { Authorization: `Bearer ${auth.token}` },
      signal: AbortSignal.timeout(15000),
    }
  );

  if (!res.ok) return { status: 'UNKNOWN' };

  const data = await res.json();
  const template = data.data?.[0];
  if (!template) return { status: 'UNKNOWN' };

  return {
    status: template.status || 'UNKNOWN',
    rejectionReason: template.rejected_reason || undefined,
  };
}

async function metaDeleteTemplate(
  auth: { token: string; wabaId: string },
  templateName: string
): Promise<void> {
  const cleanName = templateName.toLowerCase().replace(/[^a-z0-9_]/g, '_');
  const res = await fetch(
    `https://graph.facebook.com/${META_API_VERSION}/${auth.wabaId}/message_templates?name=${cleanName}`,
    {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${auth.token}` },
      signal: AbortSignal.timeout(15000),
    }
  );

  if (!res.ok && res.status !== 404) {
    throw new Error(`Meta delete error: ${res.statusText}`);
  }
}

// ─── Public API ──────────────────────────────────────────────────────

/**
 * Create a new WhatsApp template and register it with the provider
 */
export async function createTemplate(
  shopId: string,
  input: CreateTemplateInput
): Promise<TemplateRecord> {
  const shop = await db.shop.findUnique({
    where: { id: shopId },
    select: {
      whatsappProvider: true,
      twilioAccountSid: true,
      twilioAuthToken: true,
      metaAccessToken: true,
      metaBusinessAccountId: true,
      wabaId: true,
    },
  });

  if (!shop) throw new Error('Shop not found');

  const provider = shop.whatsappProvider || 'META';
  let twilioContentSid: string | null = null;
  let metaTemplateId: string | null = null;
  let initialStatus = 'DRAFT';

  if (provider === 'TWILIO') {
    const auth = getTwilioAuth(shop);
    if (!auth) throw new Error('Twilio credentials not configured');

    const result = await twilioCreateContent(auth, input);
    twilioContentSid = result.contentSid;
    initialStatus = 'DRAFT'; // Not submitted for approval yet
  } else {
    const auth = getMetaAuth(shop);
    if (!auth) throw new Error('Meta API credentials not configured for this shop');

    const result = await metaCreateTemplate(auth, input);
    metaTemplateId = result.metaTemplateId;
    initialStatus = result.status; // Meta auto-submits for approval
  }

  const template = await db.whatsAppTemplate.create({
    data: {
      shopId,
      name: input.name,
      language: input.language || 'es',
      category: input.category,
      bodyText: input.bodyText,
      variables: input.variables || undefined,
      twilioContentSid,
      metaTemplateId,
      provider,
      status: initialStatus,
      purpose: input.purpose || null,
    },
  });

  return template as TemplateRecord;
}

/**
 * List all templates for a shop (from DB)
 */
export async function listTemplates(shopId: string): Promise<TemplateRecord[]> {
  const templates = await db.whatsAppTemplate.findMany({
    where: { shopId },
    orderBy: { createdAt: 'desc' },
  });
  return templates as TemplateRecord[];
}

/**
 * Get a single template by ID
 */
export async function getTemplate(
  shopId: string,
  templateId: string
): Promise<TemplateRecord | null> {
  const template = await db.whatsAppTemplate.findFirst({
    where: { id: templateId, shopId },
  });
  return template as TemplateRecord | null;
}

/**
 * Submit a template for WhatsApp approval (Twilio only — Meta auto-submits)
 */
export async function submitForApproval(
  shopId: string,
  templateId: string
): Promise<{ status: string }> {
  const template = await db.whatsAppTemplate.findFirst({
    where: { id: templateId, shopId },
  });

  if (!template) throw new Error('Template not found');
  if (template.status !== 'DRAFT') {
    throw new Error(`Cannot submit template in status "${template.status}"`);
  }

  const shop = await db.shop.findUnique({
    where: { id: shopId },
    select: {
      whatsappProvider: true,
      twilioAccountSid: true,
      twilioAuthToken: true,
      metaAccessToken: true,
      metaBusinessAccountId: true,
      wabaId: true,
    },
  });

  if (!shop) throw new Error('Shop not found');

  if (shop.whatsappProvider === 'TWILIO') {
    if (!template.twilioContentSid) {
      throw new Error('Template missing Twilio Content SID');
    }
    const auth = getTwilioAuth(shop);
    if (!auth) throw new Error('Twilio credentials not configured');

    const result = await twilioSubmitApproval(
      auth,
      template.twilioContentSid,
      template.name,
      template.category
    );

    await db.whatsAppTemplate.update({
      where: { id: templateId },
      data: { status: 'PENDING' },
    });

    return { status: result.status };
  }

  // Meta templates are auto-submitted on creation
  return { status: template.status };
}

/**
 * Sync the approval status from the provider
 */
export async function syncApprovalStatus(
  shopId: string,
  templateId: string
): Promise<{ status: string; rejectionReason?: string }> {
  const template = await db.whatsAppTemplate.findFirst({
    where: { id: templateId, shopId },
  });

  if (!template) throw new Error('Template not found');

  const shop = await db.shop.findUnique({
    where: { id: shopId },
    select: {
      whatsappProvider: true,
      twilioAccountSid: true,
      twilioAuthToken: true,
      metaAccessToken: true,
      metaBusinessAccountId: true,
      wabaId: true,
    },
  });

  if (!shop) throw new Error('Shop not found');

  let result: { status: string; rejectionReason?: string };

  if (shop.whatsappProvider === 'TWILIO') {
    if (!template.twilioContentSid) return { status: template.status };
    const auth = getTwilioAuth(shop);
    if (!auth) return { status: template.status };
    result = await twilioCheckStatus(auth, template.twilioContentSid);
  } else {
    const auth = getMetaAuth(shop);
    if (!auth) return { status: template.status };
    result = await metaCheckStatus(auth, template.name);
  }

  if (result.status !== 'UNKNOWN') {
    await db.whatsAppTemplate.update({
      where: { id: templateId },
      data: {
        status: result.status,
        rejectionReason: result.rejectionReason || null,
      },
    });
  }

  return result;
}

/**
 * Delete a template from both provider and DB
 */
export async function deleteTemplate(
  shopId: string,
  templateId: string
): Promise<void> {
  const template = await db.whatsAppTemplate.findFirst({
    where: { id: templateId, shopId },
  });

  if (!template) throw new Error('Template not found');

  const shop = await db.shop.findUnique({
    where: { id: shopId },
    select: {
      whatsappProvider: true,
      twilioAccountSid: true,
      twilioAuthToken: true,
      metaAccessToken: true,
      metaBusinessAccountId: true,
      wabaId: true,
    },
  });

  if (!shop) throw new Error('Shop not found');

  // Delete from provider (best-effort)
  try {
    if (shop.whatsappProvider === 'TWILIO' && template.twilioContentSid) {
      const auth = getTwilioAuth(shop);
      if (auth) await twilioDeleteContent(auth, template.twilioContentSid);
    } else if (shop.whatsappProvider === 'META') {
      const auth = getMetaAuth(shop);
      if (auth) await metaDeleteTemplate(auth, template.name);
    }
  } catch (err) {
    console.error('[TemplateManager] Provider delete failed (continuing):', err);
  }

  await db.whatsAppTemplate.delete({ where: { id: templateId } });
}

/**
 * Register all DRAFT templates with Meta. Idempotent — skips ones that
 * already have a metaTemplateId. Updates DB with template id + status.
 *
 * Used after Embedded Signup to push the seeded defaults into Meta's
 * approval queue.
 */
export async function registerPendingMetaTemplates(
  shopId: string
): Promise<{ registered: number; skipped: number; errors: string[] }> {
  const result = { registered: 0, skipped: 0, errors: [] as string[] };

  const shop = await db.shop.findUnique({
    where: { id: shopId },
    select: {
      whatsappProvider: true,
      metaAccessToken: true,
      metaBusinessAccountId: true,
      wabaId: true,
    },
  });

  if (!shop) {
    result.errors.push('shop_not_found');
    return result;
  }
  if (shop.whatsappProvider !== 'META') {
    result.errors.push(`shop_provider_not_meta:${shop.whatsappProvider}`);
    return result;
  }
  const auth = getMetaAuth(shop);
  if (!auth) {
    result.errors.push('missing_meta_credentials');
    return result;
  }

  // Process all DRAFTs without a Meta template id, regardless of stored provider field
  // (legacy rows may still have provider='TWILIO' even after the shop migrated to META)
  const drafts = await db.whatsAppTemplate.findMany({
    where: { shopId, metaTemplateId: null, status: 'DRAFT' },
  });

  // Run in parallel batches to stay under serverless time limits
  const CONCURRENCY = 4;
  for (let i = 0; i < drafts.length; i += CONCURRENCY) {
    const batch = drafts.slice(i, i + CONCURRENCY);
    await Promise.all(
      batch.map(async (tmpl) => {
        try {
          const res = await metaCreateTemplate(auth, {
            name: tmpl.name,
            language: tmpl.language,
            category: tmpl.category as 'UTILITY' | 'MARKETING' | 'AUTHENTICATION',
            bodyText: tmpl.bodyText,
            variables: (tmpl.variables as Record<string, string>) || undefined,
          });
          await db.whatsAppTemplate.update({
            where: { id: tmpl.id },
            data: {
              metaTemplateId: res.metaTemplateId,
              status: res.status || 'PENDING',
              provider: 'META',
            },
          });
          result.registered++;
        } catch (err: any) {
          console.error(`[registerPendingMetaTemplates] ${tmpl.name}:`, err.message);
          result.errors.push(`${tmpl.purpose || tmpl.name}: ${err.message}`);
        }
      })
    );
  }

  return result;
}

/**
 * Find an approved template by purpose (for cron jobs / automated sends)
 */
export async function getApprovedTemplate(
  shopId: string,
  purpose: string
): Promise<TemplateRecord | null> {
  const template = await db.whatsAppTemplate.findFirst({
    where: {
      shopId,
      purpose,
      status: 'APPROVED',
    },
  });
  return template as TemplateRecord | null;
}
