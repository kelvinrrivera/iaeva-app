/**
 * WhatsApp Disconnect API
 *
 * DELETE /api/whatsapp/disconnect
 * 1. Unsubscribes DomiCita app from the WABA on Meta's side
 * 2. Clears WABA ID, phone number ID, etc. in our DB
 */

import { NextRequest, NextResponse } from 'next/server';
import { withAuth, type AuthenticatedUser } from '@/lib/auth-middleware';
import { db } from '@/lib/database';

const SYSTEM_USER_TOKEN =
  process.env.WHATSAPP_SYSTEM_USER_TOKEN || process.env.WHATSAPP_ACCESS_TOKEN;
const META_API_VERSION = 'v22.0';

async function unsubscribeAppFromWaba(wabaId: string): Promise<void> {
  if (!SYSTEM_USER_TOKEN) return;

  // Defensive: WABA IDs from Meta are pure decimal strings. Any other
  // character could redirect the DELETE to a different Graph API entity
  // if the value were ever tampered with.
  if (!/^\d{6,32}$/.test(wabaId)) {
    console.warn('[WhatsApp Disconnect] Refusing unsubscribe — malformed wabaId:', wabaId);
    return;
  }

  const res = await fetch(
    `https://graph.facebook.com/${META_API_VERSION}/${encodeURIComponent(wabaId)}/subscribed_apps`,
    {
      method: 'DELETE',
      headers: { Authorization: `Bearer ${SYSTEM_USER_TOKEN}` },
    }
  );

  if (!res.ok) {
    const body = await res.text();
    console.warn('[WhatsApp Disconnect] Meta unsubscribe failed (non-fatal):', body);
  } else {
    console.log('[WhatsApp Disconnect] Meta app unsubscribed from WABA:', wabaId);
  }
}

export async function DELETE(request: NextRequest) {
  return withAuth(async (authUser: AuthenticatedUser) => {
    try {
      const shopId = authUser.shopId;
      if (!shopId) {
        return NextResponse.json(
          { error: 'User has no shop assigned' },
          { status: 403 }
        );
      }

      const shop = await db.shop.findUnique({
        where: { id: shopId },
        select: { wabaId: true },
      });

      // Fire-and-forget: unsubscribe from Meta side before clearing our DB.
      // Non-fatal — if Meta call fails we still clear locally so the owner
      // can reconnect. They can manually remove the app from Business Settings.
      if (shop?.wabaId) {
        await unsubscribeAppFromWaba(shop.wabaId).catch((err) =>
          console.error('[WhatsApp Disconnect] Meta unsubscribe error:', err)
        );
      }

      await db.shop.update({
        where: { id: shopId },
        data: {
          whatsappEnabled: false,
          whatsappPhoneNumber: null,
          whatsappPhoneNumberId: null,
          wabaId: null,
        },
      });

      console.log('[WhatsApp Disconnect] Shop disconnected:', { shopId });

      return NextResponse.json({
        success: true,
        message: 'WhatsApp disconnected successfully',
      });
    } catch (error: any) {
      console.error('[WhatsApp Disconnect] Error:', error);
      return NextResponse.json(
        { error: 'Failed to disconnect WhatsApp' },
        { status: 500 }
      );
    }
  }, request as any);
}
