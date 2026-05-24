"use client";

import { useEffect, useState } from "react";
import { Bot, Clock, Save, Loader2, Plus, X } from "lucide-react";
import { useToast } from "@/contexts/ToastContext";

type Mode = "ALWAYS" | "OFF_HOURS" | "BUSINESS_HOURS" | "CUSTOM" | "DISABLED";

interface CustomWindow {
    day: number;
    start: string;
    end: string;
}

interface Config {
    mode: Mode;
    customWindows: CustomWindow[] | null;
    closedAutoReply: string | null;
    closedAutoReplyEnabled: boolean;
}

const DAYS = ["Dom", "Lun", "Mar", "Mié", "Jue", "Vie", "Sáb"];

const MODE_INFO: Record<Mode, { label: string; description: string }> = {
    ALWAYS: { label: "Siempre activo", description: "El bot responde 24/7 a todos los mensajes." },
    OFF_HOURS: { label: "Solo fuera de horario", description: "El bot solo responde cuando tu negocio está cerrado." },
    BUSINESS_HOURS: { label: "Solo en horario", description: "El bot solo responde durante las horas de apertura." },
    CUSTOM: { label: "Personalizado", description: "Tú defines exactamente cuándo el bot responde." },
    DISABLED: { label: "Apagado", description: "El bot nunca responde. Atención 100% humana." },
};

const DEFAULT_CONFIG: Config = {
    mode: "ALWAYS",
    customWindows: null,
    closedAutoReply: "Gracias por escribirnos. Te respondemos en cuanto podamos. Si quieres reservar, escribe RESERVAR.",
    closedAutoReplyEnabled: false,
};

export default function BotScheduleCard() {
    const toast = useToast();
    const [config, setConfig] = useState<Config>(DEFAULT_CONFIG);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        fetch("/api/whatsapp/bot-schedule", { credentials: "include" })
            .then(r => r.json())
            .then(d => {
                setConfig({
                    mode: d.mode || "ALWAYS",
                    customWindows: d.customWindows ?? null,
                    closedAutoReply: d.closedAutoReply ?? DEFAULT_CONFIG.closedAutoReply,
                    closedAutoReplyEnabled: !!d.closedAutoReplyEnabled,
                });
            })
            .catch(() => {})
            .finally(() => setLoading(false));
    }, []);

    const save = async () => {
        setSaving(true);
        try {
            const res = await fetch("/api/whatsapp/bot-schedule", {
                method: "POST",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(config),
            });
            const data = await res.json();
            if (!res.ok) {
                toast.error(data.error || "Error al guardar");
                return;
            }
            toast.success("Horario del bot guardado");
        } catch {
            toast.error("Error de conexión");
        } finally {
            setSaving(false);
        }
    };

    const addWindow = () => {
        setConfig(c => ({
            ...c,
            customWindows: [...(c.customWindows || []), { day: 1, start: "09:00", end: "13:00" }],
        }));
    };

    const updateWindow = (idx: number, patch: Partial<CustomWindow>) => {
        setConfig(c => ({
            ...c,
            customWindows: (c.customWindows || []).map((w, i) => (i === idx ? { ...w, ...patch } : w)),
        }));
    };

    const removeWindow = (idx: number) => {
        setConfig(c => ({
            ...c,
            customWindows: (c.customWindows || []).filter((_, i) => i !== idx),
        }));
    };

    if (loading) {
        return (
            <div className="bg-white rounded-2xl border border-gray-100 p-6 flex items-center justify-center">
                <Loader2 className="h-5 w-5 animate-spin text-gray-300" />
            </div>
        );
    }

    return (
        <div className="bg-white rounded-2xl border border-gray-100 p-6 md:p-8 space-y-5">
            <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-primary/10 text-primary">
                    <Bot className="h-5 w-5" />
                </div>
                <div>
                    <h2 className="text-lg font-bold text-charcoal">Horario del bot</h2>
                    <p className="text-xs text-gray-500 mt-0.5">Cuándo el chatbot responde mensajes automáticamente.</p>
                </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-2">
                {(Object.keys(MODE_INFO) as Mode[]).map(mode => (
                    <button
                        key={mode}
                        onClick={() => setConfig(c => ({ ...c, mode }))}
                        className={`text-left p-3 rounded-xl border transition-colors ${
                            config.mode === mode
                                ? "border-primary bg-primary/5"
                                : "border-gray-200 hover:border-gray-300"
                        }`}
                    >
                        <div className="flex items-center gap-2">
                            <div
                                className={`w-3 h-3 rounded-full border-2 ${
                                    config.mode === mode ? "bg-primary border-primary" : "border-gray-300"
                                }`}
                            />
                            <span className="text-sm font-bold text-charcoal">{MODE_INFO[mode].label}</span>
                        </div>
                        <p className="text-[11px] text-gray-500 mt-1 ml-5">{MODE_INFO[mode].description}</p>
                    </button>
                ))}
            </div>

            {config.mode === "CUSTOM" && (
                <div className="space-y-2 pt-2 border-t border-gray-100">
                    <div className="flex items-center justify-between">
                        <p className="text-xs font-bold text-gray-400 uppercase tracking-widest">Ventanas activas</p>
                        <button onClick={addWindow} className="flex items-center gap-1 text-xs font-semibold text-primary hover:bg-primary/5 px-2 py-1 rounded-lg">
                            <Plus className="h-3 w-3" /> Añadir
                        </button>
                    </div>
                    {(config.customWindows || []).length === 0 ? (
                        <p className="text-xs text-gray-400 italic">Sin ventanas. El bot no responderá hasta que añadas al menos una.</p>
                    ) : (
                        (config.customWindows || []).map((w, idx) => (
                            <div key={idx} className="flex items-center gap-2">
                                <select
                                    value={w.day}
                                    onChange={e => updateWindow(idx, { day: parseInt(e.target.value) })}
                                    className="text-sm bg-white border border-gray-200 rounded-lg px-2 py-1.5 outline-none focus:ring-2 focus:ring-primary/20"
                                >
                                    {DAYS.map((d, i) => (
                                        <option key={i} value={i}>
                                            {d}
                                        </option>
                                    ))}
                                </select>
                                <input
                                    type="time"
                                    value={w.start}
                                    onChange={e => updateWindow(idx, { start: e.target.value })}
                                    className="text-sm bg-white border border-gray-200 rounded-lg px-2 py-1.5 outline-none focus:ring-2 focus:ring-primary/20"
                                />
                                <span className="text-xs text-gray-400">a</span>
                                <input
                                    type="time"
                                    value={w.end}
                                    onChange={e => updateWindow(idx, { end: e.target.value })}
                                    className="text-sm bg-white border border-gray-200 rounded-lg px-2 py-1.5 outline-none focus:ring-2 focus:ring-primary/20"
                                />
                                <button onClick={() => removeWindow(idx)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg">
                                    <X className="h-3.5 w-3.5" />
                                </button>
                            </div>
                        ))
                    )}
                </div>
            )}

            {/* Courtesy auto-reply */}
            {config.mode !== "ALWAYS" && (
                <div className="space-y-2 pt-3 border-t border-gray-100">
                    <label className="flex items-start gap-3 cursor-pointer">
                        <input
                            type="checkbox"
                            checked={config.closedAutoReplyEnabled}
                            onChange={e => setConfig(c => ({ ...c, closedAutoReplyEnabled: e.target.checked }))}
                            className="mt-0.5 h-4 w-4 rounded border-gray-300 text-primary focus:ring-primary"
                        />
                        <div className="flex-1">
                            <p className="text-sm font-semibold text-charcoal flex items-center gap-1.5">
                                <Clock className="h-3.5 w-3.5 text-gray-400" />
                                Mensaje automático fuera de horario
                            </p>
                            <p className="text-xs text-gray-500 mt-0.5">Se envía una sola vez por cliente cada 24h cuando el bot no responde.</p>
                        </div>
                    </label>
                    {config.closedAutoReplyEnabled && (
                        <textarea
                            value={config.closedAutoReply || ""}
                            onChange={e => setConfig(c => ({ ...c, closedAutoReply: e.target.value }))}
                            rows={3}
                            placeholder="Gracias por escribirnos..."
                            className="w-full text-sm bg-white border border-gray-200 rounded-xl px-3 py-2 outline-none focus:ring-2 focus:ring-primary/20 resize-none"
                        />
                    )}
                </div>
            )}

            <div className="flex justify-end pt-2">
                <button
                    onClick={save}
                    disabled={saving}
                    className="flex items-center gap-2 bg-primary text-white px-5 py-2.5 rounded-xl font-bold text-sm hover:bg-primary/90 disabled:opacity-50"
                >
                    {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                    Guardar
                </button>
            </div>
        </div>
    );
}
