'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import {
    Ticket, Plus, Loader2, X, Edit2, Power, PowerOff,
    Users as UsersIcon, AlertCircle, Zap,
} from 'lucide-react';
import { useToast } from '@/contexts/ToastContext';

interface Plan {
    id: string;
    name: string;
    description: string | null;
    totalServices: number;
    price: number;
    validityDays: number | null;
    applicableServiceIds: string[];
    active: boolean;
    _count?: { assignments: number };
}

interface Assignment {
    id: string;
    clientId: string;
    planId: string;
    servicesRemaining: number;
    startedAt: string;
    expiresAt: string | null;
    status: string;
    notes: string | null;
    plan: { name: string; totalServices: number; price: number };
    client: { id: string; name: string | null; phoneNumber: string };
}

interface Service {
    id: string;
    name: string;
    price: number;
}

export default function MembershipsPage() {
    const toast = useToast();
    const [plans, setPlans] = useState<Plan[]>([]);
    const [assignments, setAssignments] = useState<Assignment[]>([]);
    const [services, setServices] = useState<Service[]>([]);
    const [loading, setLoading] = useState(true);
    const [showPlanForm, setShowPlanForm] = useState<Plan | 'new' | null>(null);
    const [showAssign, setShowAssign] = useState(false);
    const [upgradeRequired, setUpgradeRequired] = useState(false);

    const fetchAll = useCallback(async () => {
        setLoading(true);
        try {
            const plansRes = await fetch('/api/memberships/plans');
            if (plansRes.status === 403) {
                const err = await plansRes.json().catch(() => ({}));
                if (err?.upgradeRequired) {
                    setUpgradeRequired(true);
                    return;
                }
            }
            const [plansData, assignmentsRes, servicesRes] = await Promise.all([
                plansRes.json(),
                fetch('/api/memberships/assignments?status=ACTIVE').then(r => r.json()),
                fetch('/api/services').then(r => r.json()),
            ]);
            setPlans(plansData.plans || []);
            setAssignments(assignmentsRes.assignments || []);
            setServices(Array.isArray(servicesRes) ? servicesRes : (servicesRes.services || []));
        } catch (err) {
            toast.error('Error cargando datos');
        } finally {
            setLoading(false);
        }
    }, [toast]);

    useEffect(() => { fetchAll(); }, [fetchAll]);

    const togglePlanActive = async (plan: Plan) => {
        const res = await fetch(`/api/memberships/plans/${plan.id}`, {
            method: 'PATCH',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ active: !plan.active }),
        });
        if (res.ok) {
            toast.success(plan.active ? 'Plan desactivado' : 'Plan activado');
            fetchAll();
        } else {
            toast.error('Error al actualizar');
        }
    };

    const deletePlan = async (plan: Plan) => {
        if (!confirm(`¿Eliminar el plan "${plan.name}"? Si tiene asignaciones se desactivará en lugar de eliminarse.`)) return;
        const res = await fetch(`/api/memberships/plans/${plan.id}`, { method: 'DELETE' });
        const data = await res.json();
        if (res.ok) {
            toast.success(data.deactivated ? 'Plan desactivado (tenía asignaciones)' : 'Plan eliminado');
            fetchAll();
        } else {
            toast.error('Error al eliminar');
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-20">
                <Loader2 className="h-8 w-8 animate-spin text-gray-300" />
            </div>
        );
    }

    if (upgradeRequired) {
        return (
            <div className="max-w-2xl mx-auto py-12">
                <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center space-y-5">
                    <div className="w-14 h-14 rounded-2xl bg-primary/10 text-primary flex items-center justify-center mx-auto">
                        <Ticket className="h-7 w-7" />
                    </div>
                    <div>
                        <h1 className="text-2xl font-bold tracking-tight text-charcoal">Membresías y Bonos</h1>
                        <p className="text-sm text-gray-500 mt-2 max-w-md mx-auto">
                            Vende packs prepagados a tus clientes y mejora tu flujo de caja. Disponible desde el plan TEAM.
                        </p>
                    </div>
                    <div className="grid sm:grid-cols-2 gap-3 max-w-md mx-auto pt-2">
                        <div className="bg-gray-50 rounded-xl p-4 text-left">
                            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Cobro adelantado</p>
                            <p className="text-xs text-gray-600">El cliente paga 5 cortes y los consume con el tiempo. Tú facturas hoy.</p>
                        </div>
                        <div className="bg-gray-50 rounded-xl p-4 text-left">
                            <p className="text-xs font-bold text-gray-400 uppercase tracking-widest mb-1">Sin comisiones</p>
                            <p className="text-xs text-gray-600">DomiCita no toca el dinero — cobras como prefieras.</p>
                        </div>
                    </div>
                    <Link
                        href="/dashboard/plans"
                        className="inline-flex items-center gap-2 bg-primary text-white px-6 py-3 rounded-xl font-bold text-sm hover:bg-primary/90"
                    >
                        <Zap className="h-4 w-4" />
                        Ver planes
                    </Link>
                </div>
            </div>
        );
    }

    return (
        <div className="max-w-5xl mx-auto space-y-8">
            {/* Header */}
            <div className="flex items-start justify-between gap-4">
                <div>
                    <h1 className="text-3xl font-bold tracking-tight text-charcoal">Membresías y Bonos</h1>
                    <p className="text-sm text-gray-500 mt-1.5 max-w-2xl">
                        Vende packs prepagados de servicios. Tú cobras al cliente como prefieras (efectivo, transferencia, app de banco) y DomiCita gestiona el saldo automáticamente al cobrar las citas.
                    </p>
                </div>
                <div className="flex items-center gap-2 shrink-0">
                    {plans.filter(p => p.active).length > 0 && (
                        <button
                            onClick={() => setShowAssign(true)}
                            className="flex items-center gap-2 bg-white border border-gray-200 text-charcoal px-4 py-2.5 rounded-xl font-bold text-sm hover:bg-gray-50 transition-colors whitespace-nowrap"
                        >
                            <UsersIcon className="h-4 w-4" />
                            Asignar bono
                        </button>
                    )}
                    <button
                        onClick={() => setShowPlanForm('new')}
                        className="flex items-center gap-2 bg-primary text-white px-4 py-2.5 rounded-xl font-bold text-sm hover:bg-primary/90 transition-colors whitespace-nowrap"
                    >
                        <Plus className="h-4 w-4" />
                        Nuevo plan
                    </button>
                </div>
            </div>

            {/* Plans */}
            <section className="space-y-3">
                <h2 className="text-xs font-bold text-gray-400 uppercase tracking-[0.2em]">Planes disponibles</h2>
                {plans.length === 0 ? (
                    <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center">
                        <Ticket className="h-10 w-10 text-gray-300 mx-auto mb-3" />
                        <p className="text-sm text-gray-500">Aún no has creado ningún plan.</p>
                        <p className="text-xs text-gray-400 mt-1">Crea tu primer pack — ej. "5 cortes por RD$2.000".</p>
                    </div>
                ) : (
                    <div className="grid sm:grid-cols-2 gap-3">
                        {plans.map(plan => (
                            <div key={plan.id} className={`bg-white rounded-2xl border p-5 transition-all ${plan.active ? 'border-gray-100' : 'border-gray-100 opacity-60'}`}>
                                <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0 flex-1">
                                        <h3 className="font-bold text-charcoal truncate">{plan.name}</h3>
                                        {plan.description && <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{plan.description}</p>}
                                    </div>
                                    {!plan.active && <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full shrink-0">Inactivo</span>}
                                </div>
                                <div className="grid grid-cols-3 gap-2 mt-4">
                                    <div>
                                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Servicios</p>
                                        <p className="text-lg font-bold text-charcoal">{plan.totalServices}</p>
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Precio</p>
                                        <p className="text-lg font-bold text-charcoal">RD${plan.price.toLocaleString()}</p>
                                    </div>
                                    <div>
                                        <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Validez</p>
                                        <p className="text-lg font-bold text-charcoal">{plan.validityDays ? `${plan.validityDays}d` : '∞'}</p>
                                    </div>
                                </div>
                                <div className="flex items-center justify-between mt-4 pt-3 border-t border-gray-50">
                                    <span className="text-xs text-gray-500">
                                        {plan._count?.assignments ?? 0} asignaciones
                                    </span>
                                    <div className="flex items-center gap-1">
                                        <button onClick={() => setShowPlanForm(plan)} className="p-1.5 text-gray-400 hover:text-primary hover:bg-primary/5 rounded-lg" title="Editar">
                                            <Edit2 className="h-3.5 w-3.5" />
                                        </button>
                                        <button onClick={() => togglePlanActive(plan)} className="p-1.5 text-gray-400 hover:text-charcoal hover:bg-gray-50 rounded-lg" title={plan.active ? 'Desactivar' : 'Activar'}>
                                            {plan.active ? <PowerOff className="h-3.5 w-3.5" /> : <Power className="h-3.5 w-3.5" />}
                                        </button>
                                        <button onClick={() => deletePlan(plan)} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg" title="Eliminar">
                                            <X className="h-3.5 w-3.5" />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </section>

            {/* Active assignments */}
            <section className="space-y-3">
                <h2 className="text-xs font-bold text-gray-400 uppercase tracking-[0.2em]">Bonos activos ({assignments.length})</h2>
                {assignments.length === 0 ? (
                    <div className="bg-white rounded-2xl border border-gray-100 p-10 text-center">
                        <UsersIcon className="h-10 w-10 text-gray-300 mx-auto mb-3" />
                        <p className="text-sm text-gray-500">No hay bonos activos en este momento.</p>
                        <p className="text-xs text-gray-400 mt-1">Asigna un plan a un cliente desde su ficha.</p>
                    </div>
                ) : (
                    <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden">
                        <table className="w-full text-sm">
                            <thead>
                                <tr className="border-b border-gray-100 text-left">
                                    <th className="px-4 py-3 font-semibold text-gray-500 text-xs uppercase tracking-widest">Cliente</th>
                                    <th className="px-4 py-3 font-semibold text-gray-500 text-xs uppercase tracking-widest">Plan</th>
                                    <th className="px-4 py-3 font-semibold text-gray-500 text-xs uppercase tracking-widest">Restantes</th>
                                    <th className="px-4 py-3 font-semibold text-gray-500 text-xs uppercase tracking-widest">Vence</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-50">
                                {assignments.map(a => (
                                    <tr key={a.id} className="hover:bg-gray-50/50">
                                        <td className="px-4 py-3">
                                            <p className="font-semibold text-charcoal">{a.client.name || 'Sin nombre'}</p>
                                            <p className="text-xs text-gray-400">{a.client.phoneNumber}</p>
                                        </td>
                                        <td className="px-4 py-3 text-gray-600">{a.plan.name}</td>
                                        <td className="px-4 py-3">
                                            <span className={`text-sm font-bold ${a.servicesRemaining <= 1 ? 'text-amber-600' : 'text-charcoal'}`}>
                                                {a.servicesRemaining} / {a.plan.totalServices}
                                            </span>
                                        </td>
                                        <td className="px-4 py-3 text-xs text-gray-500">
                                            {a.expiresAt ? new Date(a.expiresAt).toLocaleDateString('es-DO') : 'Sin vencimiento'}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                )}
            </section>

            {/* Plan form modal */}
            {showPlanForm && (
                <PlanFormModal
                    plan={showPlanForm === 'new' ? null : showPlanForm}
                    services={services}
                    onClose={() => setShowPlanForm(null)}
                    onSaved={() => { setShowPlanForm(null); fetchAll(); }}
                />
            )}

            {/* Assign modal */}
            {showAssign && (
                <AssignModal
                    plans={plans.filter(p => p.active)}
                    onClose={() => setShowAssign(false)}
                    onAssigned={() => { setShowAssign(false); fetchAll(); }}
                />
            )}
        </div>
    );
}

function AssignModal({ plans, onClose, onAssigned }: {
    plans: Plan[];
    onClose: () => void;
    onAssigned: () => void;
}) {
    const toast = useToast();
    const [search, setSearch] = useState('');
    const [searching, setSearching] = useState(false);
    const [results, setResults] = useState<Array<{ id: string; name: string | null; phoneNumber: string }>>([]);
    const [selectedClientId, setSelectedClientId] = useState<string | null>(null);
    const [selectedClientLabel, setSelectedClientLabel] = useState('');
    const [planId, setPlanId] = useState(plans[0]?.id || '');
    const [notes, setNotes] = useState('');
    const [saving, setSaving] = useState(false);

    useEffect(() => {
        if (search.trim().length < 2) { setResults([]); return; }
        const t = setTimeout(async () => {
            setSearching(true);
            try {
                const res = await fetch(`/api/clients?search=${encodeURIComponent(search)}`);
                const data = await res.json();
                setResults(Array.isArray(data) ? data : (data.clients || []));
            } catch {
                /* ignore */
            } finally {
                setSearching(false);
            }
        }, 300);
        return () => clearTimeout(t);
    }, [search]);

    const submit = async () => {
        if (!selectedClientId) { toast.error('Selecciona un cliente'); return; }
        if (!planId) { toast.error('Selecciona un plan'); return; }
        setSaving(true);
        try {
            const res = await fetch('/api/memberships/assignments', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ clientId: selectedClientId, planId, notes: notes.trim() || undefined }),
            });
            const data = await res.json();
            if (!res.ok) { toast.error(data.error || 'Error al asignar'); return; }
            toast.success('Bono asignado');
            onAssigned();
        } catch {
            toast.error('Error de conexión');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl max-w-md w-full max-h-[90vh] overflow-y-auto">
                <div className="flex items-center justify-between p-5 border-b border-gray-100">
                    <h3 className="text-lg font-bold text-charcoal">Asignar bono a cliente</h3>
                    <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg">
                        <X className="h-4 w-4 text-gray-500" />
                    </button>
                </div>
                <div className="p-5 space-y-4">
                    <div>
                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Cliente</label>
                        {selectedClientId ? (
                            <div className="mt-1.5 flex items-center justify-between bg-primary/5 border border-primary/20 rounded-xl px-3 py-2">
                                <span className="text-sm font-semibold text-primary">{selectedClientLabel}</span>
                                <button
                                    onClick={() => { setSelectedClientId(null); setSelectedClientLabel(''); setSearch(''); }}
                                    className="text-xs text-primary/70 hover:text-primary"
                                >Cambiar</button>
                            </div>
                        ) : (
                            <>
                                <input
                                    type="text"
                                    value={search}
                                    onChange={(e) => setSearch(e.target.value)}
                                    placeholder="Buscar por nombre o teléfono"
                                    className="w-full mt-1.5 px-3 py-2 text-sm bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 outline-none"
                                />
                                {(searching || results.length > 0) && (
                                    <div className="mt-2 max-h-48 overflow-y-auto border border-gray-100 rounded-xl divide-y divide-gray-50">
                                        {searching && <p className="text-xs text-gray-400 p-3">Buscando...</p>}
                                        {!searching && results.map(r => (
                                            <button
                                                key={r.id}
                                                onClick={() => {
                                                    setSelectedClientId(r.id);
                                                    setSelectedClientLabel(`${r.name || 'Sin nombre'} · ${r.phoneNumber}`);
                                                }}
                                                className="w-full text-left px-3 py-2 hover:bg-gray-50"
                                            >
                                                <p className="text-sm font-semibold text-charcoal">{r.name || 'Sin nombre'}</p>
                                                <p className="text-xs text-gray-400">{r.phoneNumber}</p>
                                            </button>
                                        ))}
                                    </div>
                                )}
                            </>
                        )}
                    </div>
                    <div>
                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Plan</label>
                        <select
                            value={planId}
                            onChange={(e) => setPlanId(e.target.value)}
                            className="w-full mt-1.5 px-3 py-2 text-sm bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 outline-none"
                        >
                            {plans.map(p => (
                                <option key={p.id} value={p.id}>{p.name} · {p.totalServices} servicios · RD${p.price}</option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Notas (opcional)</label>
                        <textarea
                            value={notes}
                            onChange={(e) => setNotes(e.target.value)}
                            rows={2}
                            placeholder="Pagado en efectivo el 27 abr"
                            className="w-full mt-1.5 px-3 py-2 text-sm bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 outline-none resize-none"
                        />
                    </div>
                    <div className="flex items-start gap-2 bg-amber-50 border border-amber-100 rounded-lg p-3">
                        <AlertCircle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                        <p className="text-xs text-amber-800">
                            Asegúrate de haber cobrado al cliente antes de asignar. DomiCita solo gestiona el saldo del bono — el cobro lo gestionas tú.
                        </p>
                    </div>
                </div>
                <div className="flex items-center justify-end gap-2 p-4 border-t border-gray-100">
                    <button onClick={onClose} className="px-4 py-2 text-sm font-semibold text-gray-500 hover:text-charcoal">
                        Cancelar
                    </button>
                    <button
                        onClick={submit}
                        disabled={saving || !selectedClientId}
                        className="flex items-center gap-2 bg-primary text-white px-4 py-2 rounded-xl font-bold text-sm hover:bg-primary/90 disabled:opacity-50"
                    >
                        {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                        Asignar bono
                    </button>
                </div>
            </div>
        </div>
    );
}

function PlanFormModal({ plan, services, onClose, onSaved }: {
    plan: Plan | null;
    services: Service[];
    onClose: () => void;
    onSaved: () => void;
}) {
    const toast = useToast();
    const [name, setName] = useState(plan?.name || '');
    const [description, setDescription] = useState(plan?.description || '');
    const [totalServices, setTotalServices] = useState(plan?.totalServices || 5);
    const [price, setPrice] = useState(plan?.price || 0);
    const [validityDays, setValidityDays] = useState<number | ''>(plan?.validityDays ?? '');
    const [applicableServiceIds, setApplicableServiceIds] = useState<string[]>(plan?.applicableServiceIds || []);
    const [saving, setSaving] = useState(false);

    const toggleService = (id: string) => {
        setApplicableServiceIds(prev => prev.includes(id) ? prev.filter(s => s !== id) : [...prev, id]);
    };

    const submit = async () => {
        if (!name.trim()) {
            toast.error('Falta el nombre');
            return;
        }
        if (totalServices < 1) {
            toast.error('Servicios debe ser al menos 1');
            return;
        }
        setSaving(true);
        try {
            const body = {
                name: name.trim(),
                description: description.trim() || undefined,
                totalServices,
                price,
                validityDays: validityDays === '' ? null : Number(validityDays),
                applicableServiceIds,
            };
            const res = await fetch(plan ? `/api/memberships/plans/${plan.id}` : '/api/memberships/plans', {
                method: plan ? 'PATCH' : 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(body),
            });
            const data = await res.json();
            if (!res.ok) {
                toast.error(data.error || 'Error al guardar');
                return;
            }
            toast.success(plan ? 'Plan actualizado' : 'Plan creado');
            onSaved();
        } catch {
            toast.error('Error de conexión');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
                <div className="flex items-center justify-between p-5 border-b border-gray-100 sticky top-0 bg-white z-10">
                    <h3 className="text-lg font-bold text-charcoal">{plan ? 'Editar plan' : 'Nuevo plan'}</h3>
                    <button onClick={onClose} className="p-1.5 hover:bg-gray-100 rounded-lg">
                        <X className="h-4 w-4 text-gray-500" />
                    </button>
                </div>
                <div className="p-5 space-y-4">
                    <div>
                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Nombre</label>
                        <input
                            type="text"
                            value={name}
                            onChange={(e) => setName(e.target.value)}
                            placeholder="Pack 5 Cortes"
                            className="w-full mt-1.5 px-3 py-2 text-sm bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 outline-none"
                        />
                    </div>
                    <div>
                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Descripción (opcional)</label>
                        <textarea
                            value={description}
                            onChange={(e) => setDescription(e.target.value)}
                            placeholder="Pack ahorro: 5 cortes con 10% de descuento"
                            rows={2}
                            className="w-full mt-1.5 px-3 py-2 text-sm bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 outline-none resize-none"
                        />
                    </div>
                    <div className="grid grid-cols-2 gap-3">
                        <div>
                            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Servicios incluidos</label>
                            <input
                                type="number"
                                value={totalServices}
                                onChange={(e) => setTotalServices(parseInt(e.target.value) || 0)}
                                min={1} max={100}
                                className="w-full mt-1.5 px-3 py-2 text-sm bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 outline-none"
                            />
                        </div>
                        <div>
                            <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Precio (RD$)</label>
                            <input
                                type="number"
                                value={price}
                                onChange={(e) => setPrice(parseFloat(e.target.value) || 0)}
                                min={0}
                                className="w-full mt-1.5 px-3 py-2 text-sm bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 outline-none"
                            />
                        </div>
                    </div>
                    <div>
                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Validez (días)</label>
                        <input
                            type="number"
                            value={validityDays}
                            onChange={(e) => setValidityDays(e.target.value === '' ? '' : parseInt(e.target.value))}
                            placeholder="Sin vencimiento"
                            min={1}
                            className="w-full mt-1.5 px-3 py-2 text-sm bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 outline-none"
                        />
                        <p className="text-[10px] text-gray-400 mt-1">Déjalo vacío si no quieres que expire.</p>
                    </div>
                    <div>
                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Servicios cubiertos</label>
                        <p className="text-[10px] text-gray-400 mt-0.5">No seleccionar ninguno = el bono cubre cualquier servicio.</p>
                        <div className="mt-2 max-h-40 overflow-y-auto border border-gray-100 rounded-xl divide-y divide-gray-50">
                            {services.length === 0 ? (
                                <p className="text-xs text-gray-400 p-3">No hay servicios. Crea servicios primero en la sección de Servicios.</p>
                            ) : services.map(s => (
                                <label key={s.id} className="flex items-center gap-2 px-3 py-2 hover:bg-gray-50 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={applicableServiceIds.includes(s.id)}
                                        onChange={() => toggleService(s.id)}
                                        className="h-3.5 w-3.5 rounded border-gray-300 text-primary focus:ring-primary"
                                    />
                                    <span className="text-sm text-charcoal flex-1">{s.name}</span>
                                    <span className="text-xs text-gray-400">RD${s.price}</span>
                                </label>
                            ))}
                        </div>
                    </div>
                </div>
                <div className="flex items-center justify-end gap-2 p-4 border-t border-gray-100 sticky bottom-0 bg-white">
                    <button onClick={onClose} className="px-4 py-2 text-sm font-semibold text-gray-500 hover:text-charcoal">
                        Cancelar
                    </button>
                    <button
                        onClick={submit}
                        disabled={saving}
                        className="flex items-center gap-2 bg-primary text-white px-4 py-2 rounded-xl font-bold text-sm hover:bg-primary/90 disabled:opacity-50"
                    >
                        {saving && <Loader2 className="h-4 w-4 animate-spin" />}
                        {plan ? 'Guardar' : 'Crear plan'}
                    </button>
                </div>
            </div>
        </div>
    );
}
