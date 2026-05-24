import { describe, it, expect, beforeEach, vi } from 'vitest';
import { createHmac } from 'crypto';

// Mock dependencies before imports
vi.mock('@/lib/database', () => ({
  db: {
    shop: {
      findFirst: vi.fn(),
      findUnique: vi.fn(),
    },
  },
}));

vi.mock('@/lib/whatsapp/chatbot-handler', () => ({
  handleMessage: vi.fn().mockResolvedValue({ message: 'Respuesta del bot' }),
}));

vi.mock('@/lib/whatsapp/sender', () => ({
  sendWhatsAppMessage: vi.fn().mockResolvedValue({ success: true, messageId: 'msg_123' }),
}));

vi.mock('@/lib/whatsapp/voice-transcriber', () => ({
  transcribeMetaVoiceNote: vi.fn().mockResolvedValue(null),
  transcribeTwilioVoiceNote: vi.fn().mockResolvedValue(null),
}));

vi.mock('@/lib/rate-limit', () => ({
  checkRateLimit: vi.fn().mockResolvedValue({ success: true, remaining: 100 }),
  extractIP: vi.fn().mockReturnValue('127.0.0.1'),
  rateLimitResponse: vi.fn().mockReturnValue(new Response('Rate limited', { status: 429 })),
}));

vi.mock('@/lib/logger', () => ({
  log: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}));

describe('Meta WhatsApp Webhook', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN = 'test_verify_token';
    process.env.FACEBOOK_APP_SECRET = 'test_app_secret';
  });

  describe('GET — webhook verification', () => {
    it('returns challenge when token matches', async () => {
      const { GET } = await import('@/app/api/whatsapp/webhook/route');
      const url = new URL('http://localhost/api/whatsapp/webhook');
      url.searchParams.set('hub.mode', 'subscribe');
      url.searchParams.set('hub.verify_token', 'test_verify_token');
      url.searchParams.set('hub.challenge', 'challenge_123');

      const request = new Request(url.toString()) as any;
      request.nextUrl = url;

      const response = await GET(request);
      expect(response.status).toBe(200);
      const text = await response.text();
      expect(text).toBe('challenge_123');
    });

    it('returns 403 when token does not match', async () => {
      const { GET } = await import('@/app/api/whatsapp/webhook/route');
      const url = new URL('http://localhost/api/whatsapp/webhook');
      url.searchParams.set('hub.mode', 'subscribe');
      url.searchParams.set('hub.verify_token', 'wrong_token');
      url.searchParams.set('hub.challenge', 'challenge_123');

      const request = new Request(url.toString()) as any;
      request.nextUrl = url;

      const response = await GET(request);
      expect(response.status).toBe(403);
    });

    it('returns 403 when mode is not subscribe', async () => {
      const { GET } = await import('@/app/api/whatsapp/webhook/route');
      const url = new URL('http://localhost/api/whatsapp/webhook');
      url.searchParams.set('hub.mode', 'unsubscribe');
      url.searchParams.set('hub.verify_token', 'test_verify_token');
      url.searchParams.set('hub.challenge', 'challenge_123');

      const request = new Request(url.toString()) as any;
      request.nextUrl = url;

      const response = await GET(request);
      expect(response.status).toBe(403);
    });
  });

  describe('POST — message processing', () => {
    function createSignedRequest(body: object) {
      const rawBody = JSON.stringify(body);
      const signature = 'sha256=' + createHmac('sha256', 'test_app_secret').update(rawBody).digest('hex');

      const request = new Request('http://localhost/api/whatsapp/webhook', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-hub-signature-256': signature,
        },
        body: rawBody,
      });
      return request as any;
    }

    it('returns 401 for invalid signature', async () => {
      const { POST } = await import('@/app/api/whatsapp/webhook/route');
      const body = { object: 'whatsapp_business_account' };

      const request = new Request('http://localhost/api/whatsapp/webhook', {
        method: 'POST',
        headers: {
          'content-type': 'application/json',
          'x-hub-signature-256': 'sha256=invalid_signature',
        },
        body: JSON.stringify(body),
      }) as any;

      const response = await POST(request);
      expect(response.status).toBe(401);
    });

    it('returns 404 for non-WhatsApp events', async () => {
      const { POST } = await import('@/app/api/whatsapp/webhook/route');
      const body = { object: 'page' };
      const request = createSignedRequest(body);

      const response = await POST(request);
      expect(response.status).toBe(404);
    });

    it('returns 200 for status updates without processing', async () => {
      const { POST } = await import('@/app/api/whatsapp/webhook/route');
      const body = {
        object: 'whatsapp_business_account',
        entry: [{
          changes: [{
            value: {
              statuses: [{ status: 'delivered', id: 'msg_123' }],
            },
          }],
        }],
      };
      const request = createSignedRequest(body);

      const response = await POST(request);
      expect(response.status).toBe(200);
    });

    it('returns 200 for empty value', async () => {
      const { POST } = await import('@/app/api/whatsapp/webhook/route');
      const body = {
        object: 'whatsapp_business_account',
        entry: [{
          changes: [{
            value: null,
          }],
        }],
      };
      const request = createSignedRequest(body);

      const response = await POST(request);
      expect(response.status).toBe(200);
    });

    it('processes text message and routes to chatbot', async () => {
      const { POST } = await import('@/app/api/whatsapp/webhook/route');
      const { db } = await import('@/lib/database');
      const { handleMessage } = await import('@/lib/whatsapp/chatbot-handler');

      vi.mocked(db.shop.findFirst).mockResolvedValue({
        id: 'shop_1',
        name: 'TestShop',
        memberships: [],
      } as any);

      const body = {
        object: 'whatsapp_business_account',
        entry: [{
          changes: [{
            value: {
              metadata: { display_phone_number: '18091234567' },
              contacts: [{ profile: { name: 'Juan' } }],
              messages: [{
                from: '18095551234',
                type: 'text',
                text: { body: 'Hola quiero una cita' },
              }],
            },
          }],
        }],
      };
      const request = createSignedRequest(body);

      const response = await POST(request);
      expect(response.status).toBe(200);
      expect(handleMessage).toHaveBeenCalledWith(
        expect.objectContaining({
          message: 'Hola quiero una cita',
          shopId: 'shop_1',
          phoneNumber: '18095551234',
          clientName: 'Juan',
        })
      );
    });

    it('handles rate limiting', async () => {
      const { POST } = await import('@/app/api/whatsapp/webhook/route');
      const { checkRateLimit, rateLimitResponse } = await import('@/lib/rate-limit');

      vi.mocked(checkRateLimit).mockResolvedValueOnce({ success: false, remaining: 0 });

      const body = { object: 'whatsapp_business_account' };
      const request = createSignedRequest(body);

      const response = await POST(request);
      expect(response.status).toBe(429);
    });
  });
});

describe('Meta webhook signature verification', () => {
  it('generates correct HMAC SHA-256 signature', () => {
    const appSecret = 'my_secret';
    const rawBody = '{"test": true}';
    const expected = 'sha256=' + createHmac('sha256', appSecret).update(rawBody).digest('hex');

    expect(expected).toMatch(/^sha256=[a-f0-9]{64}$/);
  });
});
