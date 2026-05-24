import { NextRequest, NextResponse } from "next/server";
import { db } from "@/lib/database";
import { handleMessage } from "@/lib/whatsapp/chatbot-handler";
import { sendWhatsAppMessage } from "@/lib/whatsapp/sender";
import { transcribeTwilioVoiceNote } from "@/lib/whatsapp/voice-transcriber";
import { checkRateLimit, extractIP, rateLimitResponse } from "@/lib/rate-limit";
import { log } from "@/lib/logger";
import twilio from "twilio";

/** Mask phone number for logging */
function maskPhone(phone: string): string {
    if (!phone || phone.length < 6) return '***';
    return phone.slice(0, 4) + '****' + phone.slice(-3);
}

/**
 * Validate Twilio webhook signature
 * https://www.twilio.com/docs/usage/security#validating-requests
 */
function validateTwilioSignature(
    request: NextRequest,
    params: Record<string, string>
): boolean {
    const authToken = process.env.TWILIO_AUTH_TOKEN;
    if (!authToken) {
        log.error('[Twilio] TWILIO_AUTH_TOKEN not configured');
        return false;
    }

    const signature = request.headers.get('x-twilio-signature');
    if (!signature) {
        log.warn('[Twilio] Missing X-Twilio-Signature header');
        return false;
    }

    // Build the full URL that Twilio signed against
    const url = request.url;

    return twilio.validateRequest(authToken, signature, url, params);
}

export async function POST(request: NextRequest) {
    try {
        // Rate limit by IP
        const ip = extractIP(request);
        const { success } = await checkRateLimit(ip, 'webhook');
        if (!success) return rateLimitResponse();

        // Twilio sends application/x-www-form-urlencoded
        const formData = await request.formData();

        // Convert formData to a plain object for signature validation
        const params: Record<string, string> = {};
        formData.forEach((value, key) => {
            params[key] = value.toString();
        });

        // Validate Twilio signature (skip in development for testing)
        if (process.env.NODE_ENV === 'production') {
            if (!validateTwilioSignature(request, params)) {
                log.warn('[Twilio] Invalid signature — rejecting request');
                return new NextResponse("Forbidden", { status: 403 });
            }
        }

        let bodyStr = params["Body"] || "";
        const fromRaw = params["From"] || ""; // "whatsapp:+18091112222"
        const toRaw = params["To"] || ""; // "whatsapp:+15551234567"
        const profileName = params["ProfileName"] || "Usuario";
        const numMedia = parseInt(params["NumMedia"] || "0", 10);
        const mediaUrl0 = params["MediaUrl0"] || "";
        const mediaType0 = params["MediaContentType0"] || "";

        if (!fromRaw || !toRaw) {
            return new NextResponse("Invalid Payload", { status: 400 });
        }

        // If no text body but has audio media, transcribe the voice note
        if (!bodyStr && numMedia > 0 && mediaType0.startsWith('audio/') && mediaUrl0) {
            try {
                log.info('[Twilio] Voice note received — transcribing', { from: maskPhone(fromRaw) });
                const transcribed = await transcribeTwilioVoiceNote(mediaUrl0);
                if (transcribed) {
                    bodyStr = transcribed;
                    log.info('[Twilio] Voice note transcribed', { preview: bodyStr.substring(0, 80) });
                }
            } catch (transcribeErr: any) {
                log.error('[Twilio] Voice transcription failed', { error: transcribeErr?.message });
            }
        }

        if (!bodyStr) {
            // Still no text after transcription attempt — ignore silently
            const twiml = new twilio.twiml.MessagingResponse();
            return new NextResponse(twiml.toString(), {
                headers: { "Content-Type": "text/xml" },
            });
        }

        // Strip 'whatsapp:' and '+' for consistent format
        const from = fromRaw.replace("whatsapp:", "").replace("+", "").trim();
        const businessNumber = toRaw.replace("whatsapp:", "").replace("+", "").trim();

        log.info('[Twilio] Received message', { from: maskPhone(from), voiceNote: numMedia > 0 && mediaType0.startsWith('audio/') });

        // Find shop by WhatsApp number (with or without +1)
        const shop = await db.shop.findFirst({
            where: {
                OR: [
                    { whatsappPhoneNumber: businessNumber },
                    { whatsappPhoneNumber: `+${businessNumber}` },
                    { whatsappPhoneNumber: `+1${businessNumber}` },
                ],
                whatsappProvider: 'TWILIO'
            },
            include: {
                memberships: true,
            },
        });

        if (!shop) {
            log.warn('[Twilio] Shop not found', { businessNumber });
            return new NextResponse("Shop Not Found", { status: 404 });
        }

        log.info('[Twilio] Processing for shop', { shopId: shop.id });

        // Process message with the existing AI chatbot
        let chatbotResponse;
        try {
            chatbotResponse = await handleMessage({
                message: bodyStr,
                shopId: shop.id,
                phoneNumber: from,
                clientName: profileName,
                shop,
            });
        } catch (aiErr: any) {
            log.error('[Twilio] Chatbot handler error', { error: aiErr?.message, shopId: shop.id });
            chatbotResponse = { message: 'Disculpa, estoy teniendo problemas técnicos. Por favor intenta de nuevo en unos minutos.' };
        }

        if (!chatbotResponse) {
            const twiml = new twilio.twiml.MessagingResponse();
            return new NextResponse(twiml.toString(), {
                headers: { "Content-Type": "text/xml" },
            });
        }

        // Send response through the unified sender
        const sendResult = await sendWhatsAppMessage({
            to: from,
            message: chatbotResponse.message,
            shopId: shop.id,
        });

        if (!sendResult.success) {
            log.error('[Twilio] Failed to send response', { error: sendResult.error, shopId: shop.id });
        }

        // Twilio requires an empty XML response when sending asynchronously via API
        const twiml = new twilio.twiml.MessagingResponse();
        return new NextResponse(twiml.toString(), {
            headers: { "Content-Type": "text/xml" },
        });

    } catch (error: any) {
        log.error('[Twilio] Unhandled webhook error', { error: error?.message, stack: error?.stack?.substring(0, 300) });
        const twiml = new twilio.twiml.MessagingResponse();
        return new NextResponse(twiml.toString(), {
            status: 500,
            headers: { "Content-Type": "text/xml" },
        });
    }
}
