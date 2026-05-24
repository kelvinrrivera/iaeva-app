/**
 * Stripe Webhook Handler
 *
 * Handles webhook events from Stripe for subscription management.
 *
 * POST /api/stripe/webhook
 */

import { NextRequest, NextResponse } from 'next/server';
import type { Plan } from '@prisma/client';
import { constructWebhookEvent, stripe, getPlanFromPriceId } from '@/lib/stripe/client';
import { prisma } from '@/lib/db';
import { headers } from 'next/headers';
import { sendPaymentFailedEmail } from '@/lib/email';

/**
 * Resolve the shopId from a Stripe subscription, verifying DB ownership.
 *
 * Priority: DB record (stripeSubscriptionId) → metadata.shopId
 * Never trust metadata alone for writes without cross-checking DB.
 */
async function resolveShopIdFromSubscription(
  subscriptionId: string,
  metadataShopId?: string
): Promise<string | null> {
  // First check our DB — most trustworthy source
  const shopBySubId = await prisma.shop.findFirst({
    where: { stripeSubscriptionId: subscriptionId },
    select: { id: true },
  });
  if (shopBySubId) return shopBySubId.id;

  // New subscription not yet recorded — verify metadata shopId actually exists
  if (metadataShopId) {
    const shopExists = await prisma.shop.findUnique({
      where: { id: metadataShopId },
      select: { id: true },
    });
    if (shopExists) return shopExists.id;
  }

  return null;
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.text();
    const signature = (await headers()).get('stripe-signature');

    if (!signature) {
      return NextResponse.json(
        { error: 'No signature provided' },
        { status: 400 }
      );
    }

    const event = constructWebhookEvent(body, signature);

    console.log(`Stripe webhook received: ${event.type}`);

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object as any;
        const subscriptionId = session.subscription;
        const customerId = session.customer;
        const metadataShopId = session.metadata?.shopId;

        if (!subscriptionId) break;

        const shopId = await resolveShopIdFromSubscription(subscriptionId, metadataShopId);
        if (!shopId) {
          console.error(`checkout.session.completed: could not resolve shop for sub ${subscriptionId}`);
          break;
        }

        // Derive plan from Stripe subscription (not from spoofable metadata)
        let plan: string | null = null;
        try {
          const sub = await stripe.subscriptions.retrieve(subscriptionId as string);
          const priceId = sub.items.data[0]?.price?.id;
          if (priceId) {
            const matched = getPlanFromPriceId(priceId);
            if (matched) plan = matched.plan;
          }
        } catch (e) {
          console.error('Failed to retrieve subscription for plan lookup:', (e as Error).message);
        }

        if (!plan) {
          console.error(`Unknown price_id for subscription ${subscriptionId} — shopId: ${shopId}`);
          break;
        }

        await prisma.shop.update({
          where: { id: shopId },
          data: {
            stripeCustomerId: customerId as string,
            stripeSubscriptionId: subscriptionId as string,
            plan: plan as Plan,
            subscriptionStatus: 'active',
            gracePeriodEndsAt: null,
          },
        });

        console.log(`Shop ${shopId} upgraded to ${plan} plan`);
        break;
      }

      case 'customer.subscription.updated': {
        const subscription = event.data.object as any;
        const shopId = await resolveShopIdFromSubscription(
          subscription.id,
          subscription.metadata?.shopId
        );

        if (shopId && subscription.cancel_at_period_end) {
          console.log(`Shop ${shopId} subscription will be cancelled at period end`);
        }
        break;
      }

      case 'customer.subscription.deleted': {
        const subscription = event.data.object as any;

        // Only use DB lookup — metadata can be missing on deleted subs
        const shopBySubId = await prisma.shop.findFirst({
          where: { stripeSubscriptionId: subscription.id },
          select: { id: true },
        });

        if (!shopBySubId) {
          console.warn(`customer.subscription.deleted: no shop found for sub ${subscription.id}`);
          break;
        }

        // Subscription cancelled — suspend the shop. We DON'T downgrade plan
        // because there's no free tier anymore; the plan stays as-is so they
        // can resubscribe to the same level easily.
        await prisma.shop.update({
          where: { id: shopBySubId.id },
          data: {
            subscriptionStatus: 'canceled',
            whatsappEnabled: false,
            stripeSubscriptionId: null,
          },
        });

        console.log(`Shop ${shopBySubId.id} subscription cancelled, suspended`);
        break;
      }

      case 'invoice.paid': {
        const invoice = event.data.object as any;
        const shop = await prisma.shop.findFirst({
          where: { stripeSubscriptionId: invoice.subscription as string },
          select: { id: true },
        });
        if (shop) {
          // Clear any grace period — payment resolved
          await prisma.shop.update({
            where: { id: shop.id },
            data: { subscriptionStatus: 'active', gracePeriodEndsAt: null },
          });
          console.log(`Invoice paid for shop ${shop.id} — grace period cleared`);
        }
        break;
      }

      case 'invoice.payment_failed': {
        const invoice = event.data.object as any;
        const shop = await prisma.shop.findFirst({
          where: { stripeSubscriptionId: invoice.subscription as string },
          select: { id: true, name: true },
        });
        if (shop) {
          // Mark past_due and start 7-day grace period
          const gracePeriodEndsAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
          await prisma.shop.update({
            where: { id: shop.id },
            data: { subscriptionStatus: 'past_due', gracePeriodEndsAt },
          });
          console.log(`Payment failed for shop ${shop.id} — grace period until ${gracePeriodEndsAt.toISOString()}`);

          // Fire-and-forget: notify the shop owner via email
          (async () => {
            try {
              const membership = await prisma.membership.findFirst({
                where: {
                  shopId: shop.id,
                  role: { in: ['ORG_ADMIN', 'SUPER_ADMIN'] },
                },
                include: { user: { select: { email: true } } },
                orderBy: { createdAt: 'asc' },
              });
              const ownerEmail = membership?.user?.email;
              if (ownerEmail) {
                await sendPaymentFailedEmail({
                  to: ownerEmail,
                  shopName: shop.name,
                  invoiceUrl: (invoice.hosted_invoice_url as string) ?? undefined,
                });
              } else {
                console.warn(`[stripe-webhook] No owner email found for shop ${shop.id}`);
              }
            } catch (err) {
              console.error('[stripe-webhook] Failed to send payment failed email:', err);
            }
          })();
        }
        break;
      }

      default:
        console.log(`Unhandled event type: ${event.type}`);
    }

    return NextResponse.json({ received: true });

  } catch (error: any) {
    console.error('Stripe webhook error:', error?.message);
    return NextResponse.json(
      { error: 'Webhook handler failed' },
      { status: 400 }
    );
  }
}
