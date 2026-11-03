'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import type { WatermarkSettings } from '@/lib/watermark/settings';

const DEBOUNCE_MS = 300;

export type PreviewSample = { url: string; name: string };

type Props = {
  settings: WatermarkSettings;
  samples: PreviewSample[];
};

const WARNINGS: Record<string, string> = {
  'logo-missing': 'The logo file could not be read, so only the text is shown. Upload the logo again.',
  'font-missing': 'This server has no font for the text yet, so the text is left out. The logo still works.',
};

export default function WatermarkPreview({ settings, samples }: Props) {
  const [sample, setSample] = useState<string>(samples[0]?.url || '');
  const [view, setView] = useState<'watermarked' | 'original'>('watermarked');
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [warning, setWarning] = useState<string | null>(null);
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    if (!samples.some((s) => s.url === sample)) setSample(samples[0]?.url || '');
  }, [sample, samples]);

  // Keep exactly one object URL alive at a time.
  const urlRef = useRef<string | null>(null);
  useEffect(() => {
    if (urlRef.current && urlRef.current !== previewUrl) URL.revokeObjectURL(urlRef.current);
    urlRef.current = previewUrl;
  }, [previewUrl]);
  useEffect(
    () => () => {
      if (urlRef.current) URL.revokeObjectURL(urlRef.current);
    },
    []
  );

  useEffect(() => {
    if (!sample) return;
    const controller = new AbortController();

    const timer = setTimeout(async () => {
      setLoading(true);
      setError(null);
      try {
        const {
          data: { session },
        } = await supabase.auth.getSession();
        const res = await fetch('/api/admin/watermark/preview', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
          },
          credentials: 'include',
          cache: 'no-store',
          body: JSON.stringify({ settings, sample }),
          signal: controller.signal,
        });
        if (!res.ok) {
          const json = await res.json().catch(() => ({}));
          throw new Error(json?.error || 'Could not draw the preview.');
        }
        const note = res.headers.get('X-Watermark-Warning');
        setWarning(note ? WARNINGS[note] || null : null);
        setPreviewUrl(URL.createObjectURL(await res.blob()));
      } catch (err) {
        if (!controller.signal.aborted) setError(err instanceof Error ? err.message : 'Could not draw the preview.');
      } finally {
        if (!controller.signal.aborted) setLoading(false);
      }
    }, DEBOUNCE_MS);

    return () => {
      clearTimeout(timer);
      controller.abort();
    };
  }, [settings, sample, attempt]);

  const retry = useCallback(() => setAttempt((n) => n + 1), []);
  const current = samples.find((s) => s.url === sample);

  return (
    <section className="rounded-xl border border-gray-200 bg-white p-4 shadow-sm sm:p-5">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div className="min-w-0">
          <h2 className="font-semibold text-gray-900">Live preview</h2>
          <p className="truncate text-xs text-gray-500">{current ? current.name : 'A real product photo from your shop'}</p>
        </div>
        {samples.length > 0 && (
          <div className="inline-flex shrink-0 rounded-lg bg-gray-100 p-0.5 text-xs font-medium" role="group" aria-label="Preview view">
            {(['watermarked', 'original'] as const).map((v) => (
              <button
                key={v}
                type="button"
                onClick={() => setView(v)}
                aria-pressed={view === v}
                className={`rounded-md px-2.5 py-1.5 transition-colors ${
                  view === v ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-600 hover:text-gray-900'
                }`}
              >
                {v === 'watermarked' ? 'With watermark' : 'Original'}
              </button>
            ))}
          </div>
        )}
      </div>

      <div className="relative aspect-square w-full overflow-hidden rounded-lg border border-gray-100 bg-gray-50">
        {samples.length === 0 ? (
          <div className="flex h-full flex-col items-center justify-center px-6 text-center">
            <i className="ri-image-add-line text-3xl text-gray-300" aria-hidden />
            <p className="mt-2 text-sm font-medium text-gray-700">No product photos to preview yet</p>
            <p className="mt-1 text-xs text-gray-500">Add a product with a photo, then come back here to see the watermark on it.</p>
          </div>
        ) : view === 'original' ? (
          // The admin always receives the original file, so this is the photo exactly as uploaded.
          // eslint-disable-next-line @next/next/no-img-element
          <img src={sample} alt={`${current?.name || 'Product'} without the watermark`} className="h-full w-full object-contain" />
        ) : previewUrl ? (
          // eslint-disable-next-line @next/next/no-img-element
          <img
            src={previewUrl}
            alt={`${current?.name || 'Product'} with the watermark`}
            className={`h-full w-full object-contain transition-opacity duration-200 ${loading ? 'opacity-70' : 'opacity-100'}`}
          />
        ) : error ? null : (
          <div className="h-full w-full animate-pulse bg-gray-100" aria-label="Drawing preview" />
        )}

        {view === 'watermarked' && loading && previewUrl && (
          <span className="absolute right-2 top-2 inline-flex items-center gap-1 rounded-full bg-white/90 px-2 py-1 text-xs font-medium text-gray-700 shadow-sm">
            <i className="ri-loader-4-line animate-spin" aria-hidden /> Updating
          </span>
        )}

        {view === 'watermarked' && error && (
          <div className="absolute inset-0 flex flex-col items-center justify-center bg-white/90 px-6 text-center">
            <i className="ri-error-warning-line text-2xl text-red-600" aria-hidden />
            <p className="mt-2 text-sm text-red-800">{error}</p>
            <button
              type="button"
              onClick={retry}
              className="mt-3 rounded-lg border border-gray-300 px-3 py-1.5 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Try again
            </button>
          </div>
        )}
      </div>

      {warning && view === 'watermarked' && (
        <p className="mt-3 flex gap-2 rounded-lg border border-amber-200 bg-amber-50 p-3 text-xs text-amber-900">
          <i className="ri-information-line mt-px text-amber-600" aria-hidden />
          {warning}
        </p>
      )}

      {samples.length > 1 && (
        <div className="mt-4">
          <p className="mb-2 text-xs font-medium text-gray-500">Try another photo</p>
          <div className="grid grid-cols-4 gap-2">
            {samples.map((s) => (
              <button
                key={s.url}
                type="button"
                onClick={() => setSample(s.url)}
                aria-label={`Preview on ${s.name}`}
                aria-pressed={s.url === sample}
                title={s.name}
                className={`aspect-square overflow-hidden rounded-lg border-2 bg-gray-50 transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-700 focus-visible:ring-offset-1 ${
                  s.url === sample ? 'border-blue-700' : 'border-transparent hover:border-gray-300'
                }`}
              >
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={s.url} alt="" className="h-full w-full object-cover" loading="lazy" />
              </button>
            ))}
          </div>
        </div>
      )}

      <p className="mt-4 text-xs leading-relaxed text-gray-500">
        Your photos are never changed. The watermark is added as each photo is shown on the website, so you can change it or
        turn it off at any time. The admin always shows the originals.
      </p>
    </section>
  );
}
