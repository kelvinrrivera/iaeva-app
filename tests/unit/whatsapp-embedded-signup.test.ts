import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('@/lib/database', () => ({
  db: { shop: { update: vi.fn() } },
}));
vi.mock('@/lib/whatsapp/meta-graph', () => ({
  exchangeCodeForToken: vi.fn(),
  verifyToken: vi.fn(),
  getPhoneNumberStatus: vi.fn(),
  subscribeApp: vi.fn(),
  registerPhone: vi.fn(),
  MetaGraphError: class extends Error { code = 'X'; },
}));
vi.mock('@/lib/whatsapp/template-seeder', () => ({
  seedDefaultTemplates: vi.fn().mockResolvedValue(undefined),
}));
vi.mock('@/lib/whatsapp/health-check', () => ({
  runHealthCheck: vi.fn().mockResolvedValue({
    ready: true, canReceive: true, canSend: true,
    critical: [], warnings: [], recoverable: [],
  }),
}));

// Required env vars for the module to import
process.env.META_APP_ID = 'APP1';
process.env.FACEBOOK_APP_SECRET = 'SECRET1';
process.env.WHATSAPP_SYSTEM_USER_TOKEN = 'SYS_TOKEN';

import { connectWhatsAppToShop } from '@/lib/whatsapp/embedded-signup';
import { db } from '@/lib/database';
import * as graph from '@/lib/whatsapp/meta-graph';

describe('connectWhatsAppToShop', () => {
  beforeEach(() => {
    vi.mocked(db.shop.update).mockReset().mockResolvedValue({} as any);
    vi.mocked(graph.exchangeCodeForToken).mockReset().mockResolvedValue('USER_TOKEN');
    vi.mocked(graph.verifyToken).mockReset().mockResolvedValue({ id: 'me' });
    vi.mocked(graph.getPhoneNumberStatus).mockReset().mockResolvedValue({
      id: 'P1',
      display_phone_number: '+1 809 555 0000',
      verified_name: 'X',
      status: 'CONNECTED',
      platform_type: 'CLOUD_API',
    });
    vi.mocked(graph.subscribeApp).mockReset().mockResolvedValue(undefined);
    vi.mocked(graph.registerPhone).mockReset().mockResolvedValue(undefined);
  });

  it('Coexistence: skips /register, persists coexistenceMode=true', async () => {
    await connectWhatsAppToShop({
      shopId: 'S1',
      code: 'CODE',
      wabaId: 'WABA1',
      phoneNumberId: 'P1',
      featureType: 'coexistence',
    });
    expect(graph.registerPhone).not.toHaveBeenCalled();
    const updateCall = vi.mocked(db.shop.update).mock.calls[0][0] as any;
    expect(updateCall.data.coexistenceMode).toBe(true);
  });

  it('Coexistence: subscribes with smb_message_echoes', async () => {
    await connectWhatsAppToShop({
      shopId: 'S1', code: 'CODE', wabaId: 'WABA1', phoneNumberId: 'P1',
      featureType: 'coexistence',
    });
    const fields = vi.mocked(graph.subscribeApp).mock.calls[0][2];
    expect(fields).toContain('smb_message_echoes');
    expect(fields).toContain('messages');
  });

  it('Cloud API: calls /register, persists coexistenceMode=false', async () => {
    await connectWhatsAppToShop({
      shopId: 'S1', code: 'CODE', wabaId: 'WABA1', phoneNumberId: 'P1',
      featureType: 'cloud_api',
    });
    expect(graph.registerPhone).toHaveBeenCalledWith('P1', expect.any(String));
    const updateCall = vi.mocked(db.shop.update).mock.calls[0][0] as any;
    expect(updateCall.data.coexistenceMode).toBe(false);
  });

  it('Cloud API: subscribes WITHOUT smb_message_echoes', async () => {
    await connectWhatsAppToShop({
      shopId: 'S1', code: 'CODE', wabaId: 'WABA1', phoneNumberId: 'P1',
      featureType: 'cloud_api',
    });
    const fields = vi.mocked(graph.subscribeApp).mock.calls[0][2];
    expect(fields).not.toContain('smb_message_echoes');
  });

  it('Cloud API: surfaces PHONE_IN_USE error from /register', async () => {
    const err: any = new Error('phone in use');
    err.code = 'PHONE_IN_USE';
    vi.mocked(graph.registerPhone).mockRejectedValue(err);

    await expect(connectWhatsAppToShop({
      shopId: 'S1', code: 'CODE', wabaId: 'WABA1', phoneNumberId: 'P1',
      featureType: 'cloud_api',
    })).rejects.toMatchObject({ code: 'PHONE_IN_USE' });
  });
});
