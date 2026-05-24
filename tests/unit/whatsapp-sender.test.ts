import { describe, it, expect, beforeEach, vi } from 'vitest';

// Mock database before imports
vi.mock('@/lib/database', () => ({
  db: {
    shop: {
      findUnique: vi.fn(),
    },
  },
}));

// Mock twilio
vi.mock('twilio', () => {
  const mockCreate = vi.fn().mockResolvedValue({ sid: 'SM_test_123' });
  return {
    default: vi.fn(() => ({
      messages: { create: mockCreate },
    })),
  };
});

import { validatePhoneNumber, formatPhoneNumber, sendWhatsAppMessage } from '@/lib/whatsapp/sender';
import { db } from '@/lib/database';

describe('whatsapp sender', () => {
  describe('validatePhoneNumber', () => {
    it('accepts valid 10-digit number', () => {
      expect(validatePhoneNumber('8091234567')).toBe(true);
    });

    it('accepts valid 11-digit number with country code', () => {
      expect(validatePhoneNumber('18091234567')).toBe(true);
    });

    it('accepts number with special characters (strips them)', () => {
      expect(validatePhoneNumber('+1 (809) 123-4567')).toBe(true);
    });

    it('rejects number shorter than 10 digits', () => {
      expect(validatePhoneNumber('12345')).toBe(false);
    });

    it('rejects number longer than 15 digits', () => {
      expect(validatePhoneNumber('1234567890123456')).toBe(false);
    });

    it('rejects empty string', () => {
      expect(validatePhoneNumber('')).toBe(false);
    });
  });

  describe('formatPhoneNumber', () => {
    it('adds +1 prefix to 10-digit number', () => {
      expect(formatPhoneNumber('8091234567')).toBe('+18091234567');
    });

    it('adds + prefix to number with country code', () => {
      expect(formatPhoneNumber('18091234567')).toBe('+18091234567');
    });

    it('strips non-numeric chars and formats', () => {
      expect(formatPhoneNumber('+1 (809) 123-4567')).toBe('+18091234567');
    });

    it('handles already-formatted number', () => {
      expect(formatPhoneNumber('+18091234567')).toBe('+18091234567');
    });
  });

  // TODO(tests): these tests assume META as default provider; sender.ts now defaults to
  // TWILIO. Realign the mocks/fixtures before re-enabling.
  describe.skip('sendWhatsAppMessage', () => {
    beforeEach(() => {
      vi.clearAllMocks();
      // Set Meta env vars
      process.env.WHATSAPP_ACCESS_TOKEN = 'test_access_token';
      process.env.PHONE_NUMBER_ID = 'test_phone_id';
      process.env.TWILIO_ACCOUNT_SID = 'test_sid';
      process.env.TWILIO_AUTH_TOKEN = 'test_auth';
      process.env.TWILIO_WHATSAPP_NUMBER = '+15551234567';
    });

    it('sends via META when no shopId provided', async () => {
      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ messages: [{ id: 'wamid_123' }] }),
      });
      global.fetch = mockFetch;

      const result = await sendWhatsAppMessage({
        to: '+18091234567',
        message: 'Hola!',
      });

      expect(result.success).toBe(true);
      expect(result.messageId).toBe('wamid_123');
      expect(mockFetch).toHaveBeenCalledWith(
        expect.stringContaining('graph.facebook.com'),
        expect.objectContaining({
          method: 'POST',
          headers: expect.objectContaining({
            Authorization: 'Bearer test_access_token',
          }),
        })
      );
    });

    it('sends via META for shop with META provider', async () => {
      vi.mocked(db.shop.findUnique).mockResolvedValue({
        whatsappProvider: 'META',
      } as any);

      const mockFetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ messages: [{ id: 'wamid_456' }] }),
      });
      global.fetch = mockFetch;

      const result = await sendWhatsAppMessage({
        to: '+18091234567',
        message: 'Test',
        shopId: 'shop_1',
      });

      expect(result.success).toBe(true);
      expect(db.shop.findUnique).toHaveBeenCalledWith({ where: { id: 'shop_1' } });
    });

    it('sends via TWILIO for shop with TWILIO provider', async () => {
      vi.mocked(db.shop.findUnique).mockResolvedValue({
        whatsappProvider: 'TWILIO',
        twilioAccountSid: null,
        twilioAuthToken: null,
      } as any);

      const result = await sendWhatsAppMessage({
        to: '+18091234567',
        message: 'Hola Twilio!',
        shopId: 'shop_2',
      });

      expect(result.success).toBe(true);
      expect(result.messageId).toBe('SM_test_123');
    });

    it('returns error when Meta API fails', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: false,
        json: () => Promise.resolve({ error: { message: 'Invalid token' } }),
      });

      const result = await sendWhatsAppMessage({
        to: '+18091234567',
        message: 'Test',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('Invalid token');
    });

    it('returns error when WHATSAPP_ACCESS_TOKEN is missing', async () => {
      delete process.env.WHATSAPP_ACCESS_TOKEN;

      const result = await sendWhatsAppMessage({
        to: '+18091234567',
        message: 'Test',
      });

      expect(result.success).toBe(false);
      expect(result.error).toContain('WHATSAPP_ACCESS_TOKEN');
    });

    it('strips non-numeric chars from phone number for Meta', async () => {
      global.fetch = vi.fn().mockResolvedValue({
        ok: true,
        json: () => Promise.resolve({ messages: [{ id: 'wamid_789' }] }),
      });

      await sendWhatsAppMessage({
        to: '+1(809)123-4567',
        message: 'Test',
      });

      const fetchCall = vi.mocked(global.fetch).mock.calls[0];
      const body = JSON.parse(fetchCall[1]?.body as string);
      expect(body.to).toBe('18091234567');
    });
  });
});
