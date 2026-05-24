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

/** GET /me?fields=id — verify token validity */
export async function verifyToken(token: string): Promise<{ id: string }> {
  return metaFetch<{ id: string }>(
    `/me?fields=id`,
    { token, method: 'GET' },
    'verifyToken',
  );
}
