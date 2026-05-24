import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-middleware';
import { requireShopAccess } from '@/lib/auth-middleware';
import { prisma } from '@/lib/db';

/**
 * GET - Get a single location
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth(request);
    const { id } = await params;

    const location = await prisma.location.findUnique({
      where: { id },
      include: {
        stylists: true,
        appointments: {
          where: {
            startTime: { gte: new Date() },
          },
          orderBy: { startTime: 'asc' },
          take: 10,
        },
      },
    });

    if (!location) {
      return NextResponse.json(
        { error: 'Location not found' },
        { status: 404 }
      );
    }

    // Verify shop access
    await requireShopAccess(request, location.shopId);

    return NextResponse.json(location);
  } catch (error) {
    console.error('Error fetching location:', error);
    return NextResponse.json(
      { error: 'Failed to fetch location' },
      { status: 500 }
    );
  }
}

/**
 * PUT - Update a location
 */
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth(request);
    const { id } = await params;

    const location = await prisma.location.findUnique({
      where: { id },
    });

    if (!location) {
      return NextResponse.json(
        { error: 'Location not found' },
        { status: 404 }
      );
    }

    // Verify shop access
    await requireShopAccess(request, location.shopId);

    const body = await request.json();
    const { name, address, phoneNumber, whatsappNumber, timezone } = body;

    const updated = await prisma.location.update({
      where: { id },
      data: {
        name: name !== undefined ? name : location.name,
        address: address !== undefined ? address : location.address,
        phoneNumber: phoneNumber !== undefined ? phoneNumber : location.phoneNumber,
        whatsappNumber: whatsappNumber !== undefined ? whatsappNumber : location.whatsappNumber,
        timezone: timezone !== undefined ? timezone : location.timezone,
      },
    });

    return NextResponse.json(updated);
  } catch (error) {
    console.error('Error updating location:', error);
    return NextResponse.json(
      { error: 'Failed to update location' },
      { status: 500 }
    );
  }
}

/**
 * DELETE - Delete a location
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth(request);
    const { id } = await params;

    const location = await prisma.location.findUnique({
      where: { id },
    });

    if (!location) {
      return NextResponse.json(
        { error: 'Location not found' },
        { status: 404 }
      );
    }

    // Verify shop access
    await requireShopAccess(request, location.shopId);

    await prisma.location.delete({
      where: { id },
    });

    return NextResponse.json({ success: true });
  } catch (error) {
    console.error('Error deleting location:', error);
    return NextResponse.json(
      { error: 'Failed to delete location' },
      { status: 500 }
    );
  }
}
