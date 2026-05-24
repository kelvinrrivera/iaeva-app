import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('@/lib/database', () => ({
  db: {
    shop: { findFirst: vi.fn() },
    whatsAppConversation: { findUnique: vi.fn(), upsert: vi.fn() },
  },
}));
vi.mock('@/lib/whatsapp/chatbot-handler', () => ({
  handleMessage: vi.fn().mockResolvedValue({ message: 'reply' }),
}));
vi.mock('@/lib/whatsapp/voice-transcriber', () => ({
  transcribeMetaVoiceNote: vi.fn(),
}));
vi.mock('@/lib/whatsapp/sender', () => ({
  sendWhatsAppMessage: vi.fn().mockResolvedValue({ success: true }),
  sendInteractiveButtons: vi.fn().mockResolvedValue({ success: true }),
  sendInteractiveList: vi.fn().mockResolvedValue({ success: true }),
  sendTypingIndicator: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('@/lib/whatsapp/bot-control', () => ({
  shouldBotRespond: vi.fn().mockResolvedValue({ allowed: true }),
  markHumanTakeover: vi.fn().mockResolvedValue(undefined),
  detectsHumanRequest: vi.fn().mockReturnValue(false),
}));
vi.mock('@/lib/rate-limit', () => ({
  checkRateLimit: vi.fn().mockResolvedValue({ success: true }),
  extractIP: vi.fn().mockReturnValue('1.1.1.1'),
  rateLimitResponse: vi.fn(() => new Response('rate', { status: 429 })),
}));
vi.mock('@/lib/logger', () => ({
  log: { info: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

const APP_SECRET = 'TEST_APP_SECRET';
process.env.FACEBOOK_APP_SECRET = APP_SECRET;
process.env.WHATSAPP_WEBHOOK_VERIFY_TOKEN = 'verify';

import { POST } from '@/app/api/whatsapp/webhook/route';
import { db } from '@/lib/database';
import * as botControl from '@/lib/whatsapp/bot-control';
import * as chatbot from '@/lib/whatsapp/chatbot-handler';
import { createHmac } from 'crypto';

function signedRequest(body: any) {
  const raw = JSON.stringify(body);
  const sig = 'sha256=' + createHmac('sha256', APP_SECRET).update(raw).digest('hex');
  return new Request('http://x/api/whatsapp/webhook', {
    method: 'POST',
    headers: { 'x-hub-signature-256': sig, 'content-type': 'application/json' },
    body: raw,
  });
}

const baseShop = {
  id: 'S1', metaPhoneNumberId: 'P1',
  whatsappPhoneNumber: '18095550000', phoneNumber: null, memberships: [],
};

describe('webhook POST', () => {
  beforeEach(() => {
    vi.mocked(db.shop.findFirst).mockReset().mockResolvedValue(baseShop as any);
    vi.mocked(db.whatsAppConversation.findUnique).mockReset().mockResolvedValue(null);
    vi.mocked(botControl.markHumanTakeover).mockReset().mockResolvedValue(undefined);
    vi.mocked(botControl.shouldBotRespond).mockReset().mockResolvedValue({ allowed: true });
    vi.mocked(botControl.detectsHumanRequest).mockReset().mockReturnValue(false);
    vi.mocked(chatbot.handleMessage).mockReset().mockResolvedValue({ message: 'reply' } as any);
  });

  it('processes incoming text messages via chatbot', async () => {
    const payload = {
      object: 'whatsapp_business_account',
      entry: [{
        changes: [{
          field: 'messages',
          value: {
            metadata: { phone_number_id: 'P1', display_phone_number: '+1 809 555 0000' },
            contacts: [{ profile: { name: 'Cliente' }, wa_id: '18099990000' }],
            messages: [{
              from: '18099990000', id: 'wamid.123', timestamp: '1', type: 'text',
              text: { body: 'Hola' },
            }],
          },
        }],
      }],
    };
    const res = await POST(signedRequest(payload) as any);
    expect(res.status).toBe(200);
    expect(chatbot.handleMessage).toHaveBeenCalled();
    expect(botControl.markHumanTakeover).not.toHaveBeenCalled();
  });

  it('detects smb_message_echoes and marks takeover with echo.to', async () => {
    const payload = {
      object: 'whatsapp_business_account',
      entry: [{
        changes: [{
          field: 'smb_message_echoes',
          value: {
            metadata: { phone_number_id: 'P1', display_phone_number: '+1 809 555 0000' },
            message_echoes: [{
              from: '18095550000', to: '18099990000',
              id: 'wamid.echo', timestamp: '1', type: 'text',
              text: { body: 'Manual reply from owner' },
            }],
          },
        }],
      }],
    };
    const res = await POST(signedRequest(payload) as any);
    expect(res.status).toBe(200);
    expect(chatbot.handleMessage).not.toHaveBeenCalled();
    expect(botControl.markHumanTakeover).toHaveBeenCalledWith('S1', '18099990000', 'manual_reply');
  });

  it('marks takeover for every echo when N echoes present', async () => {
    const payload = {
      object: 'whatsapp_business_account',
      entry: [{
        changes: [{
          field: 'smb_message_echoes',
          value: {
            metadata: { phone_number_id: 'P1', display_phone_number: '+1 809 555 0000' },
            message_echoes: [
              { from: '18095550000', to: '18099990001', id: 'e1', timestamp: '1', type: 'text', text: { body: 'a' } },
              { from: '18095550000', to: '18099990002', id: 'e2', timestamp: '2', type: 'text', text: { body: 'b' } },
            ],
          },
        }],
      }],
    };
    await POST(signedRequest(payload) as any);
    expect(botControl.markHumanTakeover).toHaveBeenCalledTimes(2);
    expect(botControl.markHumanTakeover).toHaveBeenNthCalledWith(1, 'S1', '18099990001', 'manual_reply');
    expect(botControl.markHumanTakeover).toHaveBeenNthCalledWith(2, 'S1', '18099990002', 'manual_reply');
  });

  it('ignores status updates without processing', async () => {
    const payload = {
      object: 'whatsapp_business_account',
      entry: [{
        changes: [{
          field: 'messages',
          value: {
            metadata: { phone_number_id: 'P1' },
            statuses: [{ id: 's1', status: 'delivered' }],
          },
        }],
      }],
    };
    const res = await POST(signedRequest(payload) as any);
    expect(res.status).toBe(200);
    expect(chatbot.handleMessage).not.toHaveBeenCalled();
    expect(botControl.markHumanTakeover).not.toHaveBeenCalled();
  });

  it('rejects payload with invalid HMAC signature', async () => {
    const raw = JSON.stringify({ object: 'whatsapp_business_account', entry: [] });
    const req = new Request('http://x/api/whatsapp/webhook', {
      method: 'POST',
      headers: { 'x-hub-signature-256': 'sha256=invalid', 'content-type': 'application/json' },
      body: raw,
    });
    const res = await POST(req as any);
    expect(res.status).toBe(401);
  });

  it('returns 200 silently when shop not found', async () => {
    vi.mocked(db.shop.findFirst).mockResolvedValue(null);
    const payload = {
      object: 'whatsapp_business_account',
      entry: [{
        changes: [{
          field: 'messages',
          value: {
            metadata: { phone_number_id: 'UNKNOWN' },
            contacts: [{ profile: { name: 'X' }, wa_id: '1' }],
            messages: [{ from: '1', id: 'a', timestamp: '1', type: 'text', text: { body: 'hi' } }],
          },
        }],
      }],
    };
    const res = await POST(signedRequest(payload) as any);
    expect(res.status).toBe(200);
    expect(chatbot.handleMessage).not.toHaveBeenCalled();
  });
});
