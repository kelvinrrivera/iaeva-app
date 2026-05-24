"use client";

import { useState } from "react";
import { supabase } from "@/lib/supabase";
import { useRouter } from "next/navigation";
import { ArrowRight, Loader2, Mail, User, CheckCircle } from "lucide-react";
import Image from "next/image";

export default function SignupPage() {
    const router = useRouter();
    const [name, setName] = useState("");
    const [email, setEmail] = useState("");
    const [password, setPassword] = useState("");
    const [confirmPassword, setConfirmPassword] = useState("");
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [emailSent, setEmailSent] = useState(false);

    const handleSignup = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError(null);

        if (name.trim().length < 2) {
            setError("Por favor ingresa tu nombre");
            setLoading(false);
            return;
        }

        if (password !== confirmPassword) {
            setError("Las contrasenas no coinciden");
            setLoading(false);
            return;
        }

        if (password.length < 6) {
            setError("La contrasena debe tener al menos 6 caracteres");
            setLoading(false);
            return;
        }

        try {
            const { data, error } = await supabase.auth.signUp({
                email,
                password,
                options: {
                    data: {
                        name: name.trim(),
                    },
                    emailRedirectTo: `${window.location.origin}/auth/callback/email`,
                },
            });

            if (error) {
                if (error.message.includes("already registered")) {
                    throw new Error("Este email ya esta registrado. Intenta iniciar sesion.");
                }
                throw error;
            }

            // Supabase sends confirmation email automatically
            setEmailSent(true);
        } catch (err: any) {
            setError(err.message || "Error al crear cuenta");
        } finally {
            setLoading(false);
        }
    };

    // Success state — email sent
    if (emailSent) {
        return (
            <div className="min-h-screen bg-[#F5F7FA] flex items-center justify-center px-6">
                <div className="w-full max-w-sm text-center">
                    <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                        <CheckCircle className="h-8 w-8 text-green-600" />
                    </div>
                    <h1 className="text-2xl font-black text-charcoal mb-2">Revisa tu email</h1>
                    <p className="text-sm text-gray-500 mb-2">
                        Enviamos un enlace de confirmacion a
                    </p>
                    <p className="text-sm font-semibold text-charcoal mb-6">{email}</p>
                    <p className="text-xs text-gray-400 mb-8">
                        Haz clic en el enlace del email para activar tu cuenta. Si no lo ves, revisa la carpeta de spam.
                    </p>
                    <a
                        href="/login"
                        className="inline-flex items-center gap-2 text-sm text-primary font-semibold hover:underline"
                    >
                        Ir a iniciar sesion
                        <ArrowRight className="h-4 w-4" />
                    </a>
                </div>
            </div>
        );
    }

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
                    <p className="text-white/80 text-lg font-semibold">
                        Registra tu negocio en minutos
                    </p>
                    <ul className="space-y-3 text-white/70 text-sm">
                        <li className="flex items-center gap-2">
                            <span className="w-1.5 h-1.5 bg-white rounded-full"></span>
                            Chatbot de WhatsApp 24/7
                        </li>
                        <li className="flex items-center gap-2">
                            <span className="w-1.5 h-1.5 bg-white rounded-full"></span>
                            Reservas automaticas
                        </li>
                        <li className="flex items-center gap-2">
                            <span className="w-1.5 h-1.5 bg-white rounded-full"></span>
                            Recordatorios automaticos
                        </li>
                        <li className="flex items-center gap-2">
                            <span className="w-1.5 h-1.5 bg-white rounded-full"></span>
                            Sin comisiones por cita
                        </li>
                    </ul>
                </div>

                <div className="relative z-10">
                    <p className="text-white/60 text-xs">
                        Ya tienes cuenta?{" "}
                        <a href="/login" className="text-white font-semibold hover:underline">
                            Inicia sesion
                        </a>
                    </p>
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
                        <h1 className="text-2xl font-black text-charcoal mb-1">Crea tu cuenta</h1>
                        <p className="text-sm text-gray-500">Comienza gratis, sin tarjeta de credito</p>
                    </div>

                    <form onSubmit={handleSignup} className="space-y-4">
                        <div className="space-y-1.5">
                            <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
                                Tu nombre
                            </label>
                            <div className="relative">
                                <User className="absolute left-3.5 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
                                <input
                                    type="text"
                                    value={name}
                                    onChange={(e) => setName(e.target.value)}
                                    placeholder="Juan Perez"
                                    required
                                    autoFocus
                                    className="w-full bg-white border border-gray-200 rounded-xl py-3 pl-10 pr-4 text-sm text-charcoal placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                                />
                            </div>
                        </div>

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
                                placeholder="Minimo 6 caracteres"
                                required
                                minLength={6}
                                className="w-full bg-white border border-gray-200 rounded-xl py-3 px-4 text-sm text-charcoal placeholder:text-gray-400 focus:outline-none focus:ring-2 focus:ring-primary/20 focus:border-primary transition-all"
                            />
                        </div>

                        <div className="space-y-1.5">
                            <label className="text-xs font-semibold text-gray-600 uppercase tracking-wide">
                                Confirmar contrasena
                            </label>
                            <input
                                type="password"
                                value={confirmPassword}
                                onChange={(e) => setConfirmPassword(e.target.value)}
                                placeholder="Repite tu contrasena"
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
                                    Crear cuenta
                                    <ArrowRight className="h-4 w-4" />
                                </>
                            )}
                        </button>
                    </form>

                    <div className="mt-6 text-center">
                        <a href="/login" className="text-sm text-primary font-semibold hover:underline">
                            Ya tienes cuenta? Inicia sesion
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
