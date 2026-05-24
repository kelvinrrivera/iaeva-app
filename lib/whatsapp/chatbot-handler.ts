/**
 * WhatsApp Chatbot Handler — thin wrapper over the LLM agent.
 *
 * Single dispatch path: webhook → handleMessage → runAgent. No regex-based
 * intent detection, no rule-based fallbacks. If the agent fails it returns
 * a generic error and the operator sees the failure in /admin/logs.
 *
 * Why we removed the legacy state-machine handler:
 *   - It used brittle regex/keyword classification (detectIntent,
 *     isBusinessRelevant, detectsFrustration, detectsProfessionalRequest)
 *     that produced false positives for Dominican Spanish informal speech.
 *   - It was the silent "fallback" for the agent path, which was worse than
 *     no fallback — flipping a flag could restore broken behavior.
 *   - 1500+ lines of unmaintained code accumulating debt.
 *
 * The agent has its own retry logic, error handling and structured fallbacks
 * inside lib/whatsapp/agent/run.ts.
 */

import { runAgent, type AgentResponse } from './agent/run';

export interface MessageContext {
  message: string;
  shopId: string;
  phoneNumber: string;
  clientName: string;
  shop: { name?: string | null };
}

export type ChatbotResponse = AgentResponse;

export async function handleMessage(context: MessageContext): Promise<ChatbotResponse | null> {
  const { message, shopId, phoneNumber, clientName } = context;

  if (!message?.trim()) return null;

  try {
    return await runAgent({ shopId, phoneNumber, clientName, message });
  } catch (err: any) {
    console.error('[chatbot-handler] runAgent threw:', err?.message);
    return {
      message:
        'Disculpa, tuvimos un problema técnico procesando tu mensaje. Por favor, escríbenos de nuevo en unos minutos.',
    };
  }
}
