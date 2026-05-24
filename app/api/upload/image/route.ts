/**
 * Image Upload API
 *
 * Validates image by magic bytes (not just Content-Type), enforces 2MB limit,
 * and returns a data URL. SVG is blocked to prevent XSS polyglots.
 * POST /api/upload/image
 */

import { NextRequest, NextResponse } from 'next/server';
import { requireAuth } from '@/lib/auth-middleware';
import { checkRateLimit, extractIP, rateLimitResponse } from '@/lib/rate-limit';

// Magic byte signatures for allowed image types
const MAGIC_BYTES: Record<string, number[][]> = {
  'image/jpeg': [[0xFF, 0xD8, 0xFF]],
  'image/png':  [[0x89, 0x50, 0x4E, 0x47]],
  'image/gif':  [[0x47, 0x49, 0x46, 0x38]],
  'image/webp': [[0x52, 0x49, 0x46, 0x46]], // RIFF header, verified further
};

function detectMimeFromBytes(buf: Buffer): string | null {
  for (const [mime, signatures] of Object.entries(MAGIC_BYTES)) {
    for (const sig of signatures) {
      if (sig.every((byte, i) => buf[i] === byte)) {
        // Extra check for WebP: bytes 8-11 must be "WEBP"
        if (mime === 'image/webp') {
          const webpMark = buf.slice(8, 12).toString('ascii');
          if (webpMark !== 'WEBP') continue;
        }
        return mime;
      }
    }
  }
  return null;
}

const MAX_SIZE = 2 * 1024 * 1024; // 2 MB

export async function POST(request: NextRequest) {
  try {
    const ip = extractIP(request);
    const rl = await checkRateLimit(`upload:${ip}`, 'api');
    if (!rl.success) return rateLimitResponse();

    const user = await requireAuth(request);
    if (!user.shopId) {
      return NextResponse.json({ error: 'No shop associated' }, { status: 403 });
    }

    const formData = await request.formData();
    const file = formData.get('file') as File | null;

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 });
    }

    // Reject SVG unconditionally (XSS vector)
    if (file.type === 'image/svg+xml' || file.name.toLowerCase().endsWith('.svg')) {
      return NextResponse.json({ error: 'SVG files are not allowed' }, { status: 400 });
    }

    if (file.size > MAX_SIZE) {
      return NextResponse.json({ error: 'File size exceeds 2MB limit' }, { status: 400 });
    }

    const bytes = await file.arrayBuffer();
    const buffer = Buffer.from(bytes);

    // Validate by magic bytes — ignore client-supplied Content-Type for the allow decision
    const detectedMime = detectMimeFromBytes(buffer);
    if (!detectedMime) {
      return NextResponse.json({ error: 'Unsupported or invalid image format' }, { status: 400 });
    }

    const base64 = buffer.toString('base64');
    const dataUrl = `data:${detectedMime};base64,${base64}`;

    return NextResponse.json({
      url: dataUrl,
      filename: file.name,
      mimeType: detectedMime,
    });

  } catch (error: any) {
    console.error('[Upload API] Error:', error);
    if (error instanceof Error && error.message === 'Unauthorized') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
    }
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 });
  }
}
