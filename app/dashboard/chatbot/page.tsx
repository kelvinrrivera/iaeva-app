"use client";

import { useState, useEffect, useMemo } from "react";
import { useSearchParams } from "next/navigation";
import {
    Bot,
    MessageSquare,
    Zap,
    Save,
    Plus,
    Trash2,
    Sparkles,
    Loader2,
    CheckCircle2,
    X,
    TrendingUp,
    AlertCircle,
    RotateCcw,
    BookOpen,
} from "lucide-react";
import ChatbotSimulator from "@/components/dashboard/ChatbotSimulator";

interface FAQ {
    q: string;
    a: string;
}

export default function ChatbotConfigPage() {
    const searchParams = useSearchParams();
    const initialTab = useMemo(() => {
        const tab = searchParams.get('tab');
        if (tab === 'probar') return 'test';
        if (tab === 'analytics') return 'analytics';
        return 'config';
    }, []);
    const [activeTab, setActiveTab] = useState<'config' | 'test' | 'analytics'>(initialTab);

    // Config state
    const [personality, setPersonality] = useState("");
    const [jerga, setJerga] = useState("");
    const [jergaDefault, setJergaDefault] = useState("");
    const [faqs, setFaqs] = useState<FAQ[]>([]);
    const [chatbotModelId, setChatbotModelId] = useState<string | null>(null);
    const [shopName, setShopName] = useState("");
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [newFaq, setNewFaq] = useState({ q: "", a: "" });
    const [showAddFaq, setShowAddFaq] = useState(false);
    const [message, setMessage] = useState<{ type: 'success' | 'error', text: string } | null>(null);

    // Analytics state
    const [analytics, setAnalytics] = useState<any>(null);
    const [loadingAnalytics, setLoadingAnalytics] = useState(false);

    // Load configuration on mount
    useEffect(() => {
        loadConfig();
    }, []);

    // Load analytics when switching to analytics tab
    useEffect(() => {
        if (activeTab === 'analytics') {
            loadAnalytics();
        }
    }, [activeTab]);

    const loadConfig = async () => {
        try {
            const res = await fetch("/api/chatbot/config", {
                credentials: 'include'
            });
            const data = await res.json();

            if (data.error) {
                console.error("Error loading config:", data.error);
                return;
            }

            setPersonality(data.personality || "");
            setJerga(data.jerga || "");
            setJergaDefault(data.defaultJerga || data.jerga || "");
            setFaqs(data.faqs || []);
            setChatbotModelId(data.chatbotModelId || null);
            // Fetch shop name for simulator
            try {
                const shopRes = await fetch("/api/shop", { credentials: 'include' });
                const shopData = await shopRes.json();
                if (shopData?.name) setShopName(shopData.name);
            } catch {};
        } catch (error) {
            console.error("Failed to load config:", error);
        } finally {
            setLoading(false);
        }
    };

    const loadAnalytics = async () => {
        setLoadingAnalytics(true);
        try {
            const res = await fetch("/api/chatbot/analytics", {
                credentials: 'include'
            });
            const data = await res.json();

            if (!data.error) {
                setAnalytics(data);
            }
        } catch (error) {
            console.error("Failed to load analytics:", error);
        } finally {
            setLoadingAnalytics(false);
        }
    };

    const handleSave = async () => {
        setSaving(true);
        setMessage(null);

        try {
            const res = await fetch("/api/chatbot/config", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: 'include',
                body: JSON.stringify({ personality, jerga, faqs, chatbotModelId })
            });

            const data = await res.json();

            if (data.error) {
                setMessage({ type: 'error', text: data.error });
            } else {
                setMessage({ type: 'success', text: "Configuración guardada exitosamente" });
                setTimeout(() => setMessage(null), 3000);
            }
        } catch (error) {
            setMessage({ type: 'error', text: "Error al guardar configuración" });
        } finally {
            setSaving(false);
        }
    };

    const handleAddFaq = () => {
        if (!newFaq.q.trim() || !newFaq.a.trim()) return;
        setFaqs([...faqs, { q: newFaq.q, a: newFaq.a }]);
        setNewFaq({ q: "", a: "" });
        setShowAddFaq(false);
    };

    const handleDeleteFaq = (index: number) => {
        setFaqs(faqs.filter((_, i) => i !== index));
    };

    return (
        <div className="max-w-6xl space-y-8 pb-20">
            {/* Message Toast */}
            {message && (
                <div className={`fixed top-4 right-4 z-50 px-6 py-4 rounded-xl shadow-2xl flex items-center gap-3 ${
                    message.type === 'success'
                        ? 'bg-emerald-600 text-white'
                        : 'bg-red-600 text-white'
                }`}>
                    {message.type === 'success' ? (
                        <CheckCircle2 className="h-5 w-5" />
                    ) : (
                        <X className="h-5 w-5" />
                    )}
                    <span className="font-bold text-sm">{message.text}</span>
                </div>
            )}

            {/* Header */}
            <div className="flex justify-between items-start">
                <div className="space-y-1">
                    <h1 className="text-4xl font-black tracking-tight flex items-center gap-3">
                        <div className="p-2 bg-primary rounded-xl text-white shadow-lg">
                            <Bot className="h-8 w-8" />
                        </div>
                        Asistente Virtual (IA)
                    </h1>
                    <p className="text-gray-500 font-medium">Configura y prueba tu asistente inteligente para WhatsApp.</p>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={() => setActiveTab('config')}
                        className={`px-4 py-2 rounded-xl font-black text-sm transition-all ${
                            activeTab === 'config'
                                ? 'bg-gradient-to-r from-primary to-primary-dark text-white'
                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                    >
                        Configuración
                    </button>
                    <button
                        onClick={() => setActiveTab('test')}
                        className={`px-4 py-2 rounded-xl font-black text-sm transition-all ${
                            activeTab === 'test'
                                ? 'bg-gradient-to-r from-primary to-primary-dark text-white'
                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                    >
                        Probar
                    </button>
                    <button
                        onClick={() => setActiveTab('analytics')}
                        className={`px-4 py-2 rounded-xl font-black text-sm transition-all ${
                            activeTab === 'analytics'
                                ? 'bg-gradient-to-r from-primary to-primary-dark text-white'
                                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
                        }`}
                    >
                        Analytics
                    </button>
                </div>
            </div>

            {/* CONFIG TAB */}
            {activeTab === 'config' && (
                <div className="grid gap-6 lg:grid-cols-3">
                    {/* Left Column - General Settings */}
                    <div className="lg:col-span-2 space-y-6">
                        {/* Personality Config */}
                        <div className="card-luxury p-8 space-y-6 relative overflow-hidden group">
                            <div className="absolute top-0 right-0 p-8 opacity-5">
                                <Sparkles className="h-32 w-32 text-primary" />
                            </div>

                            <div className="flex items-center gap-3 mb-2 relative">
                                <div className="p-2 bg-primary/5 rounded-xl text-primary">
                                    <Zap className="h-5 w-5" />
                                </div>
                                <h2 className="text-xl font-black text-charcoal">Personalidad y Tono</h2>
                            </div>

                            <div className="space-y-4 relative">
                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] ml-1">
                                    Personalidad y Frases Típicas
                                </label>
                                <textarea
                                    className="w-full h-48 bg-gray-50 border border-gray-200 rounded-xl p-6 text-sm font-medium text-gray-600 outline-none focus:ring-4 focus:ring-primary/10 focus:border-primary transition-all resize-none"
                                    value={personality}
                                    onChange={(e) => setPersonality(e.target.value)}
                                    placeholder="Escribe frases típicas o cómo quieres que el bot se comporte..."
                                />
                                <p className="text-xs text-gray-400 font-medium flex items-center gap-2 italic">
                                    <Sparkles className="h-3 w-3 text-primary" />
                                    Nota: Los servicios y precios se sincronizan automáticamente desde tu catálogo.
                                </p>
                            </div>
                        </div>

                        {/* Vocabulario / Jerga Local */}
                        <div className="card-luxury p-8 space-y-6 relative overflow-hidden group">
                            <div className="absolute top-0 right-0 p-8 opacity-5">
                                <BookOpen className="h-32 w-32 text-violet-600" />
                            </div>

                            <div className="flex items-center justify-between mb-2 relative">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-violet-500/10 rounded-xl text-violet-500">
                                        <BookOpen className="h-5 w-5" />
                                    </div>
                                    <div>
                                        <h2 className="text-xl font-black text-charcoal">Vocabulario Local</h2>
                                        <p className="text-xs text-gray-400 font-medium mt-0.5">Términos que tu asistente entiende y puede usar</p>
                                    </div>
                                </div>
                                <button
                                    type="button"
                                    onClick={() => setJerga(jergaDefault)}
                                    className="flex items-center gap-1.5 text-xs font-bold text-violet-600 hover:text-violet-800 transition-colors"
                                >
                                    <RotateCcw className="h-3 w-3" />
                                    Restaurar original
                                </button>
                            </div>

                            <div className="space-y-4 relative">
                                <textarea
                                    className="w-full h-56 bg-gray-50 border border-gray-200 rounded-xl p-6 text-xs font-mono leading-relaxed text-gray-600 outline-none focus:ring-4 focus:ring-violet-500/10 focus:border-violet-400 transition-all resize-none"
                                    value={jerga}
                                    onChange={(e) => setJerga(e.target.value)}
                                    placeholder='Ej: - "El final" = Algo excelente, un corte perfecto'
                                />
                                <p className="text-xs text-gray-400 font-medium flex items-center gap-2 italic">
                                    <Sparkles className="h-3 w-3 text-violet-500" />
                                    Formato: <span className="font-mono bg-gray-100 px-1 rounded">&quot;término&quot; = significado</span>. Puedes agregar, editar o quitar términos.
                                </p>
                            </div>
                        </div>

                        {/* FAQs Manager */}
                        <div className="card-luxury p-8 space-y-6">
                            <div className="flex items-center justify-between mb-2">
                                <div className="flex items-center gap-3">
                                    <div className="p-2 bg-accent/5 rounded-xl text-accent">
                                        <MessageSquare className="h-5 w-5" />
                                    </div>
                                    <h2 className="text-xl font-black text-charcoal">Preguntas Frecuentes ({faqs.length})</h2>
                                </div>
                                <button
                                    onClick={() => setShowAddFaq(!showAddFaq)}
                                    className="text-sm font-black text-accent hover:opacity-70 flex items-center gap-1 uppercase tracking-wider"
                                >
                                    <Plus className="h-4 w-4" /> Agregar
                                </button>
                            </div>

                            {showAddFaq && (
                                <div className="bg-accent/5 p-6 rounded-3xl border border-accent/10 space-y-4">
                                    <div>
                                        <label className="text-[10px] font-black text-accent/70 uppercase tracking-wider block mb-2">
                                            Pregunta
                                        </label>
                                        <input
                                            type="text"
                                            className="w-full bg-white border border-accent/20 rounded-xl px-4 py-3 text-sm font-medium text-gray-700 outline-none focus:ring-2 focus:ring-accent"
                                            value={newFaq.q}
                                            onChange={(e) => setNewFaq({ ...newFaq, q: e.target.value })}
                                            placeholder="Ej: ¿Tienen parqueo?"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-[10px] font-black text-accent/70 uppercase tracking-wider block mb-2">
                                            Respuesta
                                        </label>
                                        <textarea
                                            className="w-full bg-white border border-accent/20 rounded-xl px-4 py-3 text-sm font-medium text-gray-700 outline-none focus:ring-2 focus:ring-accent resize-none h-24"
                                            value={newFaq.a}
                                            onChange={(e) => setNewFaq({ ...newFaq, a: e.target.value })}
                                            placeholder="Ej: Sí, contamos con parqueo privado para clientes."
                                        />
                                    </div>
                                    <div className="flex gap-2">
                                        <button
                                            onClick={handleAddFaq}
                                            className="flex-1 bg-accent text-white font-black py-3 rounded-xl hover:bg-accent/50 transition-all"
                                        >
                                            Agregar
                                        </button>
                                        <button
                                            onClick={() => {
                                                setShowAddFaq(false);
                                                setNewFaq({ q: "", a: "" });
                                            }}
                                            className="px-6 bg-gray-200 text-gray-600 font-black py-3 rounded-xl hover:bg-gray-300 transition-all"
                                        >
                                            Cancelar
                                        </button>
                                    </div>
                                </div>
                            )}

                            <div className="space-y-4">
                                {faqs.length === 0 ? (
                                    <div className="text-center py-12 bg-gray-50 rounded-3xl border-2 border-dashed border-gray-200">
                                        <MessageSquare className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                                        <p className="text-sm font-medium text-gray-400">
                                            No hay preguntas frecuentes aún
                                        </p>
                                        <p className="text-xs text-gray-300 mt-1">
                                            Haz clic en "Agregar" para crear la primera
                                        </p>
                                    </div>
                                ) : (
                                    faqs.map((faq, i) => (
                                        <div key={i} className="bg-gray-50 p-6 rounded-xl border border-gray-100 group relative hover:border-accent/20 transition-all">
                                            <div className="space-y-3">
                                                <div className="flex items-start gap-4">
                                                    <span className="w-6 h-6 rounded-full bg-accent/10 flex items-center justify-center text-[10px] font-black text-accent shrink-0">Q</span>
                                                    <p className="text-sm font-black text-charcoal">{faq.q}</p>
                                                </div>
                                                <div className="flex items-start gap-4">
                                                    <span className="w-6 h-6 rounded-full bg-primary/5 flex items-center justify-center text-[10px] font-black text-primary shrink-0">A</span>
                                                    <p className="text-sm font-medium text-gray-600">{faq.a}</p>
                                                </div>
                                            </div>
                                            <button
                                                onClick={() => handleDeleteFaq(i)}
                                                className="absolute top-4 right-4 text-gray-300 hover:text-red-500 p-2 opacity-0 group-hover:opacity-100 transition-all"
                                            >
                                                <Trash2 className="h-4 w-4" />
                                            </button>
                                        </div>
                                    ))
                                )}
                            </div>
                        </div>
                    </div>

                    {/* Right Column - Status & Training */}
                    <div className="space-y-6">
                        <div className="bg-gradient-to-br from-gray-50 to-white p-8 rounded-2xl shadow-xl border border-gray-200 relative overflow-hidden">
                            <div className="absolute -bottom-10 -right-10 opacity-5">
                                <Bot className="h-48 w-48 text-charcoal" />
                            </div>
                            <h3 className="text-xl font-bold mb-6 text-charcoal">Estado del Chatbot</h3>
                            <div className="space-y-6 relative">
                                <div className="bg-white p-5 rounded-xl border border-gray-200 shadow-sm">
                                    <div className="flex justify-between items-center mb-2">
                                        <span className="text-xs font-bold text-gray-500">Base de Conocimiento</span>
                                        <span className="text-xs font-black text-primary">{Math.min(100, faqs.length * 5)}%</span>
                                    </div>
                                    <div className="h-1.5 w-full bg-gray-100 rounded-full overflow-hidden">
                                        <div
                                            className="h-full bg-primary rounded-full transition-all duration-500"
                                            style={{ width: `${Math.min(100, faqs.length * 5)}%` }}
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-3">
                                    <div className="bg-white p-4 rounded-xl text-center border border-gray-200 shadow-sm">
                                        <span className="text-xl font-black block text-charcoal">{faqs.length}</span>
                                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">FAQs</span>
                                    </div>
                                    <div className="bg-white p-4 rounded-xl text-center border border-gray-200 shadow-sm">
                                        <span className="text-xl font-black block text-charcoal">{personality.length}</span>
                                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Caracteres</span>
                                    </div>
                                </div>
                            </div>
                            <button
                                onClick={() => setActiveTab('test')}
                                className="w-full btn-accent-luxury py-4 rounded-xl font-black flex items-center justify-center gap-2 mt-6"
                            >
                                <MessageSquare className="h-5 w-5" />
                                Probar Chatbot
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* TEST TAB */}
            {activeTab === 'test' && (
                <div className="grid gap-8 lg:grid-cols-[1fr_320px]">
                    {/* Simulador WhatsApp */}
                    <div className="bg-white p-8 rounded-2xl border border-gray-100 shadow-sm">
                        <h2 className="text-base font-bold text-charcoal mb-6 flex items-center gap-2">
                            <Bot className="h-5 w-5 text-primary" />
                            Simulador WhatsApp
                        </h2>
                        <ChatbotSimulator shopName={shopName} systemInstruction={personality} faqs={faqs} savedModelId={chatbotModelId} onModelChange={setChatbotModelId} />
                    </div>

                    {/* Panel informativo */}
                    <div className="bg-primary/5 p-6 rounded-2xl border border-primary/10 space-y-5 h-fit">
                        <h3 className="text-sm font-black text-charcoal uppercase tracking-wide">Cómo funciona</h3>

                        <div className="space-y-4 text-sm text-gray-600">
                            {[
                                { n: 1, title: "Respuestas instantáneas", desc: "Para FAQs ya configuradas en la pestaña Configuración" },
                                { n: 2, title: "Búsqueda inteligente", desc: "Entiende variaciones y sinónimos de las preguntas" },
                                { n: 3, title: "Gemini AI", desc: "Genera respuestas personalizadas con tu catálogo" },
                                { n: 4, title: "Analytics", desc: "Aprende qué preguntan tus clientes para mejorar el bot" },
                            ].map(({ n, title, desc }) => (
                                <div key={n} className="flex gap-3">
                                    <div className="w-7 h-7 rounded-full bg-primary/10 flex items-center justify-center text-primary font-black text-xs shrink-0">{n}</div>
                                    <div>
                                        <p className="font-semibold text-charcoal text-xs">{title}</p>
                                        <p className="text-xs text-gray-400 mt-0.5">{desc}</p>
                                    </div>
                                </div>
                            ))}
                        </div>

                        <div className="bg-white p-3 rounded-xl border border-primary/10">
                            <p className="text-xs text-gray-400 leading-relaxed">
                                Prueba distintas variaciones de la misma pregunta para ver cómo responde el bot en cada caso.
                            </p>
                        </div>
                    </div>
                </div>
            )}

            {/* ANALYTICS TAB */}
            {activeTab === 'analytics' && (
                <div className="grid gap-8 lg:grid-cols-2">
                    {/* Preguntas Más Frecuentes */}
                    <div className="bg-white p-8 rounded-[2.5rem] border border-gray-200 shadow-sm space-y-6">
                        <h2 className="text-xl font-black text-charcoal flex items-center gap-3">
                            <TrendingUp className="h-6 w-6 text-primary" />
                            Preguntas Más Frecuentes
                        </h2>

                        {loadingAnalytics ? (
                            <div className="flex justify-center py-12">
                                <Loader2 className="h-8 w-8 animate-spin text-primary" />
                            </div>
                        ) : analytics && analytics.frequentQuestions.length > 0 ? (
                            <div className="space-y-3">
                                {analytics.frequentQuestions.map((item: any, i: number) => (
                                    <div
                                        key={i}
                                        className="bg-gray-50 p-4 rounded-xl border border-gray-100 flex items-center justify-between group hover:border-primary/30 transition-all cursor-pointer"
                                        onClick={() => {
                                            setNewFaq({ q: item.question, a: "" });
                                            setShowAddFaq(true);
                                            setActiveTab('config');
                                        }}
                                    >
                                        <div className="flex-1">
                                            <p className="text-sm font-medium text-charcoal">{item.question}</p>
                                            <p className="text-xs text-gray-500">{item.count} veces este mes</p>
                                        </div>
                                        <div className="flex items-center gap-2">
                                            {!item.isCovered && (
                                                <span className="px-2 py-1 bg-accent/10 text-accent rounded-lg text-[10px] font-bold">
                                                    Hot
                                                </span>
                                            )}
                                            <Plus className="h-4 w-4 text-primary opacity-0 group-hover:opacity-100 transition-opacity" />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <div className="text-center py-12 bg-gray-50 rounded-2xl border-2 border-dashed border-gray-200">
                                <TrendingUp className="h-12 w-12 text-gray-300 mx-auto mb-3" />
                                <p className="text-sm font-medium text-gray-400">
                                    No hay datos aún
                                </p>
                                <p className="text-xs text-gray-300 mt-1">
                                    Las preguntas de los clientes aparecerán aquí
                                </p>
                            </div>
                        )}
                    </div>

                    {/* Hot Questions */}
                    {analytics?.hotQuestions && analytics.hotQuestions.length > 0 && (
                        <div className="bg-accent/5 p-8 rounded-[2.5rem] border border-accent/20 space-y-6">
                            <h2 className="text-xl font-black text-charcoal flex items-center gap-3">
                                <AlertCircle className="h-6 w-6 text-accent" />
                                Preguntas por Agregar
                            </h2>

                            <div className="bg-white p-4 rounded-xl border border-accent/10">
                                <p className="text-sm text-gray-600 mb-4">
                                    Estas preguntas se hacen frecuentemente pero aún no están en tus FAQs. Agregarlas mejorará la velocidad de respuesta.
                                </p>
                                <div className="space-y-2">
                                    {analytics.hotQuestions.map((item: any, i: number) => (
                                        <div
                                            key={i}
                                            className="bg-accent/5 p-3 rounded-lg border border-accent/10 flex items-center justify-between cursor-pointer hover:bg-accent/10 transition-all"
                                            onClick={() => {
                                                setNewFaq({ q: item.question, a: "" });
                                                setShowAddFaq(true);
                                                setActiveTab('config');
                                            }}
                                        >
                                            <p className="text-sm font-medium text-charcoal flex-1">{item.question}</p>
                                            <div className="flex items-center gap-2">
                                                <span className="text-xs font-bold text-accent">{item.count}x</span>
                                                <Plus className="h-4 w-4 text-accent" />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        </div>
                    )}

                    {/* Stats Cards */}
                    <div className="space-y-6">
                        {analytics && (
                            <>
                                <div className="bg-charcoal p-6 rounded-2xl text-white shadow-lg">
                                    <h3 className="text-3xl font-black">{analytics.stats.totalQuestions}</h3>
                                    <p className="text-sm opacity-60">Preguntas este mes</p>
                                </div>
                                <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-lg">
                                    <h3 className="text-3xl font-black text-primary">{analytics.stats.uniqueQuestions}</h3>
                                    <p className="text-sm text-gray-500">Preguntas únicas</p>
                                </div>
                                <div className="bg-white p-6 rounded-2xl border border-gray-200 shadow-lg">
                                    <h3 className="text-3xl font-black text-accent">{analytics.existingFaqsCount}</h3>
                                    <p className="text-sm text-gray-500">FAQs configuradas</p>
                                </div>

                                {/* 🎯 Nuevas métricas de optimización */}
                                {analytics.optimization && (
                                    <>
                                        <div className="bg-gradient-to-br from-emerald-50 to-teal-50 p-6 rounded-2xl border-2 border-emerald-200 shadow-lg">
                                            <h3 className="text-3xl font-black text-emerald-600">{analytics.optimization.appointmentsBookedViaChatbot}</h3>
                                            <p className="text-sm text-emerald-700 font-medium">Citas agendadas vía Chatbot</p>
                                        </div>
                                        <div className="bg-gradient-to-br from-primary/5 to-primary/8 p-6 rounded-2xl border-2 border-primary/20 shadow-lg">
                                            <h3 className="text-3xl font-black text-primary">{analytics.optimization.efficiency}</h3>
                                            <p className="text-sm text-primary font-medium">Mejora en eficiencia</p>
                                        </div>
                                        <div className="bg-gradient-to-br from-accent/5 to-accent/8 p-6 rounded-2xl border-2 border-accent/20 shadow-lg">
                                            <h3 className="text-3xl font-black text-primary">{analytics.optimization.avgDailyOccupancy}%</h3>
                                            <p className="text-sm text-accent font-medium">Ocupación promedio diaria</p>
                                        </div>
                                    </>
                                )}
                            </>
                        )}
                    </div>
                </div>
            )}

            {/* Floating Save Bar */}
            <div className="fixed bottom-10 right-10 flex items-center gap-4">
                <button
                    onClick={handleSave}
                    disabled={saving}
                    className="flex items-center gap-2 btn-accent-luxury px-8 py-4 rounded-3xl font-black shadow-2xl hover:scale-105 active:scale-95 transition-all group disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {saving ? (
                        <Loader2 className="h-5 w-5 text-white animate-spin" />
                    ) : (
                        <Save className="h-5 w-5 text-white group-hover:animate-bounce" />
                    )}
                    {saving ? "Guardando..." : "Guardar Configuración"}
                </button>
            </div>
        </div>
    );
}
