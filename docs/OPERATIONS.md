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

## Stripe CLI — trabajar en local sin contaminar Domicita

El Stripe CLI mantiene "proyectos" (perfiles) independientes. En este equipo coexisten:

- **`default`** → cuenta Stripe de Domicita producción. **NO TOCAR durante desarrollo IAEVA.**
- **`iaeva`** → cuenta Stripe de IAEVA. Se usa para todo el trabajo local de este repo.

### Setup inicial (una sola vez por equipo)

```bash
# Login en la cuenta Stripe de IAEVA (abre navegador — seleccionar la cuenta IAEVA, NO Domicita)
stripe login --project-name iaeva

# Verificar que el perfil quedó creado y apunta a la cuenta IAEVA correcta
stripe config --list --project-name iaeva
# Debe mostrar display_name = 'IAEVA' (o el nombre que le pusiste a la cuenta nueva)
```

### Uso diario — SIEMPRE con `--project-name iaeva`

```bash
# Reenviar webhooks de Stripe IAEVA a tu localhost
stripe listen --project-name iaeva --forward-to localhost:3000/api/stripe/webhook

# Disparar eventos de prueba (e.g., checkout completado)
stripe trigger --project-name iaeva checkout.session.completed
stripe trigger --project-name iaeva customer.subscription.updated
stripe trigger --project-name iaeva invoice.payment_succeeded
```

### Pre-flight checklist antes de cualquier `stripe listen` o `stripe trigger`

```bash
# 1. Verifica qué proyecto estás usando — DEBE ser 'iaeva'
stripe config --list --project-name iaeva | grep display_name
# Esperado: display_name = 'IAEVA'

# Si por error ves 'DomiCita', PARAR y re-loguear con --project-name iaeva
```

### Importante

- `stripe listen` muestra al arrancar un `webhook signing secret` (`whsec_...`). Cópialo a `STRIPE_WEBHOOK_SECRET` en `.env.local`. Cada vez que reinicias `stripe listen` el secret cambia — si tus webhooks empiezan a rechazarse, recopia el nuevo secret.
- La URL del forward es `localhost:3000/api/stripe/webhook` (no `localhost:4242/webhook` — esa es la del ejemplo de la docs de Stripe, no la nuestra). El puerto es 3000 (Next.js dev server) y el path está en `app/api/stripe/webhook/route.ts`.
- NUNCA uses el CLI sin `--project-name iaeva` mientras trabajas en este repo — el default apunta a Domicita.

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

Estas credenciales **nunca** se commitearán al repo.

## En caso de incidente "creo que toqué Domicita"

1. Parar todo. No más commits, no más pushes.
2. Verificar git log: `git log --oneline -20` ¿algún commit con archivos sensibles?
3. Verificar webhooks externos: ¿alguno apunta accidentalmente a un dominio o cuenta Domicita?
4. Avisar al operador humano antes de cualquier remediación.
