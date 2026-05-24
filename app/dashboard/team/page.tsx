"use client";

import { useState, useEffect } from "react";
import {
    Users,
    UserPlus,
    Shield,
    User,
    Star,
    Trash2,
    Loader2,
    Search,
    Building,
    Phone,
    X
} from "lucide-react";

type Member = {
    id: string;
    role: string;
    user: {
        id: string;
        name: string | null;
        email: string | null;
        phoneNumber?: string | null;
        avatarUrl: string | null;
    };
    team: {
        id: string;
        name: string;
    } | null;
};

function formatPhone(phone: string): string {
    const digits = phone.replace(/\D/g, "");
    if (digits.length === 11 && digits.startsWith("1")) {
        return `+1 (${digits.slice(1, 4)}) ${digits.slice(4, 7)}-${digits.slice(7)}`;
    }
    if (digits.length === 10) {
        return `(${digits.slice(0, 3)}) ${digits.slice(3, 6)}-${digits.slice(6)}`;
    }
    return phone;
}

export default function TeamPage() {
    const [members, setMembers] = useState<Member[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState("");
    const [updatingId, setUpdatingId] = useState<string | null>(null);
    const [showAddModal, setShowAddModal] = useState(false);
    const [addError, setAddError] = useState<string | null>(null);
    const [planName, setPlanName] = useState<string>("TEAM");
    const [maxProfessionals, setMaxProfessionals] = useState<number>(1);

    // Add member form state
    const [newName, setNewName] = useState("");
    const [newPhone, setNewPhone] = useState("");
    const [newRole, setNewRole] = useState<"PROFESSIONAL" | "TEAM_LEADER">("PROFESSIONAL");
    const [adding, setAdding] = useState(false);

    const fetchMembers = async () => {
        try {
            const res = await fetch("/api/team/members");
            const data = await res.json();
            if (Array.isArray(data)) setMembers(data);
        } catch (error) {
            console.error("Error fetching team:", error);
        } finally {
            setLoading(false);
        }
    };

    const fetchPlan = async () => {
        try {
            const res = await fetch("/api/billing/usage");
            if (res.ok) {
                const data = await res.json();
                setPlanName(data.plan || "TEAM");
                setMaxProfessionals(
                    data.maxProfessionals === null || data.maxProfessionals === undefined
                        ? 1
                        : data.maxProfessionals
                );
            }
        } catch { /* non-blocking */ }
    };

    useEffect(() => {
        fetchMembers();
        fetchPlan();
    }, []);

    const professionalCount = members.filter(
        (m) => !["SUPER_ADMIN", "ORG_ADMIN"].includes(m.role)
    ).length;
    const atProfessionalLimit =
        maxProfessionals !== Infinity && professionalCount >= maxProfessionals;
    const canAdd = !atProfessionalLimit || planName === "BUSINESS";

    const handleAddMember = async () => {
        if (!newName.trim() || !newPhone.trim()) {
            setAddError("Nombre y telefono son requeridos");
            return;
        }

        const digits = newPhone.replace(/\D/g, "");
        if (digits.length < 10) {
            setAddError("Numero de telefono invalido (minimo 10 digitos)");
            return;
        }

        setAdding(true);
        setAddError(null);
        try {
            const res = await fetch("/api/team/members", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                credentials: "include",
                body: JSON.stringify({ name: newName.trim(), phone: newPhone.trim(), role: newRole }),
            });
            const data = await res.json();
            if (!res.ok) {
                setAddError(data.error || "Error al añadir miembro");
                return;
            }
            setShowAddModal(false);
            setNewName("");
            setNewPhone("");
            setNewRole("PROFESSIONAL");
            await fetchMembers();
        } catch {
            setAddError("Error de conexion. Intentalo de nuevo.");
        } finally {
            setAdding(false);
        }
    };

    const updateRole = async (memberId: string, newRoleVal: string) => {
        setUpdatingId(memberId);
        try {
            await fetch(`/api/team/members/${memberId}`, {
                method: "PATCH",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ role: newRoleVal }),
            });
            await fetchMembers();
        } catch (error) {
            console.error("Error updating role:", error);
        } finally {
            setUpdatingId(null);
        }
    };

    const removeMember = async (memberId: string) => {
        if (!confirm("¿Estas seguro de que quieres eliminar a este miembro?")) return;
        setUpdatingId(memberId);
        try {
            await fetch(`/api/team/members/${memberId}`, {
                method: "DELETE",
                credentials: "include",
            });
            await fetchMembers();
        } catch (error) {
            console.error("Error removing member:", error);
        } finally {
            setUpdatingId(null);
        }
    };

    const filteredMembers = members.filter(
        (m) =>
            m.user.name?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            (m.user.phoneNumber || "").includes(searchTerm)
    );

    const getRoleBadge = (role: string) => {
        switch (role) {
            case "SUPER_ADMIN":
                return { color: "bg-accent/10 text-accent", label: "Admin Global" };
            case "ORG_ADMIN":
                return { color: "bg-primary/10 text-primary", label: "Dueño" };
            case "TEAM_LEADER":
                return { color: "bg-primary/5 text-primary", label: "Lider" };
            default:
                return { color: "bg-gray-100 text-gray-500", label: "Profesional" };
        }
    };

    return (
        <div className="max-w-7xl space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-end justify-between gap-6">
                <div>
                    <h1 className="text-2xl font-black text-charcoal">Gestion de Equipo</h1>
                    <p className="text-gray-500 mt-2 font-medium">
                        Añade miembros con su numero de telefono. Al iniciar sesion con ese numero, entraran directamente a tu negocio.
                    </p>
                </div>
                <div className="flex flex-col items-end gap-2">
                    <button
                        onClick={() => {
                            if (planName === "SOLO") {
                                setAddError("La gestión de equipo requiere el plan TEAM o BUSINESS. Actualiza tu plan para añadir miembros.");
                                return;
                            }
                            if (!canAdd) {
                                setAddError(`Tu plan ${planName} permite máximo ${maxProfessionals} profesional(es). Actualiza para añadir más.`);
                                return;
                            }
                            setAddError(null);
                            setShowAddModal(true);
                        }}
                        className="flex items-center gap-2 bg-charcoal hover:bg-black text-white px-6 py-3 rounded-xl font-black text-sm transition-all shadow-lg active:scale-95"
                    >
                        <UserPlus className="h-4 w-4" /> Añadir Miembro
                    </button>
                    {!canAdd && planName !== "SOLO" && (
                        <p className="text-xs text-gray-400 font-medium">
                            Limite del plan {planName} ({maxProfessionals} prof.) —{" "}
                            <a href="/dashboard/plans" className="text-primary underline">Actualizar</a>
                        </p>
                    )}
                </div>
            </div>

            {/* Error banner */}
            {addError && !showAddModal && (
                <div className="flex items-start gap-3 p-4 bg-red-50 border border-red-200 rounded-xl">
                    <span className="text-red-500 font-bold text-sm flex-1">{addError}</span>
                    <a href="/dashboard/plans" className="text-xs font-black text-red-600 underline whitespace-nowrap">Ver planes</a>
                    <button onClick={() => setAddError(null)} className="text-red-400 hover:text-red-600 text-lg leading-none ml-2">×</button>
                </div>
            )}

            {/* Stats */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                <div className="card-luxury p-6 flex items-center gap-4">
                    <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center text-primary">
                        <Users className="h-6 w-6" />
                    </div>
                    <div>
                        <span className="block text-2xl font-black">{members.length}</span>
                        <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">Colaboradores</span>
                    </div>
                </div>
            </div>

            {/* Members Table */}
            <div className="card-luxury overflow-hidden">
                <div className="p-6 border-b border-gray-100 bg-ui/50">
                    <div className="relative w-full md:w-96">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Buscar por nombre o telefono..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full bg-white border-none rounded-xl py-3 pl-11 pr-4 text-sm font-medium shadow-sm focus:ring-2 focus:ring-primary/20 transition-all"
                        />
                    </div>
                </div>

                <div className="overflow-x-auto">
                    <table className="w-full border-collapse">
                        <thead>
                            <tr className="bg-ui/50 text-left">
                                <th className="px-8 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Miembro</th>
                                <th className="px-8 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Telefono</th>
                                <th className="px-8 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest">Rol</th>
                                <th className="px-8 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest text-right">Acciones</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                            {loading ? (
                                Array(3)
                                    .fill(0)
                                    .map((_, i) => (
                                        <tr key={i} className="animate-pulse">
                                            <td colSpan={4} className="px-8 py-6 h-20 bg-ui/20"></td>
                                        </tr>
                                    ))
                            ) : filteredMembers.length === 0 ? (
                                <tr>
                                    <td colSpan={4} className="px-8 py-12 text-center text-gray-400 font-medium">
                                        {searchTerm ? "No se encontraron miembros" : "Aun no hay miembros en tu equipo"}
                                    </td>
                                </tr>
                            ) : (
                                filteredMembers.map((member) => {
                                    const roleInfo = getRoleBadge(member.role);
                                    return (
                                        <tr key={member.id} className="group hover:bg-ui/30 transition-colors">
                                            <td className="px-8 py-6">
                                                <div className="flex items-center gap-4">
                                                    <div className="w-10 h-10 rounded-full bg-gray-100 flex items-center justify-center overflow-hidden border-2 border-white shadow-sm">
                                                        {member.user.avatarUrl ? (
                                                            <img src={member.user.avatarUrl} alt="" className="w-full h-full object-cover" />
                                                        ) : (
                                                            <User className="h-5 w-5 text-gray-400" />
                                                        )}
                                                    </div>
                                                    <div>
                                                        <span className="block font-bold text-charcoal">{member.user.name || "Sin nombre"}</span>
                                                        {member.user.id.startsWith("pending_") && (
                                                            <span className="text-[10px] font-bold text-amber-500 uppercase">Pendiente de inicio de sesion</span>
                                                        )}
                                                    </div>
                                                </div>
                                            </td>
                                            <td className="px-8 py-6">
                                                <span className="text-sm font-medium text-gray-600">
                                                    {member.user.phoneNumber ? formatPhone(member.user.phoneNumber) : "—"}
                                                </span>
                                            </td>
                                            <td className="px-8 py-6">
                                                <select
                                                    value={member.role}
                                                    onChange={(e) => updateRole(member.id, e.target.value)}
                                                    disabled={updatingId === member.id || member.role === "SUPER_ADMIN"}
                                                    className={`text-[10px] font-black uppercase tracking-wider px-3 py-1.5 rounded-full border-none focus:ring-0 ${roleInfo.color} cursor-pointer hover:brightness-95 transition-all`}
                                                >
                                                    <option value="ORG_ADMIN">Dueño</option>
                                                    <option value="TEAM_LEADER">Lider Equipo</option>
                                                    <option value="PROFESSIONAL">Profesional</option>
                                                    {member.role === "SUPER_ADMIN" && <option value="SUPER_ADMIN">Admin Global</option>}
                                                </select>
                                            </td>
                                            <td className="px-8 py-6 text-right">
                                                <div className="flex items-center justify-end gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <button
                                                        onClick={() => removeMember(member.id)}
                                                        disabled={member.role === "ORG_ADMIN" || member.role === "SUPER_ADMIN"}
                                                        className="p-2 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-all disabled:opacity-0"
                                                        title={
                                                            member.role === "ORG_ADMIN" || member.role === "SUPER_ADMIN"
                                                                ? "No puedes eliminar al administrador"
                                                                : "Eliminar miembro"
                                                        }
                                                    >
                                                        <Trash2 className="h-4 w-4" />
                                                    </button>
                                                </div>
                                            </td>
                                        </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Add Member Modal */}
            {showAddModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center p-6 bg-charcoal/40 backdrop-blur-sm">
                    <div className="bg-white rounded-2xl p-8 max-w-md w-full shadow-2xl border border-gray-100">
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-xl font-black text-charcoal">Añadir Miembro</h2>
                            <button
                                onClick={() => { setShowAddModal(false); setAddError(null); }}
                                className="p-2 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-all"
                            >
                                <X className="h-5 w-5" />
                            </button>
                        </div>

                        <p className="text-sm text-gray-500 mb-6">
                            Registra al miembro con su numero de telefono. Cuando inicie sesion con ese numero, entrara directamente a tu negocio.
                        </p>

                        <div className="space-y-4">
                            <div>
                                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Nombre *</label>
                                <input
                                    type="text"
                                    value={newName}
                                    onChange={(e) => setNewName(e.target.value)}
                                    placeholder="Ej: Carlos Rodriguez"
                                    className="w-full mt-1 px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-primary focus:ring-0 text-sm font-semibold text-charcoal transition-all"
                                    autoFocus
                                />
                            </div>

                            <div>
                                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Telefono *</label>
                                <div className="relative mt-1">
                                    <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                                    <input
                                        type="tel"
                                        value={newPhone}
                                        onChange={(e) => setNewPhone(e.target.value)}
                                        placeholder="+1 809 123 4567"
                                        className="w-full px-4 py-3 pl-10 rounded-xl border-2 border-gray-200 focus:border-primary focus:ring-0 text-sm font-semibold text-charcoal transition-all"
                                    />
                                </div>
                                <p className="mt-1 text-[11px] text-gray-400">
                                    El numero con el que esta persona iniciara sesion
                                </p>
                            </div>

                            <div>
                                <label className="text-xs font-bold text-gray-500 uppercase tracking-wider">Rol</label>
                                <select
                                    value={newRole}
                                    onChange={(e) => setNewRole(e.target.value as any)}
                                    className="w-full mt-1 px-4 py-3 rounded-xl border-2 border-gray-200 focus:border-primary focus:ring-0 text-sm font-semibold text-charcoal transition-all"
                                >
                                    <option value="PROFESSIONAL">Profesional (barbero, estilista...)</option>
                                    <option value="TEAM_LEADER">Lider de Equipo</option>
                                </select>
                            </div>

                            {addError && (
                                <div className="p-3 bg-red-50 border border-red-200 rounded-xl">
                                    <p className="text-sm font-semibold text-red-600">{addError}</p>
                                </div>
                            )}

                            <button
                                onClick={handleAddMember}
                                disabled={adding}
                                className="w-full flex items-center justify-center gap-2 bg-charcoal hover:bg-black text-white py-3 rounded-xl font-black text-sm transition-all disabled:opacity-50 mt-2"
                            >
                                {adding ? (
                                    <Loader2 className="h-4 w-4 animate-spin" />
                                ) : (
                                    <>
                                        <UserPlus className="h-4 w-4" /> Añadir al Equipo
                                    </>
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
