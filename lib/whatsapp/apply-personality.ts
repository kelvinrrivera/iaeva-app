/**
 * Apply the shop's chatbot personality to a base text via LLM rewrite.
 *
 * Behavior:
 * - If shop has no `chatbotPersonality` configured → returns the base text unchanged.
 * - If we have a cached rewrite for (shopId, baseText, personalityHash) → returns the cache hit.
 * - Otherwise → calls the LLM to rewrite, persists in cache, returns the rewritten text.
 *
 * If the LLM call fails for any reason, we always fall back to the base text so
 * the customer never sees a broken or empty message.
 */

import { createHash } from 'crypto';
import { db } from '@/lib/database';
import { getGeminiResponse } from '@/lib/gemini';

interface ShopPersonality {
  personality: string;
  jerga: string;
  modelId: string | null;
}

const sha1 = (s: string) => createHash('sha1').update(s).digest('hex');

const personalityCache = new Map<string, ShopPersonality>();
const PERSONALITY_TTL_MS = 60 * 1000; // 1 minute in-memory cache for shop personality
const personalityFetchedAt = new Map<string, number>();

async function getShopPersonalityCached(shopId: string): Promise<ShopPersonality> {
  const fetchedAt = personalityFetchedAt.get(shopId) ?? 0;
  if (personalityCache.has(shopId) && Date.now() - fetchedAt < PERSONALITY_TTL_MS) {
    return personalityCache.get(shopId)!;
  }
  const shop = await db.shop.findUnique({
    where: { id: shopId },
    select: { chatbotPersonality: true, chatbotJerga: true, chatbotModelId: true },
  });
  const value: ShopPersonality = {
    personality: shop?.chatbotPersonality ?? '',
    jerga: shop?.chatbotJerga ?? '',
    modelId: shop?.chatbotModelId ?? null,
  };
  personalityCache.set(shopId, value);
  personalityFetchedAt.set(shopId, Date.now());
  return value;
}

export interface ApplyPersonalityOptions {
  /** Skip cache lookup + write (use for one-off, message-specific text). Default false. */
  skipCache?: boolean;
}

/**
 * Rewrite `baseText` in the shop's chatbot personality. Always returns SOMETHING —
 * never throws; falls back to base text on failure.
 */
export async function applyPersonality(
  baseText: string,
  shopId: string,
  options: ApplyPersonalityOptions = {},
): Promise<string> {
  const { personality, jerga, modelId } = await getShopPersonalityCached(shopId);
  if (!personality.trim()) {
    return baseText;
  }

  const personalityHash = sha1(`${personality}\n---\n${jerga}`);
  const baseTextHash = sha1(baseText);

  // 1. Try cache
  if (!options.skipCache) {
    try {
      const hit = await db.chatbotPhraseCache.findUnique({
        where: {
          shopId_baseTextHash_personalityHash: {
            shopId,
            baseTextHash,
            personalityHash,
          },
        },
        select: { rewritten: true },
      });
      if (hit?.rewritten) return hit.rewritten;
    } catch (err) {
      // Cache lookup failure is never fatal — proceed to LLM
      console.warn('[applyPersonality] Cache lookup failed:', (err as Error).message);
    }
  }

  // 2. LLM rewrite
  const systemPrompt = `Eres un asistente que reescribe mensajes manteniendo TODOS los datos (nombres, precios, horas, fechas, números de servicios) pero adaptando el tono y estilo a una personalidad específica.

PERSONALIDAD A APLICAR:
${personality}
${jerga ? `\nJERGA LOCAL QUE PUEDES USAR NATURALMENTE:\n${jerga}\n` : ''}
REGLAS:
- Mantén exactamente los mismos datos del mensaje original (números, precios, nombres, horas).
- Cambia solo el tono, las frases de apertura/cierre, las muletillas y la energía.
- No añadas información que no esté en el original.
- Máximo 2-3 oraciones, estilo WhatsApp.
- No uses emoji corporativos ni frases tipo "estimado cliente". Suena como una persona real.
- Si el mensaje original tiene una lista (servicios, horas), conserva la lista exacta — solo puedes cambiar el texto introductorio o de cierre.

Devuelve ÚNICAMENTE el mensaje reescrito, sin comillas, sin prefijos como "Aquí está:" o "Versión reescrita:".`;

  let rewritten: string;
  try {
    rewritten = await getGeminiResponse(
      `Mensaje original a reescribir:\n\n${baseText}`,
      [],
      systemPrompt,
      modelId || undefined,
    );
  } catch (err) {
    console.warn('[applyPersonality] LLM call failed, falling back to base text:', (err as Error).message);
    return baseText;
  }

  rewritten = (rewritten || '').trim();
  if (!rewritten) return baseText;

  // 3. Persist cache (best-effort)
  if (!options.skipCache) {
    try {
      await db.chatbotPhraseCache.upsert({
        where: {
          shopId_baseTextHash_personalityHash: {
            shopId,
            baseTextHash,
            personalityHash,
          },
        },
        update: { rewritten },
        create: { shopId, baseTextHash, personalityHash, rewritten },
      });
    } catch (err) {
      console.warn('[applyPersonality] Cache write failed (non-fatal):', (err as Error).message);
    }
  }

  return rewritten;
}
