// Decides how a stored product photo is served: watermarked (rendered once, then read from the
// disk cache) or as the untouched original. The uploaded file itself is never changed.

import { createHash } from 'crypto';
import { mkdir, readFile, rename, writeFile } from 'fs/promises';
import path from 'path';
import { applyWatermark, isWatermarkableExt, WATERMARKABLE_FORMATS, type WatermarkableExt } from './render';
import { isCategoryImagePath } from './settings';
import { getActiveWatermark, WATERMARK_CACHE_DIR, type ActiveWatermark } from './store';

/** Only product photos are watermarked. Logos and other uploads live in `media` and are never touched. */
const WATERMARK_BUCKET = 'products';

/**
 * Watermarked photos: a short browser cache so turning the watermark off (or changing it) reaches returning
 * visitors within five minutes; the ETag makes the re-check a cheap 304.
 * Clean photos while the watermark is off: an hour, so switching it on is picked up the same day.
 */
const WATERMARKED_CACHE = 'public, max-age=300, must-revalidate';
const CLEAN_CACHE = 'public, max-age=3600';
const ADMIN_CACHE = 'private, no-store';
const ERROR_CACHE = 'no-store';

/** Renders at most this many photos at once, so a cold cache on a busy page cannot starve the server. */
const MAX_PARALLEL_RENDERS = 2;

export type PreparedPhoto = {
  status: 200 | 304;
  body: Uint8Array | null;
  contentType: string;
  cacheControl: string;
  etag?: string;
  watermarked: boolean;
};

const inFlight = new Map<string, Promise<Buffer | null>>();
/** Photos that failed to render recently, so a broken file is not re-rendered on every request. */
const recentFailures = new Map<string, number>();
const FAILURE_BACKOFF_MS = 10 * 60_000;
let running = 0;
const waiting: Array<() => void> = [];

async function withRenderSlot<T>(job: () => Promise<T>): Promise<T> {
  if (running >= MAX_PARALLEL_RENDERS) await new Promise<void>((resolve) => waiting.push(resolve));
  running += 1;
  try {
    return await job();
  } finally {
    running -= 1;
    waiting.shift()?.();
  }
}

function hostOf(value: string | null): string {
  return (value || '').split(',')[0].trim().toLowerCase().replace(/^www\./, '');
}

/**
 * True when the photo is being shown inside the admin (product editor, lists, this screen), which should
 * always see the original. Browsers send the full page address as Referer for same-site requests.
 */
export function isAdminView(request: Request): boolean {
  const referer = request.headers.get('referer');
  if (!referer) return false;
  try {
    const url = new URL(referer);
    if (!url.pathname.startsWith('/admin')) return false;
    const requestHost = hostOf(request.headers.get('x-forwarded-host') || request.headers.get('host'));
    return !requestHost || hostOf(url.host) === requestHost;
  } catch {
    return false;
  }
}

async function renderCached(cacheKey: string, bytes: Buffer, ext: WatermarkableExt, active: ActiveWatermark) {
  const cachePath = path.join(WATERMARK_CACHE_DIR, cacheKey.slice(0, 2), `${cacheKey}.${ext}`);
  try {
    return await readFile(cachePath);
  } catch {
    // not rendered yet
  }

  const existing = inFlight.get(cacheKey);
  if (existing) return existing;

  const job = withRenderSlot(async () => {
    const output = await applyWatermark(bytes, ext, active.settings, active.logo);
    if (output) {
      try {
        await mkdir(path.dirname(cachePath), { recursive: true });
        const tmp = `${cachePath}.${process.pid}.${Date.now()}.tmp`;
        await writeFile(tmp, output);
        await rename(tmp, cachePath);
      } catch (err) {
        // A read-only or full disk only costs speed: keep serving the fresh render.
        console.error('[watermark] could not cache render', err);
      }
    }
    return output;
  }).finally(() => inFlight.delete(cacheKey));

  inFlight.set(cacheKey, job);
  return job;
}

/**
 * Returns how to serve a stored object, or null when it is not a product photo (the caller then serves it
 * exactly as before). Never throws: any failure serves the original.
 */
export async function prepareStoredPhoto(
  request: Request,
  bucket: string,
  objectPath: string,
  bytes: Buffer,
  storedType: string
): Promise<PreparedPhoto | null> {
  const ext = objectPath.split('.').pop()?.toLowerCase() || '';
  if (bucket !== WATERMARK_BUCKET || !isWatermarkableExt(ext)) return null;
  if (!storedType.startsWith('image/')) return null;

  const original = (cacheControl: string, etag?: string): PreparedPhoto => ({
    status: 200,
    body: new Uint8Array(bytes),
    contentType: storedType,
    cacheControl,
    etag,
    watermarked: false,
  });

  if (isAdminView(request)) return original(ADMIN_CACHE);

  try {
    const active = await getActiveWatermark();
    const { settings } = active;
    const applies = settings.enabled && (settings.includeCategoryImages || !isCategoryImagePath(objectPath));
    const contentHash = createHash('sha1').update(bytes).digest('hex');
    const etag = `"${applies ? `wm-${active.version}` : 'o'}-${contentHash.slice(0, 20)}"`;
    const cacheControl = applies ? WATERMARKED_CACHE : CLEAN_CACHE;

    const ifNoneMatch = request.headers.get('if-none-match') || '';
    if (ifNoneMatch.split(',').some((tag) => tag.trim().replace(/^W\//, '') === etag)) {
      return { status: 304, body: null, contentType: storedType, cacheControl, etag, watermarked: applies };
    }

    if (!applies) return original(cacheControl, etag);

    const cacheKey = createHash('sha1').update(`products|${objectPath}|${contentHash}|${active.version}|${ext}`).digest('hex');
    const failedAt = recentFailures.get(cacheKey);
    if (failedAt && Date.now() - failedAt < FAILURE_BACKOFF_MS) return original(ERROR_CACHE);

    let output: Buffer | null;
    try {
      output = await renderCached(cacheKey, bytes, ext, active);
    } catch (err) {
      if (recentFailures.size > 500) recentFailures.clear();
      recentFailures.set(cacheKey, Date.now());
      throw err;
    }
    if (!output) return original(cacheControl, etag);

    return {
      status: 200,
      body: new Uint8Array(output),
      contentType: WATERMARKABLE_FORMATS[ext],
      cacheControl,
      etag,
      watermarked: true,
    };
  } catch (err) {
    console.error('[watermark] render failed, serving original', objectPath, err);
    return original(ERROR_CACHE);
  }
}
