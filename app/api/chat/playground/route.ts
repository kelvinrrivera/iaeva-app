import { NextResponse } from "next/server";
import { getGeminiResponse, DEFAULT_MODEL } from "@/lib/gemini";
import { db } from "@/lib/database";
import { startOfDay, endOfDay, addDays, format } from "date-fns";
import { es } from "date-fns/locale";

import { withAuth, type AuthenticatedUser } from "@/lib/auth-middleware";
export async function POST(request: Request) {
    return withAuth(async (authUser: AuthenticatedUser) => {
    try {
        const shopId = authUser.shopId;
        if (!shopId) {
            return NextResponse.json({ error: "Shop not found" }, { status: 404 });
        }

        const payload = await request.json();
        const { message, history = [], systemInstruction, modelId } = payload;

        if (!message) {
            return NextResponse.json({ error: "No message provided" }, { status: 400 });
        }

        // 1. Fetch all business data for rich context
        const now = new Date();
        const tomorrow = addDays(now, 1);

        const [shop, services, hours, faqs, stylists, todayAppts, tomorrowAppts] = await Promise.all([
            db.shop.findUnique({ where: { id: shopId }, select: { name: true, address: true, phoneNumber: true, shopType: true, currency: true, timezone: true } }),
            db.service.findMany({ where: { shopId, isActive: true } }),
            db.shopAvailability.findMany({ where: { shopId }, orderBy: { dayOfWeek: 'asc' } }),
            db.fAQ.findMany({ where: { shopId } }),
            db.stylist.findMany({ where: { shopId }, select: { id: true, name: true } }),
            db.appointment.findMany({
                where: { shopId, startTime: { gte: startOfDay(now), lte: endOfDay(now) }, status: { notIn: ['CANCELLED', 'NO_SHOW'] } },
                select: { startTime: true, endTime: true, stylistId: true },
                orderBy: { startTime: 'asc' },
            }),
            db.appointment.findMany({
                where: { shopId, startTime: { gte: startOfDay(tomorrow), lte: endOfDay(tomorrow) }, status: { notIn: ['CANCELLED', 'NO_SHOW'] } },
                select: { startTime: true, endTime: true, stylistId: true },
                orderBy: { startTime: 'asc' },
            }),
        ]);

        const dayNames = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'];
        const curr = shop?.currency || 'DOP';

        const shopContext = shop
            ? `\n\nDATOS DEL NEGOCIO:\n- Nombre: ${shop.name}\n- Dirección: ${shop.address || 'No configurada'}\n- Teléfono: ${shop.phoneNumber || 'No configurado'}\n- Tipo: ${shop.shopType}`
            : '';

        const servicesContext = services.length > 0
            ? `\n\nSERVICIOS Y PRECIOS:\n${services.map(s => `- ${s.name}: ${curr === 'DOP' ? 'RD$' : '$'}${s.price} (${s.duration} min)`).join('\n')}`
            : '\n\n(No hay servicios configurados).';

        const hoursContext = hours.length > 0
            ? `\n\nHORARIO:\n${hours.map(h => `- ${dayNames[h.dayOfWeek]}: ${h.startTime} - ${h.endTime}`).join('\n')}`
            : '';

        const faqContext = faqs.length > 0
            ? `\n\nPREGUNTAS FRECUENTES (responde exactamente así):\n${faqs.map(f => `P: ${f.question}\nR: ${f.answer}`).join('\n\n')}`
            : '';

        // Build availability context from real appointments
        const stylistMap = new Map(stylists.map(s => [s.id, s.name]));
        const formatAppts = (appts: typeof todayAppts) => appts.map(a => {
            const st = format(new Date(a.startTime), 'HH:mm');
            const en = format(new Date(a.endTime), 'HH:mm');
            return `  - ${stylistMap.get(a.stylistId) || 'Sin asignar'}: ${st}-${en} (ocupado)`;
        }).join('\n');

        const todayLabel = format(now, "EEEE d 'de' MMMM", { locale: es });
        const tomorrowLabel = format(tomorrow, "EEEE d 'de' MMMM", { locale: es });

        let availContext = `\n\nDISPONIBILIDAD REAL (fecha actual: ${todayLabel}):`;
        availContext += `\nProfesionales: ${stylists.map(s => s.name).join(', ') || 'Ninguno registrado'}`;
        if (todayAppts.length > 0) {
            availContext += `\n\nCitas ocupadas hoy (${todayLabel}):\n${formatAppts(todayAppts)}`;
        } else {
            availContext += `\n\nHoy (${todayLabel}): Sin citas — todo disponible dentro del horario.`;
        }
        if (tomorrowAppts.length > 0) {
            availContext += `\n\nCitas ocupadas mañana (${tomorrowLabel}):\n${formatAppts(tomorrowAppts)}`;
        } else {
            availContext += `\n\nMañana (${tomorrowLabel}): Sin citas — todo disponible dentro del horario.`;
        }
        availContext += `\n\nIMPORTANTE: Los horarios NO listados como ocupados están disponibles. Ofrece horarios libres basándote en el horario del negocio menos las citas ocupadas.`;

        // 2. Get response from Gemini — history comes entirely from the frontend (no BD pollution)
        const fullSystemInstruction = `${systemInstruction}${shopContext}${servicesContext}${hoursContext}${faqContext}${availContext}`;

        const responseText = await getGeminiResponse(
            message,
            history,
            fullSystemInstruction,
            modelId || DEFAULT_MODEL
        );

        // Save to ChatHistory so onboarding checklist can detect chatbot usage
        await db.chatHistory.create({
            data: {
                role: 'user',
                content: message,
                phoneNumber: 'playground',
                shopId,
                question: message,
                source: 'playground',
            },
        });

        return NextResponse.json({
            response: responseText,
            timestamp: new Date().toISOString()
        });

    } catch (error: any) {
        console.error("Chat Playground Error:", error);
        return NextResponse.json({
            error: "Failed to get AI response"
        }, { status: 500 });
    }
    }, request as any);
}
