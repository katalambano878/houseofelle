import { NextRequest, NextResponse } from 'next/server';
import sharp from 'sharp';
import { requireScreen } from '@/lib/admin-session';
import { applyWatermark, canDrawText, isWatermarkableExt } from '@/lib/watermark/render';
import { PRODUCT_IMAGE_PREFIX, parseWatermarkSettings, toSitePath, usesText } from '@/lib/watermark/settings';
import { buildActiveWatermark, loadProductPhoto } from '@/lib/watermark/store';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

/** Previews are drawn on a copy this wide; size and spacing are percentages, so it looks the same as full size. */
const PREVIEW_WIDTH = 1000;

/** Draws a product photo with the draft (unsaved) watermark settings. */
export async function POST(request: NextRequest) {
  const auth = await requireScreen(request, 'watermark');
  if (auth.error) return auth.error;

  const body = await request.json().catch(() => null);
  const sitePath = typeof body?.sample === 'string' ? toSitePath(body.sample) : '';
  const objectPath = sitePath.startsWith(PRODUCT_IMAGE_PREFIX)
    ? decodeURIComponent(sitePath.slice(PRODUCT_IMAGE_PREFIX.length))
    : '';
  const ext = objectPath.split('.').pop()?.toLowerCase() || '';
  if (!objectPath || objectPath.split('/').includes('..') || !isWatermarkableExt(ext)) {
    return NextResponse.json({ error: 'Pick a product photo to preview.' }, { status: 400 });
  }

  const settings = { ...parseWatermarkSettings(body?.settings), enabled: true, minImageWidth: 0 };
  try {
    const original = await loadProductPhoto(objectPath);
    if (!original) return NextResponse.json({ error: 'That product photo could not be opened.' }, { status: 404 });

    const scaled = await sharp(original, { failOn: 'none' })
      .rotate()
      .resize({ width: PREVIEW_WIDTH, withoutEnlargement: true })
      .flatten({ background: '#ffffff' })
      .jpeg({ quality: 90 })
      .toBuffer();
    const { logo } = await buildActiveWatermark(settings);
    const output = (await applyWatermark(scaled, 'jpg', settings, logo)) ?? scaled;

    const headers: Record<string, string> = { 'Content-Type': 'image/jpeg', 'Cache-Control': 'no-store' };
    if (settings.mode === 'logo' || settings.mode === 'logo_text') {
      if (!logo) headers['X-Watermark-Warning'] = 'logo-missing';
    }
    if (usesText(settings) && !(await canDrawText(settings))) headers['X-Watermark-Warning'] = 'font-missing';

    return new NextResponse(new Uint8Array(output), { headers });
  } catch (err) {
    console.error('[watermark] preview failed', objectPath, err);
    return NextResponse.json({ error: 'Could not draw the preview for this photo.' }, { status: 500 });
  }
}
