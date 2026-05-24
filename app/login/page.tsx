"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { ArrowRight, Loader2, Mail } from "lucide-react";
import Image from "next/image";

export default function LoginPage() {
    const router = useRouter();
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleLogin = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        try {
            const { data, error } = await supabase.auth.signInWithPassword({
                email,
                password,
            });

            if (error) {
                if (error.message === "Invalid login credentials") {
                    throw new Error("Email o contrasena incorrectos");
                }
                if (error.message === "Email not confirmed") {
                    throw new Error("Debes confirmar tu email antes de iniciar sesion. Revisa tu bandeja de entrada.");
                }
                throw error;
            }

            const profileRes = await fetch("/api/auth/profile", {
                method: "POST",
                credentials: "include",
            });
            const profile = await profileRes.json();

            if (profile.needsOnboarding) {
                router.push("/onboarding");
            } else {
                router.push("/dashboard");
            }
            router.refresh();
        } catch (err: any) {
            setError(err.message || "Error al iniciar sesion");
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-[#F5F7FA] flex">
            {/* Left panel — branding */}
            <div className="hidden lg:flex lg:w-[44%] bg-primary flex-col justify-between p-12 relative overflow-hidden">
                <div className="absolute inset-0 bg-[linear-gradient(to_right,rgba(255,255,255,0.03)_1px,transparent_1px),linear-gradient(to_bottom,rgba(255,255,255,0.03)_1px,transparent_1px)] bg-[size:40px_40px]" />
                <div className="absolute bottom-0 right-0 w-80 h-80 bg-white/5 rounded-full blur-3xl" />

                <div className="relative z-10">
                    <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 flex items-center justify-center">
                            <Image src="/logo-icon.svg" alt="DomiCita" width={36} height={36} />
                        </div>
                        <span className="text-white font-bold text-lg">DomiCita</span>
                    </div>
                </div>

                <div className="relative z-10 space-y-6">
                    <blockquote className="text-white/90 text-2xl font-bold leading-snug">
                        &ldquo;Desde que uso DomiCita, mis citas se organizan solas. Yo solo llego y trabajo.&rdquo;
                    </blockquote>
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-white/20 flex items-center justify-center text-white font-bold text-sm">C</div>
                        <div>
                            <p className="text-white font-semibold text-sm">Carlos Rodriguez</p>
                            <p className="text-white/50 text-xs">Barberia Elite, Santo Domingo</p>
                        </div>
                    </div>
                </div>

                <div className="relative z-10 flex items-center gap-6">
                    <div className="text-center">
                        <p className="text-white font-black text-2xl">24/7</p>
                        <p className="text-white/50 text-xs uppercase tracking-wide">Chatbot activo</p>
                    </div>
                    <div className="w-px h-8 bg-white/20" />
                    <div className="text-center">
                        <p className="text-white font-black text-2xl">&lt;5 min</p>
                        <p className="text-white/50 text-xs uppercase tracking-wide">Configuracion</p>
                    </div>
                    <div className="w-px h-8 bg-white/20" />
                    <div className="text-center">
                        <p className="text-white font-black text-2xl">$0</p>
                        <p className="text-white/50 text-xs uppercase tracking-wide">Para empezar</p>
                    </div>
                </div>
            </div>

            {/* Right panel — form */}
            <div className="flex-1 flex flex-col items-center justify-center px-6 py-12">
                {/* Mobile logo */}
                <div className="lg:hidden flex items-center gap-2.5 mb-10">
                    <div className="w-9 h-9 flex items-center justify-center">
                        <Image src="/logo-icon.svg" alt="DomiCita" width={36} height={36} />
                    </div>
                    <span className="text-charcoal font-bold text-lg">DomiCita</span>
                </div>

                <div className="w-full max-w-sm">
                    <div className="mb-8">
                        <h1 className="text-2xl font-black text-charcoal mb-1">Inicia sesion</h1>
                        <p className="text-sm text-gray-500">Ingresa a tu cuenta de DomiCita</p>
                    </div>

                    <form onSubmit={handleLogin} className="space-y-4">
                        <div className="space-y-1.5">
                            <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
                                Email
                            </label>
                            <div className="relative">
                                <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                                <input
                                    type="email"
                                    value={email}
                                    onChange={(e) => setEmail(e.target.value)}
                                    placeholder="tu@email.com"
                                    required
                                    autoFocus
                                    className="w-full bg-white border border-gray-200 rounded-xl py-3 pl-10 pr-4 text-sm text-charcoal placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                                />
                            </div>
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
                                Contrasena
                            </label>
                            <input
                                type="password"
                                value={password}
                                onChange={(e) => setPassword(e.target.value)}
                                placeholder="Tu contrasena"
                                required
                                className="w-full bg-white border border-gray-200 rounded-xl py-3 px-4 text-sm text-charcoal placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                            />
                        </div>

                        {error && (
                            <div className="bg-red-50 border border-red-100 text-red-600 text-xs py-3 px-4 rounded-xl font-medium">
                                {error}
                            </div>
                        )}

                        <button
                            type="submit"
                            disabled={loading}
                            className="w-full btn-accent-luxury flex items-center justify-center gap-2 h-11 rounded-xl text-sm font-bold disabled:opacity-60 disabled:cursor-not-allowed mt-2"
                        >
                            {loading ? (
                                <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                                <>
                                    Iniciar sesion
                                    <ArrowRight className="h-4 w-4" />
                                </>
                            )}
                        </button>
                    </form>

                    <div className="mt-6 text-center">
                        <a href="/signup" className="text-sm text-primary font-semibold hover:underline">
                            No tienes cuenta? Registrate
                        </a>
                    </div>

                    <div className="mt-10 pt-6 border-t border-gray-200 flex items-center justify-center">
                        <span className="text-[10px] font-medium text-gray-400 uppercase tracking-widest">Conexion segura SSL</span>
                    </div>
                </div>
            </div>
        </div>
    );
}
