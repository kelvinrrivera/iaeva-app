/**
 * Onboarding Completion API
 *
 * Handles the final step of onboarding by:
 * - Creating/Updating the shop
 * - Creating services
 * - Creating team members
 * - Setting up WhatsApp configuration
 * - Assigning the plan
 *
 * POST /api/onboarding/complete
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-middleware';
import { prisma } from '@/lib/db';
import { z } from 'zod';
import { randomBytes } from 'crypto';
import type { ShopType } from '@prisma/client';
import { connectWhatsAppToShop } from '@/lib/whatsapp/embedded-signup';

function tempEmail(): string {
  return `temp_${randomBytes(8).toString('hex')}@domicita.internal`;
}

function tempId(): string {
  return `pending_${randomBytes(8).toString('hex')}`;
}

/**
 * Validation schema for onboarding completion
 */
const completeOnboardingSchema = z.object({
  shopType: z.enum(['BARBERSHOP', 'BEAUTY_SALON', 'HYBRID']),
  shopName: z.string().min(2, 'El nombre debe tener al menos 2 caracteres'),
  shopPhone: z.string().optional(),
  shopAddress: z.string().min(5, 'La dirección es requerida'),
  shopLatitude: z.number().optional(),
  shopLongitude: z.number().optional(),
  shopPlaceId: z.string().optional(),
  shopLogo: z.string().optional(),
  services: z.array(z.object({
    name: z.string().min(1),
    type: z.string(),
    price: z.number().min(0),
    duration: z.number().min(5),
  })).min(1, 'Debes tener al menos un servicio'),
  team: z.array(z.object({
    name: z.string(),
    role: z.string(),
    photo: z.string().optional(),
  })).optional(),
  whatsappPhone: z.string().optional(),
  whatsappVerified: z.boolean().optional(),
  whatsappAccessToken: z.string().optional(),
  whatsappWabaId: z.string().optional(),
  whatsappPhoneNumberId: z.string().optional(),
  plan: z.enum(['SOLO', 'TEAM', 'BUSINESS']).default('TEAM'),
});

export async function POST(request: NextRequest) {
  try {
    // Authenticate user
    let user;
    try {
      user = await requireAuth(request);
    } catch (authErr: any) {
      console.error('[Onboarding] Auth failed:', authErr.message);
      return NextResponse.json({ error: 'No autenticado', detail: authErr.message }, { status: 401 });
    }

    // Parse and validate request body
    const body = await request.json();
    console.log('[Onboarding] Body keys:', Object.keys(body), 'services count:', body.services?.length, 'plan:', body.plan);

    let validatedData;
    try {
      validatedData = completeOnboardingSchema.parse(body);
    } catch (zodErr: any) {
      console.error('[Onboarding] Zod validation failed:', JSON.stringify(zodErr.issues));
      return NextResponse.json({ error: 'Datos inválidos', detail: JSON.stringify(zodErr.issues) }, { status: 400 });
    }

    // Check if user already has a shop
    const existingMembership = await prisma.membership.findFirst({
      where: {
        userId: user.id,
        role: { in: ['SUPER_ADMIN', 'ORG_ADMIN'] },
      },
      include: {
        shop: true,
      },
    });

    let shopId: string;

    if (existingMembership) {
      // Update existing shop
      const updatedShop = await prisma.shop.update({
        where: { id: existingMembership.shopId },
        data: {
          name: validatedData.shopName,
          address: validatedData.shopAddress,
          latitude: validatedData.shopLatitude,
          longitude: validatedData.shopLongitude,
          placeId: validatedData.shopPlaceId,
          shopType: validatedData.shopType as ShopType,
          plan: validatedData.plan,
          ...(validatedData.shopLogo && { logoUrl: validatedData.shopLogo }),
        },
      });
      shopId = updatedShop.id;
    } else {
      // Ensure the User record exists in Prisma (Supabase Auth user may not be synced yet)
      await prisma.user.upsert({
        where: { id: user.id },
        update: {},
        create: {
          id: user.id,
          phoneNumber: user.phone || '',
          email: user.email || null,
          name: user.name || null,
        },
      });

      // Create new shop
      const newShop = await prisma.shop.create({
        data: {
          name: validatedData.shopName,
          address: validatedData.shopAddress,
          latitude: validatedData.shopLatitude,
          longitude: validatedData.shopLongitude,
          placeId: validatedData.shopPlaceId,
          shopType: validatedData.shopType as ShopType,
          plan: validatedData.plan,
          ...(validatedData.shopLogo && { logoUrl: validatedData.shopLogo }),
        },
      });
      const resolvedShopId = newShop.id;

      // Create membership for user
      await prisma.membership.create({
        data: {
          userId: user.id,
          shopId: resolvedShopId,
          role: 'ORG_ADMIN',
        },
      });

      shopId = resolvedShopId;
    }

    // Delete existing services for this shop
    await prisma.service.deleteMany({
      where: { shopId },
    });

    // Create services
    for (const service of validatedData.services) {
      await prisma.service.create({
        data: {
          shopId,
          name: service.name,
          serviceType: service.type as any,
          price: service.price,
          duration: service.duration,
        },
      });
    }

    // Create team members (if provided)
    if (validatedData.team && validatedData.team.length > 0) {
      // Delete existing team memberships for this shop (excluding current user)
      await prisma.membership.deleteMany({
        where: {
          shopId,
          userId: { not: user.id },
          role: 'PROFESSIONAL',
        },
      });

      // Create new team members
      for (const member of validatedData.team) {
        // Use random email + id so different shops with same employee name never collide
        const teamUser = await prisma.user.create({
          data: {
            id: tempId(),
            email: tempEmail(),
            name: member.name,
          },
        });

        // Create membership
        await prisma.membership.create({
          data: {
            userId: teamUser.id,
            shopId,
            role: 'PROFESSIONAL',
          },
        });
      }
    }

    // Connect WhatsApp via Embedded Signup (if the user completed the Meta flow)
    if (
      validatedData.whatsappAccessToken &&
      validatedData.whatsappWabaId &&
      validatedData.whatsappPhoneNumberId
    ) {
      try {
        await connectWhatsAppToShop({
          shopId,
          code: validatedData.whatsappAccessToken,
          wabaId: validatedData.whatsappWabaId,
          phoneNumberId: validatedData.whatsappPhoneNumberId,
          // Onboarding wizard defaults to Coexistence (kept on the tenant's phone).
          // Cloud-API-only flow goes through Settings later.
          featureType: 'coexistence',
        });
      } catch (waErr: any) {
        console.error('[Onboarding] WhatsApp connect failed:', waErr);
        if (waErr?.code === 'P2002') {
          return NextResponse.json(
            { error: 'Este numero de WhatsApp ya esta registrado en otro negocio.' },
            { status: 409 }
          );
        }
        // Non-fatal: shop is created, user can retry WhatsApp from Settings
      }
    } else if (validatedData.whatsappPhone) {
      try {
        await prisma.shop.update({
          where: { id: shopId },
          data: {
            whatsappPhoneNumber: validatedData.whatsappPhone,
            whatsappEnabled: validatedData.whatsappVerified || false,
          },
        });
      } catch (err: any) {
        if (err?.code === 'P2002') {
          return NextResponse.json(
            { error: 'Este numero de WhatsApp ya esta registrado en otro negocio.' },
            { status: 409 }
          );
        }
        throw err;
      }
    }

    return NextResponse.json({
      success: true,
      shopId,
      message: 'Onboarding completado exitosamente',
    });

  } catch (error: any) {
    console.error('Error completing onboarding:', error);

    if (error instanceof z.ZodError) {
      return NextResponse.json(
        { error: 'Datos inválidos', details: error.issues },
        { status: 400 }
      );
    }

    return NextResponse.json(
      { error: 'Error al completar el onboarding', detail: error?.message || String(error) },
      { status: 500 }
    );
  }
}
