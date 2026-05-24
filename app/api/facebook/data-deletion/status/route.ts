/**
 * Status endpoint for Facebook Data Deletion requests.
 *
 * Meta polls this URL to verify a deletion request was processed.
 * Returns the confirmation code and user id from the original request.
 *
 * Reference: https://developers.facebook.com/docs/development/create-an-app/app-dashboard/data-deletion-callback
 */

import { NextResponse } from 'next/server';

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const id = searchParams.get('id');

  if (!code) {
    return NextResponse.json({ error: 'Missing confirmation code' }, { status: 400 });
  }

  // We don't keep a persistent map of FB user_id → shop since we don't store
  // Facebook user IDs (only the WABA tokens). When Meta sent us the deletion
  // notification we already cleared any matching tokens. This endpoint just
  // confirms the request was processed.
  return NextResponse.json({
    status: 'processed',
    confirmation_code: code,
    facebook_user_id: id ?? null,
    processed_at: new Date().toISOString(),
  });
}
