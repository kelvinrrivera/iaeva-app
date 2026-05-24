/**
 * Walk-in Item API
 *
 * PATCH  /api/walkins/[id]  — Update status (IN_PROGRESS, DONE, LEFT) or reposition
 * DELETE /api/walkins/[id]  — Remove from queue
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-middleware';
import { prisma } from '@/lib/db';
import { z } from 'zod';

const patchSchema = z.object({
  status:   z.enum(['WAITING', 'IN_PROGRESS', 'DONE', 'LEFT']).optional(),
  position: z.number().int().positive().optional(),
});

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth(request);
    const { id } = await params;
    if (!user.shopId) return NextResponse.json({ error: 'No shop found' }, { status: 404 });

    // Verify ownership
    const walkIn = await prisma.walkIn.findFirst({
      where: { id, shopId: user.shopId },
    });
    if (!walkIn) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    const body = await request.json();
    const data = patchSchema.parse(body);

    const updated = await prisma.walkIn.update({
      where: { id },
      data: {
        ...(data.status && { status: data.status }),
        ...(data.status === 'IN_PROGRESS' && { servedAt: new Date() }),
        ...(data.position !== undefined && { position: data.position }),
      },
    });

    return NextResponse.json(updated);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return NextResponse.json({ error: 'Datos inválidos' }, { status: 400 });
    }
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth(request);
    const { id } = await params;
    if (!user.shopId) return NextResponse.json({ error: 'No shop found' }, { status: 404 });

    const walkIn = await prisma.walkIn.findFirst({
      where: { id, shopId: user.shopId },
    });
    if (!walkIn) return NextResponse.json({ error: 'Not found' }, { status: 404 });

    await prisma.walkIn.delete({ where: { id } });
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ error: "Internal server error" }, { status: 500 });
  }
}
