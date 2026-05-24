# Playbook: Referral Program

> Tu canal de adquisición más barato y de mayor calidad. Un cliente que viene referido convierte 3-5x más, churnea 50% menos, y te trae más amigos.

## 🎯 El programa: "Trae un Amigo"

### Reglas simples (versión MVP)

**Cliente referidor recibe:**
- 50% off su próximo mes cuando el amigo paga
- Si refiere 3 en 60 días → **1 mes 100% gratis**
- Si refiere 10+ en 12 meses → **plan TEAM gratis de por vida**

**Amigo referido recibe:**
- 50% off su primer mes (sobre el plan que elija)
- Sin tarjeta hasta el día 30

### Por qué funciona en RD
- Cultura de "primo del primo" — la confianza se transmite
- Barberos/estilistas tienen redes densas (gremios, ferias, distribuidores comunes)
- WhatsApp es el canal natural para pasar la recomendación

## 🛠️ Cómo implementarlo técnicamente

### MVP manual (semana 1)
- Sin código nuevo
- Le pides al cliente actual que diga "Carlos me refirió" al onboardear
- Tú aplicas el descuento manualmente en Stripe
- Tracking en hoja de cálculo

### V1 con tracking automático (semana 4)
Añadir al dashboard del cliente:
- Sección "Refiere amigos" con su **link único** `domicita.com/r/{referralCode}`
- Contador de referidos pendientes / completados
- Notificación cuando alguien usa su código

Schema:
```prisma
model Referral {
  id            String   @id @default(cuid())
  referrerShopId String
  referredShopId String?  // null si todavía no se ha registrado
  referralCode  String   @unique
  status        String   // 'pending' | 'signed_up' | 'paid' | 'expired'
  rewardApplied Boolean  @default(false)
  createdAt     DateTime @default(now())
}
```

Cuando el referido paga el primer mes:
- Status → `paid`
- Aplicar 50% off en próximo invoice de Stripe del referidor
- Notificar a referidor por WhatsApp

### V2 con programa premium (mes 3)
- Tier system (Bronze 1, Silver 5, Gold 10, Diamond 25)
- Recompensas crecientes (descuento, plan superior, comisiones reales)
- Pestaña dedicada en dashboard con leaderboard

## 📣 Cómo lanzar el programa

### A clientes actuales

#### Día de lanzamiento — WhatsApp 1-a-1
```
Hola [Nombre]! 👋 

Quería contarte algo bueno. Como llevas [X tiempo] con DomiCita y eres uno de
los primeros, te incluí en nuestro programa de referidos.

Funciona así: cada barbería o salón que tú me presentes y se registre, vas a
recibir 50% de descuento el siguiente mes (puedes acumular hasta tener un mes
totalmente gratis).

¿Conoces a algún colega que te gustaría que probara DomiCita?
```

**Por qué funciona**:
- Personal, no spam
- Le reconoces que es "uno de los primeros"
- CTA directo y simple

#### Post fijado en IG
Reel/post con título: **"Si traes a un amigo, te regalo el mes"**
- Subtítulos claros
- CTA: "DM para tu código personal"

#### En el dashboard
Banner persistente: **"🎁 Refiere y gana — 50% off por cada amigo"**

### A no clientes (referidos potenciales)

Cuando un referido entra:
- Landing page especial: `domicita.com/r/[code]`
- Mensaje: **"[Nombre referidor] te recomendó DomiCita. Empezás con 50% off tu primer mes."**
- Foto del referidor (con su permiso) y testimonio en 1 línea

Esto **convierte 3-5x más** que un landing genérico.

## 💰 Math del programa

### Costo unitario por referido
- Descuento referidor: -50% × $19 = **$9.50** (un mes)
- Descuento referido: -50% × $19 = **$9.50** (un mes)
- **Costo total**: $19 USD para conseguir 1 cliente

### Comparación con otros canales

| Canal | CAC promedio |
|---|---|
| Referral | $19 |
| Ground game | $30 (tiempo + gas + corte) |
| Meta Ads | $40-80 |
| Google Ads | $30-60 |
| TikTok Ads | $50+ (todavía sin validar) |

**Referrals = canal más barato** + cliente con mayor LTV.

## 🚀 Cómo activar más referrals

### 1. Pide al cliente JUSTO después de un "wow moment"
- Después de que reciben su primera notificación de cita nueva del bot
- Después del primer fin de semana con 0 mensajes perdidos
- Cuando un cliente les comenta "qué bueno tu sistema"

Plantilla por WhatsApp:
```
Hola [Nombre], vi que tu bot ya agendó X citas esta semana 🚀

¿Te ha gustado? Si conoces a alguien que pelee con el mismo problema de los
WhatsApp sin contestar, te lo agradezco si me lo refieres.

Tú recibes 50% off el siguiente mes, él recibe 50% off su primer mes.

¿Te paso el link?
```

### 2. Crea status competitivo
- Top 5 referidores del mes → mención en IG + premio físico (camiseta exclusiva, gorra, etc.)
- Bajo costo, alto impacto motivacional

### 3. Eventos de "meet-up" de clientes (mes 3+)
- Cena/almuerzo con tus top 10 clientes
- Cada uno trae 1 amigo dueño de barbería
- 20 personas, ambiente social, presentación de 10 min del producto
- Cierre típico: 3-5 nuevos clientes esa noche

## 📊 Métricas a trackear

| Métrica | Meta |
|---|---|
| % clientes que refieren al menos 1 | ≥30% en 90 días |
| % referidos que convierten | ≥40% |
| Tiempo promedio referral → registro | <7 días |
| % referidos que pagan después del trial | ≥70% |
| Cliente más prolífico del mes | __ refers |
| MRR atribuido a referrals | __ USD |

## ⚠️ Errores a evitar

1. **Programa demasiado complejo** (tiers infinitos, condiciones raras) → nadie lo entiende. Mantén simple.
2. **Recompensa solo al referidor** (no al referido) → conversión baja. SIEMPRE incentiva a ambos.
3. **No enviar reminder** al referidor cuando su referido todavía no convierte → se olvida. Recordatorio a los 7 días.
4. **No usar el momento de "wow"** → pides referrals cuando el cliente está frío. Pídelo después de un éxito.
5. **Pagar comisión en efectivo** (en RD esto se vuelve un lío contable). Pagar siempre como descuento en plataforma.

## 🔥 Tu primer mes

1. **Semana 2**: implementa MVP manual
2. **Semana 3**: lanza con tus 5-10 clientes actuales
3. **Semana 4**: añade al producto la pestaña "Refiere"
4. **Mes 2**: lanza el "Top 5 del mes" en IG
5. **Mes 3**: primer meet-up con clientes

Meta del mes 2: **5+ clientes vinieron por referral**.
Meta del mes 6: **30% del MRR nuevo viene de referrals**.
