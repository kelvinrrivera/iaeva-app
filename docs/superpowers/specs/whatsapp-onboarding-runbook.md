# WhatsApp Onboarding Runbook

## Pre-deploy checklist

- [ ] Confirm `WHATSAPP_SYSTEM_USER_TOKEN` is set in Vercel production env (Tech Provider System User token, never expires)
- [ ] Confirm `META_APP_ID` and `FACEBOOK_APP_SECRET` are set
- [ ] Confirm `NEXT_PUBLIC_FB_CONFIG_ID` (Embedded Signup config) is set
- [ ] Confirm `NEXT_PUBLIC_FB_SOLUTION_ID` is set (or omitted intentionally — Solution ID is recommended for Tech Provider)
- [ ] In Meta Business Manager → App → Webhooks → WABA: confirm BOTH `messages` AND `smb_message_echoes` are subscribed at the App level
- [ ] In Vercel: secrets `APP_URL` and `CRON_SECRET` set (used by GitHub Actions cron)

## Deploy steps

1. Apply schema (already done in feature branch via `prisma db push`):
   ```bash
   pnpm db:migrate
   ```
2. Deploy code to Vercel (merge PR to main).
3. Run migration script via admin endpoint to backfill existing shops:
   ```bash
   curl -X POST https://domicita.com/api/admin/migrate-whatsapp \
     -H "Cookie: <SUPER_ADMIN_session_cookie>"
   ```
   Or run locally:
   ```bash
   DIRECT_URL=$(grep '^DIRECT_URL=' .env | cut -d'"' -f2) \
     DATABASE_URL=$(grep '^DIRECT_URL=' .env | cut -d'"' -f2) \
     pnpm tsx scripts/migrate-whatsapp-connections.ts
   ```
4. Inspect output: confirm shops classified as `healthy` / `withWarnings` / `flaggedForReconnect`.

## Post-deploy verification

- [ ] Visit dashboard with a `needsReconnect=true` shop → red banner appears at top.
- [ ] **New shop, Coexistence flow:**
  - Complete onboarding → choose "Mantener WhatsApp Business en mi teléfono"
  - Inspect Network tab in DevTools: confirm `sessionInfoVersion: 3` in FB.login extras
  - Confirm shop in DB has `coexistenceMode: true`, `metaSubscribedFields` includes `smb_message_echoes`
  - Wait 4-6h for transition `PENDING` → `CONNECTED`
  - Send a test message from another phone → bot responds
  - Reply manually from your WhatsApp Business app → conversation marks `controlMode: HUMAN`
- [ ] **New shop, Cloud API flow:**
  - Complete onboarding → choose "Solo con DomiCita"
  - Backend calls `/register` and gets 200 OK
  - Shop in DB has `metaPlatformType: 'CLOUD_API'`, `coexistenceMode: false`
  - Send test message → bot responds within 1 minute
- [ ] Cron `whatsapp-health` runs at next hour → check Vercel logs for `processed`, `transitioned`, `notified` counts.

## Manual repair for stuck shop

```sql
-- Inspect current state
SELECT id, name, "metaPlatformType", "coexistenceMode", "metaSubscribedFields",
       "whatsappReadyAt", "needsReconnect", "whatsappLastHealthCheckAt"
FROM "Shop" WHERE id = '<shopId>';

-- Force re-evaluation by health-check cron (clears last-check timestamp)
UPDATE "Shop" SET "whatsappLastHealthCheckAt" = NULL WHERE id = '<shopId>';

-- Force flag for reconnect manually (barber will see banner)
UPDATE "Shop" SET "needsReconnect" = true, "whatsappEnabled" = false
WHERE id = '<shopId>';
```

## Reading Meta state directly via Graph API

```bash
TOKEN=$WHATSAPP_SYSTEM_USER_TOKEN
PHONE_ID=<from Shop.metaPhoneNumberId>
WABA_ID=<from Shop.metaBusinessAccountId>

# Phone state
curl -sS "https://graph.facebook.com/v22.0/${PHONE_ID}?fields=id,display_phone_number,verified_name,status,platform_type,health_status" \
  -H "Authorization: Bearer $TOKEN" | jq

# WABA state
curl -sS "https://graph.facebook.com/v22.0/${WABA_ID}?fields=id,name,business_verification_status,primary_funding_id,health_status" \
  -H "Authorization: Bearer $TOKEN" | jq

# Subscribed apps + fields
curl -sS "https://graph.facebook.com/v22.0/${WABA_ID}/subscribed_apps" \
  -H "Authorization: Bearer $TOKEN" | jq
```

## Rollback

- Schema fields are additive (no destructive changes). Reverting code while keeping schema is safe.
- Re-deploy previous git tag from main.
- Migration script is idempotent — safe to re-run after rollback or partial deploy.
