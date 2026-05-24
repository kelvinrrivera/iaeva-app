/**
 * GET /api/models
 *
 * Devuelve la lista curada de modelos LLM disponibles.
 * SOLO accesible por SUPER_ADMIN — es un parámetro interno.
 * Filtra modelos según las API keys configuradas.
 */

import { NextResponse } from "next/server";
import { withAuth, type AuthenticatedUser } from "@/lib/auth-middleware";
import { GEMINI_MODELS } from "@/lib/gemini";

export async function GET(request: Request) {
  return withAuth(async (authUser: AuthenticatedUser) => {
    if (authUser.role !== "SUPER_ADMIN") {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    const hasOpenAI = !!process.env.OPENAI_API_KEY;

    if (!hasOpenAI) {
      return NextResponse.json(
        { error: "No hay API key de OpenAI configurada" },
        { status: 500 }
      );
    }

    // El catálogo ya está restringido a OpenAI — devolvemos todo lo registrado.
    const models = GEMINI_MODELS.map(m => ({
      id:          m.id,
      displayName: m.displayName,
      provider:    m.provider,
      tier:        m.tier,
    }));

    return NextResponse.json({ models });
  }, request as any);
}
