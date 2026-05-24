/**
 * GET /api/places/details?placeId=...
 *
 * Server-side proxy for Google Places Details API.
 * Returns address, coordinates (lat/lng) for a given place_id.
 */

import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit, extractIP, rateLimitResponse } from '@/lib/rate-limit';

const API_KEY = process.env.GOOGLE_PLACES_API_KEY!;

export async function GET(request: NextRequest) {
  const ip = extractIP(request);
  const rl = await checkRateLimit(`places-det:${ip}`, 'api');
  if (!rl.success) return rateLimitResponse();

  const placeId = request.nextUrl.searchParams.get('placeId');

  if (!placeId) {
    return NextResponse.json({ error: 'placeId is required' }, { status: 400 });
  }

  if (!API_KEY) {
    return NextResponse.json({ error: 'Google Places API not configured' }, { status: 500 });
  }

  const params = new URLSearchParams({
    place_id: placeId,
    key: API_KEY,
    language: 'es',
    fields: 'formatted_address,geometry,name,place_id',
  });

  try {
    const res = await fetch(
      `https://maps.googleapis.com/maps/api/place/details/json?${params}`,
      { next: { revalidate: 3600 } }
    );
    const data = await res.json();

    if (data.status !== 'OK') {
      return NextResponse.json({ error: data.status }, { status: 400 });
    }

    const result = data.result;
    return NextResponse.json({
      address: result.formatted_address,
      latitude: result.geometry?.location?.lat,
      longitude: result.geometry?.location?.lng,
      placeId: result.place_id,
    });
  } catch (err: any) {
    console.error('[Places Details] Fetch error:', err.message);
    return NextResponse.json({ error: 'Failed to fetch place details' }, { status: 500 });
  }
}
