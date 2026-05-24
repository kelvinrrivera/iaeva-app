import { createServerClient } from '@supabase/ssr';
import { NextResponse } from 'next/server';
import type { NextRequest } from 'next/server';

export async function middleware(req: NextRequest) {
    const { pathname } = req.nextUrl;

    // Skip middleware entirely for webhooks, cron, and stripe webhook
    if (
        pathname.startsWith('/api/whatsapp/webhook') ||
        pathname.startsWith('/api/twilio/webhook') ||
        pathname.startsWith('/api/stripe/webhook') ||
        pathname.startsWith('/api/cron/')
    ) {
        return NextResponse.next();
    }

    let res = NextResponse.next({
        request: {
            headers: req.headers,
        },
    });

    // 🔒 SECURITY HEADERS
    res.headers.set('X-DNS-Prefetch-Control', 'on');
    res.headers.set('Strict-Transport-Security', 'max-age=63072000; includeSubDomains; preload');
    res.headers.set('X-Frame-Options', 'SAMEORIGIN');
    res.headers.set('X-Content-Type-Options', 'nosniff');
    res.headers.set('X-XSS-Protection', '1; mode=block');
    res.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.headers.set('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=(self)');
    res.headers.set('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');
    res.headers.set('X-Permitted-Cross-Domain-Policies', 'none');

    const csp = [
        "default-src 'self'",
        "script-src 'self' 'unsafe-inline' https://js.stripe.com https://connect.facebook.net",
        "style-src 'self' 'unsafe-inline'",
        "img-src 'self' data: blob: https://*.supabase.co https://*.facebook.com https://*.fbcdn.net",
        "font-src 'self' data:",
        "connect-src 'self' https://*.supabase.co https://api.stripe.com https://*.googleapis.com https://graph.facebook.com https://*.facebook.com https://*.facebook.net",
        "frame-src 'self' https://js.stripe.com https://www.facebook.com https://web.facebook.com",
    ].join('; ');

    res.headers.set('Content-Security-Policy', csp);

    // 🔐 SUPABASE AUTH — refresh session for dashboard, API, and onboarding
    if (pathname.startsWith('/dashboard') || pathname.startsWith('/api/') || pathname.startsWith('/onboarding')) {
        const supabase = createServerClient(
            process.env.NEXT_PUBLIC_SUPABASE_URL!,
            process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
            {
                cookies: {
                    getAll() {
                        return req.cookies.getAll().map(({ name, value }) => ({ name, value }));
                    },
                    setAll(cookiesToSet) {
                        cookiesToSet.forEach(({ name, value }) => req.cookies.set(name, value));
                        res = NextResponse.next({
                            request: {
                                headers: req.headers,
                            },
                        });
                        cookiesToSet.forEach(({ name, value, options }) =>
                            res.cookies.set(name, value, options)
                        );
                    },
                },
            }
        );

        const {
            data: { user },
        } = await supabase.auth.getUser();

        // Redirect to login if no session for protected pages
        if (!user && (pathname.startsWith('/dashboard') || pathname.startsWith('/onboarding'))) {
            return NextResponse.redirect(new URL('/login', req.url));
        }
    }

    return res;
}

export const config = {
    matcher: [
        '/dashboard/:path*',
        '/api/:path*',
        '/((?!_next/static|_next/image|favicon.ico).*)',
    ],
};
