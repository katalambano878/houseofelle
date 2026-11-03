// Watermark settings shared by the admin screen (client) and the image server.
// Nothing here touches the database or the disk, so it is safe to import in the browser.

export const WATERMARK_SETTINGS_KEY = 'image_watermark';

export const WATERMARK_MODES = ['logo', 'text', 'logo_text'] as const;
export const WATERMARK_POSITIONS = [
  'top-left',
  'top-center',
  'top-right',
  'center-left',
  'center',
  'center-right',
  'bottom-left',
  'bottom-center',
  'bottom-right',
  'tiled',
] as const;
/** How the logo is coloured: as uploaded, or flattened to white or black so it shows on any photo. */
export const WATERMARK_LOGO_TONES = ['original', 'white', 'black'] as const;
export const WATERMARK_FONTS = ['serif', 'sans'] as const;

export type WatermarkMode = (typeof WATERMARK_MODES)[number];
export type WatermarkPosition = (typeof WATERMARK_POSITIONS)[number];
export type WatermarkLogoTone = (typeof WATERMARK_LOGO_TONES)[number];
export type WatermarkFont = (typeof WATERMARK_FONTS)[number];

export type WatermarkSettings = {
  enabled: boolean;
  mode: WatermarkMode;
  text: string;
  font: WatermarkFont;
  textColor: string;
  /** Site path of the logo: a file in public/ (e.g. /house-of-elle-logo.png) or a media upload (/storage/v1/object/public/media/...). */
  logoUrl: string;
  logoTone: WatermarkLogoTone;
  position: WatermarkPosition;
  /** 0.05 – 1 */
  opacity: number;
  /** Watermark width as a percentage of the photo width. */
  size: number;
  /** Gap from the photo edge as a percentage of the photo's shorter side. */
  margin: number;
  /** Category tiles live in the same folder as product photos; they are left clean unless this is on. */
  includeCategoryImages: boolean;
  /** Photos narrower than this (px) are served untouched. */
  minImageWidth: number;
};

export const DEFAULT_LOGO_URL = '/house-of-elle-logo.png';

export const DEFAULT_WATERMARK_SETTINGS: WatermarkSettings = {
  enabled: false,
  mode: 'logo',
  text: 'House of Elle',
  font: 'serif',
  textColor: '#ffffff',
  logoUrl: DEFAULT_LOGO_URL,
  logoTone: 'original',
  position: 'bottom-right',
  opacity: 0.6,
  size: 28,
  margin: 4,
  includeCategoryImages: false,
  minImageWidth: 240,
};

export const WATERMARK_LIMITS = {
  textMaxLength: 40,
  opacity: { min: 0.05, max: 1 },
  size: { min: 5, max: 70 },
  margin: { min: 0, max: 15 },
  minImageWidth: { min: 0, max: 2000 },
} as const;

/** Product photos are stored in the `products` bucket and served from this path. */
export const PRODUCT_IMAGE_PREFIX = '/storage/v1/object/public/products/';
const MEDIA_IMAGE_PREFIX = '/storage/v1/object/public/media/';

const PUBLIC_FILE = /^\/(?:[A-Za-z0-9_-]+\/)*[A-Za-z0-9_.-]+\.(?:png|jpe?g|webp)$/i;
const MEDIA_FILE = /^\/storage\/v1\/object\/public\/media\/(?:[A-Za-z0-9_-]+\/)*[A-Za-z0-9_.-]+\.(?:png|jpe?g|webp)$/i;
const HEX_COLOR = /^#[0-9a-f]{6}$/i;

/** Drops the origin from an absolute URL so `https://houseofelle.store/x.png` and `/x.png` are treated the same. */
export function toSitePath(value: string): string {
  const trimmed = value.trim();
  if (/^https?:\/\//i.test(trimmed)) {
    try {
      return new URL(trimmed).pathname;
    } catch {
      return '';
    }
  }
  return trimmed.split(/[?#]/)[0];
}

export function isValidLogoPath(value: string): boolean {
  if (value.split('/').some((part) => part === '..' || part === '.')) return false;
  if (value.startsWith('/storage/')) return MEDIA_FILE.test(value);
  return PUBLIC_FILE.test(value);
}

export function isMediaLogo(value: string): boolean {
  return value.startsWith(MEDIA_IMAGE_PREFIX);
}

/** Category images are uploaded by Admin → Categories as `cat-<id>.<ext>` in the products bucket. */
export function isCategoryImagePath(objectPath: string): boolean {
  const name = objectPath.split('/').pop() || '';
  return name.startsWith('cat-');
}

function clamp(value: unknown, min: number, max: number, fallback: number): number {
  const n = typeof value === 'number' ? value : Number(value);
  if (!Number.isFinite(n)) return fallback;
  return Math.min(max, Math.max(min, n));
}

function pick<T extends string>(value: unknown, allowed: readonly T[], fallback: T): T {
  return allowed.includes(value as T) ? (value as T) : fallback;
}

/** Coerces untrusted JSON (a DB row or a request body) into valid settings, falling back to the default per field. */
export function parseWatermarkSettings(value: unknown): WatermarkSettings {
  const raw = value && typeof value === 'object' && !Array.isArray(value) ? (value as Record<string, unknown>) : {};
  const d = DEFAULT_WATERMARK_SETTINGS;
  const L = WATERMARK_LIMITS;

  const text =
    typeof raw.text === 'string' ? raw.text.replace(/\s+/g, ' ').trim().slice(0, L.textMaxLength) : d.text;
  const logoPath = typeof raw.logoUrl === 'string' ? toSitePath(raw.logoUrl) : '';
  const logoUrl = logoPath && isValidLogoPath(logoPath) ? logoPath : d.logoUrl;
  const textColor =
    typeof raw.textColor === 'string' && HEX_COLOR.test(raw.textColor) ? raw.textColor.toLowerCase() : d.textColor;

  return {
    enabled: raw.enabled === true,
    mode: pick(raw.mode, WATERMARK_MODES, d.mode),
    text,
    font: pick(raw.font, WATERMARK_FONTS, d.font),
    textColor,
    logoUrl,
    logoTone: pick(raw.logoTone, WATERMARK_LOGO_TONES, d.logoTone),
    position: pick(raw.position, WATERMARK_POSITIONS, d.position),
    opacity: Math.round(clamp(raw.opacity, L.opacity.min, L.opacity.max, d.opacity) * 100) / 100,
    size: Math.round(clamp(raw.size, L.size.min, L.size.max, d.size)),
    margin: Math.round(clamp(raw.margin, L.margin.min, L.margin.max, d.margin) * 2) / 2,
    includeCategoryImages: raw.includeCategoryImages === true,
    minImageWidth: Math.round(
      clamp(raw.minImageWidth, L.minImageWidth.min, L.minImageWidth.max, d.minImageWidth)
    ),
  };
}

export function usesLogo(settings: WatermarkSettings): boolean {
  return settings.mode === 'logo' || settings.mode === 'logo_text';
}

export function usesText(settings: WatermarkSettings): boolean {
  return (settings.mode === 'text' || settings.mode === 'logo_text') && settings.text.length > 0;
}
