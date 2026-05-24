'use client';

import Link from "next/link";
import Image from "next/image";
import { useState, useRef, useEffect } from "react";
import PricingPlans from "@/components/ui/PricingPlans";
import HeroChatLoop from "@/components/landing/HeroChatLoop";
import FoundersBanner from "@/components/landing/FoundersBanner";
import {
  Scissors as BarberIcon,
  Calendar,
  Bot,
  CheckCircle2,
  ChevronDown,
  Sparkles,
  Palette as HybridIcon,
  Star,
  ArrowRight,
  TrendingUp,
  Clock,
  Users,
  Zap,
  MapPin,
  X,
  Menu,
  Brain,
  BarChart3,
  ListOrdered,
  BellRing,
  Mic,
  Shield,
  CreditCard,
  LayoutGrid,
} from "lucide-react";

/* ─── DATA ──────────────────────────────────────────── */
const faqs = [
  {
    question: "¿Cómo funciona exactamente?",
    answer: "Conectamos tu WhatsApp Business con DomiCita. Cuando un cliente escribe, el asistente responde de forma natural, entiende el lenguaje dominicano y agenda la cita en tu calendario en tiempo real. Tú recibes una notificación en tu celular y listo — el cliente está agendado sin que hayas movido un dedo."
  },
  {
    question: "¿Qué pasa si el cliente quiere hablar con una persona?",
    answer: "El bot lo detecta automáticamente. Si alguien dice 'quiero hablar con alguien' o muestra frustración, el bot le dice que un humano lo atenderá y te manda una alerta. Tú tomas el control de la conversación desde el dashboard con un clic. Cuando terminas, le devuelves el control al bot."
  },
  {
    question: "¿Entiende el español dominicano de verdad?",
    answer: 'Sí, y no es un truco de marketing. El bot reconoce: "ta disponible", "me puedo meter", "pa cuándo tienen", "cuánto cobran", "bro dame un fade", "taper con degradé". Puedes añadir tu propia jerga del negocio en la configuración.'
  },
  {
    question: "¿Tengo que tener el teléfono encendido siempre?",
    answer: "No. DomiCita corre en la nube — el chatbot sigue respondiendo aunque tu teléfono esté apagado, sin señal o en otro país. Los recordatorios también se envían solos. Tú solo abres la app cuando quieres revisar las citas."
  },
  {
    question: "¿Cómo funciona el sistema de membresías?",
    answer: "Creas un bono — por ejemplo '5 cortes por RD$2,000'. El cliente te paga directamente (efectivo, transferencia, como prefieras — DomiCita no toca el dinero). En el sistema le asignas el bono y cada vez que viene, descontamos 1 servicio automáticamente. Tú ves el saldo de cada cliente en tiempo real."
  },
  {
    question: "¿Puedo usarlo si tengo varios profesionales?",
    answer: "Sí. En el plan TEAM hasta 5 profesionales, en BUSINESS ilimitados. Cada profesional tiene su propio calendario — el bot asigna citas según disponibilidad real. Un cliente puede pedir 'que me atienda Pedro' y el bot lo gestiona solo. También puedes tener varias sucursales en el plan BUSINESS."
  },
  {
    question: "¿Cuánto cuesta realmente?",
    answer: "Directo: empiezas gratis. SOLO es $19/mes — menos de lo que cobras por 2 servicios. Sin contratos, sin comisiones por cita, sin cobros escondidos. Si cancelas, mantienes acceso hasta el fin del período pagado y tus datos no se borran."
  },
  {
    question: "¿Para qué tipo de negocios funciona?",
    answer: "Funciona para barberías, salones de belleza, y salones unisex/híbridos. El sistema se adapta al tipo de negocio desde el onboarding — terminología, servicios sugeridos, plantillas de WhatsApp y el flujo de conversación del bot cambian según tu nicho. Pronto añadiremos spas, centros de estética y estudios de tatuaje."
  }
];

const powerFeatures = [
  {
    icon: Brain,
    tag: 'Inteligencia Artificial',
    title: 'El chatbot más listo de tu negocio',
    description: 'Agenda citas, responde precios, maneja objeciones y entiende cómo habla tu cliente dominicano. No es un bot genérico — sabe el contexto completo de la conversación y se adapta a tu nicho (barbería, salón, unisex).',
    highlights: ['Entiende dominicano y se adapta al tono de tu negocio', 'Propone horarios reales según tu agenda', 'Responde precios y servicios en tiempo real', 'Horario del bot configurable: solo en horas de cierre, en horario laboral o personalizado'],
  },
  {
    icon: LayoutGrid,
    tag: 'Optimización de agenda',
    title: 'Llena tu día como Tetris',
    description: 'DomiCita no solo te dice qué horarios están libres — calcula cuáles llenan mejor tu día. Cuando un cliente pregunta "¿cuándo tienes?", el bot ofrece primero los horarios que se pegan a tus citas existentes y evita huecos muertos de 15 a 45 minutos (los que casi nunca se venden). Resultado: más sillas ocupadas con el mismo equipo.',
    highlights: ['Prioriza slots pegados a citas existentes para llenar bloques completos', 'Evita huecos huérfanos de 5-45 min que casi nunca se venden', 'Premia primera y última cita del día para arrancar y cerrar limpio', 'Hasta 20% más sillas ocupadas sin trabajar más horas'],
  },
  {
    icon: BellRing,
    tag: 'Recordatorios Inteligentes',
    title: 'Cero "se me olvidó"',
    description: 'Configura recordatorios automáticos: 24h antes, 6h antes, 2h antes, 1h antes. El sistema los envía solo — tú no tienes que recordar nada. Resultado: hasta 70% menos de no-shows.',
    highlights: ['Multi-ciclo: 24h, 6h, 2h, 1h antes', 'Alertas al dueño: nueva reserva, cancelación y cliente molesto', 'Resumen de agenda en tu WhatsApp personal cada mañana y noche', 'Sincronización Google Calendar bidireccional + feed ICS para Apple/Outlook'],
  },
  {
    icon: ListOrdered,
    tag: 'Cola de Walk-ins',
    title: 'Los que llegan sin cita, organizados',
    description: 'Gestiona la cola de walk-ins desde tu celular. El sistema calcula el tiempo de espera y le avisa al cliente por WhatsApp cuando le toca — sin que tengas que dejar lo que estás haciendo.',
    highlights: ['Cola visual en tiempo real', 'Aviso automático por WhatsApp ~15 min antes', 'Se integra con la agenda para cálculos exactos'],
  },
  {
    icon: Mic,
    tag: 'Notas de Voz',
    title: 'Hablan como hablan — audios y todo',
    description: 'Tus clientes mandan audios en WhatsApp y DomiCita los transcribe automáticamente en español dominicano. El bot entiende el audio como si fuera texto y responde igual.',
    highlights: ['Transcripción instantánea de audios de WhatsApp', 'Español dominicano: entiende acento y jerga local', 'Hasta 5 minutos de audio por mensaje'],
  },
  {
    icon: Shield,
    tag: 'Control Inteligente',
    title: 'El bot sabe cuándo ceder',
    description: 'Cuando un cliente está molesto o pide hablar con una persona, el bot lo detecta automáticamente y te pasa el control. Tú decides cuándo devolvérselo.',
    highlights: ['Detección automática de frustración y quejas', 'Notificación inmediata al dueño por WhatsApp', 'Control manual: toma o devuelve la conversación con un clic'],
  },
  {
    icon: CreditCard,
    tag: 'Membresías y Fidelidad',
    title: 'Dinero por adelantado, clientes que vuelven',
    description: 'Vende packs de servicios prepagados directamente — sin comisión. Y premia a tus clientes recurrentes automáticamente: el sistema lleva el conteo y avisa cuando les toca su recompensa.',
    highlights: ['Bonos prepagados: 0% comisión, cobras tú directo', 'Fidelidad automática: X visitas = servicio gratis', 'El cliente ve su saldo activo en cada cita'],
  },
  {
    icon: BarChart3,
    tag: 'Analíticas y Equipo',
    title: 'Sabes lo que ganas. Sabes quién lo genera.',
    description: 'Analíticas en tiempo real: ingresos por día, servicios más rentables, retención de clientes, métricas de WhatsApp. Y gestión completa de tu equipo con roles y calendarios individuales.',
    highlights: ['Revenue real basado en cobros, no estimaciones', 'Analíticas por profesional (plan TEAM+)', 'Multi-sucursal para negocios con varias ubicaciones'],
  },
  {
    icon: Calendar,
    tag: 'Calendarios Conectados',
    title: 'Tu agenda donde ya la tienes',
    description: 'Sincronización bidireccional con Google Calendar: lo que agenda el bot aparece en tu Google Calendar, y lo que bloqueas en Google bloquea el bot. También funciona con Apple y Outlook vía feed ICS.',
    highlights: ['Google Calendar bidireccional — push y pull en tiempo real', 'Feed ICS para Apple Calendar y Outlook sin instalar nada', 'Un calendario por profesional — sin conflictos de horario', 'Bloqueos de tiempo desde Google se reflejan en el bot al instante'],
  },
];

const niches = [
  { id: 'BARBERSHOP' as const, name: 'Barbería', icon: BarberIcon, description: 'Fades, cortes, barba y grooming masculino', stats: 'Hecho para barberos', popular: true },
  { id: 'BEAUTY_SALON' as const, name: 'Salón de belleza', icon: Sparkles, description: 'Cortes, tintes, tratamientos y styling', stats: 'Pensado para estilistas', popular: false },
  { id: 'HYBRID' as const, name: 'Salón unisex', icon: HybridIcon, description: 'Atendemos hombres, mujeres y niños', stats: 'Negocio mixto sin complicaciones', popular: false },
];

const benefits = [
  { icon: TrendingUp, title: '+35% más citas', description: 'Los negocios que usan DomiCita reportan un 35% más de reservas porque los clientes agendan cuando quieren — a las 11PM, un domingo, en cualquier momento.' },
  { icon: Clock, title: '15 horas libres a la semana', description: 'Deja de responder WhatsApps mientras atiendes. El bot maneja todo — citas, preguntas de precios, confirmaciones — 24/7 sin que tú muevas un dedo.' },
  { icon: Users, title: 'Hasta 70% menos no-shows', description: 'Recordatorios automáticos a las 24h, 6h, 2h y 1h antes. Los clientes confirman o cancelan — tu agenda nunca tiene sorpresas de último minuto.' },
  { icon: Zap, title: 'Operando hoy mismo', description: 'Onboarding en 5 pasos, menos de 5 minutos. Si tienes WhatsApp Business, el setup es un clic. Esa misma noche el bot ya está tomando reservas.' }
];

const testimonials = [
  { name: "Carlos Rodríguez", role: "Barbero / Dueño", business: "Barbería Elite", location: "Santo Domingo", content: "Antes perdía clientes porque no contestaba el WhatsApp cortando. Ahora el bot agenda solo y yo me concentro en los fades. Los clientes me dicen que es facilísimo.", rating: 5, initial: "C", photo: "/images/testimonial-carlos.webp" },
  { name: "Luis Méndez", role: "Propietario", business: "The Cut RD", location: "Punta Cana", content: "Tengo 3 barberos y la cola era un desastre — gente esperando sin saber cuánto faltaba. Con DomiCita les llega el aviso por WhatsApp y nadie se va. Llenamos más sillas.", rating: 5, initial: "L", photo: "/images/testimonial-luis.webp" },
  { name: "María González", role: "Fundadora", business: "Belleza Total", location: "Santiago", content: "Me levanto y ya tengo citas confirmadas de la noche anterior. Es como tener una recepcionista disponible las 24 horas, sin el costo ni los dolores de cabeza.", rating: 5, initial: "M", photo: "/images/testimonial-maria.webp" }
];

const stats = [
  { value: '99.9%', label: 'Uptime garantizado' },
  { value: '<5 min', label: 'Configuración inicial' },
  { value: '24/7', label: 'Chatbot siempre activo' },
  { value: '$0', label: 'Para empezar' },
];

/* ─── CHATBOT DEMO ──────────────────────────────────── */
const DEMO_LIMIT = 5; // mensajes mostrados en UI (el backend tiene su propio rate limit)

/* ─── ANTI-BOT CONTACT (footer) ─────────────────────── */
function FooterContact() {
  const [contact, setContact] = useState<{ email: string; phone: string; tel: string } | null>(null);
  useEffect(() => {
    // Decoded at runtime — bots that don't execute JS won't see real values
    // Defer to microtask to avoid setState-in-effect lint warning.
    queueMicrotask(() => {
      const e = ['hola', 'domicita.com'].join('@');
      const p = ['829', '873', '7273'].join('-');
      setContact({ email: e, phone: p, tel: '+1' + p.replace(/-/g, '') });
    });
  }, []);
  return (
    <div>
      <h4 className="text-sm font-semibold mb-3 text-white/80">Contacto</h4>
      <ul className="space-y-2">
        {contact ? (
          <>
            <li><a href={`mailto:${contact.email}`} className="text-sm text-white/40 hover:text-white/70 transition-colors duration-150">{contact.email}</a></li>
            <li><a href={`tel:${contact.tel}`} className="text-sm text-white/40 hover:text-white/70 transition-colors duration-150">{contact.phone}</a></li>
          </>
        ) : (
          <>
            <li><span className="text-sm text-white/40">Cargando...</span></li>
            <li><span className="text-sm text-white/40">Cargando...</span></li>
          </>
        )}
        <li><span className="text-sm text-white/40">Santo Domingo, RD</span></li>
      </ul>
    </div>
  );
}


/* ─── MAIN PAGE ─────────────────────────────────────── */
export default function Home() {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [openFaq, setOpenFaq] = useState<number | null>(null);
  const [dopRate, setDopRate] = useState<number | null>(null);

  useEffect(() => {
    fetch('/api/exchange-rate')
      .then(r => r.json())
      .then(d => { if (d.rate) setDopRate(d.rate); })
      .catch(() => setDopRate(60)); // fallback silencioso
  }, []);

  return (
    <div className="flex flex-col min-h-screen bg-white selection:bg-primary selection:text-white">

      {/* ─── FOUNDERS BANNER (top, urgent) ────────────── */}
      <FoundersBanner />

      {/* ─── HEADER ──────────────────────────────────── */}
      <header className="px-4 lg:px-8 h-14 flex items-center bg-white/95 backdrop-blur-lg sticky top-0 z-50 border-b border-gray-100/80">
        <div className="max-w-7xl mx-auto w-full flex items-center justify-between">
          <Link className="flex items-center gap-2 group" href="/">
            <Image
              src="/logo-icon.svg"
              alt="DomiCita logo"
              width={32}
              height={32}
              className="transition-transform duration-200 group-hover:scale-105"
              priority
            />
            <span className="text-base font-bold tracking-tight text-charcoal">DomiCita</span>
          </Link>

          <nav className="hidden md:flex items-center gap-6">
            {[
              { href: '#features', label: 'Dashboard' },
              { href: '#pricing', label: 'Planes' },
              { href: '#faq', label: 'FAQ' },
            ].map(({ href, label }) => (
              <Link key={href} className="text-sm font-medium text-gray-500 hover:text-charcoal transition-colors duration-150" href={href}>{label}</Link>
            ))}
          </nav>

          <div className="hidden md:flex items-center gap-2.5">
            <Link className="text-sm font-medium text-gray-600 hover:text-charcoal transition-colors px-3 py-1.5 rounded-lg hover:bg-gray-50" href="/login">Ingresar</Link>
            <Link href="/onboarding" className="btn-accent-luxury inline-flex h-8 items-center justify-center rounded-lg px-4 text-sm font-semibold">
              Probar 14 días gratis
              <ArrowRight className="ml-1.5 h-3.5 w-3.5" />
            </Link>
          </div>

          <button className="md:hidden p-2 text-gray-500 hover:text-charcoal" onClick={() => setMobileMenuOpen(!mobileMenuOpen)}>
            {mobileMenuOpen ? <X className="h-5 w-5" /> : <Menu className="h-5 w-5" />}
          </button>
        </div>
      </header>

      {mobileMenuOpen && (
        <div className="md:hidden fixed inset-0 z-40 bg-white/98 backdrop-blur-sm pt-14 px-6">
          <nav className="flex flex-col gap-1 pt-4">
            {[{ href: '#features', label: 'Dashboard' }, { href: '#pricing', label: 'Planes' }, { href: '#faq', label: 'FAQ' }].map(({ href, label }) => (
              <Link key={href} className="text-base font-medium text-gray-700 py-3 px-2 border-b border-gray-100" href={href} onClick={() => setMobileMenuOpen(false)}>{label}</Link>
            ))}
            <div className="flex flex-col gap-3 pt-6">
              <Link className="text-center py-3 text-sm font-medium text-gray-600 border border-gray-200 rounded-xl" href="/login" onClick={() => setMobileMenuOpen(false)}>Ingresar</Link>
              <Link href="/onboarding" className="btn-accent-luxury inline-flex h-12 items-center justify-center rounded-xl text-sm font-semibold" onClick={() => setMobileMenuOpen(false)}>Probar 14 días gratis</Link>
            </div>
          </nav>
        </div>
      )}

      <main className="flex-1">

        {/* ─── HERO ────────────────────────────────────── */}
        <section className="relative overflow-hidden bg-white pt-10 pb-12 md:pt-16 md:pb-20">
          <div className="absolute inset-0 bg-[linear-gradient(to_right,#e5e7eb28_1px,transparent_1px),linear-gradient(to_bottom,#e5e7eb28_1px,transparent_1px)] bg-[size:40px_40px]" />
          <div className="absolute top-0 right-0 w-[500px] h-[500px] bg-gradient-to-bl from-blue-50 via-transparent to-transparent opacity-50" />

          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 w-full relative z-10">
            <div className="grid lg:grid-cols-2 gap-8 lg:gap-12 items-center">

              {/* Left */}
              <div className="max-w-xl">
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/5 border border-primary/10 mb-4">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500 animate-pulse" />
                  <span className="text-xs font-semibold text-primary tracking-wide uppercase">Hecho en RD · Barberías · Salones · Unisex</span>
                </div>

                <h1 className="text-4xl sm:text-5xl lg:text-[54px] font-black tracking-tight text-charcoal leading-[1.08] mb-4">
                  Tu WhatsApp,
                  <span className="block text-gradient-primary">tu mejor recepcionista</span>
                </h1>

                <p className="text-lg text-gray-500 leading-relaxed mb-6 max-w-md">
                  Chatbot IA que habla dominicano, gestiona walk-ins, membresías, recordatorios y te manda alertas al celular. La recepcionista más completa que has tenido — y no cobra sueldo.
                </p>

                <div className="flex flex-col sm:flex-row gap-3 mb-7">
                  <Link href="/onboarding" className="btn-accent-luxury btn-shimmer inline-flex h-11 items-center justify-center rounded-xl px-6 text-sm font-bold group">
                    Probar 14 días gratis
                    <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-0.5 transition-transform duration-200" />
                  </Link>
                  <Link href="#features" className="inline-flex h-11 items-center justify-center rounded-xl border border-gray-200 bg-white px-6 text-sm font-semibold text-gray-700 hover:border-gray-300 hover:bg-gray-50 transition-all duration-200">
                    Ver el dashboard →
                  </Link>
                </div>

                <div className="flex items-center gap-5 pt-5 border-t border-gray-100">
                  <div className="flex items-center gap-2">
                    <div className="flex">{[...Array(5)].map((_, i) => <Star key={i} className="h-3.5 w-3.5 text-amber-400 fill-amber-400" />)}</div>
                    <span className="text-sm text-gray-500">Experiencia <span className="font-bold text-charcoal">5 estrellas</span></span>
                  </div>
                  <div className="w-px h-4 bg-gray-200" />
                  <span className="text-sm text-gray-500">Listo en <span className="font-bold text-charcoal">&lt;5 minutos</span></span>
                  <div className="w-px h-4 bg-gray-200" />
                  <span className="text-sm text-gray-500">Gratis para <span className="font-bold text-charcoal">empezar</span></span>
                </div>
              </div>

              {/* Right — animated WhatsApp showing 3 niche conversations on loop */}
              <div className="relative flex justify-center lg:justify-end items-center py-4 lg:py-8">
                {/* Glow background */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                  <div className="w-80 h-80 bg-primary/8 rounded-full blur-3xl" />
                </div>

                <div className="relative">
                  <HeroChatLoop />

                  {/* Floating badge — top right, anchored to phone */}
                  <div className="hidden sm:flex absolute -right-4 top-12 z-30 bg-white rounded-xl shadow-lg shadow-black/10 px-2.5 py-2 items-center gap-2 border border-gray-100/80">
                    <div className="w-6 h-6 bg-green-100 rounded-lg flex items-center justify-center shrink-0"><CheckCircle2 className="h-3 w-3 text-green-600" /></div>
                    <div><p className="text-[9px] text-gray-400 font-medium leading-none mb-0.5">Nueva cita</p><p className="text-xs font-bold text-charcoal leading-none">30 seg</p></div>
                  </div>

                  {/* Floating badge — bottom left */}
                  <div className="hidden sm:flex absolute -left-4 bottom-16 z-30 bg-white rounded-xl shadow-lg shadow-black/10 px-2.5 py-2 items-center gap-2 border border-gray-100/80">
                    <div className="w-6 h-6 bg-blue-100 rounded-lg flex items-center justify-center shrink-0"><Clock className="h-3 w-3 text-blue-600" /></div>
                    <div><p className="text-[9px] text-gray-400 font-medium leading-none mb-0.5">Tiempo ahorrado</p><p className="text-xs font-bold text-charcoal leading-none">15h/semana</p></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ─── TRUST BAR ────────────────────────────────── */}
        <section className="py-10 bg-gray-50 border-y border-gray-100">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid grid-cols-3 divide-x divide-gray-200">
              <div className="text-center px-4">
                <p className="text-2xl font-bold text-charcoal tracking-tight">RD 🇩🇴</p>
                <p className="text-xs text-gray-500 mt-1 font-medium">Hecho aquí, para aquí</p>
              </div>
              <div className="text-center px-4">
                <p className="text-2xl font-bold text-charcoal tracking-tight">24/7</p>
                <p className="text-xs text-gray-500 mt-1 font-medium">El bot no descansa</p>
              </div>
              <div className="text-center px-4">
                <p className="text-2xl font-bold text-charcoal tracking-tight">&lt; 5 min</p>
                <p className="text-xs text-gray-500 mt-1 font-medium">De cero a operando</p>
              </div>
            </div>
          </div>
        </section>

        {/* ─── NICHE SELECTOR ──────────────────────────── */}
        <section className="py-16 md:py-20 bg-gray-50 border-y border-gray-100">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-8">
              <h2 className="text-2xl md:text-3xl font-bold tracking-tight text-charcoal mb-2">¿Qué tipo de negocio tienes?</h2>
              <p className="text-sm text-gray-500">DomiCita se adapta a tu nicho. Elige el tuyo y empieza en menos de 5 minutos.</p>
            </div>
            <div className="grid md:grid-cols-3 gap-4 max-w-3xl mx-auto">
              {niches.map((niche) => {
                const Icon = niche.icon;
                return (
                  <div
                    key={niche.id}
                    className="group p-5 rounded-2xl border-2 border-gray-100 bg-white hover:border-primary/30 hover:shadow-lg hover:shadow-primary/8 transition-all duration-300 flex flex-col"
                  >
                    <div className="flex items-center gap-2 mb-3">
                      <div className="w-10 h-10 rounded-xl flex items-center justify-center bg-gray-100 group-hover:bg-primary transition-all duration-200">
                        <Icon className="h-5 w-5 text-gray-500 group-hover:text-white transition-colors duration-200" />
                      </div>
                      {niche.popular && <span className="text-[10px] font-bold uppercase tracking-wider text-white bg-accent px-2 py-0.5 rounded-full">Popular</span>}
                    </div>
                    <h3 className="text-base font-bold text-charcoal mb-1">{niche.name}</h3>
                    <p className="text-xs text-gray-500 mb-3 flex-1">{niche.description}</p>
                    <div className="flex items-center gap-1.5 text-xs font-semibold text-primary mb-4">
                      <CheckCircle2 className="h-3 w-3" />
                      <span>{niche.stats}</span>
                    </div>
                    <Link
                      href={`/onboarding?type=${niche.id}`}
                      className="inline-flex items-center justify-center gap-1.5 w-full h-9 px-4 rounded-lg bg-primary/5 text-primary text-xs font-bold hover:bg-primary hover:text-white transition-all duration-200 group/cta"
                    >
                      Empezar como {niche.name.toLowerCase()}
                      <ArrowRight className="h-3 w-3 group-hover/cta:translate-x-0.5 transition-transform duration-200" />
                    </Link>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* ─── POWER FEATURES ───────────────────────────── */}
        <section className="py-16 md:py-24 bg-white" id="features">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-12">
              <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/5 border border-primary/10 mb-4">
                <Sparkles className="h-3.5 w-3.5 text-primary" />
                <span className="text-xs font-semibold text-primary tracking-wide uppercase">Las herramientas de tu negocio</span>
              </div>
              <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-charcoal mb-3">
                Más que una agenda — es un sistema completo
              </h2>
              <p className="text-base text-gray-500 max-w-xl mx-auto">
                Ocho herramientas que trabajan juntas para que tu negocio genere más dinero con menos esfuerzo.
              </p>
            </div>

            <div className="grid md:grid-cols-2 gap-6">
              {powerFeatures.map((f) => {
                const Icon = f.icon;
                return (
                  <div key={f.title} className="group p-7 rounded-2xl bg-white border border-gray-100 hover:border-primary/20 hover:shadow-lg hover:shadow-primary/5 transition-all duration-300">
                    <div className="flex items-start gap-4 mb-5">
                      <div className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0 bg-primary/8 group-hover:bg-primary group-hover:scale-105 transition-all duration-300">
                        <Icon className="h-6 w-6 text-primary group-hover:text-white transition-colors duration-300" />
                      </div>
                      <div>
                        <span className="text-[10px] font-bold uppercase tracking-widest text-primary bg-primary/8 px-2 py-0.5 rounded-full">{f.tag}</span>
                        <h3 className="text-xl font-bold text-charcoal mt-1.5 leading-tight tracking-tight">{f.title}</h3>
                      </div>
                    </div>
                    <p className="text-sm text-gray-500 leading-relaxed mb-5">{f.description}</p>
                    <ul className="space-y-2.5">
                      {f.highlights.map(h => (
                        <li key={h} className="flex items-start gap-2.5 text-sm text-gray-600">
                          <CheckCircle2 className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                          {h}
                        </li>
                      ))}
                    </ul>
                  </div>
                );
              })}
            </div>
          </div>
        </section>

        {/* ─── BENEFITS + STATS ─────────────────────────── */}
        <section className="py-16 md:py-24 bg-gray-50" id="benefits">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="grid lg:grid-cols-2 gap-12 items-center">
              <div>
                <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/5 border border-primary/10 mb-4">
                  <span className="text-xs font-semibold text-primary tracking-wide uppercase">Lo que puedes esperar</span>
                </div>
                <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-charcoal mb-3">
                  Por qué los negocios en RD eligen DomiCita
                </h2>
                <p className="text-base text-gray-500 mb-8 leading-relaxed">
                  Como tener un asistente en tu negocio las 24 horas — nunca falla, nunca se ausenta y siempre representa bien tu marca.
                </p>
                <div className="grid sm:grid-cols-2 gap-6">
                  {benefits.map((b) => {
                    const Icon = b.icon;
                    return (
                      <div key={b.title} className="flex gap-3">
                        <div className="shrink-0 w-9 h-9 rounded-xl bg-primary/8 flex items-center justify-center mt-0.5">
                          <Icon className="h-4.5 w-4.5 text-primary" />
                        </div>
                        <div>
                          <h3 className="text-sm font-bold text-charcoal mb-1">{b.title}</h3>
                          <p className="text-sm text-gray-500 leading-relaxed">{b.description}</p>
                        </div>
                      </div>
                    );
                  })}
                </div>
              </div>

              <div className="relative">
                <div className="bg-gradient-to-br from-primary to-primary-dark rounded-3xl p-9 text-white">
                  <div className="grid grid-cols-2 gap-7">
                    {stats.map(s => (
                      <div key={s.label}>
                        <div className="text-4xl font-black mb-1">{s.value}</div>
                        <div className="text-xs font-medium text-white/60 uppercase tracking-wide">{s.label}</div>
                      </div>
                    ))}
                  </div>
                  <div className="mt-8 pt-7 border-t border-white/10">
                    <div className="flex items-center gap-3">
                      <div className="flex -space-x-2">
                        {['C', 'M', 'L', 'A'].map((l, i) => (
                          <div key={i} className="w-8 h-8 rounded-full bg-white/20 border-2 border-white/40 flex items-center justify-center text-xs font-bold text-white">{l}</div>
                        ))}
                      </div>
                      <p className="text-sm text-white/70">Meta: 1,000 negocios en RD para 2026</p>
                    </div>
                  </div>
                </div>
                <div className="absolute -bottom-5 -right-5 bg-white rounded-2xl shadow-xl shadow-black/10 p-4 border border-gray-100">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 bg-green-100 rounded-lg flex items-center justify-center"><TrendingUp className="h-4 w-4 text-green-600" /></div>
                    <div><p className="text-xs text-gray-400 leading-none mb-0.5">Citas agendadas</p><p className="text-sm font-black text-charcoal leading-none">+35% promedio</p></div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </section>

        {/* ─── TESTIMONIALS ─────────────────────────────── */}
        <section className="py-16 md:py-24 bg-white" id="testimonials">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-10">
              <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-charcoal mb-2">Experiencias que transforman negocios</h2>
              <p className="text-base text-gray-500">Así es como DomiCita cambia el día a día de barberías, salones y unisex en RD</p>
            </div>
            <div className="grid md:grid-cols-3 gap-5">
              {testimonials.map((t) => (
                <div key={t.name} className="p-6 rounded-2xl bg-white border border-gray-100 shadow-sm hover:shadow-md transition-shadow duration-300 flex flex-col">
                  <div className="flex gap-0.5 mb-4">{[...Array(t.rating)].map((_, i) => <Star key={i} className="h-3.5 w-3.5 text-amber-400 fill-amber-400" />)}</div>
                  <p className="text-sm text-gray-600 leading-relaxed flex-1 mb-5">"{t.content}"</p>
                  <div className="flex items-center gap-3 pt-4 border-t border-gray-100">
                    <div className="w-10 h-10 rounded-full overflow-hidden shrink-0 bg-primary/10 flex items-center justify-center">
                      <Image src={t.photo} alt={t.name} width={40} height={40} className="object-cover w-full h-full" />
                    </div>
                    <div>
                      <p className="text-sm font-bold text-charcoal leading-none">{t.name}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{t.role}, {t.business}</p>
                      <div className="flex items-center gap-1 text-xs text-gray-400 mt-0.5"><MapPin className="h-3 w-3" />{t.location}</div>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ─── PRICING ──────────────────────────────────── */}
        <section className="py-16 md:py-24 bg-gray-50" id="pricing">
          <div className="max-w-5xl mx-auto px-4 sm:px-6 lg:px-8">
            <div className="text-center mb-10">
              <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-charcoal mb-2">Planes claros, sin sorpresas</h2>
              <p className="text-base text-gray-500">14 días de prueba en todos los planes. Sin tarjeta, sin contratos.</p>
            </div>
            <PricingPlans mode="landing" dopRate={dopRate} showDop={true} />
          </div>
        </section>

        {/* ─── FAQ ──────────────────────────────────────── */}
        <section className="py-16 md:py-24 bg-white" id="faq">
          <div className="max-w-2xl mx-auto px-4 sm:px-6">
            <div className="text-center mb-10">
              <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-charcoal mb-2">Preguntas frecuentes</h2>
              <p className="text-base text-gray-500">Todo lo que necesitas saber antes de empezar</p>
            </div>
            <div className="space-y-2">
              {faqs.map((faq, i) => (
                <div key={i} className="bg-white rounded-xl border border-gray-100 overflow-hidden">
                  <button className="w-full px-5 py-4 text-left flex items-center justify-between gap-4 hover:bg-gray-50/50 transition-colors duration-150" onClick={() => setOpenFaq(openFaq === i ? null : i)}>
                    <span className="text-sm font-semibold text-charcoal">{faq.question}</span>
                    <ChevronDown className={`h-4 w-4 text-gray-400 shrink-0 transition-transform duration-200 ${openFaq === i ? 'rotate-180' : ''}`} />
                  </button>
                  {openFaq === i && (
                    <div className="px-5 pb-4 text-sm text-gray-500 leading-relaxed border-t border-gray-50"><div className="pt-3">{faq.answer}</div></div>
                  )}
                </div>
              ))}
            </div>
          </div>
        </section>

        {/* ─── CTA FINAL ────────────────────────────────── */}
        <section className="py-16 md:py-24 bg-primary relative overflow-hidden">
          <Image
            src="/images/cta-bg.webp"
            alt=""
            fill
            className="object-cover opacity-15 mix-blend-luminosity"
            sizes="100vw"
            aria-hidden="true"
          />
          <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top_right,rgba(255,255,255,0.06)_0%,transparent_60%)]" />
          <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:40px_40px]" />
          <div className="max-w-3xl mx-auto px-4 sm:px-6 text-center relative z-10">
            <h2 className="text-3xl md:text-4xl lg:text-5xl font-bold tracking-tight text-white mb-3 leading-tight">Tu negocio merece operar al máximo</h2>
            <p className="text-base text-white/60 mb-8 max-w-xl mx-auto leading-relaxed">
              Chatbot que habla dominicano, walk-ins organizados, membresías prepagadas, recordatorios multi-ciclo, notas de voz, alertas al dueño y analíticas en tiempo real — todo desde el WhatsApp que ya usas. Pruébalo 14 días sin tarjeta.
            </p>
            <div className="flex flex-col sm:flex-row items-center justify-center gap-3 mb-6">
              <Link href="/onboarding" className="inline-flex h-11 px-7 items-center justify-center bg-white text-primary rounded-xl text-sm font-bold hover:bg-gray-50 transition-colors duration-200 group">
                Probar 14 días gratis
                <ArrowRight className="ml-2 h-4 w-4 group-hover:translate-x-0.5 transition-transform duration-200" />
              </Link>
              <Link href="#features" className="inline-flex h-11 px-7 items-center justify-center border border-white/20 text-white/80 rounded-xl text-sm font-semibold hover:border-white/30 hover:text-white hover:bg-white/5 transition-all duration-200">
                Ver el dashboard
              </Link>
            </div>
            <p className="text-xs text-white/35 tracking-wide">Sin tarjeta de crédito · Configuración en menos de 5 minutos · Cancela cuando quieras</p>
          </div>
        </section>
      </main>

      {/* ─── FOOTER ───────────────────────────────────── */}
      <footer className="bg-charcoal text-white py-12">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="grid md:grid-cols-4 gap-8 mb-8">
            <div className="md:col-span-1">
              <div className="flex items-center gap-2 mb-4">
                <Image src="/logo-icon.svg" alt="DomiCita" width={28} height={28} />
                <span className="text-base font-bold">DomiCita</span>
              </div>
              <p className="text-white/40 text-sm leading-relaxed mb-3">Sistema de gestión de citas por WhatsApp para barberías, salones de belleza y unisex en República Dominicana.</p>
              <span className="text-white/30 text-sm">Hecho en RD 🇩🇴</span>
            </div>
            {[
              { title: 'Producto', links: [{ href: '#features', label: 'Características' }, { href: '#pricing', label: 'Planes' }, { href: '#faq', label: 'FAQ' }, { href: '/login', label: 'Ingresar' }] },
              { title: 'Recursos', links: [{ href: '/guia', label: 'Guía de usuario' }, { href: '/terminos', label: 'Términos' }, { href: '/privacidad', label: 'Privacidad' }, { href: '/cookies', label: 'Cookies' }] },
            ].map(({ title, links }) => (
              <div key={title}>
                <h4 className="text-sm font-semibold mb-3 text-white/80">{title}</h4>
                <ul className="space-y-2">
                  {links.map(({ href, label }) => (
                    <li key={label}><Link href={href} className="text-sm text-white/40 hover:text-white/70 transition-colors duration-150">{label}</Link></li>
                  ))}
                </ul>
              </div>
            ))}
            <FooterContact />
          </div>
          <div className="pt-6 border-t border-white/8 flex flex-col md:flex-row items-center justify-between gap-3">
            <p className="text-xs text-white/30">© 2026 Rivera Digital Media S.R.L. Todos los derechos reservados.</p>
            <div className="flex gap-5">
              {[{ label: 'Términos', href: '/terminos' }, { label: 'Privacidad', href: '/privacidad' }, { label: 'Cookies', href: '/cookies' }].map(l => (
                <Link key={l.label} href={l.href} className="text-xs text-white/30 hover:text-white/60 transition-colors duration-150">{l.label}</Link>
              ))}
            </div>
          </div>
        </div>
      </footer>

      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: JSON.stringify({
        "@context": "https://schema.org",
        "@type": "SoftwareApplication",
        "name": "DomiCita",
        "applicationCategory": "BusinessApplication",
        "operatingSystem": "Web",
        "offers": { "@type": "Offer", "price": "0", "priceCurrency": "USD" },
        "aggregateRating": { "@type": "AggregateRating", "ratingValue": "5", "ratingCount": "3", "bestRating": "5", "worstRating": "1" },
        "description": "Sistema de gestión de citas por WhatsApp con IA para barberías, salones de belleza y salones unisex en República Dominicana."
      }).replace(/</g, '\\u003c') }} />
    </div>
  );
}
