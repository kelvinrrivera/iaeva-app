/**
 * WhatsApp Meta OAuth Connect
 *
 * Initiates the OAuth flow to connect a shop's WhatsApp Business account.
 * The state parameter is HMAC-signed to prevent CSRF.
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-middleware';
import { createHmac } from 'crypto';

const META_APP_ID = process.env.NEXT_PUBLIC_APP_ID;

const REQUIRED_SCOPES = [
  'whatsapp_business_management',
  'whatsapp_business_messaging',
  'whatsapp_business_platform',
].join(',');

function signState(payload: object): string {
  const secret = process.env.FACEBOOK_APP_SECRET;
  if (!secret) throw new Error('FACEBOOK_APP_SECRET not configured');
  const json = JSON.stringify(payload);
  const sig = createHmac('sha256', secret).update(json).digest('hex');
  return Buffer.from(JSON.stringify({ payload: json, sig })).toString('base64url');
}

export async function GET(req: NextRequest) {
  try {
    const user = await requireAuth(req);
    if (!user.shopId) {
      return NextResponse.json({ error: 'No shop found' }, { status: 400 });
    }

    if (!META_APP_ID) {
      return NextResponse.json({ error: 'Meta app not configured' }, { status: 500 });
    }

    // Trust only NEXT_PUBLIC_APP_URL — never the Host header.
    // Host spoofing could redirect the OAuth code to an attacker-controlled domain.
    const appUrl = process.env.NEXT_PUBLIC_APP_URL;
    if (!appUrl) {
      return NextResponse.json({ error: 'App URL not configured' }, { status: 500 });
    }
    const callbackUrl = `${appUrl.replace(/\/$/, '')}/api/whatsapp/callback`;

    // HMAC-signed state — shopId + timestamp + nonce to prevent CSRF
    const state = signState({
      shopId: user.shopId,
      timestamp: Date.now(),
    });

    const authUrl = new URL('https://www.facebook.com/v22.0/dialog/oauth');
    authUrl.searchParams.set('client_id', META_APP_ID);
    authUrl.searchParams.set('redirect_uri', callbackUrl);
    authUrl.searchParams.set('scope', REQUIRED_SCOPES);
    authUrl.searchParams.set('response_type', 'code');
    authUrl.searchParams.set('state', state);

    return NextResponse.json({ url: authUrl.toString(), callbackUrl });
  } catch (error: any) {
    console.error('[WhatsApp Connect] Error:', error);
    return NextResponse.json(
      { error: error.message || 'Failed to initiate connection' },
      { status: error.status || 500 }
    );
  }
}
