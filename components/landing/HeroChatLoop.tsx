'use client';

/**
 * HeroChatLoop
 *
 * Auto-playing WhatsApp mockup that rotates through 3 example conversations
 * (barbería, salón de belleza, unisex). Designed for the landing hero —
 * sells the product visually in 8-10 seconds.
 *
 * Design constraints honored:
 * - All 3 conversations are pre-rendered in HTML for SEO (Google indexes the
 *   text of every message).
 * - Animation is pure CSS + minimal JS state (no canvas, no video).
 * - Pauses when off-screen via IntersectionObserver (saves CPU).
 * - Respects `prefers-reduced-motion`: shows last conversation fully rendered
 *   without animation.
 * - No layout shift: fixed height containers, all bubbles allocated upfront.
 *
 * Built to drop in as the right-side panel of the hero. Phone width 360px.
 */

import { useEffect, useReducer, useRef, useState } from 'react';
import {
  Scissors as BarberIcon,
  Sparkles,
  Palette as HybridIcon,
  Phone,
  MoreVertical,
  ChevronLeft,
  MapPin,
} from 'lucide-react';

type MessageRole = 'bot' | 'client';
type MessageKind = 'text' | 'list' | 'buttons' | 'location';

interface ChatMessage {
  role: MessageRole;
  kind: MessageKind;
  /** Plain text content (used for `text`, list bodyText, buttons bodyText). */
  text: string;
  /** When `kind === 'list'`: button label + visible rows. */
  list?: { button: string; items: string[] };
  /** When `kind === 'buttons'`: up to 3 chip labels. */
  buttons?: string[];
  /** When `kind === 'location'`: name + address. */
  location?: { name: string; address: string };
}

interface Scenario {
  id: string;
  shopName: string;
  Icon: React.ComponentType<{ className?: string }>;
  accent: string; // tailwind text color for the avatar tint
  messages: ChatMessage[];
}

const SCENARIOS: Scenario[] = [
  {
    id: 'barberia',
    shopName: 'Barbería El Compa',
    Icon: BarberIcon,
    accent: 'text-amber-500',
    messages: [
      { role: 'client', kind: 'text', text: 'Klk, pa mañana quiero un fade' },
      { role: 'bot', kind: 'list', text: 'Dale. ¿Cuál de estos quieres agendar?', list: { button: 'Ver servicios', items: ['Fade + Barba · RD$800', 'Corte Clásico · RD$500', 'Solo Barba · RD$300'] } },
      { role: 'client', kind: 'text', text: 'Fade + Barba' },
      { role: 'bot', kind: 'buttons', text: 'Mañana tengo estos huecos:', buttons: ['10:00', '14:30', '17:00'] },
      { role: 'client', kind: 'text', text: '17:00' },
      { role: 'bot', kind: 'text', text: 'Listo, manín ✂️ Fade + Barba mañana a las 17:00 con Carlos. Te esperamos.' },
    ],
  },
  {
    id: 'salon',
    shopName: 'Salón Pétalos',
    Icon: Sparkles,
    accent: 'text-pink-500',
    messages: [
      { role: 'client', kind: 'text', text: 'Hola, quiero un tinte para el sábado' },
      { role: 'bot', kind: 'list', text: '¡Hola! ¿Cuál te interesa?', list: { button: 'Ver servicios', items: ['Mechas · RD$2,000', 'Tinte completo · RD$1,500', 'Balayage · RD$2,500'] } },
      { role: 'client', kind: 'text', text: 'Mechas' },
      { role: 'bot', kind: 'buttons', text: 'Sábado tengo dos opciones (toma 2h30):', buttons: ['9:00', '14:00'] },
      { role: 'client', kind: 'text', text: '14:00' },
      { role: 'bot', kind: 'text', text: 'Confirmado ✨ Tus mechas el sábado a las 14:00 con Marisol. Te llega recordatorio el día antes.' },
    ],
  },
  {
    id: 'unisex',
    shopName: 'Estilo RD',
    Icon: HybridIcon,
    accent: 'text-violet-500',
    messages: [
      { role: 'client', kind: 'text', text: 'Pal viernes: mi hijo corte y yo brushing' },
      { role: 'bot', kind: 'buttons', text: 'Perfecto. Tengo dos opciones para ambos:', buttons: ['Viernes 15:30', 'Viernes 17:00'] },
      { role: 'client', kind: 'text', text: 'Viernes 15:30' },
      { role: 'bot', kind: 'text', text: 'Listo 🙌 Viernes 15:30 — corte para tu hijo con Pedro + brushing para ti con Marisol. ¿Te paso la ubicación?' },
      { role: 'client', kind: 'text', text: 'Sí porfa' },
      { role: 'bot', kind: 'location', text: '', location: { name: 'Estilo RD', address: 'Av. Independencia 44, Santo Domingo' } },
    ],
  },
];

// ── Animation timing ────────────────────────────────────────────────────────
const MS_BETWEEN_MESSAGES = 1500;     // delay from one message to the next
const MS_TYPING_INDICATOR  = 800;     // how long "escribiendo..." shows before the bot message
const MS_BETWEEN_SCENARIOS = 2500;    // pause after a scenario finishes before next starts

// ── Reducer state ───────────────────────────────────────────────────────────
interface State {
  scenarioIndex: number;
  visibleCount: number;   // how many messages of current scenario are visible
  showTyping: boolean;    // is the typing indicator currently showing
  prefersReducedMotion: boolean;
}

type Action =
  | { type: 'NEXT_MESSAGE' }
  | { type: 'SHOW_TYPING' }
  | { type: 'HIDE_TYPING' }
  | { type: 'NEXT_SCENARIO' }
  | { type: 'SET_REDUCED_MOTION'; value: boolean };

function reducer(state: State, action: Action): State {
  switch (action.type) {
    case 'NEXT_MESSAGE':
      return { ...state, visibleCount: state.visibleCount + 1, showTyping: false };
    case 'SHOW_TYPING':
      return { ...state, showTyping: true };
    case 'HIDE_TYPING':
      return { ...state, showTyping: false };
    case 'NEXT_SCENARIO':
      return {
        ...state,
        scenarioIndex: (state.scenarioIndex + 1) % SCENARIOS.length,
        visibleCount: 0,
        showTyping: false,
      };
    case 'SET_REDUCED_MOTION':
      return { ...state, prefersReducedMotion: action.value };
    default:
      return state;
  }
}

export default function HeroChatLoop() {
  const [state, dispatch] = useReducer(reducer, {
    scenarioIndex: 0,
    visibleCount: 1, // first message visible immediately
    showTyping: false,
    prefersReducedMotion: false,
  });
  const [isVisible, setIsVisible] = useState(true);
  const containerRef = useRef<HTMLDivElement>(null);
  const scrollRef = useRef<HTMLDivElement>(null);

  // Respect reduced-motion
  useEffect(() => {
    if (typeof window === 'undefined') return;
    const mq = window.matchMedia('(prefers-reduced-motion: reduce)');
    dispatch({ type: 'SET_REDUCED_MOTION', value: mq.matches });
    const handler = (e: MediaQueryListEvent) => dispatch({ type: 'SET_REDUCED_MOTION', value: e.matches });
    mq.addEventListener('change', handler);
    return () => mq.removeEventListener('change', handler);
  }, []);

  // Pause when off-screen
  useEffect(() => {
    if (!containerRef.current) return;
    const observer = new IntersectionObserver(
      ([entry]) => setIsVisible(entry.isIntersecting),
      { threshold: 0.2 },
    );
    observer.observe(containerRef.current);
    return () => observer.disconnect();
  }, []);

  // Animation tick
  useEffect(() => {
    if (state.prefersReducedMotion || !isVisible) return;

    const scenario = SCENARIOS[state.scenarioIndex];
    const total = scenario.messages.length;

    // End of scenario: pause then advance
    if (state.visibleCount >= total) {
      const t = setTimeout(() => dispatch({ type: 'NEXT_SCENARIO' }), MS_BETWEEN_SCENARIOS);
      return () => clearTimeout(t);
    }

    const nextMessage = scenario.messages[state.visibleCount];

    // Bot messages get a typing indicator first
    if (nextMessage.role === 'bot') {
      const showTyping = setTimeout(() => dispatch({ type: 'SHOW_TYPING' }), MS_BETWEEN_MESSAGES - MS_TYPING_INDICATOR);
      const showMessage = setTimeout(() => dispatch({ type: 'NEXT_MESSAGE' }), MS_BETWEEN_MESSAGES);
      return () => {
        clearTimeout(showTyping);
        clearTimeout(showMessage);
      };
    }

    // Client messages just appear after the delay
    const t = setTimeout(() => dispatch({ type: 'NEXT_MESSAGE' }), MS_BETWEEN_MESSAGES);
    return () => clearTimeout(t);
  }, [state.visibleCount, state.scenarioIndex, state.prefersReducedMotion, isVisible]);

  // Auto-scroll inside the chat container so new messages stay in view
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [state.visibleCount, state.showTyping, state.scenarioIndex]);

  const scenario = SCENARIOS[state.scenarioIndex];
  // When reduced motion: show everything fully rendered
  const visibleCount = state.prefersReducedMotion ? scenario.messages.length : state.visibleCount;
  const visibleMessages = scenario.messages.slice(0, visibleCount);
  const ShopIcon = scenario.Icon;

  return (
    <div ref={containerRef} className="w-[360px] mx-auto">
      {/* SEO: pre-render ALL 3 conversations in hidden but readable HTML so
          search engines see every example. The visible animation reuses the
          same data. */}
      <div className="sr-only" aria-hidden="true">
        {SCENARIOS.map(s => (
          <div key={s.id}>
            <h3>{s.shopName}</h3>
            {s.messages.map((m, i) => (
              <p key={i}>
                <strong>{m.role === 'bot' ? s.shopName : 'Cliente'}:</strong> {m.text}
                {m.list && <span> Opciones: {m.list.items.join(', ')}</span>}
                {m.buttons && <span> Opciones: {m.buttons.join(', ')}</span>}
                {m.location && <span> Ubicación: {m.location.name}, {m.location.address}</span>}
              </p>
            ))}
          </div>
        ))}
      </div>

      {/* Phone shell */}
      <div className="bg-[#1a1a1a] rounded-[2.8rem] p-[3px] shadow-[0_32px_64px_-12px_rgba(0,0,0,0.5),0_0_0_1px_rgba(255,255,255,0.06)] ring-1 ring-white/5">
        <div className="bg-[#111] rounded-[2.6rem] overflow-hidden">

          {/* Status bar */}
          <div className="bg-[#075E54] px-5 pt-3 pb-0 flex items-center justify-between">
            <span className="text-white text-[11px] font-semibold tracking-tight">9:41</span>
            <div className="w-14 h-3.5 bg-black rounded-full" />
            <div className="flex items-center gap-1">
              <svg width="12" height="9" viewBox="0 0 12 9" fill="none" aria-hidden="true">
                <rect x="0" y="5" width="2" height="4" rx="0.5" fill="white" opacity="0.4"/>
                <rect x="3" y="3.5" width="2" height="5.5" rx="0.5" fill="white" opacity="0.6"/>
                <rect x="6" y="2" width="2" height="7" rx="0.5" fill="white" opacity="0.8"/>
                <rect x="9" y="0" width="2" height="9" rx="0.5" fill="white"/>
              </svg>
              <svg width="11" height="8" viewBox="0 0 11 8" fill="none" aria-hidden="true">
                <path d="M5.5 6.5a1 1 0 100 2 1 1 0 000-2z" fill="white"/>
                <path d="M2.8 4.2a3.8 3.8 0 015.4 0" stroke="white" strokeWidth="1.2" strokeLinecap="round" opacity="0.7"/>
                <path d="M0.5 2a6.5 6.5 0 0110 0" stroke="white" strokeWidth="1.2" strokeLinecap="round" opacity="0.4"/>
              </svg>
              <div className="flex items-center gap-[1px]">
                <div className="w-5 h-2.5 rounded-[2px] border border-white/70 relative p-[1.5px]">
                  <div className="h-full w-[75%] bg-white rounded-[1px]" />
                </div>
                <div className="w-[2px] h-[4px] bg-white/50 rounded-r-[1px]" />
              </div>
            </div>
          </div>

          {/* WhatsApp top bar — shop name changes per scenario with fade */}
          <div className="bg-[#075E54] px-3 pb-2.5 flex items-center justify-between">
            <div className="flex items-center gap-2 min-w-0">
              <ChevronLeft className="h-4 w-4 text-white shrink-0" strokeWidth={2.5} />
              <div
                key={scenario.id}
                className="w-8 h-8 rounded-full bg-[#128C7E] flex items-center justify-center shrink-0 ring-[1.5px] ring-white/20 animate-fade-in"
              >
                <ShopIcon className="h-[15px] w-[15px] text-white" />
              </div>
              <div className="min-w-0 animate-fade-in" key={`name-${scenario.id}`}>
                <p className="text-white text-[14px] font-semibold leading-tight tracking-[-0.01em] truncate">
                  {scenario.shopName}
                </p>
                <p className="text-[#a8d5b5] text-[11px] leading-none">en línea</p>
              </div>
            </div>
            <div className="flex gap-4 text-white shrink-0">
              <Phone className="h-[15px] w-[15px]" aria-hidden="true" />
              <MoreVertical className="h-[15px] w-[15px]" aria-hidden="true" />
            </div>
          </div>

          {/* Messages */}
          <div
            ref={scrollRef}
            className="h-[420px] overflow-y-auto px-2.5 py-2.5 space-y-1.5 scroll-smooth"
            style={{
              backgroundColor: '#e5ddd5',
              backgroundImage: `url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23c8bfb5' fill-opacity='0.25'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E")`,
            }}
          >
            <div className="flex justify-center my-1.5">
              <span className="bg-[#e1f0d8]/80 text-[#5a7a5a] text-[10px] font-medium px-2.5 py-0.5 rounded-full shadow-sm">
                HOY
              </span>
            </div>

            {visibleMessages.map((msg, i) => (
              <Bubble key={`${scenario.id}-${i}`} message={msg} time={formatTime(i)} />
            ))}

            {state.showTyping && !state.prefersReducedMotion && (
              <div className="flex justify-start animate-fade-in">
                <div className="bg-white rounded-[10px] rounded-tl-[3px] px-3 py-2.5 shadow-sm relative">
                  <svg className="absolute -left-[6px] top-0" width="7" height="10" viewBox="0 0 7 10" aria-hidden="true">
                    <path d="M7 0 Q0 0 0 10 L7 10 Z" fill="white"/>
                  </svg>
                  <div className="flex gap-1 items-center">
                    <span className="w-1.5 h-1.5 bg-[#8696a0] rounded-full animate-bounce [animation-delay:0ms]" />
                    <span className="w-1.5 h-1.5 bg-[#8696a0] rounded-full animate-bounce [animation-delay:150ms]" />
                    <span className="w-1.5 h-1.5 bg-[#8696a0] rounded-full animate-bounce [animation-delay:300ms]" />
                  </div>
                </div>
              </div>
            )}
          </div>

          {/* Home indicator */}
          <div className="bg-[#f0f2f5] pb-2 pt-2 flex justify-center">
            <div className="w-24 h-1 bg-black/20 rounded-full" />
          </div>
        </div>
      </div>

      {/* Scenario indicator dots */}
      <div className="flex justify-center gap-1.5 mt-4">
        {SCENARIOS.map((s, i) => (
          <span
            key={s.id}
            className={`h-1.5 rounded-full transition-all duration-300 ${
              i === state.scenarioIndex ? 'w-6 bg-primary' : 'w-1.5 bg-gray-300'
            }`}
            aria-label={`Conversación de ${s.shopName}`}
          />
        ))}
      </div>
    </div>
  );
}

function formatTime(offset: number): string {
  // Stable per-message time for visual consistency. 9:41 baseline + offset minutes.
  const baseHour = 9;
  const baseMin = 41 + offset;
  const h = baseHour + Math.floor(baseMin / 60);
  const m = baseMin % 60;
  return `${String(h).padStart(2, '0')}:${String(m).padStart(2, '0')}`;
}

function Bubble({ message, time }: { message: ChatMessage; time: string }) {
  const isClient = message.role === 'client';
  const bubbleBase = `max-w-[85%] px-3 py-2 shadow-sm text-[13px] relative animate-fade-in ${
    isClient
      ? 'bg-[#d9fdd3] rounded-[10px] rounded-tr-[3px]'
      : 'bg-white rounded-[10px] rounded-tl-[3px]'
  }`;

  // LIST message (services picker)
  if (message.kind === 'list' && message.list) {
    return (
      <div className="flex justify-start">
        <div className={`${bubbleBase} w-[260px] max-w-none`}>
          <BubbleTail side="left" />
          <p className="text-[#111] leading-snug whitespace-pre-line">{message.text}</p>
          <div className="mt-2 border-t border-gray-200 -mx-3 -mb-2 pt-2 pb-1 px-3 text-center text-[#00a884] text-[12px] font-semibold flex items-center justify-center gap-1.5">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" aria-hidden="true">
              <path d="M3 6h18M3 12h18M3 18h18" stroke="currentColor" strokeWidth="2" strokeLinecap="round"/>
            </svg>
            {message.list.button}
          </div>
          <div className="flex items-center justify-end gap-0.5 mt-1">
            <span className="text-[10.5px] text-[#8696a0]">{time}</span>
          </div>
        </div>
      </div>
    );
  }

  // BUTTONS message (quick replies)
  if (message.kind === 'buttons' && message.buttons) {
    return (
      <div className="flex justify-start">
        <div className={`${bubbleBase} w-[260px] max-w-none`}>
          <BubbleTail side="left" />
          <p className="text-[#111] leading-snug whitespace-pre-line">{message.text}</p>
          <div className="flex items-center justify-end gap-0.5 mt-0.5">
            <span className="text-[10.5px] text-[#8696a0]">{time}</span>
          </div>
          <div className="flex flex-col gap-1 mt-2 -mx-3 -mb-2 border-t border-gray-200 pt-1.5">
            {message.buttons.map((b, i) => (
              <div
                key={i}
                className="text-center text-[#00a884] text-[12px] font-semibold py-1.5 border-b border-gray-200 last:border-0"
              >
                {b}
              </div>
            ))}
          </div>
        </div>
      </div>
    );
  }

  // LOCATION message
  if (message.kind === 'location' && message.location) {
    return (
      <div className="flex justify-start">
        <div className={`${bubbleBase} w-[240px] max-w-none p-0 overflow-hidden`}>
          <BubbleTail side="left" />
          {/* Static map preview */}
          <div className="h-[110px] bg-gradient-to-br from-[#dde6d8] to-[#c8d3c2] relative flex items-center justify-center">
            {/* Pseudo street grid */}
            <svg className="absolute inset-0 w-full h-full" viewBox="0 0 240 110" preserveAspectRatio="none" aria-hidden="true">
              <path d="M0 35 L240 35 M0 75 L240 75 M50 0 L50 110 M120 0 L120 110 M180 0 L180 110" stroke="white" strokeWidth="1.5" opacity="0.6"/>
            </svg>
            <MapPin className="h-7 w-7 text-red-500 fill-red-500 drop-shadow-lg relative z-10" />
          </div>
          <div className="px-3 py-2">
            <p className="text-[#00a884] text-[13px] font-semibold leading-tight">{message.location.name}</p>
            <p className="text-[#8696a0] text-[11px] leading-tight mt-0.5">{message.location.address}</p>
            <div className="flex items-center justify-end gap-0.5 mt-1">
              <span className="text-[10.5px] text-[#8696a0]">{time}</span>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // Plain TEXT message (client or bot)
  return (
    <div className={`flex ${isClient ? 'justify-end' : 'justify-start'}`}>
      <div className={bubbleBase}>
        <BubbleTail side={isClient ? 'right' : 'left'} />
        <p className="text-[#111] leading-snug whitespace-pre-line pr-9">{message.text}</p>
        <div className="flex items-center justify-end gap-0.5 mt-0.5">
          <span className="text-[10.5px] text-[#8696a0]">{time}</span>
          {isClient && (
            <svg width="14" height="8" viewBox="0 0 14 8" fill="none" aria-hidden="true">
              <path d="M1 4l2.5 2.5L9 1" stroke="#53bdeb" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
              <path d="M5 4l2.5 2.5L13 1" stroke="#53bdeb" strokeWidth="1.3" strokeLinecap="round" strokeLinejoin="round"/>
            </svg>
          )}
        </div>
      </div>
    </div>
  );
}

function BubbleTail({ side }: { side: 'left' | 'right' }) {
  if (side === 'right') {
    return (
      <svg className="absolute -right-[6px] top-0" width="7" height="10" viewBox="0 0 7 10" aria-hidden="true">
        <path d="M0 0 Q7 0 7 10 L0 10 Z" fill="#d9fdd3"/>
      </svg>
    );
  }
  return (
    <svg className="absolute -left-[6px] top-0" width="7" height="10" viewBox="0 0 7 10" aria-hidden="true">
      <path d="M7 0 Q0 0 0 10 L7 10 Z" fill="white"/>
    </svg>
  );
}
