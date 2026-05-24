"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import ClientAvatar from "@/components/ui/ClientAvatar";
import {
    Users,
    Search,
    Phone,
    Calendar,
    Loader2,
    Star,
    Trophy,
    MoreHorizontal,
    Send,
    X,
    AlertCircle,
    CheckCircle2,
} from "lucide-react";
import { format, formatDistanceToNow } from "date-fns";
import { es } from "date-fns/locale";

// ── Types ─────────────────────────────────────────────────────────────────────

interface LoyaltyProgress {
    visitCount: number;
    visitsRequired: number;
    rewardLabel: string;
    progressPct: number;
    cyclesCompleted: number;
}

type Segment = "active" | "at_risk" | "lost" | "new";

interface Client {
    id: string;
    name: string;
    email: string;
    phoneNumber: string;
    totalSpent: number;
    lastVisit: string | null;
    daysSinceLastVisit: number | null;
    segment: Segment;
    reactivationSentAt: string | null;
    loyaltyProgress: LoyaltyProgress | null;
}

// ── Helpers ───────────────────────────────────────────────────────────────────

const SEGMENT_META: Record<Segment, { label: string; dot: string }> = {
    active:  { label: "Activo",    dot: "bg-emerald-400" },
    at_risk: { label: "En riesgo", dot: "bg-amber-400"   },
    lost:    { label: "Perdido",   dot: "bg-red-400"     },
    new:     { label: "Nuevo",     dot: "bg-blue-400"    },
};

type TabKey = "all" | Segment;

// ── Lightweight Toast ─────────────────────────────────────────────────────────
interface Toast { id: number; message: string; type: "success" | "error" }
let toastId = 0;

// ── Main component ────────────────────────────────────────────────────────────

export default function ClientsPage() {
    const [searchTerm, setSearchTerm]   = useState("");
    const [activeTab, setActiveTab]     = useState<TabKey>("all");
    const [clients, setClients]         = useState<Client[]>([]);
    const [loyaltyActive, setLoyaltyActive] = useState(false);
    const [loading, setLoading]         = useState(true);
    const [sending, setSending]         = useState<Record<string, boolean>>({});
    const [toasts, setToasts]           = useState<Toast[]>([]);
    const [drawerClient, setDrawerClient] = useState<Client | null>(null);
    const [bulkSending, setBulkSending] = useState(false);
    const [showBulkConfirm, setShowBulkConfirm] = useState(false);

    const showToast = (message: string, type: Toast["type"]) => {
        const id = ++toastId;
        setToasts(prev => [...prev, { id, message, type }]);
        setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
    };

    const fetchClients = async () => {
        try {
            const res = await fetch("/api/clients", { credentials: "include" });
            const data = await res.json();
            if (!res.ok || data.error) { setClients([]); return; }
            if (data.clients && Array.isArray(data.clients)) {
                setClients(data.clients);
                setLoyaltyActive(data.loyaltyActive === true);
            } else if (Array.isArray(data)) {
                setClients(data);
            } else {
                setClients([]);
            }
        } catch { setClients([]); }
        finally { setLoading(false); }
    };

    useEffect(() => { fetchClients(); }, []);

    // ── Derived ────────────────────────────────────────────────────────────────

    const searched = clients.filter(c =>
        (c.name || "").toLowerCase().includes(searchTerm.toLowerCase()) ||
        (c.phoneNumber || "").toLowerCase().includes(searchTerm.toLowerCase())
    );

    const displayed = activeTab === "all" ? searched : searched.filter(c => c.segment === activeTab);

    const counts: Record<TabKey, number> = {
        all:     searched.length,
        active:  searched.filter(c => c.segment === "active").length,
        at_risk: searched.filter(c => c.segment === "at_risk").length,
        lost:    searched.filter(c => c.segment === "lost").length,
        new:     searched.filter(c => c.segment === "new").length,
    };

    const reactivatableInTab = displayed.filter(c => c.segment === "at_risk" || c.segment === "lost");

    // ── Send reactivation ──────────────────────────────────────────────────────

    const sendReactivation = async (clientIds: string[]) => {
        const key = clientIds.join(",");
        setSending(prev => ({ ...prev, [key]: true }));
        try {
            const res = await fetch("/api/clients/reactivate", {
                method: "POST",
                credentials: "include",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ clientIds }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
            showToast(
                clientIds.length === 1
                    ? "Mensaje enviado correctamente"
                    : `Campaña enviada: ${data.sent} de ${data.total} mensajes`,
                "success"
            );
            await fetchClients();
            setDrawerClient(null);
            setShowBulkConfirm(false);
        } catch (err: any) {
            showToast(err.message || "Error al enviar", "error");
        } finally {
            setSending(prev => { const n = { ...prev }; delete n[key]; return n; });
            setBulkSending(false);
        }
    };

    // ── Render ─────────────────────────────────────────────────────────────────

    const tabs: { key: TabKey; label: string; activeColor: string }[] = [
        { key: "all",     label: "Todos",      activeColor: "text-charcoal"   },
        { key: "active",  label: "Activos",    activeColor: "text-emerald-600" },
        { key: "at_risk", label: "En riesgo",  activeColor: "text-amber-600"  },
        { key: "lost",    label: "Perdidos",   activeColor: "text-red-500"    },
        { key: "new",     label: "Nuevos",     activeColor: "text-blue-600"   },
    ];

    return (
        <div className="space-y-6 max-w-7xl">
            {/* Header */}
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-2xl font-black text-charcoal">Clientes</h1>
                    <p className="text-gray-500 font-medium">Listado de clientes y su historial de consumo.</p>
                </div>
                <button className="flex items-center gap-2 bg-charcoal text-white px-6 py-2.5 rounded-xl font-bold hover:scale-105 active:scale-95 transition-all shadow-xl">
                    <Users className="h-4 w-4" /> Exportar Lista
                </button>
            </div>

            {/* Search + loyalty badge */}
            <div className="flex items-center gap-4 bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                <div className="relative flex-1 max-w-sm">
                    <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                    <input
                        type="text"
                        placeholder="Buscar por nombre o celular..."
                        className="w-full bg-gray-50 border border-gray-200 rounded-xl pl-12 pr-4 py-2.5 text-sm outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all text-gray-700"
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                    />
                </div>
                {loyaltyActive && (
                    <div className="flex items-center gap-2 text-xs font-bold text-amber-600 bg-amber-50 border border-amber-200 px-3 py-2 rounded-lg">
                        <Star className="h-3.5 w-3.5" />
                        Programa de lealtad activo
                    </div>
                )}
            </div>

            {/* Tabs */}
            <div className="flex items-center gap-1 bg-gray-100 p-1 rounded-xl w-fit">
                {tabs.map(tab => (
                    <button
                        key={tab.key}
                        onClick={() => setActiveTab(tab.key)}
                        className={`flex items-center gap-1.5 px-4 py-2 rounded-lg text-xs font-bold transition-all ${
                            activeTab === tab.key ? "bg-white shadow" : "text-gray-400 hover:text-gray-600"
                        }`}
                    >
                        {tab.key !== "all" && (
                            <span className={`w-2 h-2 rounded-full ${SEGMENT_META[tab.key as Segment].dot}`} />
                        )}
                        <span className={activeTab === tab.key ? tab.activeColor : ""}>{tab.label}</span>
                        <span className={`text-[10px] font-black ${activeTab === tab.key ? tab.activeColor : "text-gray-300"}`}>
                            {counts[tab.key]}
                        </span>
                    </button>
                ))}
            </div>

            {/* Bulk campaign banner */}
            {(activeTab === "at_risk" || activeTab === "lost") && reactivatableInTab.length > 0 && (
                <div className="flex items-center justify-between bg-gradient-to-r from-orange-50 to-amber-50 border border-amber-200 rounded-xl px-5 py-3">
                    <div>
                        <p className="text-sm font-bold text-amber-800">
                            {reactivatableInTab.length} cliente{reactivatableInTab.length > 1 ? "s" : ""}{" "}
                            {activeTab === "at_risk" ? "en riesgo de perderse" : "sin visitar hace más de 60 días"}
                        </p>
                        <p className="text-xs text-amber-600 mt-0.5">Envía un mensaje de reactivación a todos con un clic</p>
                    </div>
                    <button
                        onClick={() => setShowBulkConfirm(true)}
                        disabled={bulkSending}
                        className="flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-white px-5 py-2.5 rounded-xl font-bold text-sm transition-all disabled:opacity-50"
                    >
                        {bulkSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                        Enviar campaña
                    </button>
                </div>
            )}

            {/* Table */}
            <div className="bg-white rounded-xl border border-gray-200 overflow-hidden shadow-sm">
                <table className="w-full text-left">
                    <thead>
                        <tr className="bg-gray-50 border-b border-gray-200">
                            <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-gray-400">Cliente</th>
                            <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-gray-400">Contacto</th>
                            <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-gray-400">Última Visita</th>
                            {loyaltyActive && (
                                <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-amber-500">
                                    <div className="flex items-center gap-1.5"><Star className="h-3 w-3" /> Lealtad</div>
                                </th>
                            )}
                            <th className="px-6 py-4 text-[10px] font-black uppercase tracking-widest text-gray-400">Total Gastado</th>
                            <th className="px-6 py-4"></th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-gray-100">
                        {displayed.map((client) => {
                            const meta = SEGMENT_META[client.segment];
                            const canReactivate = client.segment === "at_risk" || client.segment === "lost";
                            const isSendingThis = sending[client.id];

                            return (
                                <tr key={client.id} className="hover:bg-gray-50/50 transition-colors group">
                                    {/* Name + segment dot */}
                                    <td className="px-6 py-5">
                                        <Link href={`/dashboard/clients/${client.id}`} className="flex items-center gap-3 hover:opacity-90 transition-opacity">
                                            <div className="relative">
                                                <div className="w-10 h-10 rounded-full overflow-hidden ring-1 ring-gray-100">
                                                    <ClientAvatar name={client.name} phoneNumber={client.phoneNumber} size={40} />
                                                </div>
                                                {loyaltyActive && client.loyaltyProgress && client.loyaltyProgress.cyclesCompleted > 0 && (
                                                    <div className="absolute -top-1 -right-1 w-4 h-4 bg-amber-400 rounded-full flex items-center justify-center" title={`${client.loyaltyProgress.cyclesCompleted} recompensa(s)`}>
                                                        <Trophy className="h-2.5 w-2.5 text-white" />
                                                    </div>
                                                )}
                                                <span
                                                    className={`absolute -bottom-0.5 -right-0.5 w-3 h-3 rounded-full border-2 border-white ${meta.dot}`}
                                                    title={meta.label}
                                                />
                                            </div>
                                            <div>
                                                <span className="font-bold text-charcoal block group-hover:text-primary transition-colors">{client.name}</span>
                                                <span className={`text-[10px] font-bold ${
                                                    client.segment === "at_risk" ? "text-amber-500" :
                                                    client.segment === "lost"    ? "text-red-400"   :
                                                    client.segment === "new"     ? "text-blue-400"  : "text-emerald-500"
                                                }`}>{meta.label}</span>
                                            </div>
                                        </Link>
                                    </td>

                                    {/* Contact */}
                                    <td className="px-6 py-5">
                                        <div className="flex items-center gap-2 text-xs font-bold text-gray-500">
                                            <Phone className="h-3 w-3 text-gray-400" /> {client.phoneNumber}
                                        </div>
                                    </td>

                                    {/* Last visit + days */}
                                    <td className="px-6 py-5">
                                        <div className="flex flex-col gap-0.5">
                                            <div className="flex items-center gap-2 text-sm font-bold text-gray-600">
                                                <Calendar className="h-4 w-4 text-gray-300" />
                                                {client.lastVisit
                                                    ? format(new Date(client.lastVisit), "d MMM, yyyy", { locale: es })
                                                    : "Nunca"
                                                }
                                            </div>
                                            {client.daysSinceLastVisit !== null && (
                                                <p className={`text-[10px] font-bold ml-6 ${
                                                    client.segment === "at_risk" ? "text-amber-500" :
                                                    client.segment === "lost"    ? "text-red-400"   : "text-gray-300"
                                                }`}>
                                                    hace {client.daysSinceLastVisit}d
                                                </p>
                                            )}
                                        </div>
                                    </td>

                                    {/* Loyalty */}
                                    {loyaltyActive && (
                                        <td className="px-6 py-5 min-w-[160px]">
                                            {client.loyaltyProgress ? (
                                                <div className="space-y-1.5">
                                                    <div className="flex items-center justify-between">
                                                        <span className="text-xs font-bold text-gray-600">
                                                            {client.loyaltyProgress.visitCount % client.loyaltyProgress.visitsRequired} / {client.loyaltyProgress.visitsRequired} visitas
                                                        </span>
                                                        {client.loyaltyProgress.cyclesCompleted > 0 && (
                                                            <span className="text-[10px] font-black text-amber-600 bg-amber-50 px-1.5 py-0.5 rounded-full">
                                                                ×{client.loyaltyProgress.cyclesCompleted} 🏆
                                                            </span>
                                                        )}
                                                    </div>
                                                    <div className="w-full bg-gray-100 rounded-full h-1.5">
                                                        <div className="bg-amber-400 h-1.5 rounded-full transition-all" style={{ width: `${client.loyaltyProgress.progressPct}%` }} />
                                                    </div>
                                                    <p className="text-[10px] text-gray-400 truncate max-w-[140px]">
                                                        {client.loyaltyProgress.progressPct === 100
                                                            ? `🎉 ¡Ganó ${client.loyaltyProgress.rewardLabel}!`
                                                            : `${client.loyaltyProgress.visitsRequired - (client.loyaltyProgress.visitCount % client.loyaltyProgress.visitsRequired)} para ${client.loyaltyProgress.rewardLabel}`
                                                        }
                                                    </p>
                                                </div>
                                            ) : (
                                                <span className="text-xs text-gray-300 italic">Sin visitas</span>
                                            )}
                                        </td>
                                    )}

                                    {/* Total spent */}
                                    <td className="px-6 py-5">
                                        <span className="px-3 py-1 rounded-full bg-emerald-50 text-emerald-600 border border-emerald-100 font-black text-xs">
                                            RD$ {client.totalSpent.toLocaleString()}
                                        </span>
                                    </td>

                                    {/* Actions */}
                                    <td className="px-6 py-5 text-right">
                                        <div className="flex items-center gap-2 justify-end">
                                            {canReactivate && (
                                                <button
                                                    onClick={() => setDrawerClient(client)}
                                                    disabled={isSendingThis}
                                                    title="Enviar mensaje de reactivación"
                                                    className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-bold transition-all disabled:opacity-50 ${
                                                        client.reactivationSentAt
                                                            ? "text-gray-400 bg-gray-50 border border-gray-200 hover:bg-gray-100"
                                                            : "text-orange-600 bg-orange-50 border border-orange-200 hover:bg-orange-100"
                                                    }`}
                                                >
                                                    {isSendingThis
                                                        ? <Loader2 className="h-3 w-3 animate-spin" />
                                                        : <Send className="h-3 w-3" />
                                                    }
                                                    {client.reactivationSentAt ? "Reenviar" : "Reactivar"}
                                                </button>
                                            )}
                                        </div>
                                    </td>
                                </tr>
                            );
                        })}
                    </tbody>
                </table>

                {displayed.length === 0 && (
                    <div className="py-20 text-center text-gray-300">
                        <Users className="h-12 w-12 mx-auto mb-4 opacity-10" />
                        <p className="text-sm font-bold uppercase tracking-widest italic">No se encontraron clientes</p>
                    </div>
                )}
            </div>

            {/* ── Reactivation preview drawer ───────────────────────────────── */}
            {drawerClient && (
                <div className="fixed inset-0 z-40 flex items-end sm:items-center justify-center">
                    <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setDrawerClient(null)} />
                    <div className="relative z-50 w-full max-w-md bg-white rounded-t-2xl sm:rounded-2xl shadow-2xl p-6 space-y-5">
                        <div className="flex items-center justify-between">
                            <div>
                                <h3 className="text-lg font-black text-charcoal">Enviar reactivación</h3>
                                <p className="text-sm text-gray-400">
                                    Para <span className="font-bold text-gray-600">{drawerClient.name}</span>
                                    {drawerClient.daysSinceLastVisit !== null && (
                                        <> — sin visitar hace{" "}
                                            <span className="font-bold text-red-500">{drawerClient.daysSinceLastVisit} días</span>
                                        </>
                                    )}
                                </p>
                            </div>
                            <button onClick={() => setDrawerClient(null)} className="p-2 hover:bg-gray-100 rounded-xl text-gray-400">
                                <X className="h-5 w-5" />
                            </button>
                        </div>

                        <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 space-y-2">
                            <p className="text-[10px] font-black uppercase tracking-widest text-gray-400">Vista previa del mensaje</p>
                            <MessagePreview clientName={drawerClient.name} />
                        </div>

                        {drawerClient.reactivationSentAt && (
                            <p className="text-xs text-amber-600 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
                                Último mensaje enviado{" "}
                                {formatDistanceToNow(new Date(drawerClient.reactivationSentAt), { locale: es, addSuffix: true })}
                            </p>
                        )}

                        <p className="text-[11px] text-gray-400">
                            Personaliza el mensaje en{" "}
                            <a href="/dashboard/settings" className="underline font-bold">Ajustes → Reactivación</a>.
                        </p>

                        <div className="flex gap-3">
                            <button
                                onClick={() => setDrawerClient(null)}
                                className="flex-1 py-3 rounded-xl text-sm font-bold text-gray-400 border border-gray-200 hover:border-gray-300 transition-all"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={() => sendReactivation([drawerClient.id])}
                                disabled={!!sending[drawerClient.id]}
                                className="flex-1 flex items-center justify-center gap-2 bg-orange-500 hover:bg-orange-600 text-white py-3 rounded-xl text-sm font-bold transition-all disabled:opacity-50"
                            >
                                {sending[drawerClient.id]
                                    ? <Loader2 className="h-4 w-4 animate-spin" />
                                    : <Send className="h-4 w-4" />
                                }
                                Enviar por WhatsApp
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Bulk confirm modal ────────────────────────────────────────── */}
            {showBulkConfirm && (
                <div className="fixed inset-0 z-40 flex items-center justify-center">
                    <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowBulkConfirm(false)} />
                    <div className="relative z-50 w-full max-w-sm bg-white rounded-2xl shadow-2xl p-6 space-y-5">
                        <div className="flex items-start gap-3">
                            <div className="p-2 bg-orange-100 rounded-xl text-orange-500 flex-shrink-0">
                                <Send className="h-5 w-5" />
                            </div>
                            <div>
                                <h3 className="font-black text-charcoal">Enviar campaña masiva</h3>
                                <p className="text-sm text-gray-500 mt-1">
                                    Se enviará un mensaje de reactivación a{" "}
                                    <span className="font-bold text-charcoal">{reactivatableInTab.length} clientes</span>{" "}
                                    {activeTab === "at_risk" ? "en riesgo" : "perdidos"} por WhatsApp.
                                </p>
                            </div>
                        </div>
                        <div className="flex gap-3">
                            <button
                                onClick={() => setShowBulkConfirm(false)}
                                className="flex-1 py-3 rounded-xl text-sm font-bold text-gray-400 border border-gray-200 hover:border-gray-300 transition-all"
                            >
                                Cancelar
                            </button>
                            <button
                                onClick={() => { setBulkSending(true); sendReactivation(reactivatableInTab.map(c => c.id)); }}
                                disabled={bulkSending}
                                className="flex-1 flex items-center justify-center gap-2 bg-orange-500 hover:bg-orange-600 text-white py-3 rounded-xl text-sm font-bold transition-all disabled:opacity-50"
                            >
                                {bulkSending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Send className="h-4 w-4" />}
                                Confirmar envío
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* ── Toasts ────────────────────────────────────────────────────── */}
            <div className="fixed bottom-6 right-6 z-50 flex flex-col gap-2 pointer-events-none">
                {toasts.map(t => (
                    <div key={t.id} className={`flex items-center gap-3 px-4 py-3 rounded-xl shadow-xl text-sm font-semibold pointer-events-auto
                        ${t.type === "success" ? "bg-emerald-600 text-white" : "bg-red-600 text-white"}`}>
                        {t.type === "success" ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
                        <span>{t.message}</span>
                    </div>
                ))}
            </div>
        </div>
    );
}

// ── MessagePreview: loads shop message and renders preview ────────────────────

function MessagePreview({ clientName }: { clientName: string }) {
    const [msg, setMsg] = useState("Cargando...");

    useEffect(() => {
        fetch("/api/shop", { credentials: "include" })
            .then(r => r.json())
            .then(data => {
                const name = clientName || "cliente";
                const shop = data.name || "nosotros";
                setMsg(`Hola ${name}! Hace tiempo que no te vemos por *${shop}*. Esta semana tenemos disponibilidad. Te agendamos algo?`);
            })
            .catch(() => setMsg("No se pudo cargar el mensaje"));
    }, [clientName]);

    return <div className="text-sm text-gray-700 leading-relaxed whitespace-pre-wrap">{msg}</div>;
}
