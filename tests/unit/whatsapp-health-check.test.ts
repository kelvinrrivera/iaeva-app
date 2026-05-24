import { describe, it, expect, beforeEach, vi } from 'vitest';

vi.mock('@/lib/database', () => ({
  db: { shop: { findUnique: vi.fn() } },
}));
vi.mock('@/lib/whatsapp/meta-graph', () => ({
  getPhoneNumberStatus: vi.fn(),
  getWabaInfo: vi.fn(),
  getSubscribedApps: vi.fn(),
  verifyToken: vi.fn(),
}));

import { runHealthCheck } from '@/lib/whatsapp/health-check';
import { db } from '@/lib/database';
import * as graph from '@/lib/whatsapp/meta-graph';

const mockShop = (overrides: any = {}) => ({
  id: 'S1',
  metaPhoneNumberId: 'P1',
  metaBusinessAccountId: 'WABA1',
  metaAccessToken: 'TOKEN',
  coexistenceMode: false,
  ...overrides,
});

const META_APP_ID = process.env.META_APP_ID || '1599970834652215';

describe('runHealthCheck', () => {
  beforeEach(() => {
    vi.mocked(db.shop.findUnique).mockReset();
    vi.mocked(graph.getPhoneNumberStatus).mockReset();
    vi.mocked(graph.getWabaInfo).mockReset();
    vi.mocked(graph.getSubscribedApps).mockReset();
    vi.mocked(graph.verifyToken).mockReset();
  });

  it('returns ready when all checks pass (Cloud API)', async () => {
    vi.mocked(db.shop.findUnique).mockResolvedValue(mockShop());
    vi.mocked(graph.verifyToken).mockResolvedValue({ id: 'me' });
    vi.mocked(graph.getPhoneNumberStatus).mockResolvedValue({
      id: 'P1',
      display_phone_number: '+1',
      verified_name: 'X',
      status: 'CONNECTED',
      platform_type: 'CLOUD_API',
    });
    vi.mocked(graph.getWabaInfo).mockResolvedValue({
      id: 'WABA1',
      name: 'X',
      business_verification_status: 'verified',
      primary_funding_id: 'F1',
      health_status: { can_send_message: 'AVAILABLE' },
    });
    vi.mocked(graph.getSubscribedApps).mockResolvedValue([
      {
        whatsapp_business_api_data: { id: META_APP_ID, name: 'DomiCita' },
        subscribed_fields: ['messages', 'message_template_status_update'],
      },
    ]);

    const result = await runHealthCheck('S1');
    expect(result.ready).toBe(true);
    expect(result.critical).toEqual([]);
    expect(result.warnings).toEqual([]);
  });

  it('returns PHONE_PENDING critical for Coexistence in PENDING', async () => {
    vi.mocked(db.shop.findUnique).mockResolvedValue(mockShop({ coexistenceMode: true }));
    vi.mocked(graph.verifyToken).mockResolvedValue({ id: 'me' });
    vi.mocked(graph.getPhoneNumberStatus).mockResolvedValue({
      id: 'P1', display_phone_number: '+1', verified_name: 'X',
      status: 'PENDING', platform_type: 'NOT_APPLICABLE',
    });
    vi.mocked(graph.getWabaInfo).mockResolvedValue({
      id: 'WABA1', name: 'X',
      business_verification_status: 'verified',
      primary_funding_id: 'F1',
      health_status: { can_send_message: 'AVAILABLE' },
    });
    vi.mocked(graph.getSubscribedApps).mockResolvedValue([
      {
        whatsapp_business_api_data: { id: META_APP_ID, name: 'DomiCita' },
        subscribed_fields: ['messages', 'smb_message_echoes', 'message_template_status_update'],
      },
    ]);

    const result = await runHealthCheck('S1');
    expect(result.ready).toBe(false);
    expect(result.critical.map(c => c.code)).toContain('PHONE_PENDING');
  });

  it('returns NO_PAYMENT and NOT_VERIFIED as warnings', async () => {
    vi.mocked(db.shop.findUnique).mockResolvedValue(mockShop());
    vi.mocked(graph.verifyToken).mockResolvedValue({ id: 'me' });
    vi.mocked(graph.getPhoneNumberStatus).mockResolvedValue({
      id: 'P1', display_phone_number: '+1', verified_name: 'X',
      status: 'CONNECTED', platform_type: 'CLOUD_API',
    });
    vi.mocked(graph.getWabaInfo).mockResolvedValue({
      id: 'WABA1', name: 'X',
      business_verification_status: 'not_verified',
      primary_funding_id: undefined,
      health_status: { can_send_message: 'BLOCKED', entities: [
        { entity_type: 'WABA', id: 'WABA1', can_send_message: 'BLOCKED', errors: [{ error_code: 141006, error_description: 'payment' }] },
        { entity_type: 'BUSINESS', id: 'B1', can_send_message: 'LIMITED', errors: [{ error_code: 141010, error_description: 'verify' }] },
      ] },
    });
    vi.mocked(graph.getSubscribedApps).mockResolvedValue([
      {
        whatsapp_business_api_data: { id: META_APP_ID, name: 'DomiCita' },
        subscribed_fields: ['messages', 'message_template_status_update'],
      },
    ]);

    const result = await runHealthCheck('S1');
    expect(result.ready).toBe(true); // can receive even if blocked outbound
    expect(result.canSend).toBe(false);
    const codes = result.warnings.map(w => w.code);
    expect(codes).toContain('NO_PAYMENT');
    expect(codes).toContain('NOT_VERIFIED');
  });

  it('returns SUBSCRIPTION_LOST recoverable when our app missing', async () => {
    vi.mocked(db.shop.findUnique).mockResolvedValue(mockShop());
    vi.mocked(graph.verifyToken).mockResolvedValue({ id: 'me' });
    vi.mocked(graph.getPhoneNumberStatus).mockResolvedValue({
      id: 'P1', display_phone_number: '+1', verified_name: 'X',
      status: 'CONNECTED', platform_type: 'CLOUD_API',
    });
    vi.mocked(graph.getWabaInfo).mockResolvedValue({
      id: 'WABA1', name: 'X',
      business_verification_status: 'verified', primary_funding_id: 'F1',
      health_status: { can_send_message: 'AVAILABLE' },
    });
    vi.mocked(graph.getSubscribedApps).mockResolvedValue([]);

    const result = await runHealthCheck('S1');
    expect(result.recoverable.map(i => i.code)).toContain('SUBSCRIPTION_LOST');
  });

  it('returns SUBSCRIPTION_FIELDS_INCOMPLETE for Coexistence missing smb_message_echoes', async () => {
    vi.mocked(db.shop.findUnique).mockResolvedValue(mockShop({ coexistenceMode: true }));
    vi.mocked(graph.verifyToken).mockResolvedValue({ id: 'me' });
    vi.mocked(graph.getPhoneNumberStatus).mockResolvedValue({
      id: 'P1', display_phone_number: '+1', verified_name: 'X',
      status: 'CONNECTED', platform_type: 'CLOUD_API',
    });
    vi.mocked(graph.getWabaInfo).mockResolvedValue({
      id: 'WABA1', name: 'X',
      business_verification_status: 'verified', primary_funding_id: 'F1',
      health_status: { can_send_message: 'AVAILABLE' },
    });
    vi.mocked(graph.getSubscribedApps).mockResolvedValue([
      {
        whatsapp_business_api_data: { id: META_APP_ID, name: 'DomiCita' },
        subscribed_fields: ['messages'],   // missing smb_message_echoes
      },
    ]);

    const result = await runHealthCheck('S1');
    expect(result.recoverable.map(i => i.code)).toContain('SUBSCRIPTION_FIELDS_INCOMPLETE');
  });

  it('returns TOKEN_INVALID critical when System User token broken', async () => {
    vi.mocked(db.shop.findUnique).mockResolvedValue(mockShop());
    vi.mocked(graph.verifyToken).mockRejectedValue(new Error('invalid token'));

    const result = await runHealthCheck('S1');
    expect(result.ready).toBe(false);
    expect(result.critical.map(c => c.code)).toContain('TOKEN_INVALID');
  });

  it('returns NO_PHONE_NUMBER when shop has no metaPhoneNumberId', async () => {
    vi.mocked(db.shop.findUnique).mockResolvedValue(mockShop({ metaPhoneNumberId: null }));

    const result = await runHealthCheck('S1');
    expect(result.ready).toBe(false);
    expect(result.critical.map(c => c.code)).toContain('NO_PHONE_NUMBER');
  });
});
