import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-middleware';
import { prisma } from '@/lib/db';
import { z } from 'zod';

const createLocationSchema = z.object({
  name: z.string().min(1).max(100),
  address: z.string().max(300).optional(),
  phoneNumber: z.string().regex(/^[\d+\-() ]{7,20}$/).optional().nullable(),
  whatsappNumber: z.string().regex(/^[\d+\-() ]{7,20}$/).optional().nullable(),
  timezone: z.string().max(50).optional(),
});

/**
 * GET - Get all locations for the shop
 */
export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request);

    if (!user.shopId) {
      return NextResponse.json(
        { error: 'No shop selected' },
        { status: 400 }
      );
    }

    const locations = await prisma.location.findMany({
      where: { shopId: user.shopId },
      include: {
        _count: {
          select: {
            stylists: true,
            appointments: true,
          },
        },
      },
      orderBy: { name: 'asc' },
    });

    return NextResponse.json(locations);
  } catch (error) {
    console.error('Error fetching locations:', error);
    return NextResponse.json(
      { error: 'Failed to fetch locations' },
      { status: 500 }
    );
  }
}

/**
 * POST - Create a new location
 */
export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request);

    if (!user.shopId) {
      return NextResponse.json(
        { error: 'No shop selected' },
        { status: 400 }
      );
    }

    const body = await request.json();
    const parsed = createLocationSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const { name, address, phoneNumber, whatsappNumber, timezone } = parsed.data;

    const location = await prisma.location.create({
      data: {
        name,
        address,
        phoneNumber,
        whatsappNumber,
        timezone: timezone || 'America/Santo_Domingo',
        shopId: user.shopId,
      },
    });

    return NextResponse.json(location, { status: 201 });
  } catch (error) {
    console.error('Error creating location:', error);
    return NextResponse.json(
      { error: 'Failed to create location' },
      { status: 500 }
    );
  }
}
