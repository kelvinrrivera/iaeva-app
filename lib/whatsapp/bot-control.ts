import { db } from '@/lib/database';
import { notifyOwnerSentimentEscalation } from './owner-notifier';

export type BotDecision =
    | { allowed: true }
    | { allowed: false; reason: 'human_control' | 'paused' | 'schedule_disabled' | 'schedule_off_hours' | 'schedule_business_hours' | 'schedule_custom'; courtesyReply?: string | null };

const TAKEOVER_TTL_HOURS = 24;

interface CustomWindow { day: number; start: string; end: string }

/**
 * Get the day-of-week (0=Sun..6=Sat) and HH:mm for a given timezone.
 */
function nowInShopTz(tz: string): { dayOfWeek: number; hhmm: string } {
    const fmt = new Intl.DateTimeFormat('en-US', {
        timeZone: tz,
        weekday: 'short',
        hour: '2-digit',
        minute: '2-digit',
        hour12: false,
    });
    const parts = fmt.formatToParts(new Date());
    const weekday = parts.find(p => p.type === 'weekday')?.value || 'Sun';
    const hour = parts.find(p => p.type === 'hour')?.value || '00';
    const minute = parts.find(p => p.type === 'minute')?.value || '00';
    const days: Record<string, number> = { Sun: 0, Mon: 1, Tue: 2, Wed: 3, Thu: 4, Fri: 5, Sat: 6 };
    return { dayOfWeek: days[weekday] ?? 0, hhmm: `${hour === '24' ? '00' : hour}:${minute}` };
}

function inWindow(now: { dayOfWeek: number; hhmm: string }, win: { day: number; start: string; end: string }): boolean {
    if (win.day !== now.dayOfWeek) return false;
    if (win.start <= win.end) return now.hhmm >= win.start && now.hhmm <= win.end;
    // wrap-around (e.g. 22:00 → 06:00)
    return now.hhmm >= win.start || now.hhmm <= win.end;
}

/**
 * Decide whether the bot is allowed to respond right now for a given conversation.
 * Priority:
 *   1. Human took over and TTL not expired → block
 *   2. Bot schedule says we're in a silent window → block (with optional courtesy reply)
 *   3. Otherwise → allow
 */
export async function shouldBotRespond(
    shopId: string,
    conversationId: string | null
): Promise<BotDecision> {
    // Conversation-level human override
    if (conversationId) {
        const conv = await db.whatsAppConversation.findUnique({
            where: { id: conversationId },
            select: { controlMode: true, botResumesAt: true },
        });
        if (conv?.controlMode === 'HUMAN') {
            const expired = conv.botResumesAt && conv.botResumesAt < new Date();
            if (!expired) return { allowed: false, reason: 'human_control' };
        }
        if (conv?.controlMode === 'BOT_PAUSED') {
            const expired = conv.botResumesAt && conv.botResumesAt < new Date();
            if (!expired) return { allowed: false, reason: 'paused' };
        }
    }

    // Shop-level schedule
    const shop = await db.shop.findUnique({
        where: { id: shopId },
        select: {
            timezone: true,
            botSchedule: true,
            hours: { select: { dayOfWeek: true, startTime: true, endTime: true } },
        },
    });
    if (!shop) return { allowed: true };

    const sched = shop.botSchedule;
    if (!sched || sched.mode === 'ALWAYS') return { allowed: true };

    const courtesyReply =
        sched.closedAutoReplyEnabled && sched.closedAutoReply ? sched.closedAutoReply : null;

    if (sched.mode === 'DISABLED') {
        return { allowed: false, reason: 'schedule_disabled', courtesyReply };
    }

    const now = nowInShopTz(shop.timezone || 'America/Santo_Domingo');

    if (sched.mode === 'CUSTOM') {
        const windows = (sched.customWindows as CustomWindow[] | null) || [];
        const isOpen = windows.some(w => inWindow(now, w));
        return isOpen ? { allowed: true } : { allowed: false, reason: 'schedule_custom', courtesyReply };
    }

    // BUSINESS_HOURS / OFF_HOURS — read shop opening hours
    const todayHours = (shop.hours || []).filter(h => h.dayOfWeek === now.dayOfWeek);
    const shopIsOpen = todayHours.some(h => inWindow(now, { day: now.dayOfWeek, start: h.startTime, end: h.endTime }));

    if (sched.mode === 'BUSINESS_HOURS') {
        return shopIsOpen ? { allowed: true } : { allowed: false, reason: 'schedule_business_hours', courtesyReply };
    }
    if (sched.mode === 'OFF_HOURS') {
        return !shopIsOpen ? { allowed: true } : { allowed: false, reason: 'schedule_off_hours', courtesyReply };
    }

    return { allowed: true };
}

/**
 * Mark a conversation as taken over by a human.
 * Sets botResumesAt to now + TTL hours.
 */
export async function markHumanTakeover(
    shopId: string,
    phoneNumber: string,
    reason: string,
    humanTakerId?: string
): Promise<void> {
    const resumesAt = new Date(Date.now() + TAKEOVER_TTL_HOURS * 60 * 60 * 1000);
    await db.whatsAppConversation.upsert({
        where: { phoneNumber_shopId: { phoneNumber, shopId } },
        update: {
            controlMode: 'HUMAN',
            humanTookOverAt: new Date(),
            humanTakerId: humanTakerId || null,
            botResumesAt: resumesAt,
            takeoverReason: reason,
        },
        create: {
            shopId,
            phoneNumber,
            phase: 'human',
            stateJson: '{}',
            controlMode: 'HUMAN',
            humanTookOverAt: new Date(),
            humanTakerId: humanTakerId || null,
            botResumesAt: resumesAt,
            takeoverReason: reason,
        },
    });

    if (reason === 'sentiment') {
        notifyOwnerSentimentEscalation({ shopId, clientPhone: phoneNumber }).catch((err) =>
            console.error('[owner-notifier] sentiment escalation error:', err)
        );
    }
}

/**
 * Hand control back to the bot for a conversation.
 */
export async function returnControlToBot(shopId: string, phoneNumber: string): Promise<void> {
    await db.whatsAppConversation.updateMany({
        where: { shopId, phoneNumber },
        data: {
            controlMode: 'BOT',
            botResumesAt: null,
            takeoverReason: null,
        },
    });
}

const HUMAN_REQUEST_KEYWORDS = [
    'humano', 'humana', 'persona', 'agente', 'asesor', 'asesora',
    'hablar con alguien', 'hablar con un humano', 'hablar con una persona',
    'pasame con', 'pásame con', 'comuníqueme con', 'comuniqueme con',
    'no es un bot', 'eres un bot', 'eres un robot',
];

export function detectsHumanRequest(text: string): boolean {
    const lower = text.toLowerCase();
    return HUMAN_REQUEST_KEYWORDS.some(k => lower.includes(k));
}

// NOTE: las detecciones por keywords/regex de "frustración" y "petición de
// profesional específico" se eliminaron — eran frágiles para español dominicano
// informal y producían falsos positivos. El LLM agent las maneja:
//   - Frustración → tool `escalate_to_human` con reason='sentiment'
//   - Profesional pedido → el LLM detecta del contexto y llama
//     `present_stylist_picker` o pasa stylistId a `find_available_slots`.
