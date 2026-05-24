/**
 * Meta access token lifecycle management.
 *
 * Meta issues short-lived User Access Tokens (~1h) after Embedded Signup.
 * We exchange them immediately for Long-Lived Tokens (~60 days) and store
 * the expiry date so the refresh cron knows when to renew.
 *
 * Refresh window: renew when < 35 days remain (cron runs every 30 days).
 */

const META_GRAPH = 'https://graph.facebook.com/v22.0';

const APP_ID = process.env.NEXT_PUBLIC_APP_ID;
const APP_SECRET = process.env.FACEBOOK_APP_SECRET;

export interface LongLivedTokenResult {
  accessToken: string;
  expiresAt: Date;
}

/**
 * Exchange any Meta User Access Token for a Long-Lived Token (~60 days).
 * Safe to call with a token that is already long-lived — Meta will just
 * return a fresh 60-day token.
 */
export async function exchangeForLongLivedToken(
  shortLivedToken: string
): Promise<LongLivedTokenResult> {
  if (!APP_ID || !APP_SECRET) {
    throw new Error('META_APP_ID / FACEBOOK_APP_SECRET not configured');
  }

  const url = new URL(`${META_GRAPH}/oauth/access_token`);
  url.searchParams.set('grant_type', 'fb_exchange_token');
  url.searchParams.set('client_id', APP_ID);
  url.searchParams.set('client_secret', APP_SECRET);
  url.searchParams.set('fb_exchange_token', shortLivedToken);

  const res = await fetch(url.toString());
  const data = await res.json();

  if (!res.ok || data.error) {
    throw new Error(data.error?.message || `Meta token exchange failed: ${res.status}`);
  }

  // Meta returns expires_in in seconds (typically 5183944 ≈ 60 days)
  const expiresInMs = (data.expires_in ?? 5_183_944) * 1000;
  const expiresAt = new Date(Date.now() + expiresInMs);

  return { accessToken: data.access_token, expiresAt };
}

/**
 * Returns true if the stored token should be refreshed now.
 * Triggers when less than 35 days remain (cron runs every 30 days = safe buffer).
 */
export function shouldRefreshToken(expiresAt: Date | null): boolean {
  if (!expiresAt) return true;
  const daysRemaining = (expiresAt.getTime() - Date.now()) / (1000 * 60 * 60 * 24);
  return daysRemaining < 35;
}
