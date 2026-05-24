'use client';

import { useEffect, useState, useCallback, useMemo } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import {
    ArrowLeft, Phone, Mail, MessageSquare, Calendar, Clock, TrendingUp,
    DollarSign, AlertCircle, CheckCircle2, XCircle, Star, Ticket, Plus,
    Loader2, Edit2, Save, Power, Sparkles, ChevronDown, MessagesSquare,
} from 'lucide-react';
import { useToast } from '@/contexts/ToastContext';
import ClientAvatar from '@/components/ui/ClientAvatar';
import BotControlWidget from '@/components/dashboard/BotControlWidget';

interface ClientData {
    id: string;
    name: string | null;
    phoneNumber: string;
    email: string | null;
    notes: string | null;
    isActive: boolean;
    debtAmount: number;
    visitCount: number;
    createdAt: string;
    preferredContact: string | null;
}

interface Stats {
    totalAppointments: number;
    completedCount: number;
    cancelledCount: number;
    noShowCount: number;
    totalSpent: number;
    avgDaysBetween: number | null;
    lastVisitAt: string | null;
    nextAppointmentAt: string | null;
    nextAppointmentService: string | null;
}

interface FavoriteService {
    id: string;
    name: string;
    price: number;
    count: number;
    revenue: number;
}

interface Loyalty {
    enabled: boolean;
    visitsRequired: number;
    currentVisits: number;
    visitsToReward: number;
    rewardLabel: string;
    rewardEarned: boolean;
}

interface Membership {
    id: string;
    planId: string;
    servicesRemaining: number;
    startedAt: string;
    expiresAt: string | null;
    status: string;
    notes: string | null;
    plan: { id: string; name: string; totalServices: number; price: number };
}

interface Appointment {
    id: string;
    startTime: string;
    status: string;
    paidAmount: number | null;
    paymentMethod: string | null;
    service: { id: string; name: string; price: number } | null;
    stylist: { id: string; name: string } | null;
}

interface ChatMessage {
    id: string;
    role: string;
    content: string;
    createdAt: string;
}

interface Detail {
    client: ClientData;
    stats: Stats;
    favoriteServices: FavoriteService[];
    loyalty: Loyalty | null;
    memberships: Membership[];
    appointments: Appointment[];
    chatHistory: ChatMessage[];
}

interface Plan {
    id: string;
    name: string;
    totalServices: number;
    price: number;
    active: boolean;
}

const STATUS_LABELS: Record<string, { label: string; color: string }> = {
    SCHEDULED:  { label: 'Pendiente',  color: 'bg-amber-50 text-amber-700 border-amber-200' },
    CONFIRMED:  { label: 'Confirmada', color: 'bg-blue-50 text-blue-700 border-blue-200' },
    COMPLETED:  { label: 'Completada', color: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
    CANCELLED:  { label: 'Cancelada',  color: 'bg-gray-50 text-gray-500 border-gray-200' },
    NO_SHOW:    { label: 'No-show',    color: 'bg-red-50 text-red-700 border-red-200' },
};

const PAYMENT_LABELS: Record<string, string> = {
    CASH: 'Efectivo',
    CARD: 'Tarjeta',
    TRANSFER: 'Transferencia',
    DEBT: 'Fía',
    MEMBERSHIP: 'Bono',
};

function fmtDate(d: string | null) {
    if (!d) return '—';
    return new Date(d).toLocaleDateString('es-DO', {
        day: 'numeric', month: 'short', year: 'numeric',
    });
}
function fmtDateTime(d: string) {
    return new Date(d).toLocaleString('es-DO', {
        day: 'numeric', month: 'short', year: 'numeric',
        hour: '2-digit', minute: '2-digit',
    });
}
function fmtRD(n: number) {
    return `RD$${n.toLocaleString('es-DO', { maximumFractionDigits: 0 })}`;
}
function relativeDate(d: string | null) {
    if (!d) return '—';
    const days = Math.floor((Date.now() - new Date(d).getTime()) / 86400000);
    if (days === 0) return 'hoy';
    if (days === 1) return 'hace 1 día';
    if (days < 30) return `hace ${days} días`;
    const months = Math.floor(days / 30);
    if (months < 12) return `hace ${months} ${months === 1 ? 'mes' : 'meses'}`;
    const years = Math.floor(months / 12);
    return `hace ${years} ${years === 1 ? 'año' : 'años'}`;
}

export default function ClientDetailPage() {
    const params = useParams<{ id: string }>();
    const router = useRouter();
    const toast = useToast();
    const [detail, setDetail] = useState<Detail | null>(null);
    const [loading, setLoading] = useState(true);
    const [showAssign, setShowAssign] = useState(false);
    const [plans, setPlans] = useState<Plan[]>([]);
    const [editing, setEditing] = useState(false);
    const [statusFilter, setStatusFilter] = useState<string>('ALL');

    const load = useCallback(async () => {
        setLoading(true);
        try {
            const [detailRes, plansRes] = await Promise.all([
                fetch(`/api/clients/${params.id}`),
                fetch('/api/memberships/plans').then(r => r.ok ? r.json() : { plans: [] }),
            ]);
            if (!detailRes.ok) {
                if (detailRes.status === 404) { toast.error('Cliente no encontrado'); router.push('/dashboard/clients'); return; }
                throw new Error(`HTTP ${detailRes.status}`);
            }
            setDetail(await detailRes.json());
            setPlans((plansRes.plans || []).filter((p: Plan) => p.active));
        } catch (err) {
            toast.error('Error cargando datos del cliente');
        } finally {
            setLoading(false);
        }
    }, [params.id, router, toast]);

    useEffect(() => { load(); }, [load]);

    const filteredAppointments = useMemo(() => {
        if (!detail) return [];
        if (statusFilter === 'ALL') return detail.appointments;
        return detail.appointments.filter(a => a.status === statusFilter);
    }, [detail, statusFilter]);

    if (loading || !detail) {
        return (
            <div className="flex items-center justify-center py-20">
                <Loader2 className="h-8 w-8 animate-spin text-gray-300" />
            </div>
        );
    }

    const { client, stats, favoriteServices, loyalty, memberships } = detail;
    const activeMemberships = memberships.filter(m => m.status === 'ACTIVE');
    const archivedMemberships = memberships.filter(m => m.status !== 'ACTIVE');
    const maxFavCount = Math.max(1, ...favoriteServices.map(s => s.count));

    return (
        <div className="max-w-6xl mx-auto space-y-6">
            {/* Back link */}
            <Link href="/dashboard/clients" className="inline-flex items-center gap-1.5 text-xs font-semibold text-gray-400 hover:text-charcoal transition-colors">
                <ArrowLeft className="h-3.5 w-3.5" />
                Volver a clientes
            </Link>

            {/* Header card */}
            <div className="bg-white rounded-2xl border border-gray-100 p-6 md:p-8">
                <div className="flex flex-col md:flex-row md:items-start gap-5">
                    {/* Avatar */}
                    <div className="rounded-2xl overflow-hidden shrink-0 ring-2 ring-white shadow-md">
                        <ClientAvatar name={client.name} phoneNumber={client.phoneNumber} size={80} />
                    </div>

                    {/* Identity */}
                    <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                            <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-charcoal">{client.name || 'Sin nombre'}</h1>
                            {!client.isActive && (
                                <span className="text-[10px] font-bold uppercase tracking-widest text-gray-400 bg-gray-100 px-2 py-0.5 rounded-full">Inactivo</span>
                            )}
                            {client.debtAmount > 0 && (
                                <span className="text-[10px] font-bold uppercase tracking-widest text-amber-700 bg-amber-50 border border-amber-200 px-2 py-0.5 rounded-full">
                                    Fía {fmtRD(client.debtAmount)}
                                </span>
                            )}
                        </div>
                        <div className="mt-2 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-gray-500">
                            <span className="flex items-center gap-1.5"><Phone className="h-3.5 w-3.5" /> {client.phoneNumber}</span>
                            {client.email && <span className="flex items-center gap-1.5"><Mail className="h-3.5 w-3.5" /> {client.email}</span>}
                            <span className="flex items-center gap-1.5 text-xs text-gray-400">Cliente desde {fmtDate(client.createdAt)}</span>
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="flex flex-wrap items-center gap-2 shrink-0">
                        <a
                            href={`https://wa.me/${client.phoneNumber.replace(/\D/g, '')}`}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="flex items-center gap-1.5 bg-[#25D366] text-white px-3.5 py-2 rounded-xl font-bold text-xs hover:bg-[#20BD5A]"
                        >
                            <MessageSquare className="h-3.5 w-3.5" />
                            WhatsApp
                        </a>
                        {plans.length > 0 && (
                            <button
                                onClick={() => setShowAssign(true)}
                                className="flex items-center gap-1.5 bg-primary text-white px-3.5 py-2 rounded-xl font-bold text-xs hover:bg-primary/90"
                            >
                                <Ticket className="h-3.5 w-3.5" />
                                Asignar bono
                            </button>
                        )}
                        <button
                            onClick={() => setEditing(true)}
                            className="flex items-center gap-1.5 bg-white border border-gray-200 text-charcoal px-3.5 py-2 rounded-xl font-bold text-xs hover:bg-gray-50"
                            title="Editar"
                        >
                            <Edit2 className="h-3.5 w-3.5" />
                        </button>
                    </div>
                </div>
            </div>

            {/* KPIs */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
                <KpiCard
                    icon={CheckCircle2}
                    iconClass="text-emerald-600 bg-emerald-50"
                    label="Visitas completadas"
                    value={String(stats.completedCount)}
                    sub={stats.lastVisitAt ? `Última ${relativeDate(stats.lastVisitAt)}` : 'Sin visitas aún'}
                />
                <KpiCard
                    icon={DollarSign}
                    iconClass="text-primary bg-primary/10"
                    label="Gasto total"
                    value={fmtRD(stats.totalSpent)}
                    sub={`Promedio ${stats.completedCount > 0 ? fmtRD(Math.round(stats.totalSpent / stats.completedCount)) : '—'} por cita`}
                />
                <KpiCard
                    icon={Clock}
                    iconClass="text-blue-600 bg-blue-50"
                    label="Frecuencia"
                    value={stats.avgDaysBetween ? `${stats.avgDaysBetween}d` : '—'}
                    sub={stats.avgDaysBetween ? 'Días promedio entre visitas' : 'Aún sin patrón'}
                />
                <KpiCard
                    icon={Calendar}
                    iconClass="text-amber-600 bg-amber-50"
                    label="Próxima cita"
                    value={stats.nextAppointmentAt ? fmtDate(stats.nextAppointmentAt) : '—'}
                    sub={stats.nextAppointmentService || (stats.nextAppointmentAt ? '' : 'Sin citas próximas')}
                />
            </div>

            <div className="grid lg:grid-cols-3 gap-6">
                {/* LEFT COLUMN — bonos + favoritos */}
                <div className="lg:col-span-2 space-y-6">
                    {/* Bonos activos */}
                    <Section
                        icon={Ticket}
                        title="Bonos y Membresías"
                        action={plans.length > 0 ? (
                            <button onClick={() => setShowAssign(true)} className="flex items-center gap-1.5 text-xs font-bold text-primary hover:bg-primary/5 px-2.5 py-1.5 rounded-lg">
                                <Plus className="h-3.5 w-3.5" /> Asignar
                            </button>
                        ) : null}
                    >
                        {activeMemberships.length === 0 ? (
                            <div className="text-center py-8 text-sm text-gray-400">
                                Este cliente no tiene bonos activos.
                                {plans.length === 0 && (
                                    <p className="text-xs mt-1">
                                        <Link href="/dashboard/memberships" className="text-primary font-semibold hover:underline">Crea un plan</Link> primero.
                                    </p>
                                )}
                            </div>
                        ) : (
                            <div className="space-y-3">
                                {activeMemberships.map(m => {
                                    const pct = (m.servicesRemaining / m.plan.totalServices) * 100;
                                    return (
                                        <div key={m.id} className="bg-gradient-to-br from-primary/5 to-emerald-50/40 rounded-xl border border-primary/15 p-4">
                                            <div className="flex items-start justify-between gap-3 mb-3">
                                                <div className="min-w-0">
                                                    <p className="font-bold text-charcoal">{m.plan.name}</p>
                                                    <p className="text-xs text-gray-500 mt-0.5">
                                                        {m.expiresAt ? `Vence ${fmtDate(m.expiresAt)}` : 'Sin vencimiento'}
                                                        {m.notes && <span className="ml-2 italic">· {m.notes}</span>}
                                                    </p>
                                                </div>
                                                <div className="text-right shrink-0">
                                                    <p className="text-2xl font-black text-charcoal leading-none">{m.servicesRemaining}<span className="text-sm font-bold text-gray-400">/{m.plan.totalServices}</span></p>
                                                    <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest mt-0.5">Restantes</p>
                                                </div>
                                            </div>
                                            <div className="h-1.5 bg-white rounded-full overflow-hidden">
                                                <div className="h-full bg-gradient-to-r from-primary to-emerald-500 transition-all" style={{ width: `${pct}%` }} />
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        )}

                        {archivedMemberships.length > 0 && (
                            <details className="mt-4 pt-3 border-t border-gray-100">
                                <summary className="text-xs font-semibold text-gray-400 hover:text-charcoal cursor-pointer flex items-center gap-1.5">
                                    <ChevronDown className="h-3.5 w-3.5" />
                                    Bonos anteriores ({archivedMemberships.length})
                                </summary>
                                <div className="mt-3 space-y-2">
                                    {archivedMemberships.map(m => (
                                        <div key={m.id} className="flex items-center justify-between text-xs bg-gray-50 rounded-lg px-3 py-2">
                                            <span className="text-gray-600">{m.plan.name}</span>
                                            <span className="text-gray-400">{m.status === 'EXHAUSTED' ? 'Agotado' : m.status === 'EXPIRED' ? 'Expirado' : 'Cancelado'} · {fmtDate(m.startedAt)}</span>
                                        </div>
                                    ))}
                                </div>
                            </details>
                        )}
                    </Section>

                    {/* Servicios favoritos */}
                    {favoriteServices.length > 0 && (
                        <Section icon={Sparkles} title="Servicios favoritos">
                            <div className="space-y-2.5">
                                {favoriteServices.map(s => (
                                    <div key={s.id}>
                                        <div className="flex items-center justify-between text-sm mb-1">
                                            <span className="font-semibold text-charcoal truncate">{s.name}</span>
                                            <span className="text-xs text-gray-400 shrink-0 ml-2">{s.count} {s.count === 1 ? 'vez' : 'veces'} · {fmtRD(s.revenue)}</span>
                                        </div>
                                        <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                                            <div className="h-full bg-gradient-to-r from-primary to-primary/70 transition-all" style={{ width: `${(s.count / maxFavCount) * 100}%` }} />
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </Section>
                    )}

                    {/* Historial de citas */}
                    <Section
                        icon={Calendar}
                        title="Historial de citas"
                        action={
                            <select
                                value={statusFilter}
                                onChange={(e) => setStatusFilter(e.target.value)}
                                className="text-xs font-semibold bg-white border border-gray-200 rounded-lg px-2.5 py-1.5 outline-none focus:ring-2 focus:ring-primary/20"
                            >
                                <option value="ALL">Todos ({detail.appointments.length})</option>
                                <option value="COMPLETED">Completadas ({stats.completedCount})</option>
                                <option value="CONFIRMED">Confirmadas</option>
                                <option value="SCHEDULED">Pendientes</option>
                                <option value="CANCELLED">Canceladas ({stats.cancelledCount})</option>
                                <option value="NO_SHOW">No-show ({stats.noShowCount})</option>
                            </select>
                        }
                    >
                        {filteredAppointments.length === 0 ? (
                            <div className="text-center py-8 text-sm text-gray-400">Sin citas en este filtro.</div>
                        ) : (
                            <div className="overflow-x-auto -mx-2">
                                <table className="w-full text-sm min-w-[480px]">
                                    <thead>
                                        <tr className="text-left">
                                            <th className="px-2 pb-3 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Fecha</th>
                                            <th className="px-2 pb-3 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Servicio</th>
                                            <th className="px-2 pb-3 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Profesional</th>
                                            <th className="px-2 pb-3 text-[10px] font-bold text-gray-400 uppercase tracking-widest">Estado</th>
                                            <th className="px-2 pb-3 text-[10px] font-bold text-gray-400 uppercase tracking-widest text-right">Pago</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-50">
                                        {filteredAppointments.map(a => {
                                            const status = STATUS_LABELS[a.status] ?? { label: a.status, color: 'bg-gray-50 text-gray-500 border-gray-200' };
                                            return (
                                                <tr key={a.id} className="hover:bg-gray-50/50">
                                                    <td className="px-2 py-3 text-xs text-gray-600 whitespace-nowrap">{fmtDateTime(a.startTime)}</td>
                                                    <td className="px-2 py-3 text-sm text-charcoal">{a.service?.name || '—'}</td>
                                                    <td className="px-2 py-3 text-xs text-gray-500">{a.stylist?.name || '—'}</td>
                                                    <td className="px-2 py-3">
                                                        <span className={`inline-block text-[10px] font-bold uppercase tracking-widest px-2 py-0.5 rounded-full border ${status.color}`}>{status.label}</span>
                                                    </td>
                                                    <td className="px-2 py-3 text-right text-xs">
                                                        {a.paidAmount !== null ? (
                                                            <div>
                                                                <p className="font-bold text-charcoal">{a.paymentMethod === 'MEMBERSHIP' ? 'Bono' : fmtRD(a.paidAmount)}</p>
                                                                {a.paymentMethod && a.paymentMethod !== 'MEMBERSHIP' && (
                                                                    <p className="text-[10px] text-gray-400">{PAYMENT_LABELS[a.paymentMethod] || a.paymentMethod}</p>
                                                                )}
                                                            </div>
                                                        ) : (
                                                            <span className="text-gray-300">—</span>
                                                        )}
                                                    </td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        )}
                    </Section>

                    {/* Bot / Humano control */}
                    <BotControlWidget phone={client.phoneNumber} />

                    {/* Conversaciones de WhatsApp */}
                    {detail.chatHistory.length > 0 && (
                        <ChatHistorySection messages={detail.chatHistory} clientName={client.name || client.phoneNumber} />
                    )}
                </div>

                {/* RIGHT COLUMN — fidelidad + notas + acciones */}
                <div className="space-y-6">
                    {/* Loyalty */}
                    {loyalty && (
                        <Section icon={Star} title="Programa de Fidelidad" iconClass="text-amber-600 bg-amber-50">
                            {loyalty.rewardEarned ? (
                                <div className="text-center py-2">
                                    <div className="inline-flex items-center justify-center w-14 h-14 rounded-full bg-gradient-to-br from-amber-400 to-amber-600 text-white mb-3">
                                        <Star className="h-7 w-7 fill-current" />
                                    </div>
                                    <p className="text-sm font-bold text-charcoal">¡Recompensa lista!</p>
                                    <p className="text-xs text-gray-500 mt-1">Le toca <span className="font-semibold text-amber-700">{loyalty.rewardLabel}</span></p>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    <div className="flex items-end justify-between">
                                        <div>
                                            <p className="text-3xl font-black text-charcoal leading-none">{loyalty.currentVisits % loyalty.visitsRequired}</p>
                                            <p className="text-xs text-gray-400 mt-1">de {loyalty.visitsRequired} visitas</p>
                                        </div>
                                        <p className="text-xs font-semibold text-amber-700">
                                            {loyalty.visitsToReward} {loyalty.visitsToReward === 1 ? 'visita' : 'visitas'} para premio
                                        </p>
                                    </div>
                                    <div className="flex gap-1">
                                        {Array.from({ length: loyalty.visitsRequired }).map((_, i) => (
                                            <div key={i} className={`h-2 flex-1 rounded-full ${i < (loyalty.currentVisits % loyalty.visitsRequired) ? 'bg-gradient-to-r from-amber-400 to-amber-600' : 'bg-gray-100'}`} />
                                        ))}
                                    </div>
                                    <p className="text-xs text-gray-500">Recompensa: <span className="font-semibold text-charcoal">{loyalty.rewardLabel}</span></p>
                                </div>
                            )}
                        </Section>
                    )}

                    {/* Notas */}
                    <NotesSection
                        clientId={client.id}
                        initialNotes={client.notes}
                        onSaved={(notes) => setDetail(d => d ? { ...d, client: { ...d.client, notes } } : d)}
                    />

                    {/* Acciones */}
                    <Section icon={AlertCircle} title="Acciones" iconClass="text-gray-500 bg-gray-100">
                        <button
                            onClick={async () => {
                                const action = client.isActive ? 'desactivar' : 'reactivar';
                                if (!confirm(`¿Seguro que quieres ${action} este cliente?`)) return;
                                const res = await fetch(`/api/clients/${client.id}`, {
                                    method: 'PATCH',
                                    headers: { 'Content-Type': 'application/json' },
                                    body: JSON.stringify({ isActive: !client.isActive }),
                                });
                                if (res.ok) { toast.success(`Cliente ${action === 'desactivar' ? 'desactivado' : 'reactivado'}`); load(); }
                                else toast.error('Error al actualizar');
                            }}
                            className={`w-full flex items-center justify-center gap-2 text-sm font-bold py-2.5 rounded-xl transition-colors ${
                                client.isActive
                                    ? 'bg-gray-50 text-gray-600 hover:bg-gray-100'
                                    : 'bg-emerald-50 text-emerald-700 hover:bg-emerald-100'
                            }`}
                        >
                            <Power className="h-4 w-4" />
                            {client.isActive ? 'Marcar como inactivo' : 'Reactivar cliente'}
                        </button>
                    </Section>
                </div>
            </div>

            {/* Edit modal */}
            {editing && (
                <EditModal
                    client={client}
                    onClose={() => setEditing(false)}
                    onSaved={() => { setEditing(false); load(); }}
                />
            )}

            {/* Assign bond modal */}
            {showAssign && (
                <AssignModal
                    clientId={client.id}
                    clientLabel={`${client.name || 'Sin nombre'} · ${client.phoneNumber}`}
                    plans={plans}
                    onClose={() => setShowAssign(false)}
                    onAssigned={() => { setShowAssign(false); load(); }}
                />
            )}
        </div>
    );
}

function KpiCard({ icon: Icon, iconClass, label, value, sub }: {
    icon: React.ElementType; iconClass: string; label: string; value: string; sub: string;
}) {
    return (
        <div className="bg-white rounded-2xl border border-gray-100 p-4">
            <div className="flex items-center justify-between mb-3">
                <p className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">{label}</p>
                <div className={`p-1.5 rounded-lg ${iconClass}`}>
                    <Icon className="h-3.5 w-3.5" />
                </div>
            </div>
            <p className="text-2xl font-black text-charcoal leading-none">{value}</p>
            <p className="text-[11px] text-gray-400 mt-1.5 truncate">{sub}</p>
        </div>
    );
}

function Section({ icon: Icon, title, children, action, iconClass }: {
    icon: React.ElementType; title: string; children: React.ReactNode; action?: React.ReactNode; iconClass?: string;
}) {
    return (
        <div className="bg-white rounded-2xl border border-gray-100 p-5 md:p-6">
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2.5">
                    <div className={`p-1.5 rounded-lg ${iconClass || 'text-primary bg-primary/10'}`}>
                        <Icon className="h-4 w-4" />
                    </div>
                    <h2 className="text-sm font-bold text-charcoal">{title}</h2>
                </div>
                {action}
            </div>
            {children}
        </div>
    );
}

function ChatHistorySection({ messages, clientName }: { messages: ChatMessage[]; clientName: string }) {
    const [expanded, setExpanded] = useState(false);
    const initial = 6;
    const visible = expanded ? messages : messages.slice(-initial);

    // Group consecutive messages from same role within 5 min
    const grouped: Array<{ key: string; role: string; createdAt: string; items: ChatMessage[] }> = [];
    for (const m of visible) {
        const last = grouped[grouped.length - 1];
        const sameRole = last && last.role === m.role;
        const closeInTime = last && (new Date(m.createdAt).getTime() - new Date(last.items[last.items.length - 1].createdAt).getTime()) < 5 * 60 * 1000;
        if (sameRole && closeInTime) {
            last.items.push(m);
        } else {
            grouped.push({ key: m.id, role: m.role, createdAt: m.createdAt, items: [m] });
        }
    }

    // Day separators: insert a label whenever the date changes between groups
    const renderItems: Array<{ type: 'day'; label: string } | { type: 'group'; data: typeof grouped[0] }> = [];
    let lastDay: string | null = null;
    for (const g of grouped) {
        const day = new Date(g.createdAt).toLocaleDateString('es-DO', { day: 'numeric', month: 'short', year: 'numeric' });
        if (day !== lastDay) {
            renderItems.push({ type: 'day', label: day });
            lastDay = day;
        }
        renderItems.push({ type: 'group', data: g });
    }

    return (
        <div className="bg-white rounded-2xl border border-gray-100 p-5 md:p-6">
            <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2.5">
                    <div className="p-1.5 rounded-lg text-emerald-600 bg-emerald-50">
                        <MessagesSquare className="h-4 w-4" />
                    </div>
                    <h2 className="text-sm font-bold text-charcoal">Conversación de WhatsApp</h2>
                </div>
                <span className="text-xs text-gray-400">{messages.length} mensajes</span>
            </div>

            <div className="bg-[#e5ddd5] rounded-xl p-3 md:p-4 space-y-2 max-h-[500px] overflow-y-auto">
                {!expanded && messages.length > initial && (
                    <button
                        onClick={() => setExpanded(true)}
                        className="w-full text-center text-xs font-semibold text-gray-500 hover:text-charcoal py-2 bg-white/50 hover:bg-white/80 rounded-lg transition-colors"
                    >
                        Mostrar {messages.length - initial} mensajes anteriores
                    </button>
                )}

                {renderItems.map((item, idx) => {
                    if (item.type === 'day') {
                        return (
                            <div key={`day-${idx}`} className="flex justify-center my-2">
                                <span className="bg-[#e1f0d8]/80 text-[#5a7a5a] text-[10px] font-medium px-2.5 py-0.5 rounded-full shadow-sm">
                                    {item.label}
                                </span>
                            </div>
                        );
                    }
                    const g = item.data;
                    const isUser = g.role === 'user';
                    return (
                        <div key={g.key} className={`flex ${isUser ? 'justify-start' : 'justify-end'}`}>
                            <div className={`max-w-[85%] ${isUser ? 'order-1' : 'order-2'}`}>
                                <div className="space-y-0.5">
                                    {g.items.map((msg, i) => (
                                        <div
                                            key={msg.id}
                                            className={`px-3 py-2 shadow-sm text-sm relative ${
                                                isUser
                                                    ? 'bg-white text-[#111]'
                                                    : 'bg-[#d9fdd3] text-[#111]'
                                            } ${
                                                i === 0
                                                    ? isUser ? 'rounded-[10px] rounded-tl-[3px]' : 'rounded-[10px] rounded-tr-[3px]'
                                                    : 'rounded-[10px]'
                                            }`}
                                        >
                                            <p className="whitespace-pre-wrap leading-snug">{msg.content}</p>
                                            <p className="text-[10px] text-[#8696a0] mt-1 text-right">
                                                {new Date(msg.createdAt).toLocaleTimeString('es-DO', { hour: '2-digit', minute: '2-digit' })}
                                            </p>
                                        </div>
                                    ))}
                                </div>
                                <p className={`text-[10px] mt-1 px-1 ${isUser ? 'text-gray-500' : 'text-emerald-700'} font-semibold`}>
                                    {isUser ? clientName : 'Bot'}
                                </p>
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}

function NotesSection({ clientId, initialNotes, onSaved }: {
    clientId: string; initialNotes: string | null; onSaved: (n: string | null) => void;
}) {
    const toast = useToast();
    const [editing, setEditing] = useState(false);
    const [value, setValue] = useState(initialNotes || '');
    const [saving, setSaving] = useState(false);

    const save = async () => {
        setSaving(true);
        try {
            const trimmed = value.trim() || null;
            const res = await fetch(`/api/clients/${clientId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ notes: trimmed }),
            });
            if (!res.ok) throw new Error();
            onSaved(trimmed);
            setEditing(false);
            toast.success('Notas guardadas');
        } catch {
            toast.error('Error al guardar');
        } finally {
            setSaving(false);
        }
    };

    return (
        <Section
            icon={Edit2}
            title="Notas privadas"
            iconClass="text-charcoal bg-gray-100"
            action={!editing ? (
                <button onClick={() => setEditing(true)} className="text-xs font-semibold text-gray-400 hover:text-primary px-2 py-1">
                    {value ? 'Editar' : 'Añadir'}
                </button>
            ) : null}
        >
            {editing ? (
                <div className="space-y-2">
                    <textarea
                        value={value}
                        onChange={(e) => setValue(e.target.value)}
                        rows={5}
                        autoFocus
                        placeholder="Preferencias, alergias, conversaciones importantes..."
                        className="w-full px-3 py-2 text-sm bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 outline-none resize-none"
                    />
                    <div className="flex justify-end gap-2">
                        <button onClick={() => { setValue(initialNotes || ''); setEditing(false); }} className="text-xs font-semibold text-gray-400 px-3 py-1.5">Cancelar</button>
                        <button onClick={save} disabled={saving} className="flex items-center gap-1.5 bg-primary text-white px-3 py-1.5 rounded-lg text-xs font-bold disabled:opacity-50">
                            {saving ? <Loader2 className="h-3 w-3 animate-spin" /> : <Save className="h-3 w-3" />}
                            Guardar
                        </button>
                    </div>
                </div>
            ) : value ? (
                <p className="text-sm text-gray-600 whitespace-pre-wrap leading-relaxed">{value}</p>
            ) : (
                <p className="text-sm text-gray-400 italic">Sin notas. Útil para preferencias, alergias o cualquier contexto que quieras recordar de este cliente.</p>
            )}
        </Section>
    );
}

function EditModal({ client, onClose, onSaved }: { client: ClientData; onClose: () => void; onSaved: () => void }) {
    const toast = useToast();
    const [name, setName] = useState(client.name || '');
    const [phone, setPhone] = useState(client.phoneNumber);
    const [email, setEmail] = useState(client.email || '');
    const [saving, setSaving] = useState(false);

    const submit = async () => {
        setSaving(true);
        try {
            const res = await fetch(`/api/clients/${client.id}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    name: name.trim() || null,
                    phoneNumber: phone.trim(),
                    email: email.trim() || null,
                }),
            });
            const data = await res.json();
            if (!res.ok) { toast.error(data.error || 'Error al guardar'); return; }
            toast.success('Cliente actualizado');
            onSaved();
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4">
                <h3 className="text-lg font-bold text-charcoal">Editar cliente</h3>
                <div className="space-y-3">
                    <div>
                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Nombre</label>
                        <input value={name} onChange={(e) => setName(e.target.value)} className="w-full mt-1.5 px-3 py-2 text-sm bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 outline-none" />
                    </div>
                    <div>
                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Teléfono</label>
                        <input value={phone} onChange={(e) => setPhone(e.target.value)} className="w-full mt-1.5 px-3 py-2 text-sm bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 outline-none" />
                    </div>
                    <div>
                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Email (opcional)</label>
                        <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} className="w-full mt-1.5 px-3 py-2 text-sm bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 outline-none" />
                    </div>
                </div>
                <div className="flex justify-end gap-2 pt-2">
                    <button onClick={onClose} className="px-3 py-2 text-sm font-semibold text-gray-500">Cancelar</button>
                    <button onClick={submit} disabled={saving} className="flex items-center gap-1.5 bg-primary text-white px-4 py-2 rounded-xl text-sm font-bold disabled:opacity-50">
                        {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                        Guardar
                    </button>
                </div>
            </div>
        </div>
    );
}

function AssignModal({ clientId, clientLabel, plans, onClose, onAssigned }: {
    clientId: string; clientLabel: string; plans: Plan[]; onClose: () => void; onAssigned: () => void;
}) {
    const toast = useToast();
    const [planId, setPlanId] = useState(plans[0]?.id || '');
    const [notes, setNotes] = useState('');
    const [saving, setSaving] = useState(false);

    const submit = async () => {
        setSaving(true);
        try {
            const res = await fetch('/api/memberships/assignments', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ clientId, planId, notes: notes.trim() || undefined }),
            });
            const data = await res.json();
            if (!res.ok) { toast.error(data.error || 'Error al asignar'); return; }
            toast.success('Bono asignado');
            onAssigned();
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="fixed inset-0 bg-black/40 z-50 flex items-center justify-center p-4">
            <div className="bg-white rounded-2xl max-w-md w-full p-6 space-y-4">
                <h3 className="text-lg font-bold text-charcoal">Asignar bono</h3>
                <p className="text-xs text-gray-500">A: <span className="font-semibold text-charcoal">{clientLabel}</span></p>
                <div className="space-y-3">
                    <div>
                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Plan</label>
                        <select value={planId} onChange={(e) => setPlanId(e.target.value)} className="w-full mt-1.5 px-3 py-2 text-sm bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 outline-none">
                            {plans.map(p => <option key={p.id} value={p.id}>{p.name} · {p.totalServices} servicios · RD${p.price}</option>)}
                        </select>
                    </div>
                    <div>
                        <label className="text-[10px] font-bold text-gray-400 uppercase tracking-widest">Notas (opcional)</label>
                        <textarea value={notes} onChange={(e) => setNotes(e.target.value)} rows={2} placeholder="Pagado en efectivo el 28 abr" className="w-full mt-1.5 px-3 py-2 text-sm bg-white border border-gray-200 rounded-xl focus:ring-2 focus:ring-primary/20 outline-none resize-none" />
                    </div>
                    <div className="flex items-start gap-2 bg-amber-50 border border-amber-100 rounded-lg p-3">
                        <AlertCircle className="h-4 w-4 text-amber-600 shrink-0 mt-0.5" />
                        <p className="text-xs text-amber-800">DomiCita solo gestiona el saldo del bono — el cobro lo gestionas tú.</p>
                    </div>
                </div>
                <div className="flex justify-end gap-2 pt-2">
                    <button onClick={onClose} className="px-3 py-2 text-sm font-semibold text-gray-500">Cancelar</button>
                    <button onClick={submit} disabled={saving} className="flex items-center gap-1.5 bg-primary text-white px-4 py-2 rounded-xl text-sm font-bold disabled:opacity-50">
                        {saving && <Loader2 className="h-3.5 w-3.5 animate-spin" />}
                        Asignar
                    </button>
                </div>
            </div>
        </div>
    );
}
