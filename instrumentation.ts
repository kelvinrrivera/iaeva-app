/**
 * Next.js Instrumentation
 *
 * Runs once at server startup (Node.js runtime only).
 * Used to validate environment variables before the app accepts requests.
 *
 * Docs: https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */

export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { validateEnv } = await import('@/lib/env-validation');
    validateEnv();
  }
}
