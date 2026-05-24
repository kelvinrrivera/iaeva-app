import { describe, it, expect, beforeEach, vi } from 'vitest';
import {
  getPhoneNumberStatus,
  getWabaInfo,
  getSubscribedApps,
  subscribeApp,
  registerPhone,
  exchangeCodeForToken,
  MetaGraphError,
} from '@/lib/whatsapp/meta-graph';

const mockFetch = vi.fn();
global.fetch = mockFetch as any;

describe('meta-graph', () => {
  beforeEach(() => {
    mockFetch.mockReset();
  });

  describe('getPhoneNumberStatus', () => {
    it('returns parsed phone status', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          id: 'P1',
          display_phone_number: '+1 809 555 0000',
          verified_name: 'Test',
          status: 'CONNECTED',
          platform_type: 'CLOUD_API',
          quality_rating: 'GREEN',
          code_verification_status: 'VERIFIED',
        }),
      });
      const result = await getPhoneNumberStatus('P1', 'TOKEN');
      expect(result.status).toBe('CONNECTED');
      expect(result.platform_type).toBe('CLOUD_API');
    });

    it('throws MetaGraphError on non-ok response', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        status: 400,
        json: async () => ({ error: { message: 'bad', code: 100 } }),
      });
      await expect(getPhoneNumberStatus('P1', 'TOKEN')).rejects.toThrow(MetaGraphError);
    });
  });

  describe('subscribeApp', () => {
    it('sends subscribed_fields in body', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      });
      await subscribeApp('WABA1', 'TOKEN', ['messages', 'smb_message_echoes']);
      const [, init] = mockFetch.mock.calls[0];
      const body = JSON.parse(init.body);
      expect(body.subscribed_fields).toEqual(['messages', 'smb_message_echoes']);
    });
  });

  describe('registerPhone', () => {
    it('throws PHONE_IN_USE on subcode 2388001', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error: { message: 'in use', error_subcode: 2388001 } }),
      });
      await expect(registerPhone('P1', 'TOKEN')).rejects.toMatchObject({
        code: 'PHONE_IN_USE',
      });
    });

    it('returns success on 200', async () => {
      mockFetch.mockResolvedValueOnce({
        ok: true,
        json: async () => ({ success: true }),
      });
      await expect(registerPhone('P1', 'TOKEN')).resolves.toBeUndefined();
    });
  });
});
