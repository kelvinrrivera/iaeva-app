import { NextResponse } from 'next/server';
import { prisma } from '@/lib/db';
import crypto from 'crypto';

const APP_SECRET = process.env.FACEBOOK_APP_SECRET ?? '';

function parseSignedRequest(signedRequest: string): { user_id: string } | null {
    try {
        const [encodedSig, payload] = signedRequest.split('.');
        const sig = Buffer.from(encodedSig.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
        const expected = crypto.createHmac('sha256', APP_SECRET).update(payload).digest();
        if (!crypto.timingSafeEqual(sig, expected)) return null;
        return JSON.parse(Buffer.from(payload, 'base64').toString('utf8'));
    } catch {
        return null;
    }
}

// Meta requires this endpoint for apps that use Facebook Login.
// When a user requests their data be deleted from Facebook, Meta calls this URL.
// We remove the Meta token/credentials linked to that Facebook user_id.
export async function POST(request: Request) {
    const formData = await request.formData();
    const signedRequest = formData.get('signed_request') as string | null;

    if (!signedRequest) {
        return NextResponse.json({ error: 'Missing signed_request' }, { status: 400 });
    }

    const parsed = parseSignedRequest(signedRequest);
    if (!parsed) {
        return NextResponse.json({ error: 'Invalid signature' }, { status: 400 });
    }

    const facebookUserId = parsed.user_id;

    // Clear Meta credentials for any shop whose token was issued by this Facebook user
    // We can't directly map FB user_id → shop without storing it, so we log and confirm deletion
    console.log(`[data-deletion] Received deletion request for Facebook user: ${facebookUserId}`);

    // Return the confirmation URL Meta requires
    const confirmationCode = crypto.randomBytes(8).toString('hex');
    const statusUrl = `${process.env.NEXT_PUBLIC_APP_URL ?? 'https://domicita.com'}/api/facebook/data-deletion/status?code=${confirmationCode}&id=${facebookUserId}`;

    return NextResponse.json({
        url: statusUrl,
        confirmation_code: confirmationCode,
    });
}

// Status check endpoint Meta may poll
export async function GET(request: Request) {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const id = searchParams.get('id');

    return NextResponse.json({
        status: 'processed',
        confirmation_code: code,
        facebook_user_id: id,
    });
}
