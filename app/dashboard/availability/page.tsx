"use client";

import { useState, useEffect } from "react";
import {
    Calendar as CalendarIcon,
    Clock,
    Plus,
    Trash2,
    AlertCircle,
    Loader2,
    Sun,
    Coffee,
    UserMinus,
    X,
    Save,
    Check
} from "lucide-react";
import { format, addDays, startOfDay, endOfDay, isSameDay } from "date-fns";
import { es } from "date-fns/locale";

interface TimeBlock {
    id: string;
    name: string;
    type: string;
    startTime: string;
    endTime: string;
}

export default function AvailabilityPage() {
    const [blocks, setBlocks] = useState<TimeBlock[]>([]);
    const [loading, setLoading] = useState(true);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [formData, setFormData] = useState({
        name: "",
        type: "BREAK",
        date: format(new Date(), "yyyy-MM-dd"),
        startTime: "12:00",
        endTime: "13:00",
        stylistId: "" // Loaded from shop on mount
    });
    const [stylistReady, setStylistReady] = useState(false);

    const [weeklySchedules, setWeeklySchedules] = useState<any[]>(
        [0, 1, 2, 3, 4, 5, 6].map(day => ({
            dayOfWeek: day,
            startTime: "09:00",
            endTime: "18:00",
            active: day !== 0 // Sunday closed by default
        }))
    );
    const [savingSettings, setSavingSettings] = useState(false);
    const [saveSuccess, setSaveSuccess] = useState(false);

    const fetchBlocks = async () => {
        if (!formData.stylistId) return;
        try {
            const res = await fetch(`/api/availability/blocks?stylistId=${formData.stylistId}`);
            const data = await res.json();
            if (Array.isArray(data)) {
                setBlocks(data);
            } else {
                setBlocks([]);
            }
        } catch (error) {
            console.error("Fetch error:", error);
        }
    };

    const fetchSettings = async () => {
        if (!formData.stylistId) return;
        try {
            const res = await fetch(`/api/availability/settings?stylistId=${formData.stylistId}`);
            const data = await res.json();
            if (Array.isArray(data) && data.length > 0) {
                const newSchedules = [0, 1, 2, 3, 4, 5, 6].map(day => {
                    const existing = data.find((s: any) => s.dayOfWeek === day);
                    return existing ? { ...existing, active: true } : { dayOfWeek: day, startTime: "09:00", endTime: "18:00", active: false };
                });
                setWeeklySchedules(newSchedules);
            }
        } catch (error) {
            console.error("Fetch settings error:", error);
        }
    };

    const loadAll = async () => {
        setLoading(true);
        await Promise.all([fetchBlocks(), fetchSettings()]);
        setLoading(false);
    };

    // Step 1: load the real stylist ID from the shop
    useEffect(() => {
        fetch('/api/shop')
            .then(r => r.json())
            .then(shop => {
                const firstStylist = shop?.stylists?.[0];
                if (firstStylist?.id) {
                    setFormData(prev => ({ ...prev, stylistId: firstStylist.id }));
                }
                setStylistReady(true);
            })
            .catch(() => setStylistReady(true));
    }, []);

    // Step 2: fetch blocks & settings only once we have a real stylistId
    useEffect(() => {
        if (stylistReady) {
            loadAll();
        }
    }, [stylistReady]);

    const handleSaveSettings = async () => {
        setSavingSettings(true);
        try {
            const res = await fetch("/api/availability/settings", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    stylistId: formData.stylistId,
                    schedules: weeklySchedules
                })
            });
            if (res.ok) {
                setSaveSuccess(true);
                setTimeout(() => setSaveSuccess(false), 3000);
            }
        } catch (error) {
            console.error("Save settings error:", error);
        } finally {
            setSavingSettings(false);
        }
    };

    const updateSchedule = (day: number, updates: any) => {
        setWeeklySchedules(prev => prev.map(s => s.dayOfWeek === day ? { ...s, ...updates } : s));
    };

    const dayNames = ["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"];

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        const start = new Date(`${formData.date}T${formData.startTime}`);
        const end = new Date(`${formData.date}T${formData.endTime}`);

        try {
            const res = await fetch("/api/availability/blocks", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    ...formData,
                    startTime: start.toISOString(),
                    endTime: end.toISOString()
                })
            });

            if (res.ok) {
                fetchBlocks();
                setIsModalOpen(false);
                setFormData({ ...formData, name: "", startTime: "12:00", endTime: "13:00" });
            }
        } catch (error) {
            console.error("Save error:", error);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm("¿Eliminar este bloqueo de tiempo?")) return;
        try {
            const res = await fetch(`/api/availability/blocks?id=${id}`, {  method: "DELETE" , credentials: 'include' });
            if (res.ok) fetchBlocks();
        } catch (error) {
            console.error("Delete error:", error);
        }
    };

    const getTypeIcon = (type: string) => {
        switch (type) {
            case "BREAK": return <Coffee className="h-4 w-4" />;
            case "VACATION": return <Sun className="h-4 w-4" />;
            case "ABSENCE": return <UserMinus className="h-4 w-4" />;
            default: return <Clock className="h-4 w-4" />;
        }
    };

    const getTypeLabel = (type: string) => {
        switch (type) {
            case "BREAK": return "Descanso/Almuerzo";
            case "VACATION": return "Vacaciones";
            case "ABSENCE": return "Ausencia";
            default: return type;
        }
    };

    if (stylistReady && !formData.stylistId) {
        return (
            <div className="flex flex-col h-[60vh] items-center justify-center gap-4 text-center">
                <AlertCircle className="h-10 w-10 text-gray-300" />
                <div>
                    <p className="text-base font-bold text-charcoal">Sin profesionales registrados</p>
                    <p className="text-sm text-gray-400 mt-1">
                        Agrega profesionales a tu equipo para gestionar disponibilidad.
                    </p>
                </div>
                <a href="/dashboard/team" className="text-sm font-bold text-primary underline">
                    Ir a Equipo →
                </a>
            </div>
        );
    }

    return (
        <div className="space-y-8 pb-20">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-black tracking-tight text-charcoal">Disponibilidad</h1>
                    <p className="text-gray-500 font-medium">Gestiona descansos, vacaciones y ausencias del equipo.</p>
                </div>
                <button
                    onClick={() => setIsModalOpen(true)}
                    className="flex items-center gap-2 bg-gray-100 text-charcoal px-6 py-2.5 rounded-xl font-bold hover:bg-gray-200 transition-all border border-gray-200"
                >
                    <Plus className="h-4 w-4" /> Bloquear Horario
                </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
                {/* Weekly Schedule Section */}
                <div className="lg:col-span-2 space-y-6">
                    <div className="card-luxury rounded-2xl overflow-hidden">
                        <div className="p-8 border-b border-gray-100 bg-ui/50 flex items-center justify-between">
                            <div className="flex items-center gap-3">
                                <Clock className="h-5 w-5 text-primary" />
                                <h2 className="font-black text-lg">Horario Semanal</h2>
                            </div>
                            <button
                                onClick={handleSaveSettings}
                                disabled={savingSettings}
                                className={`flex items-center gap-2 px-6 py-2 rounded-xl font-bold transition-all ${saveSuccess
                                    ? 'bg-emerald-500 text-white'
                                    : 'bg-charcoal text-white hover:scale-105 active:scale-95 disabled:opacity-50'
                                    }`}
                            >
                                {savingSettings ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                ) : saveSuccess ? (
                                    <Check className="h-4 w-4" />
                                ) : (
                                    <Save className="h-4 w-4" />
                                )}
                                {saveSuccess ? 'Guardado' : 'Guardar Cambios'}
                            </button>
                        </div>

                        <div className="p-4 space-y-2">
                            {weeklySchedules.map((schedule) => (
                                <div
                                    key={schedule.dayOfWeek}
                                    className={`flex items-center justify-between p-4 rounded-xl transition-all ${schedule.active ? 'bg-white' : 'bg-ui/50 opacity-60'
                                        }`}
                                >
                                    <div className="flex items-center gap-4 w-32">
                                        <button
                                            onClick={() => updateSchedule(schedule.dayOfWeek, { active: !schedule.active })}
                                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors ${schedule.active ? 'bg-primary' : 'bg-gray-200'
                                                }`}
                                        >
                                            <span
                                                className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${schedule.active ? 'translate-x-6' : 'translate-x-1'
                                                    }`}
                                            />
                                        </button>
                                        <span className={`font-black text-sm ${schedule.active ? 'text-charcoal' : 'text-gray-400 line-through'}`}>
                                            {dayNames[schedule.dayOfWeek]}
                                        </span>
                                    </div>

                                    {schedule.active ? (
                                        <div className="flex items-center gap-3">
                                            <input
                                                type="time"
                                                value={schedule.startTime}
                                                onChange={(e) => updateSchedule(schedule.dayOfWeek, { startTime: e.target.value })}
                                                className="bg-gray-50 border border-gray-200 rounded-xl px-3 py-1.5 text-xs font-bold text-gray-700 outline-none focus:border-primary transition-all"
                                            />
                                            <span className="text-gray-300 font-bold">a</span>
                                            <input
                                                type="time"
                                                value={schedule.endTime}
                                                onChange={(e) => updateSchedule(schedule.dayOfWeek, { endTime: e.target.value })}
                                                className="bg-gray-50 border border-gray-200 rounded-xl px-3 py-1.5 text-xs font-bold text-gray-700 outline-none focus:border-primary transition-all"
                                            />
                                        </div>
                                    ) : (
                                        <span className="text-xs font-black text-gray-400 uppercase tracking-widest mr-8">Cerrado</span>
                                    )}
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="card-luxury rounded-2xl overflow-hidden">
                        <div className="p-8 border-b border-gray-100 bg-ui/50 flex items-center gap-3">
                            <CalendarIcon className="h-5 w-5 text-primary" />
                            <h2 className="font-black text-lg">Horarios Bloqueados</h2>
                        </div>

                        <div className="divide-y divide-gray-100 max-h-[400px] overflow-y-auto">
                            {blocks.length === 0 ? (
                                <div className="p-12 text-center">
                                    <div className="w-12 h-12 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4">
                                        <Clock className="h-6 w-6 text-gray-200" />
                                    </div>
                                    <p className="text-gray-400 font-bold uppercase tracking-widest text-xs">No hay bloqueos activos</p>
                                </div>
                            ) : (
                                blocks.map((block) => (
                                    <div key={block.id} className="p-6 flex items-center justify-between group hover:bg-ui/50 transition-colors">
                                        <div className="flex items-center gap-6">
                                            <div className={`p-3 rounded-xl ${block.type === 'BREAK' ? 'bg-blue-50 text-blue-500' :
                                                block.type === 'VACATION' ? 'bg-amber-50 text-amber-500' :
                                                    'bg-red-50 text-red-500'
                                                }`}>
                                                {getTypeIcon(block.type)}
                                            </div>
                                            <div>
                                                <div className="flex items-center gap-2">
                                                    <h4 className="font-black text-charcoal text-sm">{block.name}</h4>
                                                    <span className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 bg-gray-100 text-gray-400 rounded-full">
                                                        {getTypeLabel(block.type)}
                                                    </span>
                                                </div>
                                                <div className="flex items-center gap-3 mt-1">
                                                    <div className="flex items-center gap-1.5 text-xs text-gray-500 font-medium">
                                                        <CalendarIcon className="h-3 w-3" />
                                                        {format(new Date(block.startTime), "d 'de' MMM", { locale: es })}
                                                    </div>
                                                    <div className="flex items-center gap-1.5 text-xs text-gray-500 font-medium font-mono">
                                                        <Clock className="h-3 w-3" />
                                                        {format(new Date(block.startTime), "HH:mm")} - {format(new Date(block.endTime), "HH:mm")}
                                                    </div>
                                                </div>
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => handleDelete(block.id)}
                                            className="p-2 text-gray-300 hover:text-red-500 opacity-0 group-hover:opacity-100 transition-all font-bold text-xs"
                                        >
                                            Eliminar
                                        </button>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>
                </div>

                {/* Info / Tips section */}
                <div className="space-y-6">
                    <div className="bg-primary/5 border border-primary/20 p-8 rounded-2xl space-y-4">
                        <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center">
                            <Sun className="h-5 w-5 text-primary" />
                        </div>
                        <h3 className="text-lg font-black text-charcoal">Consejo de Agenda</h3>
                        <p className="text-sm text-gray-600 font-medium leading-relaxed">
                            Define tu horario base a la izquierda. Los bloqueos se usan para excepciones diarias como citas médicas o descansos extendidos.
                        </p>
                    </div>

                    <div className="bg-charcoal p-8 rounded-2xl space-y-6 text-white shadow-xl">
                        <h3 className="text-lg font-black">Estado del Perfil</h3>
                        <div className="space-y-4">
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-bold text-gray-400">Días Activos</span>
                                <span className="text-xs font-black bg-white/10 px-2 py-1 rounded-lg">
                                    {weeklySchedules.filter(s => s.active).length} / 7
                                </span>
                            </div>
                            <div className="flex items-center justify-between">
                                <span className="text-xs font-bold text-gray-400">Bloqueos Próximos</span>
                                <span className="text-xs font-black bg-white/10 px-2 py-1 rounded-lg">
                                    {blocks.length}
                                </span>
                            </div>
                        </div>
                        <div className="pt-2 border-t border-white/10">
                            <p className="text-[10px] font-bold text-gray-400 leading-relaxed italic">
                                "Tener una agenda bien definida aumenta la confianza de tus clientes en un 40%."
                            </p>
                        </div>
                    </div>
                </div>
            </div>

            {/* Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-charcoal/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
                    <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-white/20 overflow-hidden animate-in fade-in zoom-in duration-200">
                        <div className="p-8 border-b border-gray-100 flex items-center justify-between">
                            <h2 className="text-2xl font-black text-charcoal">Bloquear Horario</h2>
                            <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                                <X className="h-6 w-6 text-gray-400" />
                            </button>
                        </div>
                        <form onSubmit={handleSubmit} className="p-8 space-y-6">
                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] ml-1">Motivo / Nombre</label>
                                    <input
                                        required
                                        className="w-full bg-gray-50 border border-gray-200 rounded-xl px-5 py-3 text-sm font-semibold text-gray-700 outline-none focus:ring-4 focus:ring-primary/5 focus:border-primary transition-all"
                                        placeholder="Ej: Almuerzo Staff"
                                        value={formData.name}
                                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    />
                                </div>

                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] ml-1">Tipo de Bloqueo</label>
                                    <div className="grid grid-cols-3 gap-3">
                                        {['BREAK', 'VACATION', 'ABSENCE'].map((type) => (
                                            <button
                                                key={type}
                                                type="button"
                                                onClick={() => setFormData({ ...formData, type })}
                                                className={`py-3 px-2 rounded-xl text-xs font-black transition-all border-2 ${formData.type === type
                                                    ? 'bg-charcoal border-charcoal text-white shadow-lg'
                                                    : 'bg-white border-gray-100 text-gray-400 hover:border-gray-200'
                                                    }`}
                                            >
                                                {getTypeLabel(type).split('/')[0]}
                                            </button>
                                        ))}
                                    </div>
                                </div>

                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] ml-1">Fecha</label>
                                    <input
                                        required
                                        type="date"
                                        className="w-full bg-gray-50 border border-gray-200 rounded-xl px-5 py-3 text-sm font-semibold text-gray-700 underline-offset-4 outline-none focus:ring-4 focus:ring-primary/5 focus:border-primary transition-all"
                                        value={formData.date}
                                        onChange={(e) => setFormData({ ...formData, date: e.target.value })}
                                    />
                                </div>

                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] ml-1">Desde</label>
                                        <input
                                            required
                                            type="time"
                                            className="w-full bg-gray-50 border border-gray-200 rounded-xl px-5 py-3 text-sm font-semibold text-gray-700 outline-none focus:ring-4 focus:ring-primary/5 focus:border-primary transition-all"
                                            value={formData.startTime}
                                            onChange={(e) => setFormData({ ...formData, startTime: e.target.value })}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] ml-1">Hasta</label>
                                        <input
                                            required
                                            type="time"
                                            className="w-full bg-gray-50 border border-gray-200 rounded-xl px-5 py-3 text-sm font-semibold text-gray-700 outline-none focus:ring-4 focus:ring-primary/5 focus:border-primary transition-all"
                                            value={formData.endTime}
                                            onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                                        />
                                    </div>
                                </div>
                            </div>

                            <div className="bg-amber-50 p-4 rounded-xl border border-amber-100 flex gap-3">
                                <AlertCircle className="h-5 w-5 text-amber-500 shrink-0" />
                                <p className="text-[10px] font-bold text-amber-700 leading-relaxed">
                                    Este horario aparecerá bloqueado en el motor de reservas y no permitirá agendar clientes.
                                </p>
                            </div>

                            <div className="flex gap-4 pt-4">
                                <button
                                    type="button"
                                    onClick={() => setIsModalOpen(false)}
                                    className="flex-1 py-4 text-sm font-black text-gray-400 hover:text-charcoal transition-all"
                                >
                                    Cancelar
                                </button>
                                <button className="btn-accent-luxury flex-1 py-4 rounded-xl font-black">
                                    Confirmar Bloqueo
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
