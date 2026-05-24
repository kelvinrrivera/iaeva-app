"use client";

import { useState, useEffect } from "react";
import { Skeleton } from "@/components/ui/Skeleton";
import {
    DollarSign,
    Clock,
    AlertCircle,
    TrendingUp,
    Banknote,
    CreditCard,
    Smartphone,
    Loader2,
    ChevronDown,
    CheckCircle2,
    User,
} from "lucide-react";

type Period = "today" | "week" | "month";

interface Transaction {
    id: string;
    clientName: string;
    paidAmount: number | null;
    paidAt: string;
    paymentMethod: string | null;
    service: { name: string; price: number } | null;
    stylist: { user: { name: string } } | null;
}

interface PendingItem {
    id: string;
    clientName: string;
    startTime: string;
    status: string;
    service: { name: string; price: number } | null;
    stylist: { user: { name: string } } | null;
}

interface Debtor {
    id: string;
    name: string | null;
    phoneNumber: string;
    debtAmount: number;
}

interface FinanceSummary {
    period: string;
    summary: {
        totalCollected: number;
        totalPending: number;
        totalDebt: number;
        byPaymentMethod: Record<string, number>;
        transactionsCount: number;
        pendingCount: number;
        clientsWithDebt: number;
    };
    transactions: Transaction[];
    pending: PendingItem[];
    debtors: Debtor[];
    dailyChart: { date: string; label: string; collected: number; pending: number }[];
}

const METHOD_LABELS: Record<string, string> = {
    CASH: "Efectivo",
    CARD: "Tarjeta",
    TRANSFER: "Transferencia",
    DEBT: "Fía",
    OTHER: "Otro",
};

const METHOD_ICONS: Record<string, React.ElementType> = {
    CASH: Banknote,
    CARD: CreditCard,
    TRANSFER: Smartphone,
    DEBT: AlertCircle,
    OTHER: DollarSign,
};

function fmt(amount: number) {
    return `RD$ ${amount.toLocaleString("es-DO", { minimumFractionDigits: 0, maximumFractionDigits: 0 })}`;
}

function fmtTime(iso: string) {
    return new Date(iso).toLocaleTimeString("es-DO", { hour: "2-digit", minute: "2-digit", hour12: true });
}

function fmtDate(iso: string) {
    return new Date(iso).toLocaleDateString("es-DO", { day: "numeric", month: "short" });
}

export default function FinancePage() {
    const [period, setPeriod] = useState<Period>("today");
    const [data, setData] = useState<FinanceSummary | null>(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<"collected" | "pending" | "debt">("collected");

    useEffect(() => {
        let cancelled = false;
        // Defer setState out of the effect body to avoid cascading renders.
        queueMicrotask(() => { if (!cancelled) setLoading(true); });
        fetch(`/api/finance/summary?period=${period}`, { credentials: "include" })
            .then(r => r.json())
            .then(d => { if (!cancelled) { setData(d); setLoading(false); } })
            .catch(() => { if (!cancelled) setLoading(false); });
        return () => { cancelled = true; };
    }, [period]);

    const summary = data?.summary;

    // Max value for chart bars
    const chartMax = data?.dailyChart?.length
        ? Math.max(...data.dailyChart.map(d => d.collected + d.pending), 1)
        : 1;

    return (
        <div className="max-w-6xl space-y-8 pb-20">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-4xl font-black tracking-tight flex items-center gap-3">
                        <DollarSign className="h-9 w-9 text-primary" />
                        Finanzas
                    </h1>
                    <p className="text-gray-500 font-medium mt-1">Ingresos reales, cobros pendientes y fiás</p>
                </div>

                {/* Period selector */}
                <div className="flex bg-white border border-gray-200 rounded-xl overflow-hidden shadow-sm">
                    {(["today", "week", "month"] as Period[]).map(p => (
                        <button
                            key={p}
                            onClick={() => setPeriod(p)}
                            className={`px-4 py-2 text-sm font-bold transition-all ${
                                period === p
                                    ? "bg-primary text-white"
                                    : "text-gray-500 hover:bg-gray-50"
                            }`}
                        >
                            {p === "today" ? "Hoy" : p === "week" ? "Semana" : "Mes"}
                        </button>
                    ))}
                </div>
            </div>

            {loading ? (
                <div className="space-y-4">
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        {Array.from({ length: 3 }).map((_, i) => (
                            <div key={i} className="bg-white rounded-2xl border border-gray-100 p-6 space-y-3">
                                <Skeleton className="h-3 w-20" />
                                <Skeleton className="h-8 w-32" />
                                <Skeleton className="h-3 w-24" />
                            </div>
                        ))}
                    </div>
                    <div className="bg-white rounded-2xl border border-gray-100 p-6 space-y-3">
                        {Array.from({ length: 5 }).map((_, i) => (
                            <Skeleton key={i} className="h-12 rounded-xl" />
                        ))}
                    </div>
                </div>
            ) : (
                <>
                    {/* KPI Cards */}
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                            <div className="flex items-center justify-between mb-3">
                                <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">Cobrado</span>
                                <CheckCircle2 className="h-5 w-5 text-emerald-500" />
                            </div>
                            <p className="text-3xl font-black text-charcoal">{fmt(summary?.totalCollected ?? 0)}</p>
                            <p className="text-xs text-gray-400 font-semibold mt-1">{summary?.transactionsCount ?? 0} transacciones</p>
                        </div>

                        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                            <div className="flex items-center justify-between mb-3">
                                <span className="text-xs font-bold text-gray-400 uppercase tracking-widest">Por Cobrar</span>
                                <Clock className="h-5 w-5 text-amber-500" />
                            </div>
                            <p className="text-3xl font-black text-charcoal">{fmt(summary?.totalPending ?? 0)}</p>
                            <p className="text-xs text-gray-400 font-semibold mt-1">{summary?.pendingCount ?? 0} citas sin cobrar</p>
                        </div>

                        <div className="bg-white rounded-2xl border border-amber-100 shadow-sm p-6 bg-amber-50">
                            <div className="flex items-center justify-between mb-3">
                                <span className="text-xs font-bold text-amber-600 uppercase tracking-widest">Fiás Pendientes</span>
                                <AlertCircle className="h-5 w-5 text-amber-500" />
                            </div>
                            <p className="text-3xl font-black text-amber-700">{fmt(summary?.totalDebt ?? 0)}</p>
                            <p className="text-xs text-amber-500 font-semibold mt-1">{summary?.clientsWithDebt ?? 0} clientes deben</p>
                        </div>
                    </div>

                    {/* Payment Method Breakdown */}
                    {(summary?.totalCollected ?? 0) > 0 && (
                        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                            <h2 className="text-sm font-bold text-charcoal mb-4 flex items-center gap-2">
                                <TrendingUp className="h-4 w-4 text-primary" />
                                Desglose por método de pago
                            </h2>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
                                {Object.entries(summary?.byPaymentMethod ?? {})
                                    .filter(([, v]) => v > 0)
                                    .map(([method, amount]) => {
                                        const Icon = METHOD_ICONS[method] ?? DollarSign;
                                        const pct = summary?.totalCollected
                                            ? Math.round((amount / summary.totalCollected) * 100)
                                            : 0;
                                        return (
                                            <div key={method} className="bg-gray-50 rounded-xl p-4">
                                                <Icon className="h-5 w-5 text-primary mb-2" />
                                                <p className="text-xs font-bold text-gray-400 uppercase tracking-wider">{METHOD_LABELS[method] ?? method}</p>
                                                <p className="text-xl font-black text-charcoal mt-1">{fmt(amount)}</p>
                                                <p className="text-xs text-gray-400 font-semibold">{pct}% del total</p>
                                            </div>
                                        );
                                    })}
                            </div>
                        </div>
                    )}

                    {/* Daily Chart (week/month only) */}
                    {period !== "today" && data?.dailyChart && data.dailyChart.length > 0 && (
                        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                            <h2 className="text-sm font-bold text-charcoal mb-4 flex items-center gap-2">
                                <TrendingUp className="h-4 w-4 text-primary" />
                                Ingresos por día
                            </h2>
                            <div className="flex items-end gap-2 h-32">
                                {data.dailyChart.map(day => (
                                    <div key={day.date} className="flex-1 flex flex-col items-center gap-1">
                                        <div className="w-full flex flex-col justify-end gap-0.5" style={{ height: "96px" }}>
                                            {day.collected > 0 && (
                                                <div
                                                    className="w-full bg-primary rounded-sm"
                                                    style={{ height: `${(day.collected / chartMax) * 96}px` }}
                                                    title={`Cobrado: ${fmt(day.collected)}`}
                                                />
                                            )}
                                            {day.pending > 0 && (
                                                <div
                                                    className="w-full bg-amber-200 rounded-sm"
                                                    style={{ height: `${(day.pending / chartMax) * 96}px` }}
                                                    title={`Pendiente: ${fmt(day.pending)}`}
                                                />
                                            )}
                                        </div>
                                        <span className="text-[9px] font-bold text-gray-400 capitalize">{day.label}</span>
                                    </div>
                                ))}
                            </div>
                            <div className="flex gap-4 mt-2">
                                <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-sm bg-primary" /><span className="text-xs text-gray-500">Cobrado</span></div>
                                <div className="flex items-center gap-1.5"><div className="w-3 h-3 rounded-sm bg-amber-200" /><span className="text-xs text-gray-500">Pendiente</span></div>
                            </div>
                        </div>
                    )}

                    {/* Tabs: Transacciones / Pendientes / Fiás */}
                    <div className="bg-white rounded-2xl border border-gray-100 shadow-sm">
                        <div className="flex border-b border-gray-100">
                            {[
                                { key: "collected", label: `Cobrado (${data?.transactions?.length ?? 0})` },
                                { key: "pending",   label: `Pendiente (${data?.pending?.length ?? 0})` },
                                { key: "debt",      label: `Fiás (${data?.debtors?.length ?? 0})` },
                            ].map(tab => (
                                <button
                                    key={tab.key}
                                    onClick={() => setActiveTab(tab.key as any)}
                                    className={`flex-1 py-3 text-sm font-bold transition-all ${
                                        activeTab === tab.key
                                            ? "text-primary border-b-2 border-primary"
                                            : "text-gray-400 hover:text-gray-600"
                                    }`}
                                >
                                    {tab.label}
                                </button>
                            ))}
                        </div>

                        <div className="p-6">
                            {/* COLLECTED */}
                            {activeTab === "collected" && (
                                <div className="space-y-3">
                                    {data?.transactions?.length === 0 ? (
                                        <p className="text-center text-gray-400 py-8 font-medium">No hay cobros registrados en este período</p>
                                    ) : data?.transactions?.map(tx => (
                                        <div key={tx.id} className="flex items-center justify-between py-3 border-b border-gray-50 last:border-0">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 bg-emerald-100 rounded-full flex items-center justify-center shrink-0">
                                                    <CheckCircle2 className="h-4 w-4 text-emerald-600" />
                                                </div>
                                                <div>
                                                    <p className="font-bold text-charcoal text-sm">{tx.clientName}</p>
                                                    <p className="text-xs text-gray-400">{tx.service?.name} · {tx.paidAt ? `${fmtDate(tx.paidAt)} ${fmtTime(tx.paidAt)}` : ""}</p>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <p className="font-black text-charcoal">{fmt(tx.paidAmount ?? tx.service?.price ?? 0)}</p>
                                                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${
                                                    tx.paymentMethod === 'CASH' ? 'bg-green-100 text-green-700' :
                                                    tx.paymentMethod === 'CARD' ? 'bg-blue-100 text-blue-700' :
                                                    tx.paymentMethod === 'TRANSFER' ? 'bg-purple-100 text-purple-700' :
                                                    'bg-gray-100 text-gray-600'
                                                }`}>
                                                    {METHOD_LABELS[tx.paymentMethod ?? "OTHER"] ?? tx.paymentMethod}
                                                </span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* PENDING */}
                            {activeTab === "pending" && (
                                <div className="space-y-3">
                                    {data?.pending?.length === 0 ? (
                                        <p className="text-center text-gray-400 py-8 font-medium">No hay citas pendientes de cobro</p>
                                    ) : data?.pending?.map(item => (
                                        <div key={item.id} className="flex items-center justify-between py-3 border-b border-gray-50 last:border-0">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 bg-amber-100 rounded-full flex items-center justify-center shrink-0">
                                                    <Clock className="h-4 w-4 text-amber-600" />
                                                </div>
                                                <div>
                                                    <p className="font-bold text-charcoal text-sm">{item.clientName}</p>
                                                    <p className="text-xs text-gray-400">{item.service?.name} · {fmtTime(item.startTime)}</p>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <p className="font-black text-amber-600">{fmt(item.service?.price ?? 0)}</p>
                                                <span className="text-[10px] font-bold text-gray-400">{item.status}</span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {/* DEBT */}
                            {activeTab === "debt" && (
                                <div className="space-y-3">
                                    {data?.debtors?.length === 0 ? (
                                        <p className="text-center text-gray-400 py-8 font-medium">Ningún cliente debe dinero</p>
                                    ) : data?.debtors?.map(debtor => (
                                        <div key={debtor.id} className="flex items-center justify-between py-3 border-b border-gray-50 last:border-0">
                                            <div className="flex items-center gap-3">
                                                <div className="w-8 h-8 bg-red-100 rounded-full flex items-center justify-center shrink-0">
                                                    <User className="h-4 w-4 text-red-600" />
                                                </div>
                                                <div>
                                                    <p className="font-bold text-charcoal text-sm">{debtor.name || "Cliente sin nombre"}</p>
                                                    <p className="text-xs text-gray-400">{debtor.phoneNumber}</p>
                                                </div>
                                            </div>
                                            <p className="font-black text-red-600">{fmt(debtor.debtAmount)}</p>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
