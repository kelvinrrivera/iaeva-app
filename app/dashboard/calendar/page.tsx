"use client";

import { useState, useEffect } from "react";
import {
    format,
    startOfMonth,
    endOfMonth,
    startOfWeek,
    endOfWeek,
    eachDayOfInterval,
    isSameMonth,
    isSameDay,
    addMonths,
    subMonths,
} from "date-fns";
import { es } from "date-fns/locale";
import {
    ChevronLeft,
    ChevronRight,
    Plus,
    Clock,
    User,
    Calendar as CalendarIcon,
    Loader2,
    X,
    Check,
    MoreVertical,
    Edit2,
    Trash2,
    AlertCircle,
    DollarSign,
    Banknote,
    CreditCard,
    Smartphone,
    CheckCircle2,
} from "lucide-react";

interface Appointment {
    id: string;
    clientId?: string | null;
    clientName: string;
    clientWhatsApp: string;
    serviceId: string;
    startTime: string;
    endTime: string;
    status: string;
    paidAt?: string | null;
    paidAmount?: number | null;
    paymentMethod?: string | null;
    clientMembershipId?: string | null;
    service?: {
        id: string;
        name: string;
        price: number;
        duration: number;
    };
}

interface AvailableMembership {
    id: string;
    plan: { name: string; totalServices: number };
    servicesRemaining: number;
}

const PAYMENT_METHODS = [
    { value: "CASH",     label: "Efectivo",       Icon: Banknote },
    { value: "CARD",     label: "Tarjeta",         Icon: CreditCard },
    { value: "TRANSFER", label: "Transferencia",   Icon: Smartphone },
    { value: "DEBT",     label: "Fía (crédito)",   Icon: AlertCircle },
];

export default function CalendarPage() {
    const [currentDate, setCurrentDate] = useState(new Date());
    const [selectedDate, setSelectedDate] = useState(new Date());
    const [appointments, setAppointments] = useState<Appointment[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingAppointment, setEditingAppointment] = useState<Appointment | null>(null);
    const [services, setServices] = useState<any[]>([]);

    const [availableSlots, setAvailableSlots] = useState<string[]>([]);
    const [fetchingSlots, setFetchingSlots] = useState(false);
    const [stylists, setStylists] = useState<{ id: string; name: string }[]>([]);

    // Payment modal state
    const [paymentModal, setPaymentModal] = useState<{ apt: Appointment } | null>(null);
    const [paymentData, setPaymentData] = useState({ amount: "", method: "CASH", membershipId: "" });
    const [paymentLoading, setPaymentLoading] = useState(false);
    const [availableMemberships, setAvailableMemberships] = useState<AvailableMembership[]>([]);

    const openPaymentModal = async (apt: Appointment) => {
        setPaymentData({ amount: String(apt.service?.price ?? ""), method: "CASH", membershipId: "" });
        setAvailableMemberships([]);
        setPaymentModal({ apt });
        if (apt.clientId) {
            try {
                const res = await fetch(`/api/memberships/assignments?clientId=${apt.clientId}&status=ACTIVE`);
                if (res.ok) {
                    const data = await res.json();
                    setAvailableMemberships(data.assignments || []);
                }
            } catch {
                /* ignore */
            }
        }
    };

    const handleMarkPaid = async () => {
        if (!paymentModal) return;
        setPaymentLoading(true);
        try {
            const usingMembership = paymentData.method === "MEMBERSHIP" && paymentData.membershipId;
            const body: Record<string, unknown> = {
                paidAt: new Date().toISOString(),
                status: "COMPLETED",
            };
            if (usingMembership) {
                body.clientMembershipId = paymentData.membershipId;
            } else {
                body.paymentMethod = paymentData.method;
                body.paidAmount = parseFloat(paymentData.amount);
            }
            const res = await fetch(`/api/appointments/${paymentModal.apt.id}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify(body),
            });
            if (res.ok) {
                setPaymentModal(null);
                fetchAppointments();
            }
        } catch (err) {
            console.error("Payment failed:", err);
        } finally {
            setPaymentLoading(false);
        }
    };

    // Form state
    const [formData, setFormData] = useState({
        clientName: "",
        clientWhatsApp: "",
        serviceId: "",
        stylistId: "",
        startTime: "",
        status: "CONFIRMED",
    });

    const fetchAppointments = async () => {
        try {
            const res = await fetch("/api/appointments", {
                credentials: 'include'
            });
            const data = await res.json();

            // Handle error response
            if (!res.ok || data.error) {
                console.error("API Error:", data.error || "Unknown error");
                setAppointments([]);
                return;
            }

            // Ensure data is an array
            if (Array.isArray(data)) {
                setAppointments(data);
            } else {
                console.error("Unexpected data format:", data);
                setAppointments([]);
            }
        } catch (error) {
            console.error("Failed to fetch appointments:", error);
            setAppointments([]);
        } finally {
            setLoading(false);
        }
    };

    const fetchServices = async () => {
        try {
            const res = await fetch("/api/services", { credentials: 'include' });
            const data = await res.json();
            setServices(Array.isArray(data) ? data : []);
        } catch (error) {
            console.error("Failed to fetch services:", error);
        }
    };

    const fetchStylists = async () => {
        try {
            const res = await fetch("/api/shop", { credentials: 'include' });
            if (res.ok) {
                const shop = await res.json();
                const list = shop.stylists || [];
                setStylists(list);
                // Pre-select first stylist
                if (list.length > 0) {
                    setFormData(f => ({ ...f, stylistId: f.stylistId || list[0].id }));
                }
            }
        } catch (error) {
            console.error("Failed to fetch stylists:", error);
        }
    };

    const fetchSlots = async () => {
        if (!formData.serviceId) return;
        setFetchingSlots(true);
        try {
            const dateStr = format(selectedDate, "yyyy-MM-dd");
            // Use optimized slots engine — respects walk-ins, gaps, and scoring
            const stylistParam = formData.stylistId ? `&stylistId=${formData.stylistId}` : '';
            const res = await fetch(
                `/api/chatbot/slots-optimized?date=${dateStr}&serviceId=${formData.serviceId}${stylistParam}`,
                { credentials: 'include' }
            );
            const data = await res.json();
            // Extract plain time strings from optimized slots (sorted by score already)
            if (data.slots && Array.isArray(data.slots)) {
                setAvailableSlots(data.slots.map((s: { time: string }) => s.time));
            } else {
                setAvailableSlots([]);
            }
        } catch (error) {
            console.error("Failed to fetch slots:", error);
        } finally {
            setFetchingSlots(false);
        }
    };

    useEffect(() => {
        fetchAppointments();
        fetchServices();
        fetchStylists();
    }, []);

    useEffect(() => {
        if (isModalOpen && !editingAppointment) {
            fetchSlots();
        }
    }, [selectedDate, formData.serviceId, formData.stylistId, isModalOpen]);

    const monthStart = startOfMonth(currentDate);
    const startDate = startOfWeek(monthStart);
    const endDate = endOfWeek(endOfMonth(monthStart));
    const days = eachDayOfInterval({ start: startDate, end: endDate });

    const nextMonth = () => setCurrentDate(addMonths(currentDate, 1));
    const prevMonth = () => setCurrentDate(subMonths(currentDate, 1));

    const selectedDateAppointments = appointments.filter(apt =>
        isSameDay(new Date(apt.startTime), selectedDate)
    );

    const handleOpenModal = (apt: Appointment | null = null) => {
        if (apt) {
            setEditingAppointment(apt);
            const date = new Date(apt.startTime);
            setFormData({
                clientName: apt.clientName,
                clientWhatsApp: apt.clientWhatsApp,
                serviceId: apt.serviceId,
                stylistId: "",
                startTime: format(date, "HH:mm"),
                status: apt.status,
            });
        } else {
            setEditingAppointment(null);
            setFormData({
                clientName: "",
                clientWhatsApp: "",
                serviceId: "",
                stylistId: "",
                startTime: "",
                status: "CONFIRMED",
            });
        }
        setIsModalOpen(true);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        const start = new Date(selectedDate);
        const [hours, minutes] = formData.startTime.split(":");
        start.setHours(parseInt(hours), parseInt(minutes));

        const selectedService = services.find(s => s.id === formData.serviceId);
        const duration = selectedService?.duration || 30;
        const buffer = selectedService?.bufferTime || 0;
        const end = new Date(start.getTime() + (duration + buffer) * 60000);

        const payload = {
            ...formData,
            startTime: start.toISOString(),
            endTime: end.toISOString(),
            stylistId: formData.stylistId || stylists[0]?.id,
        };

        try {
            const url = editingAppointment
                ? `/api/appointments/${editingAppointment.id}`
                : "/api/appointments";
            const method = editingAppointment ? "PATCH" : "POST";

            const res = await fetch(url, {
                method,
                headers: { "Content-Type": "application/json" },
                credentials: 'include',
                body: JSON.stringify(payload)
            });

            if (res.ok) {
                fetchAppointments();
                setIsModalOpen(false);
            }
        } catch (error) {
            console.error("Operation failed:", error);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm("¿Estás seguro de que deseas eliminar esta cita?")) return;

        try {
            const res = await fetch(`/api/appointments/${id}`, {
                method: "DELETE",
                credentials: 'include'
            });
            if (res.ok) {
                fetchAppointments();
            }
        } catch (error) {
            console.error("Delete failed:", error);
        }
    };

    const getStatusStyles = (status: string) => {
        switch (status) {
            case "CONFIRMED":
                return "bg-emerald-50 text-emerald-600 border-emerald-100";
            case "CANCELLED":
                return "bg-rose-50 text-rose-600 border-rose-100";
            case "COMPLETED":
                return "bg-primary/5 text-primary border-blue-100";
            default:
                return "bg-gray-50 text-gray-600 border-gray-100";
        }
    };

    const getStatusLabel = (status: string) => {
        switch (status) {
            case "CONFIRMED": return "Confirmado";
            case "CANCELLED": return "Cancelado";
            case "COMPLETED": return "Completado";
            case "PENDING": return "Pendiente";
            default: return status;
        }
    };

    return (
        <div className="space-y-8 pb-20">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-black tracking-tight text-charcoal">Agenda Profesional</h1>
                    <p className="text-gray-500 font-medium text-sm">Administra turnos, estados y disponibilidad</p>
                </div>
                <button
                    id="add-appointment-btn"
                    onClick={() => handleOpenModal()}
                    className="btn-accent-luxury flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold"
                >
                    <Plus className="h-4 w-4" /> Nueva Cita
                </button>
            </div>

            <div className="grid gap-6 lg:grid-cols-12">
                {/* Calendar Grid */}
                <div className="lg:col-span-8 card-luxury p-8 relative overflow-hidden">
                    <div className="flex items-center justify-between mb-8">
                        <div className="flex items-center gap-4">
                            <h2 className="text-2xl font-black capitalize text-charcoal">
                                {format(currentDate, "MMMM yyyy", { locale: es })}
                            </h2>
                            <button
                                onClick={() => {
                                    setCurrentDate(new Date());
                                    setSelectedDate(new Date());
                                }}
                                className="text-[10px] font-black uppercase tracking-widest text-primary bg-primary/5 px-3 py-1 rounded-full hover:bg-cyan-100 transition-colors"
                            >
                                Hoy
                            </button>
                        </div>
                        <div className="flex gap-2">
                            <button onClick={prevMonth} aria-label="Mes anterior" className="p-2.5 hover:bg-ui border border-gray-200 rounded-xl transition-all text-gray-400 hover:text-primary">
                                <ChevronLeft className="h-5 w-5" />
                            </button>
                            <button onClick={nextMonth} aria-label="Mes siguiente" className="p-2.5 hover:bg-ui border border-gray-200 rounded-xl transition-all text-gray-400 hover:text-primary">
                                <ChevronRight className="h-5 w-5" />
                            </button>
                        </div>
                    </div>

                    <div className="grid grid-cols-7 mb-6 text-center">
                        {["Dom", "Lun", "Mar", "Mie", "Jue", "Vie", "Sab"].map((day) => (
                            <div key={day} className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">
                                {day}
                            </div>
                        ))}
                    </div>

                    <div className="grid grid-cols-7 gap-2">
                        {days.map((day, idx) => {
                            const isSelected = isSameDay(day, selectedDate);
                            const isToday = isSameDay(day, new Date());
                            const isCurrentMonth = isSameMonth(day, monthStart);
                            const dayAppointments = appointments.filter(apt => isSameDay(new Date(apt.startTime), day));
                            const hasApt = dayAppointments.length > 0;

                            return (
                                <button
                                    key={idx}
                                    onClick={() => setSelectedDate(day)}
                                    className={`
                                        h-28 p-3 rounded-2xl transition-all relative flex flex-col items-center justify-center border
                                        ${!isCurrentMonth ? "opacity-20 bg-ui/30 border-transparent pointer-events-none" : "opacity-100 border-gray-100"}
                                        ${isSelected
                                            ? "bg-gradient-to-br from-primary to-primary-dark border-cyan-500 text-white shadow-2xl scale-105 z-10"
                                            : "hover:bg-ui hover:border-gray-200"
                                        }
                                        ${isToday && !isSelected ? "border-cyan-300 ring-1 ring-cyan-200" : ""}
                                    `}
                                >
                                    <span className={`text-sm font-black mb-1 ${isSelected ? "text-white" : isToday ? "text-primary" : "text-charcoal"}`}>
                                        {format(day, "d")}
                                    </span>
                                    {hasApt && (
                                        <div className={`
                                            flex items-center gap-1.5 px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-tighter
                                            ${isSelected ? "bg-white/10 text-white" : "bg-primary/5 text-primary border border-cyan-100"}
                                        `}>
                                            <div className={`w-1 h-1 rounded-full ${isSelected ? "bg-white" : "bg-cyan-600"}`} />
                                            {dayAppointments.length} turnos
                                        </div>
                                    )}
                                    {isToday && !isSelected && (
                                        <div className="absolute top-2 right-2 w-1.5 h-1.5 rounded-full bg-cyan-600" />
                                    )}
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Selected Day Details */}
                <div className="lg:col-span-4 space-y-4">
                    <div className="bg-ui p-8 rounded-2xl border border-gray-200 min-h-[500px] flex flex-col">
                        <div className="flex justify-between items-start mb-8">
                            <h3 className="text-xl font-black flex items-center gap-3 text-charcoal">
                                <div className="p-2 bg-primary/5 rounded-lg">
                                    <CalendarIcon className="h-5 w-5 text-primary" />
                                </div>
                                <div className="flex flex-col">
                                    <span className="text-[10px] uppercase tracking-widest text-gray-400">Detalles del Día</span>
                                    <span>{format(selectedDate, "d 'de' MMMM", { locale: es })}</span>
                                </div>
                            </h3>
                        </div>

                        <div className="space-y-4 flex-1">
                            {selectedDateAppointments.length > 0 ? (
                                selectedDateAppointments.map((apt) => (
                                    <div key={apt.id} className="p-5 rounded-2xl bg-white border border-gray-200 hover:border-cyan-300 transition-all shadow-sm group">
                                        <div className="flex justify-between items-start mb-4">
                                            <div className="flex items-center gap-2 text-primary font-black text-lg">
                                                <Clock className="h-5 w-5" />
                                                {format(new Date(apt.startTime), "HH:mm")}
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <span className={`text-[10px] px-3 py-1 rounded-full border uppercase font-black tracking-tighter ${getStatusStyles(apt.status)}`}>
                                                    {getStatusLabel(apt.status)}
                                                </span>
                                                <div className="relative group/actions">
                                                    <button className="p-1 hover:bg-gray-50 rounded-lg text-gray-400 transition-colors">
                                                        <MoreVertical className="h-4 w-4" />
                                                    </button>
                                                    <div className="absolute right-0 top-full mt-2 w-32 bg-white rounded-xl shadow-xl border border-gray-100 py-1 opacity-0 pointer-events-none group-hover/actions:opacity-100 group-hover/actions:pointer-events-auto transition-all z-20">
                                                        <button
                                                            onClick={() => handleOpenModal(apt)}
                                                            className="w-full text-left px-4 py-2 text-xs font-bold text-gray-600 hover:bg-gray-50 flex items-center gap-2"
                                                        >
                                                            <Edit2 className="h-3 w-3" /> Editar
                                                        </button>
                                                        <button
                                                            onClick={() => handleDelete(apt.id)}
                                                            className="w-full text-left px-4 py-2 text-xs font-bold text-rose-600 hover:bg-rose-50 flex items-center gap-2"
                                                        >
                                                            <Trash2 className="h-3 w-3" /> Eliminar
                                                        </button>
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="space-y-3">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center text-gray-400 overflow-hidden">
                                                    <User className="h-4 w-4" />
                                                </div>
                                                <div>
                                                    <p className="font-bold text-charcoal leading-tight">{apt.clientName}</p>
                                                    <p className="text-[10px] text-gray-400 font-medium">+{apt.clientWhatsApp}</p>
                                                </div>
                                            </div>
                                            <div className="flex items-center gap-2 flex-wrap">
                                                <span className="text-[10px] font-bold text-gray-400 bg-gray-50 px-2 py-0.5 rounded border border-gray-100 uppercase tracking-wide">
                                                    {apt.service?.name}
                                                </span>
                                                <span className="text-[10px] font-medium text-gray-300">•</span>
                                                <span className="text-[10px] font-bold text-primary italic">RD$ {apt.service?.price}</span>
                                            </div>
                                            {/* Payment status / action */}
                                            {apt.paidAt ? (
                                                <div className="flex items-center gap-1.5 text-emerald-600">
                                                    <CheckCircle2 className="h-3.5 w-3.5" />
                                                    <span className="text-[10px] font-bold">Cobrado · RD$ {apt.paidAmount ?? apt.service?.price}</span>
                                                </div>
                                            ) : apt.status !== "CANCELLED" && apt.status !== "NO_SHOW" ? (
                                                <button
                                                    onClick={() => openPaymentModal(apt)}
                                                    className="flex items-center gap-1.5 text-[10px] font-black text-primary bg-primary/5 hover:bg-primary/10 border border-primary/20 px-3 py-1.5 rounded-lg transition-all"
                                                >
                                                    <DollarSign className="h-3 w-3" /> Marcar Cobrado
                                                </button>
                                            ) : null}
                                        </div>
                                    </div>
                                ))
                            ) : (
                                <div className="flex flex-col items-center justify-center py-20 text-gray-300">
                                    <div className="w-16 h-16 rounded-full bg-gray-100 flex items-center justify-center mb-4">
                                        <CalendarIcon className="h-8 w-8 opacity-20" />
                                    </div>
                                    <p className="text-sm font-bold uppercase tracking-widest text-center">No hay citas agendadas</p>
                                    <button
                                        onClick={() => handleOpenModal()}
                                        className="mt-4 text-[10px] font-black uppercase text-primary hover:underline"
                                    >
                                        Agendar ahora
                                    </button>
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            </div>

            {/* Payment Modal */}
            {paymentModal && (
                <div className="fixed inset-0 bg-charcoal/40 backdrop-blur-sm z-[110] flex items-center justify-center p-4">
                    <div className="bg-white w-full max-w-sm rounded-2xl shadow-2xl border border-white/20 overflow-hidden animate-in fade-in zoom-in duration-200">
                        <div className="p-6 border-b border-gray-100 flex items-center justify-between">
                            <div>
                                <h2 className="text-lg font-black text-charcoal">Registrar Cobro</h2>
                                <p className="text-xs text-gray-400 font-medium mt-0.5">{paymentModal.apt.clientName} · {paymentModal.apt.service?.name}</p>
                            </div>
                            <button onClick={() => setPaymentModal(null)} className="p-2 hover:bg-gray-50 rounded-full transition-colors">
                                <X className="h-5 w-5 text-gray-400" />
                            </button>
                        </div>
                        <div className="p-6 space-y-5">
                            {/* Membership shortcut */}
                            {availableMemberships.length > 0 && (
                                <div className="space-y-2 p-3 bg-emerald-50 border border-emerald-100 rounded-xl">
                                    <p className="text-[10px] font-black text-emerald-700 uppercase tracking-widest">Bono activo del cliente</p>
                                    {availableMemberships.map(m => (
                                        <label key={m.id} className="flex items-center gap-2 cursor-pointer">
                                            <input
                                                type="radio"
                                                name="membership-redeem"
                                                checked={paymentData.method === "MEMBERSHIP" && paymentData.membershipId === m.id}
                                                onChange={() => setPaymentData(d => ({ ...d, method: "MEMBERSHIP", membershipId: m.id, amount: "0" }))}
                                                className="h-3.5 w-3.5 text-emerald-600 focus:ring-emerald-500"
                                            />
                                            <span className="text-xs font-semibold text-emerald-900">
                                                {m.plan.name} — {m.servicesRemaining} de {m.plan.totalServices} restantes
                                            </span>
                                        </label>
                                    ))}
                                    {paymentData.method === "MEMBERSHIP" && (
                                        <p className="text-[10px] text-emerald-700 mt-1">Se descontará 1 servicio del bono. No se cobra dinero.</p>
                                    )}
                                </div>
                            )}

                            {/* Amount */}
                            {paymentData.method !== "MEMBERSHIP" && (
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Monto cobrado (RD$)</label>
                                    <input
                                        type="number"
                                        min="0"
                                        step="1"
                                        className="w-full bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 text-sm font-bold text-charcoal outline-none focus:ring-4 focus:ring-cyan-500/10 focus:border-cyan-500 transition-all"
                                        value={paymentData.amount}
                                        onChange={e => setPaymentData(d => ({ ...d, amount: e.target.value }))}
                                        placeholder={String(paymentModal.apt.service?.price ?? "")}
                                    />
                                </div>
                            )}
                            {/* Payment method */}
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Método de pago</label>
                                <div className="grid grid-cols-2 gap-2">
                                    {PAYMENT_METHODS.map(({ value, label, Icon }) => (
                                        <button
                                            key={value}
                                            type="button"
                                            onClick={() => setPaymentData(d => ({ ...d, method: value, membershipId: "", amount: d.amount || String(paymentModal.apt.service?.price ?? "") }))}
                                            className={`flex items-center gap-2 px-3 py-2.5 rounded-xl border text-xs font-bold transition-all ${
                                                paymentData.method === value
                                                    ? "bg-primary text-white border-primary"
                                                    : "bg-gray-50 text-gray-600 border-gray-200 hover:border-primary/40"
                                            }`}
                                        >
                                            <Icon className="h-3.5 w-3.5 shrink-0" />
                                            {label}
                                        </button>
                                    ))}
                                </div>
                                {paymentData.method === "DEBT" && (
                                    <p className="text-[10px] text-amber-600 font-bold mt-1">⚠ El monto se registrará como deuda del cliente.</p>
                                )}
                            </div>
                        </div>
                        <div className="px-6 pb-6 flex gap-3">
                            <button
                                type="button"
                                onClick={() => setPaymentModal(null)}
                                className="flex-1 py-3 text-sm font-black text-gray-400 hover:text-charcoal transition-colors"
                            >
                                Cancelar
                            </button>
                            <button
                                type="button"
                                disabled={paymentLoading || (paymentData.method !== "MEMBERSHIP" && !paymentData.amount) || (paymentData.method === "MEMBERSHIP" && !paymentData.membershipId)}
                                onClick={handleMarkPaid}
                                className="flex-1 btn-accent-luxury py-3 rounded-xl font-black flex items-center justify-center gap-2 disabled:opacity-50"
                            >
                                {paymentLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
                                Confirmar
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Modal Profesional */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-charcoal/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
                    <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-white/20 overflow-hidden animate-in fade-in zoom-in duration-200">
                        <div className="p-8 border-b border-gray-100 flex items-center justify-between bg-ui/50">
                            <div>
                                <h2 className="text-2xl font-black text-charcoal">
                                    {editingAppointment ? "Editar Cita" : "Agendar Nueva Cita"}
                                </h2>
                                <p className="text-xs font-semibold text-gray-400 mt-1">
                                    {format(selectedDate, "EEEE, d 'de' MMMM", { locale: es })}
                                </p>
                            </div>
                            <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-white rounded-full transition-colors shadow-sm">
                                <X className="h-6 w-6 text-gray-400" />
                            </button>
                        </div>
                        <form onSubmit={handleSubmit} className="p-8 space-y-6">
                            <div className="space-y-4">
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] ml-1">Estado</label>
                                        <select
                                            className="w-full bg-gray-50 border border-gray-200 rounded-xl px-5 py-3 text-sm font-semibold text-gray-700 outline-none focus:ring-4 focus:ring-cyan-500/10 focus:border-cyan-500 transition-all appearance-none"
                                            value={formData.status}
                                            onChange={(e) => setFormData({ ...formData, status: e.target.value })}
                                        >
                                            <option value="CONFIRMED">Confirmado</option>
                                            <option value="PENDING">Pendiente</option>
                                            <option value="COMPLETED">Completado</option>
                                            <option value="CANCELLED">Cancelado</option>
                                        </select>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] ml-1">Hora / Slot Disponible</label>
                                        <div className="relative">
                                            <Clock className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                                            {editingAppointment ? (
                                                <input
                                                    required
                                                    type="time"
                                                    className="w-full bg-gray-50 border border-gray-200 rounded-xl pl-12 pr-4 py-3 text-sm font-semibold text-gray-700 outline-none focus:ring-4 focus:ring-cyan-500/10 focus:border-cyan-500 transition-all"
                                                    value={formData.startTime}
                                                    onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                                                />
                                            ) : (
                                                <select
                                                    required
                                                    className="w-full bg-gray-50 border border-gray-200 rounded-xl pl-12 pr-4 py-3 text-sm font-semibold text-gray-700 outline-none focus:ring-4 focus:ring-cyan-500/10 focus:border-cyan-500 transition-all appearance-none disabled:opacity-50"
                                                    value={formData.startTime}
                                                    onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                                                    disabled={!formData.serviceId || fetchingSlots}
                                                >
                                                    <option value="">{fetchingSlots ? "Calculando slots..." : "Selecciona un horario..."}</option>
                                                    {availableSlots.map(slot => (
                                                        <option key={slot} value={slot}>{slot}</option>
                                                    ))}
                                                </select>
                                            )}
                                        </div>
                                        {!editingAppointment && !formData.serviceId && (
                                            <p className="text-[9px] text-amber-500 font-bold ml-1">Selecciona un servicio para ver horarios disponibles.</p>
                                        )}
                                        {!editingAppointment && formData.serviceId && availableSlots.length === 0 && !fetchingSlots && (
                                            <p className="text-[9px] text-rose-500 font-bold ml-1 flex items-center gap-1">
                                                <AlertCircle className="h-2 w-2" /> No hay slots disponibles para este día.
                                            </p>
                                        )}
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] ml-1">Cliente</label>
                                    <div className="relative group">
                                        <User className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 group-focus-within:text-primary transition-colors" />
                                        <input
                                            required
                                            className="w-full bg-gray-50 border border-gray-200 rounded-xl pl-12 pr-4 py-3 text-sm font-semibold text-gray-700 outline-none focus:ring-4 focus:ring-cyan-500/10 focus:border-cyan-500 transition-all"
                                            placeholder="Nombre del cliente"
                                            value={formData.clientName}
                                            onChange={(e) => setFormData({ ...formData, clientName: e.target.value })}
                                        />
                                    </div>
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] ml-1">WhatsApp</label>
                                        <div className="relative group">
                                            <div className="absolute left-4 top-1/2 -translate-y-1/2 text-xs font-bold text-gray-400">+</div>
                                            <input
                                                required
                                                className="w-full bg-gray-50 border border-gray-200 rounded-xl pl-8 pr-4 py-3 text-sm font-semibold text-gray-700 outline-none focus:ring-4 focus:ring-cyan-500/10 focus:border-cyan-500 transition-all"
                                                placeholder="8090000000"
                                                value={formData.clientWhatsApp}
                                                onChange={(e) => setFormData({ ...formData, clientWhatsApp: e.target.value })}
                                            />
                                        </div>
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] ml-1">Servicio</label>
                                        <select
                                            required
                                            className="w-full bg-gray-50 border border-gray-200 rounded-xl px-5 py-3 text-sm font-semibold text-gray-700 outline-none focus:ring-4 focus:ring-cyan-500/10 focus:border-cyan-500 transition-all appearance-none"
                                            value={formData.serviceId}
                                            onChange={(e) => setFormData({ ...formData, serviceId: e.target.value })}
                                        >
                                            <option value="">Seleccionar...</option>
                                            {services.map(s => (
                                                <option key={s.id} value={s.id}>{s.name} (RD$ {s.price})</option>
                                            ))}
                                        </select>
                                    </div>
                                </div>

                                {stylists.length > 1 && (
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] ml-1">Profesional</label>
                                        <select
                                            className="w-full bg-gray-50 border border-gray-200 rounded-xl px-5 py-3 text-sm font-semibold text-gray-700 outline-none focus:ring-4 focus:ring-cyan-500/10 focus:border-cyan-500 transition-all appearance-none"
                                            value={formData.stylistId}
                                            onChange={(e) => setFormData({ ...formData, stylistId: e.target.value })}
                                        >
                                            {stylists.map(s => (
                                                <option key={s.id} value={s.id}>{s.name}</option>
                                            ))}
                                        </select>
                                    </div>
                                )}
                            </div>

                            <div className="flex gap-4 pt-4 border-t border-gray-100">
                                <button
                                    type="button"
                                    onClick={() => setIsModalOpen(false)}
                                    className="flex-1 py-4 text-sm font-black text-gray-400 hover:text-charcoal transition-all"
                                >
                                    Cancelar
                                </button>
                                <button className="flex-1 btn-accent-luxury py-4 rounded-xl font-black flex items-center justify-center gap-2">
                                    {editingAppointment ? <Edit2 className="h-4 w-4" /> : <Check className="h-4 w-4" />}
                                    {editingAppointment ? "Guardar Cambios" : "Agendar"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
