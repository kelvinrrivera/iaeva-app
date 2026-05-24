# WhatsApp Embedded Signup — Design

**Fecha:** 2026-05-03
**Autor:** Kelvin + Claude
**Estado:** Aprobado, listo para plan de implementación

---

## Contexto

DomiCita es un SaaS multi-tenant para barberías. Cada barbería conecta su número de WhatsApp Business vía Embedded Signup de Meta para que un chatbot AI responda automáticamente. La implementación actual tiene 5 bugs críticos identificados por auditoría contra la documentación oficial de Meta:

1. Frontend lanza Embedded Signup con `sessionInfoVersion: '2'` (string) y escucha evento `'FINISH'`. Coexistence requiere `sessionInfoVersion: 3` (numérico) y emite `'FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING'`. Los `metaHints` (waba_id, phone_number_id) llegan vacíos al backend.
2. Webhook detecta echoes con campos inexistentes (`from_phone_number_id`, `direction === 'outgoing'`). Los echoes reales vienen en `changes[].field === 'smb_message_echoes'` con array `value.message_echoes[]`.
3. Suscripción de webhooks se hace sin `subscribed_fields`. Por default Meta no activa `smb_message_echoes`.
4. Guardamos user long-lived token (60 días, se invalida silenciosamente). Tech Provider oficial usa System User token.
5. Endpoint `/register-phone` siempre falla en Coexistence con error 2388001.

Caso real: el shop de Elvin (`cmogbjldr000004ld20iamych`) quedó en `status: PENDING`, `platform_type: NOT_APPLICABLE`, WABA `BLOCKED` por payment + verification, webhook nunca dispara, 0 conversaciones creadas.

## Objetivos

1. **Onboarding correcto que funciona a la primera** para los dos modos de conexión soportados (Coexistence y Cloud API puro)
2. **Health-check automático post-conexión** con auto-recuperación silenciosa para problemas reparables
3. **Notificaciones proactivas al barbero** solo para problemas que requieren acción humana (payment, verification)
4. **Migración automática** de shops existentes (incluido Elvin) al deployar
5. **Cero intervención de soporte** para escalar a cientos de barberías

## No-objetivos

- No vamos a soportar el modo "On-Premise" de WhatsApp (legacy). Solo Cloud API y Coexistence.
- No vamos a manejar tokens scoped por tenant. Usamos un único System User token global de DomiCita Tech Provider.
- No vamos a hacer dashboard dedicado de health (`/dashboard/whatsapp/health`). Solo banner contextual cuando algo necesita atención.
- No vamos a auto-reparar problemas que requieren acción humana (payment, business verification).

---

## 1. Arquitectura general

Cinco unidades con responsabilidades claras:

### 1.1 Frontend launcher
**Archivo:** `components/whatsapp/EmbeddedSignupLauncher.tsx` (nuevo)

Encapsula el `FB.login` con la versión correcta de la API de Meta. Recibe del padre el `featureType` elegido por el barbero (`'coexistence' | 'cloud_api'`) y dispara el popup correspondiente. Captura el evento postMessage correcto y devuelve `{ code, phoneNumberId, wabaId, featureType }` al padre.

### 1.2 Onboarding wizard step
**Archivo:** `app/onboarding/whatsapp/page.tsx` (paso nuevo en el wizard existente)

Pantalla que pregunta: "¿Quieres mantener WhatsApp Business activo en tu teléfono?". Sí → Coexistence. No → Cloud API puro. Después renderiza el launcher.

### 1.3 Backend connect
**Archivo:** `lib/whatsapp/embedded-signup.ts` (refactor completo)

Recibe `{ code, phoneNumberId, wabaId, featureType }`, hace exchange code→token, descubre la WABA con el System User token de DomiCita, suscribe webhooks con `subscribed_fields` explícito, llama `/register` solo si `featureType === 'cloud_api'`, persiste el shop con campos nuevos.

### 1.4 Health-check engine
**Archivo:** `lib/whatsapp/health-check.ts` (nuevo)

Función pura que dado un `shopId` consulta Meta y devuelve clasificación de problemas (critical, warnings, recoverable). Se usa post-conexión, en cron horario para auto-recuperación, y desde dashboard para diagnóstico manual.

### 1.5 Webhook receiver
**Archivo:** `app/api/whatsapp/webhook/route.ts` (refactor parcial)

Branching correcto por `change.field`: `messages` → flujo bot; `smb_message_echoes` → iterar `value.message_echoes[]` y disparar takeover con el número del cliente.

### 1.6 Schema (Prisma)
Añadir a modelo `Shop`:

```prisma
metaPlatformType         String?    // 'CLOUD_API' | 'NOT_APPLICABLE' | 'ON_PREMISE'
coexistenceMode          Boolean    @default(false)
metaSubscribedFields     String[]   @default([])
whatsappReadyAt          DateTime?  // cuando pasó a CONNECTED desde PENDING
whatsappLastHealthCheckAt DateTime?
needsReconnect           Boolean    @default(false)
```

### 1.7 Migration script
**Archivo:** `scripts/migrate-whatsapp-connections.ts` (nuevo)
**Endpoint admin:** `app/api/admin/migrate-whatsapp/route.ts` (nuevo, gateado por `SUPER_ADMIN`)

Corre una vez al deployar. Idempotente. Para cada shop existente con `whatsappEnabled: true`:
1. Llama Meta para obtener estado real
2. Backfill de campos nuevos del schema
3. Auto-reparación: re-suscribe webhooks con `subscribed_fields` correctos si faltan
4. Clasifica el shop: healthy / con warnings / `needsReconnect: true`

---

## 2. Flujo de datos del onboarding

### 2.1 Coexistence path

```
1. Wizard: "¿Mantener WhatsApp Business en tu teléfono?" → Sí

2. Frontend EmbeddedSignupLauncher dispara FB.login con:
   {
     config_id: NEXT_PUBLIC_FB_CONFIG_ID,
     response_type: 'code',
     override_default_response_type: true,
     extras: {
       sessionInfoVersion: 3,
       featureType: 'whatsapp_business_app_onboarding',
       setup: { solutionID: NEXT_PUBLIC_FB_SOLUTION_ID }
     }
   }

3. Listener postMessage acepta:
   - event === 'FINISH'                                  (legacy)
   - event === 'FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING' (Coexistence v3)

4. Frontend → POST /api/whatsapp/embedded-signup
   { code, phoneNumberId, wabaId, featureType: 'coexistence' }

5. Backend:
   a) exchangeCodeForToken(code) → user access token (uso único, descartado)
   b) verifyMetaToken(userToken) → confirma identidad
   c) findWabaWithSystemToken(wabaId, phoneNumberId) usando WHATSAPP_SYSTEM_USER_TOKEN
      (DomiCita es Tech Provider, ve la WABA aunque el user token no la vea)
   d) subscribeApp(wabaId) con body:
      POST /{waba}/subscribed_apps
      {
        subscribed_fields: [
          'messages',
          'smb_message_echoes',
          'message_template_status_update',
          'account_alerts'
        ]
      }
   e) NO llamar /register (Coexistence)
   f) Persistir shop:
      metaAccessToken: WHATSAPP_SYSTEM_USER_TOKEN     ← global, no scoped
      metaPhoneNumberId, metaBusinessAccountId, wabaId
      metaPlatformType: phone.platform_type           ← 'NOT_APPLICABLE' inicialmente
      coexistenceMode: true
      metaSubscribedFields: [...]
      whatsappEnabled: false                          ← se decide en (g)
   g) result = await runHealthCheck(shopId)
   h) Aplicar lógica de severidad (Sección 3)

6. Frontend recibe respuesta tipada:
   { ready: true } → marca shop activo, redirige al dashboard
   { ready: false, status: 'PENDING', estimateHours: 6 }
       → muestra "WhatsApp se está sincronizando", barbero usa el resto del SaaS
   { ready: false, blockers: [...] }
       → muestra lista de pasos a resolver con links

7. (Si PENDING) cron horario hace polling al status del número.
   Cuando phone.status === 'CONNECTED':
     shop.whatsappEnabled = true
     shop.whatsappReadyAt = now
     manda WhatsApp al ownerNotificationPhone:
       "Tu bot de DomiCita ya está activo y respondiendo. ¡Listo para vender!"
```

### 2.2 Cloud API puro path

Igual al anterior con tres diferencias:

- Frontend `extras` SIN `featureType` (default Cloud API)
- Backend SÍ llama `POST /{phone-id}/register {messaging_product, pin}`
  - Si responde 200 → `metaPlatformType: 'CLOUD_API'`, `coexistenceMode: false`
  - Si falla con `error_subcode: 2388001` → throw `PHONE_IN_USE` con userMessage:
    "Tu número aún está activo en WhatsApp del teléfono. Elimina la cuenta de la app (Ajustes → Cuenta → Eliminar mi cuenta), espera 5 minutos y vuelve a intentar."
- `subscribed_fields` NO incluye `smb_message_echoes` (no aplica en Cloud API puro)

---

## 3. Health-check y lógica de severidad

### 3.1 Tipo de respuesta

```typescript
type HealthCheckResult = {
  canReceive: boolean    // webhook funciona, mensajes entrantes llegan
  canSend: boolean       // outbound permitido por Meta
  ready: boolean         // canReceive && canSend
  critical: Blocker[]    // bloquea uso, requiere acción del barbero
  warnings: Blocker[]    // funciona con limitaciones
  recoverable: Issue[]   // puede arreglarse solo, sin acción del barbero
}

type Blocker = {
  code: 'PHONE_PENDING'
      | 'PHONE_NOT_REGISTERED'
      | 'NO_PAYMENT'
      | 'NOT_VERIFIED'
      | 'WABA_BLOCKED'
      | 'TOKEN_INVALID'
  severity: 'critical' | 'warning'
  message: string         // user-facing en español
  action?: {
    label: string
    url?: string          // link directo a Meta Business Manager si aplica
  }
}

type Issue = {
  code: 'SUBSCRIPTION_LOST' | 'SUBSCRIPTION_FIELDS_INCOMPLETE'
  autoRepairResult?: 'repaired' | 'failed'
}
```

### 3.2 Las 7 verificaciones

| # | Check | API call | Si falla |
|---|---|---|---|
| 1 | Phone status | `GET /{phone-id}?fields=status,platform_type` | `PENDING` Coexistence → critical (4-6h sync). `PENDING` Cloud API → critical reparable (`/register`) |
| 2 | Phone health | `GET /{phone-id}?fields=health_status` | `BLOCKED` con razón → severity según razón |
| 3 | Subscribed app | `GET /{waba-id}/subscribed_apps` | App no aparece → recoverable (auto-resuscribir) |
| 4 | Subscribed fields | (mismo endpoint) | Falta `messages` o (Coexistence) `smb_message_echoes` → recoverable |
| 5 | WABA payment | `GET /{waba-id}?fields=primary_funding_id,health_status` | Sin payment → warning (puede recibir, no enviar templates) |
| 6 | Business verification | (mismo endpoint, `business_verification_status`) | No verified → warning |
| 7 | Token validity | `GET /me?access_token=SYSTEM_USER_TOKEN` | Token inválido → critical sistema (alerta admin, no barbero) |

### 3.3 Lógica aplicada post-conexión

```
if (critical.length > 0):
  ready: false
  shop.whatsappEnabled = false
  Si solo PHONE_PENDING (sync de Coexistence):
    shop.needsReconnect = false  // no es problema del barbero
    Frontend muestra "sincronizando 4-6h"
  Else:
    shop.needsReconnect = true
    Frontend muestra blockers con acciones

if (recoverable.length > 0):
  Auto-reparar silenciosamente
  Re-correr health-check
  Si recoverable persiste tras reparar → log para admin DomiCita

if (warnings.length > 0 && critical.length === 0):
  ready: true (funciona con limitaciones)
  shop.whatsappEnabled = true
  Banner amarillo persistente en dashboard
  notifyOwner(warnings) → WhatsApp al ownerNotificationPhone
  Schedule re-notify cada 24h hasta resolver

if (todo OK):
  ready: true
  shop.whatsappEnabled = true
  shop.whatsappLastHealthCheckAt = now
```

### 3.4 Auto-recuperación silenciosa

Reparable sin avisar al barbero:
- Suscripción de app caída → re-suscribir
- `subscribed_fields` incompleto → re-suscribir con fields correctos

NO reparable (requiere barbero):
- Payment method
- Business verification
- Status PENDING (depende de Meta)

### 3.5 Notificaciones al barbero

Vía WhatsApp al `ownerNotificationPhone` (sistema existente `lib/whatsapp/owner-notifier.ts`):

- **Critical:** inmediato, una vez. Mensaje describe qué hacer + link a Meta Business Manager.
- **Warning:** una vez al detectar, luego cada 24h hasta resolver.
- **Transición exitosa** (`PENDING` → `CONNECTED`): "Tu bot ya está activo".

### 3.6 Cron horario

**Endpoint:** `app/api/cron/whatsapp-health/route.ts` (nuevo)
**Schedule:** `0 * * * *` (cada hora) vía GitHub Actions

```
1. Lista shops con whatsappEnabled OR needsReconnect (excluyendo los sin Meta)
2. Para cada uno:
   a) result = await runHealthCheck(shop.id)
   b) Si recoverable → auto-reparar
   c) Si nuevo critical o warning vs último check → notifyOwner
   d) Si pasó de PENDING a CONNECTED → marca activo + notifica
   e) shop.whatsappLastHealthCheckAt = now
```

---

## 4. Webhook receiver — fix del detector de echoes

### 4.1 Diff conceptual

```typescript
// payload Meta v22:
//   body.entry[].changes[].field === 'messages'           ← cliente escribe
//   body.entry[].changes[].field === 'smb_message_echoes' ← dueño manda desde app del teléfono

const change = entry?.changes?.[0];
const value = change?.value;

if (!value) return ok();

// 1. Status updates (delivered/read) — log y salir
if (value.statuses) return ok();

// 2. Echoes desde la app de WhatsApp Business del dueño (Coexistence)
if (change.field === 'smb_message_echoes' && value.message_echoes) {
  await handleEchoes(value);
  return ok();
}

// 3. Mensaje entrante del cliente
if (change.field === 'messages' && value.messages) {
  await handleIncoming(value);
  return ok();
}

return ok();
```

### 4.2 `handleEchoes(value)`

Itera `value.message_echoes[]`. Cada echo tiene:
- `from`: número del business
- `to`: número del cliente
- `id`, `timestamp`, `type`, `text`, etc.

Para cada echo:
1. Buscar shop por `metadata.phone_number_id`
2. Llamar `markHumanTakeover(shop.id, echo.to, 'manual_reply')` con el número del **cliente** (`echo.to`)

### 4.3 `handleIncoming(value)`

Es el flujo de hoy ya existente, sin cambios. El bot procesa el mensaje, decide respuesta, envía.

### 4.4 Cambios concretos en archivo existente

Eliminar de `app/api/whatsapp/webhook/route.ts`:
- Líneas 124-145 (detector basado en `from_phone_number_id` y `direction`)
- Pre-carga de `markHumanTakeover` dentro del bloque echo (se mueve a `handleEchoes`)

Añadir branching nuevo basado en `change.field`.

---

## 5. Migration script para shops existentes

### 5.1 Lógica del script

```
Para cada shop con whatsappEnabled: true Y metaPhoneNumberId IS NOT NULL:

1. Llamar Meta:
   - GET /{phone-id}?fields=status,platform_type,health_status
   - GET /{waba-id}/subscribed_apps
   - GET /{waba-id}?fields=primary_funding_id,business_verification_status

2. Backfill schema:
   shop.metaPlatformType = phone.platform_type
   shop.coexistenceMode = (phone.platform_type === 'NOT_APPLICABLE')
     // Heurística: el código actual hardcodea coexistence: true en TODO el onboarding,
     // así que los shops existentes que no terminaron de migrar a CONNECTED quedaron
     // en NOT_APPLICABLE. Si terminaron en CLOUD_API o ON_PREMISE, no son Coexistence.
   shop.metaSubscribedFields = subscribedApps.find(ours)?.subscribed_fields ?? []

3. Reparación automática:
   if (nuestra app NO está en subscribed_apps):
     POST /{waba}/subscribed_apps con fields correctos
   if (subscribed_fields incompleto):
     re-suscribir con fields correctos
       (Coexistence: incluye smb_message_echoes)
       (Cloud API: sin smb_message_echoes)

4. Clasificar:
   result = await runHealthCheck(shop.id)
   Si critical (excepto PHONE_PENDING en Coexistence):
     shop.whatsappEnabled = false
     shop.needsReconnect = true
     log: { shopId, blockers, action: 'flagged_for_reconnect' }
   Si solo warnings:
     mantener whatsappEnabled (deja como estaba)
     log: { shopId, warnings, action: 'kept_with_warnings' }
   Si todo OK:
     shop.whatsappLastHealthCheckAt = now
     log: { shopId, action: 'healthy' }

5. Output final agregado:
   { total, healthy, withWarnings, flaggedForReconnect, errors }
```

### 5.2 UX para shops `needsReconnect: true`

Banner rojo persistente arriba del dashboard:
> "Tu WhatsApp necesita reconectarse — toma 2 minutos. [Reconectar ahora →]"

El botón abre el wizard de Sección 2. Mientras tanto, las features de WhatsApp aparecen en gris con tooltip "Reconecta tu WhatsApp para habilitar esto".

### 5.3 Caso Elvin

El script detectará:
- `status: PENDING`, `platform_type: NOT_APPLICABLE`
- WABA bloqueada por payment + verification
- Subscribed app correcto pero fields probablemente incompletos

Lo va a marcar `needsReconnect: true`. Cuando entre a su dashboard verá el banner. Puede:
1. Click "Reconectar" → wizard nuevo elige Coexistence o Cloud API
2. Si Cloud API: `/register` funciona si elimina del teléfono primero
3. Si Coexistence: nuevo Embedded Signup con `sessionInfoVersion: 3` correcto, queda sincronizando 4-6h
4. Health-check post-conexión le mostrará warnings de payment + verification con links directos

### 5.4 Cómo se ejecuta

- **Manual local:** `pnpm tsx scripts/migrate-whatsapp-connections.ts` (usa `DIRECT_URL`)
- **Endpoint admin:** `POST /api/admin/migrate-whatsapp` gateado por `SUPER_ADMIN` para correrlo desde producción sin terminal local.

---

## 6. Testing y validación

### 6.1 Tests unitarios (Vitest)

**`__tests__/whatsapp/embedded-signup.test.ts`**
- `connectWhatsAppToShop({ featureType: 'coexistence' })` → no llama `/register`, persiste `coexistenceMode: true`, fields incluyen `smb_message_echoes`
- `connectWhatsAppToShop({ featureType: 'cloud_api' })` → llama `/register` con pin, persiste `coexistenceMode: false`, fields sin `smb_message_echoes`
- `/register` responde 2388001 → throw `PHONE_IN_USE` con `userMessage` en español
- Code exchange falla → throw con mensaje claro
- Mock de `fetch` global a Meta API (no llamadas reales)

**`__tests__/whatsapp/webhook.test.ts`**
- Payload `messages` → llama `handleIncoming`, no `handleEchoes`
- Payload `smb_message_echoes` con 1 echo → llama `markHumanTakeover` con `echo.to`
- Payload `smb_message_echoes` con N echoes → procesa todos
- Payload `statuses` → no llama nada, devuelve 200
- Firma HMAC inválida → 401
- Shop no encontrado → 200 (silencioso, no retry)

**`__tests__/whatsapp/health-check.test.ts`**
- Phone `CONNECTED` + todo OK → `ready: true, critical: [], warnings: []`
- Phone `PENDING` Coexistence → `critical: [PHONE_PENDING]`, `ready: false`
- Phone `PENDING` Cloud API → `critical: [PHONE_NOT_REGISTERED]` con action recoverable
- WABA `BLOCKED` por payment → `warnings: [NO_PAYMENT]`, `canSend: false`, `canReceive: true`
- WABA no verified → `warnings: [NOT_VERIFIED]`
- Subscribed app falta → `recoverable: [SUBSCRIPTION_LOST]`
- Subscribed fields incompleto → `recoverable: [SUBSCRIPTION_FIELDS_INCOMPLETE]`
- Token inválido → `critical: [TOKEN_INVALID]` (alerta admin)

### 6.2 Tests de integración (manual antes de deploy)

Documentado en `docs/superpowers/specs/whatsapp-onboarding-runbook.md`:

1. Crear shop nuevo de prueba en Meta Business Manager sandbox
2. **Onboarding Coexistence:**
   - Verificar `sessionInfoVersion: 3` en payload del FB.login (DevTools Network)
   - Verificar listener captura `FINISH_WHATSAPP_BUSINESS_APP_ONBOARDING`
   - Verificar shop creado con `coexistenceMode: true`, `metaSubscribedFields` incluye `smb_message_echoes`
   - Esperar transición PENDING → CONNECTED (4-6h)
   - Cliente envía mensaje → bot responde
   - Dueño responde desde app del teléfono → conversación marca HUMAN
3. **Onboarding Cloud API puro:**
   - `/register` se llama y devuelve 200
   - `metaPlatformType: CLOUD_API`, `coexistenceMode: false`
   - Cliente envía mensaje → bot responde inmediatamente
4. **Migration script en staging** contra BD de prueba con shops "rotos" simulados
5. **Health-check cron** corre, repara fields faltantes, no toca shops sanos

### 6.3 Métricas post-deploy

- `% de shops conectados que llegan a CONNECTED en < 24h`
- `% de shops nuevos que pasan health-check en primer intento`
- `# de shops con needsReconnect: true` (debe ir a 0 en pocos días)
- `# de auto-reparaciones por hora` (suscripciones perdidas, etc.)
- Alerta si `# de tokens inválidos > 0` (problema sistema-wide)

---

## 7. Variables de entorno requeridas

```
WHATSAPP_SYSTEM_USER_TOKEN=...        # Existe. Token global DomiCita Tech Provider.
META_APP_ID=...                       # Existe.
FACEBOOK_APP_SECRET=...               # Existe.
NEXT_PUBLIC_FB_CONFIG_ID=...          # Existe.
NEXT_PUBLIC_FB_SOLUTION_ID=...        # NUEVO. Solution ID de DomiCita en Meta.
WHATSAPP_WEBHOOK_VERIFY_TOKEN=...     # Existe.
CRON_SECRET=...                       # Existe.
```

Verificar `NEXT_PUBLIC_FB_SOLUTION_ID` en Meta Business Manager → Tech Providers → DomiCita.

## 8. Configuración Meta App Dashboard

En la app de Facebook (App ID `1599970834652215`):

1. **Webhooks → WhatsApp Business Account:** marcar también `smb_message_echoes` (no solo `messages`).
2. **App Review:** confirmar permisos `whatsapp_business_management` y `whatsapp_business_messaging` aprobados incluyendo Coexistence.
3. **Solution:** crear/confirmar Solution ID y pegarlo en env `NEXT_PUBLIC_FB_SOLUTION_ID`.

---

## 9. Plan de rollout

1. **Pre-deploy:** crear/confirmar Solution ID en Meta, añadir env var en Vercel.
2. **Deploy de schema:** `prisma migrate deploy` con campos nuevos.
3. **Deploy de código** (frontend + backend + webhook + cron).
4. **Correr migration script** vía endpoint admin: `POST /api/admin/migrate-whatsapp`.
5. **Validar:** revisar logs del migration, verificar Elvin marcado `needsReconnect: true`.
6. **Notificar manualmente a Elvin** que entre al dashboard y reconecte.
7. **Monitorear cron horario** primeras 48h: % shops llegando a CONNECTED, # auto-reparaciones, # tokens inválidos.

## 10. Riesgos y mitigaciones

| Riesgo | Probabilidad | Impacto | Mitigación |
|---|---|---|---|
| Solution ID no existe o requiere App Review nuevo | Media | Alto (bloquea Coexistence) | Verificar antes de deploy. Si requiere review, deployar Cloud API puro primero. |
| Meta cambia formato de payload sin aviso | Baja | Alto | Tests unitarios con payloads reales capturados. Logs detallados en webhook. |
| Migration script falla parcialmente | Media | Medio | Idempotente, se puede correr múltiples veces. Logs por shop. |
| Health-check cron sobrecarga Meta API rate limits | Baja | Medio | Spread temporal entre shops, max 1 call/sec/shop. Cache de 1h en BD. |
| Token global comprometido | Baja | Crítico | Rotación rápida desde Meta Business Manager + Vercel env vars. Procedimiento documentado en runbook. |

---

## Anexo A: Referencias oficiales Meta

- [Onboard WhatsApp Business app users (Coexistence)](https://developers.facebook.com/documentation/business-messaging/whatsapp/embedded-signup/onboarding-business-app-users/)
- [Embedded Signup overview](https://developers.facebook.com/documentation/business-messaging/whatsapp/embedded-signup/overview/)
- [smb_message_echoes webhook reference](https://developers.facebook.com/docs/whatsapp/cloud-api/webhooks/reference/smb_message_echoes/)
- [System User access tokens](https://developers.facebook.com/documentation/business-messaging/whatsapp/access-tokens/)
- [Phone Number API](https://developers.facebook.com/documentation/business-messaging/whatsapp/reference/whatsapp-business-phone-number/phone-number-api)
- [WhatsApp Tech Provider integration guide — Twilio](https://www.twilio.com/docs/whatsapp/isv/tech-provider-program/integration-guide)
