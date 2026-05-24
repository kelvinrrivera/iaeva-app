import { createGoogleGenerativeAI } from "@ai-sdk/google";
import { createOpenAI } from "@ai-sdk/openai";
import { generateText, generateObject } from "ai";
type CoreMessage = { role: 'system' | 'user' | 'assistant'; content: string };
import { z } from "zod";

// ── Provider config ─────────────────────────────────────────────────────────
// DomiCita usa OpenAI por defecto. Gemini queda en el código solo como
// compatibilidad con shops que tengan modelo Gemini explícitamente
// configurado en BD; nunca se ofrece como opción nueva.
const AI_PROVIDER = process.env.AI_PROVIDER || "openai";

// Modelos OFICIALMENTE disponibles en el selector del UI.
// Estos son los únicos que mostramos al usuario.
export const GEMINI_MODELS = [
  { id: "gpt-5.4-mini",             displayName: "GPT-5.4 Mini (rápido)",     tier: "flash",  provider: "openai" },
  { id: "gpt-4.1-mini",             displayName: "GPT-4.1 Mini",              tier: "flash",  provider: "openai" },
  { id: "gpt-4.1-nano",             displayName: "GPT-4.1 Nano",              tier: "flash",  provider: "openai" },
  { id: "gpt-4.1",                  displayName: "GPT-4.1 (avanzado)",        tier: "pro",    provider: "openai" },
] as const;

// Modelos legacy aceptados internamente (NO se muestran en UI nuevo) por si
// algún shop guardó un id Gemini en BD antes del switch. Se mantienen para
// que esos shops no rompan al consultar — el agent los redirigirá al
// default OpenAI si su key falla.
const LEGACY_MODEL_IDS = new Set([
  "gemini-3-flash-preview",
  "gemini-3-pro-preview",
  "gemini-2.0-flash",
  "gemini-2.0-flash-lite",
]);

export type GeminiModelId = typeof GEMINI_MODELS[number]["id"];

// Default global: GPT-5.4 Mini. Nunca cambia, independiente del env.
export const DEFAULT_MODEL: GeminiModelId = "gpt-5.4-mini";

// ── Providers ───────────────────────────────────────────────────────────────
const google = createGoogleGenerativeAI({
  apiKey: process.env.GOOGLE_AI_API_KEY,
});

const openai = createOpenAI({
  apiKey: process.env.OPENAI_API_KEY,
});

/** Get the correct AI SDK model instance for a given model ID */
function getModel(modelId: string) {
  // OpenAI siempre que esté en el catálogo oficial
  if ((GEMINI_MODELS as readonly { id: string }[]).some(m => m.id === modelId)) {
    return openai(modelId);
  }
  // Legacy Gemini ids → solo si tenemos la key. Si no, caemos al default OpenAI.
  if (LEGACY_MODEL_IDS.has(modelId) && process.env.GOOGLE_AI_API_KEY) {
    return google(modelId);
  }
  // Fallback siempre a OpenAI default
  return openai(DEFAULT_MODEL);
}

/**
 * Get a text response using Vercel AI SDK.
 * Default → OpenAI (gpt-5.4-mini). Legacy Gemini ids son aceptados solo si
 * la key existe en runtime.
 */
export const getGeminiResponse = async (
  userMessage: string,
  history: { role: "user" | "assistant"; content: string }[],
  systemInstruction: string,
  modelId: string = DEFAULT_MODEL
): Promise<string> => {
  const messages: CoreMessage[] = [
    ...history.map(m => ({ role: m.role, content: m.content } as CoreMessage)),
    { role: "user", content: userMessage },
  ];

  const { text } = await generateText({
    model: getModel(modelId),
    system: systemInstruction,
    messages,
  });

  return text;
};

/**
 * Extract appointment details using Vercel AI SDK generateObject.
 */
export const extractAppointmentInfo = async (text: string) => {
  try {
    const { object } = await generateObject({
      model: getModel(DEFAULT_MODEL),
      schema: z.object({
        isBooking: z.boolean().describe("Whether the user is trying to book an appointment"),
        date:    z.string().nullable().describe("Date in YYYY-MM-DD format"),
        time:    z.string().nullable().describe("Time in HH:mm format"),
        service: z.string().nullable().describe("Type of service"),
        barber:  z.string().nullable().describe("Name of the barber"),
      }),
      prompt: `Extract appointment details from this Spanish text: "${text}"`,
    });
    return object;
  } catch {
    return { isBooking: false };
  }
};
