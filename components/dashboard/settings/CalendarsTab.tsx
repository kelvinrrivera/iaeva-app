"use client";

import {
    Calendar,
    Globe,
    Loader2,
    RefreshCw,
    X,
    AlertCircle,
    Link2,
    Copy,
    Check,
    Trash2,
    ArrowRight,
    ArrowLeft,
    ArrowLeftRight,
    Smartphone,
    Monitor,
} from "lucide-react";

interface CalendarsTabProps {
    calendarConnected: boolean;
    calendarSettings: any;
    syncDirection: 'PUSH' | 'PULL' | 'BIDIRECTIONAL';
    setSyncDirection: (d: 'PUSH' | 'PULL' | 'BIDIRECTIONAL') => void;
    syncing: boolean;
    icsToken: string | null;
    icsFeedUrl: string | null;
    icsCopied: boolean;
    generatingIcs: boolean;
    connectCalendar: () => void;
    disconnectCalendar: () => void;
    syncCalendar: () => void;
    generateIcsToken: () => void;
    copyIcsUrl: () => void;
    revokeIcsToken: () => void;
}

export default function CalendarsTab({
    calendarConnected,
    syncDirection,
    setSyncDirection,
    syncing,
    icsToken,
    icsFeedUrl,
    icsCopied,
    generatingIcs,
    connectCalendar,
    disconnectCalendar,
    syncCalendar,
    generateIcsToken,
    copyIcsUrl,
    revokeIcsToken,
}: CalendarsTabProps) {
    return (
        <div className="space-y-6">
            {/* Status Overview */}
            <div className="card-luxury p-6">
                <div className="flex items-center gap-4 mb-5">
                    <div className="p-3 bg-primary/10 rounded-2xl text-primary">
                        <Calendar className="h-7 w-7" />
                    </div>
                    <div>
                        <h2 className="text-2xl font-black text-charcoal">Sincronización de Calendario</h2>
                        <p className="text-sm text-gray-500 font-medium">Mantén tus citas al día en todos tus dispositivos</p>
                    </div>
                </div>

                <div className="grid grid-cols-3 gap-3">
                    <div className={`relative p-4 rounded-2xl border-2 transition-all ${calendarConnected ? 'border-primary/20 bg-primary/5' : 'border-gray-200 bg-gray-50'}`}>
                        <div className="flex items-center gap-2 mb-2">
                            <svg className="h-5 w-5" viewBox="0 0 24 24"><path d="M18.316 5.684H24v12.632h-5.684V5.684z" fill="#1a73e8"/><path d="M5.684 18.316H0V5.684h5.684v12.632z" fill="#ea4335"/><path d="M18.316 24V18.316H5.684V24h12.632z" fill="#34a853"/><path d="M5.684 5.684V0h12.632v5.684H5.684z" fill="#4285f4"/><path d="M18.316 5.684V0H24v5.684h-5.684z" fill="#188038"/><path d="M18.316 18.316H24V24h-5.684v-5.684z" fill="#fbbc04"/><path d="M0 18.316h5.684V24H0v-5.684z" fill="#1967d2"/><path d="M0 0h5.684v5.684H0V0z" fill="#e37400"/></svg>
                            <span className="text-xs font-black text-charcoal">Google</span>
                        </div>
                        {calendarConnected ? (
                            <div className="flex items-center gap-1.5">
                                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                                <span className="text-[11px] font-bold text-emerald-700">Conectado</span>
                            </div>
                        ) : (
                            <span className="text-[11px] font-semibold text-gray-400">No conectado</span>
                        )}
                    </div>

                    <div className={`relative p-4 rounded-2xl border-2 transition-all ${icsToken ? 'border-slate-200 bg-slate-50' : 'border-gray-200 bg-gray-50'}`}>
                        <div className="flex items-center gap-2 mb-2">
                            <Globe className="h-5 w-5 text-slate-600" />
                            <span className="text-xs font-black text-charcoal">Universal</span>
                        </div>
                        {icsToken ? (
                            <div className="flex items-center gap-1.5">
                                <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                                <span className="text-[11px] font-bold text-emerald-700">Feed activo</span>
                            </div>
                        ) : (
                            <span className="text-[11px] font-semibold text-gray-400">No activo</span>
                        )}
                    </div>

                    <div className="p-4 rounded-2xl border-2 border-gray-200 bg-gray-50 flex flex-col justify-center items-center">
                        <span className="text-2xl font-black text-charcoal">{(calendarConnected ? 1 : 0) + (icsToken ? 1 : 0)}</span>
                        <span className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">{(calendarConnected ? 1 : 0) + (icsToken ? 1 : 0) === 1 ? 'Activa' : 'Activas'}</span>
                    </div>
                </div>

                {calendarConnected && icsToken && (
                    <div className="flex items-start gap-3 p-4 mt-4 bg-amber-50 border border-amber-200 rounded-xl">
                        <AlertCircle className="h-5 w-5 text-amber-600 shrink-0 mt-0.5" />
                        <div>
                            <p className="text-sm font-bold text-amber-800">Ambas integraciones activas</p>
                            <p className="text-xs text-amber-700 mt-1">
                                No se duplicaran citas. Si solo usas un tipo de dispositivo, puedes desactivar la que no necesites.
                            </p>
                        </div>
                    </div>
                )}
            </div>

            {/* Google Calendar Card */}
            <div className="card-luxury overflow-hidden">
                <div className="border-b border-gray-100 p-6 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-gray-50 rounded-xl">
                            <svg className="h-7 w-7" viewBox="0 0 24 24"><path d="M18.316 5.684H24v12.632h-5.684V5.684z" fill="#1a73e8"/><path d="M5.684 18.316H0V5.684h5.684v12.632z" fill="#ea4335"/><path d="M18.316 24V18.316H5.684V24h12.632z" fill="#34a853"/><path d="M5.684 5.684V0h12.632v5.684H5.684z" fill="#4285f4"/><path d="M18.316 5.684V0H24v5.684h-5.684z" fill="#188038"/><path d="M18.316 18.316H24V24h-5.684v-5.684z" fill="#fbbc04"/><path d="M0 18.316h5.684V24H0v-5.684z" fill="#1967d2"/><path d="M0 0h5.684v5.684H0V0z" fill="#e37400"/></svg>
                        </div>
                        <div>
                            <h3 className="text-lg font-black text-charcoal">Google Calendar</h3>
                            <p className="text-gray-400 text-xs font-medium">Sincronizacion bidireccional con Google</p>
                        </div>
                    </div>
                    {calendarConnected && (
                        <div className="flex items-center gap-2 bg-emerald-50 px-4 py-2 rounded-full">
                            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                            <span className="text-xs font-bold text-emerald-700">Conectado</span>
                        </div>
                    )}
                </div>

                <div className="p-6 space-y-6">
                    {!calendarConnected ? (
                        <div className="text-center py-4 space-y-4">
                            <p className="text-sm text-gray-600">
                                Conecta tu Google Calendar para que tus citas aparezcan automaticamente en tu calendario de Google.
                            </p>
                            <button
                                onClick={connectCalendar}
                                className="inline-flex items-center justify-center gap-2 bg-primary text-white px-8 py-3 rounded-xl font-black hover:bg-primary/90 transition-all"
                            >
                                <Calendar className="h-5 w-5" />
                                Conectar Google Calendar
                            </button>
                        </div>
                    ) : (
                        <>
                            <div className="space-y-3">
                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em] ml-1">
                                    Direccion de sincronizacion
                                </label>
                                <div className="grid grid-cols-3 gap-3">
                                    {[
                                        { value: 'PUSH' as const, label: 'Subir', icon: ArrowRight, desc: 'DomiCita → Google' },
                                        { value: 'PULL' as const, label: 'Descargar', icon: ArrowLeft, desc: 'Google → DomiCita' },
                                        { value: 'BIDIRECTIONAL' as const, label: 'Bidireccional', icon: ArrowLeftRight, desc: 'Ambas direcciones' },
                                    ].map((option) => (
                                        <button
                                            key={option.value}
                                            onClick={() => setSyncDirection(option.value)}
                                            className={`p-4 rounded-xl border-2 transition-all text-center ${syncDirection === option.value
                                                ? 'border-primary/30 bg-primary/5 text-primary'
                                                : 'border-gray-200 hover:border-gray-300 text-gray-600'
                                                }`}
                                        >
                                            <option.icon className={`h-5 w-5 mx-auto mb-2 ${syncDirection === option.value ? 'text-primary' : 'text-gray-400'}`} />
                                            <div className="text-xs font-black">{option.label}</div>
                                            <div className="text-[9px] text-gray-500 mt-1">{option.desc}</div>
                                        </button>
                                    ))}
                                </div>
                            </div>

                            <div className="flex gap-3">
                                <button
                                    onClick={syncCalendar}
                                    disabled={syncing}
                                    className="flex-1 flex items-center justify-center gap-2 bg-primary text-white py-3 rounded-xl font-black disabled:opacity-50 hover:bg-primary/90 transition-all"
                                >
                                    {syncing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCw className="h-4 w-4" />}
                                    {syncing ? 'Sincronizando...' : 'Sincronizar Ahora'}
                                </button>
                                <button
                                    onClick={disconnectCalendar}
                                    className="flex items-center justify-center gap-2 text-red-500 hover:bg-red-50 px-5 py-3 rounded-xl font-bold transition-all border border-red-200"
                                >
                                    <X className="h-4 w-4" />
                                    Desconectar
                                </button>
                            </div>
                        </>
                    )}
                </div>
            </div>

            {/* ICS Calendar Feed Card */}
            <div className="card-luxury overflow-hidden">
                <div className="border-b border-gray-100 p-6 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-gray-50 rounded-xl">
                            <Globe className="h-7 w-7 text-slate-600" />
                        </div>
                        <div>
                            <h3 className="text-lg font-black text-charcoal">Calendario Universal</h3>
                            <p className="text-gray-400 text-xs font-medium">iPhone, Android, Outlook y mas</p>
                        </div>
                    </div>
                    {icsToken && (
                        <div className="flex items-center gap-2 bg-emerald-50 px-4 py-2 rounded-full">
                            <div className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse" />
                            <span className="text-xs font-bold text-emerald-700">Activo</span>
                        </div>
                    )}
                </div>

                <div className="p-6 space-y-6">
                    <div className="flex flex-wrap gap-2">
                        {[
                            { label: 'Apple Calendar', color: 'bg-gray-100 text-gray-700' },
                            { label: 'Google Calendar', color: 'bg-blue-50 text-blue-700' },
                            { label: 'Samsung Calendar', color: 'bg-indigo-50 text-indigo-700' },
                            { label: 'Outlook', color: 'bg-sky-50 text-sky-700' },
                        ].map((device) => (
                            <span key={device.label} className={`${device.color} text-[10px] font-bold px-3 py-1.5 rounded-full`}>
                                {device.label}
                            </span>
                        ))}
                    </div>

                    {!icsToken ? (
                        <div className="space-y-4">
                            <p className="text-sm text-gray-600">
                                Genera un link para que cualquier app de calendario se suscriba a tus citas. Se actualiza automaticamente cuando creas, modificas o cancelas una cita.
                            </p>
                            <button
                                onClick={generateIcsToken}
                                disabled={generatingIcs}
                                className="w-full flex items-center justify-center gap-2 bg-primary text-white hover:bg-primary/90 py-3 rounded-xl font-black transition-all disabled:opacity-50"
                            >
                                {generatingIcs ? <Loader2 className="h-5 w-5 animate-spin" /> : <Link2 className="h-5 w-5" />}
                                {generatingIcs ? 'Generando...' : 'Generar Link de Calendario'}
                            </button>
                        </div>
                    ) : (
                        <div className="space-y-5">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-gray-400 uppercase tracking-[0.2em]">Tu link de suscripcion</label>
                                <div className="flex gap-2">
                                    <div className="flex-1 bg-gray-900 rounded-xl px-4 py-3 text-xs font-mono text-emerald-400 truncate border border-gray-700">
                                        {icsFeedUrl}
                                    </div>
                                    <button
                                        onClick={copyIcsUrl}
                                        className={`px-5 rounded-xl font-bold text-sm transition-all flex items-center gap-2 ${icsCopied ? 'bg-emerald-100 text-emerald-700' : 'bg-primary text-white hover:bg-primary/90'}`}
                                    >
                                        {icsCopied ? <><Check className="h-4 w-4" /> Copiado</> : <><Copy className="h-4 w-4" /> Copiar</>}
                                    </button>
                                </div>
                            </div>

                            <div className="bg-gray-50 p-5 rounded-xl border border-gray-200 space-y-4">
                                <p className="text-sm font-black text-charcoal">Como suscribirte en 2 pasos:</p>
                                <div className="space-y-3">
                                    <div className="flex items-start gap-3">
                                        <div className="w-6 h-6 bg-primary text-white rounded-full flex items-center justify-center text-xs font-black shrink-0">1</div>
                                        <p className="text-sm text-gray-700 font-medium">Copia el link de arriba</p>
                                    </div>
                                    <div className="flex items-start gap-3">
                                        <div className="w-6 h-6 bg-primary text-white rounded-full flex items-center justify-center text-xs font-black shrink-0">2</div>
                                        <div className="text-sm text-gray-700 font-medium space-y-2">
                                            <p>Pega el link en tu app de calendario:</p>
                                            <div className="space-y-1.5 ml-1 text-xs">
                                                <div className="flex items-center gap-2">
                                                    <Smartphone className="h-3.5 w-3.5 text-gray-500" />
                                                    <span><strong>iPhone/Mac:</strong> Ajustes &gt; Calendario &gt; Cuentas &gt; Suscripcion</span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <Smartphone className="h-3.5 w-3.5 text-gray-500" />
                                                    <span><strong>Android:</strong> Google Calendar &gt; Ajustes &gt; Agregar calendario &gt; Por URL</span>
                                                </div>
                                                <div className="flex items-center gap-2">
                                                    <Monitor className="h-3.5 w-3.5 text-gray-500" />
                                                    <span><strong>Outlook:</strong> Agregar calendario &gt; Desde internet</span>
                                                </div>
                                            </div>
                                        </div>
                                    </div>
                                </div>
                                <p className="text-[11px] text-gray-500 font-semibold">
                                    Las citas se actualizan automaticamente — no tienes que hacer nada mas.
                                </p>
                            </div>

                            <button
                                onClick={revokeIcsToken}
                                className="w-full flex items-center justify-center gap-2 text-red-500 hover:bg-red-50 px-6 py-3 rounded-xl font-bold transition-all border border-red-200"
                            >
                                <Trash2 className="h-4 w-4" />
                                Desactivar Feed
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
