"use client";

import { useState, useEffect, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import {
    Store,
    Clock,
    MapPin,
    Phone,
    Save,
    Loader2,
    Calendar,
    RefreshCw,
    CheckCircle2,
    AlertCircle,
    X,
    MessageCircle,
    Smartphone,
    Bell,
    Star,
    Link2,
    Copy,
    Check,
    Trash2,
    ArrowRight,
    ArrowLeft,
    ArrowLeftRight,
    Monitor,
    Globe,
    ChevronDown,
    ChevronRight,
    Eye,
} from "lucide-react";
import { AddressAutocomplete } from "@/components/ui/AddressAutocomplete";
import { useToast } from "@/contexts/ToastContext";
import FacebookSDKScript from "@/components/whatsapp/FacebookSDKScript";
import { EmbeddedSignupLauncher } from "@/components/whatsapp/EmbeddedSignupLauncher";
import CalendarsTab from "@/components/dashboard/settings/CalendarsTab";
import LoyaltyTab from "@/components/dashboard/settings/LoyaltyTab";
import BotScheduleCard from "@/components/dashboard/settings/BotScheduleCard";
import { PURPOSE_LABELS } from "@/lib/whatsapp/template-constants";

export default function SettingsPage() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [activeTab, setActiveTab] = useState<'negocio' | 'calendarios' | 'whatsapp' | 'fidelidad'>('negocio');

    const toast = useToast();
    const [shopData, setShopData] = useState<any>(null);
    const [dailyHours, setDailyHours] = useState<any[]>(
        [0, 1, 2, 3, 4, 5, 6].map(day => ({
            dayOfWeek: day,
            startTime: "08:00",
            endTime: "20:00",
            active: day !== 0
        }))
    );

    // Calendar integration state
    const [calendarConnected, setCalendarConnected] = useState(false);
    const [calendarSettings, setCalendarSettings] = useState<any>(null);
    const [calendarList, setCalendarList] = useState<any[]>([]);
    const [syncing, setSyncing] = useState(false);
    const [syncDirection, setSyncDirection] = useState<'PUSH' | 'PULL' | 'BIDIRECTIONAL'>('BIDIRECTIONAL');
    const [selectedCalendar, setSelectedCalendar] = useState<string>('primary');

    // ICS feed state
    const [icsToken, setIcsToken] = useState<string | null>(null);
    const [icsFeedUrl, setIcsFeedUrl] = useState<string | null>(null);
    const [generatingIcs, setGeneratingIcs] = useState(false);
    const [icsCopied, setIcsCopied] = useState(false);

    // WhatsApp integration state
    const [whatsappEnabled, setWhatsappEnabled] = useState(false);
    const [whatsappPhone, setWhatsappPhone] = useState('');
    const [whatsappProvider, setWhatsappProvider] = useState<'META' | 'TWILIO'>('META');
    const [metaTokenExpiresAt, setMetaTokenExpiresAt] = useState<Date | null>(null);
    const [verifyingPhone, setVerifyingPhone] = useState(false);

    // Reminder config state (includes quiet hours)
    const [reminderConfig, setReminderConfig] = useState({
        remind24h: true,
        remind6h: true,
        remind2h: false,
        remind1h: false,
        quietHoursEnabled: true,
        quietHoursStart: "21:00",
        quietHoursEnd: "08:00",
        quietDaysJson: "[]",
        allowUrgentInQuiet: false,
    });
    const [savingReminders, setSavingReminders] = useState(false);

    // (template state moved to TemplateStatusCard component)

    // Loyalty program state
    const [loyaltyConfig, setLoyaltyConfig] = useState({
        enabled: false,
        visitsRequired: 5,
        rewardLabel: "",       // service name (display label)
        rewardServiceId: "",   // service id for reference
        countMembershipVisits: true,
    });
    const [savingLoyalty, setSavingLoyalty] = useState(false);
    const [shopServices, setShopServices] = useState<{ id: string; name: string; price: number }[]>([]);

    const fetchShop = async () => {
        try {
            const res = await fetch("/api/shop");
            const data = await res.json();
            setShopData(data);
            // reactivationMessage removed — now handled via templates
        } catch (error) {
            console.error("Failed to fetch shop:", error);
        }
    };

    const fetchHours = async () => {
        try {
            const res = await fetch("/api/shop/hours");
            const data = await res.json();
            if (Array.isArray(data)) {
                // If we have data, we use it. If not, we keep defaults.
                if (data.length > 0) setDailyHours(data);
            }
        } catch (error) {
            console.error("Failed to fetch shop hours:", error);
        }
    };

    const fetchCalendarSettings = async () => {
        try {
            const res = await fetch("/api/calendar/settings");
            const data = await res.json();
            setCalendarConnected(data.connected);
            setCalendarSettings(data.settings);
            setIcsToken(data.icsToken || null);
            setIcsFeedUrl(data.icsFeedUrl || null);
            if (data.settings?.syncDirection) {
                setSyncDirection(data.settings.syncDirection);
            }
            if (data.settings?.calendarId) {
                setSelectedCalendar(data.settings.calendarId);
            }
        } catch (error) {
            console.error("Failed to fetch calendar settings:", error);
        }
    };

    const connectCalendar = async () => {
        try {
            const res = await fetch("/api/calendar/connect", { method: "POST", credentials: 'include' });
            const data = await res.json();
            if (data.authUrl) {
                window.location.href = data.authUrl;
            }
        } catch (error) {
            console.error("Failed to connect calendar:", error);
        }
    };

    const disconnectCalendar = async () => {
        try {
            await fetch("/api/calendar/settings", { method: "DELETE", credentials: 'include' });
            setCalendarConnected(false);
            setCalendarSettings(null);
            setCalendarList([]);
        } catch (error) {
            console.error("Failed to disconnect calendar:", error);
        }
    };

    const generateIcsToken = async () => {
        setGeneratingIcs(true);
        try {
            const res = await fetch("/api/calendar/ics", { method: "POST", credentials: 'include' });
            const data = await res.json();
            if (data.token) {
                setIcsToken(data.token);
                setIcsFeedUrl(data.feedUrl);
                toast.success("Link de calendario generado");
            }
        } catch (error) {
            toast.error("Error al generar link");
        } finally {
            setGeneratingIcs(false);
        }
    };

    const revokeIcsToken = async () => {
        try {
            await fetch("/api/calendar/ics", { method: "DELETE", credentials: 'include' });
            setIcsToken(null);
            setIcsFeedUrl(null);
            toast.success("Feed de calendario desactivado");
        } catch (error) {
            toast.error("Error al desactivar feed");
        }
    };

    const copyIcsUrl = () => {
        if (icsFeedUrl) {
            navigator.clipboard.writeText(icsFeedUrl);
            setIcsCopied(true);
            setTimeout(() => setIcsCopied(false), 2000);
        }
    };

    const updateCalendarSettings = async () => {
        try {
            await fetch("/api/calendar/settings", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    enabled: true,
                    calendarId: selectedCalendar,
                    direction: syncDirection,
                }),
            });
            toast.success("Configuración de calendario actualizada");
        } catch (error) {
            console.error("Failed to update calendar settings:", error);
        }
    };

    const syncCalendar = async () => {
        setSyncing(true);
        try {
            const res = await fetch("/api/calendar/sync", { method: "POST", credentials: 'include' });
            const data = await res.json();
            if (data.success) {
                toast.success(`Sincronización completada: ${data.results.success} citas sincronizadas`);
            }
        } catch (error) {
            console.error("Failed to sync calendar:", error);
        } finally {
            setSyncing(false);
        }
    };

    const fetchCalendarList = async () => {
        try {
            const res = await fetch("/api/calendar/sync");
            const data = await res.json();
            setCalendarList(data.calendars || []);
        } catch (error) {
            console.error("Failed to fetch calendar list:", error);
        }
    };

    const fetchWhatsAppSettings = async () => {
        try {
            const res = await fetch("/api/shop");
            const data = await res.json();
            setWhatsappEnabled(data.whatsappEnabled || false);
            setWhatsappPhone(data.whatsappPhoneNumber || '');
            setWhatsappProvider(data.whatsappProvider || 'META');
            setMetaTokenExpiresAt(data.metaTokenExpiresAt ? new Date(data.metaTokenExpiresAt) : null);
        } catch (error) {
            console.error("Failed to fetch WhatsApp settings:", error);
        }
    };

    const fetchReminderConfig = async () => {
        try {
            const res = await fetch("/api/reminders/config");
            if (res.ok) {
                const data = await res.json();
                setReminderConfig(data);
            }
        } catch (error) {
            console.error("Failed to fetch reminder config:", error);
        }
    };

    const saveReminderConfig = async () => {
        setSavingReminders(true);
        try {
            const res = await fetch("/api/reminders/config", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(reminderConfig),
            });
            if (!res.ok) throw new Error("Error al guardar");
            toast.success("Recordatorios actualizados");
        } catch (error) {
            toast.error("Error al guardar la configuración de recordatorios");
        } finally {
            setSavingReminders(false);
        }
    };

    const fetchShopServices = async () => {
        try {
            const res = await fetch("/api/services", { credentials: 'include' });
            if (res.ok) {
                const data = await res.json();
                setShopServices(Array.isArray(data) ? data : (data.services ?? []));
            }
        } catch (error) {
            console.error("Failed to fetch services:", error);
        }
    };

    const fetchLoyaltyConfig = async () => {
        try {
            const res = await fetch("/api/loyalty/config", { credentials: 'include' });
            if (res.ok) {
                const data = await res.json();
                // If label is "any service" but no specific serviceId → restore "ANY" sentinel
                const rewardServiceId = data.rewardServiceId
                    ?? (data.rewardLabel === "un servicio a su elección" ? "ANY" : "");
                setLoyaltyConfig({
                    enabled: data.enabled ?? false,
                    visitsRequired: data.visitsRequired ?? 5,
                    rewardLabel: data.rewardLabel ?? "",
                    rewardServiceId,
                    countMembershipVisits: data.countMembershipVisits ?? true,
                });
            }
        } catch (error) {
            console.error("Failed to fetch loyalty config:", error);
        }
    };

    const saveLoyaltyConfig = async (silent = false) => {
        if (loyaltyConfig.enabled && !loyaltyConfig.rewardServiceId) {
            toast.error("Selecciona la recompensa antes de activar el programa de lealtad.");
            return false;
        }
        setSavingLoyalty(true);
        try {
            const res = await fetch("/api/loyalty/config", {
                method: "POST",
                credentials: 'include',
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    enabled: loyaltyConfig.enabled,
                    visitsRequired: loyaltyConfig.visitsRequired,
                    rewardServiceId: loyaltyConfig.rewardServiceId || null,
                    countMembershipVisits: loyaltyConfig.countMembershipVisits,
                }),
            });
            const data = await res.json();
            if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
            if (!silent) toast.success("Programa de lealtad actualizado");
            return true;
        } catch (error: any) {
            toast.error(`Error al guardar lealtad: ${error.message}`);
            return false;
        } finally {
            setSavingLoyalty(false);
        }
    };

    const [whatsappMode, setWhatsappMode] = useState<'coexistence' | 'cloud_api' | null>(null);

    const handleEmbeddedSignupSuccess = async (result: { code: string; wabaId: string; phoneNumberId: string; featureType: 'coexistence' | 'cloud_api' }) => {
        setVerifyingPhone(true);
        try {
            const res = await fetch('/api/whatsapp/embedded-signup', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                credentials: 'include',
                body: JSON.stringify(result),
            });
            const json = await res.json();
            if (!res.ok) {
                toast.error(json.error || 'Error al conectar');
                return;
            }
            setWhatsappEnabled(true);
            setWhatsappPhone(json.phoneNumber);
            setWhatsappMode(null);
            if (json.syncing) {
                toast.success('WhatsApp conectado. Sincronizando con Meta — tarda 4-6h.');
            } else if (json.ready) {
                toast.success('¡WhatsApp conectado y listo!');
            } else {
                toast.success('WhatsApp conectado. Revisa el panel para acciones pendientes.');
            }
        } catch (err: any) {
            toast.error(err.message || 'Error de conexión');
        } finally {
            setVerifyingPhone(false);
        }
    };

    const handleEmbeddedSignupError = (msg: string) => {
        toast.error(msg);
        setVerifyingPhone(false);
    };

    const disconnectWhatsApp = async () => {
        try {
            await fetch("/api/whatsapp/disconnect", { method: "DELETE", credentials: 'include' });
            setWhatsappEnabled(false);
            setWhatsappPhone('');
            toast.info('WhatsApp desconectado');
        } catch (error) {
            console.error("Failed to disconnect WhatsApp:", error);
        }
    };

    useEffect(() => {
        Promise.all([fetchShop(), fetchHours(), fetchCalendarSettings(), fetchWhatsAppSettings(), fetchReminderConfig(), fetchLoyaltyConfig(), fetchShopServices()]).finally(() => setLoading(false));

        // Check for callback parameters
        const calendarSuccess = searchParams.get('calendar_success');
        const calendarError = searchParams.get('calendar_error');

        if (calendarSuccess === 'connected') {
            toast.success('¡Google Calendar conectado exitosamente!');
            router.replace('/dashboard/settings');
        } else if (calendarError) {
            toast.error(`Error al conectar Google Calendar: ${calendarError}`);
            router.replace('/dashboard/settings');
        }
    }, []);

    const handleSave = async () => {
        setSaving(true);
        try {
            // Save Shop Profile (including reactivation message)
            const profileRes = await fetch("/api/shop", {
                method: "PUT",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    name: shopData.name,
                    address: shopData.address,
                    phoneNumber: shopData.phoneNumber,
                    whatsappNumber: shopData.whatsappNumber,
                    whatsappEnabled,
                    whatsappPhoneNumber: whatsappPhone,
                    logoUrl: shopData.logoUrl,
                    ownerNotificationPhone: shopData.ownerNotificationPhone || null,
                }),
            });

            // Save Shop Hours
            const hoursRes = await fetch("/api/shop/hours", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({
                    schedules: dailyHours.map(h => ({ ...h, active: true }))
                }),
            });

            // Save Calendar Settings if connected
            let calendarRes = { ok: true };
            if (calendarConnected) {
                calendarRes = await fetch("/api/calendar/settings", {
                    method: "PUT",
                    headers: { "Content-Type": "application/json" },
                    body: JSON.stringify({
                        enabled: true,
                        calendarId: selectedCalendar,
                        direction: syncDirection,
                    }),
                });
            }

            // Save Reminder Config
            await fetch("/api/reminders/config", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify(reminderConfig),
            });

            // Save Loyalty Config (silent — errors shown inline via saveLoyaltyConfig)
            await saveLoyaltyConfig(true);

            if (profileRes.ok && hoursRes.ok && calendarRes.ok) {
                toast.success("Todos los ajustes guardados correctamente");
            }
        } catch (error) {
            console.error("Update failed:", error);
            toast.error("Error al guardar los ajustes");
        } finally {
            setSaving(false);
        }
    };

    const toggleDay = (day: number) => {
        setDailyHours(prev => {
            const isActive = prev.some(h => h.dayOfWeek === day);
            if (isActive) {
                return prev.filter(h => h.dayOfWeek !== day);
            } else {
                return [...prev, { dayOfWeek: day, startTime: "08:00", endTime: "20:00" }];
            }
        });
    };

    const addSegment = (day: number) => {
        setDailyHours(prev => {
            const daySegments = prev.filter(h => h.dayOfWeek === day);
            const lastSegment = daySegments[daySegments.length - 1];
            return [...prev, {
                dayOfWeek: day,
                startTime: lastSegment?.endTime || "08:00",
                endTime: "20:00"
            }];
        });
    };

    const removeSegment = (day: number, index: number) => {
        setDailyHours(prev => {
            const daySegments = prev.filter(h => h.dayOfWeek === day);
            const target = daySegments[index];
            return prev.filter(h => h !== target);
        });
    };

    const updateSegment = (day: number, index: number, updates: any) => {
        setDailyHours(prev => {
            const daySegments = prev.filter(h => h.dayOfWeek === day);
            const target = daySegments[index];
            return prev.map(h => h === target ? { ...h, ...updates } : h);
        });
    };

    const currentPlan = shopData?.plan || 'SOLO';
    const hasReminders = true; // Always available — every paid plan + trial has reminders
    const hasLoyalty = ['TEAM', 'BUSINESS', 'ENTERPRISE'].includes(currentPlan);

    const TABS = [
        { id: 'negocio' as const, label: 'Negocio', icon: Store },
        { id: 'calendarios' as const, label: 'Calendarios', icon: Calendar },
        { id: 'whatsapp' as const, label: 'WhatsApp', icon: MessageCircle },
        { id: 'fidelidad' as const, label: 'Fidelidad', icon: Star },
    ];

    return (
        <div className="max-w-4xl space-y-8 pb-20">
            <FacebookSDKScript />

            {/* Header + Tabs */}
            <div className="space-y-5">
                <div>
                    <h1 className="text-4xl font-black tracking-tight text-charcoal">Ajustes del Negocio</h1>
                    <p className="text-gray-500 font-medium mt-1">Configura tu barbería, integraciones y automatizaciones.</p>
                </div>

                {/* Tab Navigation */}
                <div className="flex gap-2 overflow-x-auto pb-1 scrollbar-hide">
                    {TABS.map((tab) => (
                        <button
                            key={tab.id}
                            onClick={() => setActiveTab(tab.id)}
                            className={`flex items-center gap-2 px-5 py-2.5 rounded-xl font-black text-sm transition-all whitespace-nowrap ${
                                activeTab === tab.id
                                    ? 'bg-primary text-white shadow-lg shadow-primary/20'
                                    : 'bg-gray-100 text-gray-500 hover:bg-gray-200 hover:text-gray-700'
                            }`}
                        >
                            <tab.icon className="h-4 w-4" />
                            {tab.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* ══════════════════════════════════════════════════════════════════════
                TAB: NEGOCIO
               ══════════════════════════════════════════════════════════════════════ */}
            {activeTab === 'negocio' && (
            <div className="grid gap-6 md:grid-cols-2">
                {/* Shop Profile */}
                <div className="card-luxury p-8 space-y-6">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-primary/5 rounded-xl text-primary">
                            <Store className="h-6 w-6" />
                        </div>
                        <h2 className="text-xl font-black text-charcoal">Perfil del Negocio</h2>
                    </div>

                    <div className="space-y-6">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] ml-1">Nombre Comercial</label>
                            <div className="relative group">
                                <Store className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 group-focus-within:text-primary transition-colors" />
                                <input
                                    className="w-full bg-gray-50 border border-gray-200 rounded-xl pl-12 pr-4 py-3 text-sm font-semibold text-gray-700 outline-none focus:ring-4 focus:ring-cyan-500/10 focus:border-primary/20 transition-all"
                                    value={shopData?.name || ""}
                                    onChange={(e) => setShopData({ ...shopData, name: e.target.value })}
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] ml-1">Teléfono de Contacto</label>
                            <div className="relative group">
                                <Phone className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 group-focus-within:text-primary transition-colors" />
                                <input
                                    className="w-full bg-gray-50 border border-gray-200 rounded-xl pl-12 pr-4 py-3 text-sm font-semibold text-gray-700 outline-none focus:ring-4 focus:ring-cyan-500/10 focus:border-primary/20 transition-all"
                                    value={shopData?.phoneNumber || ""}
                                    onChange={(e) => setShopData({ ...shopData, phoneNumber: e.target.value })}
                                />
                            </div>
                        </div>

                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] ml-1">Dirección Física</label>
                            <AddressAutocomplete
                                value={shopData?.address || ""}
                                onChange={(address) => setShopData({ ...shopData, address })}
                                onPlaceSelect={(place) => setShopData({
                                    ...shopData,
                                    address: place.address,
                                    latitude: place.latitude,
                                    longitude: place.longitude,
                                    placeId: place.placeId,
                                })}
                                placeholder="Busca la dirección del negocio..."
                                inputClassName="bg-gray-50"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] ml-1">Teléfono para notificaciones (dueño)</label>
                            <p className="text-[11px] text-gray-400 ml-1">Recibirás alertas de reservas, cancelaciones y clientes molestos en este número.</p>
                            <div className="relative group">
                                <Bell className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400 group-focus-within:text-primary transition-colors" />
                                <input
                                    className="w-full bg-gray-50 border border-gray-200 rounded-xl pl-12 pr-4 py-3 text-sm font-semibold text-gray-700 outline-none focus:ring-4 focus:ring-cyan-500/10 focus:border-primary/20 transition-all"
                                    placeholder="+1 809 555 0000"
                                    value={shopData?.ownerNotificationPhone || ""}
                                    onChange={(e) => setShopData({ ...shopData, ownerNotificationPhone: e.target.value })}
                                />
                            </div>
                        </div>
                    </div>
                </div>

                {/* Business Hours */}
                <div className="card-luxury p-8 space-y-6">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="p-2.5 bg-emerald-50 rounded-xl text-emerald-600">
                                <Clock className="h-6 w-6" />
                            </div>
                            <h2 className="text-xl font-black text-charcoal">Horario de Apertura</h2>
                        </div>
                    </div>

                    <div className="space-y-4">
                        {[0, 1, 2, 3, 4, 5, 6].map((day) => {
                            const daySegments = dailyHours.filter(h => h.dayOfWeek === day);
                            const isActive = daySegments.length > 0;

                            return (
                                <div key={day} className="flex flex-col gap-2 py-4 border-b border-gray-100 last:border-0">
                                    <div className="flex items-center justify-between mb-1">
                                        <div className="flex items-center gap-3">
                                            <button
                                                onClick={() => toggleDay(day)}
                                                className={`relative inline-flex h-5 w-9 items-center rounded-full transition-colors ${isActive ? 'bg-emerald-500' : 'bg-gray-200'}`}
                                            >
                                                <span className={`inline-block h-3 w-3 transform rounded-full bg-white transition-transform ${isActive ? 'translate-x-5' : 'translate-x-1'}`} />
                                            </button>
                                            <span className={`text-xs font-bold ${isActive ? 'text-charcoal' : 'text-gray-400'}`}>
                                                {["Domingo", "Lunes", "Martes", "Miércoles", "Jueves", "Viernes", "Sábado"][day]}
                                            </span>
                                        </div>

                                        {isActive && (
                                            <button
                                                onClick={() => addSegment(day)}
                                                className="text-[10px] font-black text-emerald-600 uppercase tracking-widest hover:text-emerald-700"
                                            >
                                                + Añadir Tramo
                                            </button>
                                        )}
                                    </div>

                                    {isActive ? (
                                        <div className="space-y-2 ml-12">
                                            {daySegments.map((segment, idx) => (
                                                <div key={idx} className="flex items-center gap-2 group">
                                                    <input
                                                        type="time"
                                                        value={segment.startTime}
                                                        onChange={(e) => updateSegment(day, idx, { startTime: e.target.value })}
                                                        className="bg-gray-50 border border-gray-100 rounded-xl px-2 py-1 text-[10px] font-bold text-gray-600 outline-none focus:border-emerald-500 transition-all"
                                                    />
                                                    <span className="text-gray-300 text-[10px] font-bold">a</span>
                                                    <input
                                                        type="time"
                                                        value={segment.endTime}
                                                        onChange={(e) => updateSegment(day, idx, { endTime: e.target.value })}
                                                        className="bg-gray-50 border border-gray-100 rounded-xl px-2 py-1 text-[10px] font-bold text-gray-600 outline-none focus:border-emerald-500 transition-all"
                                                    />
                                                    {daySegments.length > 1 && (
                                                        <button
                                                            onClick={() => removeSegment(day, idx)}
                                                            className="opacity-0 group-hover:opacity-100 text-gray-400 hover:text-red-500 transition-all p-1"
                                                        >
                                                            <Clock className="h-3 w-3 rotate-45" />
                                                        </button>
                                                    )}
                                                </div>
                                            ))}
                                        </div>
                                    ) : (
                                        <span className="text-[10px] font-black text-gray-300 uppercase tracking-widest ml-12">Cerrado</span>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </div>


            </div>
            )}

            {/* TAB: CALENDARIOS */}
            {activeTab === 'calendarios' && (
                <CalendarsTab
                    calendarConnected={calendarConnected}
                    calendarSettings={calendarSettings}
                    syncDirection={syncDirection}
                    setSyncDirection={setSyncDirection}
                    syncing={syncing}
                    icsToken={icsToken}
                    icsFeedUrl={icsFeedUrl}
                    icsCopied={icsCopied}
                    generatingIcs={generatingIcs}
                    connectCalendar={connectCalendar}
                    disconnectCalendar={disconnectCalendar}
                    syncCalendar={syncCalendar}
                    generateIcsToken={generateIcsToken}
                    copyIcsUrl={copyIcsUrl}
                    revokeIcsToken={revokeIcsToken}
                />
            )}

            {/* ══════════════════════════════════════════════════════════════════════
                TAB: WHATSAPP
               ══════════════════════════════════════════════════════════════════════ */}
            {activeTab === 'whatsapp' && (
            <div className="space-y-6">
                {/* Meta token expiry alert */}
                {whatsappProvider === 'META' && whatsappEnabled && (() => {
                    if (!metaTokenExpiresAt) return null;
                    const now = Date.now();
                    const expiresMs = metaTokenExpiresAt.getTime();
                    const daysLeft = Math.floor((expiresMs - now) / (1000 * 60 * 60 * 24));
                    const isExpired = expiresMs <= now;
                    const isWarning = daysLeft <= 7 && !isExpired;
                    if (!isExpired && !isWarning) return null;
                    return (
                        <div className={`flex items-start gap-3 p-4 rounded-2xl border ${isExpired ? 'bg-red-50 border-red-200' : 'bg-amber-50 border-amber-200'}`}>
                            <AlertCircle className={`h-5 w-5 shrink-0 mt-0.5 ${isExpired ? 'text-red-500' : 'text-amber-500'}`} />
                            <div className="flex-1">
                                <p className={`text-sm font-bold ${isExpired ? 'text-red-800' : 'text-amber-800'}`}>
                                    {isExpired
                                        ? 'Conexión con WhatsApp interrumpida — token expirado'
                                        : `La conexión con WhatsApp expira en ${daysLeft} día${daysLeft !== 1 ? 's' : ''}`}
                                </p>
                                <p className={`text-xs mt-0.5 ${isExpired ? 'text-red-600' : 'text-amber-600'}`}>
                                    {isExpired
                                        ? 'Los mensajes no se están enviando. Reconecta tu cuenta para restaurar el servicio.'
                                        : 'El sistema intentará renovarla automáticamente. Si ves este mensaje por más de 2 días, reconecta tu cuenta.'}
                                </p>
                            </div>
                            <button
                                onClick={() => { setWhatsappEnabled(false); setWhatsappMode(null); }}
                                className="shrink-0 text-xs font-bold px-3 py-1.5 rounded-lg bg-white border border-current hover:opacity-80 transition-opacity"
                            >
                                Reconectar
                            </button>
                        </div>
                    );
                })()}

                {/* WhatsApp Integration */}
                <div className="card-luxury p-8 space-y-6">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-3">
                            <div className="p-2.5 bg-green-50 rounded-xl text-green-600">
                                <MessageCircle className="h-6 w-6" />
                            </div>
                            <div>
                                <h2 className="text-xl font-black text-charcoal">WhatsApp Business</h2>
                                <p className="text-xs font-semibold text-gray-400">
                                    Recibe y responde mensajes de tus clientes automaticamente
                                </p>
                            </div>
                        </div>
                        {whatsappEnabled && (
                            <div className="flex items-center gap-2 text-sm font-bold text-emerald-600 bg-emerald-50 px-4 py-2 rounded-full">
                                <CheckCircle2 className="h-4 w-4" />
                                Activo
                            </div>
                        )}
                    </div>

                    {!whatsappEnabled ? (
                        <div className="space-y-6">
                            <div className="bg-primary/5 border border-primary/20 rounded-2xl p-6 flex flex-col sm:flex-row items-start gap-4">
                                <div className="p-3 bg-white rounded-xl shadow-sm border border-gray-100 shrink-0">
                                    <Smartphone className="h-6 w-6 text-primary" />
                                </div>
                                <div className="space-y-1">
                                    <p className="text-sm font-black text-charcoal">Conecta tu WhatsApp Business</p>
                                    <p className="text-xs text-gray-500 leading-relaxed">
                                        Vincula tu número de WhatsApp Business en segundos. Sin configuraciones técnicas ni códigos manuales.
                                    </p>
                                </div>
                            </div>

                            {whatsappMode === null ? (
                                <div className="space-y-3">
                                    <p className="text-sm font-bold text-charcoal">¿Cómo quieres usar WhatsApp?</p>
                                    <button
                                        type="button"
                                        onClick={() => setWhatsappMode('coexistence')}
                                        disabled={verifyingPhone}
                                        className="w-full p-4 border-2 border-emerald-200 rounded-xl text-left hover:border-emerald-400 hover:bg-emerald-50/50 transition disabled:opacity-50"
                                    >
                                        <p className="text-sm font-bold">Mantener WhatsApp Business en mi teléfono</p>
                                        <p className="text-xs text-gray-600 mt-0.5">El bot responde Y tú sigues viendo los chats en tu teléfono. Tarda 4-6h en activarse.</p>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setWhatsappMode('cloud_api')}
                                        disabled={verifyingPhone}
                                        className="w-full p-4 border-2 border-gray-200 rounded-xl text-left hover:border-gray-400 hover:bg-gray-50 transition disabled:opacity-50"
                                    >
                                        <p className="text-sm font-bold">Solo con DomiCita</p>
                                        <p className="text-xs text-gray-600 mt-0.5">El bot maneja todo. Activación inmediata.</p>
                                    </button>
                                </div>
                            ) : (
                                <div className="space-y-3">
                                    <button
                                        type="button"
                                        onClick={() => setWhatsappMode(null)}
                                        className="text-xs text-gray-500 hover:text-gray-700"
                                    >
                                        ← Cambiar opción
                                    </button>
                                    <EmbeddedSignupLauncher
                                        featureType={whatsappMode}
                                        onSuccess={handleEmbeddedSignupSuccess}
                                        onError={handleEmbeddedSignupError}
                                        disabled={verifyingPhone}
                                        buttonClassName="w-full inline-flex items-center justify-center px-5 py-3 bg-emerald-600 text-white rounded-xl font-bold hover:bg-emerald-700 transition disabled:opacity-50"
                                    />
                                </div>
                            )}
                        </div>
                    ) : (
                        <div className="space-y-8">
                            <div className="bg-emerald-50 border-2 border-emerald-100 rounded-2xl p-6 flex items-center gap-4">
                                <div className="w-12 h-12 bg-emerald-500 rounded-full flex items-center justify-center shadow-lg shadow-emerald-200 shrink-0">
                                    <CheckCircle2 className="h-6 w-6 text-white" />
                                </div>
                                <div>
                                    <p className="text-base font-black text-emerald-900">Vinculado Correctamente</p>
                                    <p className="text-sm text-emerald-700 font-medium">{whatsappPhone || 'Configurado'}</p>
                                </div>
                            </div>

                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                                {[
                                    { label: 'Chatbot IA Activo', icon: Star },
                                    { label: 'Citas Automaticas', icon: Calendar },
                                    { label: 'Confirmaciones WhatsApp', icon: CheckCircle2 },
                                    { label: 'Recordatorios 24h', icon: Bell },
                                ].map((item, i) => (
                                    <div key={i} className="flex items-center gap-3 p-4 bg-gray-50 rounded-xl border border-gray-100">
                                        <item.icon className="h-4 w-4 text-emerald-600" />
                                        <span className="text-sm font-bold text-gray-700">{item.label}</span>
                                        <div className="ml-auto w-2 h-2 rounded-full bg-emerald-500 shadow-sm shadow-emerald-200" />
                                    </div>
                                ))}
                            </div>


                            <button
                                onClick={disconnectWhatsApp}
                                className="w-full flex items-center justify-center gap-2 text-gray-400 hover:text-red-600 hover:bg-red-50 px-6 py-3 rounded-xl font-bold transition-all text-xs uppercase tracking-widest"
                            >
                                <X className="h-3 w-3" />
                                Desvincular WhatsApp Business
                            </button>
                        </div>
                    )}
                </div>

                {/* Bot Schedule */}
                {whatsappEnabled && <BotScheduleCard />}

                {/* Reminder Config Section */}
                <div className={`card-luxury p-8 space-y-6 ${!hasReminders ? 'opacity-60' : ''}`}>
                    <div className="flex items-center justify-between gap-3">
                        <div className="flex items-center gap-3">
                            <div className="p-2.5 bg-primary/5 rounded-xl text-primary">
                                <Bell className="h-6 w-6" />
                            </div>
                            <div>
                                <h2 className="text-xl font-black text-charcoal">Recordatorios Automaticos</h2>
                                <p className="text-xs text-gray-400 font-medium mt-0.5">Se envian por WhatsApp antes de cada cita</p>
                            </div>
                        </div>
                        {!hasReminders && (
                            <a
                                href="/dashboard/plans"
                                className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-white text-xs font-black rounded-lg hover:bg-primary/90 transition-colors whitespace-nowrap"
                            >
                                Plan SOLO+ — $19/mes
                            </a>
                        )}
                    </div>

                    {!hasReminders && (
                        <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800 font-medium">
                            Los recordatorios automaticos estan disponibles desde el plan SOLO. Actualiza para activarlos.
                        </div>
                    )}

                    <div className="space-y-3">
                        {[
                            { key: 'remind24h' as const, label: '24 horas antes', desc: 'Recordatorio el dia anterior' },
                            { key: 'remind6h' as const, label: '6 horas antes', desc: 'Mañana temprano o tarde del mismo dia' },
                            { key: 'remind2h' as const, label: '2 horas antes', desc: 'Para clientes que se olvidan facil' },
                            { key: 'remind1h' as const, label: '1 hora antes', desc: 'Ultimo aviso antes de la cita' },
                        ].map(({ key, label, desc }) => (
                            <div key={key} className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                                <div>
                                    <p className="text-sm font-bold text-gray-700">{label}</p>
                                    <p className="text-xs text-gray-400">{desc}</p>
                                </div>
                                <button
                                    onClick={() => hasReminders && setReminderConfig(prev => ({ ...prev, [key]: !prev[key] }))}
                                    disabled={!hasReminders}
                                    className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors disabled:cursor-not-allowed ${reminderConfig[key] && hasReminders ? 'bg-emerald-500' : 'bg-gray-300'}`}
                                >
                                    <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${reminderConfig[key] && hasReminders ? 'translate-x-6' : 'translate-x-1'}`} />
                                </button>
                            </div>
                        ))}
                    </div>

                    <p className="text-xs text-gray-400">
                        Requiere WhatsApp conectado. Solo se envian si el negocio tiene WhatsApp activo.
                    </p>

                    {/* ─── Quiet Hours ───────────────────────────── */}
                    <div className="mt-6 pt-6 border-t border-gray-200 space-y-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <h3 className="text-sm font-black text-charcoal">Horario sin molestias</h3>
                                <p className="text-xs text-gray-400">Bloquea recordatorios en horas que pueden molestar a tus clientes</p>
                            </div>
                            <button
                                onClick={() => hasReminders && setReminderConfig(prev => ({ ...prev, quietHoursEnabled: !prev.quietHoursEnabled }))}
                                disabled={!hasReminders}
                                className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors disabled:cursor-not-allowed ${reminderConfig.quietHoursEnabled && hasReminders ? 'bg-emerald-500' : 'bg-gray-300'}`}
                            >
                                <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${reminderConfig.quietHoursEnabled && hasReminders ? 'translate-x-6' : 'translate-x-1'}`} />
                            </button>
                        </div>

                        {reminderConfig.quietHoursEnabled && hasReminders && (
                            <>
                                <div className="grid grid-cols-2 gap-3">
                                    <div>
                                        <label className="text-xs font-bold text-gray-600 mb-1 block">No enviar desde</label>
                                        <input
                                            type="time"
                                            value={reminderConfig.quietHoursStart}
                                            onChange={(e) => setReminderConfig(prev => ({ ...prev, quietHoursStart: e.target.value }))}
                                            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                                        />
                                    </div>
                                    <div>
                                        <label className="text-xs font-bold text-gray-600 mb-1 block">Reanudar a las</label>
                                        <input
                                            type="time"
                                            value={reminderConfig.quietHoursEnd}
                                            onChange={(e) => setReminderConfig(prev => ({ ...prev, quietHoursEnd: e.target.value }))}
                                            className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm"
                                        />
                                    </div>
                                </div>

                                <div>
                                    <label className="text-xs font-bold text-gray-600 mb-2 block">Dias sin recordatorios</label>
                                    <div className="flex gap-1.5 flex-wrap">
                                        {[
                                            { d: 0, l: 'Dom' },
                                            { d: 1, l: 'Lun' },
                                            { d: 2, l: 'Mar' },
                                            { d: 3, l: 'Mie' },
                                            { d: 4, l: 'Jue' },
                                            { d: 5, l: 'Vie' },
                                            { d: 6, l: 'Sab' },
                                        ].map(({ d, l }) => {
                                            const days = (() => { try { return JSON.parse(reminderConfig.quietDaysJson) as number[]; } catch { return []; } })();
                                            const active = days.includes(d);
                                            return (
                                                <button
                                                    key={d}
                                                    type="button"
                                                    onClick={() => {
                                                        const next = active ? days.filter(x => x !== d) : [...days, d].sort();
                                                        setReminderConfig(prev => ({ ...prev, quietDaysJson: JSON.stringify(next) }));
                                                    }}
                                                    className={`px-3 py-1.5 text-xs font-bold rounded-lg border transition-colors ${active ? 'bg-primary text-white border-primary' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'}`}
                                                >
                                                    {l}
                                                </button>
                                            );
                                        })}
                                    </div>
                                </div>

                                <div className="flex items-start justify-between p-3 bg-amber-50 border border-amber-200 rounded-lg">
                                    <div className="pr-3">
                                        <p className="text-xs font-bold text-amber-900">Permitir avisos urgentes (1h/2h) fuera de horario</p>
                                        <p className="text-[11px] text-amber-700 mt-0.5">Si la cita es a las 9 AM, el aviso de 1h cae a las 8 AM. Activa esto para que igual se envie.</p>
                                    </div>
                                    <button
                                        onClick={() => setReminderConfig(prev => ({ ...prev, allowUrgentInQuiet: !prev.allowUrgentInQuiet }))}
                                        className={`relative inline-flex h-6 w-11 shrink-0 items-center rounded-full transition-colors ${reminderConfig.allowUrgentInQuiet ? 'bg-amber-500' : 'bg-gray-300'}`}
                                    >
                                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${reminderConfig.allowUrgentInQuiet ? 'translate-x-6' : 'translate-x-1'}`} />
                                    </button>
                                </div>
                            </>
                        )}
                    </div>

                    <div className="flex justify-end">
                        <button
                            onClick={saveReminderConfig}
                            disabled={savingReminders || !hasReminders}
                            className="flex items-center gap-2 bg-primary text-white px-6 py-2.5 rounded-xl font-bold text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {savingReminders ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                            Guardar Recordatorios
                        </button>
                    </div>
                </div>

                {/* Template Status (read-only) */}
                <TemplateStatusCard shopId={shopData?.id} />
            </div>
            )}

            {/* TAB: FIDELIDAD */}
            {activeTab === 'fidelidad' && (
                <LoyaltyTab
                    hasLoyalty={hasLoyalty}
                    loyaltyConfig={loyaltyConfig}
                    setLoyaltyConfig={setLoyaltyConfig}
                    shopServices={shopServices}
                    saveLoyaltyConfig={() => saveLoyaltyConfig()}
                    savingLoyalty={savingLoyalty}
                />
            )}

            <div className="flex justify-end gap-4 pt-4 border-t border-gray-100">
                <button
                    onClick={fetchShop}
                    className="px-8 py-3.5 rounded-xl text-sm font-black text-gray-400 hover:text-charcoal transition-all"
                >
                    Descartar Cambios
                </button>
                <button
                    onClick={handleSave}
                    disabled={saving}
                    className="flex items-center gap-2 btn-accent-luxury px-10 py-3.5 rounded-xl font-black disabled:opacity-50"
                >
                    {saving ? <Loader2 className="h-5 w-5 animate-spin" /> : <Save className="h-5 w-5" />}
                    Guardar Todo
                </button>
            </div>

        </div >
    );
}

// ─── Template Status Card (read-only) ────────────────────────────────────

function TemplateStatusCard({ shopId }: { shopId?: string }) {
    const toast = useToast();
    const [templates, setTemplates] = useState<any[]>([]);
    const [loading, setLoading] = useState(false);
    const [syncing, setSyncing] = useState(false);
    const [expandedId, setExpandedId] = useState<string | null>(null);

    const fetchTemplates = useCallback(async () => {
        if (!shopId) return;
        setLoading(true);
        try {
            const res = await fetch("/api/whatsapp/templates");
            if (res.ok) {
                const data = await res.json();
                setTemplates(data.templates || []);
            }
        } catch (err) {
            console.error("Failed to fetch templates:", err);
        } finally {
            setLoading(false);
        }
    }, [shopId]);

    useEffect(() => {
        fetchTemplates();
    }, [fetchTemplates]);

    const reseed = async () => {
        if (!confirm('Esto eliminará tus plantillas en borrador, pendientes o rechazadas (tanto en Meta como aquí) y las recreará desde cero con el contenido actual. Las plantillas ya aprobadas no se tocan. ¿Continuar?')) return;
        setSyncing(true);
        try {
            const res = await fetch('/api/whatsapp/templates', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'reseed' }),
            });
            const data = await res.json().catch(() => ({}));
            if (res.ok && data.templates) {
                setTemplates(data.templates);
                toast.success('Plantillas regeneradas');
            } else {
                toast.error(data.error || 'Error al regenerar plantillas');
            }
        } catch {
            toast.error('Error de conexión al regenerar');
        } finally {
            setSyncing(false);
        }
    };

    const syncAll = async () => {
        setSyncing(true);
        try {
            const res = await fetch('/api/whatsapp/templates', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ action: 'sync-all' }),
            });
            const data = await res.json().catch(() => ({}));
            if (!res.ok) {
                toast.error(data.error || 'Error al sincronizar plantillas');
                await fetchTemplates();
                return;
            }

            const prevTemplates = templates;
            const next = data.templates || [];
            setTemplates(next);

            if (data.registered > 0) {
                toast.success(`${data.registered} plantilla(s) enviadas a Meta`);
            }

            // Detect status changes from the refresh (e.g. PENDING → APPROVED)
            const changes = next.filter((t: any) => {
                const prev = prevTemplates.find((p: any) => p.id === t.id);
                return prev && prev.status !== t.status;
            });
            if (changes.length > 0) {
                const approvals = changes.filter((t: any) => t.status === 'APPROVED').length;
                if (approvals > 0) {
                    toast.success(`${approvals} plantilla(s) aprobadas por Meta`);
                } else {
                    toast.success('Estado actualizado');
                }
            } else if (data.registered === 0 && (!data.errors || data.errors.length === 0)) {
                // Nothing to register and no status changes — silent success
                toast.success('Todo al día');
            }

            if (data.errors && data.errors.length > 0) {
                const first = data.errors[0];
                toast.error(`No se pudieron enviar: ${first}${data.errors.length > 1 ? ` (+${data.errors.length - 1} más)` : ''}`);
                console.error('[Sync] Errors:', data.errors);
            }
        } catch (err) {
            toast.error('Error de conexión al sincronizar');
            console.error("Sync failed:", err);
        } finally {
            setSyncing(false);
        }
    };

    const statusBadge = (status: string) => {
        switch (status) {
            case 'APPROVED': return <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-emerald-100 text-emerald-700">Aprobada</span>;
            case 'PENDING': return <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-amber-100 text-amber-700">Pendiente</span>;
            case 'REJECTED': return <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-red-100 text-red-700">Rechazada</span>;
            case 'DRAFT': return <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-gray-100 text-gray-500">Borrador</span>;
            default: return <span className="px-2 py-0.5 rounded-full text-[10px] font-black bg-gray-100 text-gray-500">{status}</span>;
        }
    };

    if (!shopId) return null;

    const approvedCount = templates.filter(t => t.status === 'APPROVED').length;
    const pendingCount = templates.filter(t => t.status === 'PENDING').length;
    const draftCount = templates.filter(t => t.status === 'DRAFT').length;
    const needsSync = pendingCount > 0 || draftCount > 0;

    return (
        <div className="card-luxury p-8 space-y-6">
            <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-primary/5 rounded-xl text-primary">
                        <Bell className="h-6 w-6" />
                    </div>
                    <div>
                        <h2 className="text-xl font-black text-charcoal">Estado de Notificaciones</h2>
                        <p className="text-xs text-gray-400 font-medium mt-0.5">
                            Plantillas de mensajes automaticos
                        </p>
                    </div>
                </div>
                <div className="flex items-center gap-2">
                {templates.length > 0 && (draftCount > 0 || pendingCount > 0) && (
                    <button
                        onClick={reseed}
                        disabled={syncing}
                        title="Elimina plantillas en borrador, pendientes o rechazadas (en Meta y en DomiCita) y las recrea con el contenido actual"
                        className="text-xs font-semibold text-gray-400 hover:text-charcoal px-2.5 py-2 rounded-lg transition-colors disabled:opacity-50"
                    >
                        Regenerar
                    </button>
                )}
                {templates.length > 0 && needsSync && (
                    <button
                        onClick={syncAll}
                        disabled={syncing}
                        className="flex items-center gap-2 text-xs font-bold text-primary hover:bg-primary/5 px-3 py-2 rounded-lg transition-colors disabled:opacity-50"
                    >
                        {syncing ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <RefreshCw className="h-3.5 w-3.5" />}
                        {draftCount > 0 ? 'Enviar a Meta para aprobación' : 'Actualizar estado'}
                    </button>
                )}
                </div>
            </div>

            {loading ? (
                <div className="flex items-center justify-center py-8">
                    <Loader2 className="h-6 w-6 animate-spin text-gray-300" />
                </div>
            ) : templates.length === 0 ? (
                <div className="bg-gray-50 border border-gray-100 rounded-xl p-6 text-center">
                    <p className="text-sm text-gray-400">
                        Las plantillas se crean automaticamente al conectar WhatsApp.
                    </p>
                </div>
            ) : (
                <>
                    <div className="flex items-center gap-4 text-xs font-semibold">
                        <span className="text-emerald-600">{approvedCount} aprobadas</span>
                        {pendingCount > 0 && <span className="text-amber-600">{pendingCount} pendientes</span>}
                        {draftCount > 0 && <span className="text-gray-500">{draftCount} sin enviar</span>}
                        <span className="text-gray-400">{templates.length} total</span>
                    </div>

                    <div className="space-y-2">
                        {templates.map((t: any) => {
                            const isExpanded = expandedId === t.id;
                            return (
                                <div key={t.id} className="bg-gray-50 rounded-xl border border-gray-100 overflow-hidden">
                                    <button
                                        onClick={() => setExpandedId(isExpanded ? null : t.id)}
                                        className="w-full flex items-center justify-between px-4 py-3 hover:bg-gray-100/50 transition-colors"
                                    >
                                        <div className="flex items-center gap-2 min-w-0">
                                            <ChevronRight className={`h-3.5 w-3.5 text-gray-400 transition-transform flex-shrink-0 ${isExpanded ? 'rotate-90' : ''}`} />
                                            <p className="text-sm font-bold text-charcoal truncate">
                                                {PURPOSE_LABELS[t.purpose] || t.name}
                                            </p>
                                        </div>
                                        {statusBadge(t.status)}
                                    </button>
                                    {isExpanded && (
                                        <div className="px-4 pb-3 pt-0">
                                            <div className="bg-white rounded-lg border border-gray-200 p-3">
                                                <p className="text-xs text-gray-500 font-medium mb-1.5 flex items-center gap-1">
                                                    <Eye className="h-3 w-3" /> Vista previa del mensaje
                                                </p>
                                                <p className="text-sm text-charcoal leading-relaxed whitespace-pre-wrap">
                                                    {(t.bodyText || '').replace(/\{\{(\d+)\}\}/g, (_: string, num: string) => {
                                                        const vars = t.variables as Record<string, string> | null;
                                                        return vars?.[num] ? `[${vars[num]}]` : `[Variable ${num}]`;
                                                    })}
                                                </p>
                                            </div>
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>
                </>
            )}
        </div>
    );
}
