"use client";

import { useEffect, useState } from "react";
import { Bot, User, RotateCcw, Loader2, AlertCircle } from "lucide-react";

interface ConversationControl {
    controlMode: "BOT" | "HUMAN" | "BOT_PAUSED";
    botResumesAt: string | null;
    humanTookOverAt: string | null;
    takeoverReason: string | null;
}

function hoursUntil(iso: string): string {
    const diff = new Date(iso).getTime() - Date.now();
    if (diff <= 0) return "pronto";
    const h = Math.floor(diff / 3_600_000);
    const m = Math.floor((diff % 3_600_000) / 60_000);
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m`;
}

export default function BotControlWidget({ phone }: { phone: string }) {
    const [status, setStatus] = useState<ConversationControl | null>(null);
    const [loading, setLoading] = useState(true);
    const [acting, setActing] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const encoded = encodeURIComponent(phone);

    useEffect(() => {
        fetch(`/api/whatsapp/conversations/${encoded}/control`, { credentials: "include" })
            .then(r => r.json())
            .then(d => setStatus(d))
            .catch(() => setError("No se pudo cargar el estado del bot"))
            .finally(() => setLoading(false));
    }, [encoded]);

    const act = async (action: "take" | "release") => {
        setActing(true);
        try {
            const res = await fetch(`/api/whatsapp/conversations/${encoded}/control`, {
                method: "POST",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action }),
            });
            const data = await res.json();
            if (res.ok) {
                setError(null);
                setStatus(prev => prev
                    ? {
                        ...prev,
                        controlMode: data.controlMode,
                        humanTookOverAt: action === "take" ? new Date().toISOString() : null,
                        botResumesAt: action === "take"
                            ? new Date(Date.now() + 24 * 3_600_000).toISOString()
                            : null,
                        takeoverReason: action === "take" ? "dashboard" : null,
                    }
                    : null
                );
            } else {
                setError(data.error || "Error al cambiar el control");
            }
        } catch {
            setError("Error de conexión");
        } finally {
            setActing(false);
        }
    };

    if (loading) {
        return (
            <div className="p-3 rounded-xl bg-gray-50 flex items-center gap-2 text-xs text-gray-400">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Cargando estado del bot…
            </div>
        );
    }

    if (error && !status) {
        return (
            <div className="p-3 rounded-xl bg-red-50 border border-red-100 flex items-center gap-2 text-xs text-red-600">
                <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                {error}
            </div>
        );
    }

    const isHuman = status?.controlMode === "HUMAN" || status?.controlMode === "BOT_PAUSED";

    return (
        <>
        {error && (
            <div className="px-3 py-2 rounded-lg bg-red-50 border border-red-100 flex items-center gap-2 text-xs text-red-600">
                <AlertCircle className="h-3.5 w-3.5 shrink-0" />
                {error}
            </div>
        )}
        <div className={`p-4 rounded-xl border flex items-center gap-3 ${isHuman ? "bg-amber-50 border-amber-200" : "bg-emerald-50 border-emerald-200"}`}>
            <div className={`p-2 rounded-lg shrink-0 ${isHuman ? "bg-amber-100 text-amber-600" : "bg-emerald-100 text-emerald-600"}`}>
                {isHuman ? <User className="h-4 w-4" /> : <Bot className="h-4 w-4" />}
            </div>
            <div className="flex-1 min-w-0">
                <p className={`text-xs font-bold ${isHuman ? "text-amber-800" : "text-emerald-800"}`}>
                    {isHuman ? "Conversación con humano" : "Bot activo"}
                </p>
                <p className={`text-[11px] mt-0.5 ${isHuman ? "text-amber-600" : "text-emerald-600"}`}>
                    {isHuman
                        ? status?.botResumesAt
                            ? `El bot vuelve en ${hoursUntil(status.botResumesAt)}`
                            : "El bot está pausado"
                        : "Respondiendo automáticamente"}
                </p>
            </div>
            {isHuman ? (
                <button
                    onClick={() => act("release")}
                    disabled={acting}
                    className="flex items-center gap-1.5 text-xs font-bold text-amber-700 bg-white border border-amber-200 hover:bg-amber-100 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50 shrink-0"
                >
                    {acting ? <Loader2 className="h-3 w-3 animate-spin" /> : <RotateCcw className="h-3 w-3" />}
                    Devolver al bot
                </button>
            ) : (
                <button
                    onClick={() => act("take")}
                    disabled={acting}
                    className="flex items-center gap-1.5 text-xs font-bold text-emerald-700 bg-white border border-emerald-200 hover:bg-emerald-100 px-3 py-1.5 rounded-lg transition-colors disabled:opacity-50 shrink-0"
                >
                    {acting ? <Loader2 className="h-3 w-3 animate-spin" /> : <User className="h-3 w-3" />}
                    Tomar control
                </button>
            )}
        </div>
        </>
    );
}
