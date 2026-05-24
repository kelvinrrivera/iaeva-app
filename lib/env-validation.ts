/**
 * Environment Variable Validation
 *
 * Call validateEnv() at application startup to ensure all critical
 * environment variables are set before accepting requests.
 *
 * In production, missing variables will throw to prevent silent failures.
 */

interface EnvVar {
  name: string;
  description: string;
  required: boolean;
}

const REQUIRED_ENV_VARS: EnvVar[] = [
  { name: 'DATABASE_URL',                  description: 'PostgreSQL connection string',       required: true },
  { name: 'NEXT_PUBLIC_SUPABASE_URL',      description: 'Supabase project URL',               required: true },
  { name: 'NEXT_PUBLIC_SUPABASE_ANON_KEY', description: 'Supabase anon key',                  required: true },
  { name: 'SUPABASE_SERVICE_ROLE_KEY',     description: 'Supabase service role key',           required: true },
  { name: 'STRIPE_SECRET_KEY',             description: 'Stripe secret key',                   required: true },
  { name: 'STRIPE_WEBHOOK_SECRET',         description: 'Stripe webhook signing secret',        required: true },
  { name: 'STRIPE_PRICE_SOLO',             description: 'Stripe Price ID for SOLO plan ($19)',   required: true },
  { name: 'STRIPE_PRICE_TEAM',             description: 'Stripe Price ID for TEAM plan ($39)',  required: true },
  { name: 'STRIPE_PRICE_BUSINESS',         description: 'Stripe Price ID for BUSINESS plan ($79)', required: true },
  { name: 'WHATSAPP_ACCESS_TOKEN',          description: 'Meta WhatsApp Cloud API access token',  required: false },
  { name: 'WHATSAPP_PHONE_NUMBER_ID',      description: 'Meta WhatsApp phone number ID',         required: false },
  { name: 'OPENAI_API_KEY',                description: 'OpenAI API key (default LLM provider)', required: true },
  { name: 'GOOGLE_AI_API_KEY',             description: 'Google AI key (opcional, legacy shops)', required: false },
  { name: 'CRON_SECRET',                   description: 'Secret token for cron job endpoints',  required: true },
  { name: 'NEXT_PUBLIC_APP_URL',           description: 'Public app URL (e.g. https://domicita.com)', required: false },
];

/**
 * Validate all required environment variables.
 * Throws in production; logs warnings in development.
 */
export function validateEnv(): void {
  const isProduction = process.env.NODE_ENV === 'production';
  const missing: string[] = [];

  for (const envVar of REQUIRED_ENV_VARS) {
    if (!envVar.required) continue;
    const value = process.env[envVar.name];
    if (!value || value.trim() === '') {
      missing.push(`  - ${envVar.name}: ${envVar.description}`);
    }
  }

  if (missing.length > 0) {
    const message = `Missing required environment variables:\n${missing.join('\n')}`;
    if (isProduction) {
      throw new Error(`[DomiCita] FATAL: ${message}`);
    } else {
      console.warn(`[DomiCita] WARNING: ${message}\nSome features will not work correctly.`);
    }
  }
}
