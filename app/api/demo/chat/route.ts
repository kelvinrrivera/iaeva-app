/**
 * POST /api/demo/chat
 *
 * Chatbot de demostración público — sin autenticación requerida.
 * Conectado a Gemini real con el negocio demo (Barbería Elite).
 *
 * Rate limiting: 5 mensajes por IP por hora (cookie + IP).
 * No guarda historial persistente en DB para visitantes anónimos.
 */

import { NextRequest, NextResponse } from 'next/server';
import type { Shop, Service, Stylist, ShopAvailability } from '@prisma/client';
import { getGeminiResponse, DEFAULT_MODEL } from '@/lib/gemini';
import { prisma } from '@/lib/db';
import { checkRateLimit, extractIP } from '@/lib/rate-limit';

const DEMO_SHOP_ID = process.env.DEMO_SHOP_ID || 'demo-shop-barberia-elite';
const CACHE_TTL_MS = 5 * 60 * 1000;

interface DemoShopData {
  shop: Shop;
  services: Service[];
  stylists: Stylist[];
  shopHours: ShopAvailability[];
}

// In-memory cache for demo shop data (avoid DB queries per message, single shop)
let demoCache: { data: DemoShopData; expiresAt: number } | null = null;

export async function POST(request: NextRequest) {
  // Use shared rate-limit helper (Upstash in prod, in-memory fallback in dev)
  // Preset 'auth' = 10 req/min — intentionally tight for unauthenticated AI endpoint
  const ip = extractIP(request);
  const rl = await checkRateLimit(`demo-chat:${ip}`, 'auth');

  if (!rl.success) {
    return NextResponse.json(
      { error: 'Límite de mensajes de demo alcanzado. Crea tu cuenta gratis para usar el bot sin límites.' },
      { status: 429 }
    );
  }

  const remaining = rl.remaining;

  let body: { message: string; history?: { role: 'user' | 'assistant'; content: string }[] };
  try {
    body = await request.json();
  } catch {
    return NextResponse.json({ error: 'Invalid JSON' }, { status: 400 });
  }

  const { message, history = [] } = body;

  if (!message?.trim()) {
    return NextResponse.json({ error: 'Mensaje vacío' }, { status: 400 });
  }

  if (!process.env.OPENAI_API_KEY) {
    return NextResponse.json({ error: 'API de IA no configurada' }, { status: 500 });
  }

  // Load demo shop data from cache or DB
  const now = Date.now();
  if (!demoCache || now > demoCache.expiresAt) {
    const [shop, services, stylists, shopHours] = await Promise.all([
      prisma.shop.findUnique({ where: { id: DEMO_SHOP_ID } }),
      prisma.service.findMany({ where: { shopId: DEMO_SHOP_ID, isActive: true } }),
      prisma.stylist.findMany({ where: { shopId: DEMO_SHOP_ID } }),
      prisma.shopAvailability.findMany({ where: { shopId: DEMO_SHOP_ID } }),
    ]);
    if (shop) {
      demoCache = { data: { shop, services, stylists, shopHours }, expiresAt: now + CACHE_TTL_MS };
    }
  }

  if (!demoCache?.data?.shop) {
    return NextResponse.json(
      { error: 'Negocio demo no encontrado. Ejecuta: npx tsx scripts/seed-demo-shop.ts' },
      { status: 404 }
    );
  }

  const { shop, services, stylists, shopHours } = demoCache.data;

  const days = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
  const horariosTexto = shopHours
    .sort((a, b) => a.dayOfWeek - b.dayOfWeek)
    .map(h => `${days[h.dayOfWeek]}: ${h.startTime} - ${h.endTime}`)
    .join('\n');

  const serviciosTexto = services
    .map(s => `- ${s.name}: RD$${s.price} (${s.duration} min)${s.description ? ' — ' + s.description : ''}`)
    .join('\n');

  const estilistasTexto = stylists.map(s => s.name).join(', ');

  // Obtener fecha/hora actual en RD
  const ahoraRD = new Date().toLocaleString('es-DO', {
    timeZone: 'America/Santo_Domingo',
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });

  // Build Google Maps link (prefer coordinates, fall back to address search)
  const mapsLink = shop.latitude && shop.longitude
    ? `https://www.google.com/maps?q=${shop.latitude},${shop.longitude}`
    : shop.placeId
    ? `https://www.google.com/maps/place/?q=place_id:${shop.placeId}`
    : `https://www.google.com/maps/search/${encodeURIComponent(shop.address || shop.name + ' Santo Domingo')}`;

  const systemPrompt = `Eres el asistente virtual de *${shop.name}*, una barbería profesional en Santo Domingo, República Dominicana.

FECHA Y HORA ACTUAL: ${ahoraRD}

TU MISIÓN:
- Responder preguntas sobre servicios, precios y horarios
- Ayudar a los clientes a agendar citas
- Representar al negocio de forma profesional y cercana

INFORMACIÓN DEL NEGOCIO:
📍 Dirección: ${shop.address || 'Piantini, Santo Domingo'}
🗺️ Google Maps: ${mapsLink}
✂️ Barberos disponibles: ${estilistasTexto}

SERVICIOS Y PRECIOS:
${serviciosTexto}

HORARIOS:
${horariosTexto}

TONO Y ESTILO:
- Habla en español dominicano natural pero profesional — como un buen empleado de confianza, no como alguien de la esquina
- Usa expresiones naturales como "dale", "perfecto", "con gusto", "te esperamos" — pero con moderación, no en cada mensaje
- NUNCA uses "líder" como apelativo — suena repetitivo y artificial
- Tutéalo al cliente, mantén el trato cercano pero sin excesos de jerga
- Sé breve y directo — máximo 3-4 líneas por respuesta

FLUJO DE CITAS:
1. Si el cliente quiere cita, primero confirma qué servicio quiere
2. Ofrece 2-3 horarios disponibles concretos según el horario del negocio
3. Cuando confirme día/hora/barbero, cierra con:
   "✅ Listo, [Nombre si lo dijo]. Cita confirmada para [día] a las [hora] con [barbero] para [servicio].
   Te enviamos un recordatorio por WhatsApp un par de horas antes. ¡Te esperamos!"
4. Siempre menciona el recordatorio automático al confirmar la cita — es parte del valor del servicio

UBICACIÓN:
- Si el cliente pregunta cómo llegar o dónde están, responde con la dirección Y el link de Maps:
  "Estamos en [dirección]. Aquí te dejo la ubicación en Google Maps: ${mapsLink}"
- Siempre incluye el link de Maps cuando el cliente pregunte por la ubicación

REGLAS:
- No inventes servicios ni precios fuera de la lista
- No saludes más de una vez en la conversación
- Si el cliente pregunta, esta es una demo — en el negocio real las citas se guardan automáticamente en el calendario`;

  try {
    const response = await getGeminiResponse(message, history, systemPrompt, DEFAULT_MODEL);

    return NextResponse.json({
      response,
      remaining,
      shopName: shop.name,
    });
  } catch (error: any) {
    console.error('[demo/chat] Gemini error:', error?.message);
    return NextResponse.json(
      { error: 'Error del asistente. Intenta de nuevo.' },
      { status: 500 }
    );
  }
}
