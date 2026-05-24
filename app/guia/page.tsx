import Link from 'next/link';
import type { Metadata } from 'next';
import {
  Calendar, MessageSquare, Users, Settings, BarChart3, Clock, CreditCard,
  Bell, UserPlus, Scissors, Store, Smartphone, Sparkles, ListOrdered,
  Mic, ShieldCheck, Star, HelpCircle, Zap, Ticket,
  Bot, BellRing, CalendarCheck,
} from 'lucide-react';

export const metadata: Metadata = {
  title: 'Guía de Usuario | DomiCita',
  description: 'Aprende a usar DomiCita paso a paso — chatbot IA, WhatsApp Business, equipo, analíticas, membresías y más.',
};

function StepCard({ number, title, description, icon: Icon }: { number: number; title: string; description: string; icon: React.ElementType }) {
  return (
    <div className="flex gap-4 p-4 rounded-xl bg-white border border-gray-100 shadow-sm">
      <div className="flex-shrink-0 w-9 h-9 rounded-full bg-primary/10 text-primary flex items-center justify-center font-bold text-sm">
        {number}
      </div>
      <div className="flex-1">
        <div className="flex items-center gap-2 mb-1">
          <Icon className="h-4 w-4 text-primary" />
          <h3 className="font-semibold text-charcoal text-sm">{title}</h3>
        </div>
        <p className="text-gray-500 text-sm leading-relaxed">{description}</p>
      </div>
    </div>
  );
}

function FeatureSection({ id, title, icon: Icon, children }: { id: string; title: string; icon: React.ElementType; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-24">
      <div className="flex items-center gap-3 mb-4">
        <div className="w-10 h-10 rounded-xl bg-primary/10 flex items-center justify-center">
          <Icon className="h-5 w-5 text-primary" />
        </div>
        <h2 className="text-2xl font-bold tracking-tight text-charcoal">{title}</h2>
      </div>
      <div className="space-y-4 text-gray-600 leading-relaxed text-[15px]">
        {children}
      </div>
    </section>
  );
}

function Note({ tone, children }: { tone: 'info' | 'warning' | 'success'; children: React.ReactNode }) {
  const styles = {
    info: 'bg-primary/5 border-primary/15 text-primary',
    warning: 'bg-amber-50 border-amber-100 text-amber-800',
    success: 'bg-emerald-50 border-emerald-100 text-emerald-800',
  } as const;
  return (
    <div className={`border rounded-lg p-4 mt-4 text-sm ${styles[tone]}`}>
      {children}
    </div>
  );
}

export default function GuiaPage() {
  const sections = [
    { id: 'inicio', label: 'Primeros Pasos', icon: Store },
    { id: 'onboarding', label: 'Onboarding', icon: UserPlus },
    { id: 'whatsapp', label: 'WhatsApp Business', icon: MessageSquare },
    { id: 'horario-bot', label: 'Horario del Bot', icon: Clock },
    { id: 'plantillas', label: 'Plantillas', icon: ShieldCheck },
    { id: 'chatbot', label: 'Chatbot IA', icon: Sparkles },
    { id: 'bot-control', label: 'Control Bot/Humano', icon: Bot },
    { id: 'voz', label: 'Notas de Voz', icon: Mic },
    { id: 'servicios', label: 'Servicios', icon: Scissors },
    { id: 'calendario', label: 'Calendario', icon: Calendar },
    { id: 'calendar-sync', label: 'Google Calendar', icon: CalendarCheck },
    { id: 'recordatorios', label: 'Recordatorios', icon: Bell },
    { id: 'notificaciones-dueno', label: 'Alertas al Dueño', icon: BellRing },
    { id: 'walkins', label: 'Walk-ins', icon: ListOrdered },
    { id: 'clientes', label: 'Clientes', icon: Users },
    { id: 'equipo', label: 'Equipo', icon: UserPlus },
    { id: 'finanzas', label: 'Finanzas y Cobros', icon: CreditCard },
    { id: 'fidelidad', label: 'Fidelidad', icon: Star },
    { id: 'membresias', label: 'Membresías y Bonos', icon: Ticket },
    { id: 'analiticas', label: 'Analíticas', icon: BarChart3 },
    { id: 'planes', label: 'Planes', icon: Zap },
    { id: 'movil', label: 'Uso Móvil', icon: Smartphone },
    { id: 'faq', label: 'Preguntas frecuentes', icon: HelpCircle },
  ];

  return (
    <div className="min-h-screen bg-[#F5F7FA]">
      {/* Header */}
      <header className="bg-primary text-white py-8">
        <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
          <Link href="/" className="inline-flex items-center gap-2 mb-6 text-white/70 hover:text-white transition-colors text-sm">
            ← Volver al inicio
          </Link>
          <h1 className="text-3xl md:text-4xl font-bold tracking-tight">Guía de Usuario</h1>
          <p className="text-white/60 mt-2 max-w-xl">
            Todo lo que necesitas para sacar el máximo provecho a DomiCita — desde la primera cita hasta las analíticas avanzadas.
          </p>
        </div>
      </header>

      <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col lg:flex-row gap-8">

          {/* Sidebar Navigation */}
          <nav className="lg:w-60 flex-shrink-0">
            <div className="lg:sticky lg:top-8 bg-white rounded-xl border border-gray-100 p-4">
              <h3 className="text-[10px] font-bold text-gray-400 uppercase tracking-[0.2em] mb-3">Contenido</h3>
              <ul className="space-y-0.5">
                {sections.map(({ id, label, icon: SIcon }) => (
                  <li key={id}>
                    <a
                      href={`#${id}`}
                      className="flex items-center gap-2 px-2.5 py-1.5 text-sm text-gray-600 hover:text-primary hover:bg-primary/5 rounded-lg transition-colors"
                    >
                      <SIcon className="h-3.5 w-3.5 shrink-0" />
                      {label}
                    </a>
                  </li>
                ))}
              </ul>
            </div>
          </nav>

          {/* Main Content */}
          <main className="flex-1 space-y-12">

            <FeatureSection id="inicio" title="Primeros Pasos" icon={Store}>
              <p>
                Bienvenido a <strong>DomiCita</strong>, el sistema de gestión de citas por WhatsApp pensado para
                barberías, salones de belleza y negocios de servicios en República Dominicana.
              </p>
              <p>
                En menos de 5 minutos tendrás tu negocio configurado, tu WhatsApp Business conectado y el chatbot
                listo para tomar reservas automáticas mientras tú trabajas.
              </p>
              <div className="grid sm:grid-cols-2 gap-3 mt-4">
                <div className="bg-white rounded-xl p-4 border border-gray-100">
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Empieza gratis</p>
                  <p className="text-sm text-gray-600">El plan FREE no caduca. Puedes usarlo el tiempo que necesites antes de actualizar.</p>
                </div>
                <div className="bg-white rounded-xl p-4 border border-gray-100">
                  <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Sin contratos</p>
                  <p className="text-sm text-gray-600">Cancela cuando quieras. Tus datos se conservan en el plan FREE.</p>
                </div>
              </div>
            </FeatureSection>

            <FeatureSection id="onboarding" title="Configuración inicial (Onboarding)" icon={UserPlus}>
              <p>
                Cuando creas tu cuenta, DomiCita te guía por un asistente de 5 pasos para dejar tu negocio listo.
                Puedes pausar y continuar cuando quieras — los datos se guardan automáticamente.
              </p>
              <div className="space-y-3 mt-4">
                <StepCard number={1} title="Tipo de negocio" icon={Store}
                  description="Elige entre Barbería, Salón de Belleza o Híbrido. Esto adapta la terminología y los servicios sugeridos." />
                <StepCard number={2} title="Información del negocio" icon={Settings}
                  description="Nombre, dirección con autocompletado de Google Maps, teléfono y logotipo." />
                <StepCard number={3} title="Servicios" icon={Scissors}
                  description="Te sugerimos servicios típicos según tu nicho. Puedes seleccionarlos y editarlos en segundos." />
                <StepCard number={4} title="WhatsApp Business" icon={MessageSquare}
                  description="Conecta tu número con un solo clic vía Meta Embedded Signup. Es opcional — puedes hacerlo después desde Ajustes." />
                <StepCard number={5} title="Elige tu plan" icon={Zap}
                  description="Empieza en FREE o pasa directamente a SOLO/TEAM/BUSINESS si necesitas más capacidad." />
              </div>
              <Note tone="info">
                <strong>Si te bloqueas:</strong> puedes salir y volver al onboarding en cualquier momento — al iniciar
                sesión, si tu cuenta no tiene un negocio configurado, te llevará automáticamente al asistente.
              </Note>
            </FeatureSection>

            <FeatureSection id="whatsapp" title="Conexión con WhatsApp Business" icon={MessageSquare}>
              <p>
                DomiCita usa la <strong>API oficial de WhatsApp Business Cloud</strong> de Meta. Esto significa
                que tu negocio queda 100% verificado y los mensajes llegan directamente a tus clientes sin pasar
                por intermediarios.
              </p>

              <h3 className="font-semibold text-charcoal mt-4">Cómo conectar tu número</h3>
              <ol className="list-decimal pl-6 space-y-2">
                <li>Ve a <strong>Ajustes → WhatsApp</strong>.</li>
                <li>Pulsa <strong>"Vincular con Facebook"</strong> y se abrirá el registro oficial de Meta.</li>
                <li>Inicia sesión con tu cuenta de Facebook (la del responsable del negocio).</li>
                <li>Selecciona o crea un <strong>Portfolio comercial</strong> (Business Portfolio).</li>
                <li>Selecciona o crea una <strong>Cuenta de WhatsApp Business (WABA)</strong>.</li>
                <li>Verifica tu número con el código que llega por SMS o llamada.</li>
                <li>Listo — la ventana se cierra y DomiCita guarda la conexión.</li>
              </ol>

              <Note tone="info">
                DomiCita usa el <strong>modo Coexistencia de Meta</strong> — puedes seguir usando la app de WhatsApp
                Business normal en tu teléfono mientras el chatbot trabaja en paralelo. Los mensajes que tú envíes
                desde la app no los responde el bot automáticamente.
              </Note>

              <h3 className="font-semibold text-charcoal mt-4">¿Qué necesitas tener antes?</h3>
              <ul className="list-disc pl-6 space-y-2">
                <li>Una <strong>cuenta de Facebook</strong> (no Instagram) del responsable del negocio.</li>
                <li>Un <strong>número de teléfono</strong> que pueda recibir SMS o llamada para verificar.</li>
              </ul>

              <Note tone="success">
                <strong>¿No tienes cuenta de Facebook?</strong> Puedes crear una en facebook.com en 2 minutos.
                Solo se usa para autorizar la conexión — no necesitas tener página de Facebook ni nada más.
              </Note>
            </FeatureSection>

            <FeatureSection id="horario-bot" title="Horario del Bot" icon={Clock}>
              <p>
                Controla en qué momentos el chatbot responde automáticamente. Perfecto si prefieres que el bot
                solo trabaje cuando el negocio está cerrado, o al revés.
              </p>

              <h3 className="font-semibold text-charcoal mt-4">Modos disponibles</h3>
              <p>En <strong>Ajustes → WhatsApp → Horario del Bot</strong> puedes elegir:</p>
              <ul className="list-disc pl-6 space-y-2 mt-2">
                <li><strong>Siempre activo (por defecto):</strong> El bot responde las 24 horas, todos los días.</li>
                <li><strong>Solo en horas de negocio:</strong> El bot solo responde mientras tu negocio está abierto, según el horario que configuraste en Ajustes → Horario de Apertura.</li>
                <li><strong>Solo fuera de horas:</strong> El bot cubre la noche y los fines de semana — ideal si tú atiendes el WhatsApp durante el día.</li>
                <li><strong>Horario personalizado:</strong> Define ventanas exactas por día de la semana — por ejemplo, lunes a viernes de 8PM a 8AM, y todo el fin de semana.</li>
                <li><strong>Desactivado:</strong> El bot no responde automáticamente. Tú controlas todo manualmente.</li>
              </ul>

              <h3 className="font-semibold text-charcoal mt-4">Mensaje de cierre automático</h3>
              <p>
                En cada modo puedes configurar un mensaje que el bot envía cuando un cliente escribe fuera de
                su horario activo. Por ejemplo: <em>"Gracias por escribirnos, en este momento estamos cerrados.
                Te contactamos mañana a partir de las 8AM."</em>
              </p>

              <Note tone="success">
                <strong>Tip:</strong> si usas el modo "Solo fuera de horas", el bot y tú se turnan sin conflictos —
                tú atiendes de día y el bot cubre la noche. Nunca compiten.
              </Note>
            </FeatureSection>

            <FeatureSection id="plantillas" title="Plantillas de Mensajes" icon={ShieldCheck}>
              <p>
                WhatsApp Business exige que los mensajes que tu negocio inicia (recordatorios, confirmaciones,
                cancelaciones) usen <strong>plantillas pre-aprobadas por Meta</strong>. Esto evita el spam y garantiza
                que tus mensajes lleguen siempre al cliente.
              </p>

              <h3 className="font-semibold text-charcoal mt-4">Cómo funciona en DomiCita</h3>
              <ol className="list-decimal pl-6 space-y-2">
                <li>Al conectar tu WhatsApp, DomiCita crea automáticamente <strong>plantillas estándar</strong> personalizadas con el nombre de tu negocio.</li>
                <li>Las envía a Meta para aprobación. Las plantillas <strong>UTILITY</strong> (recordatorios, confirmaciones, alertas) suelen aprobarse en minutos.</li>
                <li>Una vez aprobadas, los recordatorios y notificaciones se envían solos.</li>
                <li>Puedes ver el estado en <strong>Ajustes → WhatsApp → Estado de Notificaciones</strong>.</li>
              </ol>

              <h3 className="font-semibold text-charcoal mt-4">Estados posibles</h3>
              <ul className="list-disc pl-6 space-y-2">
                <li><strong>Borrador:</strong> aún no se ha enviado a Meta. Pulsa <em>"Enviar a Meta para aprobación"</em>.</li>
                <li><strong>Pendiente:</strong> esperando que Meta la revise. Suele tardar minutos en UTILITY, hasta 24h en MARKETING.</li>
                <li><strong>Aprobada:</strong> lista para usarse. Los recordatorios automáticos ya funcionan.</li>
                <li><strong>Rechazada:</strong> Meta no la acepta. Pulsa <em>"Regenerar"</em> para reescribirla y volver a intentar.</li>
              </ul>

              <Note tone="warning">
                Las plantillas son específicas de cada cuenta de WhatsApp Business. Si cambias el nombre de tu negocio
                después de conectar WhatsApp, usa el botón <strong>"Regenerar"</strong> para que las plantillas se
                actualicen con el nombre nuevo.
              </Note>
            </FeatureSection>

            <FeatureSection id="chatbot" title="Chatbot IA" icon={Sparkles}>
              <p>
                El chatbot de DomiCita es la función estrella: tus clientes reservan, cancelan o consultan precios
                directamente desde WhatsApp y la conversación es <strong>natural en español dominicano</strong>.
              </p>

              <h3 className="font-semibold text-charcoal mt-4">Qué entiende el chatbot</h3>
              <p className="text-sm text-gray-600 mb-2">
                El bot se adapta a tu nicho. Estos son ejemplos según el tipo de negocio:
              </p>
              <ul className="list-disc pl-6 space-y-2">
                <li><strong>Barbería:</strong> "Bro, ta disponible mañana pa un fade?" / "Cuánto cobran por barba y corte?"</li>
                <li><strong>Salón de belleza:</strong> "Tienen hueco pa tinte el viernes?" / "Cuánto sale un brushing?"</li>
                <li><strong>Unisex:</strong> "Quiero cita pa mañana en la tarde" / "Mi hijo necesita un corte y yo un brushing"</li>
                <li>"Pa cuándo tienen?" → propone los próximos huecos reales de tu agenda</li>
                <li>"Quiero cancelar mi cita" → busca la cita activa y la cancela</li>
                <li>"Quiero reagendar para el sábado" → propone slots del sábado</li>
                <li>"Quiero con Pedro" → busca al profesional por nombre y lo pre-selecciona</li>
              </ul>

              <h3 className="font-semibold text-charcoal mt-4">Cómo funciona la reserva</h3>
              <ol className="list-decimal pl-6 space-y-2">
                <li>Cliente saluda → el bot lo reconoce y le da la bienvenida con el nombre del negocio.</li>
                <li>Pregunta qué servicio quiere → el bot le muestra tus servicios con precios.</li>
                <li>Pregunta cuándo → el bot consulta tu agenda <strong>en tiempo real</strong> y propone slots disponibles.</li>
                <li>Cliente elige hora → el bot crea la cita en tu calendario y le envía confirmación.</li>
                <li>Tú recibes una alerta en tu WhatsApp personal con los detalles de la nueva reserva.</li>
              </ol>

              <Note tone="success">
                <strong>El bot no inventa horarios.</strong> Solo propone slots que están realmente disponibles
                según tu calendario, walk-ins en cola y citas existentes.
              </Note>

              <h3 className="font-semibold text-charcoal mt-4">Cómo DomiCita llena tu agenda mejor que un humano</h3>
              <p>
                Cuando un cliente pregunta "¿qué hora tienes mañana?", la mayoría de los bots te listan los huecos
                en orden cronológico. DomiCita los <strong>reordena por valor para tu negocio</strong>: ofrece primero
                los horarios que llenan tu día como un Tetris, evitando huecos muertos que casi nunca se venden.
              </p>

              <p className="mt-3"><strong>Ejemplo real:</strong></p>
              <p>
                Tienes una cita a las 11:00 y un cliente te pregunta cuándo puedes mañana. Quedan libres: 9:00, 9:30,
                10:00 y 10:30.
              </p>
              <ul className="list-disc pl-6 space-y-2 mt-2">
                <li>Un bot normal ofrece <strong>9:00 primero</strong> (la más temprana).</li>
                <li>DomiCita ofrece <strong>10:30 primero</strong>: el cliente termina justo cuando empieza tu cita
                  de las 11:00. Cero tiempo muerto.</li>
              </ul>
              <p className="mt-3">
                Si aceptaras la cita de las 9:00, te quedaría un hueco de 30 minutos entre 10:00 y 11:00 — un hueco
                "huérfano" que casi nunca se vende. DomiCita lo evita activamente.
              </p>

              <h4 className="font-semibold text-charcoal mt-4">Qué tiene en cuenta el algoritmo</h4>
              <ul className="list-disc pl-6 space-y-2">
                <li><strong>Slots pegados a citas existentes:</strong> se priorizan para crear bloques continuos de trabajo.</li>
                <li><strong>Huecos de 5-45 minutos:</strong> se penalizan porque rara vez se llenan — son demasiado cortos para vender otro servicio.</li>
                <li><strong>Horas pico</strong> (mañana 9-11h, tarde 14-17h): bonus porque concentran demanda real.</li>
                <li><strong>Primera y última cita del día:</strong> bonus para arrancar y cerrar la jornada limpia, sin huecos al principio o al final.</li>
              </ul>

              <Note tone="info">
                <strong>¿La diferencia al final del mes?</strong> Hasta un 20% más sillas ocupadas con el mismo horario laboral.
                Sin que tengas que pensar en nada — el bot lo hace solo cada vez que alguien te escribe.
              </Note>

              <h3 className="font-semibold text-charcoal mt-4">Personalización del chatbot</h3>
              <p>En <strong>Ajustes → WhatsApp → Chatbot</strong> puedes configurar:</p>
              <ul className="list-disc pl-6 space-y-2 mt-2">
                <li><strong>Personalidad:</strong> formal, casual, o con tu propio estilo — defines cómo habla el bot.</li>
                <li><strong>Diccionario de jerga:</strong> añade las expresiones típicas de tus clientes. Si dicen "dame un taper" o "cero con degradé", el bot lo entiende.</li>
                <li><strong>Modelo de IA:</strong> elige el motor de inteligencia artificial que más te guste entre las opciones disponibles.</li>
              </ul>

              <h3 className="font-semibold text-charcoal mt-4">¿El cliente pide un profesional específico?</h3>
              <p>
                Si un cliente dice "quiero con Pedro" o "que me atienda María", el bot busca al barbero/estilista
                por nombre y pre-selecciona esa persona al crear la cita. Si el profesional no está disponible
                en el horario pedido, le avisa al cliente y propone alternativas.
              </p>
            </FeatureSection>

            <FeatureSection id="bot-control" title="Control Bot/Humano" icon={Bot}>
              <p>
                El chatbot detecta automáticamente cuándo un cliente está frustrado o pide hablar con una persona real.
                En ese momento pausa el bot, le informa al cliente, y te notifica para que tomes el control.
              </p>

              <h3 className="font-semibold text-charcoal mt-4">Cómo funciona</h3>
              <ol className="list-decimal pl-6 space-y-2">
                <li>El bot detecta señales de frustración — palabras como "pésimo", "asco", "no sirven", mensajes en mayúsculas, quejas repetidas — o peticiones directas como "quiero hablar con una persona".</li>
                <li>Automáticamente cede el control y le dice al cliente que un humano lo atenderá pronto.</li>
                <li>Recibes una alerta inmediata en tu WhatsApp personal con el número del cliente.</li>
                <li>Desde el perfil del cliente en el dashboard ves el widget <strong>"Control de conversación"</strong> — muestra si el bot está activo o si estás en modo humano.</li>
                <li>Cuando terminas de atender al cliente, pulsa <strong>"Devolver al bot"</strong> — el chatbot retoma la conversación automáticamente.</li>
              </ol>

              <h3 className="font-semibold text-charcoal mt-4">Toma manual de control</h3>
              <p>
                No tienes que esperar a que el cliente se queje. Desde cualquier perfil de cliente puedes pulsar
                <strong> "Tomar control"</strong> para responder tú mismo aunque el bot estuviera activo.
                El bot queda pausado 24 horas para esa conversación y luego se reactiva solo.
              </p>

              <Note tone="warning">
                Cuando estás en modo humano, el bot no responde nada. Recuerda pulsar <strong>"Devolver al bot"</strong>{' '}
                cuando termines para que el chatbot vuelva a funcionar en esa conversación.
              </Note>
            </FeatureSection>

            <FeatureSection id="voz" title="Notas de Voz" icon={Mic}>
              <p>
                Muchos clientes prefieren mandar audios en vez de escribir. DomiCita transcribe automáticamente
                las notas de voz a texto y las procesa con el chatbot — el cliente recibe respuesta como si hubiera escrito.
              </p>
              <ul className="list-disc pl-6 space-y-2 mt-3">
                <li>Soporta español dominicano con vocabulario y acento local.</li>
                <li>Funciona con mensajes de hasta 5 minutos de duración.</li>
                <li>El cliente recibe respuesta del bot exactamente igual que si hubiera escrito el texto.</li>
                <li>Disponible en todos los planes sin coste adicional.</li>
              </ul>
            </FeatureSection>

            <FeatureSection id="servicios" title="Gestión de Servicios" icon={Scissors}>
              <p>
                En la sección <strong>Servicios</strong> defines lo que tu negocio ofrece. Cada servicio tiene:
              </p>
              <ul className="list-disc pl-6 space-y-2">
                <li><strong>Nombre:</strong> tal como lo verá tu cliente en WhatsApp (ej: "Corte clásico", "Tinte completo").</li>
                <li><strong>Precio:</strong> en pesos dominicanos (RD$). El cliente lo ve en la conversación.</li>
                <li><strong>Duración:</strong> 15, 30, 45, 60, 90 o 120 minutos. Define los bloques del calendario.</li>
                <li><strong>Categoría/Tipo:</strong> ayuda al chatbot a entender qué servicios ofrecer ante cada consulta.</li>
              </ul>
              <Note tone="info">
                <strong>Tip salones:</strong> servicios largos como tintes o alisados deben tener su duración real
                — así el sistema no permite reservar dos citas que se solapan.
              </Note>
            </FeatureSection>

            <FeatureSection id="calendario" title="Calendario y Disponibilidad" icon={Calendar}>
              <p>
                El <strong>Calendario</strong> es el centro de operaciones. Aquí ves todas las citas, las creas
                manualmente o desde WhatsApp, y gestionas su estado.
              </p>
              <h3 className="font-semibold text-charcoal mt-4">Disponibilidad</h3>
              <p>
                En <strong>Disponibilidad</strong> defines tus horarios de trabajo por día de la semana, descansos,
                vacaciones y bloqueos puntuales. El chatbot solo propone slots que respetan estas reglas.
              </p>
              <h3 className="font-semibold text-charcoal mt-4">Estados de cita</h3>
              <ul className="list-disc pl-6 space-y-2">
                <li><strong>Pendiente:</strong> recién creada, esperando confirmación.</li>
                <li><strong>Confirmada:</strong> el cliente confirmó (manualmente o respondiendo SI al recordatorio).</li>
                <li><strong>Completada:</strong> el servicio se realizó.</li>
                <li><strong>Cancelada:</strong> cancelada por el cliente o el negocio.</li>
                <li><strong>No-Show:</strong> el cliente no se presentó. Importante para tus métricas de ausencias.</li>
              </ul>
              <Note tone="info">
                Para sincronizar tu agenda con Google Calendar o Apple Calendar, consulta la sección{' '}
                <strong>Sincronización Google Calendar</strong> más abajo.
              </Note>
            </FeatureSection>

            <FeatureSection id="calendar-sync" title="Sincronización Google Calendar" icon={CalendarCheck}>
              <p>
                Conecta DomiCita con tu Google Calendar para ver todas tus citas en tu aplicación preferida —
                iPhone Calendar, Android Calendar, Outlook o Google Calendar en tu computadora.
              </p>

              <h3 className="font-semibold text-charcoal mt-4">Cómo conectar Google Calendar</h3>
              <ol className="list-decimal pl-6 space-y-2">
                <li>Ve a <strong>Ajustes → Calendarios → Google Calendar</strong>.</li>
                <li>Pulsa <strong>"Conectar con Google"</strong> e inicia sesión con tu cuenta de Google.</li>
                <li>Elige la dirección de sincronización:
                  <ul className="list-disc pl-6 mt-1 space-y-1">
                    <li><strong>Solo subir (Push):</strong> las citas de DomiCita aparecen en tu Google Calendar.</li>
                    <li><strong>Solo bajar (Pull):</strong> los eventos de Google Calendar bloquean tiempo en DomiCita.</li>
                    <li><strong>Bidireccional:</strong> ambas direcciones al mismo tiempo — la opción más completa.</li>
                  </ul>
                </li>
                <li>Listo — las citas nuevas se sincronizan automáticamente.</li>
              </ol>

              <h3 className="font-semibold text-charcoal mt-4">Feed ICS (Apple Calendar, Outlook, Android)</h3>
              <p>
                Si no usas Google Calendar, puedes suscribirte al <strong>feed ICS</strong> de tu agenda — un enlace
                universal compatible con cualquier aplicación de calendario. Ve a <strong>Ajustes → Calendarios → Feed ICS</strong>{' '}
                y copia el enlace para pegarlo en tu app preferida.
              </p>

              <Note tone="info">
                Las citas nuevas de DomiCita se sincronizan con Google Calendar en tiempo real. Los cambios de
                Google Calendar hacia DomiCita se procesan cuando llega una nueva reserva.
              </Note>
            </FeatureSection>

            <FeatureSection id="recordatorios" title="Recordatorios Automáticos" icon={Bell}>
              <p>
                Los recordatorios automáticos reducen los no-shows hasta un <strong>70%</strong>. DomiCita
                envía mensajes de WhatsApp a tus clientes antes de cada cita usando las plantillas aprobadas.
              </p>

              <h3 className="font-semibold text-charcoal mt-4">Ciclos disponibles</h3>
              <ul className="list-disc pl-6 space-y-2">
                <li><strong>24 horas antes:</strong> recordatorio principal con opción de confirmar o cancelar.</li>
                <li><strong>6 horas antes:</strong> seguimiento intermedio.</li>
                <li><strong>2 horas antes:</strong> recordatorio con tiempo de viaje en mente.</li>
                <li><strong>1 hora antes:</strong> aviso final justo antes de la cita.</li>
              </ul>
              <p className="mt-3">
                Configura cuáles activar en <strong>Ajustes → Recordatorios</strong>. Recomendamos al menos
                el de 24 horas y el de 2 horas como combinación equilibrada.
              </p>

              <Note tone="info">
                Los recordatorios solo se envían si las plantillas correspondientes están <strong>aprobadas por Meta</strong>.
                Revisa el estado en Ajustes → Estado de Notificaciones.
              </Note>
            </FeatureSection>

            <FeatureSection id="notificaciones-dueno" title="Alertas al Dueño" icon={BellRing}>
              <p>
                Recibe notificaciones instantáneas en <strong>tu WhatsApp personal</strong> (no el del negocio)
                cada vez que ocurre algo importante. Sin tener que estar mirando el dashboard todo el tiempo.
              </p>

              <h3 className="font-semibold text-charcoal mt-4">Cómo configurar</h3>
              <p>
                Ve a <strong>Ajustes → Negocio → "Teléfono para notificaciones"</strong>. Ingresa tu número
                personal en formato +1 809 XXX XXXX. Ese número recibirá todas las alertas.
              </p>

              <h3 className="font-semibold text-charcoal mt-4">Tipos de alertas</h3>
              <ul className="list-disc pl-6 space-y-2 mt-2">
                <li><strong>Nueva reserva:</strong> cada vez que el bot agenda una cita — cliente, servicio, fecha, hora y profesional asignado.</li>
                <li><strong>Cancelación:</strong> cuando un cliente cancela, recibes los detalles de inmediato.</li>
                <li><strong>Cliente molesto:</strong> si el bot detecta frustración y pausa la conversación, recibes el número del cliente para contactarlo tú directamente.</li>
                <li><strong>Resumen de mañana:</strong> 15 minutos antes de que abra tu negocio — cuántas citas tienes hoy, a qué hora empieza la primera y termina la última.</li>
                <li><strong>Cierre del día:</strong> 15 minutos después de cerrar — citas completadas vs. totales, no-shows, clientes nuevos e ingresos del día.</li>
              </ul>

              <Note tone="info">
                Los resúmenes de mañana y cierre solo se envían en días que tienes citas. Si no hay citas ese día,
                no recibes el resumen (para no generarte notificaciones innecesarias).
              </Note>
            </FeatureSection>

            <FeatureSection id="walkins" title="Cola del Día (Walk-ins)" icon={ListOrdered}>
              <p>
                Para clientes que llegan sin cita previa, la <strong>Cola del Día</strong> los organiza en orden
                de llegada con tiempo estimado de espera.
              </p>
              <ul className="list-disc pl-6 space-y-2 mt-3">
                <li><strong>Agregar:</strong> pulsa "Llegó un cliente", ingresa nombre, número y servicio deseado.</li>
                <li><strong>Cola visual:</strong> los clientes aparecen en orden con minutos de espera estimados.</li>
                <li><strong>Aviso por WhatsApp:</strong> el cliente recibe automáticamente un mensaje cuando se acerca su turno (~15 minutos antes).</li>
                <li><strong>Estados:</strong> Esperando → Atendiendo → Completado.</li>
              </ul>
              <p>
                El sistema considera tanto los walk-ins como las citas agendadas para calcular la disponibilidad
                real — así el chatbot no propone slots que en realidad están ocupados por la cola.
              </p>
            </FeatureSection>

            <FeatureSection id="clientes" title="Gestión de Clientes" icon={Users}>
              <p>
                Cada cliente que reserva, ya sea por WhatsApp o manualmente, queda guardado automáticamente.
                En <strong>Clientes</strong> tienes:
              </p>
              <ul className="list-disc pl-6 space-y-2 mt-3">
                <li>Historial completo de citas (pasadas y próximas).</li>
                <li>Datos de contacto (nombre, WhatsApp, email opcional).</li>
                <li>Frecuencia de visitas y servicios preferidos.</li>
                <li>Número de no-shows acumulados.</li>
                <li>Saldo de deuda pendiente (si alguna cita quedó como "Fía").</li>
                <li>Acción de <strong>"Reactivar"</strong>: enviar un mensaje a clientes que no han venido en X días.</li>
              </ul>
            </FeatureSection>

            <FeatureSection id="equipo" title="Gestión de Equipo" icon={UserPlus}>
              <p>
                Si tienes varios profesionales, en <strong>Equipo</strong> los gestionas. Disponible desde el
                plan TEAM en adelante.
              </p>
              <ul className="list-disc pl-6 space-y-2 mt-3">
                <li><strong>Invitar:</strong> envía invitación por email a cada profesional — recibirán un link para registrarse.</li>
                <li><strong>Roles:</strong> Administrador (gestiona todo), Profesional (ve y gestiona solo sus citas), Líder de equipo (gestiona el equipo sin acceso a finanzas).</li>
                <li><strong>Calendario individual:</strong> cada profesional tiene su propia agenda visible.</li>
                <li><strong>Asignación al reservar:</strong> el cliente puede pedir un profesional por nombre o dejarlo en automático.</li>
              </ul>
              <p className="mt-3 text-sm text-gray-500">
                <strong>Límites:</strong> TEAM permite hasta 5 profesionales. BUSINESS es ilimitado y soporta
                múltiples sucursales con equipos independientes.
              </p>
            </FeatureSection>

            <FeatureSection id="finanzas" title="Finanzas y Cobros" icon={CreditCard}>
              <p>
                Lleva el control financiero del día sin salir de DomiCita. Cada cita completada puede registrar
                su cobro en segundos.
              </p>
              <h3 className="font-semibold text-charcoal mt-4">Registrar un cobro</h3>
              <ol className="list-decimal pl-6 space-y-2">
                <li>Desde la cita completada, pulsa <strong>"Marcar Cobrado"</strong>.</li>
                <li>El monto se pre-llena con el precio del servicio (puedes modificarlo si hay descuento o propina).</li>
                <li>Selecciona el método de pago:
                  <ul className="list-disc pl-6 mt-1 space-y-1">
                    <li><strong>Efectivo, Tarjeta, Transferencia:</strong> cobro inmediato.</li>
                    <li><strong>Membresía:</strong> descuenta un servicio del bono activo del cliente.</li>
                    <li><strong>Deuda (Fía):</strong> el cliente no paga hoy — el saldo se acumula en su perfil y lo ves en Clientes.</li>
                  </ul>
                </li>
                <li>Listo — queda reflejado en el dashboard del día y en las analíticas.</li>
              </ol>
              <h3 className="font-semibold text-charcoal mt-4">Dashboard del día</h3>
              <p>
                En el panel principal ves total cobrado del día, citas pendientes de cobro y desglose por
                método de pago — útil para cuadrar caja al cierre.
              </p>
            </FeatureSection>

            <FeatureSection id="fidelidad" title="Programa de Fidelidad" icon={Star}>
              <p>
                Premia a tus clientes recurrentes automáticamente. Configura un programa simple en
                <strong> Ajustes → Fidelidad</strong>:
              </p>
              <ul className="list-disc pl-6 space-y-2 mt-3">
                <li><strong>Visitas requeridas:</strong> ej. "cada 5 visitas".</li>
                <li><strong>Recompensa:</strong> elige qué servicio se regala (ej. "Corte clásico gratis").</li>
                <li>El sistema lleva la cuenta automática — cuando el cliente completa las visitas requeridas, recibe una notificación por WhatsApp diciéndole que ganó su recompensa.</li>
                <li>La próxima vez que venga, marcas la cita con el servicio de recompensa y el sistema lo registra como canjeado.</li>
              </ul>
            </FeatureSection>

            <FeatureSection id="membresias" title="Membresías y Bonos" icon={Ticket}>
              <p>
                Vende <strong>packs prepagados</strong> a tus clientes para asegurar visitas y mejorar el flujo de caja.
                El cliente paga por adelantado, tú facturas hoy y aseguras que vuelva. Sin comisiones — el dinero va
                directo a ti. Disponible desde TEAM.
              </p>

              <h3 className="font-semibold text-charcoal mt-4">Cómo funciona</h3>
              <ol className="list-decimal pl-6 space-y-2">
                <li>En <strong>Membresías</strong> creas un plan: nombre, número de servicios incluidos, precio y validez (días o sin vencimiento).</li>
                <li>Opcionalmente eliges qué servicios cubre el bono. Si no eliges ninguno, cubre todos.</li>
                <li>Cuando un cliente compra el bono, le cobras tú directamente (efectivo, transferencia, app de banco — como prefieras).</li>
                <li>En DomiCita pulsas <strong>"Asignar bono"</strong>, eliges al cliente y el plan. Queda activo de inmediato.</li>
                <li>Al cobrar una cita de ese cliente, seleccionas <strong>"Membresía"</strong> como método de pago — se descuenta 1 servicio del saldo automáticamente.</li>
              </ol>

              <Note tone="info">
                <strong>DomiCita no procesa el cobro del bono</strong> — solo gestiona el saldo. Cero comisiones
                para ti y total flexibilidad. Cuando se acaban los servicios o expira la validez, el bono
                se marca automáticamente como agotado.
              </Note>

              <h3 className="font-semibold text-charcoal mt-4">Ideas de planes que funcionan</h3>
              <ul className="list-disc pl-6 space-y-2">
                <li><strong>Bono mensual:</strong> 4 cortes/mes con descuento — ideal para clientes recurrentes.</li>
                <li><strong>Pack ahorro:</strong> 5-10 cortes prepagados con 10-15% descuento sobre precio individual.</li>
                <li><strong>VIP barba+corte:</strong> 6 servicios combo con vencimiento a 90 días.</li>
                <li><strong>Pack pareja:</strong> bono compartido entre dos personas.</li>
              </ul>
            </FeatureSection>

            <FeatureSection id="analiticas" title="Analíticas" icon={BarChart3}>
              <p>
                En <strong>Analíticas</strong> ves las métricas clave de tu negocio en gráficas claras.
                Disponible desde el plan SOLO.
              </p>
              <ul className="list-disc pl-6 space-y-2 mt-3">
                <li><strong>Citas:</strong> totales, completadas, no-shows y tasa de cancelación.</li>
                <li><strong>Ingresos:</strong> revenue real basado en cobros registrados, por día/semana/mes. Desglose por método de pago.</li>
                <li><strong>Servicios:</strong> qué servicios generan más demanda y más ingresos.</li>
                <li><strong>Clientes:</strong> nuevos vs. recurrentes, retención, frecuencia media de visita.</li>
                <li><strong>Profesionales:</strong> citas e ingresos por cada miembro del equipo (plan TEAM+).</li>
                <li><strong>WhatsApp:</strong> mensajes enviados, conversaciones iniciadas por clientes, conversión a citas.</li>
              </ul>
            </FeatureSection>

            <FeatureSection id="planes" title="Planes y Facturación" icon={Zap}>
              <p>
                Tres planes en USD. Todos arrancan con <strong>14 días de prueba gratis</strong>, sin tarjeta y sin
                compromiso. Cancela cuando quieras.
              </p>
              <div className="mt-4 p-4 bg-emerald-50 border border-emerald-200 rounded-xl">
                <p className="text-emerald-800 font-bold text-sm">🎁 Promoción Fundadores</p>
                <p className="text-emerald-700 text-sm mt-1">
                  Los primeros 50 negocios que se registren reciben <strong>50% de descuento de por vida</strong> en
                  cualquier plan. Cupos limitados.
                </p>
              </div>
              <div className="grid sm:grid-cols-3 gap-4 mt-4">
                {[
                  { name: 'SOLO', price: '$19/mes', features: ['1 profesional', '1,000 mensajes WhatsApp/mes', 'Chatbot 24/7', 'Recordatorios automáticos', 'Cola de walk-ins', 'Analíticas básicas'] },
                  { name: 'TEAM', price: '$39/mes', features: ['Hasta 5 profesionales', '3,000 mensajes/mes', 'Todo lo del Solo', 'Gestión de equipo', 'Multi-servicio por cita', 'Soporte prioritario'] },
                  { name: 'BUSINESS', price: '$79/mes', features: ['Profesionales ilimitados', '10,000 mensajes/mes', 'Multi-sucursal', 'Bot personalizable', 'Acceso a API', 'Soporte dedicado'] },
                ].map(plan => (
                  <div key={plan.name} className="bg-white border border-gray-100 rounded-xl p-4">
                    <h3 className="font-bold text-charcoal">{plan.name}</h3>
                    <p className="text-primary font-bold text-lg">{plan.price}</p>
                    <ul className="mt-2 space-y-1">
                      {plan.features.map(f => (
                        <li key={f} className="text-gray-600 text-sm flex items-start gap-1.5">
                          <span className="text-emerald-500 mt-0.5">✓</span> {f}
                        </li>
                      ))}
                    </ul>
                  </div>
                ))}
              </div>
              <p className="mt-4">
                Al terminar la prueba se cobra el plan que elegiste. Si cancelas dentro de los 14 días no te cobramos
                nada. Cambia de plan o cancela en cualquier momento desde <strong>Planes</strong>; los pagos se
                procesan de forma segura por Stripe.
              </p>
              <Note tone="info">
                <strong>¿Necesitas más de 1.000 mensajes/mes?</strong> Contáctanos y te ayudamos a configurar
                un volumen mayor. El cobro adicional lo gestiona Meta directamente con tu cuenta de WhatsApp Business.
              </Note>
            </FeatureSection>

            <FeatureSection id="movil" title="Uso desde el Móvil" icon={Smartphone}>
              <p>
                DomiCita está diseñado para usarse desde el celular. La mayoría de barberos y estilistas
                gestionan sus citas directamente desde su smartphone, entre cliente y cliente.
              </p>
              <ul className="list-disc pl-6 space-y-2 mt-3">
                <li>El dashboard se adapta automáticamente a pantallas pequeñas.</li>
                <li>Menú lateral con botón de hamburguesa (≡) en la esquina superior izquierda.</li>
                <li>Vista de calendario en formato lista vertical optimizada para el día actual.</li>
                <li>Botones grandes para Completar, Cobrar, Cancelar — fáciles de tocar.</li>
              </ul>
              <Note tone="info">
                <strong>Tip:</strong> agrega DomiCita a la pantalla de inicio de tu celular para acceso rápido.
                En Chrome (Android): menú (⋮) → "Agregar a pantalla de inicio". En Safari (iPhone): botón compartir → "Agregar a inicio".
              </Note>
            </FeatureSection>

            <FeatureSection id="faq" title="Preguntas frecuentes" icon={HelpCircle}>
              <div className="space-y-4">
                <div>
                  <h3 className="font-semibold text-charcoal mb-1">¿Necesito una página de Facebook?</h3>
                  <p>No. Solo necesitas una cuenta personal de Facebook para autorizar la conexión con WhatsApp Business. No hace falta página, ni anuncios, ni nada más.</p>
                </div>
                <div>
                  <h3 className="font-semibold text-charcoal mb-1">¿Quién paga los mensajes de WhatsApp?</h3>
                  <p>Los primeros 1.000 mensajes/mes están incluidos en tu plan de DomiCita. Si superas ese volumen, el coste adicional lo cobra Meta directamente a tu cuenta de WhatsApp Business — DomiCita no añade ningún recargo.</p>
                </div>
                <div>
                  <h3 className="font-semibold text-charcoal mb-1">¿Qué pasa si Meta rechaza una plantilla?</h3>
                  <p>Pulsa <strong>"Regenerar"</strong> en Estado de Notificaciones — DomiCita borra la plantilla rechazada y la reescribe con un texto válido. Las UTILITY (recordatorios, confirmaciones) suelen aprobarse al primer intento.</p>
                </div>
                <div>
                  <h3 className="font-semibold text-charcoal mb-1">¿Puedo usar mi número personal de WhatsApp?</h3>
                  <p>Sí. Con el modo Coexistencia de Meta puedes usar el mismo número en la app de WhatsApp Business y en DomiCita al mismo tiempo. Los mensajes que respondes tú desde la app no los repite el bot.</p>
                </div>
                <div>
                  <h3 className="font-semibold text-charcoal mb-1">¿Mis datos están seguros?</h3>
                  <p>Sí. Usamos Supabase (Postgres cifrado), Stripe para pagos y Meta directamente para WhatsApp. No compartimos datos de tus clientes con terceros y puedes exportarlos o eliminarlos cuando quieras.</p>
                </div>
                <div>
                  <h3 className="font-semibold text-charcoal mb-1">¿Qué pasa si cancelo mi plan?</h3>
                  <p>Mantienes acceso completo hasta el final del período pagado. Después pasas automáticamente a FREE — tus citas, clientes y servicios se conservan, solo se desactivan las funciones premium.</p>
                </div>
                <div>
                  <h3 className="font-semibold text-charcoal mb-1">¿Funciona si tengo varias sucursales?</h3>
                  <p>Sí, en plan BUSINESS. Cada sucursal tiene su propio calendario, equipo y, si quieres, su propio número de WhatsApp.</p>
                </div>
                <div>
                  <h3 className="font-semibold text-charcoal mb-1">¿El bot puede hablar con varios clientes al mismo tiempo?</h3>
                  <p>Sí, sin límite. El bot maneja conversaciones paralelas de forma independiente — recuerda el contexto de cada cliente por separado sin mezclarlos.</p>
                </div>
                <div>
                  <h3 className="font-semibold text-charcoal mb-1">¿Puedo desactivar el bot para un cliente específico?</h3>
                  <p>Sí. Desde el perfil del cliente puedes tomar el control manualmente — el bot queda pausado para esa conversación por 24 horas y luego se reactiva automáticamente.</p>
                </div>
                <div>
                  <h3 className="font-semibold text-charcoal mb-1">¿DomiCita funciona si se va la luz o no tengo señal?</h3>
                  <p>Sí. DomiCita corre en la nube — el chatbot, los recordatorios y las notificaciones siguen funcionando aunque tu teléfono esté apagado o sin señal.</p>
                </div>
              </div>
            </FeatureSection>

            {/* Support Section */}
            <section className="bg-primary/5 rounded-2xl p-8 text-center mt-12">
              <h2 className="text-xl font-bold text-charcoal mb-2">¿Necesitas ayuda?</h2>
              <p className="text-gray-600 mb-4">
                Si tienes preguntas o necesitas asistencia personalizada, contáctanos.
              </p>
              <div className="flex flex-col sm:flex-row gap-3 justify-center">
                <a
                  href="mailto:hola@domicita.com"
                  className="inline-flex items-center justify-center px-6 py-3 bg-primary text-white rounded-xl font-semibold hover:bg-primary/90 transition-colors"
                >
                  Enviar correo
                </a>
                <a
                  href="https://wa.me/18298737273"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center justify-center px-6 py-3 bg-[#25D366] text-white rounded-xl font-semibold hover:bg-[#20BD5A] transition-colors"
                >
                  WhatsApp: 829-873-7273
                </a>
              </div>
            </section>

          </main>
        </div>
      </div>
    </div>
  );
}
