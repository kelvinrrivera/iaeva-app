# API Reference - Domicitas

## Base URL

```
Production: https://api.domicitas.com
Development: http://localhost:3000/api
```

## Authentication

Todas las requests (excepto auth endpoints) requieren un token JWT válido en el header `Authorization`:

```http
Authorization: Bearer <token>
```

---

## Endpoints

### Authentication

#### Register User

```http
POST /api/auth/register
```

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "securepassword",
  "name": "John Doe"
}
```

**Response (201):**
```json
{
  "user": {
    "id": "user_123",
    "email": "user@example.com",
    "name": "John Doe"
  },
  "token": "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9..."
}
```

#### Login

```http
POST /api/auth/login
```

**Request Body:**
```json
{
  "email": "user@example.com",
  "password": "securepassword"
}
```

**Response (200):**
```json
{
  "user": {
    "id": "user_123",
    "email": "user@example.com"
  },
  "session": {
    "access_token": "...",
    "refresh_token": "..."
  }
}
```

#### Get Session

```http
GET /api/auth/session
```

**Response (200):**
```json
{
  "user": {
    "id": "user_123",
    "email": "user@example.com",
    "shopId": "shop_123"
  }
}
```

---

### Shops

#### Get User's Shop

```http
GET /api/shop
```

**Response (200):**
```json
{
  "id": "shop_123",
  "name": "Barbería Central",
  "shopType": "BARBERSHOP",
  "plan": "PROFESSIONAL",
  "address": "Calle Principal #123",
  "phoneNumber": "+1(809)555-1234",
  "whatsappNumber": "+1(809)555-1234"
}
```

#### Update Shop

```http
PUT /api/shop
```

**Request Body:**
```json
{
  "name": "Barbería Central",
  "address": "Calle Principal #123",
  "phoneNumber": "+1(809)555-1234",
  "whatsappNumber": "+1(809)555-1234"
}
```

**Response (200):**
```json
{
  "id": "shop_123",
  "name": "Barbería Central",
  "updatedAt": "2025-02-15T10:30:00Z"
}
```

#### Get Shop Analytics

```http
GET /api/analytics?period=30d
```

**Query Parameters:**
- `period`: `7d`, `30d`, `90d`

**Response (200):**
```json
{
  "totalRevenue": 150000,
  "appointmentsCount": 150,
  "newClients": 25,
  "topServices": [
    {
      "name": "Corte Caballero",
      "count": 75,
      "revenue": 75000
    }
  ],
  "stylistPerformance": [
    {
      "name": "Juan Pérez",
      "appointments": 80,
      "revenue": 80000
    }
  ],
  "dailyRevenue": [
    {
      "date": "2025-02-01",
      "revenue": 5000
    }
  ]
}
```

---

### Services

#### List Services

```http
GET /api/services
```

**Response (200):**
```json
[
  {
    "id": "service_123",
    "name": "Corte Caballero",
    "description": "Corte clásico con tijera",
    "price": 500,
    "duration": 30,
    "serviceType": "HAIRCUT",
    "isActive": true
  }
]
```

#### Create Service

```http
POST /api/services
```

**Request Body:**
```json
{
  "name": "Corte Caballero",
  "description": "Corte clásico con tijera",
  "price": 500,
  "duration": 30,
  "serviceType": "HAIRCUT"
}
```

**Response (201):**
```json
{
  "id": "service_123",
  "name": "Corte Caballero",
  "price": 500,
  "duration": 30,
  "serviceType": "HAIRCUT"
}
```

#### Update Service

```http
PUT /api/services/:id
```

**Request Body:**
```json
{
  "name": "Corte Premium",
  "price": 700
}
```

**Response (200):**
```json
{
  "id": "service_123",
  "name": "Corte Premium",
  "price": 700
}
```

#### Delete Service

```http
DELETE /api/services/:id
```

**Response (200):**
```json
{
  "success": true
}
```

---

### Appointments

#### List Appointments

```http
GET /api/appointments?startDate=2025-02-01&endDate=2025-02-28
```

**Query Parameters:**
- `startDate`: ISO date string
- `endDate`: ISO date string
- `status`: Filter by status
- `stylistId`: Filter by stylist
- `locationId`: Filter by location

**Response (200):**
```json
[
  {
    "id": "apt_123",
    "clientName": "María García",
    "clientWhatsApp": "+1(809)555-5678",
    "startTime": "2025-02-15T15:00:00Z",
    "endTime": "2025-02-15T15:30:00Z",
    "status": "CONFIRMED",
    "service": {
      "id": "service_123",
      "name": "Corte Caballero"
    },
    "stylist": {
      "id": "stylist_123",
      "name": "Juan Pérez"
    }
  }
]
```

#### Create Appointment

```http
POST /api/appointments
```

**Request Body:**
```json
{
  "clientName": "María García",
  "clientWhatsApp": "+1(809)555-5678",
  "serviceId": "service_123",
  "stylistId": "stylist_123",
  "startTime": "2025-02-15T15:00:00Z"
}
```

**Response (201):**
```json
{
  "id": "apt_123",
  "clientName": "María García",
  "startTime": "2025-02-15T15:00:00Z",
  "status": "SCHEDULED"
}
```

#### Get Appointment

```http
GET /api/appointments/:id
```

**Response (200):**
```json
{
  "id": "apt_123",
  "clientName": "María García",
  "service": {
    "name": "Corte Caballero",
    "price": 500
  },
  "stylist": {
    "name": "Juan Pérez"
  },
  "status": "SCHEDULED"
}
```

#### Update Appointment

```http
PUT /api/appointments/:id
```

**Request Body:**
```json
{
  "startTime": "2025-02-15T16:00:00Z",
  "status": "CONFIRMED"
}
```

**Response (200):**
```json
{
  "id": "apt_123",
  "startTime": "2025-02-15T16:00:00Z",
  "status": "CONFIRMED"
}
```

#### Cancel Appointment

```http
POST /api/appointments/:id/cancel
```

**Response (200):**
```json
{
  "id": "apt_123",
  "status": "CANCELLED"
}
```

---

### Team (Stylists)

#### List Stylists

```http
GET /api/team
```

**Response (200):**
```json
[
  {
    "id": "stylist_123",
    "name": "Juan Pérez",
    "email": "juan@example.com",
    "shopId": "shop_123",
    "locationId": "loc_123"
  }
]
```

#### Create Stylist

```http
POST /api/team
```

**Request Body:**
```json
{
  "name": "Juan Pérez",
  "email": "juan@example.com",
  "locationId": "loc_123"
}
```

**Response (201):**
```json
{
  "id": "stylist_123",
  "name": "Juan Pérez"
}
```

#### Update Stylist

```http
PUT /api/team/:id
```

**Request Body:**
```json
{
  "name": "Juan Pérez Jr.",
  "locationId": "loc_456"
}
```

**Response (200):**
```json
{
  "id": "stylist_123",
  "name": "Juan Pérez Jr."
}
```

#### Delete Stylist

```http
DELETE /api/team/:id
```

**Response (200):**
```json
{
  "success": true
}
```

---

### Clients

#### List Clients

```http
GET /api/clients
```

**Query Parameters:**
- `search`: Search by name or phone

**Response (200):**
```json
[
  {
    "id": "client_123",
    "name": "María García",
    "phoneNumber": "+1(809)555-5678",
    "email": "maria@example.com",
    "isActive": true
  }
]
```

#### Create Client

```http
POST /api/clients
```

**Request Body:**
```json
{
  "name": "María García",
  "phoneNumber": "+1(809)555-5678",
  "email": "maria@example.com"
}
```

**Response (201):**
```json
{
  "id": "client_123",
  "name": "María García",
  "phoneNumber": "+1(809)555-5678"
}
```

---

### Locations (Multi-Sucursal)

#### List Locations

```http
GET /api/locations
```

**Response (200):**
```json
[
  {
    "id": "loc_123",
    "name": "Sucursal Centro",
    "address": "Calle Principal #123",
    "phoneNumber": "+1(809)555-1234",
    "_count": {
      "stylists": 3,
      "appointments": 150
    }
  }
]
```

#### Create Location

```http
POST /api/locations
```

**Request Body:**
```json
{
  "name": "Sucursal Centro",
  "address": "Calle Principal #123",
  "phoneNumber": "+1(809)555-1234",
  "timezone": "America/Santo_Domingo"
}
```

**Response (201):**
```json
{
  "id": "loc_123",
  "name": "Sucursal Centro"
}
```

#### Update Location

```http
PUT /api/locations/:id
```

**Request Body:**
```json
{
  "name": "Sucursal Centro - Actualizado"
}
```

**Response (200):**
```json
{
  "id": "loc_123",
  "name": "Sucursal Centro - Actualizado"
}
```

#### Delete Location

```http
DELETE /api/locations/:id
```

**Response (200):**
```json
{
  "success": true
}
```

---

### Calendar Integration

#### Connect Google Calendar

```http
POST /api/calendar/connect
```

**Response (200):**
```json
{
  "authUrl": "https://accounts.google.com/o/oauth2/auth?..."
}
```

#### Get Calendar Settings

```http
GET /api/calendar/settings
```

**Response (200):**
```json
{
  "connected": true,
  "settings": {
    "calendarId": "primary",
    "syncEnabled": true,
    "syncDirection": "BIDIRECTIONAL"
  }
}
```

#### Update Calendar Settings

```http
PUT /api/calendar/settings
```

**Request Body:**
```json
{
  "enabled": true,
  "calendarId": "primary",
  "direction": "BIDIRECTIONAL"
}
```

**Response (200):**
```json
{
  "success": true
}
```

#### Sync Calendar

```http
POST /api/calendar/sync
```

**Response (200):**
```json
{
  "success": true,
  "results": {
    "success": 50,
    "failed": 0,
    "skipped": 5
  }
}
```

#### Disconnect Calendar

```http
DELETE /api/calendar/settings
```

**Response (200):**
```json
{
  "success": true
}
```

---

### Billing

#### Get Subscription

```http
GET /api/billing/subscription
```

**Response (200):**
```json
{
  "plan": "PROFESSIONAL",
  "status": "active",
  "currentPeriodEnd": "2025-03-15T00:00:00Z",
  "cancelAtPeriodEnd": false
}
```

#### Create Checkout Session

```http
POST /api/billing/checkout
```

**Request Body:**
```json
{
  "priceId": "price_123",
  "successUrl": "https://domicitas.com/billing?success=true",
  "cancelUrl": "https://domicitas.com/billing?canceled=true"
}
```

**Response (200):**
```json
{
  "url": "https://checkout.stripe.com/...",
  "sessionId": "cs_123"
}
```

#### Cancel Subscription

```http
POST /api/billing/cancel
```

**Request Body:**
```json
{
  "reason": "Too expensive"
}
```

**Response (200):**
```json
{
  "success": true,
  "willCancelAt": "2025-03-15T00:00:00Z"
}
```

#### Get Invoices

```http
GET /api/billing/invoices
```

**Response (200):**
```json
[
  {
    "id": "in_123",
    "amount": 1500,
    "currency": "DOP",
    "status": "paid",
    "createdAt": "2025-02-15T00:00:00Z",
    "pdfUrl": "https://..."
  }
]
```

---

### WhatsApp

#### Send WhatsApp Message

```http
POST /api/whatsapp/send
```

**Request Body:**
```json
{
  "to": "+1(809)555-5678",
  "templateName": "appointment_confirmation",
  "templateData": {
    "clientName": "María",
    "date": "15 de febrero",
    "time": "3:00 PM",
    "serviceName": "Corte Caballero"
  }
}
```

**Response (200):**
```json
{
  "success": true,
  "messageId": "wamid.123"
}
```

#### WhatsApp Webhook

```http
POST /api/whatsapp/webhook
```

**Request Body:**
```json
{
  "entry": [
    {
      "changes": [
        {
          "value": {
            "messages": [
              {
                "from": "+1(809)555-5678",
                "id": "wamid.123",
                "text": {
                  "body": "Quieres reserva para mañana"
                }
              }
            ]
          }
        }
      ]
    }
  ]
}
```

**Response (200):**
```json
{
  "success": true
}
```

---

## Error Responses

### Error Format

```json
{
  "error": "Error message",
  "code": "ERROR_CODE",
  "details": {}
}
```

### Common Error Codes

- `UNAUTHORIZED` (401): Token inválido o expirado
- `FORBIDDEN` (403): No tienes permiso para este recurso
- `NOT_FOUND` (404): Recurso no encontrado
- `VALIDATION_ERROR` (400): Error de validación
- `RATE_LIMIT_EXCEEDED` (429): Demasiadas requests
- `INTERNAL_ERROR` (500): Error del servidor

### Example Error Response

```json
{
  "error": "Validation failed",
  "code": "VALIDATION_ERROR",
  "details": {
    "fields": {
      "clientName": "Required"
    }
  }
}
```

---

## Rate Limiting

### Limits por Plan

- **FREE**: 100 requests/hour
- **PROFESSIONAL**: 1000 requests/hour
- **ENTERPRISE**: 10000 requests/hour

### Headers

```http
X-RateLimit-Limit: 1000
X-RateLimit-Remaining: 999
X-RateLimit-Reset: 1647523200
```

---

## Webhooks

### Stripe Webhooks

```http
POST /api/webhooks/stripe
```

### Supported Events

- `checkout.session.completed`
- `customer.subscription.created`
- `customer.subscription.updated`
- `customer.subscription.deleted`
- `invoice.paid`
- `invoice.payment_failed`

### Webhook Signature

Verifica la firma usando `STRIPE_WEBHOOK_SECRET`:

```typescript
import Stripe from 'stripe';

const signature = request.headers.get('stripe-signature');
const event = stripe.webhooks.constructEvent(body, signature, webhookSecret);
```

---

## Testing

### Sandbox Environment

Usa `https://sandbox-api.domicitas.com` para testing.

### Test Cards

```
Visa: 4242 4242 4242 4242
Mastercard: 5555 5555 5555 4444
Expiry: Any future date
CVC: Any 3 digits
```

---

## Changelog

### v1.0.0 (2025-02-15)
- Initial API release
- All core endpoints implemented
- Authentication and authorization
- Multi-nicho support
- Integrations (WhatsApp, Calendar, Stripe)

---

**Para soporte de API**: api@domicitas.com

**Documentación adicional**: [docs.domicitas.com](https://docs.domicitas.com)
