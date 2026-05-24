import { NextResponse } from "next/server";
import { withAuth, type AuthenticatedUser } from "@/lib/auth-middleware";
import { db } from "@/lib/database";
import { getGeminiResponse, DEFAULT_MODEL } from "@/lib/gemini";

interface ChatRequest {
    message: string;
    history?: Array<{ role: string; content: string }>;
    shopId?: string;
    bookingContext?: {
        step: 'service' | 'date' | 'time' | 'confirm' | 'done';
        serviceId?: string;
        serviceDuration?: number;
        date?: string;
        preferredTime?: string;
        stylistId?: string;
    };
}

/**
 * POST /api/chatbot/message
 * Procesa un mensaje del chatbot con inteligencia escalonada:
 * 1. Búsqueda exacta en FAQs
 * 2. Búsqueda fuzzy en FAQs
 * 3. Generación con Gemini + contexto de servicios
 */
export async function POST(request: Request) {
    return withAuth(async (authUser: AuthenticatedUser) => {
        try {
            const { message, history, shopId }: ChatRequest = await request.json();

            const effectiveShopId = shopId || authUser.shopId;

            if (!effectiveShopId) {
                return NextResponse.json(
                    { error: "Shop not found" },
                    { status: 404 }
                );
            }

            const startTime = Date.now();

            // 🤖 DETECTAR INTENCIÓN DE AGENDAR
            const intent = detectBookingIntent(message, history);
            console.log('[Chatbot] Intent detected:', intent);

            if (intent.wantsToBook) {
                return await handleBookingFlow({
                    message,
                    intent,
                    shopId: effectiveShopId,
                    startTime
                });
            }

            // 1️⃣ NIVEL 1: Búsqueda exacta en FAQs (O(1) - ultra rápido)
            const faqs = await db.fAQ.findMany({
                where: { shopId: effectiveShopId }
            });

            const exactMatch = faqs.find(faq =>
                message.toLowerCase().trim() === faq.question.toLowerCase().trim() ||
                message.toLowerCase().includes(faq.question.toLowerCase())
            );

            if (exactMatch) {
                console.log('[Chatbot] Exact FAQ match');
                return NextResponse.json({
                    response: exactMatch.answer,
                    source: 'faq_exact',
                    confidence: 1.0,
                    responseTime: Date.now() - startTime
                });
            }

            // 2️⃣ NIVEL 2: Búsqueda fuzzy simple (O(n) - muy rápido)
            const fuzzyMatch = findBestFuzzyMatch(message, faqs);

            if (fuzzyMatch && fuzzyMatch.score > 0.7) {
                console.log('[Chatbot] Fuzzy FAQ match', fuzzyMatch.score);
                return NextResponse.json({
                    response: fuzzyMatch.faq.answer,
                    source: 'faq_fuzzy',
                    confidence: fuzzyMatch.score,
                    responseTime: Date.now() - startTime
                });
            }

            // 3️⃣ NIVEL 3: Generación con Gemini + contexto estructurado
            const shop = await db.shop.findUnique({
                where: { id: effectiveShopId },
                include: {
                    services: {
                        where: { isActive: true },
                        take: 20
                    }
                }
            });

            if (!shop) {
                return NextResponse.json(
                    { error: "Shop not found" },
                    { status: 404 }
                );
            }

            // Construir prompt optimizado
            const servicesContext = shop.services.map(s =>
                `- ${s.name}: ${s.price} RD$, ${s.duration} min` +
                (s.description ? ` - ${s.description}` : '')
            ).join('\n');

            const faqsContext = faqs.slice(0, 10).map(f =>
                `Q: ${f.question}\nA: ${f.answer}`
            ).join('\n');

            const systemPrompt = `Eres ${shop.name}, un asistente virtual profesional y amable.

CATÁLOGO DE SERVICIOS:
${servicesContext}

PREGUNTAS FRECUENTES (referencia):
${faqsContext}

TU ROL:
- Ayudar a clientes a agendar citas
- Responder preguntas sobre servicios, precios, horarios
- Ser profesional pero cercano (estilo dominicano: "Dime", "Cuéntame", "Líder")
- SER BREVE (máximo 2-3 oraciones por respuesta)
- Si el cliente quiere agendar, preguntar fecha y hora
- NUNCA inventar precios o servicios que no están en el catálogo

CONTEXTO ACTUAL:
${history && history.length > 0 ? `Conversación previa:\n${history.slice(-3).map(h => `${h.role}: ${h.content}`).join('\n')}\n` : ''}

Responde a esta pregunta de forma conversacional y útil: ${message}`;

            // Llamar a Gemini via Vercel AI SDK
            const response = await getGeminiResponse(message, [], systemPrompt, DEFAULT_MODEL);

            // 4️⃣ LOGGING: Guardar la pregunta para analytics
            await logQuestion(effectiveShopId, message, 'gemini');

            console.log('[Chatbot] Gemini generated response');
            return NextResponse.json({
                response,
                source: 'gemini',
                confidence: 0.8,
                responseTime: Date.now() - startTime,
                servicesUsed: shop.services.length
            });

        } catch (error) {
            console.error("[Chatbot] Error:", error);

            // Fallback a respuesta genérica
            return NextResponse.json({
                response: "Lo siento, estoy teniendo problemas para responder. ¿Podrías llamarnos o visitar el shop?",
                source: 'fallback',
                confidence: 0,
                responseTime: 0
            });
        }
    }, request as any);
}

/**
 * Búsqueda fuzzy simple para FAQs
 */
function findBestFuzzyMatch(query: string, faqs: any[]) {
    if (faqs.length === 0) return null;

    const queryLower = query.toLowerCase();
    let bestMatch = { faq: faqs[0], score: 0 };

    for (const faq of faqs) {
        let score = 0;
        const questionLower = faq.question.toLowerCase();

        // Coincidencia de palabras clave
        const queryWords = queryLower.split(' ').filter((w: string) => w.length > 2);
        const faqWords = questionLower.split(' ').filter((w: string) => w.length > 2);

        for (const qWord of queryWords) {
            for (const fWord of faqWords) {
                if (qWord === fWord) score += 0.5;
                if (qWord.includes(fWord) || fWord.includes(qWord)) score += 0.3;
            }
        }

        // Bonus por longitud similar
        const lengthRatio = Math.min(query.length, questionLower.length) /
                           Math.max(query.length, questionLower.length);
        score += lengthRatio * 0.2;

        if (score > bestMatch.score) {
            bestMatch = { faq, score };
        }
    }

    return bestMatch.score > 0.3 ? bestMatch : null;
}

/**
 * Guardar pregunta para analytics
 */
async function logQuestion(shopId: string, question: string, source: string) {
    try {
        // Guardar en ChatHistory para analytics
        await db.chatHistory.create({
            data: {
                shopId,
                question,
                source,
                role: 'user',
                content: question,
                phoneNumber: 'chatbot-api',
                createdAt: new Date()
            }
        });

        // Verificar si esta pregunta se repite mucho
        const recentCount = await db.chatHistory.count({
            where: {
                shopId,
                question: {
                    contains: question.substring(0, 50) // Búsqueda parcial
                },
                createdAt: {
                    gte: new Date(Date.now() - 30 * 24 * 60 * 60 * 1000) // Últimos 30 días
                }
            }
        });

        // Si una pregunta se repite 5+ veces, sugerir agregar a FAQ
        if (recentCount >= 5) {
            console.log('[Chatbot] 🔥 Hot question detected:', question);
            // TODO: Enviar notificación al usuario para sugerir agregar a FAQ
        }
    } catch (error) {
        console.error('[Chatbot] Error logging question:', error);
    }
}

/**
 * 🎯 DETECTAR INTENCIÓN DE AGENDAR
 */
function detectBookingIntent(
    message: string,
    history: Array<{ role: string; content: string }> = []
) {
    const msgLower = message.toLowerCase();

    // Palabras clave de agendamiento
    const bookingKeywords = [
        'agendar', 'cita', 'reserva', 'reservar', 'quiero', 'necesito',
        'programar', 'hora', 'disponible', '什么时候', '预约'
    ];

    const hasBookingKeyword = bookingKeywords.some(kw => msgLower.includes(kw));

    // Detectar si menciona un servicio específico
    const hasService = /corte|barba|combo|tinte|servicio/i.test(message);

    // Detectar si menciona fecha
    const hasDate = /hoy|mañana|lunes|martes|miércoles|jueves|viernes|sábado|domingo|\d{1,2}\/\d{1,2}|\d{1,2}\sde\s+\w+/i.test(message);

    // Detectar si menciona hora
    const hasTime = /\d{1,2}:\d{2}|mañana|tarde|noche|\d+\s*(am|pm)/i.test(message);

    // Contexto de conversación previa
    const prevMessages = history || [];
    const lastBotMessage = prevMessages[prevMessages.length - 2]?.content || '';
    const wasAskedForService = /qué.*servicio|cuál.*servicio|qué.*necesitas/i.test(lastBotMessage);
    const wasAskedForDate = /qué.*día|qué.*fecha|cuándo.*quieres/i.test(lastBotMessage);
    const wasAskedForTime = /a.*qué.*hora|qué.*hora|qué.*horario/i.test(lastBotMessage);

    return {
        wantsToBook: hasBookingKeyword || wasAskedForService || wasAskedForDate || wasAskedForTime,
        hasService,
        hasDate,
        hasTime,
        wasAskedForService,
        wasAskedForDate,
        wasAskedForTime
    };
}

/**
 * 🔄 MANEJAR FLUJO DE AGENDAMIENTO CON OPTIMIZACIÓN
 */
async function handleBookingFlow(params: {
    message: string;
    intent: ReturnType<typeof detectBookingIntent>;
    shopId: string;
    bookingContext?: any;
    startTime: number;
}) {
    const { message, intent, shopId, bookingContext, startTime } = params;

    try {
        // PASO 1: Identificar servicio
        if (!bookingContext?.serviceId && !intent.hasService) {
            const services = await db.service.findMany({
                where: { shopId, isActive: true },
                take: 10
            });

            return NextResponse.json({
                response: `¡Perfecto! 🎉 ¿Qué servicio te gustaría agendar?\n\n` +
                    services.map((s, i) => `${i + 1}. **${s.name}** - ${s.price} RD$ (${s.duration} min)`).join('\n'),
                source: 'booking_flow',
                bookingContext: { step: 'service' },
                responseTime: Date.now() - startTime
            });
        }

        // Extraer servicio del mensaje
        let serviceId = bookingContext?.serviceId;
        if (!serviceId && intent.hasService) {
            const service = await extractServiceFromMessage(message, shopId);
            if (service) {
                serviceId = service.id;
            } else {
                return NextResponse.json({
                    response: "No encontré ese servicio. ¿Podrías decirme cuál quieres? (Corte, Barba, Combo, etc.)",
                    source: 'booking_flow',
                    bookingContext: { step: 'service' },
                    responseTime: Date.now() - startTime
                });
            }
        }

        // PASO 2: Identificar fecha
        if (!bookingContext?.date && !intent.hasDate) {
            return NextResponse.json({
                response: "¿Para qué día te gustaría agendar? (puedes decir 'hoy', 'mañana', o una fecha específica)",
                source: 'booking_flow',
                bookingContext: { step: 'date', serviceId },
                responseTime: Date.now() - startTime
            });
        }

        let date = bookingContext?.date;
        if (!date && intent.hasDate) {
            date = extractDateFromMessage(message);
            if (!date) {
                return NextResponse.json({
                    response: "No entendí la fecha. ¿Podrías decirme 'hoy', 'mañana', o la fecha específica?",
                    source: 'booking_flow',
                    bookingContext: { step: 'date', serviceId },
                    responseTime: Date.now() - startTime
                });
            }
        }

        // PASO 3: Extraer preferencia de hora y buscar slots optimizados
        const preferredTime = extractTimeFromMessage(message);

        console.log('[Chatbot] Fetching optimized slots:', { serviceId, date, preferredTime });

        // 🔥 LLAMAR AL MOTOR DE OPTIMIZACIÓN
        const optimizedSlots = await fetchInternalSlotsOptimized(shopId, date, serviceId, preferredTime);

        if (!optimizedSlots || optimizedSlots.slots.length === 0) {
            return NextResponse.json({
                response: "😔 Lo siento, no hay disponibilidad para esa fecha. ¿Te gustaría probar otro día?",
                source: 'booking_flow',
                bookingContext: { step: 'date', serviceId },
                responseTime: Date.now() - startTime
            });
        }

        // PASO 4: Presentar las mejores opciones con explicaciones
        const topSlots = optimizedSlots.slots.slice(0, 5);
        const analytics = optimizedSlots.analytics;

        let response = `✨ **Horarios disponibles para ${date}**\n\n`;
        response += `📊 **Ocupación del día:** ${analytics.occupancy}%\n\n`;

        if (analytics.gaps.length > 0) {
            response += `🕳️ **Huecos disponibles:** ${analytics.gaps.length} espacios vacíos\n\n`;
        }

        response += `**Las mejores opciones para ti:**\n\n`;

        topSlots.forEach((slot: any, i: number) => {
            const emoji = slot.score >= 80 ? '🌟' : slot.score >= 60 ? '⭐' : '✅';
            response += `${emoji} **${slot.time}** con ${slot.stylistName}\n`;

            if (slot.reasons.length > 0) {
                response += `   _${slot.reasons[0]}_\n`;
            }

            if (slot.gapFilling) {
                response += `   💡 *Esta hora optimiza el calendario llenando huecos vacíos*\n`;
            }

            response += '\n';
        });

        response += `💬 _Escribe el número de hora que prefieres (ej: "10:00") o dime tu hora ideal si no ves una que te guste_`;

        return NextResponse.json({
            response,
            source: 'booking_optimized',
            bookingContext: {
                step: 'time',
                serviceId,
                date,
                slots: topSlots,
                analytics
            },
            responseTime: Date.now() - startTime,
            optimizedSlotsCount: optimizedSlots.totalSlots
        });

    } catch (error) {
        console.error('[Chatbot] Booking flow error:', error);
        return NextResponse.json({
            response: "Hubo un error al buscar horarios. ¿Podrías intentar nuevamente?",
            source: 'booking_error',
            responseTime: Date.now() - startTime
        });
    }
}

/**
 * Llamada interna al endpoint de slots optimizados
 */
async function fetchInternalSlotsOptimized(
    shopId: string,
    date: string,
    serviceId: string,
    preferredTime: string | null
) {
    try {
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000';
        const url = new URL(`${baseUrl}/api/chatbot/slots-optimized`);
        url.searchParams.set('date', date);
        url.searchParams.set('serviceId', serviceId);
        if (preferredTime) url.searchParams.set('preferredTime', preferredTime);

        const internalKey = process.env.INTERNAL_API_KEY;
        if (!internalKey) {
            console.error('[fetchInternalSlotsOptimized] INTERNAL_API_KEY not set');
            return null;
        }

        const response = await fetch(url.toString(), {
            method: 'GET',
            headers: {
                'Content-Type': 'application/json',
                'x-shop-id': shopId,
                'x-internal-key': internalKey,
            }
        });

        if (!response.ok) {
            console.error('[fetchInternalSlotsOptimized] Error:', response.status);
            return null;
        }

        return await response.json();
    } catch (error) {
        console.error('[fetchInternalSlotsOptimized] Exception:', error);
        return null;
    }
}

/**
 * Extraer servicio del mensaje
 */
async function extractServiceFromMessage(message: string, shopId: string) {
    const msgLower = message.toLowerCase();

    const services = await db.service.findMany({
        where: { shopId, isActive: true }
    });

    // Búsqueda exacta o fuzzy
    for (const service of services) {
        const serviceName = service.name.toLowerCase();
        if (msgLower.includes(serviceName) || serviceName.includes(msgLower)) {
            return service;
        }
    }

    // Mapeo de palabras comunes
    const serviceMap: Record<string, string> = {
        'corte': 'corte',
        'barba': 'barba',
        'combo': 'combo',
        'cabello': 'corte',
        'bigote': 'barba',
        'facial': 'facial'
    };

    for (const [keyword, serviceName] of Object.entries(serviceMap)) {
        if (msgLower.includes(keyword)) {
            return services.find(s => s.name.toLowerCase().includes(serviceName));
        }
    }

    return null;
}

/**
 * Extraer fecha del mensaje
 */
function extractDateFromMessage(message: string): string | null {
    const msgLower = message.toLowerCase();
    const today = new Date();

    // Hoy
    if (msgLower.includes('hoy')) {
        return today.toISOString().split('T')[0];
    }

    // Mañana
    if (msgLower.includes('mañana')) {
        const tomorrow = new Date(today);
        tomorrow.setDate(tomorrow.getDate() + 1);
        return tomorrow.toISOString().split('T')[0];
    }

    // Días de la semana
    const daysMap: Record<string, number> = {
        'domingo': 0, 'lunes': 1, 'martes': 2, 'miércoles': 3,
        'jueves': 4, 'viernes': 5, 'sábado': 6
    };

    for (const [dayName, dayNum] of Object.entries(daysMap)) {
        if (msgLower.includes(dayName)) {
            const targetDate = new Date(today);
            const currentDay = today.getDay();
            let daysAhead = dayNum - currentDay;
            if (daysAhead <= 0) daysAhead += 7; // Próxima ocurrencia
            targetDate.setDate(targetDate.getDate() + daysAhead);
            return targetDate.toISOString().split('T')[0];
        }
    }

    // Formato DD/MM
    const dateMatch = message.match(/(\d{1,2})\/(\d{1,2})/);
    if (dateMatch) {
        const [, day, month] = dateMatch;
        const date = new Date(today.getFullYear(), parseInt(month) - 1, parseInt(day));
        return date.toISOString().split('T')[0];
    }

    return null;
}

/**
 * Extraer hora preferida del mensaje
 */
function extractTimeFromMessage(message: string): string | null {
    // HH:MM
    const timeMatch = message.match(/(\d{1,2}):(\d{2})/);
    if (timeMatch) {
        const [, hours, minutes] = timeMatch;
        return `${hours.padStart(2, '0')}:${minutes}`;
    }

    // Mañana (9-12)
    if (/mañana/i.test(message)) {
        return "10:00";
    }

    // Tarde (12-18)
    if (/tarde/i.test(message)) {
        return "15:00";
    }

    // Noche (18+)
    if (/noche/i.test(message)) {
        return "19:00";
    }

    return null;
}
