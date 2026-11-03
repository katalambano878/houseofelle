import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db/pool';
import { clientIp, logActivity, requireScreen } from '@/lib/admin-session';
import { canDrawText } from '@/lib/watermark/render';
import {
  PRODUCT_IMAGE_PREFIX,
  isCategoryImagePath,
  parseWatermarkSettings,
  toSitePath,
  usesLogo,
  usesText,
} from '@/lib/watermark/settings';
import { loadLogo, productPhotoExists, readWatermarkSettings, saveWatermarkSettings } from '@/lib/watermark/store';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const SAMPLE_LIMIT = 8;
/** Rows read to find samples; most will exist, this only bounds the disk checks. */
const SAMPLE_CANDIDATES = 120;

export type WatermarkSample = { url: string; name: string };

/** Recent product photos that exist on this server, one per product, for the live preview. */
async function loadSamples(): Promise<WatermarkSample[]> {
  const { rows } = await query<{ url: string; name: string | null }>(
    `SELECT url, name FROM (
       SELECT DISTINCT ON (pi.product_id) pi.url, p.name, p.status, p.created_at
         FROM product_images pi
         JOIN products p ON p.id = pi.product_id
        WHERE pi.url ~* '/storage/v1/object/public/products/[^?#]+\\.(jpe?g|png|webp|avif)([?#].*)?$'
        ORDER BY pi.product_id, pi.position ASC NULLS LAST, pi.created_at ASC
     ) first_photos
     ORDER BY (status = 'active') DESC, created_at DESC NULLS LAST
     LIMIT $1`,
    [SAMPLE_CANDIDATES]
  );
  const samples: WatermarkSample[] = [];
  for (const row of rows) {
    if (samples.length >= SAMPLE_LIMIT) break;
    const sitePath = toSitePath(row.url);
    if (!sitePath.startsWith(PRODUCT_IMAGE_PREFIX)) continue;
    const objectPath = decodeURIComponent(sitePath.slice(PRODUCT_IMAGE_PREFIX.length));
    if (isCategoryImagePath(objectPath) || !(await productPhotoExists(objectPath))) continue;
    if (samples.some((s) => s.url === sitePath)) continue;
    samples.push({ url: sitePath, name: row.name?.trim() || 'Product' });
  }
  return samples;
}

export async function GET(request: NextRequest) {
  const auth = await requireScreen(request, 'watermark');
  if (auth.error) return auth.error;

  try {
    const [{ settings, updatedAt }, samples] = await Promise.all([readWatermarkSettings(), loadSamples()]);
    return NextResponse.json({ settings, updatedAt, samples });
  } catch (err) {
    console.error('[watermark] load settings failed', err);
    return NextResponse.json({ error: 'Could not load the watermark settings. Refresh to try again.' }, { status: 500 });
  }
}

export async function PUT(request: NextRequest) {
  const auth = await requireScreen(request, 'watermark');
  if (auth.error) return auth.error;

  const body = await request.json().catch(() => null);
  if (!body || typeof body.settings !== 'object' || body.settings === null) {
    return NextResponse.json({ error: 'Send the watermark settings to save.' }, { status: 400 });
  }
  const settings = parseWatermarkSettings(body.settings);

  if (settings.enabled) {
    if (usesLogo(settings) && !(await loadLogo(settings.logoUrl))) {
      return NextResponse.json(
        { error: 'The logo file could not be found. Upload the logo again, or use the store logo.' },
        { status: 400 }
      );
    }
    if (settings.mode !== 'logo' && !settings.text) {
      return NextResponse.json({ error: 'Type the watermark text, or switch to logo only.' }, { status: 400 });
    }
    if (settings.mode === 'text' && usesText(settings) && !(await canDrawText(settings))) {
      return NextResponse.json(
        { error: 'This server cannot draw text yet (no font installed). Use the logo instead for now.' },
        { status: 400 }
      );
    }
  }

  try {
    await saveWatermarkSettings(settings);
  } catch (err) {
    console.error('[watermark] save failed', err);
    return NextResponse.json({ error: 'Could not save the watermark settings. Try again.' }, { status: 500 });
  }

  await logActivity({
    userId: auth.member.id,
    action: 'update',
    entityType: 'site_settings',
    details: {
      label: 'Image watermark',
      enabled: settings.enabled,
      mode: settings.mode,
      position: settings.position,
    },
    ip: clientIp(request),
  });

  return NextResponse.json({
    settings,
    updatedAt: new Date().toISOString(),
    message: settings.enabled
      ? 'Watermark saved. Product photos on the website now show it.'
      : 'Watermark turned off. Product photos on the website show clean again.',
  });
}
