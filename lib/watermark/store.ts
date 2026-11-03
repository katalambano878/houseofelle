// Watermark settings in site_settings, the logo file, and the on-disk cache of rendered photos.

import { createHash } from 'crypto';
import { access, readFile, rm } from 'fs/promises';
import path from 'path';
import { query } from '@/lib/db/pool';
import { readObject } from '@/lib/db/storage';
import {
  DEFAULT_WATERMARK_SETTINGS,
  WATERMARK_SETTINGS_KEY,
  isMediaLogo,
  isValidLogoPath,
  parseWatermarkSettings,
  usesLogo,
  type WatermarkSettings,
} from './settings';

/** How long a server keeps the settings in memory before checking the database again. */
const SETTINGS_TTL_MS = 15_000;

const PUBLIC_ROOT = path.join(process.cwd(), 'public');
const STORAGE_ROOT = process.env.STORAGE_ROOT || path.join(process.cwd(), '.storage');

/**
 * Rendered photos live beside the uploads (same persistent volume) so they survive redeploys.
 * The folder name starts with a dot, which is not a valid bucket name, so it can never be served directly.
 */
export const WATERMARK_CACHE_DIR = process.env.WATERMARK_CACHE_DIR || path.join(STORAGE_ROOT, '.watermark-cache');

export type ActiveWatermark = {
  settings: WatermarkSettings;
  logo: Buffer | null;
  /** Changes whenever the settings or the logo file change; part of every cache key and ETag. */
  version: string;
};

let active: { value: ActiveWatermark; loadedAt: number } | null = null;
let loading: Promise<ActiveWatermark> | null = null;

function resolvePublicFile(sitePath: string): string | null {
  const full = path.join(PUBLIC_ROOT, ...sitePath.split('/').filter(Boolean));
  return full.startsWith(PUBLIC_ROOT + path.sep) ? full : null;
}

/** Reads the logo from public/ or from the media bucket. Returns null when it is missing or not allowed. */
export async function loadLogo(sitePath: string): Promise<Buffer | null> {
  if (!isValidLogoPath(sitePath)) return null;
  try {
    if (isMediaLogo(sitePath)) {
      const objectPath = decodeURIComponent(sitePath.slice('/storage/v1/object/public/media/'.length));
      const obj = await readObject('media', objectPath);
      return obj?.bytes ?? null;
    }
    const full = resolvePublicFile(sitePath);
    return full ? await readFile(full) : null;
  } catch (err) {
    console.error('[watermark] logo not readable', sitePath, err);
    return null;
  }
}

/** True when a product photo exists on this server's disk (used to pick preview samples). */
export async function productPhotoExists(objectPath: string): Promise<boolean> {
  const base = path.resolve(STORAGE_ROOT, 'products');
  const full = path.resolve(base, objectPath.replace(/^\/+/, ''));
  if (!full.startsWith(base + path.sep)) return false;
  return access(full).then(
    () => true,
    () => false
  );
}

/** Reads a product photo by its path inside the products bucket. */
export async function loadProductPhoto(objectPath: string): Promise<Buffer | null> {
  const obj = await readObject('products', objectPath);
  return obj?.bytes ?? null;
}

export async function buildActiveWatermark(settings: WatermarkSettings): Promise<ActiveWatermark> {
  const logo = settings.enabled && usesLogo(settings) ? await loadLogo(settings.logoUrl) : null;
  const version = createHash('sha1')
    .update(JSON.stringify(settings))
    .update(logo ? createHash('sha1').update(logo).digest('hex') : 'no-logo')
    .digest('hex')
    .slice(0, 16);
  return { settings, logo, version };
}

export async function readWatermarkSettings(): Promise<{ settings: WatermarkSettings; updatedAt: string | null }> {
  const { rows } = await query<{ value: unknown; updated_at: string | null }>(
    `SELECT value, updated_at FROM site_settings WHERE key = $1 LIMIT 1`,
    [WATERMARK_SETTINGS_KEY]
  );
  return {
    settings: parseWatermarkSettings(rows[0]?.value ?? DEFAULT_WATERMARK_SETTINGS),
    updatedAt: rows[0]?.updated_at ?? null,
  };
}

/** Current watermark for serving photos. Never throws: if the database is down, photos are served clean. */
export async function getActiveWatermark(): Promise<ActiveWatermark> {
  if (active && Date.now() - active.loadedAt < SETTINGS_TTL_MS) return active.value;
  if (!loading) {
    loading = readWatermarkSettings()
      .then(({ settings }) => buildActiveWatermark(settings))
      .then((value) => {
        active = { value, loadedAt: Date.now() };
        return value;
      })
      .catch((err) => {
        console.error('[watermark] could not load settings, serving photos clean', err);
        const fallback = active?.value ?? {
          settings: { ...DEFAULT_WATERMARK_SETTINGS, enabled: false },
          logo: null,
          version: 'off',
        };
        // Try again soon rather than on every request.
        active = { value: fallback, loadedAt: Date.now() - SETTINGS_TTL_MS + 5_000 };
        return fallback;
      })
      .finally(() => {
        loading = null;
      });
  }
  return loading;
}

export async function saveWatermarkSettings(settings: WatermarkSettings): Promise<void> {
  await query(
    `INSERT INTO site_settings (key, value, category)
     VALUES ($1, $2::jsonb, 'branding')
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value, updated_at = now()`,
    [WATERMARK_SETTINGS_KEY, JSON.stringify(settings)]
  );
  active = null;
  // Old renders are already unreachable (the version is in every cache key); this frees the disk.
  await rm(WATERMARK_CACHE_DIR, { recursive: true, force: true }).catch((err) =>
    console.error('[watermark] cache purge failed', err)
  );
}
