# Owner Notifications Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Send proactive WhatsApp notifications to the shop owner's personal number for critical events (new booking, cancellation, sentiment escalation) plus a morning/evening digest timed to the shop's opening and closing hours.

**Architecture:** A central `lib/whatsapp/owner-notifier.ts` helper handles all owner notification logic. It reads `shop.ownerNotificationPhone` and sends via the shop's WABA using `sendTemplateByPurpose`. Five new UTILITY templates are seeded automatically when WhatsApp is activated. A dedicated cron (`/api/cron/owner-digest`) runs every 15 minutes to check which shops need a morning or evening digest based on their `ShopAvailability` hours. An `OwnerNotificationLog` table prevents duplicate sends.

**Tech Stack:** Next.js 14 App Router, Prisma, Meta Cloud API, date-fns, existing `sendTemplateByPurpose` + `seedDefaultTemplates` infrastructure, GitHub Actions cron.

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `prisma/schema.prisma` | Modify | Add `ownerNotificationPhone` to Shop, add `OwnerNotificationLog` model |
| `lib/whatsapp/owner-notifier.ts` | Create | Central helper: `notifyOwnerNewBooking`, `notifyOwnerCancellation`, `notifyOwnerSentimentAlert`, `sendOwnerMorningDigest`, `notifyOwnerSentimentEscalation` |
| `lib/whatsapp/template-seeder.ts` | Modify | Add 5 owner notification templates to `buildDefaultTemplates()` |
| `app/api/appointments/route.ts` | Modify | Call `notifyOwnerNewBooking` after appointment create |
| `app/api/appointments/[id]/route.ts` | Modify | Call `notifyOwnerCancellation` when status → CANCELLED |
| `lib/whatsapp/bot-control.ts` | Modify | Call `notifyOwnerSentimentEscalation` in `markHumanTakeover` when reason = 'sentiment' |
| `app/api/cron/owner-digest/route.ts` | Create | Cron endpoint: morning + evening digest logic |
| `.github/workflows/cron-owner-digest.yml` | Create | GitHub Actions: every 15 min |
| `app/dashboard/settings/page.tsx` | Modify | Add `ownerNotificationPhone` field in Negocio tab |
| `app/api/settings/shop/route.ts` | Modify | Accept + save `ownerNotificationPhone` |

---

## Task 1: Schema — ownerNotificationPhone + OwnerNotificationLog

**Files:**
- Modify: `prisma/schema.prisma`

- [ ] **Step 1: Add `ownerNotificationPhone` to Shop model**

Find the Shop model field block (after `metaBusinessAccountId`) and add:

```prisma
ownerNotificationPhone String?   // Personal number for owner notifications (E.164 format)
```

- [ ] **Step 2: Add `OwnerNotificationLog` model at the end of schema.prisma**

```prisma
// ==========================================
// OWNER NOTIFICATION LOG — dedup + audit
// ==========================================
model OwnerNotificationLog {
  id        String   @id @default(cuid())
  shopId    String
  type      String   // new_booking | cancellation | sentiment_escalation | morning_digest | evening_digest
  refId     String?  // appointmentId or phoneNumber for dedup
  sentAt    DateTime @default(now())

  shop      Shop     @relation(fields: [shopId], references: [id], onDelete: Cascade)

  @@index([shopId, type, sentAt])
}
```

- [ ] **Step 3: Add relation in Shop model**

In the Shop model relations block (near `botSchedule`):

```prisma
ownerNotificationLogs  OwnerNotificationLog[]
```

- [ ] **Step 4: Push schema and regenerate client**

```bash
npx prisma db push
npx prisma generate
```

Expected output: `🚀 Your database is now in sync with your Prisma schema`

- [ ] **Step 5: Commit**

```bash
git add prisma/schema.prisma
git commit -m "feat(schema): ownerNotificationPhone + OwnerNotificationLog"
```

---

## Task 2: Owner notification templates in seeder

**Files:**
- Modify: `lib/whatsapp/template-seeder.ts`

- [ ] **Step 1: Add 5 owner templates to the array returned by `buildDefaultTemplates()`**

At the end of the `return [...]` array in `buildDefaultTemplates()`, before the closing `]`, add:

```typescript
    {
      name: `aviso_nueva_cita_${slug}`,
      category: 'UTILITY',
      purpose: 'owner_new_booking',
      bodyText: `Nueva reserva en ${safeName}. Cliente: {{1}}. Servicio: {{2}}. Fecha: {{3}} a las {{4}}. Profesional: {{5}}.`,
      variables: { '1': 'Cliente', '2': 'Servicio', '3': 'Fecha', '4': 'Hora', '5': 'Profesional' },
    },
    {
      name: `aviso_cancelacion_${slug}`,
      category: 'UTILITY',
      purpose: 'owner_cancellation',
      bodyText: `Cancelacion en ${safeName}. Cliente: {{1}} cancelo su cita de {{2}} para el servicio de {{3}}.`,
      variables: { '1': 'Cliente', '2': 'Fecha_hora', '3': 'Servicio' },
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
```

- [ ] **Step 2: Verify the seeder still type-checks**

```bash
NODE_OPTIONS="--max-old-space-size=8192" npx tsc --noEmit --skipLibCheck 2>&1 | head -10
```

Expected: no output (no errors)

- [ ] **Step 3: Commit**

```bash
git add lib/whatsapp/template-seeder.ts
git commit -m "feat(templates): add 5 owner notification templates"
```

---

## Task 3: Central owner-notifier helper

**Files:**
- Create: `lib/whatsapp/owner-notifier.ts`

- [ ] **Step 1: Create the file**

```typescript
/**
 * Owner Notifier
 *
 * Sends proactive WhatsApp notifications to the shop owner's personal number.
 * All sends are fire-and-forget — never block the main request path.
 * Deduplication is handled via OwnerNotificationLog.
 */

import { db } from '@/lib/database';
import { sendTemplateByPurpose } from '@/lib/whatsapp/sender';
import { format } from 'date-fns';
import { es } from 'date-fns/locale';

type NotificationType =
  | 'new_booking'
  | 'cancellation'
  | 'sentiment_escalation'
  | 'morning_digest'
  | 'evening_digest';

/**
 * Check if a notification of this type was already sent recently.
 * - Events (new_booking, cancellation, sentiment): dedup by refId within 1 hour
 * - Digests (morning, evening): dedup by date (once per day)
 */
async function alreadySent(shopId: string, type: NotificationType, refId: string): Promise<boolean> {
  const since = type.includes('digest')
    ? new Date(new Date().setHours(0, 0, 0, 0)) // today midnight
    : new Date(Date.now() - 60 * 60 * 1000);    // last hour

  const existing = await db.ownerNotificationLog.findFirst({
    where: { shopId, type, refId, sentAt: { gte: since } },
  });
  return !!existing;
}

async function logSent(shopId: string, type: NotificationType, refId: string): Promise<void> {
  await db.ownerNotificationLog.create({ data: { shopId, type, refId } });
}

/**
 * Resolve the owner's notification phone for a shop.
 * Returns null if not configured — callers must handle this gracefully.
 */
async function getOwnerPhone(shopId: string): Promise<{ phone: string; shopId: string } | null> {
  const shop = await db.shop.findUnique({
    where: { id: shopId },
    select: { ownerNotificationPhone: true },
  });
  if (!shop?.ownerNotificationPhone) return null;
  return { phone: shop.ownerNotificationPhone, shopId };
}

// ---------------------------------------------------------------------------
// Public API
// ---------------------------------------------------------------------------

export async function notifyOwnerNewBooking(params: {
  shopId: string;
  appointmentId: string;
  clientName: string;
  serviceName: string;
  startTime: Date;
  stylistName: string | null;
}): Promise<void> {
  const { shopId, appointmentId, clientName, serviceName, startTime, stylistName } = params;

  const owner = await getOwnerPhone(shopId);
  if (!owner) return;

  if (await alreadySent(shopId, 'new_booking', appointmentId)) return;

  const fecha = format(startTime, "EEE d 'de' MMM", { locale: es });
  const hora = format(startTime, 'HH:mm', { locale: es });

  await sendTemplateByPurpose({
    shopId,
    to: owner.phone,
    purpose: 'owner_new_booking',
    variables: {
      '1': clientName,
      '2': serviceName,
      '3': fecha,
      '4': hora,
      '5': stylistName ?? 'Sin asignar',
    },
    fallbackText: `📅 Nueva reserva: ${clientName} · ${serviceName} · ${fecha} ${hora} · ${stylistName ?? 'Sin asignar'}`,
  });

  await logSent(shopId, 'new_booking', appointmentId);
}

export async function notifyOwnerCancellation(params: {
  shopId: string;
  appointmentId: string;
  clientName: string;
  serviceName: string;
  startTime: Date;
}): Promise<void> {
  const { shopId, appointmentId, clientName, serviceName, startTime } = params;

  const owner = await getOwnerPhone(shopId);
  if (!owner) return;

  if (await alreadySent(shopId, 'cancellation', appointmentId)) return;

  const fechaHora = format(startTime, "EEE d MMM 'a las' HH:mm", { locale: es });

  await sendTemplateByPurpose({
    shopId,
    to: owner.phone,
    purpose: 'owner_cancellation',
    variables: {
      '1': clientName,
      '2': fechaHora,
      '3': serviceName,
    },
    fallbackText: `❌ Cancelación: ${clientName} canceló · ${serviceName} · ${fechaHora}`,
  });

  await logSent(shopId, 'cancellation', appointmentId);
}

export async function notifyOwnerSentimentEscalation(params: {
  shopId: string;
  clientPhone: string;
}): Promise<void> {
  const { shopId, clientPhone } = params;

  const owner = await getOwnerPhone(shopId);
  if (!owner) return;

  if (await alreadySent(shopId, 'sentiment_escalation', clientPhone)) return;

  const masked = clientPhone.slice(0, 4) + '****' + clientPhone.slice(-3);

  await sendTemplateByPurpose({
    shopId,
    to: owner.phone,
    purpose: 'owner_sentiment_alert',
    variables: { '1': masked },
    fallbackText: `⚠️ Cliente molesto en WhatsApp (${masked}). Revisa la conversación en tu app.`,
  });

  await logSent(shopId, 'sentiment_escalation', clientPhone);
}

export async function sendOwnerMorningDigest(params: {
  shopId: string;
  totalAppointments: number;
  firstAppointment: string; // e.g. "10:00am — Juan Pérez, Fade"
  lastAppointment: string;  // e.g. "6:00pm — Carlos Marte, Barba"
}): Promise<void> {
  const { shopId, totalAppointments, firstAppointment, lastAppointment } = params;

  const owner = await getOwnerPhone(shopId);
  if (!owner) return;

  const today = format(new Date(), 'yyyy-MM-dd');
  if (await alreadySent(shopId, 'morning_digest', today)) return;

  await sendTemplateByPurpose({
    shopId,
    to: owner.phone,
    purpose: 'owner_morning_digest',
    variables: {
      '1': String(totalAppointments),
      '2': firstAppointment,
      '3': lastAppointment,
    },
    fallbackText: `☀️ Hoy tienes ${totalAppointments} citas. Primera: ${firstAppointment}. Última: ${lastAppointment}.`,
  });

  await logSent(shopId, 'morning_digest', today);
}

export async function sendOwnerEveningDigest(params: {
  shopId: string;
  completed: number;
  total: number;
  noShows: number;
  newClients: number;
  revenue: number;
  currency?: string;
}): Promise<void> {
  const { shopId, completed, total, noShows, newClients, revenue, currency = 'RD$' } = params;

  const owner = await getOwnerPhone(shopId);
  if (!owner) return;

  const today = format(new Date(), 'yyyy-MM-dd');
  if (await alreadySent(shopId, 'evening_digest', today)) return;

  await sendTemplateByPurpose({
    shopId,
    to: owner.phone,
    purpose: 'owner_evening_digest',
    variables: {
      '1': String(completed),
      '2': String(total),
      '3': String(noShows),
      '4': String(newClients),
      '5': `${currency}${revenue.toLocaleString('es-DO')}`,
    },
    fallbackText: `🌙 Cierre: ${completed}/${total} citas · ${noShows} no-shows · ${newClients} nuevos · ${currency}${revenue.toLocaleString('es-DO')}`,
  });

  await logSent(shopId, 'evening_digest', today);
}
```

- [ ] **Step 2: Type-check**

```bash
NODE_OPTIONS="--max-old-space-size=8192" npx tsc --noEmit --skipLibCheck 2>&1 | head -10
```

Expected: no output

- [ ] **Step 3: Commit**

```bash
git add lib/whatsapp/owner-notifier.ts
git commit -m "feat(whatsapp): owner-notifier helper with dedup + all 5 notification types"
```

---

## Task 4: Hook new booking event

**Files:**
- Modify: `app/api/appointments/route.ts`

- [ ] **Step 1: Add import at the top of the file**

After the existing imports, add:

```typescript
import { notifyOwnerNewBooking } from '@/lib/whatsapp/owner-notifier';
```

- [ ] **Step 2: Add fire-and-forget call after appointment creation**

Find the block after `pushAppointmentToCalendar(appointment.id).catch(...)` and add:

```typescript
// 🔔 Notify owner of new booking (fire-and-forget)
notifyOwnerNewBooking({
  shopId,
  appointmentId: appointment.id,
  clientName: appointment.clientName,
  serviceName: appointment.service.name,
  startTime: appointment.startTime,
  stylistName: appointment.stylist?.name ?? null,
}).catch(err => console.error('[OwnerNotify] new_booking failed:', err));
```

- [ ] **Step 3: Type-check**

```bash
NODE_OPTIONS="--max-old-space-size=8192" npx tsc --noEmit --skipLibCheck 2>&1 | head -10
```

Expected: no output

- [ ] **Step 4: Commit**

```bash
git add app/api/appointments/route.ts
git commit -m "feat(appointments): notify owner on new booking"
```

---

## Task 5: Hook cancellation event

**Files:**
- Modify: `app/api/appointments/[id]/route.ts`

- [ ] **Step 1: Add import at the top of the file**

After existing imports, add:

```typescript
import { notifyOwnerCancellation } from '@/lib/whatsapp/owner-notifier';
```

- [ ] **Step 2: Find the cancellation block and add notification**

Find this existing block:

```typescript
if (data.status === 'CANCELLED' || data.status === 'NO_SHOW') {
    deleteAppointmentFromCalendar(id).catch((err) =>
        console.error("Google Calendar delete error:", err)
    );
```

Add the owner notification inside that block, after the calendar call, for CANCELLED only:

```typescript
if (data.status === 'CANCELLED' || data.status === 'NO_SHOW') {
    deleteAppointmentFromCalendar(id).catch((err) =>
        console.error("Google Calendar delete error:", err)
    );

    // 🔔 Notify owner of cancellation (fire-and-forget, CANCELLED only)
    if (data.status === 'CANCELLED' && appointment.shopId) {
        notifyOwnerCancellation({
            shopId: appointment.shopId,
            appointmentId: id,
            clientName: appointment.clientName,
            serviceName: appointment.service?.name ?? 'Servicio',
            startTime: appointment.startTime,
        }).catch(err => console.error('[OwnerNotify] cancellation failed:', err));
    }
```

- [ ] **Step 3: Verify `appointment` query includes `shopId`, `service`, `startTime`**

The existing `findUnique` before the update must select these fields. Check line ~35 in the file. If `service` is not included, add it to the `include` block:

```typescript
include: {
    service: { select: { name: true, price: true } },
    // ... existing includes
}
```

- [ ] **Step 4: Type-check**

```bash
NODE_OPTIONS="--max-old-space-size=8192" npx tsc --noEmit --skipLibCheck 2>&1 | head -10
```

Expected: no output

- [ ] **Step 5: Commit**

```bash
git add app/api/appointments/[id]/route.ts
git commit -m "feat(appointments): notify owner on cancellation"
```

---

## Task 6: Hook sentiment escalation

**Files:**
- Modify: `lib/whatsapp/bot-control.ts`

- [ ] **Step 1: Add import at the top of bot-control.ts**

After the existing `import { db }` line:

```typescript
import { notifyOwnerSentimentEscalation } from '@/lib/whatsapp/owner-notifier';
```

- [ ] **Step 2: Add notification in `markHumanTakeover` when reason is 'sentiment'**

Find `markHumanTakeover` function. After the `db.whatsAppConversation.upsert(...)` call, add:

```typescript
  // Notify owner when escalated by sentiment detection
  if (reason === 'sentiment') {
    notifyOwnerSentimentEscalation({ shopId, clientPhone: phoneNumber })
      .catch(err => console.error('[OwnerNotify] sentiment_escalation failed:', err));
  }
```

- [ ] **Step 3: Type-check**

```bash
NODE_OPTIONS="--max-old-space-size=8192" npx tsc --noEmit --skipLibCheck 2>&1 | head -10
```

Expected: no output

- [ ] **Step 4: Commit**

```bash
git add lib/whatsapp/bot-control.ts
git commit -m "feat(bot): notify owner on sentiment escalation"
```

---

## Task 7: Daily digest cron endpoint

**Files:**
- Create: `app/api/cron/owner-digest/route.ts`

- [ ] **Step 1: Create the file**

```typescript
/**
 * Cron: Owner morning + evening digest
 *
 * Runs every 15 minutes. For each whatsapp-enabled shop, checks whether
 * now falls in the (open - 15min) or (close + 15min) window and sends
 * the appropriate digest. OwnerNotificationLog prevents duplicate sends.
 */

import { NextRequest, NextResponse } from 'next/server';
import { timingSafeEqual } from 'crypto';
import { db } from '@/lib/database';
import { sendOwnerMorningDigest, sendOwnerEveningDigest } from '@/lib/whatsapp/owner-notifier';
import { format, startOfDay, endOfDay } from 'date-fns';
import { toZonedTime } from 'date-fns-tz';
import { es } from 'date-fns/locale';

function verifyCronSecret(request: NextRequest): boolean {
  const secret = process.env.CRON_SECRET;
  if (!secret) return false;
  const auth = request.headers.get('authorization');
  if (!auth) return false;
  const expected = `Bearer ${secret}`;
  if (auth.length !== expected.length) return false;
  return timingSafeEqual(Buffer.from(auth), Buffer.from(expected));
}

function toHHMM(timeStr: string): string {
  // ShopAvailability stores startTime/endTime as "HH:mm" strings
  return timeStr.slice(0, 5);
}

function nowHHMM(tz: string): { hhmm: string; dayOfWeek: number } {
  const zoned = toZonedTime(new Date(), tz);
  const hhmm = format(zoned, 'HH:mm');
  const dayOfWeek = zoned.getDay(); // 0=Sun
  return { hhmm, dayOfWeek };
}

function isInWindow(now: string, target: string, offsetMinutes: number, windowMinutes = 2): boolean {
  const [th, tm] = target.split(':').map(Number);
  const targetTotal = th * 60 + tm + offsetMinutes;
  const [nh, nm] = now.split(':').map(Number);
  const nowTotal = nh * 60 + nm;
  return nowTotal >= targetTotal && nowTotal < targetTotal + windowMinutes;
}

export async function GET(request: NextRequest) {
  if (!verifyCronSecret(request)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const shops = await db.shop.findMany({
    where: { whatsappEnabled: true, ownerNotificationPhone: { not: null } },
    select: {
      id: true,
      timezone: true,
      ownerNotificationPhone: true,
      hours: { select: { dayOfWeek: true, startTime: true, endTime: true } },
    },
  });

  let morningCount = 0;
  let eveningCount = 0;

  for (const shop of shops) {
    const tz = shop.timezone ?? 'America/Santo_Domingo';
    const { hhmm, dayOfWeek } = nowHHMM(tz);

    const todayHours = shop.hours.filter(h => h.dayOfWeek === dayOfWeek);
    if (todayHours.length === 0) continue; // shop closed today

    for (const slot of todayHours) {
      // Morning digest: 15 min before opening
      if (isInWindow(hhmm, toHHMM(slot.startTime), -15)) {
        try {
          const now = new Date();
          const dayStart = startOfDay(toZonedTime(now, tz));
          const dayEnd = endOfDay(toZonedTime(now, tz));

          const appointments = await db.appointment.findMany({
            where: {
              shopId: shop.id,
              status: { in: ['CONFIRMED', 'PENDING'] },
              startTime: { gte: dayStart, lte: dayEnd },
            },
            orderBy: { startTime: 'asc' },
            include: { service: { select: { name: true } }, stylist: { select: { name: true } } },
          });

          if (appointments.length === 0) continue;

          const first = appointments[0];
          const last = appointments[appointments.length - 1];

          const fmt = (a: typeof first) =>
            `${format(toZonedTime(a.startTime, tz), 'HH:mm')} — ${a.clientName}, ${a.service?.name ?? ''}`;

          await sendOwnerMorningDigest({
            shopId: shop.id,
            totalAppointments: appointments.length,
            firstAppointment: fmt(first),
            lastAppointment: fmt(last),
          });

          morningCount++;
        } catch (err: any) {
          console.error(`[OwnerDigest] morning failed for shop ${shop.id}:`, err.message);
        }
      }

      // Evening digest: 15 min after closing
      if (isInWindow(hhmm, toHHMM(slot.endTime), 15)) {
        try {
          const now = new Date();
          const dayStart = startOfDay(toZonedTime(now, tz));
          const dayEnd = endOfDay(toZonedTime(now, tz));

          const allToday = await db.appointment.findMany({
            where: { shopId: shop.id, startTime: { gte: dayStart, lte: dayEnd } },
            select: { status: true, clientId: true, createdAt: true, service: { select: { price: true } } },
          });

          const completed = allToday.filter(a => a.status === 'COMPLETED');
          const noShows = allToday.filter(a => a.status === 'NO_SHOW').length;
          const revenue = completed.reduce((sum, a) => sum + (a.service?.price ?? 0), 0);

          // New clients = those whose first appointment ever in this shop was today
          const clientIds = [...new Set(allToday.map(a => a.clientId).filter(Boolean))] as string[];
          let newClients = 0;
          for (const clientId of clientIds) {
            const firstEver = await db.appointment.findFirst({
              where: { clientId, shopId: shop.id },
              orderBy: { startTime: 'asc' },
              select: { startTime: true },
            });
            if (firstEver && firstEver.startTime >= dayStart) newClients++;
          }

          await sendOwnerEveningDigest({
            shopId: shop.id,
            completed: completed.length,
            total: allToday.length,
            noShows,
            newClients,
            revenue,
          });

          eveningCount++;
        } catch (err: any) {
          console.error(`[OwnerDigest] evening failed for shop ${shop.id}:`, err.message);
        }
      }
    }
  }

  return NextResponse.json({ morning: morningCount, evening: eveningCount });
}
```

- [ ] **Step 2: Check if `date-fns-tz` is available**

```bash
grep "date-fns-tz" /Users/kelvin/Desktop/DomiCita/package.json
```

If not present, install it:

```bash
pnpm add date-fns-tz
```

- [ ] **Step 3: Type-check**

```bash
NODE_OPTIONS="--max-old-space-size=8192" npx tsc --noEmit --skipLibCheck 2>&1 | head -10
```

Expected: no output

- [ ] **Step 4: Commit**

```bash
git add app/api/cron/owner-digest/route.ts
git commit -m "feat(cron): owner morning + evening digest endpoint"
```

---

## Task 8: GitHub Actions cron workflow

**Files:**
- Create: `.github/workflows/cron-owner-digest.yml`

- [ ] **Step 1: Create the workflow file**

```yaml
name: Cron — Owner Digest

on:
  schedule:
    - cron: '*/15 * * * *'
  workflow_dispatch:

jobs:
  trigger:
    name: Send owner morning/evening digest
    runs-on: ubuntu-latest
    timeout-minutes: 5
    env:
      APP_URL: ${{ secrets.APP_URL }}
      CRON_SECRET: ${{ secrets.CRON_SECRET }}
    steps:
      - name: Call owner digest endpoint
        run: |
          curl -sf -X GET "$APP_URL/api/cron/owner-digest" \
            -H "Authorization: Bearer $CRON_SECRET" \
            -w "\nHTTP %{http_code}" || echo "Request failed"
```

- [ ] **Step 2: Commit**

```bash
git add .github/workflows/cron-owner-digest.yml
git commit -m "ci: add owner-digest cron (every 15 min)"
```

---

## Task 9: Settings UI — owner notification phone field

**Files:**
- Modify: `app/dashboard/settings/page.tsx`
- Modify: `app/api/settings/shop/route.ts` (or equivalent shop update endpoint)

- [ ] **Step 1: Find the shop update API endpoint**

```bash
grep -rn "ownerNotificationPhone\|shop.*PATCH\|updateShop" /Users/kelvin/Desktop/DomiCita/app/api/settings/ 2>/dev/null | head -10
```

If the endpoint doesn't accept `ownerNotificationPhone` yet, find where shop fields are saved (likely `app/api/settings/shop/route.ts` or `app/api/shop/route.ts`) and add it to the `data` object passed to `db.shop.update`:

```typescript
if (body.ownerNotificationPhone !== undefined) {
    updateData.ownerNotificationPhone = body.ownerNotificationPhone?.trim() || null;
}
```

- [ ] **Step 2: Add state in settings page**

In `app/dashboard/settings/page.tsx`, find the shop state declarations and add:

```typescript
const [ownerNotificationPhone, setOwnerNotificationPhone] = useState('');
```

In the `fetchShop` function where shop data is loaded, add:

```typescript
setOwnerNotificationPhone(shopData.ownerNotificationPhone || '');
```

In the `saveShop` / `handleSubmit` function, include it in the payload:

```typescript
ownerNotificationPhone: ownerNotificationPhone.trim() || null,
```

- [ ] **Step 3: Add the UI field in the Negocio tab**

Find the Negocio tab section in the settings page. After the shop phone number field, add:

```tsx
{/* Owner notification phone */}
<div className="space-y-1.5">
    <label className="text-xs font-bold text-gray-500 uppercase tracking-widest">
        WhatsApp para notificaciones del negocio
    </label>
    <p className="text-xs text-gray-400">
        Número personal donde recibirás avisos de nuevas citas, cancelaciones y alertas. Puede ser distinto al número del negocio.
    </p>
    <input
        type="tel"
        value={ownerNotificationPhone}
        onChange={e => setOwnerNotificationPhone(e.target.value)}
        placeholder="+18091234567"
        className="w-full text-sm bg-white border border-gray-200 rounded-xl px-3 py-2.5 outline-none focus:ring-2 focus:ring-primary/20"
    />
</div>
```

- [ ] **Step 4: Type-check**

```bash
NODE_OPTIONS="--max-old-space-size=8192" npx tsc --noEmit --skipLibCheck 2>&1 | head -10
```

Expected: no output

- [ ] **Step 5: Commit**

```bash
git add app/dashboard/settings/page.tsx app/api/settings/shop/route.ts
git commit -m "feat(settings): ownerNotificationPhone field in Negocio tab"
```

---

## Task 10: Final type-check + push

- [ ] **Step 1: Full type-check**

```bash
NODE_OPTIONS="--max-old-space-size=8192" npx tsc --noEmit --skipLibCheck 2>&1 | head -20
```

Expected: no output

- [ ] **Step 2: Push all commits**

```bash
git push origin main
```

- [ ] **Step 3: Verify in production**

Once deployed, test manually:
1. Set `ownerNotificationPhone` in Ajustes → Negocio for a test shop
2. Create a test appointment → owner should receive WhatsApp notification
3. Cancel that appointment → owner should receive cancellation notification
4. Check Meta Business Manager that all 5 new templates were submitted for approval

---

## Self-Review Notes

- **Spec coverage:** All 5 notification types covered (new_booking ✓, cancellation ✓, sentiment ✓, morning_digest ✓, evening_digest ✓). Templates seeded ✓. UI field ✓. Dedup ✓.
- **No placeholders:** All code blocks are complete and runnable.
- **Type consistency:** `notifyOwnerNewBooking`, `notifyOwnerCancellation`, `notifyOwnerSentimentEscalation`, `sendOwnerMorningDigest`, `sendOwnerEveningDigest` — names used consistently across tasks 3–6 and 7.
- **date-fns-tz:** Checked in Task 7 step 2 — install guard included.
- **`toZonedTime` import:** Used from `date-fns-tz` which exports it directly in v3+.
- **Cancellation hook:** Only fires for `CANCELLED`, not `NO_SHOW` — matches design decision.
- **Digest window:** 2-minute window per 15-min cron tick — safe overlap with no risk of double-send due to `OwnerNotificationLog` dedup.
