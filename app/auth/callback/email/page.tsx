"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { Loader2, CheckCircle, XCircle } from "lucide-react";

export default function EmailCallbackPage() {
    const router = useRouter();
    const [status, setStatus] = useState<"loading" | "success" | "error">("loading");
    const [error, setError] = useState<string | null>(null);

    useEffect(() => {
        const handleConfirmation = async () => {
            try {
                // Supabase handles the token exchange automatically via the URL hash
                const { data, error } = await supabase.auth.getSession();

                if (error) throw error;

                if (data.session) {
                    setStatus("success");

                    // Sync profile
                    await fetch("/api/auth/profile", {
                        method: "POST",
                        credentials: "include",
                    });

                    setTimeout(() => {
                        router.push("/onboarding");
                        router.refresh();
                    }, 2000);
                } else {
                    // Try to exchange the token from URL
                    const hashParams = new URLSearchParams(window.location.hash.substring(1));
                    const accessToken = hashParams.get("access_token");
                    const refreshToken = hashParams.get("refresh_token");

                    if (accessToken && refreshToken) {
                        const { error: sessionError } = await supabase.auth.setSession({
                            access_token: accessToken,
                            refresh_token: refreshToken,
                        });

                        if (sessionError) throw sessionError;

                        setStatus("success");

                        // Sync profile
                        await fetch("/api/auth/profile", {
                            method: "POST",
                            credentials: "include",
                        });

                        setTimeout(() => {
                            router.push("/onboarding");
                            router.refresh();
                        }, 2000);
                    } else {
                        throw new Error("No se encontro sesion activa");
                    }
                }
            } catch (err: any) {
                console.error("[Email Callback] Error:", err);
                setStatus("error");
                setError(err.message || "Error al confirmar email");
            }
        };

        handleConfirmation();
    }, [router]);

    return (
        <div className="min-h-screen bg-[#F5F7FA] flex items-center justify-center px-6">
            <div className="w-full max-w-sm text-center">
                {status === "loading" && (
                    <>
                        <Loader2 className="h-8 w-8 animate-spin text-primary mx-auto mb-4" />
                        <p className="text-gray-600 font-semibold">Confirmando tu email...</p>
                    </>
                )}

                {status === "success" && (
                    <>
                        <div className="w-16 h-16 bg-green-100 rounded-full flex items-center justify-center mx-auto mb-6">
                            <CheckCircle className="h-8 w-8 text-green-600" />
                        </div>
                        <h1 className="text-2xl font-black text-charcoal mb-2">Email confirmado</h1>
                        <p className="text-sm text-gray-500">Redirigiendo a tu cuenta...</p>
                    </>
                )}

                {status === "error" && (
                    <>
                        <div className="w-16 h-16 bg-red-100 rounded-full flex items-center justify-center mx-auto mb-6">
                            <XCircle className="h-8 w-8 text-red-600" />
                        </div>
                        <h1 className="text-2xl font-black text-charcoal mb-2">Error</h1>
                        <p className="text-sm text-gray-500 mb-6">{error}</p>
                        <a
                            href="/login"
                            className="text-sm text-primary font-semibold hover:underline"
                        >
                            Ir a iniciar sesion
                        </a>
                    </>
                )}
            </div>
        </div>
    );
}
