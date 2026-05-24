/**
 * Rate Limiting — works with Upstash Redis OR in-memory fallback
 *
 * In-memory fallback provides per-instance protection when Redis is not configured.
 * For multi-instance deployments, configure UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN.
 */

// ── In-memory sliding window (fallback when Redis is not available) ──────────

const windowMs = 60_000; // 1 minute window

interface BucketEntry {
  timestamps: number[];
}

const buckets = new Map<string, BucketEntry>();

// Cleanup stale entries every 5 minutes
setInterval(() => {
  const cutoff = Date.now() - windowMs * 2;
  for (const [key, entry] of buckets) {
    entry.timestamps = entry.timestamps.filter(t => t > cutoff);
    if (entry.timestamps.length === 0) buckets.delete(key);
  }
}, 300_000).unref?.();

function memoryRateLimit(key: string, maxRequests: number): { success: boolean; remaining: number } {
  const now = Date.now();
  const cutoff = now - windowMs;

  let entry = buckets.get(key);
  if (!entry) {
    entry = { timestamps: [] };
    buckets.set(key, entry);
  }

  // Remove expired entries
  entry.timestamps = entry.timestamps.filter(t => t > cutoff);

  if (entry.timestamps.length >= maxRequests) {
    return { success: false, remaining: 0 };
  }

  entry.timestamps.push(now);
  return { success: true, remaining: maxRequests - entry.timestamps.length };
}

// ── Upstash Redis (optional) ────────────────────────────────────────────────

let upstashLimit: ((key: string, max: number) => Promise<{ success: boolean; remaining: number }>) | null = null;

if (process.env.NODE_ENV === 'production' && !process.env.UPSTASH_REDIS_REST_URL) {
  console.warn(
    '[rate-limit] UPSTASH_REDIS_REST_URL not set — using in-memory fallback. ' +
    'Rate limits are NOT shared across serverless instances in production.'
  );
}

if (process.env.UPSTASH_REDIS_REST_URL && process.env.UPSTASH_REDIS_REST_TOKEN) {
  // Dynamic import to avoid Edge Runtime issues when not configured.
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { Ratelimit } = require("@upstash/ratelimit");
  // eslint-disable-next-line @typescript-eslint/no-require-imports
  const { Redis } = require("@upstash/redis");
  try {
    const redis = new Redis({
      url: process.env.UPSTASH_REDIS_REST_URL,
      token: process.env.UPSTASH_REDIS_REST_TOKEN,
    });

    const limiters = new Map<number, InstanceType<typeof Ratelimit>>();

    upstashLimit = async (key: string, max: number) => {
      if (!limiters.has(max)) {
        limiters.set(max, new Ratelimit({
          redis,
          limiter: Ratelimit.slidingWindow(max, "60 s"),
          prefix: `@domicita/rate-limit/${max}`,
        }));
      }
      const result = await limiters.get(max)!.limit(key);
      return { success: result.success, remaining: result.remaining || 0 };
    };
  } catch {
    // Upstash packages not available — fall through to in-memory
  }
}

// ── Public API ──────────────────────────────────────────────────────────────

/** Rate limit presets (requests per minute) */
export const RATE_LIMITS = {
  webhook: 120,    // WhatsApp/Twilio webhooks — high volume
  api: 30,         // General API routes
  auth: 10,        // Login/signup — strict
  appointment: 15, // Booking endpoints
} as const;

export type RateLimitPreset = keyof typeof RATE_LIMITS;

/**
 * Check rate limit for a given identifier
 */
export async function checkRateLimit(
  identifier: string,
  preset: RateLimitPreset = "api"
): Promise<{ success: boolean; remaining: number }> {
  const max = RATE_LIMITS[preset];
  const key = `${preset}:${identifier}`;

  if (upstashLimit) {
    try {
      return await upstashLimit(key, max);
    } catch {
      // Redis error — fall through to in-memory
    }
  }

  return memoryRateLimit(key, max);
}

/**
 * Extract client IP from request headers
 */
export function extractIP(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  if (forwarded) return forwarded.split(",")[0].trim();

  const realIP = request.headers.get("x-real-ip");
  if (realIP) return realIP;

  return "anonymous";
}

/**
 * Return 429 response
 */
export function rateLimitResponse(): Response {
  return new Response(
    JSON.stringify({ error: "Too many requests. Please try again later." }),
    {
      status: 429,
      headers: {
        "Content-Type": "application/json",
        "Retry-After": "60",
      },
    }
  );
}
