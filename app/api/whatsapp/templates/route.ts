/**
 * WhatsApp Templates CRUD API
 *
 * GET  — List templates for current shop
 * POST — Create a new template
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-middleware';
import { z } from 'zod';

export const maxDuration = 60;
import {
  createTemplate,
  listTemplates,
  registerPendingMetaTemplates,
  syncApprovalStatus,
} from '@/lib/whatsapp/template-manager';
import { seedDefaultTemplates, DEFAULT_TEMPLATES } from '@/lib/whatsapp/template-seeder';

const createSchema = z.object({
  name: z.string().min(1).max(100).regex(/^[a-zA-Z0-9_ ]+$/, 'Only letters, numbers, underscores, and spaces'),
  language: z.string().max(10).default('es'),
  category: z.enum(['UTILITY', 'MARKETING', 'AUTHENTICATION']),
  bodyText: z.string().min(1).max(1024),
  variables: z.record(z.string(), z.string().max(200)).optional(),
  purpose: z.string().max(100).optional(),
});

export async function GET(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    if (!user.shopId) {
      return NextResponse.json({ error: 'No shop associated' }, { status: 403 });
    }

    // Auto-seed missing templates if shop has fewer than expected
    let templates = await listTemplates(user.shopId);
    if (templates.length < DEFAULT_TEMPLATES.length) {
      await seedDefaultTemplates(user.shopId);
      templates = await listTemplates(user.shopId);
    }

    return NextResponse.json({ templates });
  } catch (error: unknown) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('[Templates API] GET error:', error);
    return NextResponse.json({ error: 'Failed to list templates' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  try {
    const user = await requireAuth(request);
    if (!user.shopId) {
      return NextResponse.json({ error: 'No shop associated' }, { status: 403 });
    }
    const shopId: string = user.shopId;

    const body = await request.json();

    // Bulk action: register all DRAFT templates with Meta and refresh statuses
    if (body?.action === 'sync-all') {
      const reg = await registerPendingMetaTemplates(shopId);
      const templates = await listTemplates(shopId);
      // Refresh status for ones that already have a Meta ID
      await Promise.all(
        templates
          .filter((t) => t.metaTemplateId && t.status !== 'APPROVED')
          .map((t) => syncApprovalStatus(shopId, t.id).catch(() => null))
      );
      const refreshed = await listTemplates(shopId);
      return NextResponse.json({
        registered: reg.registered,
        errors: reg.errors,
        templates: refreshed,
      });
    }

    // Reseed from scratch: delete from Meta + DB and recreate with current bodies
    if (body?.action === 'reseed') {
      const { db } = await import('@/lib/database');
      const { deleteTemplate } = await import('@/lib/whatsapp/template-manager');

      // Best-effort delete from Meta + DB for any DRAFT/REJECTED rows
      const stale = await db.whatsAppTemplate.findMany({
        where: { shopId, status: { in: ['DRAFT', 'REJECTED', 'PENDING'] } },
        select: { id: true },
      });
      await Promise.all(
        stale.map((t) => deleteTemplate(shopId, t.id).catch(() => null))
      );
      await seedDefaultTemplates(shopId);
      const refreshed = await listTemplates(shopId);
      return NextResponse.json({ templates: refreshed });
    }

    const parsed = createSchema.safeParse(body);

    if (!parsed.success) {
      return NextResponse.json(
        { error: 'Invalid input', details: parsed.error.flatten().fieldErrors },
        { status: 400 }
      );
    }

    const template = await createTemplate(user.shopId, {
      ...parsed.data,
      variables: parsed.data.variables as Record<string, string> | undefined,
    });
    return NextResponse.json({ template }, { status: 201 });
  } catch (error: unknown) {
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    console.error('[Templates API] POST error:', error);
    return NextResponse.json({ error: 'Failed to create template' }, { status: 500 });
  }
}
