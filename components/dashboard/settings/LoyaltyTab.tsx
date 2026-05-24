"use client";

import { Star, Save, Loader2 } from "lucide-react";

interface LoyaltyConfig {
    enabled: boolean;
    visitsRequired: number;
    rewardLabel: string;
    rewardServiceId: string;
    countMembershipVisits: boolean;
}

interface LoyaltyTabProps {
    hasLoyalty: boolean;
    loyaltyConfig: LoyaltyConfig;
    setLoyaltyConfig: React.Dispatch<React.SetStateAction<LoyaltyConfig>>;
    shopServices: { id: string; name: string; price: number }[];
    saveLoyaltyConfig: () => void;
    savingLoyalty: boolean;
}

export default function LoyaltyTab({
    hasLoyalty,
    loyaltyConfig,
    setLoyaltyConfig,
    shopServices,
    saveLoyaltyConfig,
    savingLoyalty,
}: LoyaltyTabProps) {
    return (
        <div className="space-y-6">
            <div className={`card-luxury p-8 space-y-6 ${!hasLoyalty ? 'opacity-60' : ''}`}>
                <div className="flex items-center justify-between gap-3">
                    <div className="flex items-center gap-3">
                        <div className="p-2.5 bg-amber-500/10 rounded-xl text-amber-500">
                            <Star className="h-6 w-6" />
                        </div>
                        <div>
                            <h2 className="text-xl font-black text-charcoal">Programa de Lealtad</h2>
                            <p className="text-xs text-gray-400 font-medium mt-0.5">El bot anuncia el progreso del cliente por WhatsApp</p>
                        </div>
                    </div>
                    {!hasLoyalty && (
                        <a
                            href="/dashboard/plans"
                            className="flex items-center gap-1.5 px-3 py-1.5 bg-primary text-white text-xs font-black rounded-lg hover:bg-primary/90 transition-colors whitespace-nowrap"
                        >
                            Plan TEAM — $39/mes
                        </a>
                    )}
                </div>

                {!hasLoyalty && (
                    <div className="p-4 bg-amber-50 border border-amber-200 rounded-xl text-sm text-amber-800 font-medium">
                        El programa de lealtad esta disponible desde el plan TEAM. Actualiza para activarlo.
                    </div>
                )}

                {/* Enable/disable toggle */}
                <div className="flex items-center justify-between p-4 bg-gray-50 rounded-xl">
                    <div>
                        <p className="text-sm font-bold text-gray-700">Activar programa de lealtad</p>
                        <p className="text-xs text-gray-400">El chatbot anunciara el progreso despues de cada cita confirmada</p>
                    </div>
                    <button
                        onClick={() => hasLoyalty && setLoyaltyConfig(prev => ({ ...prev, enabled: !prev.enabled }))}
                        disabled={!hasLoyalty}
                        className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors disabled:cursor-not-allowed ${loyaltyConfig.enabled && hasLoyalty ? 'bg-amber-500' : 'bg-gray-300'}`}
                    >
                        <span className={`inline-block h-4 w-4 transform rounded-full bg-white shadow transition-transform ${loyaltyConfig.enabled && hasLoyalty ? 'translate-x-6' : 'translate-x-1'}`} />
                    </button>
                </div>

                {loyaltyConfig.enabled && hasLoyalty && (
                    <div className="space-y-4">
                        {/* Visits required */}
                        <div className="space-y-2">
                            <label className="text-sm font-bold text-gray-700">
                                Visitas para ganar la recompensa
                            </label>
                            <div className="flex items-center gap-3">
                                {[3, 5, 8, 10].map(n => (
                                    <button
                                        key={n}
                                        onClick={() => setLoyaltyConfig(prev => ({ ...prev, visitsRequired: n }))}
                                        className={`flex-1 py-2.5 rounded-xl text-sm font-bold transition-all ${loyaltyConfig.visitsRequired === n ? 'bg-amber-500 text-white' : 'bg-gray-100 text-gray-600 hover:bg-gray-200'}`}
                                    >
                                        {n} visitas
                                    </button>
                                ))}
                            </div>
                            <p className="text-xs text-gray-400">Despues de {loyaltyConfig.visitsRequired} citas, el cliente gana la recompensa</p>
                        </div>

                        {/* Reward service selector */}
                        <div className="space-y-2">
                            <label className="text-sm font-bold text-gray-700">
                                ¿Cual es el servicio de recompensa?
                            </label>
                            {shopServices.length === 0 ? (
                                <p className="text-xs text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
                                    Primero agrega servicios en{" "}
                                    <a href="/dashboard/services" className="underline font-bold">Servicios</a>{" "}
                                    para poder seleccionar la recompensa.
                                </p>
                            ) : (
                                <div className="grid grid-cols-1 gap-2">
                                    <button
                                        type="button"
                                        onClick={() => setLoyaltyConfig(prev => ({
                                            ...prev,
                                            rewardServiceId: "ANY",
                                            rewardLabel: "un servicio a su elección",
                                        }))}
                                        className={`flex items-center justify-between px-4 py-3 rounded-xl border text-sm font-medium transition-all text-left ${loyaltyConfig.rewardServiceId === "ANY"
                                            ? 'border-amber-400 bg-amber-50 text-amber-800'
                                            : 'border-gray-200 bg-gray-50 text-gray-600 hover:border-amber-300 hover:bg-amber-50/50'
                                            }`}
                                    >
                                        <div>
                                            <span className="font-bold">Cualquier servicio</span>
                                            <p className="text-[11px] text-gray-400 mt-0.5">El cliente elige el servicio que prefiera</p>
                                        </div>
                                        <span className="text-xs text-amber-500 font-bold">Recomendado</span>
                                    </button>

                                    <div className="flex items-center gap-2 py-1">
                                        <div className="flex-1 h-px bg-gray-100" />
                                        <span className="text-[10px] text-gray-300 font-bold uppercase tracking-widest">o un servicio especifico</span>
                                        <div className="flex-1 h-px bg-gray-100" />
                                    </div>

                                    {shopServices.map(svc => (
                                        <button
                                            key={svc.id}
                                            type="button"
                                            onClick={() => setLoyaltyConfig(prev => ({
                                                ...prev,
                                                rewardServiceId: svc.id,
                                                rewardLabel: svc.name,
                                            }))}
                                            className={`flex items-center justify-between px-4 py-3 rounded-xl border text-sm font-medium transition-all text-left ${loyaltyConfig.rewardServiceId === svc.id
                                                ? 'border-amber-400 bg-amber-50 text-amber-800'
                                                : 'border-gray-200 bg-gray-50 text-gray-600 hover:border-amber-300 hover:bg-amber-50/50'
                                                }`}
                                        >
                                            <span className="font-bold">{svc.name}</span>
                                            <span className="text-xs text-gray-400">RD${svc.price}</span>
                                        </button>
                                    ))}
                                </div>
                            )}
                            {loyaltyConfig.rewardLabel && (
                                <p className="text-xs text-gray-400 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
                                    Vista previa: <span className="font-semibold">Te faltan 3 visitas para ganar <em>{loyaltyConfig.rewardLabel}</em>.</span>
                                </p>
                            )}

                            {/* Membership policy */}
                            <div className="pt-4 border-t border-gray-100">
                                <label className="flex items-start gap-3 cursor-pointer">
                                    <input
                                        type="checkbox"
                                        checked={loyaltyConfig.countMembershipVisits ?? true}
                                        onChange={(e) => setLoyaltyConfig(prev => ({ ...prev, countMembershipVisits: e.target.checked }))}
                                        className="mt-0.5 h-4 w-4 rounded border-gray-300 text-amber-500 focus:ring-amber-500"
                                    />
                                    <div>
                                        <p className="text-sm font-semibold text-charcoal">Las visitas con bono cuentan para fidelidad</p>
                                        <p className="text-xs text-gray-400 mt-0.5">
                                            Si está activado, el cliente acumula visitas para fidelidad aunque pague la cita con un bono prepagado. Desactívalo si no quieres premiar dos veces.
                                        </p>
                                    </div>
                                </label>
                            </div>
                        </div>
                    </div>
                )}

                <div className="flex justify-end">
                    <button
                        onClick={() => saveLoyaltyConfig()}
                        disabled={savingLoyalty || !hasLoyalty}
                        className="flex items-center gap-2 bg-amber-500 text-white px-6 py-2.5 rounded-xl font-bold text-sm disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {savingLoyalty ? <Loader2 className="h-4 w-4 animate-spin" /> : <Save className="h-4 w-4" />}
                        Guardar Lealtad
                    </button>
                </div>
            </div>
        </div>
    );
}
