"use client";

import { useState, useEffect, useCallback } from "react";
import {
    Users, Plus, Clock, Loader2, UserCheck,
    Timer, RefreshCw, Calendar, Phone, X,
} from "lucide-react";
import { useToast } from "@/contexts/ToastContext";
import { format } from "date-fns";
import { es } from "date-fns/locale";

// ─── Types ───────────────────────────────────────────────────────────────────

interface WalkIn {
    id: string;
    clientName: string;
    serviceId?: string;
    stylistId?: string;
    whatsappNumber?: string;
    notes?: string;
    arrivedAt: string;
    estimatedEnd?: string;
    status: "WAITING" | "IN_PROGRESS" | "DONE" | "LEFT";
    position: number;
}

interface ScheduledAppointment {
    id: string;
    clientName: string;
    clientWhatsApp?: string;
    startTime: string;
    endTime: string;
    status: string;
    service?: { name: string; duration: number };
    stylist?: { id: string };
    notes?: string;
}

interface Service {
    id: string;
    name: string;
    duration: number;
}

interface Stylist {
    id: string;
    name: string;
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatTime(date: string | Date) {
    return format(new Date(date), "h:mm a", { locale: es });
}

function getWaitLabel(arrivedAt: string): string {
    const diff = Math.floor((Date.now() - new Date(arrivedAt).getTime()) / 60000);
    if (diff < 1) return "Ahora";
    if (diff < 60) return `${diff} min`;
    return `${Math.floor(diff / 60)}h ${diff % 60}m`;
}

function getEstimatedLabel(estimatedEnd?: string): string | null {
    if (!estimatedEnd) return null;
    const diff = Math.round((new Date(estimatedEnd).getTime() - Date.now()) / 60000);
    if (diff <= 0) return "En cualquier momento";
    if (diff < 60) return `~${diff} min`;
    return `~${Math.floor(diff / 60)}h ${diff % 60}m`;
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function WalkInsPage() {
    const [walkIns, setWalkIns] = useState<WalkIn[]>([]);
    const [appointments, setAppointments] = useState<ScheduledAppointment[]>([]);
    const [services, setServices] = useState<Service[]>([]);
    const [stylists, setStylists] = useState<Stylist[]>([]);
    const [loading, setLoading] = useState(true);
    const [showForm, setShowForm] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const toast = useToast();
    const [form, setForm] = useState({
        clientName: "", serviceId: "", stylistId: "",
        whatsappNumber: "", notes: "",
    });

    const fetchQueue = useCallback(async () => {
        try {
            const res = await fetch("/api/walkins");
            if (res.ok) {
                const data = await res.json();
                setWalkIns(Array.isArray(data.walkIns) ? data.walkIns : []);
                setAppointments(Array.isArray(data.appointments) ? data.appointments : []);
            } else {
                const err = await res.json().catch(() => ({}));
                console.error("Queue fetch error:", res.status, err);
            }
        } catch (err) {
            console.error("Failed to fetch queue:", err);
        }
    }, []);

    useEffect(() => {
        const init = async () => {
            try {
                const [svcRes, shopRes] = await Promise.all([
                    fetch("/api/services"),
                    fetch("/api/shop"),
                ]);
                if (svcRes.ok) {
                    const data = await svcRes.json();
                    setServices(Array.isArray(data) ? data : []);
                }
                if (shopRes.ok) {
                    const shop = await shopRes.json();
                    setStylists(shop.stylists || []);
                }
            } catch (err) {
                console.error("Init error:", err);
            }
            await fetchQueue();
            setLoading(false);
        };
        init();
        const interval = setInterval(fetchQueue, 30000);
        return () => clearInterval(interval);
    }, [fetchQueue]);

    const handleAdd = async () => {
        if (!form.clientName.trim()) return;
        setSubmitting(true);
        try {
            const res = await fetch("/api/walkins", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    clientName:     form.clientName.trim(),
                    serviceId:      form.serviceId      || undefined,
                    stylistId:      form.stylistId      || undefined,
                    whatsappNumber: form.whatsappNumber.trim() || undefined,
                    notes:          form.notes          || undefined,
                }),
            });
            if (res.ok) {
                await fetchQueue();
                setForm({ clientName: "", serviceId: "", stylistId: "", whatsappNumber: "", notes: "" });
                setShowForm(false);
                toast.success("Cliente agregado a la cola");
            } else {
                const err = await res.json().catch(() => ({}));
                toast.error(err.error || `Error ${res.status}`);
            }
        } catch (err: any) {
            toast.error(err.message || "Error de conexión");
        } finally {
            setSubmitting(false);
        }
    };

    const removeWalkIn = async (id: string) => {
        const res = await fetch(`/api/walkins/${id}`, { method: "DELETE" });
        if (res.ok) {
            setWalkIns(prev => prev.filter(w => w.id !== id));
            toast.success("Cliente eliminado de la cola");
        } else {
            toast.error("No se pudo eliminar el cliente");
        }
    };

    const inProgress = walkIns.filter(w => w.status === "IN_PROGRESS");
    const waiting    = walkIns.filter(w => w.status === "WAITING");

    return (
        <div className="space-y-6 max-w-4xl">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-black text-charcoal">Cola del Día</h1>
                    <p className="text-sm text-gray-400 mt-0.5">
                        {inProgress.length > 0 && `${inProgress.length} en servicio · `}
                        {waiting.length} esperando · {appointments.length} agendados hoy
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <button
                        onClick={fetchQueue}
                        aria-label="Actualizar cola"
                        className="p-2.5 rounded-xl border border-gray-200 text-gray-400 hover:text-primary hover:border-primary/30 transition-all"
                    >
                        <RefreshCw className="h-4 w-4" />
                    </button>
                    <button
                        onClick={() => setShowForm(!showForm)}
                        className="btn-accent-luxury flex items-center gap-2 h-10 px-5 rounded-xl text-sm font-bold"
                    >
                        <Plus className="h-4 w-4" />
                        Llegó un cliente
                    </button>
                </div>
            </div>

            {/* Formulario */}
            {showForm && (
                <div className="bg-white rounded-2xl border border-primary/20 p-6 shadow-sm space-y-4">
                    <h3 className="text-sm font-black text-charcoal">Agregar a la cola</h3>
                    <div className="grid gap-3 sm:grid-cols-2">
                        <div className="space-y-1">
                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Nombre *</label>
                            <input
                                autoFocus
                                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm font-semibold outline-none focus:ring-2 focus:ring-primary/10 focus:border-primary/30 transition-all"
                                placeholder="Juan Pérez"
                                value={form.clientName}
                                onChange={e => setForm(f => ({ ...f, clientName: e.target.value }))}
                                onKeyDown={e => e.key === "Enter" && handleAdd()}
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">
                                WhatsApp <span className="font-normal normal-case text-green-600">(aviso automático)</span>
                            </label>
                            <input
                                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm font-semibold outline-none focus:ring-2 focus:ring-primary/10 transition-all"
                                placeholder="8091234567"
                                value={form.whatsappNumber}
                                onChange={e => setForm(f => ({ ...f, whatsappNumber: e.target.value }))}
                            />
                        </div>
                        <div className="space-y-1">
                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Servicio</label>
                            <select
                                className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm font-semibold outline-none focus:ring-2 focus:ring-primary/10 transition-all bg-white"
                                value={form.serviceId}
                                onChange={e => setForm(f => ({ ...f, serviceId: e.target.value }))}
                            >
                                <option value="">Sin especificar (30 min)</option>
                                {services.map(s => (
                                    <option key={s.id} value={s.id}>{s.name} ({s.duration} min)</option>
                                ))}
                            </select>
                        </div>
                        {stylists.length > 0 && (
                            <div className="space-y-1">
                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Profesional</label>
                                <select
                                    className="w-full border border-gray-200 rounded-xl px-4 py-2.5 text-sm font-semibold outline-none focus:ring-2 focus:ring-primary/10 transition-all bg-white"
                                    value={form.stylistId}
                                    onChange={e => setForm(f => ({ ...f, stylistId: e.target.value }))}
                                >
                                    <option value="">Cualquiera</option>
                                    {stylists.map(s => (
                                        <option key={s.id} value={s.id}>{s.name}</option>
                                    ))}
                                </select>
                            </div>
                        )}
                    </div>

                    <p className="text-[11px] text-gray-400 bg-gray-50 rounded-lg px-3 py-2">
                        💡 Al agregar, el cliente anterior en servicio se marca como completado automáticamente.
                        {form.whatsappNumber && " Se avisará por WhatsApp ~15 min antes de su turno."}
                    </p>

                    <div className="flex justify-end gap-3">
                        <button
                            onClick={() => { setShowForm(false); }}
                            className="px-5 py-2.5 rounded-xl text-sm font-bold text-gray-400 hover:text-charcoal transition-all"
                        >
                            Cancelar
                        </button>
                        <button
                            onClick={handleAdd}
                            disabled={!form.clientName.trim() || submitting}
                            className="flex items-center gap-2 bg-primary text-white px-6 py-2.5 rounded-xl text-sm font-bold disabled:opacity-50"
                        >
                            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Plus className="h-4 w-4" />}
                            Agregar
                        </button>
                    </div>
                </div>
            )}

            {/* En Servicio */}
            {inProgress.length > 0 && (
                <div className="space-y-2">
                    <SectionLabel icon={<UserCheck className="h-3.5 w-3.5 text-emerald-500" />} label="En Servicio Ahora" />
                    {inProgress.map(w => (
                        <WalkInCard
                            key={w.id}
                            walkIn={w}
                            services={services}
                            stylists={stylists}
                            onRemove={removeWalkIn}
                            variant="active"
                        />
                    ))}
                </div>
            )}

            {/* Cola de Espera */}
            <div className="space-y-2">
                <SectionLabel
                    icon={<Timer className="h-3.5 w-3.5 text-amber-500" />}
                    label={`Cola de Espera (${waiting.length})`}
                />
                {waiting.length === 0 && appointments.length === 0 ? (
                    <EmptyQueue />
                ) : waiting.length === 0 ? (
                    <p className="text-sm text-gray-400 py-2 px-4">Sin walk-ins en espera.</p>
                ) : (
                    waiting.map((w, idx) => (
                        <WalkInCard
                            key={w.id}
                            walkIn={w}
                            position={idx + 1}
                            services={services}
                            stylists={stylists}
                            onRemove={removeWalkIn}
                            variant="waiting"
                        />
                    ))
                )}
            </div>

            {/* Citas Agendadas del Día */}
            {appointments.length > 0 && (
                <div className="space-y-2">
                    <SectionLabel
                        icon={<Calendar className="h-3.5 w-3.5 text-blue-500" />}
                        label={`Citas Agendadas Hoy (${appointments.length})`}
                    />
                    {appointments.map(appt => (
                        <AppointmentCard key={appt.id} appointment={appt} stylists={stylists} />
                    ))}
                </div>
            )}
        </div>
    );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function SectionLabel({ icon, label }: { icon: React.ReactNode; label: string }) {
    return (
        <h2 className="text-xs font-black text-gray-400 uppercase tracking-[0.2em] flex items-center gap-2">
            {icon}
            {label}
        </h2>
    );
}

function EmptyQueue() {
    return (
        <div className="flex flex-col items-center justify-center py-16 bg-white rounded-2xl border border-dashed border-gray-200 gap-3">
            <Users className="h-10 w-10 text-gray-200" />
            <p className="text-sm font-semibold text-gray-400">La cola está vacía</p>
            <p className="text-xs text-gray-300">Usa "Llegó un cliente" cuando alguien llegue sin cita</p>
        </div>
    );
}

function WalkInCard({
    walkIn, position, services, stylists, onRemove, variant,
}: {
    walkIn: WalkIn;
    position?: number;
    services: Service[];
    stylists: Stylist[];
    onRemove: (id: string) => void;
    variant: "active" | "waiting";
}) {
    const service = services.find(s => s.id === walkIn.serviceId);
    const stylist = stylists.find(s => s.id === walkIn.stylistId);
    const estimatedLabel = getEstimatedLabel(walkIn.estimatedEnd);
    const isActive = variant === "active";

    return (
        <div className={`bg-white rounded-2xl border shadow-sm p-4 flex items-center gap-4 ${
            isActive ? "border-emerald-200 bg-emerald-50/30" : "border-gray-100"
        }`}>
            {isActive ? (
                <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-emerald-100 shrink-0">
                    <UserCheck className="h-4 w-4 text-emerald-600" />
                </div>
            ) : position !== undefined ? (
                <div className="flex items-center justify-center w-9 h-9 rounded-xl bg-primary/8 text-primary font-black text-sm shrink-0">
                    #{position}
                </div>
            ) : null}

            <div className="flex-1 min-w-0">
                <p className="font-black text-charcoal text-sm">{walkIn.clientName}</p>
                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    {service && <span className="text-xs text-gray-500 font-medium">{service.name}</span>}
                    {stylist && <span className="text-xs text-gray-400">· {stylist.name}</span>}
                    {walkIn.whatsappNumber && (
                        <span className="flex items-center gap-1 text-xs text-green-600">
                            <Phone className="h-3 w-3" />{walkIn.whatsappNumber}
                        </span>
                    )}
                    {walkIn.notes && <span className="text-xs text-gray-400 italic truncate">· {walkIn.notes}</span>}
                </div>
            </div>

            <div className="flex flex-col items-end gap-1 shrink-0 text-right">
                <div className="flex items-center gap-1 text-xs text-gray-400">
                    <Clock className="h-3.5 w-3.5" />
                    <span className="font-semibold">{getWaitLabel(walkIn.arrivedAt)}</span>
                </div>
                {!isActive && estimatedLabel && (
                    <span className="text-[10px] font-bold text-amber-600 bg-amber-50 border border-amber-100 rounded-md px-1.5 py-0.5">
                        turno en {estimatedLabel}
                    </span>
                )}
                {isActive && walkIn.estimatedEnd && (
                    <span className="text-[10px] font-bold text-emerald-600 bg-emerald-50 border border-emerald-100 rounded-md px-1.5 py-0.5">
                        termina ~{formatTime(walkIn.estimatedEnd)}
                    </span>
                )}
            </div>

            <button
                onClick={() => onRemove(walkIn.id)}
                className="p-1.5 rounded-lg text-gray-300 hover:text-red-500 hover:bg-red-50 transition-all shrink-0"
                title="Quitar de la cola"
            >
                <X className="h-4 w-4" />
            </button>
        </div>
    );
}

function AppointmentCard({
    appointment, stylists,
}: {
    appointment: ScheduledAppointment;
    stylists: Stylist[];
}) {
    const stylist = stylists.find(s => s.id === appointment.stylist?.id);

    return (
        <div className="bg-white rounded-2xl border border-blue-100 bg-blue-50/10 shadow-sm p-4 flex items-center gap-4">
            <div className="flex items-center justify-center w-14 h-9 rounded-xl bg-blue-50 shrink-0">
                <span className="text-xs font-black text-blue-600">{formatTime(appointment.startTime)}</span>
            </div>

            <div className="flex-1 min-w-0">
                <p className="font-black text-charcoal text-sm">{appointment.clientName}</p>
                <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    {appointment.service && (
                        <span className="text-xs text-gray-500 font-medium">{appointment.service.name}</span>
                    )}
                    {stylist && <span className="text-xs text-gray-400">· {stylist.name}</span>}
                    {appointment.clientWhatsApp && (
                        <span className="flex items-center gap-1 text-xs text-green-600">
                            <Phone className="h-3 w-3" />{appointment.clientWhatsApp}
                        </span>
                    )}
                </div>
            </div>

            <div className="flex items-center gap-1 text-xs text-gray-400 shrink-0">
                <Clock className="h-3.5 w-3.5" />
                <span className="font-semibold">{appointment.service?.duration ?? 30} min</span>
            </div>

            <span className="text-[10px] font-bold text-blue-600 bg-blue-50 border border-blue-100 rounded-md px-1.5 py-0.5 shrink-0">
                Agendado
            </span>
        </div>
    );
}
