/**
 * Meta WhatsApp Cloud API Webhook Receiver
 *
 * Receives incoming messages from WhatsApp/Meta Cloud API
 * Handles webhook verification (GET) and message processing (POST)
 *
 * Branching by `change.field`:
 *   - `messages`            → inbound client message → bot
 *   - `smb_message_echoes`  → owner replied from WhatsApp Business app → human takeover
 *
 * Meta Documentation: https://developers.facebook.com/docs/whatsapp/cloud-api/webhooks
 */

import { NextRequest, NextResponse } from 'next/server';
import { createHmac, timingSafeEqual } from 'crypto';
import { db } from '@/lib/database';
import { handleMessage } from '@/lib/whatsapp/chatbot-handler';
import { transcribeMetaVoiceNote } from '@/lib/whatsapp/voice-transcriber';
import { checkRateLimit, extractIP, rateLimitResponse } from '@/lib/rate-limit';
import { log } from '@/lib/logger';

/** Mask phone number for logging: +1809****567 */
function maskPhone(phone: string): string {
  if (!phone || phone.length < 6) return '***';
  return phone.slice(0, 4) + '****' + phone.slice(-3);
}

/**
 * Translate an interactive reply (button/list) into a natural-language hint
 * the LLM can interpret unambiguously. The user saw `title`; we pass that
 * along with the structured id so the agent knows EXACTLY what was chosen.
 */
function describeInteractiveSelection(id: string, title: string): string {
  const cleanTitle = title.trim();
  if (id.startsWith('service:')) {
    const serviceId = id.slice('service:'.length);
    return `[ACCIÓN DEL CLIENTE] Eligió el servicio "${cleanTitle}" (serviceId=${serviceId}).`;
  }
  if (id.startsWith('slot:')) {
    const time = id.slice('slot:'.length); // HH:mm 24h (interno)
    // Le decimos al LLM ambos formatos: el 24h preciso para sus tools y el
    // 12h que vio el cliente (para que pueda repetirlo igual al confirmar).
    const [hStr, mStr] = time.split(':');
    let h = parseInt(hStr, 10);
    const m = parseInt(mStr, 10);
    const period = h >= 12 ? 'PM' : 'AM';
    if (h === 0) h = 12;
    else if (h > 12) h -= 12;
    const time12 = `${h}:${String(m).padStart(2, '0')} ${period}`;
    return `[ACCIÓN DEL CLIENTE] Eligió el horario ${time12} (${time} en 24h).`;
  }
  if (id.startsWith('stylist:')) {
    const stylistId = id.slice('stylist:'.length);
    return `[ACCIÓN DEL CLIENTE] Eligió al profesional "${cleanTitle}" (stylistId=${stylistId}).`;
  }
  if (id === 'confirm:yes') {
    return '[ACCIÓN DEL CLIENTE] Tocó ✅ Confirmar — autoriza crear la cita ahora.';
  }
  if (id === 'confirm:no') {
    return '[ACCIÓN DEL CLIENTE] Tocó ❌ Cancelar — no quiere crear la cita.';
  }
  if (id === 'confirm:change') {
    return '[ACCIÓN DEL CLIENTE] Tocó ✏️ Cambiar hora — quiere ver otros horarios.';
  }
  if (id.startsWith('appt:cancel:')) {
    return `[ACCIÓN DEL CLIENTE] Pidió cancelar la cita ${id.slice('appt:cancel:'.length)}.`;
  }
  if (id.startsWith('appt:reschedule:')) {
    return `[ACCIÓN DEL CLIENTE] Pidió reagendar la cita ${id.slice('appt:reschedule:'.length)}.`;
  }
  return cleanTitle || id;
}

/**
 * Verify Meta webhook signature (X-Hub-Signature-256)
 */
function verifyWebhookSignature(rawBody: string, signature: string | null): boolean {
  const appSecret = process.env.FACEBOOK_APP_SECRET;
  if (!appSecret) {
    log.error('[Meta] FACEBOOK_APP_SECRET not set — rejecting webhook');
    return false;
  }
  if (!signature) return false;
  const expectedSignature = 'sha256=' + createHmac('sha256', appSecret).update(rawBody).digest('hex');
  if (expectedSignature.length !== signature.length) return false;
  return timingSafeEqual(Buffer.from(expectedSignature), Buffer.from(signature));
}

/**
 * GET /api/whatsapp/webhook
 *
 * Used for webhook verification by Meta
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const mode = searchParams.get('hub.mode');
  const token = searchParams.get('hub.verify_token');
  const challenge = searchParams.get('hub.challenge');

  // Verify the token matches our environment variable
  const verifyToken = process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN;

  if (
    mode === 'subscribe' &&
    token && verifyToken &&
    token.length === verifyToken.length &&
    timingSafeEqual(Buffer.from(token), Buffer.from(verifyToken))
  ) {
    log.info('[Meta] Webhook verification successful');
    return new NextResponse(challenge ?? '', { status: 200, headers: { 'Content-Type': 'text/plain' } });
  }

  log.warn('[Meta] Webhook verification failed: token mismatch');
  return new NextResponse('Forbidden', { status: 403 });
}

/**
 * POST /api/whatsapp/webhook
 */
export async function POST(request: NextRequest) {
  try {
    const ip = extractIP(request);
    const { success } = await checkRateLimit(ip, 'webhook');
    if (!success) return rateLimitResponse();

    const rawBody = await request.text();

    const signature = request.headers.get('x-hub-signature-256');
    if (!verifyWebhookSignature(rawBody, signature)) {
      log.warn('[Meta] Invalid webhook signature');
      return new NextResponse('Unauthorized', { status: 401 });
    }

    const body = JSON.parse(rawBody);

    if (body.object !== 'whatsapp_business_account') {
      return NextResponse.json({ error: 'Not a WhatsApp event' }, { status: 404 });
    }

    const entry = body.entry?.[0];
    const change = entry?.changes?.[0];
    const value = change?.value;

    // 1. Empty payload — nothing to do
    if (!value) {
      return NextResponse.json({ success: true });
    }

    // 2. Status updates (delivered/read) — log y salir
    if (value.statuses) {
      return NextResponse.json({ success: true });
    }

    // 3. Coexistence echoes — owner sent from WhatsApp Business app
    if (change.field === 'smb_message_echoes' && Array.isArray(value.message_echoes)) {
      await handleEchoes(value);
      return NextResponse.json({ success: true });
    }

    // 4. Inbound client messages
    if (change.field === 'messages' && Array.isArray(value.messages)) {
      return await handleIncoming(value);
    }

    return NextResponse.json({ success: true });

  } catch (error: any) {
    log.error('[Meta] Unhandled webhook error', { error: error?.message, stack: error?.stack?.substring(0, 300) });
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    );
  }
}

/**
 * Handle smb_message_echoes — owner sent a message from their WhatsApp Business app.
 * Each echo means the owner is replying manually to a client; mark that conversation
 * as HUMAN takeover so the bot doesn't talk over them.
 */
async function handleEchoes(value: any): Promise<void> {
  const phoneNumberId = value.metadata?.phone_number_id;
  if (!phoneNumberId) return;
  const shop = await db.shop.findFirst({
    where: { metaPhoneNumberId: phoneNumberId },
    select: { id: true },
  });
  if (!shop) {
    log.warn('[Meta] Echo for unknown phone_number_id', { phoneNumberId });
    return;
  }
  const { markHumanTakeover } = await import('@/lib/whatsapp/bot-control');
  for (const echo of value.message_echoes) {
    const recipient = echo?.to;
    if (!recipient) continue;
    await markHumanTakeover(shop.id, recipient, 'manual_reply').catch(err =>
      log.warn('[Meta] Echo takeover failed', { error: err?.message, recipient: maskPhone(recipient) })
    );
    log.info('[Meta] Coexistence echo — bot silenced', { shopId: shop.id, to: maskPhone(recipient) });
  }
}

/**
 * Handle messages — inbound client message → AI chatbot.
 */
async function handleIncoming(value: any): Promise<NextResponse> {
  const message = value.messages[0];
  const from = message.from;
  const contactName = value.contacts?.[0]?.profile?.name || 'Cliente';
  const businessNumber = value.metadata?.display_phone_number;

  // Extract text from text messages or transcribe voice notes
  let messageText = message.text?.body || null;

  // Interactive replies: client tapped a button or selected from a list.
  // We translate the structured `id` payload into a natural-language hint for
  // the LLM, so it has unambiguous context about what the client just chose
  // (the title is what the user actually saw and tapped).
  if (!messageText && message.type === 'interactive') {
    const interactive = message.interactive;
    if (interactive?.type === 'button_reply' && interactive.button_reply?.id) {
      const rawId = interactive.button_reply.id;
      const title = interactive.button_reply.title || '';
      messageText = describeInteractiveSelection(rawId, title);
      log.info('[Meta] Interactive button tap', { from: maskPhone(from), id: rawId, translated: messageText });
    } else if (interactive?.type === 'list_reply' && interactive.list_reply?.id) {
      const rawId = interactive.list_reply.id;
      const title = interactive.list_reply.title || '';
      messageText = describeInteractiveSelection(rawId, title);
      log.info('[Meta] Interactive list selection', { from: maskPhone(from), id: rawId, translated: messageText });
    }
  }

  if (!messageText && message.type === 'audio' && message.audio?.id) {
    try {
      log.info('[Meta] Voice note received — transcribing', { from: maskPhone(from) });
      messageText = await transcribeMetaVoiceNote(message.audio.id);
      if (messageText) {
        log.info('[Meta] Voice note transcribed', { preview: messageText.substring(0, 80) });
      }
    } catch (transcribeErr: any) {
      log.error('[Meta] Voice transcription failed', { error: transcribeErr?.message, from: maskPhone(from) });
    }
  }

  log.info('[Meta] Received message', { from: maskPhone(from), type: message.type });

  if (!messageText) {
    return NextResponse.json({ success: true });
  }

  // Find shop — prefer the stable phone_number_id, fall back to display number
  const phoneNumberId = value.metadata?.phone_number_id;
  const orClauses: object[] = [];
  if (phoneNumberId) orClauses.push({ metaPhoneNumberId: phoneNumberId });
  if (businessNumber) {
    orClauses.push({ whatsappPhoneNumber: businessNumber });
    orClauses.push({ whatsappPhoneNumber: businessNumber.replace(/\D/g, '') });
    orClauses.push({ phoneNumber: businessNumber });
  }

  const shop = await db.shop.findFirst({
    where: { OR: orClauses },
    include: { memberships: true },
  });

  if (!shop) {
    log.warn('[Meta] Shop not found', { phoneNumberId, businessNumber });
    return NextResponse.json({ success: true });
  }

  log.info('[Meta] Processing for shop', { shopId: shop.id, from: maskPhone(from) });

  // Fire-and-forget: show "✓✓ leído" + "escribiendo..." while we generate the reply.
  // Meta auto-clears the indicator when our actual response is sent (or after 25s).
  if (message.id) {
    const { sendTypingIndicator } = await import('@/lib/whatsapp/sender');
    sendTypingIndicator(shop.id, message.id).catch(() => null);
  }

  const { shouldBotRespond, markHumanTakeover, detectsHumanRequest } = await import('@/lib/whatsapp/bot-control');

  // (a) Client explicitly asks for a human
  if (detectsHumanRequest(messageText)) {
    await markHumanTakeover(shop.id, from, 'client_request').catch(() => null);
    const { sendWhatsAppMessage } = await import('@/lib/whatsapp/sender');
    await sendWhatsAppMessage({
      to: from,
      message: 'Te paso con una persona del equipo. En cuanto estén disponibles te responden por aquí.',
      shopId: shop.id,
    });
    log.info('[Meta] Human-request detected — escalated', { shopId: shop.id });
    return NextResponse.json({ success: true });
  }

  // (b) Schedule + active human takeover gate
  const conversation = await db.whatsAppConversation.findUnique({
    where: { phoneNumber_shopId: { phoneNumber: from, shopId: shop.id } },
    select: { id: true, closedAutoReplySentAt: true },
  });
  const decision = await shouldBotRespond(shop.id, conversation?.id ?? null);
  if (!decision.allowed) {
    if (decision.courtesyReply && decision.reason !== 'human_control' && decision.reason !== 'paused') {
      const lastSent = conversation?.closedAutoReplySentAt;
      const cooldownPassed = !lastSent || (Date.now() - new Date(lastSent).getTime()) > 24 * 60 * 60 * 1000;
      if (cooldownPassed) {
        const { sendWhatsAppMessage } = await import('@/lib/whatsapp/sender');
        await sendWhatsAppMessage({ to: from, message: decision.courtesyReply, shopId: shop.id });
        await db.whatsAppConversation.upsert({
          where: { phoneNumber_shopId: { phoneNumber: from, shopId: shop.id } },
          update: { closedAutoReplySentAt: new Date() },
          create: { shopId: shop.id, phoneNumber: from, phase: 'closed', stateJson: '{}', closedAutoReplySentAt: new Date() },
        });
      }
    }
    log.info('[Meta] Bot silenced', { reason: decision.reason, shopId: shop.id });
    return NextResponse.json({ success: true });
  }

  // Process with AI chatbot
  let chatbotResponse;
  try {
    chatbotResponse = await handleMessage({
      message: messageText,
      shopId: shop.id,
      phoneNumber: from,
      clientName: contactName,
      shop,
    });
  } catch (aiErr: any) {
    log.error('[Meta] Chatbot handler error', { error: aiErr?.message, shopId: shop.id });
    chatbotResponse = { message: 'Disculpa, estoy teniendo problemas técnicos. Por favor intenta de nuevo en unos minutos.' };
  }

  if (!chatbotResponse) {
    return NextResponse.json({ success: true });
  }

  const sender = await import('@/lib/whatsapp/sender');

  // If the chatbot response includes an interactive payload, send via the
  // matching helper. Each helper falls back to plain text on Twilio shops or
  // if Meta rejects the payload — the customer always sees something.
  let sendResult: { success: boolean; messageId?: string; error?: string };

  if (chatbotResponse.interactive?.kind === 'list') {
    const i = chatbotResponse.interactive;
    sendResult = await sender.sendInteractiveList({
      to: from,
      shopId: shop.id,
      bodyText: i.bodyText,
      buttonLabel: i.buttonLabel,
      sections: i.sections,
    });
  } else if (chatbotResponse.interactive?.kind === 'buttons') {
    const i = chatbotResponse.interactive;
    sendResult = await sender.sendInteractiveButtons({
      to: from,
      shopId: shop.id,
      bodyText: i.bodyText,
      buttons: i.buttons,
    });
  } else if (chatbotResponse.interactive?.kind === 'location') {
    const i = chatbotResponse.interactive;
    sendResult = await sender.sendLocation({
      to: from,
      shopId: shop.id,
      latitude: i.latitude,
      longitude: i.longitude,
      name: i.name,
      address: i.address,
    });
  } else {
    sendResult = await sender.sendWhatsAppMessage({
      to: from,
      message: chatbotResponse.message,
      shopId: shop.id,
    });
  }

  if (!sendResult.success) {
    log.error('[Meta] Failed to send response', { error: sendResult.error, shopId: shop.id });
    return NextResponse.json({ success: false, error: 'send_failed' });
  }

  log.info('[Meta] Response sent', { shopId: shop.id });
  return NextResponse.json({ success: true });
}
