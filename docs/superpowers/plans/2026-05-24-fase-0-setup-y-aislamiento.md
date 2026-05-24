# Fase 0 — Setup y Aislamiento — Plan de Implementación

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Crear toda la infraestructura aislada de IAEVA (cuentas, proyectos, repos, DNS, env files) sin tocar Domicita producción. Al final de la fase ambos repos (`iaeva-app` e `iaeva-landing`) están vivos en GitHub y Vercel con env vars válidas pero sirviendo placeholders.

**Architecture:** Dos repos git independientes en `/Users/kelvin/Desktop/IAEVA-SAAS/`. Cuentas externas nuevas creadas manualmente por el usuario (KYC, OAuth). Claude ejecuta solo trabajo local de código (git, archivos, configs) y nunca toca credenciales reales — el usuario las pega en `.env.local` cuando las tiene.

**Tech Stack:** git, GitHub, Vercel, Supabase, Stripe, Twilio (o Meta WhatsApp), Sentry, Resend, Upstash, Google Cloud, Cloudflare/Vercel DNS.

**Reglas de oro:**
1. **Nunca tocar Domicita producción.** Verificar `git remote -v` antes de cualquier push. Verificar `grep -i "domicita" .env.local` antes de cada commit.
2. **El usuario crea cuentas externas, Claude no.** Las tareas marcadas `[USUARIO]` son manuales del usuario; las `[CLAUDE]` son técnicas locales.
3. **Sin credenciales reales en este repo.** `.env.local` está en `.gitignore` y solo el usuario lo edita. Claude pone `.env.example` con valores ficticios.
4. **Commits frecuentes y atómicos.** Cada task termina con commit.

---

## Estructura de archivos creados/modificados

```
IAEVA-SAAS/
├── iaeva-app/                                # repo git nuevo
│   ├── .git/                                 # init en Task 2
│   ├── .gitignore                            # ya existe (Next.js standard)
│   ├── .env.example                          # nuevo, Task 3
│   ├── .env.local                            # creado por usuario, NUNCA committed
│   ├── README.md                             # reescrito, Task 4
│   ├── CHANGELOG.md                          # reescrito desde v0.1.0, Task 4
│   ├── package.json                          # rename "domicita" → "iaeva-app", Task 4
│   ├── docs/superpowers/specs/               # ya existe el spec
│   ├── docs/superpowers/plans/               # ya existe este plan
│   ├── docs/OPERATIONS.md                    # nuevo, runbook de protocolo aislamiento, Task 5
│   └── scripts/check-isolation.sh            # nuevo, verificación pre-commit, Task 5
│
└── iaeva_landing/                            # repo git existente, reapuntado
    ├── .git/                                 # ya existe, se reapunta remote en Task 7
    ├── .env.example                          # nuevo, Task 8
    ├── README.md                             # reescrito, Task 8
    └── package.json                          # rename, Task 8
```

---

## Task 0: Verificación inicial del estado

**Files:**
- Verify only — no changes

- [ ] **Step 1: Confirmar que estamos en la carpeta correcta**

Run:
```bash
pwd
ls /Users/kelvin/Desktop/IAEVA-SAAS/
```
Expected: `iaeva-app` e `iaeva_landing` listados; pwd cualquiera.

- [ ] **Step 2: Confirmar que `iaeva-app/` NO tiene git todavía**

Run:
```bash
ls -la /Users/kelvin/Desktop/IAEVA-SAAS/iaeva-app/.git 2>&1
```
Expected: `No such file or directory`.

Si por error existe `.git/` y apunta a domicita producción, **PARAR** y avisar al usuario antes de seguir.

- [ ] **Step 3: Confirmar git de `iaeva_landing/`**

Run:
```bash
cd /Users/kelvin/Desktop/IAEVA-SAAS/iaeva_landing && git remote -v
```
Expected: `origin  https://github.com/kelvinrrivera/iaeva_web.git (fetch)` y `(push)`.

Si el remote apunta a cualquier repo de Domicita, **PARAR** y avisar al usuario.

- [ ] **Step 4: Verificar `.env*` files no contienen credenciales mezcladas**

Run:
```bash
ls /Users/kelvin/Desktop/IAEVA-SAAS/iaeva-app/.env* 2>&1 || echo "no env files"
ls /Users/kelvin/Desktop/IAEVA-SAAS/iaeva_landing/.env* 2>&1 || echo "no env files"
```
Expected: `iaeva-app` no tiene `.env*`. `iaeva_landing` puede tener `.env` (es de la landing actual, lo revisaremos en Task 8).

Si `iaeva_landing/.env` existe, leer su contenido y confirmar que NO contiene credenciales de Domicita producción (solo Vite vars públicas).

---

## Task 1 [USUARIO]: Crear cuentas externas IAEVA

> **Esta task es 100% manual del usuario.** Claude no puede crear cuentas, hacer KYC, ni autenticar OAuth. El usuario debe completar TODAS las cuentas antes de avanzar al resto del plan, porque cada `.env.local` posterior depende de tener las credenciales.

**Cuentas a crear (en este orden recomendado):**

- [ ] **GitHub: 2 repos nuevos**
  - https://github.com/new → name: `iaeva-app`, private, no README/license (lo subimos nosotros)
  - https://github.com/new → name: `iaeva-landing`, private, no README/license
  - Anotar las URLs SSH: `git@github.com:<usuario>/iaeva-app.git` y `git@github.com:<usuario>/iaeva-landing.git`

- [ ] **Vercel: 2 projects nuevos**
  - https://vercel.com/new → Import `iaeva-app` (Next.js detectado automáticamente)
  - https://vercel.com/new → Import `iaeva-landing` (Astro — configurar manualmente si aún no lo detecta)
  - Asignar dominios: `app.iaeva.com` al primero, `iaeva.com` al segundo (configuración en Project Settings → Domains)
  - **No deploy aún** — esperar al primer push de cada repo.

- [ ] **Supabase: proyecto nuevo IAEVA**
  - https://supabase.com/dashboard → New project → Name: `iaeva-prod`, region: la más cercana a Latam (us-east-1 o sa-east-1)
  - Anotar:
    - `NEXT_PUBLIC_SUPABASE_URL` (URL del proyecto)
    - `NEXT_PUBLIC_SUPABASE_ANON_KEY` (anon key)
    - `SUPABASE_SERVICE_ROLE_KEY` (service role — SECRETO, solo server-side)
    - Database connection string (postgres://) — para Prisma `DATABASE_URL` y `DIRECT_URL`

- [ ] **Stripe: cuenta nueva**
  - https://dashboard.stripe.com/register → email nuevo o alias para IAEVA. **No usar la cuenta de Domicita.**
  - Activar Test mode primero. KYC y activación de Live mode pueden tomar días — no bloquean Fase 0.
  - Anotar (Test mode):
    - `STRIPE_PUBLISHABLE_KEY` (pk_test_...)
    - `STRIPE_SECRET_KEY` (sk_test_...)
    - `STRIPE_WEBHOOK_SECRET` (se genera al configurar webhook en Fase 3)

- [ ] **WhatsApp Business API**
  - Decidir: Meta directo (Business Manager + WhatsApp Business Account) o Twilio.
  - Recomendación: Meta directo si quieres reducir costo por mensaje; Twilio si quieres simpler onboarding y compartir con SMS.
  - Crear cuenta nueva, número dedicado, NO usar el número de Domicita.
  - Anotar credenciales según proveedor:
    - Twilio: `TWILIO_ACCOUNT_SID`, `TWILIO_AUTH_TOKEN`, `TWILIO_WHATSAPP_NUMBER`
    - Meta: `META_APP_ID`, `META_APP_SECRET`, `META_WHATSAPP_PHONE_NUMBER_ID`, `META_WHATSAPP_ACCESS_TOKEN`

- [ ] **Sentry: 2 proyectos nuevos**
  - https://sentry.io → New project → `iaeva-app` (platform: Next.js) → anotar DSN
  - New project → `iaeva-landing` (platform: Astro o JavaScript) → anotar DSN

- [ ] **Resend: dominio iaeva.com verificado**
  - https://resend.com → API Keys → crear nueva key para IAEVA → anotar `RESEND_API_KEY`
  - Domains → Add `iaeva.com` → configurar DNS records (TXT + MX) en el proveedor DNS
  - Esperar verificación (~5-10 min)

- [ ] **Upstash Redis: DB nueva**
  - https://upstash.com → Create Database → name: `iaeva-prod` → region cercana
  - Anotar `UPSTASH_REDIS_REST_URL` y `UPSTASH_REDIS_REST_TOKEN`

- [ ] **Google Cloud: proyecto nuevo para Calendar OAuth**
  - https://console.cloud.google.com → New Project → name: `iaeva-prod`
  - APIs & Services → Enable Google Calendar API
  - Credentials → Create OAuth 2.0 Client ID → application type: Web application
    - Redirect URI autorizada: `https://app.iaeva.com/api/calendar/callback` y `http://localhost:3000/api/calendar/callback` para dev
  - Anotar `GOOGLE_CLIENT_ID` y `GOOGLE_CLIENT_SECRET`

- [ ] **Google Generative AI (Gemini)**
  - https://aistudio.google.com → Get API key → crear nueva para IAEVA → anotar `GOOGLE_GENAI_API_KEY`

- [ ] **OpenAI (fallback)**
  - https://platform.openai.com → API keys → crear nueva → anotar `OPENAI_API_KEY`

- [ ] **DNS de iaeva.com**
  - Confirmar registrar/proveedor DNS de `iaeva.com` (Cloudflare, Namecheap, etc.)
  - Configurar:
    - `iaeva.com` (A o CNAME) → Vercel landing project
    - `app.iaeva.com` (CNAME) → Vercel app project
    - Records de Resend (TXT + MX) cuando verifique el dominio
  - **Verificar** que NO se toca ningún DNS de `domicita.com`.

**Acceptance check del usuario:**
- [ ] Tengo un documento (1Password, Bitwarden, doc privado) con todas las credenciales anteriores
- [ ] DNS propaga: `dig iaeva.com` y `dig app.iaeva.com` devuelven resultados Vercel
- [ ] Ninguna de las cuentas comparte recurso con Domicita (verificado)

---

## Task 2 [CLAUDE]: Inicializar git en iaeva-app

**Files:**
- Create: `/Users/kelvin/Desktop/IAEVA-SAAS/iaeva-app/.git/`
- Verify: `git remote -v` shows only iaeva-app remote

- [ ] **Step 1: Pedir al usuario la URL del repo iaeva-app**

Preguntar (no asumir): "¿Cuál es la URL SSH del repo `iaeva-app` que creaste en GitHub? Formato: `git@github.com:<usuario>/iaeva-app.git`"

Esperar respuesta. Guardar como variable conceptual `<REPO_URL_APP>`.

- [ ] **Step 2: git init en iaeva-app**

Run:
```bash
cd /Users/kelvin/Desktop/IAEVA-SAAS/iaeva-app && git init -b main
```
Expected: `Initialized empty Git repository in /Users/kelvin/Desktop/IAEVA-SAAS/iaeva-app/.git/`

- [ ] **Step 3: Configurar remote**

Run (sustituyendo `<REPO_URL_APP>`):
```bash
cd /Users/kelvin/Desktop/IAEVA-SAAS/iaeva-app && git remote add origin <REPO_URL_APP>
```

- [ ] **Step 4: Verificar remote**

Run:
```bash
cd /Users/kelvin/Desktop/IAEVA-SAAS/iaeva-app && git remote -v
```
Expected: solo el remote `iaeva-app` que el usuario indicó. Si aparece cualquier referencia a Domicita, **PARAR**.

- [ ] **Step 5: Verificar .gitignore cubre .env**

Run:
```bash
grep -E "^\.env" /Users/kelvin/Desktop/IAEVA-SAAS/iaeva-app/.gitignore
```
Expected: al menos una línea matchea `.env*` o `.env.local`.

Si no matchea, añadir a `.gitignore`:
```
.env
.env.local
.env*.local
```

---

## Task 3 [CLAUDE]: Crear .env.example en iaeva-app

**Files:**
- Create: `/Users/kelvin/Desktop/IAEVA-SAAS/iaeva-app/.env.example`

- [ ] **Step 1: Escribir .env.example con todas las variables esperadas**

Crear archivo con este contenido literal (valores ficticios):

```bash
# ============================================================
# IAEVA App — .env.example
# Copy this file to .env.local and fill with REAL IAEVA credentials.
# NEVER paste Domicita production credentials here.
# ============================================================

# --- App config ---
NEXT_PUBLIC_APP_URL=http://localhost:3000
NEXT_PUBLIC_LANDING_URL=https://iaeva.com
NODE_ENV=development

# --- Supabase ---
NEXT_PUBLIC_SUPABASE_URL=https://your-iaeva-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJxxx...
SUPABASE_SERVICE_ROLE_KEY=eyJxxx...

# --- Database (Prisma) ---
DATABASE_URL=postgresql://postgres:password@host:5432/postgres?pgbouncer=true
DIRECT_URL=postgresql://postgres:password@host:5432/postgres

# --- Stripe (Test mode initially) ---
STRIPE_PUBLISHABLE_KEY=pk_test_xxx
STRIPE_SECRET_KEY=sk_test_xxx
STRIPE_WEBHOOK_SECRET=whsec_xxx

# --- WhatsApp (choose Twilio or Meta) ---
# Twilio
TWILIO_ACCOUNT_SID=ACxxx
TWILIO_AUTH_TOKEN=xxx
TWILIO_WHATSAPP_NUMBER=whatsapp:+14155238886
# Meta (alternative)
# META_APP_ID=
# META_APP_SECRET=
# META_WHATSAPP_PHONE_NUMBER_ID=
# META_WHATSAPP_ACCESS_TOKEN=

# --- AI providers ---
GOOGLE_GENAI_API_KEY=AIzaxxx
OPENAI_API_KEY=sk-xxx

# --- Resend ---
RESEND_API_KEY=re_xxx
RESEND_FROM_EMAIL=hola@iaeva.com

# --- Upstash Redis ---
UPSTASH_REDIS_REST_URL=https://xxx.upstash.io
UPSTASH_REDIS_REST_TOKEN=xxx

# --- Sentry ---
SENTRY_DSN=https://xxx@xxx.ingest.sentry.io/xxx
NEXT_PUBLIC_SENTRY_DSN=https://xxx@xxx.ingest.sentry.io/xxx
SENTRY_ORG=iaeva
SENTRY_PROJECT=iaeva-app
SENTRY_AUTH_TOKEN=xxx

# --- Google Calendar OAuth ---
GOOGLE_CLIENT_ID=xxx.apps.googleusercontent.com
GOOGLE_CLIENT_SECRET=GOCSPX-xxx
GOOGLE_REDIRECT_URI=https://app.iaeva.com/api/calendar/callback
```

- [ ] **Step 2: Verificar archivo creado**

Run:
```bash
ls -la /Users/kelvin/Desktop/IAEVA-SAAS/iaeva-app/.env.example
```
Expected: archivo existe.

- [ ] **Step 3: Commit**

```bash
cd /Users/kelvin/Desktop/IAEVA-SAAS/iaeva-app && git add .env.example && git commit -m "chore: add .env.example template for IAEVA"
```

---

## Task 4 [CLAUDE]: Rebranding mínimo de package.json + README + CHANGELOG

> Este task es solo rebranding **textual/metadata**, no toca lógica. La adaptación profunda del producto a IAEVA es Fase 1. Aquí solo: nombre del paquete, README inicial, changelog reseteado.

**Files:**
- Modify: `/Users/kelvin/Desktop/IAEVA-SAAS/iaeva-app/package.json` (campo `name` y opcionalmente `description`)
- Overwrite: `/Users/kelvin/Desktop/IAEVA-SAAS/iaeva-app/README.md`
- Overwrite: `/Users/kelvin/Desktop/IAEVA-SAAS/iaeva-app/CHANGELOG.md`

- [ ] **Step 1: Leer package.json actual**

Read `/Users/kelvin/Desktop/IAEVA-SAAS/iaeva-app/package.json` line 1-5 — confirmar campo `"name": "domicita"`.

- [ ] **Step 2: Cambiar nombre del paquete**

Edit `/Users/kelvin/Desktop/IAEVA-SAAS/iaeva-app/package.json`:
- old: `"name": "domicita",`
- new: `"name": "iaeva-app",`

- [ ] **Step 3: Sobreescribir README.md con stub IAEVA**

Crear nuevo contenido:

```markdown
# IAEVA App

**Asistente de WhatsApp con IA para clínicas y centros de bienestar.**

SaaS multi-nicho que automatiza la recepción virtual de clínicas dentales, centros de estética, fisioterapia y bienestar. Forkeado desde Domicita y adaptado al sector salud y bienestar.

## Quickstart

```bash
pnpm install
cp .env.example .env.local   # rellenar con credenciales IAEVA reales
pnpm prisma generate
pnpm prisma migrate dev
pnpm dev
```

Abrir [http://localhost:3000](http://localhost:3000).

## Docs

- [Diseño del producto](docs/superpowers/specs/2026-05-24-iaeva-fork-design.md)
- [Plan Fase 0 — setup y aislamiento](docs/superpowers/plans/2026-05-24-fase-0-setup-y-aislamiento.md)
- [Protocolo de operaciones / aislamiento](docs/OPERATIONS.md)

## Aislamiento de Domicita

Este repo es un fork **totalmente independiente** de Domicita. Nunca debe tocar:
- Cuenta Supabase de Domicita
- Cuenta Stripe de Domicita
- Número WhatsApp de Domicita
- Repo git de Domicita
- DNS de domicita.com

Ver `docs/OPERATIONS.md` para verificaciones obligatorias antes de cualquier `git push`, migration o cambio de webhook.

## Stack

- Next.js 16 · React 19 · Prisma 7 · Supabase
- Tailwind v4 · shadcn/ui
- Stripe · Twilio/Meta WhatsApp · Google Gemini + OpenAI
- Sentry · Resend · Upstash Redis
- Vercel deploy

## License

MIT
```

- [ ] **Step 4: Sobreescribir CHANGELOG.md desde v0.1.0**

```markdown
# Changelog

All notable changes to IAEVA App.

## [0.1.0] — 2026-05-24

### Initial

- Forked from Domicita codebase (estado de Domicita en fecha del fork).
- Repo independiente, sin remote ni shared resources con Domicita.
- Setup inicial de infra IAEVA (Supabase, Stripe, WhatsApp, Sentry, Resend, Upstash, Google Cloud, Vercel) — todo en cuentas/proyectos nuevos dedicados.

### To come (Fase 1+)

Ver `docs/superpowers/specs/2026-05-24-iaeva-fork-design.md`.
```

- [ ] **Step 5: Verificar cambios**

Run:
```bash
cd /Users/kelvin/Desktop/IAEVA-SAAS/iaeva-app && grep '"name"' package.json | head -1
```
Expected: `  "name": "iaeva-app",`

- [ ] **Step 6: Commit**

```bash
cd /Users/kelvin/Desktop/IAEVA-SAAS/iaeva-app && \
  git add package.json README.md CHANGELOG.md && \
  git commit -m "chore: rebrand metadata to iaeva-app (package name, README, changelog)"
```

---

## Task 5 [CLAUDE]: Runbook de operaciones + script de verificación de aislamiento

**Files:**
- Create: `/Users/kelvin/Desktop/IAEVA-SAAS/iaeva-app/docs/OPERATIONS.md`
- Create: `/Users/kelvin/Desktop/IAEVA-SAAS/iaeva-app/scripts/check-isolation.sh`

- [ ] **Step 1: Crear docs/OPERATIONS.md**

```markdown
# IAEVA — Operations Runbook

> **Regla cero:** Domicita producción nunca se toca. Cualquier operación que pueda afectar repos, DBs, Stripe, WhatsApp, DNS o servicios de Domicita requiere confirmación explícita del operador antes de ejecutarse.

## Verificación de aislamiento (correr antes de cada push/migration)

```bash
bash scripts/check-isolation.sh
```

El script falla con exit 1 si detecta:
- Remote git que no sea `iaeva-*`
- `.env.local` con strings sospechosas (`domicita`, `barbershop`, dominios de Domicita)
- URL de Supabase/Stripe que coincida con la cuenta Domicita conocida

## Antes de ejecutar `prisma migrate deploy`

1. Confirmar `DATABASE_URL` apunta a Supabase IAEVA (no Domicita).
2. Confirmar la DB destino está vacía o ya gestionada por IAEVA.
3. Si hay duda, abortar.

## Antes de configurar un webhook (Stripe, WhatsApp, Google)

1. Confirmar que la URL del webhook empieza por `https://app.iaeva.com/...` (NUNCA por dominio Domicita).
2. Confirmar que el `webhook_secret` se guarda en `.env.local` de IAEVA, no se mezcla.

## Antes de hacer push

```bash
git remote -v   # solo iaeva-* remotos
bash scripts/check-isolation.sh
```

Si la verificación falla, NO pushear. Investigar.

## Cuentas / proyectos (registro)

Tener un doc privado (1Password, Bitwarden) con:
- Supabase: project ref, URL, anon, service role
- Stripe: account ID, publishable + secret keys
- WhatsApp: proveedor (Twilio/Meta), número, credenciales
- Sentry: org, project, DSN
- Resend: dominio, API key
- Upstash: REST URL + token
- Google Cloud: project ID, OAuth client ID/secret
- Vercel: project ID, team ID
- DNS: provider de iaeva.com

Estas credenciales **nunca** se commiteran al repo.

## En caso de incidente "creo que toqué Domicita"

1. Parar todo. No más commits, no más pushes.
2. Verificar git log: `git log --oneline -20` ¿algún commit con archivos sensibles?
3. Verificar webhooks externos: ¿alguno apunta accidentalmente a un dominio o cuenta Domicita?
4. Avisar al operador humano antes de cualquier remediación.
```

- [ ] **Step 2: Crear scripts/check-isolation.sh**

```bash
#!/usr/bin/env bash
# IAEVA — Pre-action isolation check
# Exits 1 if any sign of Domicita contamination is found.

set -euo pipefail

FAIL=0
REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"

echo "🔍 IAEVA isolation check..."

# 1. Git remote check
cd "$REPO_ROOT"
if ! git rev-parse --git-dir > /dev/null 2>&1; then
  echo "⚠️  No git repo here (skipping remote check)"
else
  REMOTES=$(git remote -v 2>/dev/null || true)
  if echo "$REMOTES" | grep -iE "domicita|barbershop" > /dev/null; then
    echo "❌ Git remote contains 'domicita' or 'barbershop' — STOP"
    FAIL=1
  else
    echo "✅ Git remotes OK"
  fi
fi

# 2. .env.local check (only if present)
if [ -f "$REPO_ROOT/.env.local" ]; then
  if grep -iE "domicita\.com|domicita\.do|barbershop" "$REPO_ROOT/.env.local" > /dev/null; then
    echo "❌ .env.local contains references to Domicita — STOP"
    FAIL=1
  else
    echo "✅ .env.local clean of Domicita refs"
  fi
else
  echo "ℹ️  No .env.local present (skipping)"
fi

# 3. Check that NEXT_PUBLIC_APP_URL (if set) does NOT point to domicita domain
if [ -f "$REPO_ROOT/.env.local" ]; then
  APP_URL=$(grep -E "^NEXT_PUBLIC_APP_URL=" "$REPO_ROOT/.env.local" | cut -d= -f2- || true)
  if [ -n "$APP_URL" ] && echo "$APP_URL" | grep -iE "domicita" > /dev/null; then
    echo "❌ NEXT_PUBLIC_APP_URL points to domicita — STOP"
    FAIL=1
  fi
fi

if [ "$FAIL" -eq 1 ]; then
  echo ""
  echo "🛑 Isolation check FAILED. Do not push/deploy/migrate."
  exit 1
fi

echo ""
echo "✅ Isolation check passed."
```

- [ ] **Step 3: Hacer ejecutable**

```bash
cd /Users/kelvin/Desktop/IAEVA-SAAS/iaeva-app && chmod +x scripts/check-isolation.sh
```

- [ ] **Step 4: Probar script**

```bash
cd /Users/kelvin/Desktop/IAEVA-SAAS/iaeva-app && bash scripts/check-isolation.sh
```
Expected output:
```
🔍 IAEVA isolation check...
✅ Git remotes OK
ℹ️  No .env.local present (skipping)

✅ Isolation check passed.
```

- [ ] **Step 5: Commit**

```bash
cd /Users/kelvin/Desktop/IAEVA-SAAS/iaeva-app && \
  git add docs/OPERATIONS.md scripts/check-isolation.sh && \
  git commit -m "chore: add operations runbook and isolation check script"
```

---

## Task 6 [USUARIO + CLAUDE]: Poblar .env.local de iaeva-app

> Esta task es híbrida: el usuario pega las credenciales reales en `.env.local`. Claude verifica el resultado pero NUNCA lee/escribe credenciales reales.

- [ ] **Step 1 [USUARIO]: Crear `.env.local` a partir de `.env.example`**

```bash
cd /Users/kelvin/Desktop/IAEVA-SAAS/iaeva-app && cp .env.example .env.local
```

- [ ] **Step 2 [USUARIO]: Rellenar valores reales**

Editar `iaeva-app/.env.local` con las credenciales de Task 1. Cuidado especial:
- `DATABASE_URL` y `DIRECT_URL` apuntan al **proyecto Supabase IAEVA**, no a Domicita.
- `STRIPE_SECRET_KEY` empieza por `sk_test_` (test mode al inicio).
- Webhook secrets se rellenan en Fase 3.

- [ ] **Step 3 [CLAUDE]: Verificar que `.env.local` NO se va a commitear**

```bash
cd /Users/kelvin/Desktop/IAEVA-SAAS/iaeva-app && git check-ignore .env.local
```
Expected: `.env.local` (significa que git lo ignora). Si no devuelve nada, **STOP** — `.env.local` se va a commitear y eso es un fallo de seguridad. Añadir a `.gitignore` y reintentar.

- [ ] **Step 4 [CLAUDE]: Correr isolation check**

```bash
cd /Users/kelvin/Desktop/IAEVA-SAAS/iaeva-app && bash scripts/check-isolation.sh
```
Expected: `✅ Isolation check passed.`

Si falla, leer el output, identificar la línea problemática del `.env.local`, pedir al usuario que la corrija (sin que Claude lea el archivo completo).

- [ ] **Step 5 [USUARIO]: Confirmar verbalmente**

El usuario confirma a Claude: "He rellenado `.env.local` con credenciales IAEVA. He revisado que ninguna línea contiene URL/key de Domicita."

Claude NO hace commit aquí — el `.env.local` está en `.gitignore`.

---

## Task 7 [CLAUDE]: Reapuntar iaeva_landing git remote al nuevo repo

**Files:**
- Modify: `/Users/kelvin/Desktop/IAEVA-SAAS/iaeva_landing/.git/config` (vía `git remote set-url`)

- [ ] **Step 1: Pedir al usuario la URL del nuevo repo iaeva-landing**

Preguntar: "¿Cuál es la URL SSH del repo `iaeva-landing` que creaste en GitHub?"

Esperar respuesta. Guardar como `<REPO_URL_LANDING>`.

- [ ] **Step 2: Verificar remote actual**

```bash
cd /Users/kelvin/Desktop/IAEVA-SAAS/iaeva_landing && git remote -v
```
Expected: `origin  https://github.com/kelvinrrivera/iaeva_web.git`

- [ ] **Step 3: Cambiar URL del remote**

```bash
cd /Users/kelvin/Desktop/IAEVA-SAAS/iaeva_landing && git remote set-url origin <REPO_URL_LANDING>
```

- [ ] **Step 4: Verificar**

```bash
cd /Users/kelvin/Desktop/IAEVA-SAAS/iaeva_landing && git remote -v
```
Expected: solo el nuevo URL `iaeva-landing`. El antiguo `iaeva_web.git` ya no aparece.

- [ ] **Step 5: Decisión sobre el repo viejo `iaeva_web.git`**

Decisión a confirmar con el usuario: "El repo viejo `kelvinrrivera/iaeva_web` ¿lo archivamos en GitHub, lo borramos, o lo dejamos como histórico de la versión Vite previa?"

Si decisión = archivar: instruir al usuario a ir a Settings → Archive en GitHub. Claude no puede hacerlo.
Si decisión = borrar: confirmar dos veces antes de instruir al usuario.
Si decisión = dejar: anotar en commit message que es histórico.

(No bloquea la fase; se puede resolver al final.)

---

## Task 8 [CLAUDE]: Rebranding metadata en iaeva_landing

> Solo metadata. La migración a Astro es Fase 2. Esta task asegura que el repo Vite actual ya está en branding IAEVA cuando se cierre Fase 0.

**Files:**
- Modify: `/Users/kelvin/Desktop/IAEVA-SAAS/iaeva_landing/package.json`
- Create: `/Users/kelvin/Desktop/IAEVA-SAAS/iaeva_landing/.env.example`
- Overwrite: `/Users/kelvin/Desktop/IAEVA-SAAS/iaeva_landing/README.md`

- [ ] **Step 1: Leer package.json actual**

Read `/Users/kelvin/Desktop/IAEVA-SAAS/iaeva_landing/package.json` líneas 1-5. Confirmar `"name": "vite_react_shadcn_ts"`.

- [ ] **Step 2: Cambiar nombre del paquete**

Edit:
- old: `"name": "vite_react_shadcn_ts",`
- new: `"name": "iaeva-landing",`

- [ ] **Step 3: Crear .env.example**

```bash
# IAEVA Landing — .env.example
# Vite vars (public, prefixed VITE_).
# Note: this landing will be migrated to Astro in Phase 2.

VITE_APP_URL=https://app.iaeva.com
VITE_LANDING_URL=https://iaeva.com
VITE_SENTRY_DSN=
```

- [ ] **Step 4: Sobreescribir README.md**

```markdown
# IAEVA Landing

Landing pública de IAEVA en `iaeva.com`.

**Estado actual:** Vite + React + Shadcn (heredado de versión previa).
**Estado planeado:** migración a Astro 5 en Fase 2 — ver `../iaeva-app/docs/superpowers/specs/2026-05-24-iaeva-fork-design.md`.

## Quickstart

```bash
pnpm install
cp .env.example .env.local
pnpm dev
```

## Aislamiento

Este repo NO está conectado a backend de Domicita. CTAs y forms apuntan a `app.iaeva.com`, NUNCA a `domicita.com`.
```

- [ ] **Step 5: Verificar .gitignore cubre .env**

```bash
grep -E "^\.env" /Users/kelvin/Desktop/IAEVA-SAAS/iaeva_landing/.gitignore
```
Expected: al menos una línea matchea `.env.local`. Si no, añadir.

- [ ] **Step 6: Commit**

```bash
cd /Users/kelvin/Desktop/IAEVA-SAAS/iaeva_landing && \
  git add package.json README.md .env.example .gitignore && \
  git commit -m "chore: rebrand metadata to iaeva-landing (package name, README, env example)"
```

---

## Task 9 [CLAUDE]: Mover spec y plan al repo iaeva-app (commit inicial)

> El spec y este plan se crearon antes del git init. Ahora hay que asegurarse de que están dentro del primer commit "real" para que viajen con el repo.

**Files:**
- Verify: `/Users/kelvin/Desktop/IAEVA-SAAS/iaeva-app/docs/superpowers/specs/2026-05-24-iaeva-fork-design.md`
- Verify: `/Users/kelvin/Desktop/IAEVA-SAAS/iaeva-app/docs/superpowers/plans/2026-05-24-fase-0-setup-y-aislamiento.md`

- [ ] **Step 1: Verificar que los archivos están y son tracked o untracked**

```bash
cd /Users/kelvin/Desktop/IAEVA-SAAS/iaeva-app && git status docs/superpowers/
```

- [ ] **Step 2: Si los archivos están untracked, añadirlos**

```bash
cd /Users/kelvin/Desktop/IAEVA-SAAS/iaeva-app && \
  git add docs/superpowers/specs/2026-05-24-iaeva-fork-design.md \
          docs/superpowers/plans/2026-05-24-fase-0-setup-y-aislamiento.md && \
  git commit -m "docs: add IAEVA design spec and Phase 0 implementation plan"
```

Si ya están tracked, skip este step.

---

## Task 10 [CLAUDE + USUARIO]: Primer push a GitHub de iaeva-app

- [ ] **Step 1 [CLAUDE]: Correr isolation check antes de pushear**

```bash
cd /Users/kelvin/Desktop/IAEVA-SAAS/iaeva-app && bash scripts/check-isolation.sh
```
Expected: `✅ Isolation check passed.`

- [ ] **Step 2 [CLAUDE]: Verificar log**

```bash
cd /Users/kelvin/Desktop/IAEVA-SAAS/iaeva-app && git log --oneline
```
Expected: ver al menos los commits de Tasks 3, 4, 5 (y 9 si aplica). No debe haber commits que mencionen "domicita" en mensaje, salvo el changelog que documenta el origen del fork.

- [ ] **Step 3 [USUARIO]: Pedir aprobación explícita para push**

Claude pregunta: "Voy a hacer `git push -u origin main` en `iaeva-app`. Esto subirá los commits anteriores al repo GitHub `iaeva-app`. Confirmas que el remote `<REPO_URL_APP>` es correcto y NO es ningún repo de Domicita?"

Esperar `sí` explícito del usuario.

- [ ] **Step 4 [CLAUDE]: Push**

```bash
cd /Users/kelvin/Desktop/IAEVA-SAAS/iaeva-app && git push -u origin main
```
Expected: branch `main` publicada en GitHub `iaeva-app`.

---

## Task 11 [CLAUDE + USUARIO]: Primer push a GitHub de iaeva_landing

- [ ] **Step 1 [CLAUDE]: Verificar remote**

```bash
cd /Users/kelvin/Desktop/IAEVA-SAAS/iaeva_landing && git remote -v
```
Expected: solo `iaeva-landing` URL.

- [ ] **Step 2 [USUARIO]: Aprobación explícita**

Claude pregunta: "Voy a hacer `git push -u origin main` en `iaeva_landing` apuntando a `<REPO_URL_LANDING>`. ¿Confirmas?"

Esperar `sí` del usuario.

- [ ] **Step 3 [CLAUDE]: Decidir estrategia de push**

Caso A — el repo en GitHub está vacío:
```bash
cd /Users/kelvin/Desktop/IAEVA-SAAS/iaeva_landing && git push -u origin main
```

Caso B — el repo tiene contenido (raro, pero posible si GitHub init con README):
- Hacer `git pull --rebase origin main` primero, resolver conflictos si los hay.

- [ ] **Step 4: Verificar en GitHub**

Usuario abre la URL del repo y confirma que aparece commit con metadata IAEVA.

---

## Task 12 [USUARIO]: Conectar Vercel projects a GitHub repos

> 100% manual. Vercel necesita OAuth con GitHub y selección de project.

- [ ] **Step 1: En Vercel `iaeva-app` project**
  - Settings → Git → conectar al repo `iaeva-app` recién creado en GitHub.
  - Branch: `main`
  - Framework Preset: Next.js (detectado automáticamente)
  - Build command: `pnpm build`
  - Install command: `pnpm install`
  - Output: `.next`
  - Environment Variables: añadir TODAS las variables de `.env.example` con los valores reales (Production, Preview, Development).
  - Domains: `app.iaeva.com` configurado.

- [ ] **Step 2: En Vercel `iaeva-landing` project**
  - Settings → Git → conectar al repo `iaeva-landing`.
  - Branch: `main`
  - Framework Preset: Vite (temporal, hasta Fase 2).
  - Build command: `pnpm build`
  - Output: `dist`
  - Environment Variables: las `VITE_*` del `.env.example` de landing.
  - Domains: `iaeva.com` configurado.

- [ ] **Step 3: Trigger primer deploy**

Vercel debería auto-deployar al recibir el push. Si no, Settings → Deployments → Redeploy.

- [ ] **Step 4: Confirmar URLs vivas**

```bash
curl -I https://app.iaeva.com
curl -I https://iaeva.com
```
Expected: ambos devuelven 200 o redirección a su frontend (Next.js home / landing actual).

---

## Task 13 [CLAUDE]: Verificación final de Fase 0

- [ ] **Step 1: Repos vivos**

Run:
```bash
cd /Users/kelvin/Desktop/IAEVA-SAAS/iaeva-app && git log --oneline | head -10
echo "---"
cd /Users/kelvin/Desktop/IAEVA-SAAS/iaeva_landing && git log --oneline | head -5
```
Expected: ambos tienen al menos un commit reciente con metadata IAEVA.

- [ ] **Step 2: Remotes correctos**

Run:
```bash
cd /Users/kelvin/Desktop/IAEVA-SAAS/iaeva-app && git remote -v
echo "---"
cd /Users/kelvin/Desktop/IAEVA-SAAS/iaeva_landing && git remote -v
```
Expected: ambos apuntan a sus repos `iaeva-*`. Ninguno referencia Domicita.

- [ ] **Step 3: Isolation check en ambos repos**

```bash
cd /Users/kelvin/Desktop/IAEVA-SAAS/iaeva-app && bash scripts/check-isolation.sh
```
Expected: `✅ Isolation check passed.`

(El landing no tiene script todavía — se añade en Fase 2 si aplica.)

- [ ] **Step 4: Smoke test de DNS**

```bash
dig +short app.iaeva.com
dig +short iaeva.com
```
Expected: ambos resuelven a IPs/CNAMEs de Vercel.

- [ ] **Step 5: Smoke test HTTP**

```bash
curl -sI https://app.iaeva.com | head -5
curl -sI https://iaeva.com | head -5
```
Expected: 200 o 308/301 (redirección de Vercel a HTTPS si configurado).

- [ ] **Step 6: Cuentas externas funcionando**

Verificaciones manuales del usuario:
- [ ] Login a Supabase IAEVA, ver proyecto.
- [ ] Login a Stripe IAEVA, ver dashboard Test mode.
- [ ] WhatsApp Business Account creado, número activo.
- [ ] Sentry recibe primer evento de prueba (puede dejarse para Fase 1).
- [ ] Resend dominio iaeva.com verificado (status: verified).

---

## Criterio de aceptación de Fase 0

- [ ] `git remote -v` en `iaeva-app` apunta solo a `iaeva-app` repo
- [ ] `git remote -v` en `iaeva_landing` apunta solo a `iaeva-landing` repo
- [ ] DNS `iaeva.com` y `app.iaeva.com` resuelven a Vercel
- [ ] Supabase IAEVA tiene proyecto activo con DB vacía
- [ ] Stripe IAEVA tiene cuenta activa (Test mode OK, Live mode pending KYC OK)
- [ ] WhatsApp Business: número/cuenta dedicada operativa
- [ ] Sentry/Resend/Upstash/Google Cloud: proyectos nuevos creados
- [ ] `iaeva-app/.env.local` poblado, isolation check pasa
- [ ] `iaeva-app/.env.local` NO está committed (`git check-ignore` lo confirma)
- [ ] `grep -ri "domicita" iaeva-app/.env.local` vacío
- [ ] Vercel deployments verdes en ambos projects
- [ ] Spec y plan committed y pushed al repo `iaeva-app`

---

## Self-Review

**Spec coverage:** ¿el plan implementa todo lo de Fase 0 del spec?
- Repos GitHub ✓ Tasks 2, 7, 10, 11
- Cuentas externas ✓ Task 1
- DNS ✓ Task 1 + 12
- `.env.example` ✓ Tasks 3, 8
- `.env.local` poblado ✓ Task 6
- Primer commit y push ✓ Tasks 10, 11
- Verificación final ✓ Task 13
- Runbook de aislamiento ✓ Task 5

**Placeholder scan:** sin TBDs, sin "implementar más tarde", todos los Steps tienen comandos o contenido literal.

**Tipo consistencia:** nombres de variables y URLs coherentes a lo largo del plan (`<REPO_URL_APP>`, `<REPO_URL_LANDING>`, `iaeva-app`, `iaeva-landing`).

---

**Fin del plan de Fase 0.**
