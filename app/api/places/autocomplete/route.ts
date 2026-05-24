/**
 * GET /api/places/autocomplete?input=...
 *
 * Server-side proxy for Google Places Autocomplete API.
 * Keeps the API key server-side only.
 * Biases results toward Dominican Republic.
 */

import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit, extractIP, rateLimitResponse } from '@/lib/rate-limit';

const API_KEY = process.env.GOOGLE_PLACES_API_KEY!;

export async function GET(request: NextRequest) {
  const ip = extractIP(request);
  const rl = await checkRateLimit(`places-ac:${ip}`, 'api');
  if (!rl.success) return rateLimitResponse();

  const input = request.nextUrl.searchParams.get('input');

  if (!input || input.trim().length < 2) {
    return NextResponse.json({ predictions: [] });
  }

  if (!API_KEY) {
    return NextResponse.json({ error: 'Google Places API not configured' }, { status: 500 });
  }

  const params = new URLSearchParams({
    input: input.trim(),
    key: API_KEY,
    language: 'es',
    components: 'country:do',
    types: 'address',
  });

  try {
    const res = await fetch(
      `https://maps.googleapis.com/maps/api/place/autocomplete/json?${params}`,
      { next: { revalidate: 0 } }
    );
    const data = await res.json();

    if (data.status !== 'OK' && data.status !== 'ZERO_RESULTS') {
      console.error('[Places Autocomplete] API error:', data.status, data.error_message);
    }

    return NextResponse.json({
      predictions: (data.predictions || []).map((p: any) => ({
        placeId: p.place_id,
        description: p.description,
        mainText: p.structured_formatting?.main_text || p.description,
        secondaryText: p.structured_formatting?.secondary_text || '',
      })),
    });
  } catch (err: any) {
    console.error('[Places Autocomplete] Fetch error:', err.message);
    return NextResponse.json({ predictions: [] });
  }
}
