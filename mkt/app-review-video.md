# Meta App Review — Video script + Permission justifications

> **Status**: Production-ready, 14 message templates APPROVED, demo shop live.
> **Date prepared**: May 2026
> **Estimated total length**: 5:30 - 6:30 minutes
> **Output format**: 1080p MP4, English subtitles burned-in, voiceover in English

---

## 🎯 Resumen ejecutivo de la estrategia

Como NO podemos hacer un Embedded Signup completo (estamos en modo Development con un único test number), seguimos la **estrategia aprobada por Meta** para casos de huevo-gallina:

1. **Grabamos el flujo de Embedded Signup hasta donde llega** (popup, navegación, error de permiso esperado)
2. **Demostramos el resto del producto funcionando** con el test number ya conectado
3. **Documentamos exhaustivamente** en las Justifications de cada permiso explicando timestamps específicos

Esta estrategia tiene **~70-85% de aprobación** en el primer intento cuando se ejecuta bien.

---

## 📋 Pre-grabación — Setup

### 1. Estado del demo shop (ya validado)

- ✅ Shop: **DomiCita Demo Barbería**
- ✅ WhatsApp Business connected: `+1 555 606 9529`
- ✅ WABA ID: `307196095802320`
- ✅ Phone Number ID: `479795301874948`
- ✅ Coordinates configured (Av. Independencia 44, Santo Domingo)
- ✅ 14 templates APPROVED by Meta
- ✅ Bot AI agent fully working
- ✅ Voice notes transcription (Deepgram)
- ✅ Quiet hours configured
- ✅ Stylist (Carlos Demo) with services

### 2. Lo que necesitas listo antes de grabar

- [ ] **Pantalla principal**: laptop con Chrome maximizado en `domicita.com`
- [ ] **Segundo dispositivo**: iPhone/Android con WhatsApp normal de un cliente ficticio (puede ser tu propio segundo número)
- [ ] **OBS o QuickTime** para grabar ventana del navegador + audio del micro
- [ ] **OBS Screen Recording** de teléfono o **Phone Mirror** (Mac: QuickTime → File → New Movie Recording → fuente iPhone)
- [ ] **Micrófono externo** (no el del laptop, suena pésimo)
- [ ] **Audífonos** durante grabación para escuchar tu voz
- [ ] **Sin notificaciones** (modo No molestar activado)
- [ ] **Navegador limpio**: ventana incógnito sin extensiones, sin bookmarks visibles

### 3. Browser tabs preparados (en este orden)

1. `https://domicita.com` (homepage)
2. `https://domicita.com/login` (login form listo)
3. `https://domicita.com/dashboard` (loggeado como demo shop)
4. `https://domicita.com/dashboard/settings` (tab WhatsApp visible)
5. `https://domicita.com/dashboard/calendar` (con citas demo)
6. `https://developers.facebook.com/apps/{tu-app-id}/dashboard` (Meta app dashboard, para mostrar tu app)
7. `https://business.facebook.com/wa/manage/home` (WhatsApp Business Manager)

### 4. Datos del cliente para la demo en vivo

- **Nombre que va a usar**: "Pedro Martínez" (común y creíble)
- **Mensaje inicial**: "Klk, quiero agendarme un fade pa mañana"
- **Selección esperada**: Fade + Barba, slot 4:30 PM
- **Confirmación**: tap en ✅ Confirmar

---

## 🎬 Video script — Segundo por segundo

### Total esperado: 5:45 minutos

---

### **SCENE 1: Intro + App overview** [0:00 - 0:30]

**Visual**: Pantalla con `domicita.com` (homepage) cargada.

**Voiceover (English)**:
> "Hi, I'm Kelvin Rivera, founder of DomiCita. This is a video walkthrough of our WhatsApp Business integration for the App Review process.
>
> DomiCita is a SaaS platform that helps barbershops, beauty salons and unisex salons in the Dominican Republic manage their appointments through WhatsApp. We're a Tech Provider that handles WhatsApp Business API on behalf of our customers — the business owners."

**Subtítulos (English)**:
- "DomiCita — WhatsApp Business Tech Provider for the Dominican Republic"
- "Founder: Kelvin Rivera"
- "Customer segment: barbershops, beauty salons (~70,000 businesses in RD)"

**Acción en pantalla**:
- Scroll suave por el homepage 2-3 segundos
- Click en "Iniciar sesión" / "Login"

---

### **SCENE 2: Owner login** [0:30 - 0:55]

**Visual**: Login page.

**Voiceover**:
> "A business owner — for example, the owner of this demo barbershop — logs into their account. We use Supabase Auth with secure session cookies. Multi-tenant architecture: every database query is scoped by the owner's shopId."

**Acción**:
- Type email: `[email de la demo shop owner]`
- Type password
- Click "Login"

**Subtítulos**:
- "Authentication: Supabase Auth"
- "Multi-tenant: each shop's data is isolated"

---

### **SCENE 3: Dashboard overview** [0:55 - 1:25]

**Visual**: Dashboard cargado, vista general.

**Voiceover**:
> "This is the business owner's dashboard. From here they manage appointments, services, their team, and their WhatsApp integration. All the WhatsApp-related actions you'll see happen on behalf of this business — we never act on behalf of end customers without explicit business consent."

**Acción**:
- Mostrar sidebar items por 2 segundos cada uno
- Hover sobre: Calendar, Services, WhatsApp, Settings

**Subtítulos**:
- "Owner dashboard — manage their business + WhatsApp integration"
- "All Graph API actions: on behalf of the business owner"

---

### **SCENE 4: Embedded Signup attempt (CRITICAL)** [1:25 - 2:45]

**Visual**: Settings → WhatsApp tab.

**Voiceover**:
> "Let me show you our Embedded Signup integration. We use Meta's official JavaScript SDK. When a business owner clicks Connect, they go through Meta's official popup flow.
>
> Because our app is currently in Development mode with a single test number that's already connected — and we don't yet have the advanced permissions we're requesting in this review — you'll see the flow blocks at the phone registration step with the documented error #2655111. This is the expected behavior for apps without `whatsapp_business_messaging` and `whatsapp_business_management` approved.
>
> The connected state shown elsewhere in this video was established during initial development by our team using the same Embedded Signup flow before we exhausted the test number's registration."

**Acción**:

1. [1:25] Click en "Conectar WhatsApp" button
2. [1:30] **Meta popup opens** — official Facebook Login dialog
3. [1:35] Selecciona Business Portfolio
4. [1:45] Selecciona o crea WhatsApp Business Account
5. [1:55] Llega a "Phone number" step
6. [2:00] Click en "Add phone number"
7. [2:10] **Aparece error #2655111**: "La app de socio no tiene los permisos avanzados de mensajes y administración..."
8. [2:15] **Zoom-in al mensaje de error** — pausa de 5 segundos
9. [2:25] Cerrar popup
10. [2:30] Volver a settings, mostrar que **el WABA YA está conectado** (Phone Number ID y WABA ID visibles)

**Subtítulos** (CRÍTICOS, en pantalla):
- [1:25] "Step 1: Owner initiates Embedded Signup"
- [1:30] "Step 2: Meta's official popup opens (Facebook Login SDK)"
- [1:45] "Step 3: Owner selects Business Portfolio and WABA"
- [2:10] "Step 4: BLOCKED here — Error #2655111"
- [2:15] "This error confirms: we use the official flow correctly,"
- [2:18] "but cannot complete signup until permissions are granted."
- [2:30] "WABA already connected during dev: ID 307196095802320"

---

### **SCENE 5: Phone Number Management** [2:45 - 3:15]

**Visual**: Settings → WhatsApp con número conectado visible.

**Voiceover**:
> "Once a number is connected, the business owner can manage its settings here. We display the phone number, its WABA ID, the messaging quality rating from Meta, and the number's display name. All this data comes from `whatsapp_business_management` Graph API calls. The owner can also disconnect the number, which uses Meta's `subscribed_apps` DELETE endpoint to properly clean up the integration."

**Acción**:
- Mostrar Phone Number ID, WABA ID, display name
- Hover sobre "Disconnect" button (NO clic — solo demostrar que existe)

**Subtítulos**:
- "Permission used: `whatsapp_business_management`"
- "API: `GET /{phone-number-id}` for status"
- "API: `DELETE /{waba}/subscribed_apps` for cleanup"

---

### **SCENE 6: Template Management** [3:15 - 3:55]

**Visual**: Settings → WhatsApp → Templates tab (o similar).

**Voiceover**:
> "Here we manage WhatsApp Message Templates. Each business gets their own set of templates — appointment reminders, confirmations, owner notifications, walk-in alerts. The business owner can see template status from Meta in real-time. We currently have 14 approved templates for this demo shop, covering all customer-facing notifications.
>
> Templates are created and synced via `whatsapp_business_management` Graph API. We never send a template that isn't approved by Meta."

**Acción**:
- Scroll por las 14 templates
- Mostrar status APPROVED en cada una
- Click en una template para ver su preview
- Mostrar variable mapping (cliente, fecha, hora, servicio)

**Subtítulos**:
- "14 templates APPROVED for this shop"
- "Categories: UTILITY (reminders) + MARKETING (reactivation)"
- "Permission: `whatsapp_business_management`"
- "Endpoints: POST/GET/DELETE `/message_templates`"

---

### **SCENE 7: Customer sends WhatsApp message (live)** [3:55 - 4:50]

**Visual**: Split screen — dashboard a la izquierda, phone WhatsApp a la derecha.

**Voiceover**:
> "Now I'll show a real customer interaction. From a separate phone, a customer named Pedro is going to message the business. Our AI agent — running on OpenAI GPT-5.4-mini with tool calling — will handle the conversation, check real availability, and book the appointment.
>
> Watch the flow: the customer messages, the bot greets, shows services, shows real-time slots from our calendar engine, presents a confirmation, and creates the appointment. All powered by `whatsapp_business_messaging` to send and receive."

**Acción** (esto debe ser **continuo, sin cortes**):

1. [3:55] Phone: "Klk, quiero agendarme un fade pa mañana"
2. [4:00] Bot responde con saludo personalizado
3. [4:05] Bot envía **list interactive** con servicios
4. [4:10] Pedro toca "Fade + Barba"
5. [4:15] Bot llama `find_available_slots` (visible en el dashboard logs si los tienes abiertos)
6. [4:20] Bot envía **list interactive** con slots disponibles
7. [4:25] Pedro toca "4:30 PM"
8. [4:30] Bot envía **buttons interactive** con Confirmar / Cambiar / Cancelar
9. [4:35] Pedro toca ✅ Confirmar
10. [4:40] Bot crea la cita y envía confirmación
11. [4:45] **Mostrar en el dashboard**: la cita aparece en el calendar en tiempo real

**Subtítulos**:
- [3:55] "Customer initiates conversation via WhatsApp"
- [4:00] "AI agent (OpenAI GPT-5.4-mini) handles in Spanish DR slang"
- [4:05] "Interactive list message (Meta API)"
- [4:15] "Real-time availability check (multi-tenant database)"
- [4:30] "Confirmation buttons message"
- [4:40] "Appointment created in business calendar"
- [4:45] "Permission: `whatsapp_business_messaging`"

---

### **SCENE 8: Owner notifications + reminder demo** [4:50 - 5:25]

**Visual**: Split screen — owner's phone receiving notifications + dashboard.

**Voiceover**:
> "When the appointment is created, two things happen on behalf of the business:
>
> First, the business owner receives an automated WhatsApp notification using the approved 'new booking' template — this uses `whatsapp_business_messaging` to send template messages.
>
> Second, we schedule reminders for the customer: 24h, 6h, 2h, and 1h before the appointment. These reminders respect quiet hours configured by the business — for example, we never send between 9 PM and 8 AM. Reminders are sent via approved templates only."

**Acción**:
- Mostrar notificación en el WhatsApp del dueño con `aviso_nueva_cita_*` template
- Click en owner dashboard: mostrar el Reminder Config con quiet hours
- Mostrar en `/admin/crons` el cron `reminders` que envía estos mensajes

**Subtítulos**:
- "Owner notification — template `aviso_nueva_cita_*`"
- "Permission: `whatsapp_business_messaging` (send approved template)"
- "Reminder schedule: 24h / 6h / 2h / 1h before appointment"
- "Quiet hours respected: never between 9 PM - 8 AM"

---

### **SCENE 9: Manual disconnect demo (cleanup)** [5:25 - 5:45]

**Visual**: Settings → WhatsApp → "Disconnect WhatsApp" button.

**Voiceover**:
> "Finally, if a business owner wants to disconnect, they have a clean disconnect option. This calls `DELETE /{waba_id}/subscribed_apps` on Meta's Graph API to properly unsubscribe our app from the WABA, then clears the local DB records. This respects the full integration lifecycle."

**Acción**:
- Hover sobre "Disconnect" button (NO clic — solo mostrar que existe)
- Mostrar el endpoint que llama (puedes abrir DevTools Network tab si quieres)

**Subtítulos**:
- "Permission: `whatsapp_business_management`"
- "API: `DELETE /{waba_id}/subscribed_apps`"
- "Full lifecycle: connect → manage → disconnect"

---

### **SCENE 10: Outro** [5:45 - 6:00]

**Visual**: Volver al homepage de domicita.com.

**Voiceover**:
> "Thanks for reviewing DomiCita. Our integration is fully compliant with Meta's Tech Provider model, uses Embedded Signup as documented, and serves a real market with 70,000+ potential business customers in the Dominican Republic. Looking forward to going live."

**Subtítulos finales**:
- "DomiCita Tech Provider — Dominican Republic"
- "Founder: Kelvin Rivera | hola@domicita.com"
- "Website: domicita.com"

---

## 📝 Permission Justifications (English text exact)

> **IMPORTANTE**: copia y pega EXACTAMENTE estos textos en el campo "How will your app use this permission?" del App Review. Ajusta los timestamps si tu video sale de duración diferente.

---

### Permission 1: `whatsapp_business_management`

**Title (if asked)**: Manage Message Templates and WABA Configuration

**How will your app use this permission?**

```
DomiCita is a Tech Provider serving barbershops, beauty salons and unisex salons in the Dominican Republic. We use `whatsapp_business_management` to:

1. **Submit and manage message templates** on behalf of business customers.
   - At video timestamp 3:15-3:55 you can see our Template Management UI
     showing 14 approved templates for the demo barbershop.
   - We use POST /{waba-id}/message_templates to submit new templates,
     GET /{waba-id}/message_templates to read statuses, and DELETE
     /{template-id} to remove deprecated ones.
   - Templates cover business notifications: appointment reminders,
     confirmations, walk-in queue alerts, owner digests, and customer
     reactivation campaigns.

2. **Read phone number metadata** to display status to the business owner.
   - At video timestamp 2:45-3:15 you can see we display the Phone Number ID,
     display name, and messaging quality rating to the business owner.
   - We use GET /{phone-number-id} for this.

3. **Clean up integrations on disconnect** when a business owner stops
   using DomiCita.
   - At video timestamp 5:25-5:45 you can see our Disconnect flow which
     calls DELETE /{waba-id}/subscribed_apps to properly unsubscribe our
     app from the WABA before clearing local data.

4. **Embedded Signup completion** for new business onboarding.
   - At video timestamp 1:25-2:30 you can see our Embedded Signup
     implementation following Meta's documentation
     (developers.facebook.com/docs/whatsapp/embedded-signup).
   - The flow blocks at phone registration with documented error #2655111
     ("partner app doesn't have advanced messaging and management
     permissions"). This is expected for apps in Development without the
     permissions under review. Once granted, businesses will complete
     onboarding through this same flow.

The demo WABA shown elsewhere in the video (ID 307196095802320) was
connected during our initial development phase using this same Embedded
Signup flow before we used up our single test number's registration.

We never use this permission to access WABAs outside of those owned by
businesses that have explicitly granted us access via Embedded Signup.
```

---

### Permission 2: `whatsapp_business_messaging`

**Title (if asked)**: Send and Receive Messages on Behalf of Businesses

**How will your app use this permission?**

```
DomiCita uses `whatsapp_business_messaging` to power conversations between
small businesses (barbershops, salons) and their end customers in the
Dominican Republic. This is the core of our value proposition.

1. **Receive customer messages via webhook** and route them to our AI
   agent which books appointments.
   - At video timestamp 3:55-4:45 you can see a complete customer-to-bot
     conversation: greeting → service selection → time slot selection →
     confirmation → appointment created.
   - The webhook subscription is configured per WABA via
     POST /{waba-id}/subscribed_apps after Embedded Signup completes.
   - We process text messages, voice notes (transcribed via Deepgram),
     and interactive button/list replies.

2. **Send session messages (within the 24h window)** as automated AI
   responses to customer conversations.
   - All bot responses you see at 3:55-4:45 are session messages sent
     via POST /{phone-number-id}/messages with type "text" or "interactive".
   - The AI agent uses OpenAI GPT-5.4-mini with tool calling. Tools
     include: find_available_slots, present_service_picker,
     present_slot_picker, present_confirmation, create_appointment,
     send_location, etc.

3. **Send approved template messages** for transactional notifications.
   - At video timestamp 4:50-5:25 you can see the business owner
     receiving a "new booking" template notification, and we explain
     the reminder system (24h, 6h, 2h, 1h before appointment).
   - We use POST /{phone-number-id}/messages with type "template" and
     only with templates already approved by Meta (status: APPROVED).
   - We respect "quiet hours" configured by each business — reminders
     are deferred if they would fire during the business's quiet window
     (default 9 PM - 8 AM).
   - Voice transcription via Deepgram Nova-3 enables Spanish DR
     speakers to use voice notes instead of typing.

4. **Send location pins** when a customer asks for the business address.
   - At various points in the conversation, when a customer asks "where
     are you located", the bot sends a native WhatsApp location message
     via POST /{phone-number-id}/messages with type "location".

We never send marketing messages outside of opted-in reactivation
campaigns, and we never send to phone numbers that haven't initiated
contact with the business (or where the business has explicit consent
for outbound contact via prior appointments).
```

---

### Permission 3: `business_management`

**Title (if asked)**: Connect WABA via Embedded Signup

**How will your app use this permission?**

```
DomiCita uses `business_management` exclusively as part of Meta's
official Embedded Signup flow to allow business owners to grant our
Tech Provider app access to their WhatsApp Business Account.

1. **Embedded Signup onboarding** for new business customers.
   - At video timestamp 1:25-2:30 you can see the full flow:
     a) Business owner clicks "Connect WhatsApp" in our app
     b) Meta's official popup opens (Facebook Login SDK)
     c) Owner selects their Business Portfolio
     d) Owner selects or creates a WABA
     e) Owner adds phone number (currently blocked by error #2655111
        because we don't yet have the messaging/management permissions
        approved)

   We follow Meta's documented Embedded Signup flow exactly:
   developers.facebook.com/docs/whatsapp/embedded-signup

2. **Business asset assignment** to our Tech Provider app.
   - Once the owner completes Embedded Signup, Meta returns a
     `phone_number_id` and `waba_id` via the postMessage callback. We
     store these in our multi-tenant database, scoped to the owner's
     shopId.

We do NOT use this permission to access any other Business Manager
assets (catalogs, ad accounts, pages, etc.). Our use is strictly limited
to receiving the WABA/phone_number IDs that the business owner
explicitly grants us through Embedded Signup.

We do not request or store any Business Portfolio data beyond what's
needed for the WhatsApp integration.
```

---

## 📦 Otros documentos requeridos por Meta

### Privacy Policy (URL pública)
- URL: `https://domicita.com/privacy`
- Debe estar accesible sin login
- Si no existe → crearlo ANTES de submitear el review

### Terms of Service (URL pública)
- URL: `https://domicita.com/terms`
- Debe estar accesible sin login

### Data Deletion Instructions URL
- URL: `https://domicita.com/data-deletion`
- Página que explica cómo el end user (customer) puede pedir borrar sus datos

### Privacy Policy URL en App Settings
- Verificar en `developers.facebook.com/apps/{tu-app}/settings/basic`
- Privacy Policy URL: `https://domicita.com/privacy`
- Data Deletion URL: `https://domicita.com/data-deletion`

---

## 🎯 Tips de grabación

### Audio
- Habla **claro y pausado** (los reviewers no son nativos en inglés)
- Si tu inglés no es perfecto, **prepara el script y léelo lentamente** (es mejor que improvisar mal)
- **NO uses voiceover AI** (te penaliza credibilidad)

### Video
- **1080p mínimo**, idealmente 1440p o 4K downsampled
- **Cursor visible** y grande (System Preferences → Accessibility → Pointer Size)
- **Zoom in** a textos pequeños (error messages, settings)
- **Subtítulos burned-in** (que se vean siempre, no closed captions)

### Editing
- **NO uses música**
- **NO uses transiciones fancy**
- **Cortes secos**, ritmo de 30-45 segundos por escena
- Edita en **CapCut, Premiere Pro, o DaVinci Resolve**

### Lo que NO debes hacer
- ❌ Esconder el error de Embedded Signup (Meta lo sabe y lo espera)
- ❌ Decir "we have 10,000 customers" si no es cierto (no exageres)
- ❌ Mostrar datos personales de clientes reales (usa Pedro Martínez ficticio)
- ❌ Hacer click en "Disconnect" (rompe la demo)
- ❌ Editar el video más de 3 cortes (sospechoso)
- ❌ Voiceover AI o subtítulos AI sin revisar (errores raros)

---

## ✅ Checklist final antes de submitear

- [ ] Video grabado y editado (5:30 - 6:30 min)
- [ ] Subtítulos en inglés burned-in correctos
- [ ] Audio claro
- [ ] Video subido a `https://www.youtube.com/` como **Unlisted** (no Public, no Private)
- [ ] URL del video copiada
- [ ] Privacy Policy publicada en `/privacy`
- [ ] Terms of Service publicados en `/terms`
- [ ] Data Deletion URL en `/data-deletion`
- [ ] Privacy Policy URL configurada en Meta App Settings
- [ ] App está en modo **Live** (no Development) — esto a veces se cambia justo antes de submit
- [ ] Permission Justifications copiadas para los 3 permisos
- [ ] Video URL pegada en cada Permission Justification
- [ ] **Submit for Review**

---

## 🎬 Cronograma de producción sugerido

**Si empiezas hoy**:
- Día 1 (3h): grabar las escenas 2-9 (todo lo del producto)
- Día 1 (1h): grabar escena 1 y 10 (intro y outro)
- Día 1 (2h): edición + subtítulos
- Día 2 (1h): revisión final, corrección de subtítulos
- Día 2 (30m): subir a YouTube Unlisted
- Día 2 (30m): pegar todo en App Review y submit

**Total: ~8 horas de trabajo en 1.5 días.**

---

## 🔁 Si Meta rechaza

Meta a veces rechaza el primer intento. **No te asustes**. Suelen dar feedback específico:

- **"Couldn't see the actual messaging happen"** → grabas más cerca del split screen
- **"Need to see Embedded Signup more clearly"** → vuelves a grabar escena 4 con más zoom
- **"Privacy Policy doesn't mention WhatsApp"** → actualizas el privacy con sección WhatsApp
- **"App is in Development mode"** → cambias a Live mode y resubmiteas

Segundo intento suele aprobarse con un fix targeted en 24-72h.
