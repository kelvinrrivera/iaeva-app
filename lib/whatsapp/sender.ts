/**
 * WhatsApp Message Sender
 *
 * Handles sending messages through WhatsApp Business API and Twilio.
 * Supports text messages and template messages.
 *
 * Meta Documentation: https://developers.facebook.com/docs/whatsapp/cloud-api/messages/send
 */
import { db } from '@/lib/database';
import twilio from 'twilio';

export interface WhatsAppMessage {
  to: string; // Phone number with country code (e.g., "+18091234567")
  type: 'text' | 'template';
  text?: {
    body: string;
    preview_url?: boolean;
  };
  template?: {
    name: string;
    language: {
      code: string; // e.g., "es", "en"
    };
    components?: Array<{
      type: 'body';
      parameters: Array<{
        type: 'text' | 'currency' | 'date_time' | 'image';
        text?: string;
        currency?: { fallback_value: string; code: string; amount_1000: number };
        date_time?: { fallback_value: string };
      }>;
    }>;
  };
}

export interface SendWhatsAppMessageParams {
  to: string;
  message: string;
  type?: 'text' | 'template';
  templateName?: string;
  templateLanguage?: string;
  shopId?: string; // Optional context to determine provider (META/TWILIO)
  contentSid?: string; // Twilio Content SID for approved templates
  contentVariables?: Record<string, string>; // Variables for Twilio Content API
}

/**
 * Send a message through WhatsApp Business API
 *
 * @param params - Message parameters
 * @returns Response from WhatsApp API
 *
 * @example
 * const result = await sendWhatsAppMessage({
 *   to: "+18091234567",
 *   message: "Hola! Tu cita está confirmada.",
 * });
 */
export async function sendWhatsAppMessage(params: SendWhatsAppMessageParams): Promise<{
  success: boolean;
  messageId?: string;
  error?: string;
}> {
  try {
    const {
      to,
      message,
      type = 'text',
      templateName = '',
      templateLanguage = 'es',
      shopId,
      contentSid,
      contentVariables,
    } = params;

    let provider = 'TWILIO';
    let twilioAccountSid = process.env.TWILIO_ACCOUNT_SID;
    let twilioAuthToken = process.env.TWILIO_AUTH_TOKEN;
    const twilioPhoneNumber = process.env.TWILIO_WHATSAPP_NUMBER;

    // Meta credentials (can be from shop or global fallback)
    let metaAccessToken = process.env.WHATSAPP_ACCESS_TOKEN;
    let metaPhoneNumberId = process.env.PHONE_NUMBER_ID;

    if (shopId) {
      const shop = await db.shop.findUnique({
        where: { id: shopId },
        select: {
          whatsappProvider: true,
          twilioAccountSid: true,
          twilioAuthToken: true,
          metaAccessToken: true,
          metaPhoneNumberId: true,
        },
      });
      if (shop) {
        provider = shop.whatsappProvider || 'TWILIO';
        // Use shop's Twilio credentials if available
        if (shop.twilioAccountSid && shop.twilioAuthToken) {
          twilioAccountSid = shop.twilioAccountSid;
          twilioAuthToken = shop.twilioAuthToken;
        }
        // Use shop's Meta credentials if available
        if (shop.metaAccessToken) {
          metaAccessToken = shop.metaAccessToken;
        }
        if (shop.metaPhoneNumberId) {
          metaPhoneNumberId = shop.metaPhoneNumberId;
        }
      }
    }

    if (provider === 'TWILIO') {
      if (!twilioAccountSid || !twilioAuthToken || !twilioPhoneNumber) {
        throw new Error('Twilio credentials not fully configured for this shop/system');
      }
      const client = twilio(twilioAccountSid, twilioAuthToken);

      // Use Twilio Content API (contentSid) for approved templates
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const messageOpts: any = {
        from: `whatsapp:${twilioPhoneNumber}`,
        to: `whatsapp:${to.replace(/\D/g, '')}`,
      };

      if (contentSid) {
        // Approved template via Twilio Content API
        messageOpts.contentSid = contentSid;
        if (contentVariables && Object.keys(contentVariables).length > 0) {
          messageOpts.contentVariables = JSON.stringify(contentVariables);
        }
      } else {
        // Plain text fallback
        messageOpts.body = type === 'template' ? message || `Plantilla: ${templateName}` : message;
      }

      const res = await client.messages.create(messageOpts);
      console.log(`Twilio WhatsApp message sent successfully: ${res.sid}`);
      return { success: true, messageId: res.sid };
    }

    // META PROVIDER

    // Use shop's Meta credentials or global fallback
    if (!metaAccessToken) {
      throw new Error('Meta access token not configured for this shop or system');
    }

    if (!metaPhoneNumberId) {
      throw new Error('Meta phone number ID not configured for this shop or system');
    }

    // Build message payload
    const payload: WhatsAppMessage = {
      to: to.replace(/\D/g, ''), // Remove non-numeric characters
      type,
    };

    if (type === 'text') {
      payload.text = {
        body: message,
        preview_url: false,
      };
    } else if (type === 'template') {
      if (!templateName) {
        throw new Error('templateName is required for template messages');
      }
      payload.template = {
        name: templateName,
        language: { code: templateLanguage },
      };
    }

    // Send to WhatsApp Business API
    const response = await fetch(
      `https://graph.facebook.com/v22.0/${metaPhoneNumberId}/messages`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${metaAccessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          messaging_product: 'whatsapp',
          recipient_type: 'individual',
          to: payload.to,
          type: payload.type,
          ...(payload.type === 'text' && { text: payload.text }),
          ...(payload.type === 'template' && { template: payload.template }),
        }),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error('WhatsApp API Error:', data);
      return {
        success: false,
        error: data.error?.message || 'Failed to send WhatsApp message',
      };
    }

    // Extract message ID
    const messageId = data.messages?.[0]?.id;

    // Log success
    console.log(`WhatsApp message sent successfully to ${to}:`, {
      messageId,
      type: payload.type,
    });

    return {
      success: true,
      messageId,
    };
  } catch (error: any) {
    console.error('Error sending WhatsApp message:', error);
    return {
      success: false,
      error: error.message || 'Unknown error occurred',
    };
  }
}

/**
 * Send a template message with parameters
 *
 * @param to - Recipient phone number
 * @param templateName - Name of the approved template
 * @param parameters - Parameters to replace in template
 * @returns Result from WhatsApp API
 *
 * @example
 * const result = await sendWhatsAppTemplate({
 *   to: "+18091234567",
 *   templateName: "appointment_confirmation",
 *   parameters: ["Juan Pérez", "Corte de Cabello", "2024-02-20", "15:00"],
 * });
 */
export async function sendWhatsAppTemplate({
  to,
  templateName,
  parameters = [],
  language = 'es',
  shopId,
}: {
  to: string;
  templateName: string;
  parameters?: string[];
  language?: string;
  shopId?: string; // Optional context to determine provider (META/TWILIO)
}): Promise<{
  success: boolean;
  messageId?: string;
  error?: string;
}> {
  try {
    let provider = 'TWILIO';
    let twilioAccountSid = process.env.TWILIO_ACCOUNT_SID;
    let twilioAuthToken = process.env.TWILIO_AUTH_TOKEN;
    const twilioPhoneNumber = process.env.TWILIO_WHATSAPP_NUMBER;

    // Meta credentials (can be from shop or global fallback)
    let metaAccessToken = process.env.WHATSAPP_ACCESS_TOKEN;
    let metaPhoneNumberId = process.env.PHONE_NUMBER_ID;

    if (shopId) {
      const shop = await db.shop.findUnique({
        where: { id: shopId },
        select: {
          whatsappProvider: true,
          twilioAccountSid: true,
          twilioAuthToken: true,
          metaAccessToken: true,
          metaPhoneNumberId: true,
        },
      });
      if (shop) {
        provider = shop.whatsappProvider || 'TWILIO';
        // Use shop's Twilio credentials if available
        if (shop.twilioAccountSid && shop.twilioAuthToken) {
          twilioAccountSid = shop.twilioAccountSid;
          twilioAuthToken = shop.twilioAuthToken;
        }
        // Use shop's Meta credentials if available
        if (shop.metaAccessToken) {
          metaAccessToken = shop.metaAccessToken;
        }
        if (shop.metaPhoneNumberId) {
          metaPhoneNumberId = shop.metaPhoneNumberId;
        }
      }
    }

    if (provider === 'TWILIO') {
      // Twilio doesn't support Meta-style templates. Send as plain text via sendWhatsAppMessage.
      // The caller should prefer useTemplate=false when using Twilio.
      const bodyText = parameters.length > 0
        ? parameters.join(' | ')
        : `(${templateName})`;

      return await sendWhatsAppMessage({
        to,
        message: bodyText,
        shopId,
      });
    }

    // META PROVIDER

    if (!metaAccessToken || !metaPhoneNumberId) {
      throw new Error('Meta credentials not configured for this shop or system');
    }

    const payload = {
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: to.replace(/\D/g, ''),
      type: 'template',
      template: {
        name: templateName,
        language: { code: language },
        components: [
          {
            type: 'body',
            parameters: parameters.map((param) => ({
              type: 'text',
              text: param,
            })),
          },
        ],
      },
    };

    const response = await fetch(
      `https://graph.facebook.com/v22.0/${metaPhoneNumberId}/messages`,
      {
        method: 'POST',
        headers: {
          'Authorization': `Bearer ${metaAccessToken}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(payload),
      }
    );

    const data = await response.json();

    if (!response.ok) {
      console.error('WhatsApp Template API Error:', data);
      return {
        success: false,
        error: data.error?.message || 'Failed to send WhatsApp template',
      };
    }

    const messageId = data.messages?.[0]?.id;

    console.log(`WhatsApp template sent successfully:`, {
      to,
      templateName,
      messageId,
    });

    return {
      success: true,
      messageId,
    };
  } catch (error: any) {
    console.error('Error sending WhatsApp template:', error);
    return {
      success: false,
      error: error.message || 'Unknown error occurred',
    };
  }
}

/**
 * Send a message using an approved template by purpose
 *
 * Looks up the approved template in the DB and sends via the appropriate provider.
 * Falls back to plain text if no approved template is found.
 *
 * @param shopId - Shop ID
 * @param to - Recipient phone number
 * @param purpose - Template purpose (e.g., "appointment_reminder_24h")
 * @param variables - Template variables {"1": "Maria", "2": "10:00 AM"}
 * @param fallbackText - Plain text fallback if no approved template exists
 */
export async function sendTemplateByPurpose({
  shopId,
  to,
  purpose,
  variables,
  fallbackText,
}: {
  shopId: string;
  to: string;
  purpose: string;
  variables: Record<string, string>;
  fallbackText: string;
}): Promise<{ success: boolean; messageId?: string; error?: string; usedTemplate: boolean }> {
  try {
    const { getApprovedTemplate } = await import('./template-manager');
    const template = await getApprovedTemplate(shopId, purpose);

    if (template) {
      if (template.provider === 'TWILIO' && template.twilioContentSid) {
        // Twilio: use Content SID
        const result = await sendWhatsAppMessage({
          to,
          message: '', // Not used when contentSid is provided
          shopId,
          contentSid: template.twilioContentSid,
          contentVariables: variables,
        });
        return { ...result, usedTemplate: true };
      }

      if (template.provider === 'META') {
        // Meta: use template API
        const result = await sendWhatsAppTemplate({
          to,
          templateName: template.name,
          parameters: Object.values(variables),
          language: template.language,
          shopId,
        });
        return { ...result, usedTemplate: true };
      }
    }

    // Fallback to plain text
    const result = await sendWhatsAppMessage({ to, message: fallbackText, shopId });
    return { ...result, usedTemplate: false };
  } catch (error: any) {
    console.error('[sendTemplateByPurpose] Error:', error);
    // Last resort: send plain text
    const result = await sendWhatsAppMessage({ to, message: fallbackText, shopId });
    return { ...result, usedTemplate: false };
  }
}

/**
 * Strip URLs and obvious link patterns from user-supplied text.
 * Use this on any field (clientName, notes, etc.) before interpolating into
 * an outbound message, to prevent the chatbot from being used as a phishing relay.
 */
export function sanitizeUserText(input: string | null | undefined, maxLen = 200): string {
  if (!input) return '';
  return String(input)
    .slice(0, maxLen)
    .replace(/https?:\/\/\S+/gi, '[link]')
    .replace(/\b(?:www\.|[\w-]+\.)+[a-z]{2,}\S*/gi, '[link]')
    .replace(/\b(?:whatsapp|wa)\.me\/\S+/gi, '[link]')
    .trim();
}

/**
 * Validate phone number format
 *
 * @param phone - Phone number to validate
 * @returns True if valid, false otherwise
 */
export function validatePhoneNumber(phone: string): boolean {
  // Remove all non-numeric characters
  const cleaned = phone.replace(/\D/g, '');

  // Check if it's a valid phone number (10-15 digits)
  return /^\d{10,15}$/.test(cleaned);
}

/**
 * Format phone number for WhatsApp
 *
 * @param phone - Phone number in any format
 * @returns Formatted phone number with country code
 */
export function formatPhoneNumber(phone: string): string {
  // Remove all non-numeric characters
  const cleaned = phone.replace(/\D/g, '');

  // If it doesn't start with country code, add DR default (+1)
  if (cleaned.length === 10) {
    return `+1${cleaned}`;
  }

  return `+${cleaned}`;
}

/**
 * Send a "typing..." indicator + read receipt for an incoming message.
 *
 * Meta requires the original incoming message_id to mark it as read AND
 * activate the typing indicator. The indicator auto-disappears when the
 * actual response is sent OR after 25 seconds (whichever comes first).
 *
 * Fire-and-forget by design — failures are logged but never block the response.
 *
 * Doc: https://developers.facebook.com/docs/whatsapp/cloud-api/typing-indicators
 */
export async function sendTypingIndicator(
  shopId: string,
  incomingMessageId: string,
): Promise<void> {
  try {
    const shop = await db.shop.findUnique({
      where: { id: shopId },
      select: {
        whatsappProvider: true,
        metaAccessToken: true,
        metaPhoneNumberId: true,
      },
    });

    // Only Meta supports typing indicators (Twilio does not expose this)
    if (!shop || shop.whatsappProvider !== 'META') return;

    const token = shop.metaAccessToken || process.env.WHATSAPP_SYSTEM_USER_TOKEN || process.env.WHATSAPP_ACCESS_TOKEN;
    const phoneId = shop.metaPhoneNumberId || process.env.PHONE_NUMBER_ID;
    if (!token || !phoneId) return;

    const res = await fetch(`https://graph.facebook.com/v22.0/${phoneId}/messages`, {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${token}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        messaging_product: 'whatsapp',
        status: 'read',
        message_id: incomingMessageId,
        typing_indicator: { type: 'text' },
      }),
      // Hard timeout — don't let a slow Meta API stall response generation
      signal: AbortSignal.timeout(2500),
    });

    if (!res.ok) {
      const err = await res.json().catch(() => ({}));
      console.warn('[typing-indicator] Meta returned error:', err?.error?.message || res.status);
    }
  } catch (err: any) {
    // AbortError on slow Meta is expected — don't spam logs
    if (err?.name !== 'AbortError') {
      console.warn('[typing-indicator] Failed:', err?.message);
    }
  }
}

// ──────────────────────────────────────────────────────────────────────────
// Interactive messages (Meta Cloud API only)
// ──────────────────────────────────────────────────────────────────────────

export interface InteractiveButton {
  /** Stable ID returned in webhook payload when client taps. Max 256 chars. */
  id: string;
  /** Button label visible to client. Max 20 chars. */
  title: string;
}

export interface InteractiveListSection {
  title: string; // section header (max 24 chars)
  rows: Array<{
    id: string;        // returned in webhook (max 200 chars)
    title: string;     // visible main text (max 24 chars)
    description?: string; // optional secondary line (max 72 chars)
  }>;
}

/**
 * Send an interactive message with up to 3 reply buttons.
 *
 * Returns same shape as sendWhatsAppMessage. Falls back to plain text
 * if the shop is not on Meta or if the API call fails.
 */
export async function sendInteractiveButtons(params: {
  to: string;
  shopId: string;
  bodyText: string;
  buttons: InteractiveButton[];
  headerText?: string;
  footerText?: string;
}): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const { to, shopId, bodyText, buttons, headerText, footerText } = params;

  if (buttons.length === 0 || buttons.length > 3) {
    return { success: false, error: 'sendInteractiveButtons requires 1-3 buttons' };
  }

  const shop = await db.shop.findUnique({
    where: { id: shopId },
    select: { whatsappProvider: true, metaAccessToken: true, metaPhoneNumberId: true },
  });

  // Twilio doesn't support raw Cloud API interactive messages — fallback to text
  if (!shop || shop.whatsappProvider !== 'META') {
    const fallback = `${headerText ? headerText + '\n\n' : ''}${bodyText}\n\n${buttons.map((b, i) => `${i + 1}. ${b.title}`).join('\n')}`;
    return sendWhatsAppMessage({ to, message: fallback, shopId });
  }

  const token = shop.metaAccessToken || process.env.WHATSAPP_SYSTEM_USER_TOKEN || process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneId = shop.metaPhoneNumberId || process.env.PHONE_NUMBER_ID;
  if (!token || !phoneId) {
    return { success: false, error: 'Meta credentials missing' };
  }

  const interactive: Record<string, unknown> = {
    type: 'button',
    body: { text: bodyText.slice(0, 1024) },
    action: {
      buttons: buttons.slice(0, 3).map(b => ({
        type: 'reply',
        reply: { id: b.id.slice(0, 256), title: b.title.slice(0, 20) },
      })),
    },
  };
  if (headerText) interactive.header = { type: 'text', text: headerText.slice(0, 60) };
  if (footerText) interactive.footer = { text: footerText.slice(0, 60) };

  const res = await fetch(`https://graph.facebook.com/v22.0/${phoneId}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: to.replace(/\D/g, ''),
      type: 'interactive',
      interactive,
    }),
  });
  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    console.error('[interactive-buttons] Meta error:', JSON.stringify(data?.error || data));
    console.error('[interactive-buttons] Payload was:', JSON.stringify(interactive));
    // Graceful fallback so the customer never sees a blank
    const fallback = `${headerText ? headerText + '\n\n' : ''}${bodyText}\n\n${buttons.map((b, i) => `${i + 1}. ${b.title}`).join('\n')}`;
    return sendWhatsAppMessage({ to, message: fallback, shopId });
  }

  return { success: true, messageId: data?.messages?.[0]?.id };
}

/**
 * Send an interactive message with a single dropdown list (sections + rows).
 * Up to 10 rows total across all sections.
 */
export async function sendInteractiveList(params: {
  to: string;
  shopId: string;
  bodyText: string;
  buttonLabel: string; // text on the "open list" button (max 20 chars)
  sections: InteractiveListSection[];
  headerText?: string;
  footerText?: string;
}): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const { to, shopId, bodyText, buttonLabel, sections, headerText, footerText } = params;

  const totalRows = sections.reduce((sum, s) => sum + s.rows.length, 0);
  if (totalRows === 0 || totalRows > 10) {
    return { success: false, error: 'sendInteractiveList requires 1-10 total rows' };
  }

  const shop = await db.shop.findUnique({
    where: { id: shopId },
    select: { whatsappProvider: true, metaAccessToken: true, metaPhoneNumberId: true },
  });

  if (!shop || shop.whatsappProvider !== 'META') {
    const allRows = sections.flatMap(s => s.rows);
    const fallback = `${headerText ? headerText + '\n\n' : ''}${bodyText}\n\n${allRows.map((r, i) => `${i + 1}. ${r.title}${r.description ? ' — ' + r.description : ''}`).join('\n')}`;
    return sendWhatsAppMessage({ to, message: fallback, shopId });
  }

  const token = shop.metaAccessToken || process.env.WHATSAPP_SYSTEM_USER_TOKEN || process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneId = shop.metaPhoneNumberId || process.env.PHONE_NUMBER_ID;
  if (!token || !phoneId) {
    return { success: false, error: 'Meta credentials missing' };
  }

  const interactive: Record<string, unknown> = {
    type: 'list',
    body: { text: bodyText.slice(0, 1024) },
    action: {
      button: buttonLabel.slice(0, 20),
      sections: sections.map(sec => ({
        title: sec.title.slice(0, 24),
        rows: sec.rows.map(r => ({
          id: r.id.slice(0, 200),
          title: r.title.slice(0, 24),
          ...(r.description ? { description: r.description.slice(0, 72) } : {}),
        })),
      })),
    },
  };
  if (headerText) interactive.header = { type: 'text', text: headerText.slice(0, 60) };
  if (footerText) interactive.footer = { text: footerText.slice(0, 60) };

  const res = await fetch(`https://graph.facebook.com/v22.0/${phoneId}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: to.replace(/\D/g, ''),
      type: 'interactive',
      interactive,
    }),
  });
  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    console.error('[interactive-list] Meta error:', JSON.stringify(data?.error || data));
    console.error('[interactive-list] Payload was:', JSON.stringify(interactive));
    const allRows = sections.flatMap(s => s.rows);
    const fallback = `${headerText ? headerText + '\n\n' : ''}${bodyText}\n\n${allRows.map((r, i) => `${i + 1}. ${r.title}${r.description ? ' — ' + r.description : ''}`).join('\n')}`;
    return sendWhatsAppMessage({ to, message: fallback, shopId });
  }

  return { success: true, messageId: data?.messages?.[0]?.id };
}

/**
 * Send a native WhatsApp location message (renders as a map preview with a pin).
 *
 * Falls back to a text message with a Google Maps link if Meta rejects the
 * payload, the shop has no coordinates, or the provider is Twilio.
 */
export async function sendLocation(params: {
  to: string;
  shopId: string;
  latitude: number;
  longitude: number;
  name?: string;
  address?: string;
}): Promise<{ success: boolean; messageId?: string; error?: string }> {
  const { to, shopId, latitude, longitude, name, address } = params;

  const shop = await db.shop.findUnique({
    where: { id: shopId },
    select: { whatsappProvider: true, metaAccessToken: true, metaPhoneNumberId: true },
  });

  // Twilio doesn't support raw Cloud API location messages → text fallback
  if (!shop || shop.whatsappProvider !== 'META') {
    const link = `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;
    const text = `${name ? name + '\n' : ''}${address ? address + '\n' : ''}${link}`;
    return sendWhatsAppMessage({ to, message: text, shopId });
  }

  const token = shop.metaAccessToken || process.env.WHATSAPP_SYSTEM_USER_TOKEN || process.env.WHATSAPP_ACCESS_TOKEN;
  const phoneId = shop.metaPhoneNumberId || process.env.PHONE_NUMBER_ID;
  if (!token || !phoneId) {
    return { success: false, error: 'Meta credentials missing' };
  }

  const res = await fetch(`https://graph.facebook.com/v22.0/${phoneId}/messages`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({
      messaging_product: 'whatsapp',
      recipient_type: 'individual',
      to: to.replace(/\D/g, ''),
      type: 'location',
      location: {
        latitude,
        longitude,
        ...(name ? { name } : {}),
        ...(address ? { address } : {}),
      },
    }),
  });
  const data = await res.json().catch(() => ({}));

  if (!res.ok) {
    console.error('[location] Meta error:', JSON.stringify(data?.error || data));
    const link = `https://www.google.com/maps/search/?api=1&query=${latitude},${longitude}`;
    const text = `${name ? name + '\n' : ''}${address ? address + '\n' : ''}${link}`;
    return sendWhatsAppMessage({ to, message: text, shopId });
  }

  return { success: true, messageId: data?.messages?.[0]?.id };
}
