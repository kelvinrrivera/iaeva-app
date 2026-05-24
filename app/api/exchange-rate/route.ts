/**
 * GET /api/exchange-rate
 *
 * Retorna la tasa de cambio USD → DOP desde ExchangeRate-API.
 * Cachea el resultado 4 horas para no abusar de la API.
 */

import { NextRequest, NextResponse } from 'next/server';
import { checkRateLimit, extractIP, rateLimitResponse } from '@/lib/rate-limit';

const API_KEY = process.env.EXCHANGERATE_API_KEY || '';
const CACHE_TTL_MS = 4 * 60 * 60 * 1000; // 4 horas

let cached: { rate: number; fetchedAt: number } | null = null;

export async function GET(request: NextRequest) {
  // Rate limit to prevent abuse
  const ip = extractIP(request);
  const { success } = await checkRateLimit(`exchange-rate:${ip}`, 'api');
  if (!success) return rateLimitResponse();
  const now = Date.now();

  // Servir desde cache si sigue vigente
  if (cached && now - cached.fetchedAt < CACHE_TTL_MS) {
    return NextResponse.json({ rate: cached.rate, cached: true });
  }

  try {
    const res = await fetch(
      `https://v6.exchangerate-api.com/v6/${API_KEY}/latest/USD`,
      { next: { revalidate: 14400 }, signal: AbortSignal.timeout(10000) }
    );

    if (!res.ok) throw new Error(`ExchangeRate API error: ${res.status}`);

    const data = await res.json();
    const rate: number = data?.conversion_rates?.DOP;

    if (!rate) throw new Error('DOP rate not found in response');

    cached = { rate, fetchedAt: now };

    return NextResponse.json({ rate, cached: false });
  } catch (err: any) {
    // Si falla, devuelve una tasa fallback aproximada (el dólar ronda los 60 DOP)
    return NextResponse.json(
      { rate: 60, cached: false, fallback: true },
      { status: 200 } // 200 para que el cliente lo use igual
    );
  }
}
