# Script: Onboarding del cliente nuevo

> El onboarding es el momento más crítico. Un cliente bien onboardeado = retención alta + testimonio + referidos. Un mal onboarding = churn al mes 1.

## 🎯 Los 15 minutos del onboarding en sitio

### Minuto 0-2 — Setup

Mientras abres la laptop:
> "Listo, vamos en orden. Va a tomar 15 minutos. Te voy a hacer unas preguntas sobre tu negocio, conecto WhatsApp, te lo demuestro funcionando, y nos vamos. ¿OK?"

Necesitas:
- Laptop/tablet con DomiCita abierto en modo admin
- Acceso al teléfono del cliente
- Su Instagram (para etiquetar luego)

### Minuto 2-4 — Datos del negocio

Preguntas (sin form, en conversación):
1. "¿Cómo se llama tu barbería/salón exactamente?"
2. "¿Cuál es la dirección? (la calle donde estamos)"
3. "¿Cuántos barberos/estilistas trabajan aquí?"
4. "Hora de abrir y cerrar — lunes a sábado normal?"

Lo introduces en DomiCita admin.

### Minuto 4-8 — Servicios

> "Ahora los servicios. Dime los 3-5 que más vendes y sus precios."

Típico de barbería:
- Corte clásico - $400 RD - 30 min
- Fade - $500 RD - 45 min
- Barba - $300 RD - 20 min
- Corte + Barba - $700 RD - 60 min

**Importante**: NO le pongas 15 servicios. Empieza con 5. Después puede añadir más solo.

### Minuto 8-11 — Conectar WhatsApp

**Esta es la parte crítica**. El éxito del onboarding depende de esto.

> "Ahora viene lo importante: vamos a conectar tu WhatsApp. ¿Tienes WhatsApp Business o normal?"

- Si Business → adelante con Embedded Signup
- Si normal → "Te lo cambio a Business gratis en 2 min" (luego conectas)

Pasos en orden:
1. En DomiCita → Settings → WhatsApp → Conectar
2. Popup de Meta se abre
3. Cliente entra con su Facebook personal o de negocio
4. Selecciona Business Portfolio (o crea)
5. Selecciona WABA (o crea)
6. Selecciona número (el de su negocio)
7. Verificación OTP al celular del cliente
8. Vuelve a DomiCita y dice "Conectado ✅"

**Si algo falla**: tranquilo, persiste. Cliente nuevo es paciente la primera vez.

### Minuto 11-13 — Demo en vivo

Saca tu propio celular o uno extra.

> "OK, ya está conectado. Te lo voy a probar. Mira."

Desde tu celular, escribes al WhatsApp del cliente:
```
Klk
```

El bot responde con saludo personalizado:
```
¡Klk! Bienvenido a [Nombre Barbería]. Soy el asistente. ¿En qué te ayudo? Puedo agendarte cita, decirte servicios y precios, o consultarte tu próxima cita.
```

> "Listo. Cada cliente que te escribe ahora va a ser recibido así."

Continúa:
```
Quiero corte clásico mañana en la tarde
```

El bot muestra slots. Eliges uno. Confirma cita.

> "Mira: tu primera cita por DomiCita ya está en tu calendario. Vamos al dashboard."

Muéstrale la cita en su calendario en la app.

### Minuto 13-15 — Cierre

> "Listo. DomiCita está activo. Solo unas cositas más:"

1. **Notificaciones al dueño**:
   > "¿A qué WhatsApp quieres recibir las notificaciones cuando hay reserva nueva?"
   (Casi siempre es el mismo número, pero puede ser otro personal.)

2. **Recordatorios**:
   > "¿Activamos recordatorios automáticos 24h antes de cada cita? Te baja los no-shows."
   (Recomienda 24h y 2h.)

3. **Quiet hours**:
   > "¿Quieres que el bot evite mandar mensajes muy tarde o temprano?"
   (Recomienda 9 PM a 8 AM bloqueados.)

4. **Agenda real importada** (si tiene Google Calendar):
   > "¿Quieres conectar tu Google Calendar para que las citas aparezcan ahí también?"

### Minuto 15 — Foto + testimonial

> "Última cosa: ¿me das permiso para sacarte un video corto de 30 segundos para nuestras redes? Te ayuda a ti también con visibilidad."

Si dice sí:
- Lo grabas en su barbería
- Le haces 1-2 preguntas:
  - "¿Cuál es el problema más grande que tienes con WhatsApp?"
  - "Si DomiCita lo resuelve, ¿qué le dirías a otro barbero?"

Si dice no:
- "Sin problema. ¿Por lo menos una foto del bot funcionando en tu celular?"

## 📋 Checklist post-onboarding

Antes de salir de la barbería:
- [ ] Shop creado con datos correctos
- [ ] WhatsApp conectado
- [ ] 1 mensaje de prueba enviado y respondido
- [ ] 1 cita demo creada y visible en dashboard
- [ ] Reminders configurados
- [ ] Quiet hours configuradas
- [ ] Plan SOLO activado con 3 meses trial
- [ ] Cliente tiene acceso al dashboard (login)
- [ ] Tomaste video o foto

## 📲 Follow-up

### Inmediatamente al salir (5 min después)
WhatsApp al cliente:
```
Hola [nombre], gracias por confiar en DomiCita 🚀

Resumen rápido:
- Tu bot está activo
- Plan SOLO con 3 meses gratis hasta [fecha]
- Cualquier problema escríbeme aquí

Hoy en la noche te aviso si tu primer cliente real te escribió.
Saludos!
```

### A las 8 PM del mismo día
```
Hola [nombre]! Pequeño check: ¿algún cliente te escribió hoy?
```

Si dice sí:
```
Genial! ¿Cómo respondió el bot? Te paso a ver la conversación
desde mi lado.
```

Si dice no:
```
Tranquilo, los primeros días son de adaptación. Si quieres
te ayudo a pasarle el WhatsApp de tu negocio a 5 amigos para que
prueben el bot. Así ves cómo funciona en vivo.
```

### Día 2 (24h después)
```
Hola [nombre], 24h con DomiCita ✅
¿Cuántos clientes ha contactado?
¿Algo que mejoramos?
```

### Día 7
```
[Nombre], 1 semana con DomiCita 💪
Te paso tus números:
- Citas creadas: __
- Mensajes recibidos: __
- Tiempo ahorrado estimado: ___ horas

¿Te animas a darme un testimonio rápido para los que vienen?
```

### Día 14
**Pedir referral**:
```
Hola [nombre], llevas 2 semanas con DomiCita. 

Pregunta: ¿conoces 1-2 barberos/estilistas que les diría DomiCita
les sirve? Por cada uno que pruebe, te doy 50% de descuento el
siguiente mes.
```

### Día 30
Check de salud:
```
Hola [nombre], 1 mes con DomiCita 🎉

¿Cómo te ha ido?
¿Algún feature que te gustaría?

(Cualquier feedback me ayuda — somos un equipo chico construyendo
algo para barberos como tú.)
```

## 🚨 Señales de churn temprano (atención al día 7-14)

**Señal 1**: Cliente no abre el dashboard hace 5 días
→ WhatsApp: "¿Todo bien con DomiCita? ¿Algún problema?"

**Señal 2**: El bot no recibe mensajes hace 7 días
→ Algo está roto. Llama de inmediato.

**Señal 3**: Cliente respondió "no me ha funcionado mucho"
→ Visita en persona en 24h. Esto se arregla en sitio.

**Señal 4**: Cliente no responde tus mensajes 2 veces seguidas
→ Llamada directa, no WhatsApp.

## 🎯 Métricas clave del onboarding

| Métrica | Meta |
|---|---|
| Tiempo total | <20 min |
| % WhatsApp conectado mismo día | >95% |
| % con primera cita real en día 1 | >40% |
| % con primera cita real en día 7 | >85% |
| Testimonios obtenidos | >60% de clientes |
| Activación día 30 (>5 citas creadas) | >80% |

## ⚠️ Errores comunes en onboarding

1. **Cargar 20 servicios en lugar de 5** → confunde al bot
2. **No probar el bot en vivo** → cliente duda si funciona
3. **No configurar quiet hours** → cliente recibe queja a las 11 PM
4. **No tomar testimonio en el momento** → después es muy difícil
5. **Salir sin dejar follow-up agendado** → pierde momentum
6. **No conectar Google Calendar si lo tiene** → duplicación de agendas, frustración
