# DomiCita — Auditoría de Seguridad Pre-Producción

**Fecha:** 25 de febrero 2026
**Alcance:** Full-stack — Next.js 14, Prisma, Supabase, Stripe, WhatsApp/Twilio
**Objetivo:** Evaluación de seguridad para cumplimiento ISO 27001/SOC 2

---

## Resumen Ejecutivo

| Categoría | Estado | Hallazgos |
|-----------|--------|-----------|
| Inyección SQL | ✅ SEGURO | 0 — Prisma ORM parameterizado |
| XSS | ✅ SEGURO | 0 — No hay dangerouslySetInnerHTML |
| Autenticación | ⚠️ RIESGO MEDIO | 2 hallazgos |
| Autorización multi-tenant | ⚠️ RIESGO ALTO | 2 hallazgos |
| Webhooks | ⚠️ RIESGO MEDIO | 2 hallazgos |
| SSRF | 🔴 CRÍTICO | 1 hallazgo |
| Validación de entrada | 🔴 CRÍTICO | 4 hallazgos |
| Secrets/PII en logs | 🔴 CRÍTICO | 3 hallazgos |
| Headers HTTP | ✅ BUENO | CSP, HSTS, X-Frame implementados |
| Rate limiting | ✅ BUENO | Dual-layer (Redis + memoria) |
| Dependencias | ⚠️ RIESGO MEDIO | 9 vulnerabilidades (2 high, 6 moderate, 1 low) |
| Stripe | ⚠️ RIESGO MEDIO | 1 hallazgo |

**Veredicto: NO LISTO para producción sin remediar los hallazgos CRÍTICOS.**

---

## Hallazgos CRÍTICOS (arreglar antes de producción)

### C1. SSRF en transcripción de notas de voz
**Archivo:** `lib/whatsapp/voice-transcriber.ts`
**CWE-918 (Server-Side Request Forgery)**

`downloadTwilioAudio(mediaUrl)` y `downloadMetaAudio(mediaId)` hacen `fetch()` a URLs externas sin validar el dominio. Un atacante puede enviar un webhook con `MediaUrl0=http://169.254.169.254/latest/meta-data/` para leer metadata de AWS/GCP y exfiltrar credenciales.

**Remediación:**
```typescript
const url = new URL(mediaUrl);
const allowedHosts = ['media.twiliocdn.com', 'api.twilio.com'];
if (!allowedHosts.some(h => url.hostname.endsWith(h))) {
  throw new Error('Invalid media URL');
}
```

---

### C2. Bypass de autenticación por header `x-shop-id`
**Archivo:** `app/api/chatbot/slots-optimized/route.ts`
**CWE-639 (Authorization Bypass)**

El endpoint acepta `x-shop-id` + `x-internal-key` (CRON_SECRET) como alternativa al auth normal. Si CRON_SECRET se filtra, un atacante puede leer la disponibilidad de cualquier negocio.

**Remediación:** Eliminar el override por headers. Usar llamadas directas a funciones en vez de HTTP interno.

---

### C3. PII en logs de producción
**Archivos:** `lib/auth-utils.ts`, `lib/whatsapp/chatbot-handler.ts`, webhooks
**CWE-532 (Information Exposure Through Log Files)**

Emails, números de teléfono y nombres de clientes se loguean en texto plano:
```typescript
console.log("[Auth-Utils] Supabase Auth email:", user.email);
console.log('[Chatbot] Processing:', { from: phoneNumber });
```

Esto viola ISO 27001 A.18.1.4 (privacidad de datos personales) y potencialmente GDPR/LGPD.

**Remediación:** Enmascarar PII en logs:
```typescript
log.info('[Chatbot] Processing', { from: phone.slice(-4), shopId });
```

---

### C4. Validación de entrada ausente en rutas POST
**Archivos:** `app/api/locations/route.ts`, `app/api/team/invitations/route.ts`
**CWE-20 (Improper Input Validation)**

- `/api/locations`: Acepta `name`, `address`, `timezone` sin límite de longitud ni validación de formato
- `/api/team/invitations`: `email` y `role` sin validación — role puede ser cualquier string
- Ninguno valida ownership de IDs referenciados (serviceId, stylistId)

**Remediación:** Agregar schemas Zod en todas las rutas POST/PUT/PATCH:
```typescript
const schema = z.object({
  name: z.string().min(2).max(100),
  email: z.string().email().max(255),
  role: z.enum(['ORG_ADMIN', 'TEAM_LEADER', 'PROFESSIONAL']),
});
```

---

## Hallazgos ALTOS (arreglar en 1 semana)

### H1. Webhook Meta acepta requests sin firma si falta FACEBOOK_APP_SECRET
**Archivo:** `app/api/whatsapp/webhook/route.ts:23-26`

Si la env var `FACEBOOK_APP_SECRET` no está configurada, `verifyWebhookSignature()` retorna `true` — aceptando CUALQUIER webhook. Esto debería fallar, no pasar.

**Remediación:**
```typescript
if (!appSecret) {
  log.error('[Meta] FACEBOOK_APP_SECRET missing — rejecting all webhooks');
  return false;  // Era: return true
}
```

### H2. Stripe webhook confía en metadata del checkout
**Archivo:** `app/api/stripe/webhook/route.ts`

El plan se toma de `session.metadata.plan` que el cliente puede manipular. Un atacante podría enviar `plan: "BUSINESS"` pagando solo el plan FREE.

**Remediación:** Derivar el plan del `price_id` de la suscripción, NO de metadata.

### H3. Endpoint `/api/places/autocomplete` sin auth ni rate limit
**Archivo:** `app/api/places/autocomplete/route.ts`

Google Places API accesible sin autenticación. Genera costos por uso de API key de Google.

**Remediación:** Envolver con `withAuth()` y agregar rate limiting.

### H4. Error messages exponen detalles internos
**19 rutas** retornan `error.message` al cliente, que puede contener nombres de tablas, campos DB, o rutas del filesystem.

**Remediación:** Siempre retornar mensaje genérico en producción:
```typescript
return NextResponse.json({ error: 'Error interno' }, { status: 500 });
```

### H5. Sentry session replay sin mascareo de PII
**Archivo:** `sentry.client.config.ts`

`maskAllText: false` permite que Sentry capture texto ingresado por usuarios (nombres, teléfonos, direcciones).

**Remediación:** `maskAllText: true`

---

## Hallazgos MEDIOS

| # | Hallazgo | Archivo | CWE |
|---|----------|---------|-----|
| M1 | Email fallback en `requireAuth()` puede causar colisiones de identidad | `lib/auth-middleware.ts:59-83` | CWE-206 |
| M2 | `findFirst()` sin filtro shopId en `/api/availability/slots` | `app/api/availability/slots/route.ts` | CWE-639 |
| M3 | CRON_SECRET comparación no constant-time (timing attack) | `app/api/cron/reminders/route.ts` | CWE-208 |
| M4 | CSP incluye `unsafe-eval` y `unsafe-inline` | `middleware.ts:35` | - |
| M5 | ICS feed protegido solo por token (sin origin check) | `app/api/calendar/feed/[token]/route.ts` | CWE-862 |
| M6 | `Math.random()` para códigos de invitación (no criptográfico) | `app/api/team/invitations/route.ts` | CWE-330 |
| M7 | Sin timeout en fetch a Google Places API | `app/api/places/*/route.ts` | CWE-400 |

---

## Hallazgos BAJOS / INFORMATIVOS

| # | Hallazgo |
|---|----------|
| L1 | Sin CSRF tokens explícitos (Supabase cookies manejan parcialmente) |
| L2 | Sin rotación automática de CRON_SECRET |
| L3 | Sin audit log persistente para acciones admin |
| L4 | Sin session timeout explícito (depende de default Supabase) |
| L5 | Teléfonos logueados completos en webhook handlers |

---

## Dependencias — `pnpm audit`

```
9 vulnerabilidades encontradas
Severity: 2 high | 6 moderate | 1 low
```

| Paquete | Severidad | Causa | Acción |
|---------|-----------|-------|--------|
| `minimatch` (vía eslint) | HIGH | ReDoS | Actualizar eslint |
| `minimatch` (vía eslint-config-next) | HIGH | ReDoS | Actualizar eslint-config-next |
| `lodash` (vía prisma dev) | MODERATE | Prototype pollution | Solo en dev — aceptable |
| `hono` (vía prisma dev) | MODERATE x3 | XSS, cache bypass | Solo en dev — aceptable |

**Nota:** Las 7 vulnerabilidades moderate/low son en devDependencies (prisma dev, eslint). No afectan el bundle de producción. Las 2 HIGH en minimatch son vía eslint — actualizar.

---

## Lo que está BIEN implementado

- **Prisma ORM** — 0 inyecciones SQL, queries parametrizadas en todas las rutas
- **Rate limiting dual** — Upstash Redis + fallback en memoria con sliding window
- **Headers de seguridad** — HSTS 2 años, X-Frame-Options, X-Content-Type-Options, CSP, Referrer-Policy, Permissions-Policy
- **Webhook signatures** — Meta (HMAC-SHA256), Twilio (validateRequest), Stripe (constructWebhookEvent)
- **Multi-tenancy** — Mayoría de queries scoped por shopId
- **Auth middleware** — requireAuth(), withAuth(), withAuthAndRole() bien estructurados
- **Logger estructurado** — JSON en producción para log drain
- **.gitignore** — .env* excluidos, .vercelignore configurado

---

## Plan de Remediación ISO

### Semana 1 — CRÍTICOS (bloqueantes para producción)
1. [ ] Fix SSRF en voice-transcriber (whitelist de dominios)
2. [ ] Eliminar override `x-shop-id`/`x-internal-key`
3. [ ] Enmascarar PII en todos los logs (email, phone, name)
4. [ ] Agregar validación Zod a `/api/locations`, `/api/team/invitations`
5. [ ] Fix `verifyWebhookSignature()` — fallar si falta secret

### Semana 2 — ALTOS
6. [ ] Fix Stripe webhook — derivar plan de price_id, no metadata
7. [ ] Agregar auth a `/api/places/*` y `/api/exchange-rate`
8. [ ] Sanitizar error messages en 19 rutas
9. [ ] Sentry `maskAllText: true`
10. [ ] Actualizar eslint/minimatch (fix 2 HIGH audit)

### Semana 3 — MEDIOS
11. [ ] Evaluar eliminar email fallback en requireAuth()
12. [ ] Fix `findFirst()` sin shopId en availability
13. [ ] Usar `crypto.timingSafeEqual()` para CRON_SECRET
14. [ ] Agregar `AbortSignal.timeout(5000)` a fetch externos
15. [ ] Cambiar `Math.random()` por `crypto.randomBytes()` en invitaciones

### Ongoing — Mantenimiento
16. [ ] Implementar audit log (tabla SecurityAuditLog)
17. [ ] Configurar Dependabot / Renovate para updates automáticos
18. [ ] Revisar CSP — intentar eliminar unsafe-eval/unsafe-inline
19. [ ] Documentar política de retención de datos

---

## Controles ISO 27001 Evaluados

| Control | Estado | Notas |
|---------|--------|-------|
| A.9.2.1 Registro de usuarios | ⚠️ | Email fallback puede causar colisiones |
| A.9.4.1 Restricción de acceso | ✅ | Auth middleware implementado |
| A.9.4.3 Sistema de gestión de contraseñas | ⚠️ | Delegado a Supabase (verificar config) |
| A.10.1.1 Política de uso de controles criptográficos | ⚠️ | Webhook sigs OK, CRON comparison no constant-time |
| A.12.4.1 Registro de eventos | 🔴 | PII en logs, sin audit trail |
| A.13.1.1 Controles de red | ✅ | Rate limiting, headers |
| A.14.1.2 Seguridad de servicios de aplicaciones | ⚠️ | SSRF, input validation gaps |
| A.14.2.1 Política de desarrollo seguro | ⚠️ | Sin validación Zod consistente |
| A.18.1.4 Privacidad y protección de datos personales | 🔴 | PII en logs, Sentry sin mask |

---

*Auditoría realizada con análisis estático del código fuente. Se recomienda complementar con penetration testing dinámico (OWASP ZAP o Burp Suite) antes del go-live.*
