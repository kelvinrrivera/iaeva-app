"use client";

import { useState, useRef, useEffect } from "react";
import {
    Send,
    MoreVertical,
    ChevronLeft,
    Phone,
    Video,
    Check,
    CheckCheck,
    Scissors,
} from "lucide-react";
import { Loader2 } from "lucide-react";

interface Message {
    id: string;
    text: string;
    sender: "user" | "bot";
    timestamp: string;
    status: "sent" | "delivered" | "read";
}

interface FAQ {
    q: string;
    a: string;
}

interface ChatbotSimulatorProps {
    shopName?: string;
    systemInstruction?: string;
    faqs?: FAQ[];
    savedModelId?: string | null;
    onModelChange?: (modelId: string | null) => void;
}

export default function ChatbotSimulator({ shopName, systemInstruction, faqs, savedModelId, onModelChange }: ChatbotSimulatorProps) {
    const [messages, setMessages] = useState<Message[]>([
        {
            id: "1",
            text: `¡Hola! Bienvenid@ a ${shopName || "nuestro negocio"}. ¿En qué puedo ayudarte hoy?`,
            sender: "bot",
            timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
            status: "read",
        },
    ]);
    const [input, setInput] = useState("");
    const [isLoading, setIsLoading] = useState(false);
    const [selectedModel, setSelectedModel] = useState(savedModelId || "gpt-4.1-mini");
    const [availableModels, setAvailableModels] = useState<{ id: string; displayName: string }[]>([]);
    const [isSuperAdmin, setIsSuperAdmin] = useState(false);
    const [isLoadingModels, setIsLoadingModels] = useState(true);
    const scrollRef = useRef<HTMLDivElement>(null);

    useEffect(() => {
        const fetchModels = async () => {
            try {
                const res = await fetch("/api/models", { credentials: "include" });
                if (res.status === 403) {
                    // Not SUPER_ADMIN — hide model selector
                    setIsSuperAdmin(false);
                    setIsLoadingModels(false);
                    return;
                }
                const data = await res.json();
                if (data.models) {
                    setAvailableModels(data.models);
                    setIsSuperAdmin(true);
                }
            } catch (e) {
                console.error("Error fetching models:", e);
            } finally {
                setIsLoadingModels(false);
            }
        };
        fetchModels();
    }, []);

    // Sync from parent when savedModelId loads
    useEffect(() => {
        if (savedModelId) setSelectedModel(savedModelId);
    }, [savedModelId]);

    useEffect(() => {
        if (scrollRef.current) {
            scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
        }
    }, [messages]);

    const handleSend = async () => {
        if (!input.trim() || isLoading) return;

        const userMsg: Message = {
            id: Date.now().toString(),
            text: input,
            sender: "user",
            timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
            status: "sent",
        };

        setMessages((prev) => [...prev, userMsg]);
        setInput("");
        setIsLoading(true);

        try {
            const history = messages
                .filter((m, i) => !(i === 0 && m.sender === "bot"))
                .map((m) => ({ role: m.sender === "user" ? "user" : "assistant", content: m.text }));

            // Build full system prompt combining saved personality + FAQs + essential closing rules
            const faqBlock = faqs && faqs.length > 0
                ? `\n\nPREGUNTAS FRECUENTES (responde exactamente así si te preguntan esto):\n${faqs.map(f => `P: ${f.q}\nR: ${f.a}`).join('\n\n')}`
                : '';

            const builtInstruction = `Eres el asistente virtual de ${shopName || "este negocio"} en República Dominicana. Tu función es gestionar citas por WhatsApp.

${systemInstruction ? `PERSONALIDAD Y TONO:\n${systemInstruction}` : `PERSONALIDAD Y TONO:\n- Profesional, cordial y eficiente.\n- Responde en español dominicano natural.`}
${faqBlock}

REGLAS OBLIGATORIAS:
1. SALUDO: Solo saluda en tu PRIMER mensaje de la conversación. Después, responde directamente sin saludar.
2. TONO: Adopta el tono general descrito en la personalidad (formal, relajado, religioso, etc.) pero NO repitas las mismas frases textuales en cada mensaje. Varía tus expresiones naturalmente como haría una persona real.
3. BREVEDAD: Máximo 2-3 oraciones por respuesta. Ve directo al punto.
4. CITAS: Para agendar necesitas: nombre del cliente, servicio, fecha y hora. Pide lo que falte de uno en uno, sin repetir lo que ya sabes.
5. CONFIRMACIÓN DE CITA: Al confirmar incluye todos los detalles (servicio, fecha, hora), menciona el recordatorio automático, y pide que cancele con anticipación si no puede asistir.
6. NATURALIDAD: Responde como un humano real en WhatsApp — mensajes cortos, sin repetir muletillas, sin sonar como robot. Si el cliente pregunta algo fuera de tema, responde brevemente y redirige al servicio.`;

            const res = await fetch("/api/chat/playground", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({
                    message: input,
                    history,
                    systemInstruction: builtInstruction,
                    modelId: selectedModel,
                }),
            });

            const data = await res.json();
            if (data.error) throw new Error(data.details || data.error);

            setMessages((prev) => [
                ...prev,
                {
                    id: (Date.now() + 1).toString(),
                    text: data.response || "¡Entendido! ¿Alguna otra pregunta?",
                    sender: "bot",
                    timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
                    status: "read",
                },
            ]);
        } catch (e: any) {
            setMessages((prev) => [
                ...prev,
                {
                    id: (Date.now() + 1).toString(),
                    text: `Error de IA: ${e.message}`,
                    sender: "bot",
                    timestamp: new Date().toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" }),
                    status: "read",
                },
            ]);
        } finally {
            setIsLoading(false);
        }
    };

    return (
        <div className="flex flex-col gap-4">
            {/* Model selector — SUPER_ADMIN only */}
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                    <div className="h-2 w-2 rounded-full bg-emerald-500 animate-pulse" />
                    <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Simulador activo</span>
                </div>
                {isSuperAdmin && (
                    <div className="flex items-center gap-2">
                        <span className="text-[10px] font-semibold text-gray-400 uppercase tracking-widest">Modelo IA</span>
                        <select
                            value={selectedModel}
                            onChange={(e) => { setSelectedModel(e.target.value); onModelChange?.(e.target.value); }}
                            disabled={isLoadingModels}
                            className="bg-white border border-gray-200 text-xs font-semibold rounded-lg px-3 py-1.5 outline-none focus:ring-2 focus:ring-primary/20 cursor-pointer disabled:opacity-50 text-charcoal"
                        >
                            {availableModels.length > 0 ? (
                                availableModels.map((m) => (
                                    <option key={m.id} value={m.id}>{m.displayName}</option>
                                ))
                            ) : (
                                <option value="gemini-3-flash-preview">Gemini 3 Flash (Preview)</option>
                            )}
                        </select>
                    </div>
                )}
            </div>

            {/* Phone frame */}
            <div className="flex justify-center">
                <div className="w-[340px] h-[660px] bg-[#0b141a] rounded-[3rem] border-[12px] border-gray-800 shadow-2xl overflow-hidden flex flex-col">
                    {/* Status bar */}
                    <div className="h-8 px-6 flex justify-between items-center text-white/70 text-[10px] font-bold shrink-0">
                        <span>9:41</span>
                        <div className="flex gap-1">
                            <div className="w-4 h-2 bg-white/30 rounded-sm" />
                            <div className="w-2 h-2 bg-white/30 rounded-full" />
                        </div>
                    </div>

                    {/* Chat header */}
                    <div className="bg-[#202c33] px-4 py-3 flex items-center justify-between text-white shrink-0">
                        <div className="flex items-center gap-2.5">
                            <ChevronLeft className="h-4 w-4 text-[#00a884]" />
                            <div className="w-8 h-8 rounded-full bg-primary/20 flex items-center justify-center border border-primary/30 shrink-0">
                                <Scissors className="h-4 w-4 text-primary" />
                            </div>
                            <div>
                                <p className="text-xs font-bold leading-tight">{shopName || "Asistente IA"}</p>
                                <p className="text-[9px] text-[#00a884] font-semibold">en línea</p>
                            </div>
                        </div>
                        <div className="flex gap-3 text-[#aebac1]">
                            <Video className="h-4 w-4" />
                            <Phone className="h-4 w-4" />
                            <MoreVertical className="h-4 w-4" />
                        </div>
                    </div>

                    {/* Messages */}
                    <div
                        ref={scrollRef}
                        className="flex-1 overflow-y-auto p-3 space-y-3 bg-[#0b141a]"
                    >
                        {messages.map((msg) => (
                            <div
                                key={msg.id}
                                className={`flex ${msg.sender === "user" ? "justify-end" : "justify-start"}`}
                            >
                                <div
                                    className={`max-w-[78%] px-3 py-2 rounded-xl text-[12px] shadow-sm relative ${
                                        msg.sender === "user"
                                            ? "bg-[#005c4b] text-white rounded-tr-none"
                                            : "bg-[#202c33] text-[#e9edef] rounded-tl-none border border-white/5"
                                    }`}
                                >
                                    <p className="pr-10 leading-snug">{msg.text}</p>
                                    <div className="flex items-center gap-0.5 absolute bottom-1 right-1.5 text-[8px] text-white/40 font-bold">
                                        {msg.timestamp}
                                        {msg.sender === "user" && (
                                            msg.status === "sent"
                                                ? <Check className="h-2 w-2 ml-0.5" />
                                                : <CheckCheck className="h-2 w-2 ml-0.5 text-[#53bdeb]" />
                                        )}
                                    </div>
                                </div>
                            </div>
                        ))}
                        {isLoading && (
                            <div className="flex justify-start">
                                <div className="bg-[#202c33] px-3 py-2.5 rounded-xl rounded-tl-none border border-white/5">
                                    <div className="flex gap-1">
                                        <div className="w-1.5 h-1.5 bg-white/30 rounded-full animate-bounce [animation-delay:0ms]" />
                                        <div className="w-1.5 h-1.5 bg-white/30 rounded-full animate-bounce [animation-delay:150ms]" />
                                        <div className="w-1.5 h-1.5 bg-white/30 rounded-full animate-bounce [animation-delay:300ms]" />
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Input */}
                    <div className="bg-[#202c33] p-3 flex items-center gap-2 shrink-0">
                        <div className="flex-1 bg-[#2a3942] rounded-2xl px-4 py-2.5 flex items-center">
                            <input
                                type="text"
                                placeholder="Escribe un mensaje..."
                                className="bg-transparent text-white text-[12px] outline-none flex-1 placeholder:text-gray-600"
                                value={input}
                                onChange={(e) => setInput(e.target.value)}
                                onKeyDown={(e) => e.key === "Enter" && handleSend()}
                            />
                        </div>
                        <button
                            onClick={handleSend}
                            disabled={isLoading || !input.trim()}
                            className="w-10 h-10 bg-[#00a884] rounded-full flex items-center justify-center text-white hover:scale-110 active:scale-90 transition-all disabled:opacity-50 shrink-0"
                        >
                            {isLoading ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                                <Send className="h-4 w-4 fill-current ml-0.5" />
                            )}
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
