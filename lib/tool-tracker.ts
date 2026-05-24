/**
 * Tool-call observability — wraps every agent tool's `execute()` and persists
 * a row in ToolCall with timing, status and truncated input/output payloads.
 *
 * Fire-and-forget on persistence: tracking must NEVER break the conversation,
 * so DB failures are logged but swallowed.
 *
 * Privacy: phone numbers are masked (last 4 digits visible) before storage.
 * Payloads are truncated to 500 chars.
 */

import { db } from '@/lib/database';

const PAYLOAD_LIMIT = 500;

/**
 * Fields that may contain personally identifiable info (PII). Redact before
 * persisting payloads to ToolCall, so the observability table never stores
 * end-client names or free-text inputs. Phone numbers are masked separately.
 *
 * If a field name matches (case-insensitive), the value is replaced with
 * "[redacted]". Keys are matched both at root level and inside nested objects.
 */
const REDACT_KEYS = new Set([
  'clientname',
  'clienttext',
  'name',
  'bodytext',
  'message',
  'email',
  'phonenumber',
  'phone',
  'notes',
  'preferences',
]);

function redactPII(value: unknown): unknown {
  if (value === null || value === undefined) return value;
  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') return value;
  if (Array.isArray(value)) return value.map(redactPII);
  if (typeof value === 'object') {
    const out: Record<string, unknown> = {};
    for (const [k, v] of Object.entries(value as Record<string, unknown>)) {
      if (REDACT_KEYS.has(k.toLowerCase())) {
        out[k] = typeof v === 'string' && v.length > 0 ? '[redacted]' : v;
      } else {
        out[k] = redactPII(v);
      }
    }
    return out;
  }
  return value;
}

function truncate(value: unknown): string | null {
  if (value == null) return null;
  try {
    const sanitized = redactPII(value);
    const s = typeof sanitized === 'string' ? sanitized : JSON.stringify(sanitized);
    return s.length > PAYLOAD_LIMIT ? s.slice(0, PAYLOAD_LIMIT) + '…' : s;
  } catch {
    return null;
  }
}

function maskPhone(phone?: string | null): string | null {
  if (!phone) return null;
  const digits = phone.replace(/\D/g, '');
  if (digits.length < 6) return '***';
  return digits.slice(0, 3) + '***' + digits.slice(-4);
}

/**
 * Persist a single tool call. Never throws.
 */
export async function logToolCall(opts: {
  toolName: string;
  shopId?: string | null;
  phoneNumber?: string | null;
  durationMs: number;
  output: unknown; // The object returned by the tool — { ok, ... }
  input?: unknown;
}): Promise<void> {
  try {
    const out = opts.output as any;
    const ok = out && typeof out === 'object' && out.ok !== false;
    await db.toolCall.create({
      data: {
        toolName: opts.toolName,
        shopId: opts.shopId ?? null,
        phoneNumber: maskPhone(opts.phoneNumber),
        status: ok ? 'success' : 'error',
        errorCode: ok ? null : (out?.error ?? 'unknown'),
        durationMs: Math.max(0, Math.round(opts.durationMs)),
        inputPreview: truncate(opts.input),
        outputPreview: truncate(opts.output),
      },
    });
  } catch (err) {
    console.error('[tool-tracker] persist failed (non-fatal):', err);
  }
}

/**
 * Wrap a tool's `execute()` function so each call is timed and persisted.
 * Returns a function with the same shape as the original — drop-in.
 */
export function trackTool<TInput, TOutput>(
  toolName: string,
  ctx: { shopId?: string | null; phoneNumber?: string | null },
  execute: (input: TInput) => Promise<TOutput>,
): (input: TInput) => Promise<TOutput> {
  return async (input: TInput): Promise<TOutput> => {
    const started = Date.now();
    let output: TOutput;
    try {
      output = await execute(input);
    } catch (err: any) {
      const durationMs = Date.now() - started;
      // Fire-and-forget log of the thrown error as a tool failure
      logToolCall({
        toolName,
        shopId: ctx.shopId,
        phoneNumber: ctx.phoneNumber,
        durationMs,
        input,
        output: { ok: false, error: 'thrown_exception', message: err?.message },
      });
      throw err;
    }
    const durationMs = Date.now() - started;
    logToolCall({
      toolName,
      shopId: ctx.shopId,
      phoneNumber: ctx.phoneNumber,
      durationMs,
      input,
      output,
    });
    return output;
  };
}
