import { NextResponse } from 'next/server';

// Called by Meta when a user cancels the Facebook Login / Embedded Signup flow
export async function GET() {
    return NextResponse.redirect(
        new URL('/dashboard/settings?tab=whatsapp&canceled=1', process.env.NEXT_PUBLIC_APP_URL ?? 'https://domicita.com')
    );
}
