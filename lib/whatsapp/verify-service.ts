import twilio from 'twilio';

/**
 * Cached Verify Service SID (in-memory, survives across requests in the same process)
 */
let cachedVerifyServiceSid: string | null = null;

/**
 * Gets or creates a Twilio Verify Service.
 * Uses TWILIO_VERIFY_SERVICE_SID env var if set, otherwise finds or creates one.
 */
export async function getVerifyServiceSid(): Promise<string | null> {
    // 1. Check env var
    if (process.env.TWILIO_VERIFY_SERVICE_SID) {
        return process.env.TWILIO_VERIFY_SERVICE_SID;
    }

    // 2. Check in-memory cache
    if (cachedVerifyServiceSid) {
        return cachedVerifyServiceSid;
    }

    const accountSid = process.env.TWILIO_ACCOUNT_SID;
    const authToken = process.env.TWILIO_AUTH_TOKEN;

    if (!accountSid || !authToken) {
        return null;
    }

    const client = twilio(accountSid, authToken);

    try {
        // 3. Try to find an existing service
        const services = await client.verify.v2.services.list({ limit: 20 });
        const existing = services.find(s => s.friendlyName === 'DomiCita WhatsApp Verification');

        if (existing) {
            cachedVerifyServiceSid = existing.sid;
            console.log(`[Verify] Found existing service: ${existing.sid}`);
            return existing.sid;
        }

        // 4. Create a new one
        const service = await client.verify.v2.services.create({
            friendlyName: 'DomiCita WhatsApp Verification',
            codeLength: 6,
        });
        cachedVerifyServiceSid = service.sid;
        console.log(`[Verify] Created service: ${service.sid}. Set TWILIO_VERIFY_SERVICE_SID=${service.sid} in .env for persistence.`);
        return service.sid;
    } catch (error) {
        console.error('[Verify] Error getting/creating service:', error);
        return null;
    }
}
