// Draws the watermark onto a photo with sharp. Pure image work: no database, no disk.

import sharp from 'sharp';
import { usesLogo, usesText, type WatermarkPosition, type WatermarkSettings } from './settings';

export const WATERMARKABLE_FORMATS = {
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  png: 'image/png',
  webp: 'image/webp',
  avif: 'image/avif',
} as const;

export type WatermarkableExt = keyof typeof WATERMARKABLE_FORMATS;

export function isWatermarkableExt(ext: string): ext is WatermarkableExt {
  return Object.prototype.hasOwnProperty.call(WATERMARKABLE_FORMATS, ext);
}

/** Text is drawn large, trimmed to its ink, then scaled to the wanted width, so any installed font measures right. */
const TEXT_RENDER_SIZE = 160;
const TILE_ANGLE = -30;
const TILE_GAP = 1.1;
const CLEAR = { r: 0, g: 0, b: 0, alpha: 0 };

const FONT_STACKS: Record<WatermarkSettings['font'], string> = {
  serif: "'Playfair Display', 'DejaVu Serif', 'Liberation Serif', Georgia, 'Times New Roman', serif",
  sans: "'DejaVu Sans', 'Liberation Sans', Helvetica, Arial, sans-serif",
};

function escapeXml(value: string): string {
  return value.replace(/[<>&'"]/g, (c) => ({ '<': '&lt;', '>': '&gt;', '&': '&amp;', "'": '&apos;', '"': '&quot;' })[c]!);
}

/** A thin contrasting edge keeps light text readable on light photos and dark text on dark ones. */
function outlineFor(hex: string): string {
  const n = parseInt(hex.slice(1), 16);
  const luminance = (0.299 * ((n >> 16) & 255) + 0.587 * ((n >> 8) & 255) + 0.114 * (n & 255)) / 255;
  return luminance > 0.55 ? 'rgba(0,0,0,0.35)' : 'rgba(255,255,255,0.45)';
}

/** Returns the text as a trimmed transparent PNG at its natural render size, or null if no font could draw it. */
async function renderText(settings: WatermarkSettings): Promise<Buffer | null> {
  const size = TEXT_RENDER_SIZE;
  const stroke = Math.round(size * 0.035);
  const width = Math.ceil(settings.text.length * size * 0.9 + size);
  const height = Math.ceil(size * 1.8);
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}">
  <text x="50%" y="50%" dominant-baseline="central" text-anchor="middle"
    font-family="${escapeXml(FONT_STACKS[settings.font])}" font-weight="600" font-size="${size}"
    fill="${settings.textColor}" stroke="${outlineFor(settings.textColor)}" stroke-width="${stroke}"
    stroke-linejoin="round" paint-order="stroke">${escapeXml(settings.text)}</text>
</svg>`;
  try {
    const { data, info } = await sharp(Buffer.from(svg))
      .trim({ background: CLEAR, threshold: 1 })
      .png()
      .toBuffer({ resolveWithObject: true });
    // A canvas that did not shrink means nothing was drawn (no usable font on this server).
    if (info.width >= width - 2 && info.height >= height - 2) return null;
    return data;
  } catch {
    return null;
  }
}

/** False when this server has no font that can draw the text (the text part is then left out). */
export async function canDrawText(settings: WatermarkSettings): Promise<boolean> {
  return (await renderText(settings)) !== null;
}

async function scaleToWidth(input: Buffer, width: number): Promise<{ data: Buffer; width: number; height: number }> {
  const { data, info } = await sharp(input)
    .resize({ width: Math.max(1, Math.round(width)) })
    .png()
    .toBuffer({ resolveWithObject: true });
  return { data, width: info.width, height: info.height };
}

async function scaleToHeight(input: Buffer, height: number): Promise<{ data: Buffer; width: number; height: number }> {
  const { data, info } = await sharp(input)
    .resize({ height: Math.max(1, Math.round(height)) })
    .png()
    .toBuffer({ resolveWithObject: true });
  return { data, width: info.width, height: info.height };
}

/** Flattens every visible logo pixel to one colour while keeping its transparency. */
async function toneLogo(logo: Buffer, tone: WatermarkSettings['logoTone']): Promise<Buffer> {
  if (tone === 'original') return logo;
  const value = tone === 'white' ? 255 : 0;
  const { data, info } = await sharp(logo).ensureAlpha().raw().toBuffer({ resolveWithObject: true });
  for (let i = 0; i < data.length; i += 4) {
    data[i] = value;
    data[i + 1] = value;
    data[i + 2] = value;
  }
  return sharp(data, { raw: { width: info.width, height: info.height, channels: 4 } }).png().toBuffer();
}

/** Builds the watermark graphic (logo, text, or logo over text) at the target width, fully opaque. */
async function buildMark(settings: WatermarkSettings, logo: Buffer | null, targetWidth: number): Promise<Buffer | null> {
  let logoPart: { data: Buffer; width: number; height: number } | null = null;
  if (usesLogo(settings) && logo) {
    const trimmed = await sharp(logo, { failOn: 'none' })
      .ensureAlpha()
      .trim({ background: CLEAR, threshold: 1 })
      .png()
      .toBuffer()
      .catch(() => sharp(logo, { failOn: 'none' }).ensureAlpha().png().toBuffer());
    logoPart = await scaleToWidth(await toneLogo(trimmed, settings.logoTone), targetWidth);
  }

  let textPart: { data: Buffer; width: number; height: number } | null = null;
  if (usesText(settings)) {
    const text = await renderText(settings);
    if (text) {
      // Under a logo the text is a caption; on its own it takes the full width.
      textPart = logoPart
        ? await scaleToHeight(text, Math.max(8, logoPart.height * 0.3))
        : await scaleToWidth(text, targetWidth);
      if (logoPart && textPart.width > logoPart.width) textPart = await scaleToWidth(textPart.data, logoPart.width);
    }
  }

  if (!logoPart && !textPart) return null;
  if (!textPart) return logoPart!.data;
  if (!logoPart) return textPart.data;

  const gap = Math.round(logoPart.height * 0.1);
  const width = Math.max(logoPart.width, textPart.width);
  const height = logoPart.height + gap + textPart.height;
  return sharp({ create: { width, height, channels: 4, background: CLEAR } })
    .composite([
      { input: logoPart.data, top: 0, left: Math.round((width - logoPart.width) / 2) },
      { input: textPart.data, top: logoPart.height + gap, left: Math.round((width - textPart.width) / 2) },
    ])
    .png()
    .toBuffer();
}

function withOpacity(mark: Buffer, opacity: number): Promise<Buffer> {
  return sharp(mark).ensureAlpha().linear([1, 1, 1, opacity], [0, 0, 0, 0]).png().toBuffer();
}

function placement(
  position: Exclude<WatermarkPosition, 'tiled'>,
  image: { width: number; height: number },
  mark: { width: number; height: number },
  margin: number
): { top: number; left: number } {
  const [vertical, horizontal] = position === 'center' ? ['center', 'center'] : position.split('-');
  const left =
    horizontal === 'left' ? margin : horizontal === 'right' ? image.width - mark.width - margin : (image.width - mark.width) / 2;
  const top =
    vertical === 'top' ? margin : vertical === 'bottom' ? image.height - mark.height - margin : (image.height - mark.height) / 2;
  return { top: Math.max(0, Math.round(top)), left: Math.max(0, Math.round(left)) };
}

function encode(pipeline: sharp.Sharp, ext: WatermarkableExt): sharp.Sharp {
  switch (ext) {
    case 'png':
      return pipeline.png({ compressionLevel: 8 });
    case 'webp':
      return pipeline.webp({ quality: 86 });
    case 'avif':
      return pipeline.avif({ quality: 60 });
    default:
      return pipeline.jpeg({ quality: 86, mozjpeg: true });
  }
}

/**
 * Returns the watermarked photo, or null when it should be served untouched
 * (too small, animated, or nothing to draw, e.g. logo mode with a missing logo file).
 */
export async function applyWatermark(
  input: Buffer,
  ext: WatermarkableExt,
  settings: WatermarkSettings,
  logo: Buffer | null
): Promise<Buffer | null> {
  const meta = await sharp(input, { failOn: 'none' }).metadata();
  if (!meta.width || !meta.height || (meta.pages ?? 1) > 1) return null;
  const rotated = (meta.orientation ?? 1) >= 5;
  const image = rotated ? { width: meta.height, height: meta.width } : { width: meta.width, height: meta.height };
  if (image.width < settings.minImageWidth) return null;

  const margin = Math.round((Math.min(image.width, image.height) * settings.margin) / 100);
  const targetWidth = Math.max(16, Math.round((image.width * settings.size) / 100));
  const opaque = await buildMark(settings, logo, targetWidth);
  if (!opaque) return null;

  let mark = await withOpacity(opaque, settings.opacity);
  const base = sharp(input, { failOn: 'none' }).rotate();

  if (settings.position === 'tiled') {
    const turned = await sharp(mark).rotate(TILE_ANGLE, { background: CLEAR }).toBuffer({ resolveWithObject: true });
    const padX = Math.round((turned.info.width * TILE_GAP) / 2);
    const padY = Math.round((turned.info.height * TILE_GAP) / 2);
    const tile = await sharp(turned.data)
      .extend({ top: padY, bottom: padY, left: padX, right: padX, background: CLEAR })
      .png()
      .toBuffer();
    const fitted = await sharp(tile)
      .resize({ width: image.width, height: image.height, fit: 'inside', withoutEnlargement: true })
      .png()
      .toBuffer();
    return encode(base.composite([{ input: fitted, tile: true, gravity: 'center' }]), ext).toBuffer();
  }

  let markMeta = await sharp(mark).metadata();
  const maxW = Math.max(1, image.width - margin * 2);
  const maxH = Math.max(1, image.height - margin * 2);
  if ((markMeta.width ?? 0) > maxW || (markMeta.height ?? 0) > maxH) {
    mark = await sharp(mark).resize({ width: maxW, height: maxH, fit: 'inside' }).png().toBuffer();
    markMeta = await sharp(mark).metadata();
  }
  const { top, left } = placement(
    settings.position,
    image,
    { width: markMeta.width ?? 0, height: markMeta.height ?? 0 },
    margin
  );
  return encode(base.composite([{ input: mark, top, left }]), ext).toBuffer();
}
