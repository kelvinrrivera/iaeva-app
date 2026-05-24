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
