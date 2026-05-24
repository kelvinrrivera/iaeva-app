"use client";

import { useEffect, useState } from "react";
import {
    TrendingUp,
    Calendar as CalendarIcon,
    MessageSquare,
    Users,
    ArrowRight,
    Plus,
    Clock,
    CheckCircle2,
    Circle,
    X,
    ChevronRight,
} from "lucide-react";
import { Skeleton } from "@/components/ui/Skeleton";
import Link from "next/link";
import { format } from "date-fns";
import { es } from "date-fns/locale";
import { useTerminology } from "@/contexts/TerminologyContext";

export default function DashboardPage() {
    const { terminology } = useTerminology();
    const [stats, setStats] = useState<any>(null);
    const [upcoming, setUpcoming] = useState<any[]>([]);
    const [loading, setLoading] = useState(true);
    const [shopData, setShopData] = useState<any>(null);
    const [showChecklist, setShowChecklist] = useState(true);

    useEffect(() => {
        const fetchData = async () => {
            try {
                const [statsRes, upcomingRes, shopRes] = await Promise.all([
                    fetch("/api/dashboard/stats"),
                    fetch("/api/dashboard/upcoming"),
                    fetch("/api/shop"),
                ]);
                setStats(await statsRes.json());
                setUpcoming(await upcomingRes.json());
                const shop = await shopRes.json();
                setShopData(shop);
            } catch (err) {
                console.error("Dashboard fetch error:", err);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
        // Respect manual dismissal stored in sessionStorage
        if (sessionStorage.getItem('onboarding_checklist_hidden') === '1') {
            setShowChecklist(false);
        }
    }, []);

    const onboardingSteps = [
        {
            label: "Tipo de negocio seleccionado",
            done: !!shopData?.shopType,
            href: "/onboarding",
        },
        {
            label: "Agrega tus servicios",
            done: (stats?.servicesCount ?? 0) > 0,
            href: "/dashboard/services",
        },
        {
            label: "Configura tu horario",
            done: (stats?.hoursConfigured ?? false),
            href: "/dashboard/settings",
        },
        {
            label: "Conecta WhatsApp",
            done: shopData?.whatsappEnabled === true,
            href: "/dashboard/settings#whatsapp",
        },
        {
            label: "Prueba el chatbot",
            done: stats?.chatbotEverUsed === true,
            href: "/dashboard/chatbot?tab=probar",
        },
    ];

    const completedSteps = onboardingSteps.filter(s => s.done).length;
    const allDone = completedSteps === onboardingSteps.length;

    const dismissChecklist = () => {
        setShowChecklist(false);
        sessionStorage.setItem('onboarding_checklist_hidden', '1');
    };

    const statCards = [
        {
            name: "Citas Hoy",
            value: stats?.appointmentsToday ?? "0",
            icon: CalendarIcon,
            color: "text-primary",
            bg: "bg-primary/8",
            sub: null,
        },
        {
            name: "Cobrado Hoy",
            value: `RD$\u00a0${(stats?.revenueToday ?? 0).toLocaleString("es-DO")}`,
            icon: TrendingUp,
            color: "text-emerald-600",
            bg: "bg-emerald-50",
            sub: stats?.revenuePending > 0
                ? `RD$ ${stats.revenuePending.toLocaleString("es-DO")} por cobrar`
                : null,
        },
        {
            name: "Chatbot",
            value: stats?.chatbotQueries ?? "0",
            icon: MessageSquare,
            color: "text-primary",
            bg: "bg-primary/8",
            sub: null,
        },
        {
            name: "Clientes Nuevos",
            value: stats?.newClientsToday ?? "0",
            icon: Users,
            color: "text-accent",
            bg: "bg-accent/8",
            sub: null,
        },
    ];

    const today = format(new Date(), "EEEE d 'de' MMMM", { locale: es });
    const todayCapitalized = today.charAt(0).toUpperCase() + today.slice(1);

    return (
        <div className="space-y-6 max-w-7xl">
            {/* Page header */}
            <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-black text-charcoal">Resumen del día</h1>
                    <p className="text-sm text-gray-400 mt-0.5 font-medium">{todayCapitalized}</p>
                </div>
                <Link
                    href="/dashboard/calendar"
                    className="btn-accent-luxury inline-flex items-center gap-2 h-10 px-5 rounded-xl text-sm font-bold self-start sm:self-auto"
                >
                    <Plus className="h-4 w-4" />
                    Nueva Cita
                </Link>
            </div>

            {/* Onboarding Checklist — shows until all steps done or dismissed */}
            {showChecklist && !allDone && (
                <div className="bg-gradient-to-r from-primary/5 to-primary/10 border border-primary/20 rounded-2xl p-5">
                    <div className="flex items-start justify-between mb-4">
                        <div>
                            <h3 className="text-sm font-black text-charcoal">
                                Configura tu DomiCita
                                <span className="ml-2 text-xs font-bold text-primary bg-primary/10 px-2 py-0.5 rounded-full">
                                    {completedSteps}/{onboardingSteps.length}
                                </span>
                            </h3>
                            <p className="text-xs text-gray-500 mt-0.5">Completa estos pasos para sacarle el máximo provecho</p>
                        </div>
                        <button onClick={dismissChecklist} aria-label="Cerrar checklist" className="text-gray-400 hover:text-gray-600 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary rounded">
                            <X className="h-4 w-4" />
                        </button>
                    </div>
                    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
                        {onboardingSteps.map((step, i) => (
                            <Link
                                key={i}
                                href={step.href}
                                className={`flex items-center gap-2.5 p-3 rounded-xl border transition-all text-left ${
                                    step.done
                                        ? 'bg-emerald-50 border-emerald-200 cursor-default pointer-events-none'
                                        : 'bg-white border-gray-200 hover:border-primary/40 hover:bg-primary/5'
                                }`}
                            >
                                {step.done
                                    ? <CheckCircle2 className="h-4 w-4 text-emerald-500 shrink-0" />
                                    : <Circle className="h-4 w-4 text-gray-300 shrink-0" />
                                }
                                <span className={`text-xs font-semibold leading-tight ${step.done ? 'text-emerald-700/70' : 'text-gray-700'}`}>
                                    {step.label}
                                </span>
                                {!step.done && <ChevronRight className="h-3 w-3 text-gray-300 ml-auto shrink-0" />}
                            </Link>
                        ))}
                    </div>
                    <div className="mt-3 h-1.5 bg-primary/10 rounded-full overflow-hidden">
                        <div
                            className="h-full bg-primary rounded-full transition-all duration-500"
                            style={{ width: `${(completedSteps / onboardingSteps.length) * 100}%` }}
                        />
                    </div>
                </div>
            )}

            {/* Stats grid */}
            <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
                {loading ? (
                    Array.from({ length: 4 }).map((_, i) => (
                        <div key={i} className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm">
                            <Skeleton className="h-9 w-9 rounded-xl mb-3" />
                            <Skeleton className="h-3 w-24 mb-2" />
                            <Skeleton className="h-7 w-16" />
                        </div>
                    ))
                ) : (
                    statCards.map((stat) => (
                        <div key={stat.name} className="bg-white rounded-2xl border border-gray-100 p-5 shadow-sm hover:shadow-md transition-shadow duration-200">
                            <div className="flex items-start justify-between mb-3">
                                <div className={`p-2.5 rounded-xl ${stat.bg}`}>
                                    <stat.icon className={`h-5 w-5 ${stat.color}`} />
                                </div>
                            </div>
                            <p className="text-[11px] font-semibold text-gray-400 uppercase tracking-wide mb-1">
                                {stat.name}
                            </p>
                            <p className="text-2xl font-black text-charcoal">{stat.value}</p>
                            {stat.sub && (
                                <p className="text-[10px] font-semibold text-amber-500 mt-1">{stat.sub}</p>
                            )}
                        </div>
                    ))
                )}
            </div>

            {/* Mobile floating action button */}
            <Link
                href="/dashboard/calendar"
                className="fixed bottom-6 right-6 z-30 md:hidden btn-accent-luxury h-14 w-14 rounded-full flex items-center justify-center shadow-xl"
                aria-label="Nueva Cita"
            >
                <Plus className="h-6 w-6" />
            </Link>

            {/* Main grid */}
            <div className="grid gap-5 lg:grid-cols-7">
                {/* Activity placeholder — lg:col-span-4 */}
                <div className="lg:col-span-4 bg-white rounded-2xl border border-gray-100 shadow-sm p-6">
                    <div className="flex items-center justify-between mb-5">
                        <h3 className="text-base font-bold text-charcoal">Actividad</h3>
                        <select className="px-3 py-1.5 rounded-lg border border-gray-200 text-xs font-semibold text-gray-600 focus:border-primary focus:ring-2 focus:ring-primary/10 transition-all bg-white">
                            <option>Últimos 7 días</option>
                            <option>Últimos 30 días</option>
                            <option>Este mes</option>
                        </select>
                    </div>
                    <div className="h-56 flex flex-col items-center justify-center bg-gray-50 rounded-xl border-2 border-dashed border-gray-200 gap-2">
                        <CalendarIcon className="h-8 w-8 text-gray-300" />
                        <p className="text-xs font-semibold text-gray-400">Gráfica de actividad próximamente</p>
                    </div>
                </div>

                {/* Upcoming appointments — lg:col-span-3 */}
                <div className="lg:col-span-3 bg-white rounded-2xl border border-gray-100 shadow-sm p-6 flex flex-col">
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-base font-bold text-charcoal">Próximas Citas</h3>
                        <Link
                            href="/dashboard/calendar"
                            className="text-xs font-semibold text-primary hover:text-primary-dark flex items-center gap-1 transition-colors"
                        >
                            Ver todo
                            <ArrowRight className="h-3.5 w-3.5" />
                        </Link>
                    </div>

                    <div className="flex-1 space-y-2 overflow-y-auto max-h-72">
                        {loading && Array.from({ length: 3 }).map((_, i) => (
                            <div key={i} className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 border border-gray-100">
                                <Skeleton className="h-10 w-10 rounded-lg shrink-0" />
                                <div className="flex-1 space-y-1.5">
                                    <Skeleton className="h-3.5 w-2/3" />
                                    <Skeleton className="h-2.5 w-1/3" />
                                </div>
                            </div>
                        ))}
                        {!loading && upcoming.length > 0 && upcoming.map((apt) => (
                            <div
                                key={apt.id}
                                className="flex items-center gap-3 p-3 rounded-xl bg-gray-50 hover:bg-primary/5 border border-gray-100 hover:border-primary/20 transition-all group cursor-pointer"
                            >
                                <div className="flex flex-col items-center justify-center w-12 shrink-0">
                                    <Clock className="h-3.5 w-3.5 text-gray-400 mb-0.5" />
                                    <span className="text-xs font-black text-primary">
                                        {format(new Date(apt.startTime), "HH:mm")}
                                    </span>
                                </div>
                                <div className="flex-1 min-w-0 border-l border-gray-200 pl-3">
                                    <p className="text-sm font-bold text-charcoal truncate group-hover:text-primary transition-colors">
                                        {apt.clientName}
                                    </p>
                                    <p className="text-[11px] text-gray-400 font-medium uppercase tracking-wide truncate">
                                        {apt.service?.name}
                                    </p>
                                </div>
                                <ArrowRight className="h-3.5 w-3.5 text-gray-300 group-hover:text-primary group-hover:translate-x-0.5 transition-all shrink-0" />
                            </div>
                        ))}
                        {!loading && upcoming.length === 0 && (
                            <div className="flex flex-col items-center justify-center py-12 gap-2">
                                <CalendarIcon className="h-8 w-8 text-gray-200" />
                                <p className="text-xs font-semibold text-gray-400">Sin citas próximas</p>
                            </div>
                        )}
                    </div>

                    <Link
                        href="/dashboard/calendar"
                        className="mt-4 btn-accent-luxury flex items-center justify-center gap-2 h-10 rounded-xl text-sm font-bold"
                    >
                        Agendar Cita
                        <Plus className="h-4 w-4" />
                    </Link>
                </div>
            </div>
        </div>
    );
}
