/**
 * WhatsApp Template Seeder
 *
 * Auto-creates the default set of message templates when WhatsApp is activated
 * for a shop. Templates are created as DRAFT and submitted for approval.
 *
 * This is idempotent — calling it multiple times won't duplicate templates.
 */

import { db } from '@/lib/database';

// ─── Default Templates ──────────────────────────────────────────────

export interface TemplateBlueprint {
  name: string;
  category: 'UTILITY' | 'MARKETING' | 'AUTHENTICATION';
  purpose: string;
  bodyText: string;
  variables: Record<string, string>;
}

/**
 * Convert "Barbería El Conde" → "barberia_el_conde" — safe Meta template name.
 * Meta requires lowercase + underscores, max 512 chars.
 */
function slugifyShopName(name: string): string {
  return name
    .toLowerCase()
    .normalize('NFD').replace(/[̀-ͯ]/g, '') // strip accents
    .replace(/[^a-z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .slice(0, 40);
}

/**
 * Build the per-shop template set. The shop name is baked directly into
 * the body text (not a variable) so Meta sees each WABA's templates as
 * unique content — avoids cross-tenant pattern detection at scale.
 *
 * The shop slug is appended to the template name (still unique per WABA,
 * but easier to identify in Meta Business Manager when supporting tenants).
 */
/**
 * Vocabulary adaptation by shop type. Templates use these labels so a
 * barbershop says "tu corte" while a beauty salon says "tu servicio" and
 * a hybrid says "tu cita". Keeps Meta templates feeling native to the
 * shop's identity without duplicating the full template list per niche.
 */
type ShopTypeKey = 'BARBERSHOP' | 'BEAUTY_SALON' | 'HYBRID';

interface NicheVocabulary {
  serviceWord: string;     // "corte" / "servicio" / "cita"
  serviceWordCap: string;  // "Corte" / "Servicio" / "Cita"
  professionalWord: string; // "barbero" / "estilista" / "profesional"
  serviceArticle: string;  // "tu" — same for all but reserved
  greetingMascN: string;   // "compa" / "amigo" — kept neutral
  reactivationVerb: string;// "cortar" / "atenderte" / "verte"
}

const NICHE_VOCAB: Record<ShopTypeKey, NicheVocabulary> = {
  BARBERSHOP: {
    serviceWord: 'corte',
    serviceWordCap: 'Corte',
    professionalWord: 'barbero',
    serviceArticle: 'tu',
    greetingMascN: 'cliente',
    reactivationVerb: 'darte un corte fresco',
  },
  BEAUTY_SALON: {
    serviceWord: 'servicio',
    serviceWordCap: 'Servicio',
    professionalWord: 'estilista',
    serviceArticle: 'tu',
    greetingMascN: 'cliente',
    reactivationVerb: 'atenderte y consentirte',
  },
  HYBRID: {
    serviceWord: 'cita',
    serviceWordCap: 'Cita',
    professionalWord: 'profesional',
    serviceArticle: 'tu',
    greetingMascN: 'cliente',
    reactivationVerb: 'atenderte de nuevo',
  },
};

export function buildDefaultTemplates(shopName: string, shopType: ShopTypeKey = 'BARBERSHOP'): TemplateBlueprint[] {
  const slug = slugifyShopName(shopName) || 'shop';
  const safeName = shopName.trim() || 'tu negocio';
  const v = NICHE_VOCAB[shopType] ?? NICHE_VOCAB.BARBERSHOP;

  return [
    {
      name: `recordatorio_24h_${slug}`,
      category: 'UTILITY',
      purpose: 'appointment_reminder_24h',
      bodyText: `Hola {{1}}, te recordamos desde ${safeName} que manana tienes reservado {{2}} a las {{3}}. Te esperamos puntual. Si necesitas reagendar, escribenos cuanto antes para reorganizar tu horario.`,
      variables: { '1': 'Cliente', '2': v.serviceWordCap, '3': 'Hora' },
    },
    {
      name: `recordatorio_6h_${slug}`,
      category: 'UTILITY',
      purpose: 'appointment_reminder_6h',
      bodyText: `Hola {{1}}, te recordamos desde ${safeName} que hoy tienes reservado {{2}} a las {{3}}, en aproximadamente 6 horas. Te esperamos puntual.`,
      variables: { '1': 'Cliente', '2': v.serviceWordCap, '3': 'Hora' },
    },
    {
      name: `recordatorio_2h_${slug}`,
      category: 'UTILITY',
      purpose: 'appointment_reminder_2h',
      bodyText: `Hola {{1}}, te recordamos desde ${safeName} que en aproximadamente 2 horas, a las {{2}}, te esperamos para tu cita. Ya casi es el momento.`,
      variables: { '1': 'Cliente', '2': 'Hora' },
    },
    {
      name: `recordatorio_1h_${slug}`,
      category: 'UTILITY',
      purpose: 'appointment_reminder_1h',
      bodyText: `Hola {{1}}, te recordamos desde ${safeName} que tu cita comienza en aproximadamente 1 hora. Te esperamos en nuestro local con todo listo para atenderte.`,
      variables: { '1': 'Cliente' },
    },
    {
      name: `confirmacion_cita_${slug}`,
      category: 'UTILITY',
      purpose: 'appointment_confirmed',
      bodyText: `Hola {{1}}, gracias por reservar con ${safeName}. ${v.serviceArticle.charAt(0).toUpperCase() + v.serviceArticle.slice(1)} ${v.serviceWord} ha quedado confirmado para el dia {{2}} a las {{3}}: {{4}}. Te esperamos puntual y si necesitas reagendar contactanos con antelacion. Cualquier duda nos puedes escribir por aqui.`,
      variables: { '1': 'Cliente', '2': 'Fecha', '3': 'Hora', '4': v.serviceWordCap },
    },
    {
      name: `turno_walkin_${slug}`,
      category: 'UTILITY',
      purpose: 'walkin_notification',
      bodyText: `Hola, te escribimos desde ${safeName} para informarte que tu turno se acerca. Actualmente estas en la posicion {{1}} de la cola y el tiempo estimado de espera es de {{2}} minutos aproximadamente. Te avisaremos de nuevo cuando sea casi tu turno. Gracias por tu paciencia.`,
      variables: { '1': 'Posicion', '2': 'Minutos' },
    },
    {
      name: `nueva_reserva_admin_${slug}`,
      category: 'UTILITY',
      purpose: 'new_booking',
      bodyText: `Tienes una nueva reserva en ${safeName}. El cliente {{1}} ha reservado {{2}} para el dia {{3}} a las {{4}}. ${v.serviceArticle.charAt(0).toUpperCase() + v.serviceArticle.slice(1)} ${v.serviceWord} esta asignado a {{5}}. Revisa tu agenda en la aplicacion para mas detalles o si necesitas hacer algun cambio.`,
      variables: { '1': 'Cliente', '2': v.serviceWordCap, '3': 'Fecha', '4': 'Hora', '5': v.professionalWord.charAt(0).toUpperCase() + v.professionalWord.slice(1) },
    },
    {
      name: `cancelacion_${slug}`,
      category: 'UTILITY',
      purpose: 'cancellation',
      bodyText: `Hola, te confirmamos desde ${safeName} que ${v.serviceArticle} ${v.serviceWord} reservado para el {{2}} a las {{3}} ({{1}}) queda cancelado. Si quieres reagendar, escribenos por aqui y buscamos un nuevo hueco que te quede bien. Lamentamos las molestias.`,
      variables: { '1': v.serviceWordCap, '2': 'Fecha', '3': 'Hora' },
    },
    {
      name: `reactivacion_cliente_${slug}`,
      category: 'MARKETING',
      purpose: 'reactivation',
      bodyText: `Hola {{1}}, te escribimos desde ${safeName} porque hace tiempo que no nos visitas y nos encantaria ${v.reactivationVerb}. Esta semana tenemos disponibilidad en varios horarios. Si quieres reservar contestanos a este mensaje y te ayudamos a encontrar un hueco que te convenga.`,
      variables: { '1': 'Cliente' },
    },
    // Owner notification templates
    {
      name: `aviso_nueva_cita_${slug}`,
      category: 'UTILITY',
      purpose: 'owner_new_booking',
      bodyText: `Nueva reserva en ${safeName}. Cliente: {{1}}. ${v.serviceWordCap}: {{2}}. Fecha: {{3}} a las {{4}} con {{5}}. Revisa los detalles en tu dashboard de DomiCita.`,
      variables: { '1': 'Cliente', '2': v.serviceWordCap, '3': 'Fecha', '4': 'Hora', '5': v.professionalWord.charAt(0).toUpperCase() + v.professionalWord.slice(1) },
    },
    {
      name: `aviso_cancelacion_${slug}`,
      category: 'UTILITY',
      purpose: 'owner_cancellation',
      bodyText: `Cancelacion en ${safeName}. Cliente: {{1}} cancelo {{3}} del {{2}}. Recuerda liberar ese horario en tu agenda.`,
      variables: { '1': 'Cliente', '2': 'Fecha_hora', '3': v.serviceWordCap },
    },
    {
      name: `aviso_cliente_molesto_${slug}`,
      category: 'UTILITY',
      purpose: 'owner_sentiment_alert',
      bodyText: `Atencion ${safeName}: un cliente esta molesto en WhatsApp. Numero: {{1}}. Revisa la conversacion en tu app para responder directamente.`,
      variables: { '1': 'Telefono' },
    },
    {
      name: `resumen_manana_${slug}`,
      category: 'UTILITY',
      purpose: 'owner_morning_digest',
      bodyText: `Buenos dias! Resumen de hoy en ${safeName}. Citas confirmadas: {{1}}. Primera cita: {{2}}. Ultima cita: {{3}}. Que tengas un excelente dia!`,
      variables: { '1': 'Total_citas', '2': 'Primera', '3': 'Ultima' },
    },
    {
      name: `resumen_noche_${slug}`,
      category: 'UTILITY',
      purpose: 'owner_evening_digest',
      bodyText: `Cierre del dia en ${safeName}. Citas completadas: {{1}} de {{2}}. No-shows: {{3}}. Clientes nuevos: {{4}}. Ingresos del dia: {{5}}. Buen trabajo!`,
      variables: { '1': 'Completadas', '2': 'Total', '3': 'No_shows', '4': 'Nuevos', '5': 'Ingresos' },
    },
  ];
}

/**
 * Static list kept for backward compat (used by length checks).
 * The actual templates seeded per-shop are generated by buildDefaultTemplates().
 */
export const DEFAULT_TEMPLATES = buildDefaultTemplates('default');

// Re-export PURPOSE_LABELS for backward compatibility
export { PURPOSE_LABELS } from './template-constants';

/**
 * Seed all default templates for a shop.
 * Idempotent — skips templates that already exist for the given purpose.
 *
 * Creates DB records and (for Meta) registers them via Graph API so they
 * enter Meta's approval queue immediately.
 */
export async function seedDefaultTemplates(shopId: string): Promise<{
  created: number;
  skipped: number;
  registered: number;
  errors: string[];
}> {
  const result = { created: 0, skipped: 0, registered: 0, errors: [] as string[] };

  const shop = await db.shop.findUnique({
    where: { id: shopId },
    select: {
      name: true,
      shopType: true,
      whatsappProvider: true,
      metaAccessToken: true,
      metaBusinessAccountId: true,
      wabaId: true,
    },
  });

  const provider = shop?.whatsappProvider || 'META';
  const templates = buildDefaultTemplates(
    shop?.name || 'tu negocio',
    (shop?.shopType as 'BARBERSHOP' | 'BEAUTY_SALON' | 'HYBRID') ?? 'BARBERSHOP',
  );

  const existing = await db.whatsAppTemplate.findMany({
    where: { shopId },
    select: { purpose: true },
  });
  const existingPurposes = new Set(existing.map(t => t.purpose));

  for (const tmpl of templates) {
    if (existingPurposes.has(tmpl.purpose)) {
      result.skipped++;
      continue;
    }

    try {
      await db.whatsAppTemplate.create({
        data: {
          shopId,
          name: tmpl.name,
          language: 'es',
          category: tmpl.category,
          bodyText: tmpl.bodyText,
          variables: tmpl.variables,
          provider,
          status: 'DRAFT',
          purpose: tmpl.purpose,
        },
      });
      result.created++;
    } catch (err: any) {
      console.error(`[Template Seeder] Error creating ${tmpl.purpose}:`, err.message);
      result.errors.push(`${tmpl.purpose}: ${err.message}`);
    }
  }

  // Register pending DRAFTs with Meta (only when shop is on META and has credentials)
  if (provider === 'META' && shop?.metaAccessToken && (shop.metaBusinessAccountId || shop.wabaId)) {
    try {
      const { registerPendingMetaTemplates } = await import('./template-manager');
      const reg = await registerPendingMetaTemplates(shopId);
      result.registered = reg.registered;
      result.errors.push(...reg.errors);
    } catch (err: any) {
      console.error('[Template Seeder] Meta registration failed:', err.message);
      result.errors.push(`meta_register: ${err.message}`);
    }
  }

  console.log(`[Template Seeder] Shop ${shopId}: created=${result.created}, skipped=${result.skipped}, registered=${result.registered}, errors=${result.errors.length}`);
  return result;
}
