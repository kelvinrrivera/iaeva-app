# Arquitectura de Domicitas

**Versión:** 1.0
**Última actualización:** 2026-02-15
**Autores:** Equipo Domicitas

---

## 1. Visión General

Domicitas es un SaaS de gestión de citas para **barberías, salones de belleza y centros de uñas** en República Dominicana, con integración nativa de WhatsApp para reservas.

**Stack Tecnológico:**
- **Frontend:** Next.js 16 (App Router) + React 19 + TypeScript
- **Backend:** Next.js API Routes + Server Actions
- **Database:** PostgreSQL + Prisma ORM
- **Auth:** Supabase Auth
- **AI:** Google Gemini AI (Vercel AI SDK)
- **Messaging:** WhatsApp Business API (Meta)
- **Payments:** Stripe
- **Deployment:** Vercel

---

## 2. Arquitectura de Alto Nivel

```
┌─────────────────────────────────────────────────────────────────┐
│                        CLIENTE (Browser)                         │
└─────────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────────┐
│                    NEXT.JS APP (Vercel)                         │
│  ┌─────────────┐  ┌──────────────┐  ┌─────────────────────┐   │
│  │   Pages     │  │  API Routes  │  │  Server Actions     │   │
│  │  (React)    │  │  (Protected) │  │  (Protected)        │   │
│  └─────────────┘  └──────────────┘  └─────────────────────┘   │
└─────────────────────────────────────────────────────────────────┘
                                  │
                ┌─────────────────┼─────────────────┐
                │                 │                 │
                ▼                 ▼                 ▼
    ┌──────────────┐  ┌──────────────┐  ┌──────────────┐
    │  Supabase    │  │  PostgreSQL  │  │   External   │
    │  (Auth)      │  │  (Prisma)    │  │   Services   │
    └──────────────┘  └──────────────┘  └──────────────┘
                                              │
                         ┌────────────────────┼────────────────────┐
                         │                    │                    │
                         ▼                    ▼                    ▼
                  ┌───────────┐       ┌──────────────┐    ┌──────────┐
                  │  WhatsApp │       │    Stripe    │    │  Gemini  │
                  │    API    │       │     API      │    │    AI    │
                  └───────────┘       └──────────────┘    └──────────┘
```

---

## 3. Multi-Tenancy

### Modelo de Datos

Domicitas usa un modelo de **multi-tenancy con tenant isolation a nivel de aplicación**:

```
┌─────────────────────────────────────────────────────────────┐
│                    SHOP (Tenant)                            │
│  ┌───────────────┐  ┌───────────────┐  ┌───────────────┐  │
│  │   Members    │  │   Services    │  │  Appointments │  │
│  │  (Users)     │  │               │  │               │  │
│  └───────────────┘  └───────────────┘  └───────────────┘  │
│  ┌───────────────┐  ┌───────────────┐  ┌───────────────┐  │
│  │    Clients   │  │    Stylists   │  │  Availability │  │
│  └───────────────┘  └───────────────┘  └───────────────┘  │
└─────────────────────────────────────────────────────────────┘
```

**Key Concept:** Todos los datos están relacionados a un `Shop`. Las queries SIEMPRE filtran por `shopId`.

### Aislamiento de Datos

```typescript
// ❌ MAL - Sin filtrar por shop
const appointments = await db.appointment.findMany();

// ✅ BIEN - Filtrado por shop
const appointments = await db.appointment.findMany({
  where: { shopId: user.membership.shopId }
});
```

---

## 4. Sistema de Autenticación y Autorización

### Autenticación (Supabase)

```
Login Flow:
1. User ingresa email/password → Supabase Auth
2. Supabase retorna JWT access token
3. Token se guarda en cookie (httpOnly)
4. Token se incluye en requests subsiguientes
```

### Autorización (RBAC)

**Roles Definidos:**

```typescript
enum Role {
  SUPER_ADMIN,    // Dueño del SaaS
  ORG_ADMIN,      // Dueño de barbería
  TEAM_LEADER,    // Manager de sucursal
  PROFESSIONAL,   // Barbero/Estilista
  CUSTOMER        // Cliente final
}
```

**Jerarquía de Permisos:**

| Rol               | Ver Citas | Crear Citas | Editar Shop | Ver Analytics | Manage Team |
|-------------------|-----------|-------------|-------------|---------------|-------------|
| SUPER_ADMIN       | ✅ All    | ✅ All      | ✅ All      | ✅ All        | ✅ All      |
| ORG_ADMIN         | ✅ Own    | ✅ Own      | ✅ Own      | ✅ Own        | ✅ Own      |
| TEAM_LEADER       | ✅ Team   | ✅ Team     | ❌          | ✅ Team       | ✅ Team     |
| PROFESSIONAL      | ✅ Own    | ❌          | ❌          | ❌            | ❌          |
| CUSTOMER          | ✅ Own    | ❌          | ❌          | ❌            | ❌          |

### Middleware de Autorización

```typescript
// lib/auth-middleware.ts
export async function requireAuth(request: Request) {
  const token = await getToken({ req: request as any });
  if (!token) throw new UnauthorizedError();

  const membership = await db.membership.findFirst({
    where: { userId: token.sub }
  });

  if (!membership) throw new NoMembershipError();
  return { user: token, membership };
}

export async function requireShopAccess(request: Request, shopId: string) {
  const { membership } = await requireAuth(request);
  if (membership.shopId !== shopId) {
    throw new ForbiddenError("No access to this shop");
  }
  return membership;
}
```

---

## 5. Sistema Multi-Nicho

### Tipos de Negocio

```typescript
enum ShopType {
  BARBERSHOP,      // Solo barbería
  BEAUTY_SALON,    // Solo salón de belleza
  NAIL_SALON,      // Solo centro de uñas
  HYBRID           // Mixto (barbería + belleza + uñas)
}
```

### Terminología Dinámica

El sistema adapta la terminología según el tipo de negocio:

```typescript
// Barbería
{ professional: "Barbero", client: "Cliente", action: "Cortar" }

// Salón de Belleza
{ professional: "Estilista", client: "Clienta", action: "Estilizar" }

// Centro de Uñas
{ professional: "Manicurista", client: "Clienta", action: "Realizar" }

// Híbrido
{ professional: "Profesional", client: "Cliente", action: "Realizar" }
```

### Servicios por Nicho

```typescript
enum ServiceType {
  // Barbería
  HAIRCUT,
  BEARD,

  // Belleza
  COLOR,
  STYLING,
  FACIAL,

  // Uñas
  MANICURE,
  PEDICURE,
  NAIL_ART
}
```

---

## 6. Integración de WhatsApp

### Arquitectura de Messaging

```
┌──────────────┐       ┌──────────────┐       ┌──────────────┐
│   Cliente    │──────▶│   WhatsApp   │──────▶│  Webhook     │
│  (WhatsApp)  │       │   Business   │       │  Handler     │
└──────────────┘       └──────────────┘       └──────────────┘
                                                      │
                                                      ▼
                                             ┌──────────────┐
                                             │  Gemini AI   │
                                             │  (NLP)       │
                                             └──────────────┘
                                                      │
                                    ┌─────────────────┴─────────────────┐
                                    │                                   │
                                    ▼                                   ▼
                             ┌──────────────┐                   ┌──────────────┐
                             │  Create      │                   │  Send        │
                             │  Appointment │                   │  Reply       │
                             └──────────────┘                   └──────────────┘
```

### Flujo de Conversación

1. **Cliente envía mensaje** → WhatsApp Business API
2. **Webhook recibe payload** → Server handler
3. **Gemini AI procesa mensaje** → Extrae intención + datos
4. **Sistema responde:**
   - Si es agendar: Pide datos faltantes → Confirma → Crea cita
   - Si es consulta: Responde con info del shop
   - Si es cancelación: Confirma → Cancela cita

### Message Queue

```
┌──────────────┐     ┌──────────────┐     ┌──────────────┐
│   App        │────▶│   BullMQ     │────▶│   WhatsApp   │
│  (Sender)    │     │   Queue      │     │     API      │
└──────────────┘     └──────────────┘     └──────────────┘
                            │
                            │ (Retry con exponential backoff)
                            ▼
                     ┌──────────────┐
                     │  Redis Store │
                     └──────────────┘
```

**Por qué Queue?**
- WhatsApp API tiene rate limits
- Mensajes pueden fallar temporalmente
- Necesitamos retry automático
- No bloquear el request principal

---

## 7. Sistema de Pagos (Stripe)

### Subscription Model

```
┌─────────────────────────────────────────────────────────────┐
│                        STRIPE                               │
│  ┌─────────────┐  ┌──────────────┐  ┌──────────────────┐  │
│  │   Products  │  │   Prices     │  │  Subscriptions   │  │
│  │  (3 Plans)  │  │  (Monthly)   │  │  (Recurring)     │  │
│  └─────────────┘  └──────────────┘  └──────────────────┘  │
└─────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────┐
│                    WEBHOOK HANDLER                          │
│  - checkout.session.completed → Activate subscription       │
│  - customer.subscription.updated → Update plan              │
│  - customer.subscription.deleted → Cancel/downgrade         │
│  - invoice.payment_failed → Notify customer                 │
└─────────────────────────────────────────────────────────────┘
                                  │
                                  ▼
┌─────────────────────────────────────────────────────────────┐
│                    DATABASE (Prisma)                        │
│  Shop.stripeSubscriptionId                                  │
│  Shop.plan (FREE | PROFESSIONAL | ENTERPRISE)               │
│  Shop.subscriptionStatus                                    │
└─────────────────────────────────────────────────────────────┘
```

### Plan Enforcement

```typescript
// lib/plan-enforcement.ts
export function canAddProfessional(shop: Shop): boolean {
  const limits = PLAN_LIMITS[shop.plan];
  return shop.stylists.length < limits.maxProfessionals;
}

export function canSendMessage(shop: Shop): boolean {
  if (shop.plan === 'FREE') {
    const monthlyCount = getMonthlyMessageCount(shop.id);
    return monthlyCount < 50;
  }
  return true; // Paid plans have unlimited
}
```

---

## 8. Database Schema

### Modelos Principales

```prisma
model Shop {
  id              String   @id @default(cuid())
  name            String
  shopType        ShopType @default(BARBERSHOP)
  plan            Plan     @default(FREE)
  stripeId        String?  // Stripe Customer ID

  members         Membership[]
  appointments    Appointment[]
  clients         Client[]
  services        Service[]
  stylists        Stylist[]
  teams           Team[]
  availabilities  Availability[]
}

model Membership {
  id        String   @id @default(cuid())
  userId    String
  shopId    String
  role      Role

  user      User     @relation(fields: [userId], references: [id])
  shop      Shop     @relation(fields: [shopId], references: [id])

  @@unique([userId, shopId])
}

model Appointment {
  id         String      @id @default(cuid())
  shopId     String
  clientId   String
  serviceId  String
  stylistId  String
  startTime  DateTime
  status     Status

  shop       Shop        @relation(fields: [shopId], references: [id])
  client     Client      @relation(fields: [clientId], references: [id])
  service    Service     @relation(fields: [serviceId], references: [id])
  stylist    Stylist     @relation(fields: [stylistId], references: [id])

  @@index([shopId, startTime])
  @@index([clientId, status])
}
```

### Índices Críticos

```prisma
@@index([shopId, startTime])        // Para queries de citas por fecha
@@index([shopId, phone], unique)    // Para lookup de clientes
@@index([stylistId, startTime])     // Para calendario del barbero
```

---

## 9. Seguridad

### Capas de Seguridad

```
┌─────────────────────────────────────────────────────────────┐
│  LAYER 1: NETWORK                                            │
│  - HTTPS (TLS 1.3)                                          │
│  - Vercel edge security                                     │
│  - DDoS protection                                          │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  LAYER 2: AUTHENTICATION                                     │
│  - Supabase Auth (JWT)                                      │
│  - httpOnly cookies                                         │
│  - Secure flag en cookies                                   │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  LAYER 3: AUTHORIZATION                                      │
│  - requireAuth middleware                                   │
│  - requireRole middleware                                   │
│  - requireShopAccess middleware                             │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  LAYER 4: INPUT VALIDATION                                    │
│  - Zod schemas para todas las inputs                        │
│  - Type checking con TypeScript                             │
│  - Prisma ORM validation                                    │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  LAYER 5: DATA ISOLATION                                     │
│  - Queries SIEMPRE filtran por shopId                       │
│  - Row Level Security (RLS) en Supabase                     │
│  - Tenant isolation                                         │
└─────────────────────────────────────────────────────────────┘
                            │
                            ▼
┌─────────────────────────────────────────────────────────────┐
│  LAYER 6: RATE LIMITING & MONITORING                         │
│  - Upstash Redis rate limiting                              │
│  - Sentry error tracking                                    │
│  - Pino structured logging                                  │
└─────────────────────────────────────────────────────────────┘
```

---

## 10. Escalabilidad

### Estrategias de Escalamiento

**Frontend:**
- Next.js edge runtime para pages estáticas
- Static generation donde sea posible
- Code splitting por ruta
- CDN (Vercel Edge Network)

**Backend:**
- API routes en serverless functions
- Database connection pooling (Prisma)
- Redis caching para datos frecuentes
- Queue para tareas asíncronas

**Database:**
- Índices compuestos para queries rápidas
- Partitioning por shopId (futuro)
- Read replicas (futuro)

---

## 11. Monitoreo y Observabilidad

### Stack de Monitoreo

```
┌─────────────────────────────────────────────────────────────┐
│  APPLICATION METRICS                                         │
│  - Sentry: Error tracking                                   │
│  - Vercel Analytics: Performance                            │
│  - Custom logs: Pino                                        │
└─────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────┐
│  BUSINESS METRICS                                            │
│  - Stripe: Revenue, MRR, Churn                              │
│  - Custom: Citas creadas, Mensajes enviados                 │
│  - WhatsApp: Delivery rate, Response rate                   │
└─────────────────────────────────────────────────────────────┘
```

---

## 12. Deployment

### Environments

```
development → Local + Staging (Vercel preview)
production  → Vercel (production)
```

### CI/CD Pipeline

```
1. Push to branch → GitHub Actions
2. Run tests (Vitest)
3. Run linter (ESLint)
4. Build Next.js
5. Deploy to Vercel (preview)
6. On merge to main → Deploy to production
```

---

## 13. Decisiones Arquitectónicas

### Por qué Next.js?
- Server components para mejor performance
- API routes integradas (monolito simplificado)
- Excelente developer experience
- Optimizado para Vercel deployment
- Gran soporte de TypeScript

### Por qué Prisma?
- Type safety automático
- Migraciones versionadas
- Excelente DX
- Good performance paraqueries complejas
- Multi-database support

### Por qué Supabase Auth?
- Authentication out-of-the-box
- Row Level Security
- Built-in user management
- Free tier generoso
- PostgreSQL nativo

### Por qué Stripe?
- Indústria standard
- Excelente documentación
- Soporta RD$ (via custom setup)
- Webhooks robustos
- Subscription management

---

## 14. Roadmap Técnico

### v1.0 (Current)
- Multi-nicho soportado
- WhatsApp integración
- Stripe payments
- Analytics básico

### v1.5 (Q2 2026)
- Google Calendar sync
- Mobile app (React Native)
- Advanced analytics

### v2.0 (Q3 2026)
- Multi-location mejorado
- API pública
- Marketplace de integraciones
- White-label option

---

## 15. Referencias

- [Next.js Docs](https://nextjs.org/docs)
- [Prisma Docs](https://www.prisma.io/docs)
- [Supabase Docs](https://supabase.com/docs)
- [Stripe Docs](https://stripe.com/docs)
- [WhatsApp Business API](https://developers.facebook.com/docs/whatsapp)

---

**Última revisión:** 2026-02-15
**Mantenido por:** Equipo Domicitas
