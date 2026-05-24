# Guía de Administración - Domicitas

## Tabla de Contenidos

1. [Arquitectura del Sistema](#arquitectura-del-sistema)
2. [Configuración Técnica](#configuración-técnica)
3. [Gestión de Usuarios y Roles](#gestión-de-usuarios-y-roles)
4. [Seguridad y Compliance](#seguridad-y-compliance)
5. [Monitorización y Logging](#monitorización-y-logging)
6. [Base de Datos](#base-de-datos)
7. [API Endpoints](#api-endpoints)
8. [Troubleshooting](#troubleshooting)
9. [Mantenimiento](#mantenimiento)

---

## Arquitectura del Sistema

### Stack Tecnológico

#### Frontend
- **Next.js 16**: Framework React con App Router
- **TypeScript**: Tipado estático
- **TailwindCSS**: Estilos
- **shadcn/ui**: Componentes UI

#### Backend
- **Next.js API Routes**: Endpoints serverless
- **Prisma ORM**: Gestión de base de datos
- **Supabase Auth**: Autenticación
- **PostgreSQL**: Base de datos principal

#### Servicios Externos
- **Stripe**: Pagos y suscripciones
- **WhatsApp Business API**: Mensajería
- **Google Gemini AI**: Chatbot
- **Google Calendar API**: Sincronización
- **Upstash Redis**: Rate limiting
- **Sentry**: Error tracking

### Estructura del Proyecto

```
domicitas/
├── app/                      # Next.js App Router
│   ├── (auth)/              # Rutas de autenticación
│   ├── dashboard/           # Dashboard principal
│   ├── api/                 # API Routes
│   └── onboarding/          # Flujo de onboarding
├── components/              # Componentes reutilizables
├── lib/                     # Utilidades y lógica de negocio
│   ├── analytics/          # Motor de analíticas
│   ├── integrations/       # Integraciones externas
│   ├── monitoring/         # Logging y tracking
│   └── whatsapp/           # WhatsApp y chatbot
├── prisma/                  # Schema y migraciones
└── docs/                    # Documentación
```

---

## Configuración Técnica

### Variables de Entorno

#### Requeridas

```bash
# Supabase
NEXT_PUBLIC_SUPABASE_URL=your-project-url.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key
SUPABASE_SERVICE_ROLE_KEY=your-service-role-key

# Database
DATABASE_URL=postgresql://user:pass@host:5432/domicitas

# Stripe
STRIPE_SECRET_KEY=sk_test_...
NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY=pk_test_...
STRIPE_WEBHOOK_SECRET=whsec_...

# WhatsApp
WHATSAPP_ACCESS_TOKEN=your-token
WHATSAPP_PHONE_NUMBER_ID=your-id
```

#### Opcionales

```bash
# Upstash Redis
UPSTASH_REDIS_REST_URL=https://...
UPSTASH_REDIS_REST_TOKEN=your-token

# Sentry
NEXT_PUBLIC_SENTRY_DSN=https://...
SENTRY_AUTH_TOKEN=your-token

# Google Calendar
GOOGLE_CALENDAR_CLIENT_ID=your-client-id
GOOGLE_CALENDAR_CLIENT_SECRET=your-secret

# Google Gemini
GOOGLE_GENERATIVE_AI_API_KEY=your-key
```

### Instalación

```bash
# Clone el repositorio
git clone https://github.com/your-org/domicitas.git
cd domicitas

# Instala dependencias
pnpm install

# Configura variables de entorno
cp .env.example .env.local
# Edita .env.local con tus valores

# Ejecuta migraciones
pnpm prisma migrate deploy

# Genera cliente Prisma
pnpm prisma generate

# Inicia servidor de desarrollo
pnpm dev
```

### Base de Datos

#### Migraciones

```bash
# Crear nueva migración
pnpm prisma migrate dev --name add_locations

# Aplicar migraciones
pnpm prisma migrate deploy

# Resetear base de datos (solo desarrollo)
pnpm prisma migrate reset

# Abrir Prisma Studio
pnpm prisma studio
```

#### Row Level Security (RLS)

Domicitas usa RLS de Supabase para isolación de tenants:

```sql
-- Ejemplo: Política para appointments
CREATE POLICY "Users can view appointments from their shop"
ON appointments
FOR SELECT
USING (
  shopId IN (
    SELECT shopId FROM memberships WHERE userId = auth.uid()
  )
);
```

---

## Gestión de Usuarios y Roles

### Sistema de Roles

#### SUPER_ADMIN
- **Acceso**: Todas las tiendas y funcionalidades
- **Permisos**: Gestión de usuarios, configuración global, analytics consolidados

#### ORG_ADMIN (Shop Owner)
- **Acceso**: Su tienda solamente
- **Permisos**: Configuración de tienda, gestión de equipo, facturación

#### TEAM_LEADER
- **Acceso**: Su equipo y ubicación asignada
- **Permisos**: Gestión de citas de su equipo, ver analíticas de su ubicación

#### PROFESSIONAL (Stylist)
- **Acceso**: Sus citas solamente
- **Permisos**: Ver/editar sus citas, ver su perfil

#### CUSTOMER
- **Acceso**: Portal de cliente
- **Permisos**: Ver sus citas, hacer reservaciones

### Middleware de Autorización

```typescript
// lib/auth-middleware.ts
import { requireAuth } from '@/lib/auth-middleware';
import { requireRole } from '@/lib/auth-middleware';

// Requiere autenticación
export async function GET(request: NextRequest) {
  const user = await requireAuth(request);
  // ...
}

// Requiere rol específico
export async function POST(request: NextRequest) {
  const user = await requireRole(request, ['ORG_ADMIN', 'SUPER_ADMIN']);
  // ...
}
```

### Invitaciones

```bash
# POST /api/invitations
{
  "email": "nuevo@empleado.com",
  "role": "PROFESSIONAL",
  "shopId": "shop_123"
}

# El usuario recibá un enlace para registrarse
# Al registrarse, se asigna automáticamente al rol y tienda
```

---

## Seguridad y Compliance

### Autenticación

#### Supabase Auth Flow

1. Usuario se registra con email/password
2. Supabase crea usuario y devuelve JWT
3. Cliente almacena token en cookies
4. API valida token en cada request

#### Session Management

```typescript
// Configurar duración de sesión
const SESSION_DURATION = 7 * 24 * 60 * 60; // 7 días

// Refresh token automático
const { data, error } = await supabase.auth.refreshSession();
```

### Rate Limiting

```typescript
// lib/rate-limit.ts
import { Ratelimit } from '@upstash/ratelimit';
import { Redis } from '@upstash/redis';

const ratelimit = new Ratelimit({
  redis: Redis.fromEnv(),
  limiter: Ratelimit.slidingWindow(10, '10 s'),
});

export async function checkRateLimit(identifier: string) {
  const { success } = await ratelimit.limit(identifier);
  if (!success) {
    throw new Error('Rate limit exceeded');
  }
}
```

### Validación de Input

```typescript
import { z } from 'zod';

const appointmentSchema = z.object({
  clientName: z.string().min(2).max(100),
  clientWhatsApp: z.string().regex(/^\+?\d{10,15}$/),
  serviceId: z.string().cuid(),
  stylistId: z.string().cuid(),
  startTime: z.coerce.date().min(new Date()),
});

// En API route
const validated = appointmentSchema.parse(await request.json());
```

### Seguridad de Datos

#### Encriptación
- Datos en tránsito: TLS 1.3
- Datos en reposo: Encriptación Supabase (AES-256)
- Passwords: bcrypt (hash + salt)

#### Aislamiento de Tenants
- Cada `shopId` está aislado a nivel base de datos
- RLS policies previenen cross-tenant access
- API valida `shopId` en cada request

### GDPR y Privacidad

#### Datos Recopilados
- **Usuarios**: Nombre, email, teléfono
- **Citas**: Fecha, servicio, profesional
- **Pagos**: Datos procesados por Stripe (PCI DSS)

#### Derechos del Usuario
- **Acceso**: Exportar todos los datos
- **Eliminación**: Borrar cuenta y datos asociados
- **Portabilidad**: Descargar datos en JSON

---

## Monitorización y Logging

### Sentry (Error Tracking)

```typescript
// sentry.server.config.ts
import * as Sentry from '@sentry/nextjs';

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: 0.1,
  beforeSend(event) {
    // Filtrar datos sensibles
    if (event.request?.headers) {
      delete event.request.headers['authorization'];
    }
    return event;
  },
});
```

### Structured Logging (Pino)

```typescript
// lib/monitoring/logger.ts
import pino from 'pino';

export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  formatters: {
    level: (label) => ({ level: label }),
  },
  redact: ['req.headers.authorization', 'req.headers.cookie'],
});

// Uso
logger.info({ userId, action: 'appointment_created' });
logger.error({ error, userId }, 'Failed to create appointment');
```

### Métricas Custom

```typescript
// Track eventos de negocio
await prisma.analytics.create({
  data: {
    eventType: 'appointment_created',
    shopId,
    metadata: { serviceId, stylistId },
  },
});
```

---

## Base de Datos

### Optimizaciones

#### Índices

```prisma
model Appointment {
  @@index([shopId, startTime])
  @@index([clientId, status])
  @@index([stylistId, startTime])
}
```

#### Queries Eficientes

```typescript
// ❌ Mal: N+1 query
const appointments = await prisma.appointment.findMany();
for (const apt of appointments) {
  const service = await prisma.service.findUnique({ where: { id: apt.serviceId } });
}

// ✅ Bien: Include
const appointments = await prisma.appointment.findMany({
  include: { service: true, stylist: true },
});
```

#### Connection Pooling

```bash
# Prisma connection pool
DATABASE_URL="postgresql://user:pass@host:5432/db?connection_limit=10"
```

### Backups

- **Automáticos**: Supabase crea backups diarios
- **Retention**: 30 días
- **Point-in-Time Recovery**: Hasta 7 días

### Migraciones

```bash
# Crear migración
pnpm prisma migrate dev --name add_locations

# Aplicar en producción
pnpm prisma migrate deploy

# Rollback (manual)
# 1. Crear migración de reversión
# 2: pnpm prisma migrate dev --name revert_add_locations
```

---

## API Endpoints

### Authentication

```typescript
POST /api/auth/register
POST /api/auth/login
POST /api/auth/logout
GET  /api/auth/session
```

### Shops

```typescript
GET    /api/shops
GET    /api/shops/:id
PUT    /api/shops/:id
DELETE /api/shops/:id
GET    /api/shops/:id/analytics
```

### Appointments

```typescript
GET    /api/appointments
POST   /api/appointments
GET    /api/appointments/:id
PUT    /api/appointments/:id
DELETE /api/appointments/:id
POST   /api/appointments/:id/confirm
POST   /api/appointments/:id/cancel
```

### Services

```typescript
GET    /api/services
POST   /api/services
GET    /api/services/:id
PUT    /api/services/:id
DELETE /api/services/:id
```

### Team

```typescript
GET    /api/team
POST   /api/team
GET    /api/team/:id
PUT    /api/team/:id
DELETE /api/team/:id
```

### Billing

```typescript
GET    /api/billing/subscription
POST   /api/billing/checkout
POST   /api/billing/cancel
GET    /api/billing/invoices
```

### Integrations

```typescript
# WhatsApp
POST /api/whatsapp/send
POST /api/whatsapp/webhook

# Calendar
GET  /api/calendar/settings
PUT  /api/calendar/settings
POST /api/calendar/connect
GET  /api/calendar/callback
POST /api/calendar/sync
```

---

## Troubleshooting

### Problemas Comunes

#### 1. "Stripe webhook signature verification failed"

**Causa**: `STRIPE_WEBHOOK_SECRET` incorrecto

**Solución**:
```bash
# Obtener secreto correcto de Stripe Dashboard
# Webhooks → Select endpoint → Click "Click to reveal"
```

#### 2. "Prisma Client is not generated"

**Causa**: Cliente Prisma no generado después de migración

**Solución**:
```bash
pnpm prisma generate
```

#### 3. "Row Level Security policy violation"

**Causa**: Usuario no tiene acceso al recurso

**Solución**:
```typescript
// Verificar que userId está en memberships table
const membership = await prisma.membership.findUnique({
  where: {
    userId_shopId: { userId, shopId },
  },
});

if (!membership) {
  throw new Error('Unauthorized');
}
```

#### 4. "WhatsApp rate limit exceeded"

**Causa**: Demasiados mensajes enviados

**Solución**:
- Verificar límites del plan
- Implementar cola de mensajes
- Usar bulk messaging API

### Debug Mode

```bash
# Habilitar debug logs
DEBUG=* pnpm dev

# Logs específicos
DEBUG=prisma:query pnpm dev
```

### Performance Profiling

```typescript
// Añadir timing logs
const start = Date.now();
await operation();
const duration = Date.now() - start;
logger.info({ operation, duration });
```

---

## Mantenimiento

### Tareas Diarias

- ✅ Verificar logs de errores en Sentry
- ✅ Monitorear uso de WhatsApp
- ✅ Revisar métricas de rendimiento

### Tareas Semanales

- ✅ Revisar analytics de negocio
- ✅ Verificar queue de mensajes fallidos
- ✅ Actualizar documentación si es necesario

### Tareas Mensuales

- ✅ Revisar y optimizar queries lentos
- ✅ Verificar límites de API (Stripe, WhatsApp, Google)
- ✅ Actualizar dependencias
- ✅ Revisar costos de infraestructura

### Actualizaciones

```bash
# Actualizar dependencias
pnpm update

# Verificar vulnerabilidades
pnpm audit

# Fix automáticas
pnpm audit fix
```

### Escalado

#### Cuándo escalar

- **Base de Datos**: CPU > 70% durante 24h
- **API**: Response time p95 > 500ms
- **Redis**: Memoria > 80%

### Estrategias de Escalado

1. **Vertical**: Aumentar recursos del servidor
2. **Horizontal**: Añadir más réplicas
3. **Caching**: Implementar Redis cache
4. **CDN**: Cloudflare para assets estáticos

---

## Checklist de Producción

### Pre-Deployment

- [ ] Todas las variables de entorno configuradas
- [ ] Migraciones aplicadas
- [ ] Índices de base de datos creados
- [ ] RLS policies activas
- [ ] Certificados SSL válidos
- [ ] Dominios configurados
- [ ] Webhooks de Stripe configurados
- [ ] Rate limiting activado
- [ ] Sentry configurado
- [ ] Logs configurados

### Post-Deployment

- [ ] Verificar health checks
- [ ] Probar flujo completo (registro → cita → pago)
- [ ] Verificar webhooks
- [ ] Monitorear errores por 1 hora
- [ ] Verificar analytics
- [ ] Probar integraciones (WhatsApp, Calendar)

---

**Para soporte técnico**: admin@domicitas.com

**Documentación adicional**: [docs.domicitas.com](https://docs.domicitas.com)
