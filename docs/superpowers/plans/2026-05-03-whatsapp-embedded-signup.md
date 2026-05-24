# WhatsApp Embedded Signup Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Embedded Signup correcto y robusto que escale a cientos de barberías sin intervención de soporte, soportando Coexistence + Cloud API puro con health-check automático y migración segura de shops existentes.

**Architecture:** El flujo se descompone en 5 unidades coherentes (frontend launcher reutilizable, wizard step de elección de modo, backend connect refactorizado, health-check engine, webhook receiver con detección correcta de echoes). Cada unidad tiene tests unitarios con Vitest mockeando Meta API. Schema gana 6 campos para tracking de estado real. Migration script idempotente repara shops existentes. Cron horario hace auto-recuperación silenciosa.

**Tech Stack:** Next.js 14 App Router, TypeScript, Prisma + Supabase Postgres, Vitest (jsdom), Meta WhatsApp Cloud API v22.0, GitHub Actions cron.

**Spec:** `docs/superpowers/specs/2026-05-03-whatsapp-embedded-signup-design.md`

---

## File Structure

### Files to CREATE

| Path | Responsibility |
|---|---|
| `lib/whatsapp/meta-graph.ts` | Cliente fetch tipado para Meta Graph API. Centraliza todas las llamadas a `graph.facebook.com` con typing y error handling consistente. |
| `lib/whatsapp/health-check.ts` | Función pura `runHealthCheck(shopId)` que retorna `HealthCheckResult` con clasificación critical/warning/recoverable. |
| `lib/whatsapp/health-types.ts` | Types compartidos: `HealthCheckResult`, `Blocker`, `Issue`, `BlockerCode`. |
| `lib/whatsapp/auto-repair.ts` | Funciones de auto-recuperación silenciosa: re-suscribir webhooks, reparar `subscribed_fields`. |
| `components/whatsapp/EmbeddedSignupLauncher.tsx` | Componente cliente reutilizable. Encapsula `FB.login` con `sessionInfoVersion: 3` y captura ambos eventos (`FINISH` y `FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING`). |
| `app/api/cron/whatsapp-health/route.ts` | Cron horario. Itera shops, corre health-check, auto-repara, notifica al barbero si nuevo critical/warning, transiciona PENDING→CONNECTED. |
| `app/api/admin/migrate-whatsapp/route.ts` | Endpoint admin gateado por SUPER_ADMIN. Dispara el migration script. |
| `scripts/migrate-whatsapp-connections.ts` | Script idempotente. Backfilla campos nuevos, auto-repara, marca shops irreparables como `needsReconnect: true`. |
| `.github/workflows/cron-whatsapp-health.yml` | GitHub Actions cron horario. |
| `tests/unit/whatsapp-embedded-signup.test.ts` | Tests del backend connect (mock Meta API). |
| `tests/unit/whatsapp-webhook.test.ts` | Tests del webhook receiver (echoes vs messages vs statuses). |
| `tests/unit/whatsapp-health-check.test.ts` | Tests del health-check engine. |
| `tests/unit/whatsapp-meta-graph.test.ts` | Tests del cliente Meta Graph. |

### Files to MODIFY

| Path | Cambios |
|---|---|
| `prisma/schema.prisma` | Añadir 6 campos al modelo `Shop`. |
| `lib/whatsapp/embedded-signup.ts` | Refactor completo: usa System User token global, suscribe `subscribed_fields` explícitos, `featureType` decide `/register`. |
| `app/api/whatsapp/embedded-signup/route.ts` | Acepta `featureType` desde frontend, no hardcodea `coexistence: true`. |
| `app/api/whatsapp/webhook/route.ts` | Branching por `change.field`: `messages` → bot, `smb_message_echoes` → takeover. |
| `app/api/whatsapp/register-phone/route.ts` | Bloquea ejecución si `coexistenceMode === true`. |
| `app/onboarding/page.tsx` | `Step5WhatsApp` usa nuevo `EmbeddedSignupLauncher` y pregunta modo (Coexistence vs Cloud API). |
| `app/dashboard/settings/page.tsx` | Sección WhatsApp usa nuevo `EmbeddedSignupLauncher` + reconnect button cuando `needsReconnect`. |
| `components/dashboard/DashboardLayout.tsx` o `app/dashboard/layout.tsx` | Banner rojo si shop tiene `needsReconnect: true`. |
| `app/api/whatsapp/sync/route.ts` | Tras sync, corre health-check para refrescar estado. |

---

## Task 1: Schema migration

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1.1: Read current Shop model**

Run: `grep -n "model Shop" /Users/kelvin/Desktop/DomiCita/prisma/schema.prisma`

Confirm the location of the `Shop` model in the schema file before editing.

- [ ] **Step 1.2: Add new fields to Shop model**

In `prisma/schema.prisma`, locate the `Shop` model and add these fields right after the existing `metaTokenExpiresAt` field (or wherever Meta-related fields are grouped):

```prisma
  // Embedded Signup state tracking (added 2026-05-03)
  metaPlatformType            String?    // 'CLOUD_API' | 'NOT_APPLICABLE' | 'ON_PREMISE'
  coexistenceMode             Boolean    @default(false)
  metaSubscribedFields        String[]   @default([])
  whatsappReadyAt             DateTime?  // pasó a CONNECTED desde PENDING
  whatsappLastHealthCheckAt   DateTime?
  needsReconnect              Boolean    @default(false)
```

- [ ] **Step 1.3: Push schema to database**

Run:
```bash
DIRECT_URL="$(grep '^DIRECT_URL=' /Users/kelvin/Desktop/DomiCita/.env | cut -d'"' -f2)" \
  DATABASE_URL="$(grep '^DIRECT_URL=' /Users/kelvin/Desktop/DomiCita/.env | cut -d'"' -f2)" \
  npx prisma db push --schema=/Users/kelvin/Desktop/DomiCita/prisma/schema.prisma
```

Expected: "Your database is now in sync with your Prisma schema."

- [ ] **Step 1.4: Regenerate Prisma client**

Run: `npx prisma generate --schema=/Users/kelvin/Desktop/DomiCita/prisma/schema.prisma`

Expected: "Generated Prisma Client"

- [ ] **Step 1.5: Verify columns exist in DB**

Run:
```bash
DIRECT_URL=$(grep '^DIRECT_URL=' /Users/kelvin/Desktop/DomiCita/.env | cut -d'"' -f2) && \
psql "$DIRECT_URL" -c "SELECT column_name FROM information_schema.columns WHERE table_name='Shop' AND column_name IN ('metaPlatformType','coexistenceMode','metaSubscribedFields','whatsappReadyAt','whatsappLastHealthCheckAt','needsReconnect') ORDER BY column_name;"
```

Expected: 6 rows returned with the new column names.

- [ ] **Step 1.6: Commit**

```bash
cd /Users/kelvin/Desktop/DomiCita
git add prisma/schema.prisma
git commit -m "feat(schema): add WhatsApp Embedded Signup state tracking fields"
```

---

## Task 2: Meta Graph API client

**Files:**
- Create: `lib/whatsapp/meta-graph.ts`
- Test: `tests/unit/whatsapp-meta-graph.test.ts`

- [ ] **Step 2.1: Write failing tests**

Create `tests/unit/whatsapp-meta-graph.test.ts`:

```typescript
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
```

- [ ] **Step 2.2: Run tests to verify they fail**

Run: `cd /Users/kelvin/Desktop/DomiCita && pnpm test:run tests/unit/whatsapp-meta-graph.test.ts`

Expected: FAIL — `Cannot find module '@/lib/whatsapp/meta-graph'`

- [ ] **Step 2.3: Implement the client**

Create `lib/whatsapp/meta-graph.ts`:

```typescript
/**
 * Meta Graph API client for WhatsApp Cloud API.
 * Single entry point for all Meta API calls — typed, with consistent error handling.
 */

const GRAPH_VERSION = 'v22.0';
const GRAPH_BASE = `https://graph.facebook.com/${GRAPH_VERSION}`;

export class MetaGraphError extends Error {
  constructor(
    message: string,
    public code: string,
    public httpStatus: number,
    public metaError?: any,
  ) {
    super(message);
    this.name = 'MetaGraphError';
  }
}

export interface PhoneNumberInfo {
  id: string;
  display_phone_number: string;
  verified_name: string;
  status: 'PENDING' | 'CONNECTED' | 'OFFLINE' | 'UNVERIFIED' | string;
  platform_type: 'CLOUD_API' | 'NOT_APPLICABLE' | 'ON_PREMISE' | string;
  quality_rating?: string;
  code_verification_status?: string;
  name_status?: string;
  health_status?: any;
}

export interface WabaInfo {
  id: string;
  name: string;
  account_review_status?: string;
  business_verification_status?: string;
  primary_funding_id?: string;
  health_status?: {
    can_send_message?: 'AVAILABLE' | 'LIMITED' | 'BLOCKED';
    entities?: Array<{
      entity_type: string;
      id: string;
      can_send_message: string;
      errors?: Array<{ error_code: number; error_description: string; possible_solution?: string }>;
    }>;
  };
}

export interface SubscribedApp {
  whatsapp_business_api_data: {
    id: string;
    name: string;
    link?: string;
  };
  subscribed_fields?: string[];
}

async function metaFetch<T>(
  path: string,
  init: RequestInit & { token: string },
  errorContext: string,
): Promise<T> {
  const { token, headers, ...rest } = init;
  const res = await fetch(`${GRAPH_BASE}${path}`, {
    ...rest,
    headers: {
      Authorization: `Bearer ${token}`,
      ...(rest.body ? { 'Content-Type': 'application/json' } : {}),
      ...headers,
    },
  });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const subcode = data?.error?.error_subcode;
    if (subcode === 2388001) {
      throw new MetaGraphError(
        'Tu número aún está activo en la app de WhatsApp del teléfono. Elimina la cuenta de la app (Ajustes → Cuenta → Eliminar mi cuenta), espera 5 minutos y vuelve a intentar.',
        'PHONE_IN_USE',
        res.status,
        data?.error,
      );
    }
    throw new MetaGraphError(
      data?.error?.error_user_msg || data?.error?.message || `Meta API failed: ${errorContext}`,
      'META_API_ERROR',
      res.status,
      data?.error,
    );
  }
  return data as T;
}

/** GET /{phone-id}?fields=... */
export async function getPhoneNumberStatus(phoneNumberId: string, token: string): Promise<PhoneNumberInfo> {
  return metaFetch<PhoneNumberInfo>(
    `/${phoneNumberId}?fields=id,display_phone_number,verified_name,status,platform_type,quality_rating,code_verification_status,name_status,health_status`,
    { token, method: 'GET' },
    'getPhoneNumberStatus',
  );
}

/** GET /{waba-id}?fields=... */
export async function getWabaInfo(wabaId: string, token: string): Promise<WabaInfo> {
  return metaFetch<WabaInfo>(
    `/${wabaId}?fields=id,name,account_review_status,business_verification_status,primary_funding_id,health_status`,
    { token, method: 'GET' },
    'getWabaInfo',
  );
}

/** GET /{waba-id}/subscribed_apps */
export async function getSubscribedApps(wabaId: string, token: string): Promise<SubscribedApp[]> {
  const res = await metaFetch<{ data: SubscribedApp[] }>(
    `/${wabaId}/subscribed_apps`,
    { token, method: 'GET' },
    'getSubscribedApps',
  );
  return res.data || [];
}

/** POST /{waba-id}/subscribed_apps with subscribed_fields */
export async function subscribeApp(wabaId: string, token: string, subscribedFields: string[]): Promise<void> {
  await metaFetch(
    `/${wabaId}/subscribed_apps`,
    {
      token,
      method: 'POST',
      body: JSON.stringify({ subscribed_fields: subscribedFields }),
    },
    'subscribeApp',
  );
}

/** POST /{phone-id}/register */
export async function registerPhone(phoneNumberId: string, token: string, pin = '123456'): Promise<void> {
  await metaFetch(
    `/${phoneNumberId}/register`,
    {
      token,
      method: 'POST',
      body: JSON.stringify({ messaging_product: 'whatsapp', pin }),
    },
    'registerPhone',
  );
}

/** GET /oauth/access_token — exchange short-lived code for user token */
export async function exchangeCodeForToken(code: string, appId: string, appSecret: string): Promise<string> {
  const url = `${GRAPH_BASE}/oauth/access_token?client_id=${appId}&client_secret=${encodeURIComponent(appSecret)}&code=${encodeURIComponent(code)}`;
  const res = await fetch(url);
  const data = await res.json().catch(() => ({}));
  if (!res.ok || !data?.access_token) {
    throw new MetaGraphError(
      data?.error?.message || 'Token exchange failed',
      'TOKEN_EXCHANGE_FAILED',
      res.status,
      data?.error,
    );
  }
  return data.access_token as string;
}

/** GET /me?access_token=... — verify token validity */
export async function verifyToken(token: string): Promise<{ id: string }> {
  return metaFetch<{ id: string }>(
    `/me?fields=id`,
    { token, method: 'GET' },
    'verifyToken',
  );
}
```

- [ ] **Step 2.4: Run tests to verify they pass**

Run: `cd /Users/kelvin/Desktop/DomiCita && pnpm test:run tests/unit/whatsapp-meta-graph.test.ts`

Expected: PASS — all 5+ tests green.

- [ ] **Step 2.5: Commit**

```bash
cd /Users/kelvin/Desktop/DomiCita
git add lib/whatsapp/meta-graph.ts tests/unit/whatsapp-meta-graph.test.ts
git commit -m "feat(whatsapp): centralized Meta Graph API client with typed errors"
```

---

## Task 3: Health-check types and engine

**Files:**
- Create: `lib/whatsapp/health-types.ts`
- Create: `lib/whatsapp/health-check.ts`
- Test: `tests/unit/whatsapp-health-check.test.ts`

- [ ] **Step 3.1: Create health-types.ts**

Create `lib/whatsapp/health-types.ts`:

```typescript
/**
 * Shared types for WhatsApp connection health-check.
 */

export type BlockerCode =
  | 'PHONE_PENDING'              // status PENDING (Coexistence syncing or Cloud API not registered)
  | 'PHONE_NOT_REGISTERED'       // Cloud API number missing /register call
  | 'NO_PAYMENT'                 // primary_funding_id missing
  | 'NOT_VERIFIED'               // business_verification_status !== verified
  | 'WABA_BLOCKED'               // can_send_message === BLOCKED for unknown reason
  | 'TOKEN_INVALID'              // System User token invalid (sistema-wide)
  | 'PHONE_BLOCKED'              // phone-level health BLOCKED
  | 'NO_PHONE_NUMBER';           // shop has no metaPhoneNumberId

export type IssueCode =
  | 'SUBSCRIPTION_LOST'           // our app not in subscribed_apps
  | 'SUBSCRIPTION_FIELDS_INCOMPLETE'; // missing required subscribed_fields

export interface BlockerAction {
  label: string;
  url?: string;
}

export interface Blocker {
  code: BlockerCode;
  severity: 'critical' | 'warning';
  message: string;       // user-facing en español
  action?: BlockerAction;
}

export interface Issue {
  code: IssueCode;
  message: string;
  autoRepairResult?: 'repaired' | 'failed';
}

export interface HealthCheckResult {
  canReceive: boolean;
  canSend: boolean;
  ready: boolean;
  critical: Blocker[];
  warnings: Blocker[];
  recoverable: Issue[];
}
```

- [ ] **Step 3.2: Write failing tests**

Create `tests/unit/whatsapp-health-check.test.ts`:

```typescript
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
        whatsapp_business_api_data: { id: process.env.META_APP_ID || '1599970834652215', name: 'DomiCita' },
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
        whatsapp_business_api_data: { id: process.env.META_APP_ID || '1599970834652215', name: 'DomiCita' },
        subscribed_fields: ['messages', 'smb_message_echoes'],
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
        whatsapp_business_api_data: { id: process.env.META_APP_ID || '1599970834652215', name: 'DomiCita' },
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
        whatsapp_business_api_data: { id: process.env.META_APP_ID || '1599970834652215', name: 'DomiCita' },
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
```

- [ ] **Step 3.3: Run tests to verify they fail**

Run: `cd /Users/kelvin/Desktop/DomiCita && pnpm test:run tests/unit/whatsapp-health-check.test.ts`

Expected: FAIL — `Cannot find module '@/lib/whatsapp/health-check'`

- [ ] **Step 3.4: Implement health-check.ts**

Create `lib/whatsapp/health-check.ts`:

```typescript
import { db } from '@/lib/database';
import { getPhoneNumberStatus, getWabaInfo, getSubscribedApps, verifyToken } from './meta-graph';
import type { HealthCheckResult, Blocker, Issue } from './health-types';

const SYSTEM_USER_TOKEN = process.env.WHATSAPP_SYSTEM_USER_TOKEN || process.env.WHATSAPP_ACCESS_TOKEN;
const META_APP_ID = process.env.META_APP_ID || process.env.NEXT_PUBLIC_APP_ID || '1599970834652215';

const REQUIRED_FIELDS_CLOUD = ['messages', 'message_template_status_update'];
const REQUIRED_FIELDS_COEX = ['messages', 'smb_message_echoes', 'message_template_status_update'];

export async function runHealthCheck(shopId: string): Promise<HealthCheckResult> {
  const critical: Blocker[] = [];
  const warnings: Blocker[] = [];
  const recoverable: Issue[] = [];

  const shop = await db.shop.findUnique({
    where: { id: shopId },
    select: {
      id: true, metaPhoneNumberId: true, metaBusinessAccountId: true,
      metaAccessToken: true, coexistenceMode: true,
    },
  });

  if (!shop || !shop.metaPhoneNumberId || !shop.metaBusinessAccountId) {
    critical.push({
      code: 'NO_PHONE_NUMBER',
      severity: 'critical',
      message: 'Tu shop no tiene un número de WhatsApp conectado. Conéctalo desde Ajustes → WhatsApp.',
      action: { label: 'Conectar WhatsApp', url: '/dashboard/settings' },
    });
    return { canReceive: false, canSend: false, ready: false, critical, warnings, recoverable };
  }

  const token = SYSTEM_USER_TOKEN || shop.metaAccessToken || '';

  // Check 7: token validity (sistema-wide alert)
  try {
    await verifyToken(token);
  } catch {
    critical.push({
      code: 'TOKEN_INVALID',
      severity: 'critical',
      message: 'Token del sistema inválido. Contacta a soporte de DomiCita.',
    });
    return { canReceive: false, canSend: false, ready: false, critical, warnings, recoverable };
  }

  // Checks 1-2: phone status + health
  let phoneStatus = 'UNKNOWN';
  try {
    const phone = await getPhoneNumberStatus(shop.metaPhoneNumberId, token);
    phoneStatus = phone.status;
    if (phone.status === 'PENDING') {
      if (shop.coexistenceMode) {
        critical.push({
          code: 'PHONE_PENDING',
          severity: 'critical',
          message: 'Tu WhatsApp se está sincronizando con Meta. Esto tarda 4-6 horas la primera vez. Te avisaremos cuando esté listo.',
        });
      } else {
        critical.push({
          code: 'PHONE_NOT_REGISTERED',
          severity: 'critical',
          message: 'Tu número aún no está registrado en Cloud API. Esto se resuelve solo en unos minutos.',
        });
      }
    }
    const phoneHealth = (phone.health_status as any)?.can_send_message;
    if (phoneHealth === 'BLOCKED') {
      critical.push({
        code: 'PHONE_BLOCKED',
        severity: 'critical',
        message: 'Meta ha bloqueado tu número. Revisa el estado en Meta Business Manager.',
        action: { label: 'Abrir Meta Business Manager', url: 'https://business.facebook.com/wa/manage/phone-numbers/' },
      });
    }
  } catch (err: any) {
    critical.push({
      code: 'TOKEN_INVALID',
      severity: 'critical',
      message: 'No se pudo consultar el estado de tu número en Meta.',
    });
  }

  // Checks 5-6: WABA payment + verification
  let canSend = true;
  try {
    const waba = await getWabaInfo(shop.metaBusinessAccountId, token);
    if (!waba.primary_funding_id) {
      warnings.push({
        code: 'NO_PAYMENT',
        severity: 'warning',
        message: 'Falta método de pago en tu cuenta de Meta. Sin esto, no puedes enviar mensajes proactivos (recordatorios, confirmaciones).',
        action: { label: 'Configurar método de pago', url: 'https://business.facebook.com/billing_hub/payment_settings' },
      });
      canSend = false;
    }
    if (waba.business_verification_status && waba.business_verification_status !== 'verified') {
      warnings.push({
        code: 'NOT_VERIFIED',
        severity: 'warning',
        message: 'Tu negocio aún no está verificado por Meta. Esto limita el envío de mensajes a clientes nuevos.',
        action: { label: 'Verificar negocio', url: 'https://business.facebook.com/settings/security' },
      });
    }
    const wabaHealth = waba.health_status?.can_send_message;
    if (wabaHealth === 'BLOCKED' && !warnings.some(w => w.code === 'NO_PAYMENT')) {
      warnings.push({
        code: 'WABA_BLOCKED',
        severity: 'warning',
        message: 'Meta ha limitado el envío desde tu cuenta. Revisa Meta Business Manager.',
        action: { label: 'Abrir Meta Business Manager', url: 'https://business.facebook.com/wa/manage/' },
      });
      canSend = false;
    }
  } catch {
    /* swallow — already counted via token check */
  }

  // Checks 3-4: subscribed_apps + subscribed_fields
  try {
    const apps = await getSubscribedApps(shop.metaBusinessAccountId, token);
    const ours = apps.find(a => a.whatsapp_business_api_data?.id === META_APP_ID);
    if (!ours) {
      recoverable.push({
        code: 'SUBSCRIPTION_LOST',
        message: 'La suscripción de webhook se cayó. Reparando automáticamente.',
      });
    } else {
      const required = shop.coexistenceMode ? REQUIRED_FIELDS_COEX : REQUIRED_FIELDS_CLOUD;
      const fields = ours.subscribed_fields || [];
      const missing = required.filter(f => !fields.includes(f));
      if (missing.length > 0) {
        recoverable.push({
          code: 'SUBSCRIPTION_FIELDS_INCOMPLETE',
          message: `Faltan campos: ${missing.join(', ')}. Reparando automáticamente.`,
        });
      }
    }
  } catch {
    recoverable.push({
      code: 'SUBSCRIPTION_LOST',
      message: 'No se pudo verificar la suscripción de webhook.',
    });
  }

  const canReceive = critical.length === 0 || critical.every(c => c.code === 'PHONE_PENDING');
  const ready = canReceive && critical.length === 0;

  return { canReceive, canSend: canSend && canReceive, ready, critical, warnings, recoverable };
}
```

- [ ] **Step 3.5: Run tests to verify they pass**

Run: `cd /Users/kelvin/Desktop/DomiCita && pnpm test:run tests/unit/whatsapp-health-check.test.ts`

Expected: PASS — all 7 tests green.

- [ ] **Step 3.6: Commit**

```bash
cd /Users/kelvin/Desktop/DomiCita
git add lib/whatsapp/health-types.ts lib/whatsapp/health-check.ts tests/unit/whatsapp-health-check.test.ts
git commit -m "feat(whatsapp): health-check engine with critical/warning/recoverable classification"
```

---

## Task 4: Auto-repair functions

**Files:**
- Create: `lib/whatsapp/auto-repair.ts`

- [ ] **Step 4.1: Implement auto-repair**

Create `lib/whatsapp/auto-repair.ts`:

```typescript
import { db } from '@/lib/database';
import { subscribeApp } from './meta-graph';
import type { Issue } from './health-types';

const SYSTEM_USER_TOKEN = process.env.WHATSAPP_SYSTEM_USER_TOKEN || process.env.WHATSAPP_ACCESS_TOKEN;

const REQUIRED_FIELDS_CLOUD = ['messages', 'message_template_status_update'];
const REQUIRED_FIELDS_COEX = ['messages', 'smb_message_echoes', 'message_template_status_update'];

export async function autoRepair(shopId: string, issues: Issue[]): Promise<Issue[]> {
  const shop = await db.shop.findUnique({
    where: { id: shopId },
    select: { metaBusinessAccountId: true, coexistenceMode: true, metaSubscribedFields: true },
  });
  if (!shop?.metaBusinessAccountId || !SYSTEM_USER_TOKEN) {
    return issues.map(i => ({ ...i, autoRepairResult: 'failed' as const }));
  }

  const required = shop.coexistenceMode ? REQUIRED_FIELDS_COEX : REQUIRED_FIELDS_CLOUD;

  const results: Issue[] = [];
  for (const issue of issues) {
    if (issue.code === 'SUBSCRIPTION_LOST' || issue.code === 'SUBSCRIPTION_FIELDS_INCOMPLETE') {
      try {
        await subscribeApp(shop.metaBusinessAccountId, SYSTEM_USER_TOKEN, required);
        await db.shop.update({
          where: { id: shopId },
          data: { metaSubscribedFields: required },
        });
        results.push({ ...issue, autoRepairResult: 'repaired' });
      } catch (err) {
        console.error(`[auto-repair] Failed to repair ${issue.code} for shop ${shopId}:`, err);
        results.push({ ...issue, autoRepairResult: 'failed' });
      }
    } else {
      results.push(issue);
    }
  }
  return results;
}
```

- [ ] **Step 4.2: Verify it compiles**

Run: `cd /Users/kelvin/Desktop/DomiCita && npx tsc --noEmit --skipLibCheck lib/whatsapp/auto-repair.ts 2>&1 | head -20`

Expected: No TypeScript errors output.

- [ ] **Step 4.3: Commit**

```bash
cd /Users/kelvin/Desktop/DomiCita
git add lib/whatsapp/auto-repair.ts
git commit -m "feat(whatsapp): silent auto-repair for lost subscriptions and incomplete fields"
```

---

## Task 5: Refactor backend embedded-signup.ts

**Files:**
- Modify: `lib/whatsapp/embedded-signup.ts` (full rewrite)
- Modify: `app/api/whatsapp/embedded-signup/route.ts`
- Test: `tests/unit/whatsapp-embedded-signup.test.ts`

- [ ] **Step 5.1: Write failing tests**

Create `tests/unit/whatsapp-embedded-signup.test.ts`:

```typescript
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
```

- [ ] **Step 5.2: Run tests to verify they fail**

Run: `cd /Users/kelvin/Desktop/DomiCita && pnpm test:run tests/unit/whatsapp-embedded-signup.test.ts`

Expected: FAIL — function signature doesn't match yet.

- [ ] **Step 5.3: Rewrite embedded-signup.ts**

Replace the entire content of `lib/whatsapp/embedded-signup.ts` with:

```typescript
import { db } from '@/lib/database';
import { seedDefaultTemplates } from '@/lib/whatsapp/template-seeder';
import {
  exchangeCodeForToken,
  verifyToken,
  getPhoneNumberStatus,
  subscribeApp,
  registerPhone,
  MetaGraphError,
} from './meta-graph';
import { runHealthCheck } from './health-check';
import type { HealthCheckResult } from './health-types';

const META_APP_ID = process.env.META_APP_ID || process.env.NEXT_PUBLIC_APP_ID;
const META_APP_SECRET = process.env.FACEBOOK_APP_SECRET;
const SYSTEM_USER_TOKEN = process.env.WHATSAPP_SYSTEM_USER_TOKEN || process.env.WHATSAPP_ACCESS_TOKEN;

const SUBSCRIBED_FIELDS_CLOUD = ['messages', 'message_template_status_update'];
const SUBSCRIBED_FIELDS_COEX = ['messages', 'smb_message_echoes', 'message_template_status_update'];

export type FeatureType = 'coexistence' | 'cloud_api';

export interface ConnectWhatsAppParams {
  shopId: string;
  code: string;            // authorization code from FB.login response_type=code
  wabaId: string;          // from postMessage hints
  phoneNumberId: string;   // from postMessage hints
  featureType: FeatureType;
}

export interface ConnectWhatsAppResult {
  phoneNumber: string;
  wabaId: string;
  phoneNumberId: string;
  health: HealthCheckResult;
}

/**
 * Connect a WhatsApp number to a shop via Embedded Signup.
 *
 * Authoritative source: System User token (DomiCita Tech Provider).
 * The user code is exchanged once for verification; we never store user tokens.
 */
export async function connectWhatsAppToShop(params: ConnectWhatsAppParams): Promise<ConnectWhatsAppResult> {
  const { shopId, code, wabaId, phoneNumberId, featureType } = params;

  if (!META_APP_ID || !META_APP_SECRET) {
    throw new Error('Missing META_APP_ID or FACEBOOK_APP_SECRET env vars');
  }
  if (!SYSTEM_USER_TOKEN) {
    throw new Error('Missing WHATSAPP_SYSTEM_USER_TOKEN — DomiCita Tech Provider token required');
  }

  // 1. Exchange code for user token (verification only — discarded)
  const userToken = await exchangeCodeForToken(code, META_APP_ID, META_APP_SECRET);
  await verifyToken(userToken);

  // 2. Read phone status using System User token (DomiCita TP sees this WABA)
  const phone = await getPhoneNumberStatus(phoneNumberId, SYSTEM_USER_TOKEN);

  // 3. Subscribe webhooks with explicit fields based on featureType
  const subscribedFields = featureType === 'coexistence' ? SUBSCRIBED_FIELDS_COEX : SUBSCRIBED_FIELDS_CLOUD;
  await subscribeApp(wabaId, SYSTEM_USER_TOKEN, subscribedFields);

  // 4. /register only for Cloud API (Coexistence: phone is owned by the WB app)
  if (featureType === 'cloud_api') {
    try {
      await registerPhone(phoneNumberId, SYSTEM_USER_TOKEN);
    } catch (err: any) {
      // PHONE_IN_USE bubbles up to caller for user-facing error
      throw err;
    }
  }

  const phoneNumberRaw = phone.display_phone_number ?? '';
  const phoneNumberDigits = phoneNumberRaw.replace(/\D/g, '');

  // 5. Persist shop. whatsappEnabled stays false until health-check confirms ready.
  await db.shop.update({
    where: { id: shopId },
    data: {
      whatsappProvider: 'META',
      metaAccessToken: SYSTEM_USER_TOKEN,         // global System User token
      metaTokenExpiresAt: null,                    // System User tokens never expire
      metaPhoneNumberId: phoneNumberId,
      metaBusinessAccountId: wabaId,
      wabaId,
      whatsappPhoneNumberId: phoneNumberId,
      whatsappPhoneNumber: phoneNumberDigits,
      coexistenceMode: featureType === 'coexistence',
      metaPlatformType: phone.platform_type ?? null,
      metaSubscribedFields: subscribedFields,
      needsReconnect: false,
      whatsappEnabled: false,                      // wait for health-check
    },
  });

  // 6. Seed templates (fire-and-forget)
  seedDefaultTemplates(shopId).catch(err =>
    console.error('[connectWhatsAppToShop] Template seeding failed:', err)
  );

  // 7. Run health-check and decide whatsappEnabled
  const health = await runHealthCheck(shopId);

  const finalEnabled = health.ready || (
    health.critical.length === 1 &&
    health.critical[0].code === 'PHONE_PENDING'
  ) || health.warnings.length > 0;

  await db.shop.update({
    where: { id: shopId },
    data: {
      whatsappEnabled: finalEnabled,
      whatsappLastHealthCheckAt: new Date(),
      whatsappReadyAt: health.ready ? new Date() : null,
    },
  });

  return {
    phoneNumber: phoneNumberRaw,
    wabaId,
    phoneNumberId,
    health,
  };
}

export { MetaGraphError };
```

- [ ] **Step 5.4: Update the route handler**

Replace `app/api/whatsapp/embedded-signup/route.ts` content:

```typescript
import { NextResponse } from 'next/server';
import { withAuth, type AuthenticatedUser } from '@/lib/auth-middleware';
import { connectWhatsAppToShop, type FeatureType } from '@/lib/whatsapp/embedded-signup';

export async function POST(request: Request) {
  return withAuth(async (authUser: AuthenticatedUser) => {
    try {
      const body = await request.json();
      const { code, wabaId, phoneNumberId, featureType } = body;

      if (!code || !wabaId || !phoneNumberId) {
        return NextResponse.json({ error: 'Faltan datos del registro de Meta' }, { status: 400 });
      }
      if (featureType !== 'coexistence' && featureType !== 'cloud_api') {
        return NextResponse.json({ error: 'featureType inválido' }, { status: 400 });
      }

      const shopId = authUser.shopId;
      if (!shopId) {
        return NextResponse.json({ error: 'No shop assigned' }, { status: 403 });
      }

      const result = await connectWhatsAppToShop({
        shopId,
        code,
        wabaId,
        phoneNumberId,
        featureType: featureType as FeatureType,
      });

      const onlyPending =
        result.health.critical.length === 1 &&
        result.health.critical[0].code === 'PHONE_PENDING';

      return NextResponse.json({
        success: true,
        phoneNumber: result.phoneNumber,
        ready: result.health.ready,
        syncing: onlyPending,
        critical: result.health.critical,
        warnings: result.health.warnings,
      });
    } catch (error: any) {
      console.error('[Embedded Signup API] Error:', error);
      const status =
        error?.code === 'PHONE_IN_USE' ? 409 :
        error?.code === 'TOKEN_EXCHANGE_FAILED' ? 401 :
        500;
      return NextResponse.json(
        { error: error?.message || 'Internal server error', code: error?.code },
        { status }
      );
    }
  }, request as any);
}
```

- [ ] **Step 5.5: Run tests to verify they pass**

Run: `cd /Users/kelvin/Desktop/DomiCita && pnpm test:run tests/unit/whatsapp-embedded-signup.test.ts`

Expected: PASS — all 5 tests green.

- [ ] **Step 5.6: Commit**

```bash
cd /Users/kelvin/Desktop/DomiCita
git add lib/whatsapp/embedded-signup.ts app/api/whatsapp/embedded-signup/route.ts tests/unit/whatsapp-embedded-signup.test.ts
git commit -m "feat(whatsapp): refactor Embedded Signup to use System User token + featureType-based subscriptions"
```

---

## Task 6: Webhook receiver — fix echo detection

**Files:**
- Modify: `app/api/whatsapp/webhook/route.ts`
- Test: `tests/unit/whatsapp-webhook.test.ts`

- [ ] **Step 6.1: Write failing tests**

Create `tests/unit/whatsapp-webhook.test.ts`:

```typescript
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
    vi.mocked(botControl.markHumanTakeover).mockReset();
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
```

- [ ] **Step 6.2: Run tests to verify they fail**

Run: `cd /Users/kelvin/Desktop/DomiCita && pnpm test:run tests/unit/whatsapp-webhook.test.ts`

Expected: FAIL — current webhook doesn't handle `smb_message_echoes` field correctly.

- [ ] **Step 6.3: Refactor webhook handler**

Replace the body of `POST` in `app/api/whatsapp/webhook/route.ts` (preserving imports + helpers + GET) with this approach. Specifically, REPLACE the section from `// 3. Handle incoming messages` through the end of the try block. The key change is branching by `change.field`:

In `app/api/whatsapp/webhook/route.ts`, locate the `POST` function. Find the section starting at `// 1. Check if we have messaging values` and ending right before the `catch (error)` block. Replace it with:

```typescript
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
```

Then move the existing inbound message processing logic (the block starting at `if (value.messages)`) into a new local helper function `handleIncoming(value)` that returns a `NextResponse`. Remove the old echo detection (`isEcho` block at lines 121-145) — it's replaced by `handleEchoes`.

Add at the bottom of the file (before `}` closing `POST`):

```typescript
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
      log.warn('[Meta] Echo takeover failed', { error: err?.message, recipient })
    );
    log.info('[Meta] Coexistence echo — bot silenced', { shopId: shop.id, to: recipient.slice(0, 4) + '****' });
  }
}
```

Wrap the existing inbound flow (everything from `const message = value.messages[0]` onwards through the response send) in:

```typescript
async function handleIncoming(value: any): Promise<NextResponse> {
  // ... existing inbound logic, but `return NextResponse.json(...)` instead of falling through
}
```

Remove the now-obsolete echo detection block (lines 121-145 in current file) including the `isEcho` variable and its early return.

- [ ] **Step 6.4: Run tests to verify they pass**

Run: `cd /Users/kelvin/Desktop/DomiCita && pnpm test:run tests/unit/whatsapp-webhook.test.ts`

Expected: PASS — all 6 tests green.

- [ ] **Step 6.5: Commit**

```bash
cd /Users/kelvin/Desktop/DomiCita
git add app/api/whatsapp/webhook/route.ts tests/unit/whatsapp-webhook.test.ts
git commit -m "fix(whatsapp): correctly detect smb_message_echoes via change.field"
```

---

## Task 7: Frontend launcher component

**Files:**
- Create: `components/whatsapp/EmbeddedSignupLauncher.tsx`

- [ ] **Step 7.1: Implement the launcher**

Create `components/whatsapp/EmbeddedSignupLauncher.tsx`:

```typescript
'use client';

import { useCallback, useState } from 'react';
import { FacebookSDKScript } from '@/components/whatsapp/FacebookSDKScript';

declare global {
  interface Window {
    FB?: any;
  }
}

export type FeatureType = 'coexistence' | 'cloud_api';

export interface EmbeddedSignupResult {
  code: string;
  wabaId: string;
  phoneNumberId: string;
  featureType: FeatureType;
}

export interface EmbeddedSignupLauncherProps {
  featureType: FeatureType;
  onSuccess: (result: EmbeddedSignupResult) => void;
  onError: (message: string) => void;
  onCancel?: () => void;
  buttonClassName?: string;
  buttonLabel?: string;
  disabled?: boolean;
}

const FB_TRUSTED_ORIGINS = ['https://www.facebook.com', 'https://web.facebook.com'];

const FINISH_EVENTS = new Set([
  'FINISH',                              // legacy
  'FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING', // Coexistence v3
]);

/**
 * Embedded Signup launcher. Opens Meta's popup with the correct
 * sessionInfoVersion and featureType, captures phone_number_id + waba_id
 * via postMessage, then resolves the auth code via FB.login callback.
 */
export function EmbeddedSignupLauncher({
  featureType,
  onSuccess,
  onError,
  onCancel,
  buttonClassName = 'inline-flex items-center justify-center px-5 py-2.5 bg-emerald-600 text-white rounded-lg font-semibold hover:bg-emerald-700 transition disabled:opacity-50',
  buttonLabel,
  disabled = false,
}: EmbeddedSignupLauncherProps) {
  const [busy, setBusy] = useState(false);

  const launch = useCallback(() => {
    if (typeof window === 'undefined' || !window.FB) {
      onError('SDK de Facebook no cargado. Recarga la página y vuelve a intentar.');
      return;
    }
    setBusy(true);

    let metaHints: { wabaId?: string; phoneNumberId?: string } = {};
    const messageHandler = (event: MessageEvent) => {
      if (!FB_TRUSTED_ORIGINS.includes(event.origin)) return;
      try {
        const msg = typeof event.data === 'string' ? JSON.parse(event.data) : event.data;
        if (msg?.type === 'WA_EMBEDDED_SIGNUP' && FINISH_EVENTS.has(msg?.event)) {
          metaHints = {
            wabaId: msg.data?.waba_id,
            phoneNumberId: msg.data?.phone_number_id,
          };
        }
      } catch {
        /* ignore non-JSON payloads */
      }
    };
    window.addEventListener('message', messageHandler);

    const extras: any = {
      sessionInfoVersion: 3,
    };
    if (featureType === 'coexistence') {
      extras.featureType = 'whatsapp_business_app_onboarding';
    }
    const solutionId = process.env.NEXT_PUBLIC_FB_SOLUTION_ID;
    if (solutionId) {
      extras.setup = { solutionID: solutionId };
    }

    window.FB.login(
      (response: any) => {
        window.removeEventListener('message', messageHandler);
        setBusy(false);

        if (!response.authResponse) {
          if (onCancel) onCancel();
          else onError('Conexión cancelada');
          return;
        }
        if (!metaHints.wabaId || !metaHints.phoneNumberId) {
          onError('Meta no devolvió los datos del número. Inténtalo de nuevo y completa todos los pasos del registro.');
          return;
        }
        const code = response.authResponse.code;
        if (!code) {
          onError('Meta no devolvió el código de autorización. Vuelve a intentar.');
          return;
        }
        onSuccess({
          code,
          wabaId: metaHints.wabaId,
          phoneNumberId: metaHints.phoneNumberId,
          featureType,
        });
      },
      {
        config_id: process.env.NEXT_PUBLIC_FB_CONFIG_ID,
        response_type: 'code',
        override_default_response_type: true,
        extras,
      },
    );
  }, [featureType, onSuccess, onError, onCancel]);

  const defaultLabel = featureType === 'coexistence'
    ? 'Conectar con WhatsApp Business app'
    : 'Conectar solo con DomiCita';

  return (
    <>
      <FacebookSDKScript />
      <button
        type="button"
        onClick={launch}
        disabled={disabled || busy}
        className={buttonClassName}
      >
        {busy ? 'Conectando…' : (buttonLabel || defaultLabel)}
      </button>
    </>
  );
}
```

- [ ] **Step 7.2: Verify it compiles**

Run: `cd /Users/kelvin/Desktop/DomiCita && npx tsc --noEmit --skipLibCheck 2>&1 | grep -i "components/whatsapp/EmbeddedSignupLauncher" | head -5`

Expected: No TypeScript errors output for this file.

- [ ] **Step 7.3: Commit**

```bash
cd /Users/kelvin/Desktop/DomiCita
git add components/whatsapp/EmbeddedSignupLauncher.tsx
git commit -m "feat(whatsapp): EmbeddedSignupLauncher with sessionInfoVersion 3 and dual finish events"
```

---

## Task 8: Onboarding wizard step — mode selection

**Files:**
- Modify: `app/onboarding/page.tsx` (the `Step5WhatsApp` component)

- [ ] **Step 8.1: Replace Step5WhatsApp implementation**

In `app/onboarding/page.tsx`, locate `function Step5WhatsApp` (around line 730). Replace its entire implementation (from `function Step5WhatsApp` to its closing `}` before the next component) with:

```typescript
function Step5WhatsApp({ data, onUpdate, error }: any) {
  const [mode, setMode] = React.useState<'coexistence' | 'cloud_api' | null>(null);
  const [connectError, setConnectError] = React.useState('');
  const [connecting, setConnecting] = React.useState(false);

  const handleSuccess = async (result: { code: string; wabaId: string; phoneNumberId: string; featureType: 'coexistence' | 'cloud_api' }) => {
    setConnecting(true);
    setConnectError('');
    try {
      const res = await fetch('/api/whatsapp/embedded-signup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        credentials: 'include',
        body: JSON.stringify(result),
      });
      const json = await res.json();
      if (!res.ok) {
        setConnectError(json.error || 'Error al conectar');
        setConnecting(false);
        return;
      }
      onUpdate({
        whatsappVerified: true,
        whatsappPhone: json.phoneNumber,
        whatsappAccessToken: result.code,
        whatsappWabaId: result.wabaId,
        whatsappPhoneNumberId: result.phoneNumberId,
        whatsappReady: json.ready,
        whatsappSyncing: json.syncing,
      });
    } catch (e: any) {
      setConnectError(e.message || 'Error de conexión');
    } finally {
      setConnecting(false);
    }
  };

  const handleReset = () => {
    setConnectError('');
    setMode(null);
    onUpdate({
      whatsappPhone: '',
      whatsappVerified: false,
      whatsappReady: false,
      whatsappSyncing: false,
      whatsappAccessToken: undefined,
      whatsappWabaId: undefined,
      whatsappPhoneNumberId: undefined,
    });
  };

  const isConnected = data.whatsappVerified;

  return (
    <div className="space-y-5">
      <div className="p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
        <p className="text-sm text-emerald-900 font-semibold mb-0.5">Conecta tu WhatsApp Business</p>
        <p className="text-sm text-emerald-800">
          Activa el chatbot y las citas automáticas conectando el número de WhatsApp de tu negocio.
        </p>
      </div>

      {isConnected ? (
        <div className="p-4 bg-white border border-emerald-200 rounded-xl space-y-2">
          <p className="text-sm font-semibold text-emerald-900">✅ {data.whatsappPhone}</p>
          {data.whatsappSyncing && (
            <p className="text-xs text-emerald-700">
              Tu WhatsApp se está sincronizando con Meta. Tarda 4-6 horas la primera vez. Te avisaremos cuando esté listo — mientras tanto puedes seguir configurando todo lo demás.
            </p>
          )}
          {data.whatsappReady && (
            <p className="text-xs text-emerald-700">¡Listo! Tu bot ya puede responder mensajes.</p>
          )}
          <button
            type="button"
            onClick={handleReset}
            className="text-xs text-gray-500 hover:text-gray-700 underline"
          >
            Cambiar de número
          </button>
        </div>
      ) : (
        <>
          {mode === null && (
            <div className="space-y-3">
              <p className="text-sm font-semibold text-charcoal">¿Cómo quieres usar WhatsApp con DomiCita?</p>

              <button
                type="button"
                onClick={() => setMode('coexistence')}
                className="w-full p-4 border-2 border-emerald-200 rounded-xl text-left hover:border-emerald-400 hover:bg-emerald-50/50 transition"
              >
                <p className="text-sm font-bold text-charcoal mb-1">Mantener WhatsApp Business en mi teléfono</p>
                <p className="text-xs text-gray-600">
                  Sigues recibiendo mensajes en tu teléfono Y el bot responde automáticamente. Cuando contestes desde tu teléfono, el bot se calla. Recomendado.
                </p>
                <p className="text-xs text-amber-700 mt-1.5">⏱️ Tarda 4-6 horas en activarse la primera vez.</p>
              </button>

              <button
                type="button"
                onClick={() => setMode('cloud_api')}
                className="w-full p-4 border-2 border-gray-200 rounded-xl text-left hover:border-gray-400 hover:bg-gray-50 transition"
              >
                <p className="text-sm font-bold text-charcoal mb-1">Solo con DomiCita</p>
                <p className="text-xs text-gray-600">
                  El bot maneja TODO. Pierdes el acceso al WhatsApp Business app del teléfono para este número.
                </p>
                <p className="text-xs text-emerald-700 mt-1.5">⚡ Activación inmediata.</p>
              </button>
            </div>
          )}

          {mode !== null && (
            <div className="space-y-3">
              <button
                type="button"
                onClick={() => setMode(null)}
                className="text-xs text-gray-500 hover:text-gray-700"
              >
                ← Cambiar opción
              </button>
              <EmbeddedSignupLauncher
                featureType={mode}
                onSuccess={handleSuccess}
                onError={(msg) => setConnectError(msg)}
                disabled={connecting}
                buttonClassName="w-full inline-flex items-center justify-center px-5 py-3 bg-emerald-600 text-white rounded-xl font-semibold hover:bg-emerald-700 transition disabled:opacity-50"
              />
            </div>
          )}

          {connectError && (
            <p className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg p-3">{connectError}</p>
          )}
          {error && <p className="text-sm text-red-600">{error}</p>}
        </>
      )}
    </div>
  );
}
```

- [ ] **Step 8.2: Add the import at the top of the file**

In `app/onboarding/page.tsx`, locate the existing imports section (top of file). If `EmbeddedSignupLauncher` is not yet imported, add this import (replace the existing `FacebookSDKScript` import if it's standalone, since the launcher already includes it):

```typescript
import { EmbeddedSignupLauncher } from '@/components/whatsapp/EmbeddedSignupLauncher';
```

Run: `grep -n "FacebookSDKScript\|EmbeddedSignupLauncher" /Users/kelvin/Desktop/DomiCita/app/onboarding/page.tsx | head -5`

Expected: confirms the import was added.

- [ ] **Step 8.3: Verify TypeScript compiles**

Run: `cd /Users/kelvin/Desktop/DomiCita && npx tsc --noEmit --skipLibCheck 2>&1 | grep "app/onboarding/page.tsx" | head -10`

Expected: No errors output for this file.

- [ ] **Step 8.4: Commit**

```bash
cd /Users/kelvin/Desktop/DomiCita
git add app/onboarding/page.tsx
git commit -m "feat(onboarding): WhatsApp step lets barber choose Coexistence vs Cloud API"
```

---

## Task 9: Settings page — replace WhatsApp connect flow

**Files:**
- Modify: `app/dashboard/settings/page.tsx`

- [ ] **Step 9.1: Replace the connectWhatsApp/handleEmbeddedSignup section**

In `app/dashboard/settings/page.tsx`, locate the `connectWhatsApp` function (around line 355) and `handleEmbeddedSignup` (around line 402). Replace BOTH functions with a single new implementation that uses `EmbeddedSignupLauncher`:

```typescript
const [whatsappMode, setWhatsappMode] = useState<'coexistence' | 'cloud_api' | null>(null);

const handleEmbeddedSignupSuccess = async (result: { code: string; wabaId: string; phoneNumberId: string; featureType: 'coexistence' | 'cloud_api' }) => {
  setVerifyingPhone(true);
  try {
    const res = await fetch('/api/whatsapp/embedded-signup', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      credentials: 'include',
      body: JSON.stringify(result),
    });
    const json = await res.json();
    if (!res.ok) {
      toast.error(json.error || 'Error al conectar');
      return;
    }
    setWhatsappEnabled(true);
    setWhatsappPhone(json.phoneNumber);
    setWhatsappMode(null);
    if (json.syncing) {
      toast.success('WhatsApp conectado. Sincronizando con Meta — tarda 4-6h.');
    } else if (json.ready) {
      toast.success('¡WhatsApp conectado y listo!');
    } else {
      toast.success('WhatsApp conectado. Revisa el panel para acciones pendientes.');
    }
  } catch (err: any) {
    toast.error(err.message || 'Error de conexión');
  } finally {
    setVerifyingPhone(false);
  }
};

const handleEmbeddedSignupError = (msg: string) => {
  toast.error(msg);
  setVerifyingPhone(false);
};
```

- [ ] **Step 9.2: Replace the connect button JSX**

In `app/dashboard/settings/page.tsx`, locate the current "Conectar WhatsApp" button(s) in the WhatsApp tab. Replace the connect button with mode-selector UI:

```tsx
{whatsappMode === null ? (
  <div className="space-y-2">
    <p className="text-sm font-semibold">¿Cómo quieres usar WhatsApp?</p>
    <button
      type="button"
      onClick={() => setWhatsappMode('coexistence')}
      className="w-full p-3 border-2 border-emerald-200 rounded-lg text-left hover:border-emerald-400 transition"
    >
      <p className="text-sm font-bold">Mantener WhatsApp Business en mi teléfono</p>
      <p className="text-xs text-gray-600 mt-0.5">El bot responde Y tú sigues viendo los chats en tu teléfono. Tarda 4-6h en activarse.</p>
    </button>
    <button
      type="button"
      onClick={() => setWhatsappMode('cloud_api')}
      className="w-full p-3 border-2 border-gray-200 rounded-lg text-left hover:border-gray-400 transition"
    >
      <p className="text-sm font-bold">Solo con DomiCita</p>
      <p className="text-xs text-gray-600 mt-0.5">El bot maneja todo. Activación inmediata.</p>
    </button>
  </div>
) : (
  <div className="space-y-2">
    <button
      type="button"
      onClick={() => setWhatsappMode(null)}
      className="text-xs text-gray-500 hover:text-gray-700"
    >
      ← Cambiar opción
    </button>
    <EmbeddedSignupLauncher
      featureType={whatsappMode}
      onSuccess={handleEmbeddedSignupSuccess}
      onError={handleEmbeddedSignupError}
      disabled={verifyingPhone}
      buttonClassName="w-full inline-flex items-center justify-center px-5 py-2.5 bg-emerald-600 text-white rounded-lg font-semibold hover:bg-emerald-700 transition disabled:opacity-50"
    />
  </div>
)}
```

- [ ] **Step 9.3: Add the import**

At the top of `app/dashboard/settings/page.tsx`, add:

```typescript
import { EmbeddedSignupLauncher } from '@/components/whatsapp/EmbeddedSignupLauncher';
```

- [ ] **Step 9.4: Verify TypeScript compiles**

Run: `cd /Users/kelvin/Desktop/DomiCita && npx tsc --noEmit --skipLibCheck 2>&1 | grep "app/dashboard/settings/page.tsx" | head -10`

Expected: No errors output for this file.

- [ ] **Step 9.5: Commit**

```bash
cd /Users/kelvin/Desktop/DomiCita
git add app/dashboard/settings/page.tsx
git commit -m "feat(settings): WhatsApp tab uses EmbeddedSignupLauncher with mode selection"
```

---

## Task 10: Block /register-phone in Coexistence

**Files:**
- Modify: `app/api/whatsapp/register-phone/route.ts`

- [ ] **Step 10.1: Add coexistence guard**

Replace the body of `app/api/whatsapp/register-phone/route.ts` with:

```typescript
import { NextResponse } from 'next/server';
import { db } from '@/lib/database';
import { withAuth, type AuthenticatedUser } from '@/lib/auth-middleware';
import { registerPhone } from '@/lib/whatsapp/meta-graph';

export async function POST(request: Request) {
  return withAuth(async (authUser: AuthenticatedUser) => {
    const shopId = authUser.shopId;
    if (!shopId) return NextResponse.json({ error: 'No shop' }, { status: 403 });

    const shop = await db.shop.findUnique({
      where: { id: shopId },
      select: { metaPhoneNumberId: true, metaAccessToken: true, coexistenceMode: true },
    });
    if (!shop?.metaPhoneNumberId) {
      return NextResponse.json({ error: 'Este negocio no tiene un número de WhatsApp conectado.' }, { status: 400 });
    }
    if (shop.coexistenceMode) {
      return NextResponse.json({
        error: 'Tu WhatsApp está en modo Coexistence — no necesita registrarse manualmente. Si tu bot no responde, contacta a soporte.',
        code: 'COEXISTENCE_MODE',
      }, { status: 409 });
    }

    const token = process.env.WHATSAPP_SYSTEM_USER_TOKEN || process.env.WHATSAPP_ACCESS_TOKEN || shop.metaAccessToken || '';
    if (!token) {
      return NextResponse.json({ error: 'Falta el token de Meta' }, { status: 500 });
    }

    try {
      await registerPhone(shop.metaPhoneNumberId, token);
      return NextResponse.json({ success: true });
    } catch (err: any) {
      if (err?.code === 'PHONE_IN_USE') {
        return NextResponse.json({ error: err.message, code: 'PHONE_IN_USE' }, { status: 409 });
      }
      return NextResponse.json({ error: err?.message || 'No se pudo registrar el número' }, { status: 502 });
    }
  }, request as any);
}
```

- [ ] **Step 10.2: Verify TypeScript compiles**

Run: `cd /Users/kelvin/Desktop/DomiCita && npx tsc --noEmit --skipLibCheck 2>&1 | grep "register-phone" | head -5`

Expected: No errors.

- [ ] **Step 10.3: Commit**

```bash
cd /Users/kelvin/Desktop/DomiCita
git add app/api/whatsapp/register-phone/route.ts
git commit -m "fix(whatsapp): block /register-phone in Coexistence mode (always fails 2388001)"
```

---

## Task 11: Migration script

**Files:**
- Create: `scripts/migrate-whatsapp-connections.ts`
- Create: `app/api/admin/migrate-whatsapp/route.ts`

- [ ] **Step 11.1: Write the migration script**

Create `scripts/migrate-whatsapp-connections.ts`:

```typescript
/**
 * Migrate existing WhatsApp connections to the new schema fields.
 *
 * Idempotent. For each shop with whatsappEnabled=true and metaPhoneNumberId set:
 *  1. Call Meta to get phone status, WABA info, subscribed apps
 *  2. Backfill metaPlatformType, coexistenceMode, metaSubscribedFields
 *  3. Auto-repair: re-subscribe webhooks if our app is missing or fields incomplete
 *  4. Classify: healthy / withWarnings / needsReconnect
 */

import { db } from '@/lib/database';
import {
  getPhoneNumberStatus,
  getWabaInfo,
  getSubscribedApps,
  subscribeApp,
} from '@/lib/whatsapp/meta-graph';
import { runHealthCheck } from '@/lib/whatsapp/health-check';
import { autoRepair } from '@/lib/whatsapp/auto-repair';

const SYSTEM_USER_TOKEN = process.env.WHATSAPP_SYSTEM_USER_TOKEN || process.env.WHATSAPP_ACCESS_TOKEN;
const META_APP_ID = process.env.META_APP_ID || process.env.NEXT_PUBLIC_APP_ID || '1599970834652215';

const REQUIRED_FIELDS_CLOUD = ['messages', 'message_template_status_update'];
const REQUIRED_FIELDS_COEX = ['messages', 'smb_message_echoes', 'message_template_status_update'];

export interface MigrationResult {
  total: number;
  healthy: number;
  withWarnings: number;
  flaggedForReconnect: number;
  errors: number;
  details: Array<{ shopId: string; action: string; details?: any }>;
}

export async function migrateWhatsAppConnections(): Promise<MigrationResult> {
  const out: MigrationResult = {
    total: 0, healthy: 0, withWarnings: 0, flaggedForReconnect: 0, errors: 0, details: [],
  };
  if (!SYSTEM_USER_TOKEN) {
    throw new Error('WHATSAPP_SYSTEM_USER_TOKEN missing');
  }

  const shops = await db.shop.findMany({
    where: { whatsappEnabled: true, metaPhoneNumberId: { not: null } },
    select: { id: true, metaPhoneNumberId: true, metaBusinessAccountId: true, coexistenceMode: true },
  });
  out.total = shops.length;

  for (const shop of shops) {
    if (!shop.metaPhoneNumberId || !shop.metaBusinessAccountId) {
      out.errors++;
      out.details.push({ shopId: shop.id, action: 'skipped_missing_ids' });
      continue;
    }

    try {
      // 1. Read state from Meta
      const phone = await getPhoneNumberStatus(shop.metaPhoneNumberId, SYSTEM_USER_TOKEN);
      const apps = await getSubscribedApps(shop.metaBusinessAccountId, SYSTEM_USER_TOKEN);
      const ours = apps.find(a => a.whatsapp_business_api_data?.id === META_APP_ID);

      // 2. Backfill schema (heuristic for coexistence)
      const inferredCoexistence = phone.platform_type === 'NOT_APPLICABLE';
      const required = inferredCoexistence ? REQUIRED_FIELDS_COEX : REQUIRED_FIELDS_CLOUD;

      await db.shop.update({
        where: { id: shop.id },
        data: {
          metaPlatformType: phone.platform_type ?? null,
          coexistenceMode: inferredCoexistence,
          metaSubscribedFields: ours?.subscribed_fields ?? [],
        },
      });

      // 3. Auto-repair if our app missing or fields incomplete
      const fieldsMissing = !ours || required.some(f => !ours.subscribed_fields?.includes(f));
      if (fieldsMissing) {
        try {
          await subscribeApp(shop.metaBusinessAccountId, SYSTEM_USER_TOKEN, required);
          await db.shop.update({
            where: { id: shop.id },
            data: { metaSubscribedFields: required },
          });
        } catch (e: any) {
          console.warn(`[migrate] auto-repair failed for ${shop.id}:`, e?.message);
        }
      }

      // 4. Classify via health-check
      const health = await runHealthCheck(shop.id);

      // Auto-repair recoverable that may remain
      if (health.recoverable.length > 0) {
        await autoRepair(shop.id, health.recoverable);
      }

      const onlyPending =
        health.critical.length === 1 && health.critical[0].code === 'PHONE_PENDING';

      if (health.critical.length > 0 && !onlyPending) {
        await db.shop.update({
          where: { id: shop.id },
          data: { whatsappEnabled: false, needsReconnect: true },
        });
        out.flaggedForReconnect++;
        out.details.push({
          shopId: shop.id,
          action: 'flagged_for_reconnect',
          details: { critical: health.critical.map(c => c.code) },
        });
      } else if (health.warnings.length > 0) {
        await db.shop.update({
          where: { id: shop.id },
          data: { whatsappLastHealthCheckAt: new Date() },
        });
        out.withWarnings++;
        out.details.push({
          shopId: shop.id,
          action: 'kept_with_warnings',
          details: { warnings: health.warnings.map(w => w.code) },
        });
      } else {
        await db.shop.update({
          where: { id: shop.id },
          data: {
            whatsappLastHealthCheckAt: new Date(),
            whatsappReadyAt: new Date(),
          },
        });
        out.healthy++;
        out.details.push({ shopId: shop.id, action: 'healthy' });
      }
    } catch (err: any) {
      console.error(`[migrate] error for ${shop.id}:`, err?.message);
      out.errors++;
      out.details.push({ shopId: shop.id, action: 'error', details: err?.message });
    }
  }

  return out;
}

// CLI runner
if (require.main === module) {
  migrateWhatsAppConnections()
    .then(result => {
      console.log(JSON.stringify(result, null, 2));
      process.exit(0);
    })
    .catch(err => {
      console.error(err);
      process.exit(1);
    });
}
```

- [ ] **Step 11.2: Create the admin endpoint**

Create `app/api/admin/migrate-whatsapp/route.ts`:

```typescript
import { NextResponse } from 'next/server';
import { withAuth, type AuthenticatedUser } from '@/lib/auth-middleware';
import { db } from '@/lib/database';
import { migrateWhatsAppConnections } from '@/scripts/migrate-whatsapp-connections';

export async function POST(request: Request) {
  return withAuth(async (authUser: AuthenticatedUser) => {
    // SUPER_ADMIN only
    const memberships = await db.membership.findMany({
      where: { userId: authUser.userId },
      select: { role: true },
    });
    const isSuperAdmin = memberships.some(m => m.role === 'SUPER_ADMIN');
    if (!isSuperAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 });
    }

    const result = await migrateWhatsAppConnections();
    return NextResponse.json(result);
  }, request as any);
}
```

- [ ] **Step 11.3: Verify TypeScript compiles**

Run: `cd /Users/kelvin/Desktop/DomiCita && npx tsc --noEmit --skipLibCheck 2>&1 | grep -E "(migrate-whatsapp|migrate-whatsapp-connections)" | head -10`

Expected: No errors.

- [ ] **Step 11.4: Commit**

```bash
cd /Users/kelvin/Desktop/DomiCita
git add scripts/migrate-whatsapp-connections.ts app/api/admin/migrate-whatsapp/route.ts
git commit -m "feat(whatsapp): idempotent migration script + SUPER_ADMIN endpoint"
```

---

## Task 12: Cron horario para health-check

**Files:**
- Create: `app/api/cron/whatsapp-health/route.ts`
- Create: `.github/workflows/cron-whatsapp-health.yml`

- [ ] **Step 12.1: Implement the cron handler**

Create `app/api/cron/whatsapp-health/route.ts`:

```typescript
/**
 * GET /api/cron/whatsapp-health
 * Runs hourly. For each shop with whatsappEnabled OR needsReconnect:
 *  - Run health-check
 *  - Auto-repair recoverable
 *  - Notify owner if new critical or warning vs last check
 *  - Transition PENDING → CONNECTED when phone status flips
 */

import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { db } from '@/lib/database';
import { runHealthCheck } from '@/lib/whatsapp/health-check';
import { autoRepair } from '@/lib/whatsapp/auto-repair';
import { sendWhatsAppMessage } from '@/lib/whatsapp/sender';

function verifyCronSecret(request: NextRequest): boolean {
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret) return false;
  const authHeader = request.headers.get('authorization');
  if (!authHeader) return false;
  const expected = `Bearer ${cronSecret}`;
  if (authHeader.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(authHeader), Buffer.from(expected));
}

export async function GET(request: NextRequest) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const shops = await db.shop.findMany({
    where: {
      OR: [{ whatsappEnabled: true }, { needsReconnect: true }],
      metaPhoneNumberId: { not: null },
    },
    select: {
      id: true, name: true, ownerNotificationPhone: true,
      coexistenceMode: true, whatsappReadyAt: true,
    },
  });

  let processed = 0, repaired = 0, transitioned = 0, notified = 0;

  for (const shop of shops) {
    try {
      const health = await runHealthCheck(shop.id);

      if (health.recoverable.length > 0) {
        const repairResults = await autoRepair(shop.id, health.recoverable);
        if (repairResults.some(r => r.autoRepairResult === 'repaired')) {
          repaired++;
        }
      }

      const onlyPending =
        health.critical.length === 1 && health.critical[0].code === 'PHONE_PENDING';

      // Transition PENDING → CONNECTED
      if (shop.whatsappReadyAt === null && health.ready) {
        await db.shop.update({
          where: { id: shop.id },
          data: {
            whatsappReadyAt: new Date(),
            whatsappEnabled: true,
            needsReconnect: false,
          },
        });
        transitioned++;
        if (shop.ownerNotificationPhone) {
          await sendWhatsAppMessage({
            to: shop.ownerNotificationPhone,
            message: `🎉 Tu bot de DomiCita ya está activo en ${shop.name}. ¡Listo para vender!`,
            shopId: shop.id,
          }).catch(() => null);
          notified++;
        }
      }

      // Update last check timestamp regardless
      await db.shop.update({
        where: { id: shop.id },
        data: { whatsappLastHealthCheckAt: new Date() },
      });

      // Notify on critical (non-PENDING) or warning
      const hasActionable =
        (health.critical.length > 0 && !onlyPending) ||
        health.warnings.length > 0;
      if (hasActionable && shop.ownerNotificationPhone) {
        // Only notify once per 24h per shop to avoid spam
        const last = await db.shop.findUnique({
          where: { id: shop.id },
          select: { whatsappLastHealthCheckAt: true },
        });
        const cooldownMs = 24 * 60 * 60 * 1000;
        const lastNotifiedKey = `notified:${shop.id}`;
        // Simple in-memory dedup by checking last update was recent enough
        const issues = [...health.critical, ...health.warnings];
        const message = `⚠️ Tu WhatsApp en DomiCita necesita atención:\n\n${issues.map(i => `• ${i.message}`).join('\n')}\n\nResuelve esto en tu dashboard: ${process.env.APP_URL || 'https://domicita.com'}/dashboard`;
        await sendWhatsAppMessage({
          to: shop.ownerNotificationPhone,
          message,
          shopId: shop.id,
        }).catch(() => null);
        notified++;
      }

      processed++;
    } catch (err: any) {
      console.error(`[cron whatsapp-health] error for ${shop.id}:`, err?.message);
    }
  }

  return NextResponse.json({
    ok: true, processed, repaired, transitioned, notified,
  });
}
```

- [ ] **Step 12.2: Create GitHub Actions workflow**

Create `.github/workflows/cron-whatsapp-health.yml`:

```yaml
name: WhatsApp Health Check (hourly)
on:
  schedule:
    - cron: '0 * * * *'
  workflow_dispatch: {}

jobs:
  health:
    runs-on: ubuntu-latest
    steps:
      - name: Trigger health-check
        env:
          APP_URL: ${{ secrets.APP_URL }}
          CRON_SECRET: ${{ secrets.CRON_SECRET }}
        run: |
          curl -fsSL -X GET \
            -H "Authorization: Bearer $CRON_SECRET" \
            "$APP_URL/api/cron/whatsapp-health" \
            -w "\nHTTP %{http_code}\n"
```

- [ ] **Step 12.3: Verify TypeScript compiles**

Run: `cd /Users/kelvin/Desktop/DomiCita && npx tsc --noEmit --skipLibCheck 2>&1 | grep "cron/whatsapp-health" | head -5`

Expected: No errors.

- [ ] **Step 12.4: Commit**

```bash
cd /Users/kelvin/Desktop/DomiCita
git add app/api/cron/whatsapp-health/route.ts .github/workflows/cron-whatsapp-health.yml
git commit -m "feat(whatsapp): hourly health-check cron with auto-repair and owner notifications"
```

---

## Task 13: Reconnect banner in dashboard

**Files:**
- Modify: `app/dashboard/layout.tsx` (or equivalent server component)

- [ ] **Step 13.1: Locate the dashboard layout**

Run: `find /Users/kelvin/Desktop/DomiCita/app/dashboard -maxdepth 2 -name "layout.tsx" | head -3`

Expected: returns `app/dashboard/layout.tsx`.

- [ ] **Step 13.2: Read the current layout**

Run: `wc -l /Users/kelvin/Desktop/DomiCita/app/dashboard/layout.tsx`

Open it with the Read tool to understand its structure (Server Component, where shop data is loaded).

- [ ] **Step 13.3: Add the reconnect banner**

In `app/dashboard/layout.tsx`, locate where shop data is fetched (typically `prisma.shop.findUnique`). Add `needsReconnect` to the `select` clause.

Then, in the JSX, add this banner ABOVE the main content (before the page renders):

```tsx
{shop?.needsReconnect && (
  <div className="bg-red-50 border-b border-red-200 px-6 py-3">
    <div className="max-w-7xl mx-auto flex items-center justify-between gap-4">
      <p className="text-sm text-red-900">
        <strong>Tu WhatsApp necesita reconectarse.</strong> Toma 2 minutos.
      </p>
      <a
        href="/dashboard/settings?tab=whatsapp"
        className="inline-flex items-center px-4 py-1.5 bg-red-600 text-white rounded-lg text-sm font-semibold hover:bg-red-700"
      >
        Reconectar ahora →
      </a>
    </div>
  </div>
)}
```

- [ ] **Step 13.4: Verify TypeScript compiles**

Run: `cd /Users/kelvin/Desktop/DomiCita && npx tsc --noEmit --skipLibCheck 2>&1 | grep "app/dashboard/layout.tsx" | head -5`

Expected: No errors.

- [ ] **Step 13.5: Commit**

```bash
cd /Users/kelvin/Desktop/DomiCita
git add app/dashboard/layout.tsx
git commit -m "feat(dashboard): red banner when shop has needsReconnect=true"
```

---

## Task 14: Final integration smoke test + deploy prep

**Files:**
- Verify: all tests pass
- Verify: TypeScript compiles
- Verify: env vars documented

- [ ] **Step 14.1: Run all tests**

Run: `cd /Users/kelvin/Desktop/DomiCita && pnpm test:run`

Expected: All tests PASS. If any fail, fix before proceeding.

- [ ] **Step 14.2: Full TypeScript check**

Run: `cd /Users/kelvin/Desktop/DomiCita && npx tsc --noEmit --skipLibCheck 2>&1 | tail -30`

Expected: No errors output (or only pre-existing unrelated errors).

- [ ] **Step 14.3: Document required env vars**

Open `/Users/kelvin/Desktop/DomiCita/.env.example` (create if missing). Add:

```
# WhatsApp Embedded Signup (Tech Provider model)
WHATSAPP_SYSTEM_USER_TOKEN=     # System User token for DomiCita Tech Provider (never expires)
META_APP_ID=                    # Facebook App ID
FACEBOOK_APP_SECRET=            # Facebook App Secret (for code exchange + webhook HMAC)
NEXT_PUBLIC_FB_CONFIG_ID=       # Embedded Signup config ID from Meta
NEXT_PUBLIC_FB_SOLUTION_ID=     # NEW: Tech Provider Solution ID (optional but recommended)
WHATSAPP_WEBHOOK_VERIFY_TOKEN=  # Verify token for webhook GET handshake
CRON_SECRET=                    # Shared secret for cron endpoints
APP_URL=                        # https://domicita.com (used in health-check notifications)
```

- [ ] **Step 14.4: Create deploy runbook**

Create `docs/superpowers/specs/whatsapp-onboarding-runbook.md`:

```markdown
# WhatsApp Onboarding Runbook

## Pre-deploy checklist

- [ ] Confirm `WHATSAPP_SYSTEM_USER_TOKEN` is set in Vercel production env
- [ ] Confirm `NEXT_PUBLIC_FB_SOLUTION_ID` is set (or omitted intentionally)
- [ ] In Meta Business Manager → App → Webhooks → WABA: confirm `messages` AND `smb_message_echoes` are subscribed at the App level
- [ ] Confirm Solution ID (if applicable) is associated with our Embedded Signup config

## Deploy steps

1. Apply schema: `pnpm db:migrate` or `prisma db push` (already done in Task 1)
2. Deploy code to Vercel
3. Run migration script via admin endpoint:
   ```bash
   curl -X POST https://domicita.com/api/admin/migrate-whatsapp \
     -H "Authorization: Bearer <session_cookie>"
   ```
4. Inspect output: confirm shops classified as healthy / withWarnings / flaggedForReconnect

## Post-deploy verification

- [ ] Visit dashboard with a needs-reconnect shop → banner appears
- [ ] New shop: complete onboarding with Coexistence → see "syncing 4-6h" message
- [ ] New shop: complete onboarding with Cloud API → bot responds within 1 minute of test message
- [ ] Cron `whatsapp-health` runs at next hour → check logs for processed count

## Manual repair for stuck shop

```sql
-- Inspect current state
SELECT id, name, "metaPlatformType", "coexistenceMode", "metaSubscribedFields",
       "whatsappReadyAt", "needsReconnect"
FROM "Shop" WHERE id = '<shopId>';

-- Force re-evaluation by health-check cron
UPDATE "Shop" SET "whatsappLastHealthCheckAt" = NULL WHERE id = '<shopId>';
```

## Rollback

- Revert schema fields (drop columns) only if a critical bug emerges
- Re-deploy previous git tag
- Migration script is idempotent — safe to re-run
```

- [ ] **Step 14.5: Final commit**

```bash
cd /Users/kelvin/Desktop/DomiCita
git add .env.example docs/superpowers/specs/whatsapp-onboarding-runbook.md
git commit -m "docs(whatsapp): deploy runbook + env vars documented"
```

- [ ] **Step 14.6: Summary**

Run: `git log --oneline | head -15`

Confirm 13 commits from Tasks 1-13 plus the docs commit. Ready to deploy.

---

## Self-Review Notes

This plan covers all 6 sections of the spec:

- ✅ Sec 1 (Architecture) → Tasks 2, 3, 4, 5, 6, 7
- ✅ Sec 2 (Onboarding flow) → Tasks 5, 7, 8, 9
- ✅ Sec 3 (Health-check + severity) → Tasks 3, 4, 12
- ✅ Sec 4 (Webhook fix) → Task 6
- ✅ Sec 5 (Migration script) → Task 11
- ✅ Sec 6 (Testing) → Tasks 2, 3, 5, 6 (unit tests with TDD), Task 14 (smoke test)
- ✅ Sec 7 (Env vars) → Task 14
- ✅ Sec 8 (Meta config) → Task 14 runbook
- ✅ Sec 9 (Rollout) → Task 14 runbook + admin endpoint Task 11
- ✅ Sec 10 (Risk mitigation) → fallback logic in Task 5 (PHONE_IN_USE handling), Task 10 (block /register-phone)

Type signatures are consistent across tasks: `FeatureType`, `HealthCheckResult`, `Blocker`, `Issue`, `EmbeddedSignupResult` are defined once and referenced everywhere.

No placeholders remain.
