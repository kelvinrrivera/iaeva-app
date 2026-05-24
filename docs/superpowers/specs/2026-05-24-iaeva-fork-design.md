# Diseño IAEVA — Fork de Domicita para Salud y Bienestar

**Fecha:** 2026-05-24
**Autor:** Kelvin + Claude
**Estado:** Aprobado para implementación

---

## Resumen ejecutivo

IAEVA es un fork independiente de Domicita orientado al sector salud y bienestar. La estrategia es:

- **Producto SaaS** (Next.js): adaptar Domicita a 4 nichos nuevos (dental, estética, fisio, bienestar genérico) sin perder las features existentes. Backend, DB, Stripe, WhatsApp y resto de servicios son cuentas/proyectos nuevos, totalmente aislados de Domicita producción.
- **Landing** (Astro): migrar la landing actual Vite/React a Astro estático, simplificándola a "asistente WhatsApp recepcionista para bienestar/salud". Eliminar IA voice, widget web, customer service hub, testimonios e implementation plan. Proteger SEO existente y abrir landings verticales por nicho para ganar long-tail.
- **Mercado**: Latinoamérica como principal, España como secundario. USD default + EUR. Español neutro panhispánico.
- **Pricing**: 3 planes nuevos (STARTER 49/CLINIC 129/CLINIC PRO 299 USD) con trial 14 días sin tarjeta.
- **Orden de ejecución**: 5 fases secuenciales (~10 semanas).

**Invariante no-negociable**: Domicita producción nunca se toca. Aislamiento total en cuentas, credenciales, dominios, repos y DNS.

---

## 1. Arquitectura general

### 1.1 Repos y deploys

```
IAEVA-SAAS/                                 (carpeta local, no es un repo)
├── iaeva-app/             → repo git nuevo "iaeva-app"
│                            Next.js 16 · Prisma 7 · Supabase · Stripe · Twilio
│                            Deploy: app.iaeva.com (Vercel project nuevo)
│                            BD: nuevo proyecto Supabase IAEVA
│
└── iaeva_landing/         → repo git nuevo "iaeva-landing"
                             Astro 5 + islands React donde haga falta
                             Deploy: iaeva.com (Vercel project nuevo)
```

### 1.2 Dominios

- `iaeva.com` → landing Astro (estático)
- `app.iaeva.com` → app Next.js (SaaS)
- Ningún subdominio compartido con `domicita.com` ni con `kelvinscale.net`

### 1.3 Servicios externos (todos nuevos para IAEVA)

| Servicio | Recurso nuevo |
|---|---|
| Supabase | Proyecto nuevo, DB Postgres vacía |
| Stripe | Cuenta nueva, KYC nuevo |
| WhatsApp Business | Número/cuenta dedicada (Meta o Twilio) |
| Sentry | Proyectos nuevos `iaeva-app` y `iaeva-landing` |
| Resend | Dominio `iaeva.com` verificado |
| Upstash Redis | DB nueva para rate limiting |
| Google Cloud | Proyecto nuevo para Calendar OAuth |
| Vercel | 2 projects nuevos en el team actual |
| GA4 | Propiedad nueva |

### 1.4 Stack

- **App** (sin cambios respecto a Domicita actual): Next.js 16, React 19, Prisma 7, Supabase, Tailwind v4, Vercel.
- **Landing** (nuevo): Astro 5, `@astrojs/sitemap`, `@astrojs/tailwind`, `@astrojs/react` para islands. Componentes interactivos (WhatsAppChatDemo, PricingToggle) como islands React 19. `lucide-react` y shadcn portado donde haga falta. `framer-motion` solo en hero.

---

## 2. Modelo de datos y multi-nicho

### 2.1 Cambios en schema Prisma

```prisma
enum BusinessType {
  DENTAL_CLINIC
  AESTHETIC_CENTER
  PHYSIOTHERAPY
  WELLNESS_GENERIC
}

enum ServiceCategory {
  CONSULTATION
  TREATMENT
  FOLLOW_UP
  SESSION
  PROCEDURE
  EVALUATION
}

enum Plan {
  TRIAL       // Estado interno: durante los 14 días sin tarjeta
  STARTER     // Plan comprable
  CLINIC      // Plan comprable
  CLINIC_PRO  // Plan comprable
  CANCELLED   // Estado interno: post-trial sin pagar o downgrade activo
}
```

Solo `STARTER`, `CLINIC` y `CLINIC_PRO` aparecen en la página de pricing. `TRIAL` y `CANCELLED` son estados que el sistema asigna automáticamente.

Los enums antiguos (`BARBERSHOP | BEAUTY_SALON | NAIL_SALON | HYBRID` y `FREE | PROFESSIONAL | ENTERPRISE`) **se eliminan**. La DB es nueva y vacía, no hay datos que migrar.

### 2.2 Terminología dinámica multi-nicho

El context React `contexts/terminology` se amplía con los 4 nichos:

| Nicho | Profesional | Cliente | Cita | Servicio |
|---|---|---|---|---|
| DENTAL_CLINIC | Doctor/Dra. | Paciente | Cita | Tratamiento |
| AESTHETIC_CENTER | Especialista | Cliente/a | Cita | Tratamiento |
| PHYSIOTHERAPY | Fisioterapeuta | Paciente | Sesión | Sesión |
| WELLNESS_GENERIC | Profesional | Cliente/a | Cita | Sesión |

### 2.3 Locale y currency

**Idiomas soportados (V1):**
- `es` — español neutro panhispánico (default)
- `en` — inglés (US/UK neutro)

**Currency soportadas (V1):**
- `USD` (default)
- `EUR`

**Defaults por país detectado en onboarding (por IP):**
- País Latam → `locale=es`, `currency=USD`
- España / UE hispanohablante → `locale=es`, `currency=EUR`
- US, UK, Canada, Caribe anglófono y resto del mundo → `locale=en`, `currency=USD`
- Cualquier combinación es válida y el usuario puede override manualmente en signup y en Settings posteriormente. `Shop.locale` y `Shop.currency` son independientes.

**Strings de UI**: todas las strings del producto se encapsulan en un sistema de i18n (i18next o `next-intl`) con dos JSON: `es.json` + `en.json`. Las strings inglesas se traducen profesionalmente o por humano nativo (no MT crudo) — el copy del producto es comercial, no se puede usar Google Translate y dejarlo.

**Prompts IA**: cada nicho tiene 2 variantes (es/en). El sistema elige variante por `Shop.locale`.

**Plantillas WhatsApp**: cada plantilla se aprueba en Meta en ambos idiomas (es + en). Multiplica las plantillas a aprobar pero Meta lo soporta nativamente con el campo `language`.

**Emails transaccionales**: templates duales (es/en) en Resend según `Shop.locale`.

### 2.4 Features que se conservan (sin renombrar en DB)

Appointments, Services, Clients, Locations, Memberships, LoyaltyPrograms, Walkins, FinanceEntries, GoogleCalendarSync, WhatsAppConversations, Reminders, AnalyticsEvents. Solo se renombran en UI (Fase 4).

---

## 3. WhatsApp + IA por nicho

### 3.1 Reuso de Domicita

Integración Twilio/Meta, bot Gemini con fallback OpenAI, colas de mensajes salientes, recordatorios cron (24h y 1h), detección de intents, contexto conversacional persistido.

### 3.2 Cambios para IAEVA

**Prompts por nicho** en `lib/ai/prompts/<nicho>.ts`. Cada uno construye el system prompt con identidad, contexto del shop, terminología y reglas específicas:

- **DENTAL_CLINIC**: nunca diagnostica, escala urgencias dentales, maneja preguntas de coberturas/seguros.
- **AESTHETIC_CENTER**: contraindicaciones básicas, pre/post-tratamiento, paquetes/bonos.
- **PHYSIOTHERAPY**: nunca diagnostica lesión, escala dolor agudo, gestiona sesiones de bono.
- **WELLNESS_GENERIC**: tono empático, deriva a humano si detecta crisis (relevante en psicología).

**Plantillas WhatsApp aprobadas por Meta** (nuevas, en español neutro y en inglés):

| Tipo | ES | EN |
|---|---|---|
| Recordatorio 24h | "Recordatorio: tienes cita mañana con {profesional} a las {hora}" | "Reminder: you have an appointment tomorrow with {professional} at {time}" |
| Recordatorio 1h | "Tu cita es en 1 hora. ¿Confirmas asistencia?" | "Your appointment is in 1 hour. Are you attending?" |
| Confirmación de reserva | "¡Cita confirmada! Te esperamos el {fecha} a las {hora}" | "Appointment confirmed! See you on {date} at {time}" |
| Cancelación | Acuse + propuesta de reagendar | Acknowledgement + rescheduling proposal |
| Post-cita (opcional, estética/fisio) | "¿Cómo te fue tu sesión?" | "How did your session go?" |

Cada plantilla se envía a Meta para aprobación con `language: es` y `language: en` por separado.

### 3.3 Guardrails médicos (YMYL)

- Bot nunca da diagnóstico, recomendación de medicamento o interpretación de síntomas.
- Disclaimer al iniciar conversación con paciente nuevo.
- Detección de keywords de urgencia → escalado humano + notificación al shop.
- Detección de keywords de crisis (psicología) → mensaje con teléfono de emergencia + escalado.
- Aviso GDPR/protección de datos con link a política.

### 3.4 Handoff humano

Botón "hablar con persona" en chat. Activa pausa del bot, notifica al shop por email + push en dashboard. Staff retoma desde `app/dashboard/chatbot/`.

### 3.5 Onboarding del bot

1. Elegir nicho
2. Cargar catálogo de servicios (plantillas pre-rellenadas por nicho)
3. Conectar WhatsApp (QR Meta o número Twilio)
4. Editar personalidad/tono y FAQs
5. Sandbox de prueba antes de exponer a pacientes

### 3.6 GDPR / LOPDGDD

- Opt-in explícito al primer mensaje.
- Política accesible desde landing y bot.
- Datos cifrados en reposo (Supabase nativo).
- Endpoint de borrado de conversaciones a petición.
- Audit trail en `WhatsAppConversation` (nuevo respecto a Domicita).

---

## 4. Pricing y billing

### 4.1 Planes

| Plan | USD/mes | EUR/mes | Profesionales | Sedes | Citas/mes | Soporte |
|---|---|---|---|---|---|---|
| STARTER | 49 | 45 | 1 | 1 | 200 | Email |
| CLINIC | 129 | 119 | 8 | 2 | ∞ | Chat |
| CLINIC PRO | 299 | 279 | ∞ | ∞ | ∞ | Prioritario |

**Anual con descuento** (~17%, 2 meses gratis).

### 4.2 Trial

14 días gratis con todas las features de CLINIC. Sin tarjeta al inicio. A los 14 días sin método de pago → banner bloqueante.

### 4.3 Stripe

- 3 products: `iaeva_starter`, `iaeva_clinic`, `iaeva_clinic_pro`
- 2 currencies × 2 intervalos por product = **12 prices totales**
- Webhooks en `app/api/stripe/webhook` (existe en Domicita, se adapta a nuevo enum)
- Stripe Tax habilitado para EUR/España (IVA 21%). USD sin tax.
- Customer Portal embebido para gestión de tarjeta y cancelación.

### 4.4 Enforcement de límites

`lib/billing/plans.ts`:

```ts
export const PLAN_LIMITS = {
  STARTER:    { maxProfessionals: 1,        maxLocations: 1,    maxAppointmentsPerMonth: 200 },
  CLINIC:     { maxProfessionals: 8,        maxLocations: 2,    maxAppointmentsPerMonth: Infinity },
  CLINIC_PRO: { maxProfessionals: Infinity, maxLocations: Infinity, maxAppointmentsPerMonth: Infinity },
}
```

Middleware valida límites antes de crear `Professional`, `Location`, `Appointment`.

### 4.5 Página de pricing

En la landing como sección dedicada de la home y como página `/precios` autónoma. Tabla 3 columnas con toggle USD/EUR y mensual/anual. CTA por plan → `app.iaeva.com/signup?plan=clinic`. Schema.org `Product/Offer` por plan para rich snippets.

---

## 5. Landing Astro

### 5.1 Estructura

```
iaeva_landing/
├── astro.config.mjs              # site: 'https://iaeva.com', sitemap integrado
├── src/
│   ├── layouts/BaseLayout.astro  # <head> SEO completo
│   ├── components/
│   │   ├── seo/
│   │   │   ├── HeadMeta.astro
│   │   │   ├── JsonLdSoftware.astro
│   │   │   └── JsonLdOrganization.astro
│   │   ├── home/
│   │   │   ├── Hero.astro
│   │   │   ├── Features.astro
│   │   │   ├── IAEVAWhatsApp.astro
│   │   │   ├── HowItWorks.astro
│   │   │   ├── Pricing.astro
│   │   │   ├── SEOKeywords.astro     # 45 keywords literal
│   │   │   └── CTASection.astro
│   │   ├── verticals/VerticalHero.astro
│   │   ├── layout/{Navbar,Footer}.astro
│   │   └── interactive/              # islands React
│   │       ├── WhatsAppChatDemo.tsx
│   │       └── PricingToggle.tsx
│   ├── pages/
│   │   ├── index.astro                           # ES home (/)
│   │   ├── casos-de-uso.astro
│   │   ├── contacto.astro
│   │   ├── precios.astro
│   │   ├── clinicas-dentales.astro
│   │   ├── centros-esteticos.astro
│   │   ├── fisioterapia.astro
│   │   ├── psicologia.astro
│   │   ├── politica-de-privacidad.astro
│   │   ├── terminos-y-condiciones.astro
│   │   ├── politica-de-cookies.astro
│   │   └── en/                                   # EN versions (/en/...)
│   │       ├── index.astro                       # EN home (/en/)
│   │       ├── use-cases.astro
│   │       ├── contact.astro
│   │       ├── pricing.astro
│   │       ├── dental-clinics.astro
│   │       ├── aesthetic-centers.astro
│   │       ├── physiotherapy.astro
│   │       ├── psychology.astro
│   │       ├── privacy-policy.astro
│   │       ├── terms-and-conditions.astro
│   │       └── cookie-policy.astro
│   └── i18n/
│       ├── es.json                               # strings ES
│       └── en.json                               # strings EN
└── public/
    ├── robots.txt
    ├── logo/og-image.png        # <100KB optimizado
    ├── logo/og-image-en.png     # opcional versión EN si copy difiere visualmente
    └── images/
```

Astro maneja i18n con su routing nativo (`src/pages/en/` para inglés, raíz para español). El layout base detecta el path y carga el JSON de strings correspondiente.

### 5.2 SEO replicado literalmente (Home `/`)

```
Title:       IAEVA | Asistente Virtual Inteligente para el Sector Salud
Description: IAEVA optimiza la atención al paciente en el sector salud con IA avanzada.
             Automatiza citas, consultas y seguimiento médico para mejorar la experiencia
             del paciente y reducir costos operativos.
Keywords:    asistente virtual médico, IA en salud, automatización médica, citas médicas,
             atención al paciente, inteligencia artificial salud, chatbot médico WhatsApp,
             optimización clínicas, IAEVA
Canonical:   https://iaeva.com/
og:locale:   es_ES
og:image:    https://iaeva.com/logo/og-image.png (absoluta, no relativa)
H1:          Reduce tiempos de espera y mejora la experiencia del paciente con IA
JSON-LD:     2 bloques (SoftwareApplication + Organization)
```

`<html lang="es">` (NO `en` como está en la versión actual).

### 5.3 SEO por página vertical (ES)

| URL | Title | H1 |
|---|---|---|
| `/casos-de-uso` | `Casos de Uso de IA en Clínicas, Hospitales y Laboratorios \| IAEVA` | `Casos de Uso de IAEVA en el Sector Médico` |
| `/contacto` | `Solicita tu Demo Personalizada de IAEVA \| Asistente IA para Salud` | `Hablemos de IA` |
| `/clinicas-dentales` | `Asistente IA WhatsApp para Clínicas Dentales \| IAEVA` | `IAEVA para clínicas dentales` |
| `/centros-esteticos` | `Asistente IA WhatsApp para Centros de Estética \| IAEVA` | `IAEVA para centros de estética` |
| `/fisioterapia` | `Asistente IA WhatsApp para Fisioterapia \| IAEVA` | `IAEVA para fisioterapia` |
| `/psicologia` | `Asistente IA WhatsApp para Psicología \| IAEVA` | `IAEVA para psicología` |

### 5.3.1 SEO por página vertical (EN)

| URL | Title | H1 |
|---|---|---|
| `/en/` | `IAEVA \| AI Virtual Assistant for the Healthcare Sector` | `Reduce wait times and improve patient experience with AI` |
| `/en/use-cases` | `AI Use Cases for Clinics, Hospitals, and Labs \| IAEVA` | `IAEVA Use Cases in the Medical Sector` |
| `/en/contact` | `Request a Personalized IAEVA Demo \| AI Assistant for Healthcare` | `Let's talk about AI` |
| `/en/dental-clinics` | `WhatsApp AI Assistant for Dental Clinics \| IAEVA` | `IAEVA for dental clinics` |
| `/en/aesthetic-centers` | `WhatsApp AI Assistant for Aesthetic Centers \| IAEVA` | `IAEVA for aesthetic centers` |
| `/en/physiotherapy` | `WhatsApp AI Assistant for Physiotherapy \| IAEVA` | `IAEVA for physiotherapy` |
| `/en/psychology` | `WhatsApp AI Assistant for Psychology \| IAEVA` | `IAEVA for psychology practices` |

### 5.3.2 hreflang y canonicals

Cada página ES enlaza a su par EN y viceversa con `<link rel="alternate" hreflang="en" href="..."/>` + `hreflang="es"` + `hreflang="x-default"` apuntando a ES (default). Canonical de cada página apunta a sí misma. Esto evita duplicate content y permite a Google servir la versión correcta por idioma del usuario.

Ejemplo en `/`:
```html
<link rel="canonical" href="https://iaeva.com/" />
<link rel="alternate" hreflang="es" href="https://iaeva.com/" />
<link rel="alternate" hreflang="en" href="https://iaeva.com/en/" />
<link rel="alternate" hreflang="x-default" href="https://iaeva.com/" />
```

### 5.3.3 Idioma EN — keyword strategy paralela

Cuando trabajemos la EN tenemos que hacer keyword research específico (no traducir literal):
- Spanish `chatbot WhatsApp médico` → EN `WhatsApp AI healthcare assistant` (no `medical WhatsApp chatbot`)
- Spanish `software de gestión clínica dental` → EN `dental practice management software`
- Spanish `agenda médica digital` → EN `online medical appointment scheduling`

El SEOKeywordsSection en EN tendrá su propio set de 30-45 keywords (no traducción literal del ES). Esto es trabajo de **Fase 2** dentro del bloque de landing.

### 5.4 Las 45 keywords de `SEOKeywordsSection` (preservadas literal)

**Cluster 1 — Citas médicas online:** cita médica online, reserva de citas médicas, agenda médica digital, gestión de citas clínicas, programación de citas hospital, sistema de citas médicas, recordatorio de citas médicas, cancelación de citas online, plataforma de citas médicas, citas médicas virtuales, gestión de agendas médicas, software de citas para clínicas, sistema de recordatorios médicos, confirmación de citas automatizada, calendario médico online.

**Cluster 2 — IA para sector salud:** inteligencia artificial sanitaria, IA para hospitales, IA en clínicas médicas, asistente virtual médico, automatización sector salud, IA conversacional médica, inteligencia artificial atención pacientes, voz IA sector médico, consultor IA salud, optimización procesos hospitalarios IA, transformación digital hospitales, IA diagnóstico médico, análisis datos salud IA, IA para profesionales sanitarios, tecnología IA sector médico.

**Cluster 3 — Chatbot médico WhatsApp:** chatbot WhatsApp médico, asistente virtual WhatsApp salud, citas médicas por WhatsApp, WhatsApp Business para clínicas, bot médico WhatsApp, mensajería automatizada hospitales, consultas médicas WhatsApp, confirmación citas WhatsApp, recordatorios médicos WhatsApp, comunicación pacientes WhatsApp, WhatsApp integración clínicas, atención pacientes automatizada, respuestas automáticas salud, seguimiento pacientes WhatsApp, notificaciones médicas WhatsApp.

### 5.5 Bugs SEO corregidos en la migración

- `lang="en"` → `lang="es"`
- `og:image` con ruta `public/...` → URL absoluta `https://iaeva.com/logo/og-image.png`
- `<img src="public/images/...">` → `/images/...`
- Comentario JSX mal formateado en `Index.tsx:113` (potencial fallo silencioso del schema #2 según auditoría) — al portar a Astro como bloque `<script type="application/ld+json">` puro, el problema desaparece
- Enlaces a `/blog` eliminados de Navbar y Footer
- Enlaces `to="#"` del Footer reemplazados por anchors válidos (`/#features`, etc.)
- Políticas legales enlazan a páginas internas (no a `kelvinscale.net`)
- `robots.txt` + `sitemap.xml` desde día 1

### 5.6 Secciones de la home (orden vertical)

1. Hero con H1 literal + CTA principal "Empezar prueba gratis" + secundario "Ver cómo funciona"
2. Features (IAEVAWhatsApp como bloque principal)
3. HowItWorks (3-4 pasos)
4. Verticales resumen (4 tarjetas → landings dedicadas)
5. Pricing (tabla con toggle USD/EUR + mensual/anual)
6. SEOKeywordsSection (45 keywords literal)
7. CTA final

**Quitadas definitivamente**: VapiVoice, CustomerServiceHub, Testimonials, ImplementationPlan, Calcom embed.

### 5.7 Performance objetivo

- LCP < 2.0s
- CLS < 0.05
- INP < 200ms
- JS hidratado solo en islands específicas

### 5.8 Form de contacto

Form simple en `/contacto` → POST a `app.iaeva.com/api/contact` → email vía Resend. Sin Calcom.

---

## 6. Limpieza terminológica del dashboard (Fase 4)

### 6.1 Principio

Sin migrations destructivas. Solo cambios en componentes React, terminología del context y feature flags.

### 6.2 Renombrados de copy (UI, no DB) — bilingüe

| Domicita | IAEVA (ES) | IAEVA (EN) |
|---|---|---|
| Walk-ins | "Consultas sin cita" / "Visitas espontáneas" | "Walk-in visits" / "Drop-ins" |
| Tips (propinas) | Oculto por defecto, toggle en Settings | Hidden by default, toggle in Settings |
| Loyalty | "Bonos / Paquetes de sesiones" | "Session packages" / "Bundles" |
| Memberships | "Planes mensuales" / "Suscripciones del paciente" | "Monthly plans" / "Patient subscriptions" |
| Commission | "Honorarios profesionales" | "Professional fees" |
| Clients | "Pacientes" (DENTAL/PHYSIO) o "Clientes" (otros) | "Patients" or "Clients" |

### 6.3 Feature flags por nicho

```ts
// lib/features/byNiche.ts
export const NICHE_FEATURES = {
  DENTAL_CLINIC:    { walkins: true,  loyalty: false, memberships: true,  tips: false },
  AESTHETIC_CENTER: { walkins: false, loyalty: true,  memberships: true,  tips: true  },
  PHYSIOTHERAPY:    { walkins: false, loyalty: true,  memberships: true,  tips: false },
  WELLNESS_GENERIC: { walkins: false, loyalty: true,  memberships: true,  tips: false },
}
```

Navegación del dashboard (`app/dashboard/layout.tsx`) lee este mapa.

### 6.4 Plantillas de servicio por nicho

Pre-poblar catálogo al crear shop: limpieza dental, ortodoncia, blanqueamiento (DENTAL); depilación láser, facial, masajes (AESTHETIC); sesión fisio inicial, seguimiento, drenaje (PHYSIO); consulta psicología, terapia pareja, nutrición (WELLNESS).

### 6.5 Branding

- Logo IAEVA, favicon nuevos
- Paleta Tailwind: `--iaeva-primary` (azul médico), `--iaeva-secondary` (verde menta). Acento rosado opcional para estética.
- Iconos Lucide específicos por nicho en headers de sección

### 6.6 Docs internas

`README.md`, `docs/USER_GUIDE.md`, `docs/ADMIN_GUIDE.md`, `CHANGELOG.md` reescritos para IAEVA. Empieza desde v0.1.0.

---

## 7. Protocolo de aislamiento (invariante)

**Regla cero**: Domicita producción nunca se toca. Cualquier operación que pueda afectar repo, DB, Stripe, WhatsApp, DNS, Vercel u otros servicios de Domicita requiere confirmación explícita del usuario antes de ejecutarse.

### 7.1 Verificaciones obligatorias antes de acciones técnicas

```bash
# Git
git remote -v   # solo iaeva-* remotos

# Env
grep -i "domicita\|<URL-supabase-domicita>" .env.local   # vacío

# DNS
# solo iaeva.com y app.iaeva.com tocados
```

### 7.2 Carpetas

- `IAEVA-SAAS/iaeva-app/` — único repo del producto IAEVA
- `IAEVA-SAAS/iaeva_landing/` — único repo de la landing IAEVA
- `/Users/kelvin/Desktop/DomiCita/` — **prohibido tocar** durante desarrollo IAEVA. Configurada como working directory adicional en la sesión pero no se edita, no se ejecuta, no se referencia salvo confirmación explícita.

### 7.3 Cuentas/proyectos

| Recurso | Acción |
|---|---|
| Supabase | Proyecto nuevo dedicado IAEVA, DB vacía |
| Stripe | Cuenta nueva con KYC nuevo |
| WhatsApp Business | Número/cuenta dedicada (Meta o Twilio) |
| Sentry | Proyectos nuevos `iaeva-app` + `iaeva-landing` |
| Resend | Dominio `iaeva.com` verificado aparte |
| Upstash Redis | DB nueva |
| Google Cloud | Proyecto nuevo para Calendar OAuth |
| Vercel | 2 projects nuevos en el team actual |
| GA4 | Propiedad nueva |
| GitHub | 2 repos nuevos (`iaeva-app`, `iaeva-landing`) |
| DNS | Solo registros de `iaeva.com` |

### 7.4 Antes de cada `git push`

Antes de cualquier `git push`, `pnpm prisma migrate deploy`, configuración de webhook externo, o edición de `.env.local`: confirmar con el usuario que el destino es IAEVA. Si hay duda, parar.

---

## 8. Plan de fases (orden definitivo)

```
Fase 0 → Fase 1 → Fase 2 → Fase 3 → Fase 4
  1 sem  3-4 sem  2-3 sem   2 sem    2 sem
infra    producto  landing  pricing  pulido
         (i18n)    (ES+EN)
```

Las duraciones de Fase 1 y Fase 2 incluyen un buffer por el trabajo de i18n (ES + EN). El total sube de ~10 semanas a ~11-12 semanas.

### Fase 0 — Setup y aislamiento (semana 1)

**Objetivo**: infra nueva, separada de Domicita, lista para tocar código.

**Tareas**:
1. Crear repos GitHub `iaeva-app` y `iaeva-landing`.
2. `git init` en `iaeva-app/` + remote.
3. Reapuntar `iaeva_landing/` a nuevo repo (descartar `iaeva_web.git`).
4. Crear cuentas/proyectos nuevos: Supabase, Stripe, Sentry x2, Resend, Upstash, Google Cloud, WhatsApp Business.
5. Crear projects Vercel `iaeva-app` y `iaeva-landing`.
6. Configurar DNS `iaeva.com` y `app.iaeva.com`.
7. `.env.example` en cada repo + `.env.local` con credenciales IAEVA (verificado por el usuario).
8. Primer commit + push.

**Criterio de aceptación**:
- [ ] `git remote -v` solo `iaeva-*`
- [ ] DNS resuelve a placeholders
- [ ] Supabase IAEVA con DB vacía
- [ ] Stripe IAEVA con cuenta activa (KYC pending OK)
- [ ] WhatsApp Business con número/cuenta dedicada
- [ ] `grep -i "domicita" .env.local` vacío

### Fase 1 — Producto rebrandeado y multi-nicho (semanas 2-4)

**Objetivo**: app `app.iaeva.com` funcional con marca IAEVA, 4 nichos nuevos, locale es neutro, USD/EUR. Lista para piloto cerrado.

**Tareas**:
1. Schema Prisma: refactor `BusinessType`, `ServiceCategory`, `Plan`. Añadir `Shop.locale` (default `es`) y `Shop.currency` (default `USD`). `prisma migrate dev`.
2. Context multi-nicho: ampliar `contexts/terminology` con 4 nichos × 2 idiomas (ES + EN).
3. Sistema i18n del producto: integrar `next-intl` en el app. Crear `messages/es.json` y `messages/en.json` con TODAS las strings de UI. Header del nav con selector de idioma.
4. Branding: logo IAEVA, favicon, paleta Tailwind, copy del dashboard, emails (dos idiomas).
5. Locale + USD/EUR: helpers `formatCurrency` y `formatDate` que respetan `Shop.locale` y `Shop.currency`.
6. Prompts IA por nicho con guardrails médicos: 2 variantes por nicho (es/en) en `lib/ai/prompts/<nicho>.<locale>.ts`.
7. Plantillas WhatsApp nuevas en ES + EN enviadas a aprobación Meta (día 1). Si Meta rechaza alguna por wording, se reformula y reenvía; el bot puede operar respondiendo solo a mensajes iniciados por el paciente mientras se aprueban (los recordatorios proactivos quedan pausados hasta tener al menos las plantillas de 24h y 1h aprobadas en al menos un idioma).
8. Onboarding shop adaptado al nicho y al idioma del navegador.
9. GDPR: opt-in, política, audit trail, endpoint borrado. Textos en ES + EN.
10. Sentry/Pino con DSNs IAEVA.
11. Tests actualizados.

**Criterio de aceptación**:
- [ ] Signup con cada nicho funciona end-to-end en ES y EN (crear shop → conectar WhatsApp sandbox → bot responde en idioma correcto)
- [ ] Selección moneda USD/EUR refleja en precios
- [ ] Selector de idioma del dashboard cambia toda la UI sin necesidad de logout
- [ ] Plantillas WhatsApp aprobadas por Meta (ES + EN)
- [ ] Tests unit + e2e verdes
- [ ] Sentry recibe error de prueba
- [ ] Demo cerrada con 2-3 clínicas piloto (mix de ES y EN si es posible)

### Fase 2 — Landing Astro con SEO blindado (semanas 5-6)

**Objetivo**: sustituir landing Vite por Astro en `iaeva.com`, SEO equivalente o superior, sin cambiar URLs existentes.

**Tareas**:
1. Setup Astro + Tailwind + sitemap + react integration + i18n routing (`astro.config.mjs` con `i18n: { defaultLocale: 'es', locales: ['es', 'en'] }`).
2. `BaseLayout.astro` con head SEO completo (literal según informe ES), hreflang declarados.
3. Páginas ES existentes preservadas (`/`, `/casos-de-uso`, `/contacto`, 3 legales).
4. Páginas verticales nuevas ES (`/clinicas-dentales`, `/centros-esteticos`, `/fisioterapia`, `/psicologia`).
5. Páginas EN bajo `/en/`: home, use-cases, contact, pricing, 4 verticales, 3 legales. Copy NO es traducción literal — keyword research específico para EN.
6. Componentes Astro de la home (reutilizables entre idiomas, strings desde `i18n/{locale}.json`).
7. Islands React: `WhatsAppChatDemo` (diálogo bilingüe según locale), `PricingToggle` (USD/EUR + mensual/anual + selector de idioma global).
8. Selector de idioma en Navbar (ES ⇄ EN).
9. `robots.txt` + `sitemap.xml` automático con ambos idiomas y hreflang.
10. Bugs SEO corregidos (lang, og:image, links rotos).
11. Form contacto → `app.iaeva.com/api/contact` (Resend), envía email en idioma del lead.
12. Deploy en Vercel project `iaeva-landing` + cutover DNS.
13. Alta GSC + Bing + sitemap + request indexing (incluir ambos idiomas).

**Criterio de aceptación**:
- [ ] `curl https://iaeva.com` devuelve HTML inicial con title/meta/JSON-LD correctos
- [ ] PageSpeed LCP <2.0s, CLS <0.05
- [ ] Sitemap con 22 URLs accesible (11 ES + 11 EN)
- [ ] Las 3 URLs antiguas + 4 verticales + 3 legales + `/precios` responden 200 en ES
- [ ] Las equivalentes responden 200 en EN bajo `/en/`
- [ ] hreflang correctamente declarado en todas las páginas (validar con herramienta como Sitebulb o Screaming Frog si hay)
- [ ] GSC verificado y sitemap enviado
- [ ] CTAs apuntan a `app.iaeva.com/signup` y funcionan

### Fase 3 — Pricing real en Stripe (semanas 7-8)

**Objetivo**: cobros activos. Trial → checkout → suscripción → enforcement.

**Tareas**:
1. Crear 3 products × 2 currencies × 2 intervalos = 12 prices en Stripe IAEVA.
2. Webhook en `app.iaeva.com/api/stripe/webhook` con secret.
3. Plan enforcement: `lib/billing/limits.ts` adaptado.
4. Trial flow: signup sin tarjeta → 14 días → email recordatorio 3 días antes.
5. Página Pricing en landing con datos matching Stripe.
6. Página Billing en app con Customer Portal embebido.
7. Stripe Tax habilitado para EUR.
8. Facturas automáticas PDF.
9. Tests e2e: signup → trial → checkout → upgrade.

**Criterio de aceptación**:
- [ ] Signup sin tarjeta crea shop en TRIAL
- [ ] Email recordatorio 3 días antes del fin de trial
- [ ] Checkout funciona en USD y EUR
- [ ] Webhook actualiza `Shop.plan` al pagar
- [ ] Crear profesional N+1 en STARTER bloqueado con mensaje upgrade
- [ ] Factura PDF llega al email del shop
- [ ] Customer Portal permite cambiar tarjeta y cancelar

### Fase 4 — Limpieza terminológica del dashboard (semanas 9-10)

**Objetivo**: producto cohesivo con marca IAEVA en cada rincón.

**Tareas**:
1. Feature flags por nicho (`lib/features/byNiche.ts`).
2. Navegación condicional en `app/dashboard/layout.tsx`.
3. Renombrados de copy (walk-ins, tips, loyalty, memberships, commission, clients).
4. Plantillas servicio por nicho al crear shop.
5. Email transaccional con copy IAEVA + variables del nicho.
6. Empty states adaptados.
7. Iconografía por nicho.
8. Settings → Shop profile: nº colegiado, licencia sanitaria.
9. Docs: nuevo `README.md`, guides, `CHANGELOG.md`.
10. QA visual completo recorrido por cada nicho.

**Criterio de aceptación**:
- [ ] Shop DENTAL no muestra loyalty ni tips en navegación
- [ ] Shop AESTHETIC muestra loyalty (renombrado "Bonos") y tips opcional
- [ ] `grep -ri "barbero\|barbería\|corte" app/` no devuelve coincidencias en strings de UI
- [ ] Emails transaccionales con marca IAEVA y copy del nicho
- [ ] README de `iaeva-app` describe IAEVA

---

## 9. Resumen de decisiones aprobadas

| Tema | Decisión |
|---|---|
| Relación con Domicita | Fork independiente. Aislamiento total. Domicita producción no se toca |
| Nichos V1 | Dental, Estética, Fisio, Bienestar genérico (4) |
| Features producto | Mantener todo de Domicita. Solo renombrar UI, sin tocar schema |
| Mercado | Latam principal + España secundario + US/UK/Caribe anglófono. USD default + EUR |
| Idiomas | ES (español neutro) + EN (inglés US/UK neutro). i18n con next-intl en app, Astro i18n routing en landing |
| Locale | Default `es` neutro panhispánico (no `es-ES`); `en` para mercado anglo |
| Pricing | 3 planes: STARTER 49 / CLINIC 129 / CLINIC PRO 299 USD |
| Trial | 14 días sin tarjeta |
| Landing stack | Astro 5 |
| Landing secciones | Hero, Features, HowItWorks, Pricing, Verticales, SEOKeywords, CTA |
| Landing quitadas | VapiVoice, CustomerServiceHub, Testimonials, ImplementationPlan, Calcom |
| Verticales nuevas | `/clinicas-dentales`, `/centros-esteticos`, `/fisioterapia`, `/psicologia` |
| Flujo conversión | Signup directo (sin demo Calcom) |
| Datos | DB nueva vacía |
| Stripe | Cuenta nueva |
| Vercel | Projects nuevos en team actual |
| Rename carpeta | `domicita-main/` → `iaeva-app/` (hecho 2026-05-22) |
| Orden de fases | Fase 0 → 1 → 2 → 3 → 4 (~10 semanas) |

---

## 10. Anexo — Resumen auditoría SEO

La auditoría completa de iaeva.com (realizada por agente seo-mastermind, sin acceso real a DataForSEO/GSC) reveló:

- **Buena noticia**: la landing actual NO tiene SEO consolidado en HTML inicial. Es SPA con `react-helmet`, `index.html` sirve placeholder de Lovable, `lang="en"`, sin `robots.txt`/`sitemap.xml`. Migrar a Astro es upgrade, no riesgo.
- **A conservar literal**: 3 URLs (`/`, `/casos-de-uso`, `/contacto`), title/meta/canonical de home, las 45 keywords de `SEOKeywordsSection`, 2 JSON-LD (SoftwareApplication con aggregateRating 4.8/127 + Organization), H1/H2/métricas de casos de uso.
- **Oportunidades**: landings verticales por nicho con long-tail comercial; blog/recursos para autoridad YMYL (futuro Fase 5+); arreglar enlaces rotos (`/blog` inexistente, `to="#"`, políticas externas).
- **Limitación**: la auditoría se hizo sobre código, no sobre datos GSC/DataForSEO reales. Después del lanzamiento Astro hay que conectar Search Console y validar.

---

---

## 11. Nota sobre descomposición en planes de implementación

Este spec abarca ~10 semanas y 5 fases. Es demasiado grande para un único plan de implementación. La forma de ejecutarlo es:

1. Spec aprobado → master doc de referencia (este archivo).
2. Plan de implementación **por fase** (5 planes secuenciales, cada uno generado vía writing-plans cuando llegue su turno).
3. Empezar generando solo el plan de **Fase 0**. Al cerrarla, generar el de Fase 1. Y así sucesivamente.

Esto evita que un plan se quede obsoleto antes de ejecutarse y permite ajustar la siguiente fase con aprendizajes de la anterior.

---

**Fin del spec.**
