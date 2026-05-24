"use client";

import { useState, useEffect } from "react";
import {
    Scissors,
    Plus,
    Trash2,
    Edit3,
    Clock,
    Search,
    Loader2,
    X
} from "lucide-react";

const SERVICE_TYPE_LABELS: Record<string, string> = {
    HAIRCUT: 'Corte',
    BEARD: 'Barba',
    COLOR: 'Color',
    STYLING: 'Styling',
    FACIAL: 'Facial',
    TREATMENT: 'Tratamiento',
};

interface Service {
    id: string;
    name: string;
    description: string;
    price: number;
    duration: number;
    bufferTime: number;
    serviceType: string;
}

export default function ServicesPage() {
    const [services, setServices] = useState<Service[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingService, setEditingService] = useState<Service | null>(null);
    const [formData, setFormData] = useState({ name: "", description: "", price: "", duration: "", bufferTime: "0", serviceType: "HAIRCUT" });

    const fetchServices = async () => {
        try {
            const res = await fetch("/api/services", {
                credentials: 'include'
            });
            const data = await res.json();

            // Handle error response
            if (!res.ok || data.error) {
                console.error("API Error:", data.error || "Unknown error");
                setServices([]);
                return;
            }

            // Ensure data is an array
            if (Array.isArray(data)) {
                setServices(data);
            } else {
                console.error("Unexpected data format:", data);
                setServices([]);
            }
        } catch (error) {
            console.error("Failed to fetch services:", error);
            setServices([]);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchServices();
    }, []);

    const filteredServices = services.filter(s =>
        s.name.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        const method = editingService ? "PUT" : "POST";
        const url = editingService ? `/api/services?id=${editingService.id}` : "/api/services";

        try {
            const payload = {
                name: formData.name,
                description: formData.description || undefined,
                price: parseFloat(formData.price),
                duration: parseInt(formData.duration, 10),
                bufferTime: parseInt(formData.bufferTime, 10) || 0,
                serviceType: formData.serviceType,
            };
            const res = await fetch(url, {
                method,
                headers: { "Content-Type": "application/json" },
                credentials: 'include',
                body: JSON.stringify(payload),
            });
            if (res.ok) {
                fetchServices();
                setIsModalOpen(false);
                setEditingService(null);
                setFormData({ name: "", description: "", price: "", duration: "", bufferTime: "0", serviceType: "HAIRCUT" });
            }
        } catch (error) {
            console.error("Save failed:", error);
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm("¿Estás seguro de eliminar este servicio?")) return;
        try {
            const res = await fetch(`/api/services?id=${id}`, {
                method: "DELETE",
                credentials: 'include'
            });
            if (res.ok) fetchServices();
        } catch (error) {
            console.error("Delete failed:", error);
        }
    };

    const openEdit = (service: Service) => {
        setEditingService(service);
        setFormData({
            name: service.name,
            description: service.description || "",
            price: service.price.toString(),
            duration: service.duration.toString(),
            bufferTime: (service.bufferTime || 0).toString(),
            serviceType: service.serviceType || "HAIRCUT",
        });
        setIsModalOpen(true);
    };

    return (
        <div className="space-y-8 pb-20">
            <div className="flex justify-between items-center">
                <div>
                    <h1 className="text-3xl font-black tracking-tight text-charcoal">Servicios</h1>
                    <p className="text-gray-500 font-medium">Gestiona tu menú de servicios y precios.</p>
                </div>
                <button
                    onClick={() => {
                        setEditingService(null);
                        setFormData({ name: "", description: "", price: "", duration: "", bufferTime: "0", serviceType: "HAIRCUT" });
                        setIsModalOpen(true);
                    }}
                    className="btn-accent-luxury flex items-center gap-2 px-6 py-2.5 rounded-xl font-bold"
                >
                    <Plus className="h-4 w-4" /> Nuevo Servicio
                </button>
            </div>

            {/* Search Bar */}
            <div className="relative max-w-sm group">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 group-focus-within:text-primary transition-colors" />
                <input
                    type="text"
                    placeholder="Buscar servicio..."
                    className="w-full bg-white border border-gray-200 rounded-xl pl-12 pr-4 py-3 text-sm outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary shadow-sm transition-all text-gray-700"
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                />
            </div>

            <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
                {filteredServices.map((service) => (
                    <div key={service.id} className="card-luxury p-6 space-y-4 group relative">
                        <div className="flex justify-between items-start">
                            <div className="p-3 bg-primary/5 rounded-xl">
                                <Scissors className="h-6 w-6 text-primary" />
                            </div>
                            <div className="flex gap-2">
                                <button
                                    onClick={() => openEdit(service)}
                                    className="p-2 hover:bg-gray-50 rounded-xl transition-all border border-transparent hover:border-gray-100"
                                >
                                    <Edit3 className="h-4 w-4 text-gray-400 hover:text-primary transition-colors" />
                                </button>
                                <button
                                    onClick={() => handleDelete(service.id)}
                                    className="p-2 hover:bg-red-50 rounded-xl transition-all border border-transparent hover:border-red-100 text-gray-400 hover:text-red-500"
                                >
                                    <Trash2 className="h-4 w-4" />
                                </button>
                            </div>
                        </div>

                        <div>
                            <div className="flex items-center gap-2">
                                <h3 className="text-xl font-black text-charcoal">{service.name}</h3>
                                {service.serviceType && (
                                    <span className="text-[9px] font-black uppercase tracking-wider bg-primary/10 text-primary px-2 py-0.5 rounded-full">
                                        {SERVICE_TYPE_LABELS[service.serviceType] || service.serviceType}
                                    </span>
                                )}
                            </div>
                            <p className="text-sm font-medium text-gray-500 line-clamp-2 mt-1">{service.description}</p>
                        </div>

                        <div className="flex items-center justify-between pt-6 border-t border-gray-100">
                            <div className="flex flex-col gap-1">
                                <div className="flex items-center gap-2 text-sm font-bold text-gray-600">
                                    <div className="p-1.5 bg-gray-100 rounded-lg">
                                        <Clock className="h-4 w-4 text-gray-400" />
                                    </div>
                                    {service.duration} min
                                </div>
                                {service.bufferTime > 0 && (
                                    <div className="flex items-center gap-2 text-[10px] font-black text-amber-500 uppercase tracking-tighter">
                                        <div className="w-1 h-1 rounded-full bg-amber-500" />
                                        +{service.bufferTime} min limpieza
                                    </div>
                                )}
                            </div>
                            <div className="flex items-center gap-1.5 text-2xl font-black text-primary">
                                <span className="text-xs font-black text-gray-300 uppercase tracking-tighter">RD$</span>
                                {service.price}
                            </div>
                        </div>
                    </div>
                ))}
            </div>

            {filteredServices.length === 0 && (
                <div className="text-center py-24 bg-white rounded-2xl border-2 border-dashed border-gray-200 flex flex-col items-center">
                    <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mb-4">
                        <Scissors className="h-8 w-8 text-gray-200" />
                    </div>
                    <p className="text-gray-400 font-bold uppercase tracking-widest text-sm">No se encontraron servicios</p>
                </div>
            )}

            {/* Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-charcoal/40 backdrop-blur-sm z-[100] flex items-center justify-center p-4">
                    <div className="bg-white w-full max-w-lg rounded-2xl shadow-2xl border border-white/20 overflow-hidden animate-in fade-in zoom-in duration-200">
                        <div className="p-8 border-b border-gray-100 flex items-center justify-between">
                            <h2 className="text-2xl font-black text-charcoal">
                                {editingService ? "Editar Servicio" : "Nuevo Servicio"}
                            </h2>
                            <button onClick={() => setIsModalOpen(false)} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                                <X className="h-6 w-6 text-gray-400" />
                            </button>
                        </div>
                        <form onSubmit={handleSubmit} className="p-8 space-y-6">
                            <div className="space-y-4">
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] ml-1">Nombre</label>
                                    <input
                                        required
                                        className="w-full bg-gray-50 border border-gray-200 rounded-xl px-5 py-3 text-sm font-semibold text-gray-700 outline-none focus:ring-4 focus:ring-primary/5 focus:border-primary transition-all"
                                        placeholder="Ej: Corte Degradado"
                                        value={formData.name}
                                        onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] ml-1">Descripción</label>
                                    <textarea
                                        className="w-full bg-gray-50 border border-gray-200 rounded-xl px-5 py-3 text-sm font-semibold text-gray-700 outline-none focus:ring-4 focus:ring-primary/5 focus:border-primary transition-all h-24 resize-none"
                                        placeholder="Breve descripción del servicio..."
                                        value={formData.description}
                                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                    />
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] ml-1">Tipo de Servicio</label>
                                    <select
                                        required
                                        className="w-full bg-gray-50 border border-gray-200 rounded-xl px-5 py-3 text-sm font-semibold text-gray-700 outline-none focus:ring-4 focus:ring-primary/5 focus:border-primary transition-all"
                                        value={formData.serviceType}
                                        onChange={(e) => setFormData({ ...formData, serviceType: e.target.value })}
                                    >
                                        {Object.entries(SERVICE_TYPE_LABELS).map(([value, label]) => (
                                            <option key={value} value={value}>{label}</option>
                                        ))}
                                    </select>
                                </div>
                                <div className="grid grid-cols-2 gap-4">
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] ml-1">Precio (RD$)</label>
                                        <input
                                            required
                                            type="number"
                                            className="w-full bg-gray-50 border border-gray-200 rounded-xl px-5 py-3 text-sm font-semibold text-gray-700 outline-none focus:ring-4 focus:ring-primary/5 focus:border-primary transition-all"
                                            placeholder="500"
                                            value={formData.price}
                                            onChange={(e) => setFormData({ ...formData, price: e.target.value })}
                                        />
                                    </div>
                                    <div className="space-y-2">
                                        <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] ml-1">Duración (min)</label>
                                        <input
                                            required
                                            type="number"
                                            className="w-full bg-gray-50 border border-gray-200 rounded-xl px-5 py-3 text-sm font-semibold text-gray-700 outline-none focus:ring-4 focus:ring-primary/5 focus:border-primary transition-all"
                                            placeholder="30"
                                            value={formData.duration}
                                            onChange={(e) => setFormData({ ...formData, duration: e.target.value })}
                                        />
                                    </div>
                                </div>
                                <div className="space-y-2">
                                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] ml-1">Limpieza / Buffer (min)</label>
                                    <input
                                        required
                                        type="number"
                                        className="w-full bg-gray-50 border border-gray-200 rounded-xl px-5 py-3 text-sm font-semibold text-gray-700 outline-none focus:ring-4 focus:ring-amber-500/5 focus:border-amber-500 transition-all"
                                        placeholder="10"
                                        value={formData.bufferTime}
                                        onChange={(e) => setFormData({ ...formData, bufferTime: e.target.value })}
                                    />
                                    <p className="text-[9px] text-gray-400 font-medium ml-1">Tiempo bloqueado automáticamente después del servicio.</p>
                                </div>
                            </div>
                            <div className="flex gap-4 pt-4">
                                <button
                                    type="button"
                                    onClick={() => setIsModalOpen(false)}
                                    className="flex-1 py-4 text-sm font-black text-gray-400 hover:text-charcoal transition-all font-sans"
                                >
                                    Cancelar
                                </button>
                                <button className="flex-1 btn-accent-luxury py-4 rounded-xl font-black">
                                    {editingService ? "Guardar Cambios" : "Crear Servicio"}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
