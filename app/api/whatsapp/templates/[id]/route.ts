/**
 * WhatsApp Template by ID API
 *
 * GET  — Get template details + fresh status from provider
 * POST — Actions: submit for approval, sync status
 * DELETE — Remove template from provider + DB
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-middleware';
import { z } from 'zod';
import {
  getTemplate,
  submitForApproval,
  syncApprovalStatus,
  deleteTemplate,
} from '@/lib/whatsapp/template-manager';

const actionSchema = z.object({
  action: z.enum(['submit', 'sync']),
});

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth(request);
    if (!user.shopId) {
      return NextResponse.json({ error: 'No shop associated' }, { status: 403 });
    }

    const { id } = await params;
    const template = await getTemplate(user.shopId, id);

    if (!template) {
      return NextResponse.json({ error: 'Template not found' }, { status: 404 });
    }

    return NextResponse.json({ template });
  } catch (error: unknown) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('[Template API] GET error:', error);
    return NextResponse.json({ error: 'Failed to get template' }, { status: 500 });
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth(request);
    if (!user.shopId) {
      return NextResponse.json({ error: 'No shop associated' }, { status: 403 });
    }

    const { id } = await params;
    const body = await request.json();
    const parsed = actionSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid action. Use "submit" or "sync".' },
        { status: 400 }
      );
    }

    if (parsed.data.action === 'submit') {
      const result = await submitForApproval(user.shopId, id);
      return NextResponse.json({ status: result.status });
    }

    if (parsed.data.action === 'sync') {
      const result = await syncApprovalStatus(user.shopId, id);
      return NextResponse.json({ status: result.status, rejectionReason: result.rejectionReason });
    }

    return NextResponse.json({ error: 'Unknown action' }, { status: 400 });
  } catch (error: unknown) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('[Template API] POST error:', error);
    return NextResponse.json({ error: 'Failed to perform action' }, { status: 500 });
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const user = await requireAuth(request);
    if (!user.shopId) {
      return NextResponse.json({ error: 'No shop associated' }, { status: 403 });
    }

    const { id } = await params;
    await deleteTemplate(user.shopId, id);
    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('[Template API] DELETE error:', error);
    return NextResponse.json({ error: 'Failed to delete template' }, { status: 500 });
  }
}
