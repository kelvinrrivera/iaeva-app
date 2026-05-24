/**
 * GET /auth/callback
 *
 * Handles Supabase email confirmation redirect.
 * Supabase sends users here after they click the confirmation link in their email.
 * We exchange the token for a session and redirect to onboarding or dashboard.
 */

import { NextRequest, NextResponse } from 'next/server';
import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const token_hash = searchParams.get('token_hash');
  const type = searchParams.get('type') as 'signup' | 'recovery' | 'email' | null;
  const next = searchParams.get('next') || '/onboarding';

  if (token_hash && type) {
    const cookieStore = await cookies();

    const supabase = createServerClient(
      process.env.NEXT_PUBLIC_SUPABASE_URL!,
      process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
      {
        cookies: {
          getAll() {
            return cookieStore.getAll().map(({ name, value }) => ({ name, value }));
          },
          setAll(cookiesToSet) {
            cookiesToSet.forEach(({ name, value, options }: any) =>
              cookieStore.set(name, value, options)
            );
          },
        },
      }
    );

    const { error } = await supabase.auth.verifyOtp({
      type,
      token_hash,
    });

    if (!error) {
      // Email confirmed — redirect to onboarding (new signup) or dashboard (recovery)
      const redirectTo = type === 'signup' ? '/onboarding' : '/dashboard';
      return NextResponse.redirect(new URL(redirectTo, request.url));
    }

    console.error('[Auth Callback] OTP verification failed:', error.message);
  }

  // Fallback: redirect to login with error
  return NextResponse.redirect(new URL('/login?error=verification_failed', request.url));
}
