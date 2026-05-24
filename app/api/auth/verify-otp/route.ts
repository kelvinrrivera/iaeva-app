import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { verifyWhatsAppOtp } from '@/lib/auth/whatsapp-otp';

/**
 * POST /api/auth/verify-otp
 *
 * 1. Verifies the WhatsApp OTP code
 * 2. Creates or finds the Supabase Auth user (phone confirmed)
 * 3. Generates a magic link token so the client can establish a session
 */
export async function POST(request: Request) {
    try {
        const { phone, code } = await request.json();

        if (!phone || !code) {
            return NextResponse.json(
                { error: 'Número y código son requeridos' },
                { status: 400 }
            );
        }

        const normalized = phone.startsWith('+') ? phone : `+${phone}`;

        // --- Step 1: Verify code ---
        const otpResult = await verifyWhatsAppOtp(normalized, code);
        if (!otpResult.success) {
            return NextResponse.json({ error: otpResult.error }, { status: 400 });
        }

        const maskedPhone = normalized.slice(0, 4) + '****' + normalized.slice(-3);
        console.log('[Auth VerifyOTP] WhatsApp OTP approved for:', maskedPhone);

        // --- Step 2: Ensure Supabase Auth user exists ---
        const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL!;
        const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY!;

        if (!supabaseServiceKey) {
            console.error('[Auth VerifyOTP] Missing SUPABASE_SERVICE_ROLE_KEY');
            return NextResponse.json(
                { error: 'Error de configuración del servidor' },
                { status: 500 }
            );
        }

        const supabaseAdmin = createClient(supabaseUrl, supabaseServiceKey, {
            auth: { autoRefreshToken: false, persistSession: false },
        });

        // Phone digits without + (Supabase stores them this way)
        const phoneDigits = normalized.replace('+', '');

        // Direct lookup by phone via Supabase Admin REST — avoids fetching all users
        const lookupRes = await fetch(
            `${supabaseUrl}/auth/v1/admin/users?phone=${encodeURIComponent(normalized)}`,
            {
                headers: {
                    'apikey': supabaseServiceKey,
                    'Authorization': `Bearer ${supabaseServiceKey}`,
                },
            }
        );

        let user: any = null;

        if (lookupRes.ok) {
            const lookupData = await lookupRes.json();
            // Response is { users: [...] } or a single user depending on Supabase version
            const candidates: any[] = lookupData.users ?? (Array.isArray(lookupData) ? lookupData : []);
            user = candidates.find(
                (u: any) => u.phone === phoneDigits || u.phone === normalized
            ) ?? null;
        }

        if (!user) {
            // Create new user with confirmed phone
            const { data: created, error: createErr } = await supabaseAdmin.auth.admin.createUser({
                phone: normalized,
                phone_confirm: true,
            });

            if (createErr || !created.user) {
                console.error('[Auth VerifyOTP] Create user error:', createErr);
                return NextResponse.json({ error: 'Error al crear usuario' }, { status: 500 });
            }

            user = created.user;
            console.log('[Auth VerifyOTP] Created Supabase user');
        } else {
            await supabaseAdmin.auth.admin.updateUserById(user.id, {
                phone_confirm: true,
            });
            console.log('[Auth VerifyOTP] Existing Supabase user found');
        }

        // --- Step 3: Generate a session for the client ---
        // Fake email for magic link — only set if the user doesn't already have a real email
        const existingEmail = user.email;
        const fakeEmail = `${phoneDigits}@phone.domicita.app`;
        const isFakeEmail = !existingEmail || existingEmail.endsWith('@phone.domicita.app');

        if (isFakeEmail) {
            await supabaseAdmin.auth.admin.updateUserById(user.id, {
                email: fakeEmail,
                email_confirm: true,
            });
        }

        const emailForLink = isFakeEmail ? fakeEmail : existingEmail;

        const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
            type: 'magiclink',
            email: emailForLink,
        });

        if (linkError || !linkData) {
            console.error('[Auth VerifyOTP] Generate link error:', linkError);
            return NextResponse.json({ error: 'Error al generar sesión' }, { status: 500 });
        }

        const tokenHash = linkData.properties?.hashed_token;
        if (!tokenHash) {
            console.error('[Auth VerifyOTP] No token_hash in link data');
            return NextResponse.json({ error: 'Error al generar sesión' }, { status: 500 });
        }

        return NextResponse.json({
            success: true,
            tokenHash,
            userId: user.id,
        });
    } catch (error: any) {
        console.error('[Auth VerifyOTP] Error:', error);
        return NextResponse.json({ error: 'Error al verificar código' }, { status: 500 });
    }
}
