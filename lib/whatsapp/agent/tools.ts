/**
 * Tools exposed to the chatbot agent. Each tool is a thin wrapper around an
 * existing capability of the app (DB, slot engine, Meta interactive UI).
 *
 * Design rules:
 * - Tools return PLAIN OBJECTS (JSON-serializable) — the LLM sees these as text.
 * - Tools NEVER throw uncaught — they always return { ok, ... } so the LLM
 *   can recover and craft a user-facing reply.
 * - Tools that present UI to the client (services, slots, confirmation) DO NOT
 *   send the message themselves. They build a structured `interactive` payload
 *   that the orchestrator returns up to the webhook, which then sends via Meta.
 *
 * The orchestrator decides when to stop: as soon as a `present_*` tool is
 * called OR the LLM produces final text, the turn ends.
 */

import { tool } from 'ai';
import { z } from 'zod';
import { addMinutes, format, parseISO, isBefore, addDays } from 'date-fns';
import { es } from 'date-fns/locale';
import { db } from '@/lib/database';
import { getOptimizedSlots } from '@/lib/whatsapp/slot-optimizer';
import { markHumanTakeover } from '@/lib/whatsapp/bot-control';
import { to12h, formatDateTime12h, formatHHmm, formatYMD } from '@/lib/whatsapp/time-format';
import { logToolCall } from '@/lib/tool-tracker';

// ──────────────────────────────────────────────────────────────────────────
// Runtime context passed to every tool handler
// ──────────────────────────────────────────────────────────────────────────

export interface ToolContext {
  shopId: string;
  phoneNumber: string;
  clientId: string | null;
  shopTimezone: string;
  /**
   * Collected by the orchestrator across tool calls within one turn.
   * Mutable: tools update this so the LLM sees the latest state when
   * it makes the next tool call within the same step.
   */
  scratch: ScratchState;
  /** Side-channel: tools push interactive payloads here to be returned upstream. */
  pendingInteractive: PendingInteractive | null;
}

export interface ScratchState {
  serviceId?: string;
  serviceName?: string;
  servicePrice?: number;
  serviceDuration?: number;
  /**
   * True ONLY when the client confirmed the service explicitly:
   *   - Tapped a service in present_service_picker (webhook sets it)
   *   - Wrote the service name and we matched it via lookup_service_by_name
   * The LLM CANNOT set this — find_available_slots & present_confirmation
   * refuse to run unless this is true. Prevents the model from inventing a default.
   */
  serviceConfirmedByClient?: boolean;
  dateTime?: string;        // ISO string
  stylistId?: string;
  stylistName?: string;
  lastSlotsOffered?: string[];     // HH:mm[] of slots last shown
  lastSlotsDate?: string;          // yyyy-MM-dd
}

export type PendingInteractive =
  | {
      kind: 'list';
      bodyText: string;
      buttonLabel: string;
      sections: Array<{
        title: string;
        rows: Array<{ id: string; title: string; description?: string }>;
      }>;
    }
  | {
      kind: 'buttons';
      bodyText: string;
      buttons: Array<{ id: string; title: string }>;
    }
  | {
      kind: 'location';
      latitude: number;
      longitude: number;
      name?: string;
      address?: string;
    };

// ──────────────────────────────────────────────────────────────────────────
// Helpers
// ──────────────────────────────────────────────────────────────────────────

/**
 * The LLM occasionally serializes `bodyText` as JSON (e.g. `{"bodyText":"hi"}`)
 * instead of a plain string, or concatenates a "null"/"undefined" prefix when
 * a template variable resolves to that. This unwrapper cleans both cases.
 */
function unwrapBodyText(maybe: string): string {
  let trimmed = (maybe ?? '').trim();
  if (!trimmed) return '';
  trimmed = trimmed.replace(/^(null|undefined|NaN)\s*/i, '').trim();
  if (!trimmed.startsWith('{')) return trimmed;
  try {
    const parsed = JSON.parse(trimmed);
    if (parsed && typeof parsed === 'object' && typeof parsed.bodyText === 'string') {
      return parsed.bodyText.trim();
    }
  } catch {
    /* fall through */
  }
  return trimmed;
}

/**
 * Convert a `yyyy-MM-ddTHH:mm:ss` (no offset) into an absolute Date by
 * interpreting it in the shop's timezone. The LLM emits local time; we must
 * not let `parseISO` treat it as the server's UTC.
 */
function parseShopLocal(dateTimeLocal: string, shopTimezone: string): Date {
  // Strip any trailing Z or offset the LLM may have added — we KNOW it's local
  const local = dateTimeLocal.replace(/[Zz]$|[+-]\d{2}:?\d{2}$/, '');
  // Build a Date by treating `local` as if it were UTC, then compute the
  // offset between UTC and the shop's timezone at that instant and apply it.
  const fauxUtc = new Date(local + 'Z');
  const tzString = fauxUtc.toLocaleString('en-US', { timeZone: shopTimezone });
  const tzAsDate = new Date(tzString);
  const offset = fauxUtc.getTime() - tzAsDate.getTime();
  return new Date(fauxUtc.getTime() + offset);
}

/**
 * Resolve the stylist for an operation. If the LLM did NOT pass an explicit
 * stylistId we only auto-pick if there's a single one in the shop — otherwise
 * we force the LLM to ask the client by returning an `error: 'stylist_required'`.
 */
async function resolveStylist(
  shopId: string,
  stylistId: string | undefined,
  scratchStylistId: string | undefined,
): Promise<
  | { ok: true; stylist: { id: string; name: string | null } }
  | { ok: false; error: 'stylist_not_found' | 'stylist_required'; options?: Array<{ id: string; name: string }> }
> {
  const explicitId = stylistId || scratchStylistId;
  if (explicitId) {
    const stylist = await db.stylist.findFirst({ where: { id: explicitId, shopId } });
    if (!stylist) return { ok: false, error: 'stylist_not_found' };
    return { ok: true, stylist: { id: stylist.id, name: stylist.name } };
  }
  const all = await db.stylist.findMany({ where: { shopId }, select: { id: true, name: true } });
  if (all.length === 0) return { ok: false, error: 'stylist_not_found' };
  if (all.length === 1) return { ok: true, stylist: { id: all[0].id, name: all[0].name } };
  return {
    ok: false,
    error: 'stylist_required',
    options: all.map(s => ({ id: s.id, name: s.name ?? '' })),
  };
}

// ──────────────────────────────────────────────────────────────────────────
// Tool definitions
// ──────────────────────────────────────────────────────────────────────────

export function buildTools(ctx: ToolContext) {
  const baseTools = {
    /**
     * Look up real availability for a service on a given date.
     * Updates scratch.lastSlotsOffered so subsequent tool calls know what was shown.
     */
    find_available_slots: tool({
      description:
        'Devuelve los horarios disponibles para un SERVICIO específico en una FECHA específica. SOLO úsalo cuando el cliente ya te dijo (o tocó) qué servicio quiere Y qué día. Si falta cualquiera de los dos, NO llames a esta tool: usa `present_service_picker` primero. Si el cliente mencionó una hora preferida ("a las 4", "en la tarde", "por la mañana"), PÁSALA en `preferredTime` para que los slots cercanos aparezcan primero.',
      inputSchema: z.object({
        serviceId: z.string().describe('ID exacto del servicio elegido por el cliente. NUNCA inventes uno.'),
        date: z
          .string()
          .describe('Fecha en formato yyyy-MM-dd. Calcúlala basándote en "hoy" del prompt.'),
        stylistId: z
          .string()
          .optional()
          .describe('ID del profesional si el cliente pidió a alguien específico (opcional si solo hay uno).'),
        preferredTime: z
          .string()
          .optional()
          .describe('Hora aproximada que pidió el cliente, formato HH:mm 24h. Ej: "16:00" si dijo "a las 4 PM" o "a las 4 de la tarde". Si dijo "tarde" usa "14:00", "mañana" usa "10:00", "noche" usa "17:00". Si no pidió hora, omite este campo.'),
      }),
      execute: async ({ serviceId, date, stylistId, preferredTime }) => {
        try {
          // HARD GUARD: refuse to search for slots unless the client has actually
          // confirmed a service. This prevents the LLM from inventing a default.
          if (!ctx.scratch.serviceConfirmedByClient || ctx.scratch.serviceId !== serviceId) {
            return {
              ok: false,
              error: 'service_not_confirmed_by_client',
              message:
                'El cliente NO ha confirmado todavía qué servicio quiere. NO pases serviceId por tu cuenta. Llama a `present_service_picker` para que el cliente elija. Solo después de que toque uno (verás "[ACCIÓN DEL CLIENTE] Eligió el servicio...") podrás llamar find_available_slots.',
            };
          }

          const service = await db.service.findFirst({
            where: { id: serviceId, shopId: ctx.shopId, isActive: true },
            select: { id: true, name: true, price: true, duration: true },
          });
          if (!service) return { ok: false, error: 'service_not_found' };

          // Guard: refuse dates in the past
          const dateObj = parseISO(`${date}T23:59:59`);
          const today = new Date();
          today.setHours(0, 0, 0, 0);
          if (isBefore(dateObj, today)) {
            return { ok: false, error: 'date_in_past', message: 'Esa fecha ya pasó. Usa hoy o cualquier día futuro.' };
          }

          const stylistRes = await resolveStylist(ctx.shopId, stylistId, ctx.scratch.stylistId);
          if (!stylistRes.ok) return stylistRes;

          const slots = await getOptimizedSlots(ctx.shopId, stylistRes.stylist.id, date, service.id);

          // Filter past slots if the date is today — compare in the shop's TZ,
          // not the server's UTC (otherwise night-time in Asia hits "tomorrow" in UTC).
          const now = new Date();
          const todayStr = formatYMD(now, ctx.shopTimezone);
          let filtered = slots;
          if (date === todayStr) {
            const nowHHMM = formatHHmm(now, ctx.shopTimezone);
            filtered = slots.filter(s => s > nowHHMM);
          }

          // If the client expressed a preferred time, reorder by PROXIMITY to that
          // hour first. Top 9 will be the 9 closest. This avoids the case where
          // the optimizer's "best for business" slots hide what the client actually asked for.
          if (preferredTime && /^\d{2}:\d{2}$/.test(preferredTime)) {
            const [ph, pm] = preferredTime.split(':').map(Number);
            const targetMin = ph * 60 + pm;
            filtered = [...filtered].sort((a, b) => {
              const [ah, am] = a.split(':').map(Number);
              const [bh, bm] = b.split(':').map(Number);
              return Math.abs(ah * 60 + am - targetMin) - Math.abs(bh * 60 + bm - targetMin);
            });
          }

          ctx.scratch.serviceId = service.id;
          ctx.scratch.serviceName = service.name;
          ctx.scratch.servicePrice = service.price;
          ctx.scratch.serviceDuration = service.duration;
          ctx.scratch.stylistId = stylistRes.stylist.id;
          ctx.scratch.stylistName = stylistRes.stylist.name || undefined;
          ctx.scratch.lastSlotsOffered = filtered.slice(0, 9);
          ctx.scratch.lastSlotsDate = date;

          return {
            ok: true,
            service: { id: service.id, name: service.name, price: service.price, duration: service.duration },
            stylist: { id: stylistRes.stylist.id, name: stylistRes.stylist.name },
            date,
            dateLabel: format(parseISO(`${date}T12:00:00`), "EEEE d 'de' MMMM", { locale: es }),
            slots: filtered.slice(0, 9),
            totalAvailable: filtered.length,
          };
        } catch (err: any) {
          return { ok: false, error: 'find_slots_failed', details: err?.message };
        }
      },
    }),

    /**
     * Sweep the next N days looking for the first day with any availability.
     */
    find_next_available: tool({
      description:
        'Barre los próximos 7 días buscando el primer día con horarios disponibles para un servicio. Úsalo solo cuando el cliente pide "el próximo hueco" SIN especificar día.',
      inputSchema: z.object({
        serviceId: z.string().describe('ID del servicio (de la lista oficial)'),
        stylistId: z.string().optional(),
      }),
      execute: async ({ serviceId, stylistId }) => {
        try {
          if (!ctx.scratch.serviceConfirmedByClient || ctx.scratch.serviceId !== serviceId) {
            return {
              ok: false,
              error: 'service_not_confirmed_by_client',
              message:
                'El cliente NO ha confirmado servicio. Llama a `present_service_picker` primero. NO inventes un serviceId.',
            };
          }
          const service = await db.service.findFirst({
            where: { id: serviceId, shopId: ctx.shopId, isActive: true },
            select: { id: true, name: true, price: true, duration: true },
          });
          if (!service) return { ok: false, error: 'service_not_found' };

          const stylistRes = await resolveStylist(ctx.shopId, stylistId, ctx.scratch.stylistId);
          if (!stylistRes.ok) return stylistRes;

          const today = new Date();
          // Compare in shop's timezone, not server's UTC
          const nowHHMM = formatHHmm(today, ctx.shopTimezone);
          const todayStr = formatYMD(today, ctx.shopTimezone);
          for (let offset = 0; offset < 7; offset++) {
            const d = addDays(today, offset);
            const dateStr = formatYMD(d, ctx.shopTimezone);
            let slots = await getOptimizedSlots(ctx.shopId, stylistRes.stylist.id, dateStr, service.id);
            if (dateStr === todayStr) {
              slots = slots.filter(s => s > nowHHMM);
            }
            if (slots.length > 0) {
              ctx.scratch.serviceId = service.id;
              ctx.scratch.serviceName = service.name;
              ctx.scratch.servicePrice = service.price;
              ctx.scratch.serviceDuration = service.duration;
              ctx.scratch.stylistId = stylistRes.stylist.id;
              ctx.scratch.stylistName = stylistRes.stylist.name || undefined;
              ctx.scratch.lastSlotsOffered = slots.slice(0, 9);
              ctx.scratch.lastSlotsDate = dateStr;
              return {
                ok: true,
                service: { id: service.id, name: service.name, price: service.price, duration: service.duration },
                stylist: { id: stylistRes.stylist.id, name: stylistRes.stylist.name },
                firstAvailableDate: dateStr,
                dateLabel: format(d, "EEEE d 'de' MMMM", { locale: es }),
                slots: slots.slice(0, 9),
                daysSearched: offset + 1,
              };
            }
          }
          return { ok: true, noneFound: true, daysSearched: 7 };
        } catch (err: any) {
          return { ok: false, error: 'find_next_failed', details: err?.message };
        }
      },
    }),

    /**
     * Create the appointment in the DB. Use ONLY after the client has confirmed.
     */
    create_appointment: tool({
      description:
        'Crea la cita en el sistema. ⚠️ SOLO úsalo cuando hayas recibido un mensaje "[ACCIÓN DEL CLIENTE] Tocó ✅ Confirmar" O cuando el cliente escribió textualmente "sí"/"dale"/"confirmo"/"perfecto" DESPUÉS de haber visto el resumen de present_confirmation. NUNCA antes.',
      inputSchema: z.object({
        serviceId: z.string(),
        dateTime: z.string().describe('Fecha y hora en ISO 8601 LOCAL del shop: yyyy-MM-ddTHH:mm:ss (sin Z ni offset).'),
        stylistId: z.string().optional(),
        clientName: z.string().describe('Nombre del cliente. Si no lo sabes, pregúntalo ANTES de llamar esta tool.'),
      }),
      execute: async ({ serviceId, dateTime, stylistId, clientName }) => {
        try {
          if (!clientName || clientName.trim().toLowerCase() === 'cliente' || clientName.trim().length < 2) {
            return { ok: false, error: 'client_name_required', message: 'Pregúntale al cliente su nombre antes de crear la cita.' };
          }

          if (!ctx.scratch.serviceConfirmedByClient || ctx.scratch.serviceId !== serviceId) {
            return {
              ok: false,
              error: 'service_not_confirmed_by_client',
              message: 'El cliente NO confirmó este servicio. NO crees la cita.',
            };
          }

          const service = await db.service.findFirst({
            where: { id: serviceId, shopId: ctx.shopId, isActive: true },
          });
          if (!service) return { ok: false, error: 'service_not_found' };

          const stylistRes = await resolveStylist(ctx.shopId, stylistId, ctx.scratch.stylistId);
          if (!stylistRes.ok) return stylistRes;

          const start = parseShopLocal(dateTime, ctx.shopTimezone);
          if (isBefore(start, new Date())) {
            return { ok: false, error: 'datetime_in_past', message: 'Esa hora ya pasó. Ofrece otro slot.' };
          }
          const end = addMinutes(start, service.duration);

          // Verify the slot was one we ACTUALLY offered (anti-hallucination guard).
          // CRITICAL: format in the shop's timezone, not the server's UTC.
          // lastSlotsOffered stores "HH:mm" in shop-local time; if we format
          // the parsed start in UTC the comparison always fails for non-UTC shops.
          const dateStr = formatYMD(start, ctx.shopTimezone);
          const hhmm = formatHHmm(start, ctx.shopTimezone);
          if (
            ctx.scratch.lastSlotsDate === dateStr &&
            Array.isArray(ctx.scratch.lastSlotsOffered) &&
            ctx.scratch.lastSlotsOffered.length > 0 &&
            !ctx.scratch.lastSlotsOffered.includes(hhmm)
          ) {
            return {
              ok: false,
              error: 'slot_not_offered',
              message: `La hora ${hhmm} no estaba entre las opciones que mostraste (${ctx.scratch.lastSlotsOffered.join(', ')}). Vuelve a ofrecer slots con find_available_slots.`,
            };
          }

          // Conflict guard
          const conflict = await db.appointment.findFirst({
            where: {
              shopId: ctx.shopId,
              stylistId: stylistRes.stylist.id,
              status: { in: ['SCHEDULED', 'CONFIRMED'] },
              startTime: { lt: end },
              endTime: { gt: start },
            },
            select: { id: true, startTime: true },
          });
          if (conflict) return { ok: false, error: 'slot_taken' };

          const client = await db.client.upsert({
            where: {
              shopId_phoneNumber: {
                shopId: ctx.shopId,
                phoneNumber: ctx.phoneNumber,
              },
            },
            update: { name: clientName },
            create: {
              shopId: ctx.shopId,
              phoneNumber: ctx.phoneNumber,
              name: clientName,
              preferredContact: 'WHATSAPP',
            },
          });

          const appt = await db.appointment.create({
            data: {
              shopId: ctx.shopId,
              clientId: client.id,
              clientName,
              clientWhatsApp: ctx.phoneNumber,
              serviceId: service.id,
              stylistId: stylistRes.stylist.id,
              startTime: start,
              endTime: end,
              status: 'CONFIRMED',
            },
          });

          await db.client.update({
            where: { id: client.id },
            data: { visitCount: { increment: 1 } },
          });

          // Clear scratch — appointment lifecycle is done
          ctx.scratch.lastSlotsOffered = undefined;
          ctx.scratch.lastSlotsDate = undefined;
          ctx.scratch.serviceConfirmedByClient = false;
          ctx.scratch.serviceId = undefined;
          ctx.scratch.serviceName = undefined;
          ctx.scratch.serviceDuration = undefined;
          ctx.scratch.servicePrice = undefined;

          return {
            ok: true,
            appointmentId: appt.id,
            dateLabel: formatDateTime12h(start, ctx.shopTimezone),
            service: service.name,
            stylist: stylistRes.stylist.name,
          };
        } catch (err: any) {
          return { ok: false, error: 'create_failed', details: err?.message };
        }
      },
    }),

    /**
     * Get all upcoming appointments for the current client.
     */
    get_client_appointments: tool({
      description:
        'Devuelve las citas FUTURAS del cliente que escribió. Úsalo cuando el cliente pregunte por sus citas o quiera cancelar/reagendar sin haber especificado cuál.',
      inputSchema: z.object({}),
      execute: async () => {
        const upcoming = await db.appointment.findMany({
          where: {
            shopId: ctx.shopId,
            clientWhatsApp: ctx.phoneNumber,
            startTime: { gte: new Date() },
            status: { in: ['SCHEDULED', 'CONFIRMED'] },
          },
          orderBy: { startTime: 'asc' },
          take: 5,
          include: { service: true, stylist: true },
        });
        return {
          ok: true,
          appointments: upcoming.map(a => ({
            id: a.id,
            dateTime: a.startTime.toISOString(),
            dateLabel: formatDateTime12h(a.startTime, ctx.shopTimezone),
            service: a.service?.name,
            stylist: a.stylist?.name,
            status: a.status,
          })),
        };
      },
    }),

    cancel_appointment: tool({
      description: 'Cancela una cita por ID. Sólo úsalo tras confirmar con el cliente.',
      inputSchema: z.object({
        appointmentId: z.string(),
      }),
      execute: async ({ appointmentId }) => {
        try {
          const appt = await db.appointment.findFirst({
            where: { id: appointmentId, shopId: ctx.shopId, clientWhatsApp: ctx.phoneNumber },
          });
          if (!appt) return { ok: false, error: 'appointment_not_found_or_not_yours' };
          if (appt.status === 'CANCELLED') return { ok: true, alreadyCancelled: true };
          await db.appointment.update({ where: { id: appointmentId }, data: { status: 'CANCELLED' } });
          return {
            ok: true,
            dateLabel: formatDateTime12h(appt.startTime, ctx.shopTimezone),
          };
        } catch (err: any) {
          return { ok: false, error: 'cancel_failed', details: err?.message };
        }
      },
    }),

    /**
     * Prepare to reschedule an appointment. Does NOT cancel yet — only loads
     * the service into scratch so the next slot search inherits it. The original
     * appointment is only cancelled once the new one is successfully created.
     */
    reschedule_appointment: tool({
      description:
        'Prepara el reagendado: carga el servicio del appointment en scratch para que `find_available_slots` lo herede. NO cancela la cita original — eso pasa automáticamente al crear la nueva. Tras llamar esta tool, usa `find_available_slots` con el nuevo día que pida el cliente.',
      inputSchema: z.object({
        appointmentId: z.string(),
      }),
      execute: async ({ appointmentId }) => {
        try {
          const appt = await db.appointment.findFirst({
            where: { id: appointmentId, shopId: ctx.shopId, clientWhatsApp: ctx.phoneNumber },
            include: { service: true, stylist: true },
          });
          if (!appt) return { ok: false, error: 'appointment_not_found_or_not_yours' };
          ctx.scratch.serviceId = appt.service?.id;
          ctx.scratch.serviceName = appt.service?.name;
          ctx.scratch.servicePrice = appt.service?.price;
          ctx.scratch.serviceDuration = appt.service?.duration;
          ctx.scratch.stylistId = appt.stylist?.id;
          ctx.scratch.stylistName = appt.stylist?.name ?? undefined;
          return {
            ok: true,
            oldAppointmentId: appt.id,
            oldDateLabel: formatDateTime12h(appt.startTime, ctx.shopTimezone),
            service: { id: appt.service?.id, name: appt.service?.name },
            stylist: { id: appt.stylist?.id, name: appt.stylist?.name },
            note: 'La cita original todavía existe. Crea la nueva con create_appointment y luego cancel_appointment con este oldAppointmentId.',
          };
        } catch (err: any) {
          return { ok: false, error: 'reschedule_failed', details: err?.message };
        }
      },
    }),

    /**
     * Resolve a service the client mentioned by name (text). Use this when the
     * client writes the service literally — "quiero un corte clásico", "fade",
     * "barba y corte". Returns the matched service AND sets the confirmation
     * flag in scratch so downstream tools accept it.
     *
     * If NO clear match: returns suggestions so the LLM can clarify.
     */
    lookup_service_by_name: tool({
      description:
        'Busca un servicio por el nombre que escribió el cliente (no tocó ningún picker). Úsalo cuando el cliente dijo el nombre en texto. Confirma el servicio en scratch si hay match exacto. Si NO hay match claro, devuelve sugerencias y debes mostrar el picker.',
      inputSchema: z.object({
        clientText: z
          .string()
          .describe('Texto literal del cliente con el nombre del servicio (ej. "quiero un fade", "corte clásico").'),
      }),
      execute: async ({ clientText }) => {
        const services = await db.service.findMany({
          where: { shopId: ctx.shopId, isActive: true },
          select: { id: true, name: true, price: true, duration: true },
        });
        if (services.length === 0) return { ok: false, error: 'no_services' };

        const lower = clientText.toLowerCase().trim();
        // Score each service by name match
        const scored = services.map(s => {
          const name = s.name.toLowerCase();
          let score = 0;
          if (lower === name) score = 100;
          else if (lower.includes(name)) score = 80;
          else if (name.includes(lower)) score = 60;
          else {
            // Token overlap
            const lowerTokens = new Set(lower.split(/\s+/).filter(t => t.length > 2));
            const nameTokens = name.split(/\s+/).filter(t => t.length > 2);
            const matches = nameTokens.filter(t => lowerTokens.has(t)).length;
            if (matches > 0) score = 40 + matches * 10;
          }
          return { service: s, score };
        }).filter(x => x.score > 0).sort((a, b) => b.score - a.score);

        if (scored.length === 0) {
          return {
            ok: false,
            error: 'no_match',
            message: 'Ningún servicio coincide. Llama a present_service_picker.',
            availableServices: services.map(s => ({ id: s.id, name: s.name })),
          };
        }

        const top = scored[0];
        const isAmbiguous = scored.length > 1 && top.score - scored[1].score < 20;

        if (top.score < 60 || isAmbiguous) {
          return {
            ok: false,
            error: 'ambiguous_match',
            message: 'Match no es claro. Llama a present_service_picker para que el cliente elija.',
            candidates: scored.slice(0, 3).map(x => ({ id: x.service.id, name: x.service.name, score: x.score })),
          };
        }

        // Confirmed match — set flag in scratch
        ctx.scratch.serviceId = top.service.id;
        ctx.scratch.serviceName = top.service.name;
        ctx.scratch.servicePrice = top.service.price;
        ctx.scratch.serviceDuration = top.service.duration;
        ctx.scratch.serviceConfirmedByClient = true;

        return {
          ok: true,
          confirmed: true,
          service: {
            id: top.service.id,
            name: top.service.name,
            price: top.service.price,
            duration: top.service.duration,
          },
        };
      },
    }),

    // ──────────────────────────────────────────────────────────────────
    // UI tools
    // ──────────────────────────────────────────────────────────────────

    present_service_picker: tool({
      description:
        'Muestra al cliente la lista interactiva de servicios para que toque uno. ⚠️ DEBES usar esto cuando el cliente quiera agendar/ver horarios y no haya dicho explícitamente qué servicio quiere. NO asumas un servicio por defecto.',
      inputSchema: z.object({
        bodyText: z
          .string()
          .max(800)
          .describe('Texto introductorio en tu voz. Máximo 2 oraciones, sin listar los servicios (la lista la pone WhatsApp).'),
      }),
      execute: async ({ bodyText }) => {
        if (ctx.pendingInteractive) {
          return { ok: false, error: 'already_presented_this_turn' };
        }
        const services = await db.service.findMany({
          where: { shopId: ctx.shopId, isActive: true },
          orderBy: { price: 'asc' },
        });
        if (services.length === 0) return { ok: false, error: 'no_services' };
        const rows = services.slice(0, 10).map(s => ({
          id: `service:${s.id}`,
          title: s.name.slice(0, 24),
          description: `RD$${s.price} · ${s.duration}min`,
        }));
        ctx.pendingInteractive = {
          kind: 'list',
          bodyText: unwrapBodyText(bodyText),
          buttonLabel: 'Ver servicios',
          sections: [{ title: 'Servicios', rows }],
        };
        return { ok: true, presented: services.length };
      },
    }),

    present_stylist_picker: tool({
      description:
        'Muestra al cliente la lista de profesionales disponibles para que toque uno. Úsalo cuando hay varios profesionales y el cliente no ha dicho con quién prefiere atenderse.',
      inputSchema: z.object({
        bodyText: z.string().max(800),
      }),
      execute: async ({ bodyText }) => {
        if (ctx.pendingInteractive) {
          return { ok: false, error: 'already_presented_this_turn' };
        }
        const stylists = await db.stylist.findMany({
          where: { shopId: ctx.shopId },
          select: { id: true, name: true },
        });
        if (stylists.length === 0) return { ok: false, error: 'no_stylists' };
        const rows = stylists.slice(0, 10).map(s => ({
          id: `stylist:${s.id}`,
          title: (s.name ?? 'Profesional').slice(0, 24),
        }));
        ctx.pendingInteractive = {
          kind: 'list',
          bodyText: unwrapBodyText(bodyText),
          buttonLabel: 'Ver profesionales',
          sections: [{ title: 'Profesionales', rows }],
        };
        return { ok: true, presented: stylists.length };
      },
    }),

    present_slot_picker: tool({
      description:
        'Muestra al cliente los horarios disponibles como lista interactiva con secciones Mañana/Tarde. Úsalo después de find_available_slots cuando quieras que el cliente elija con un toque.',
      inputSchema: z.object({
        bodyText: z.string().max(800).describe('Texto introductorio. Ejemplo: "Estos son los horarios del lunes 12:"'),
      }),
      execute: async ({ bodyText }) => {
        if (ctx.pendingInteractive) {
          return { ok: false, error: 'already_presented_this_turn' };
        }
        const slots = ctx.scratch.lastSlotsOffered ?? [];
        if (slots.length === 0) return { ok: false, error: 'no_slots_loaded' };
        const morning = slots.filter(s => parseInt(s.split(':')[0], 10) < 12);
        const afternoon = slots.filter(s => parseInt(s.split(':')[0], 10) >= 12);
        const sections: Array<{
          title: string;
          rows: Array<{ id: string; title: string; description?: string }>;
        }> = [];
        if (morning.length) sections.push({ title: 'Mañana', rows: morning.map(s => ({ id: `slot:${s}`, title: to12h(s) })) });
        if (afternoon.length) sections.push({ title: 'Tarde', rows: afternoon.map(s => ({ id: `slot:${s}`, title: to12h(s) })) });
        ctx.pendingInteractive = {
          kind: 'list',
          bodyText: unwrapBodyText(bodyText),
          buttonLabel: 'Ver horarios',
          sections,
        };
        return { ok: true, presented: slots.length };
      },
    }),

    present_confirmation: tool({
      description:
        '⚠️ ÚLTIMO PASO antes de crear la cita: muestra al cliente botones para confirmar/cambiar/cancelar. Úsalo SOLO cuando tengas servicio + fecha + hora + nombre del cliente. NO crees la cita sin pasar por aquí.',
      inputSchema: z.object({
        bodyText: z
          .string()
          .max(800)
          .describe(
            'Resumen provisional (no digas "te reservo", sino "te dejo listo este horario para que confirmes"). Incluye servicio, fecha, hora y profesional.',
          ),
      }),
      execute: async ({ bodyText }) => {
        if (ctx.pendingInteractive) {
          return { ok: false, error: 'already_presented_this_turn' };
        }
        // Hard guard: service must have been confirmed by the client. Prevents
        // the LLM from rushing to confirmation with an invented service.
        if (!ctx.scratch.serviceConfirmedByClient || !ctx.scratch.serviceId) {
          return {
            ok: false,
            error: 'service_not_confirmed_by_client',
            message: 'No puedes mostrar confirmación sin que el cliente haya elegido un servicio. Usa present_service_picker primero.',
          };
        }
        // NOTE: do NOT block on lastSlotsOffered being empty — if the client
        // tapped a slot, lastSlotsOffered may have been consumed elsewhere or
        // the scratch may be loading partial state. The serviceConfirmed flag
        // is the real guard; from here forward we trust the LLM to pass a
        // sensible bodyText with the time.
        ctx.pendingInteractive = {
          kind: 'buttons',
          bodyText: unwrapBodyText(bodyText),
          buttons: [
            { id: 'confirm:yes', title: '✅ Confirmar' },
            { id: 'confirm:change', title: '✏️ Cambiar hora' },
            { id: 'confirm:no', title: '❌ Cancelar' },
          ],
        };
        return { ok: true };
      },
    }),

    send_location: tool({
      description:
        'Envía la ubicación del negocio como pin de mapa nativo de WhatsApp. Úsalo cuando el cliente pregunte por la dirección, cómo llegar, ubicación o pida el mapa.',
      inputSchema: z.object({}),
      execute: async () => {
        if (ctx.pendingInteractive) {
          return { ok: false, error: 'already_presented_this_turn' };
        }
        const shop = await db.shop.findUnique({
          where: { id: ctx.shopId },
          select: { name: true, address: true, latitude: true, longitude: true },
        });
        if (!shop?.latitude || !shop?.longitude) {
          return {
            ok: false,
            error: 'no_coordinates',
            addressFallback: shop?.address ?? null,
          };
        }
        ctx.pendingInteractive = {
          kind: 'location',
          latitude: shop.latitude,
          longitude: shop.longitude,
          name: shop.name ?? undefined,
          address: shop.address ?? undefined,
        };
        return { ok: true, sentTo: shop.address };
      },
    }),

    escalate_to_human: tool({
      description:
        'Marca esta conversación como "tomada por humano". Úsalo cuando el cliente esté muy enojado, tenga una queja grave, o pida hablar con una persona específica.',
      inputSchema: z.object({
        reason: z.enum(['sentiment', 'client_request', 'complex_query']),
      }),
      execute: async ({ reason }) => {
        await markHumanTakeover(ctx.shopId, ctx.phoneNumber, reason);
        return { ok: true };
      },
    }),
  };

  // Wrap every tool's execute() with observability logging. This way each
  // call is timed and persisted to ToolCall without touching individual tools.
  const wrapped: any = {};
  for (const [name, def] of Object.entries(baseTools)) {
    const t = def as any;
    const original = t.execute;
    const tracked = async (input: any) => {
      const started = Date.now();
      try {
        const output = await original(input);
        logToolCall({
          toolName: name,
          shopId: ctx.shopId,
          phoneNumber: ctx.phoneNumber,
          durationMs: Date.now() - started,
          input,
          output,
        });
        return output;
      } catch (err: any) {
        logToolCall({
          toolName: name,
          shopId: ctx.shopId,
          phoneNumber: ctx.phoneNumber,
          durationMs: Date.now() - started,
          input,
          output: { ok: false, error: 'thrown_exception', message: err?.message },
        });
        throw err;
      }
    };
    wrapped[name] = { ...t, execute: tracked };
  }
  return wrapped as typeof baseTools;
}

export type AgentTools = ReturnType<typeof buildTools>;
