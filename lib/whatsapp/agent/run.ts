/**
 * Agent orchestrator.
 *
 * Wraps the AI SDK's `generateText` with our tools + system prompt + context.
 * The SDK handles the LLM ↔ tool loop internally (stopWhen `stepCountIs`).
 *
 * Returns a `ChatbotResponse` shape compatible with the existing webhook
 * dispatcher, so the rest of the pipeline (typing indicator, interactive
 * sending) stays untouched.
 */

import { generateText, stepCountIs } from 'ai';
import { db } from '@/lib/database';
import { DEFAULT_MODEL } from '@/lib/gemini';
import { createOpenAI } from '@ai-sdk/openai';
import { buildAgentContext } from './context-builder';
import { buildSystemPrompt } from './system-prompt';
import { buildTools, type ToolContext, type ScratchState, type PendingInteractive } from './tools';
import type { ModelMessage } from 'ai';

// El agent SIEMPRE usa OpenAI. Si un shop tiene un modelId Gemini guardado
// (legado), lo ignoramos y usamos el default OpenAI.
const openai = createOpenAI({ apiKey: process.env.OPENAI_API_KEY });
const OPENAI_MODEL_IDS = new Set(['gpt-5.4-mini', 'gpt-4.1-mini', 'gpt-4.1-nano', 'gpt-4.1']);

export interface AgentInput {
  shopId: string;
  phoneNumber: string;
  clientName: string;
  message: string;
}

export interface AgentResponse {
  message: string;
  interactive?: PendingInteractive | undefined;
  appointmentCreated?: boolean;
  appointmentId?: string;
}

const MAX_STEPS = 10; // Booking flow can need: picker → slots → picker → confirmation → create

function getModelInstance(modelId: string) {
  // El agent SOLO usa OpenAI. Ids no-OpenAI caen al default.
  const safeId = OPENAI_MODEL_IDS.has(modelId) ? modelId : DEFAULT_MODEL;
  return openai(safeId);
}

export async function runAgent(input: AgentInput): Promise<AgentResponse> {
  const { shopId, phoneNumber, clientName, message } = input;

  // 1. Build everything the agent will see
  const ctx = await buildAgentContext({ shopId, phoneNumber, fallbackClientName: clientName });

  // NOTA: el filtro off-topic vive en el system prompt (regla 2b). El LLM
  // tiene mejor comprensión del español dominicano informal que cualquier
  // regex, así que delegamos el rechazo al modelo y pagamos los ~50 tokens
  // por mensaje off-topic. False positives = 0, vs los ~5-15% que tendría regex.

  // 2. Load previous scratch from conversation (so multi-turn collected fields persist)
  const conv = await db.whatsAppConversation.findUnique({
    where: { phoneNumber_shopId: { phoneNumber, shopId } },
    select: { stateJson: true },
  });
  let scratch: ScratchState = {};
  try {
    const parsed = conv?.stateJson ? JSON.parse(conv.stateJson) : null;
    if (parsed && typeof parsed === 'object' && parsed.collected) {
      scratch = parsed.collected as ScratchState;
    }
  } catch {
    /* keep empty scratch on parse failure */
  }

  // Pre-parse the incoming message for structured client actions. If the
  // user tapped a service in present_service_picker, the webhook translated
  // it into "[ACCIÓN DEL CLIENTE] Eligió el servicio "X" (serviceId=Y)". Mark
  // serviceConfirmedByClient = true here so the agent tools accept downstream
  // calls. The LLM cannot set this flag — that's the whole point.
  const serviceTapMatch = message.match(/\[ACCIÓN DEL CLIENTE\][^]*serviceId=([\w-]+)/);
  if (serviceTapMatch) {
    scratch.serviceId = serviceTapMatch[1];
    scratch.serviceConfirmedByClient = true;
  }
  const stylistTapMatch = message.match(/\[ACCIÓN DEL CLIENTE\][^]*stylistId=([\w-]+)/);
  if (stylistTapMatch) {
    scratch.stylistId = stylistTapMatch[1];
  }

  // If the client tapped ❌ Cancelar (the cancel-this-booking button), reset
  // the service confirmation so they can start a fresh flow.
  if (message.includes('[ACCIÓN DEL CLIENTE] Tocó ❌ Cancelar')) {
    scratch.serviceConfirmedByClient = false;
    scratch.serviceId = undefined;
    scratch.serviceName = undefined;
    scratch.lastSlotsOffered = undefined;
    scratch.lastSlotsDate = undefined;
  }

  // 3. Build tool context — tools mutate `scratch` and `pendingInteractive` as side effects
  const toolCtx: ToolContext = {
    shopId,
    phoneNumber,
    clientId: ctx.clientId,
    shopTimezone: ctx.shopTimezone,
    scratch,
    pendingInteractive: null,
  };
  const tools = buildTools(toolCtx);

  // 4. Resolve which model to use
  const modelId = ctx.modelId || DEFAULT_MODEL;
  const model = getModelInstance(modelId);

  // 5. Build the messages array: history + current user message
  const systemPrompt = buildSystemPrompt(ctx, scratch);
  const messages: ModelMessage[] = [
    ...ctx.history.map<ModelMessage>(h => ({ role: h.role, content: h.content })),
    { role: 'user', content: message },
  ];

  // 6. Persist the inbound user message in chat history (fire-and-forget)
  db.chatHistory
    .create({
      data: {
        shopId,
        phoneNumber,
        role: 'user',
        content: message,
        source: 'whatsapp',
        clientId: ctx.clientId ?? null,
      },
    })
    .catch(err => console.error('[agent] Failed to persist user message:', err));

  // 7. Run the LLM with tools
  let finalText = '';
  let createdApptId: string | undefined;
  console.log('[agent] Starting LLM call', { shopId, phoneNumber, modelId, msgs: messages.length });
  try {
    const result = await generateText({
      model,
      system: systemPrompt,
      messages,
      tools,
      stopWhen: stepCountIs(MAX_STEPS),
      // Nota: gpt-5.4-mini es un reasoning model; no acepta `temperature`.
    });

    console.log('[agent] LLM done', {
      steps: result.steps?.length ?? 0,
      textLength: result.text?.length ?? 0,
      hasInteractive: !!toolCtx.pendingInteractive,
    });
    finalText = (result.text || '').trim();
    // AI SDK concatena el texto de cada step. Si el LLM emite el mismo texto
    // dos veces (saludo en step 1 + repetición en step 2), aparece duplicado.
    // Detectar y deduplicar mitades idénticas.
    const half = finalText.length / 2;
    if (
      finalText.length > 30 &&
      finalText.length % 2 === 0 &&
      finalText.slice(0, half) === finalText.slice(half)
    ) {
      finalText = finalText.slice(0, half).trim();
    }

    // If a create_appointment tool ran successfully, surface its id for the webhook.
    // Also log any tool that returned ok:false so we can diagnose silent failures.
    for (const step of result.steps ?? []) {
      for (const tc of step.toolResults ?? []) {
        const r = tc.output as any;
        if (tc.toolName === 'create_appointment' && r?.ok && r?.appointmentId) {
          createdApptId = r.appointmentId;
        }
        if (r && r.ok === false) {
          console.warn('[agent] Tool rejected', {
            tool: tc.toolName,
            error: r.error,
            message: r.message,
          });
        }
      }
    }
  } catch (err: any) {
    console.error('[agent] generateText failed:', err?.message);
    return {
      message:
        'Disculpa, tuve un problema técnico al procesar tu mensaje. ¿Me lo puedes repetir en un momento?',
    };
  }

  // 8. If a UI tool fired, the orchestrator returns it instead of the text.
  // The `bodyText` inside the interactive IS the message; we don't send
  // additional text in the same turn.
  const interactive = toolCtx.pendingInteractive;
  // If the model finished without writing any text and without firing a UI
  // tool, but DID make data tool calls (e.g. find_available_slots), surface
  // the most useful piece we can from the scratch state so the client gets
  // something coherent — NEVER fall back to a generic "no supe responder".
  let responseText: string;
  if (interactive && (interactive.kind === 'list' || interactive.kind === 'buttons')) {
    responseText = interactive.bodyText;
  } else if (interactive && interactive.kind === 'location') {
    // Location messages render as a native map pin — no text needed alongside.
    responseText = finalText || `${interactive.name ?? ''}${interactive.address ? '\n' + interactive.address : ''}`.trim() || 'Aquí tienes la ubicación.';
  } else if (finalText) {
    responseText = finalText;
  } else if (toolCtx.scratch.lastSlotsOffered && toolCtx.scratch.lastSlotsOffered.length > 0) {
    const sample = toolCtx.scratch.lastSlotsOffered.slice(0, 5).join(', ');
    responseText = `Tengo estos horarios disponibles${ctx.todayDate ? '' : ''}: ${sample}. ¿Cuál te queda mejor?`;
  } else {
    responseText = '¿En qué te puedo ayudar? Puedo agendarte una cita, decirte servicios y precios, o consultar tu próxima cita.';
  }

  // 9. Persist scratch back to conversation so the next turn inherits collected fields
  const stateToSave = {
    phase: 'agent', // marker so old phase-machine code (if still around) doesn't interfere
    collected: toolCtx.scratch,
    updatedAt: new Date().toISOString(),
  };

  await db.whatsAppConversation
    .upsert({
      where: { phoneNumber_shopId: { phoneNumber, shopId } },
      update: {
        phase: 'agent',
        stateJson: JSON.stringify(stateToSave),
        lastActivityAt: new Date(),
      },
      create: {
        shopId,
        phoneNumber,
        phase: 'agent',
        stateJson: JSON.stringify(stateToSave),
        controlMode: 'BOT',
      },
    })
    .catch(err => console.error('[agent] Failed to persist conversation state:', err));

  // 10. Persist assistant turn in chat history (fire-and-forget)
  db.chatHistory
    .create({
      data: {
        shopId,
        phoneNumber,
        role: 'assistant',
        content: responseText,
        source: 'agent',
        clientId: ctx.clientId ?? null,
      },
    })
    .catch(err => console.error('[agent] Failed to persist assistant message:', err));

  return {
    message: responseText,
    interactive: interactive ?? undefined,
    appointmentCreated: !!createdApptId,
    appointmentId: createdApptId,
  };
}
