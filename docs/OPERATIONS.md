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

Estas credenciales **nunca** se commitearán al repo.

## En caso de incidente "creo que toqué Domicita"

1. Parar todo. No más commits, no más pushes.
2. Verificar git log: `git log --oneline -20` ¿algún commit con archivos sensibles?
3. Verificar webhooks externos: ¿alguno apunta accidentalmente a un dominio o cuenta Domicita?
4. Avisar al operador humano antes de cualquier remediación.
