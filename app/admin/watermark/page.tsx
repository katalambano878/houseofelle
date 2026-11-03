'use client';

import { useCallback, useEffect, useRef, useState } from 'react';
import { adminFetch } from '@/lib/admin-fetch';
import { supabase } from '@/lib/supabase';
import WatermarkPreview, { type PreviewSample } from '@/components/admin/WatermarkPreview';
import {
  DEFAULT_LOGO_URL,
  DEFAULT_WATERMARK_SETTINGS,
  WATERMARK_LIMITS,
  toSitePath,
  type WatermarkFont,
  type WatermarkLogoTone,
  type WatermarkMode,
  type WatermarkPosition,
  type WatermarkSettings,
} from '@/lib/watermark/settings';

const MAX_LOGO_BYTES = 5 * 1024 * 1024;
const LOGO_TYPES: Record<string, string> = { 'image/png': 'png', 'image/jpeg': 'jpg', 'image/webp': 'webp' };

const MODES: { value: WatermarkMode; label: string; icon: string }[] = [
  { value: 'logo', label: 'Logo', icon: 'ri-image-line' },
  { value: 'text', label: 'Text', icon: 'ri-text' },
  { value: 'logo_text', label: 'Logo + text', icon: 'ri-layout-top-2-line' },
];

const GRID: { value: WatermarkPosition; label: string }[] = [
  { value: 'top-left', label: 'Top left' },
  { value: 'top-center', label: 'Top centre' },
  { value: 'top-right', label: 'Top right' },
  { value: 'center-left', label: 'Middle left' },
  { value: 'center', label: 'Centre' },
  { value: 'center-right', label: 'Middle right' },
  { value: 'bottom-left', label: 'Bottom left' },
  { value: 'bottom-center', label: 'Bottom centre' },
  { value: 'bottom-right', label: 'Bottom right' },
];

const LOGO_TONES: { value: WatermarkLogoTone; label: string; swatch: string }[] = [
  { value: 'original', label: 'Original', swatch: 'bg-[conic-gradient(#C89B3C_0_33%,#2A2623_0_66%,#F5EDE4_0)]' },
  { value: 'white', label: 'White', swatch: 'bg-white' },
  { value: 'black', label: 'Black', swatch: 'bg-gray-900' },
];

const FONTS: { value: WatermarkFont; label: string; sample: string }[] = [
  { value: 'serif', label: 'Classic', sample: 'font-serif' },
  { value: 'sans', label: 'Modern', sample: 'font-sans' },
];

const TEXT_COLOURS = [
  { value: '#ffffff', label: 'White' },
  { value: '#0a0a0a', label: 'Black' },
  { value: '#c89b3c', label: 'Gold' },
  { value: '#6b4f3a', label: 'Brown' },
];

const card = 'rounded-xl border border-gray-200 bg-white p-4 shadow-sm sm:p-5';
const segmentBase =
  'flex items-center justify-center gap-2 rounded-lg border px-3 py-2.5 text-sm font-medium transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-700 focus-visible:ring-offset-1';
const segmentOn = 'border-blue-700 bg-blue-700 text-white';
const segmentOff = 'border-gray-200 bg-white text-gray-700 hover:border-gray-300 hover:bg-gray-50';

function Slider(props: {
  id: string;
  label: string;
  hint?: string;
  value: number;
  min: number;
  max: number;
  step: number;
  display: string;
  onChange: (v: number) => void;
}) {
  return (
    <div>
      <div className="flex items-baseline justify-between gap-3">
        <label htmlFor={props.id} className="text-sm font-medium text-gray-700">
          {props.label}
        </label>
        <span className="text-sm tabular-nums text-gray-500">{props.display}</span>
      </div>
      <input
        id={props.id}
        type="range"
        min={props.min}
        max={props.max}
        step={props.step}
        value={props.value}
        onChange={(e) => props.onChange(Number(e.target.value))}
        className="mt-2 h-2 w-full cursor-pointer accent-blue-700"
      />
      {props.hint && <p className="mt-1 text-xs text-gray-500">{props.hint}</p>}
    </div>
  );
}

function formatSaved(iso: string | null): string {
  if (!iso) return 'Not set up yet';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return `Last saved ${d.toLocaleString('en-GH', { day: 'numeric', month: 'short', hour: 'numeric', minute: '2-digit' })}`;
}

export default function WatermarkPage() {
  const [settings, setSettings] = useState<WatermarkSettings | null>(null);
  const [saved, setSaved] = useState<WatermarkSettings | null>(null);
  const [updatedAt, setUpdatedAt] = useState<string | null>(null);
  const [samples, setSamples] = useState<PreviewSample[]>([]);
  const [loadError, setLoadError] = useState('');
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [notice, setNotice] = useState<{ kind: 'ok' | 'error'; text: string } | null>(null);
  const fileInput = useRef<HTMLInputElement>(null);

  const load = useCallback(async () => {
    setLoadError('');
    try {
      const data = await adminFetch<{ settings: WatermarkSettings; updatedAt: string | null; samples: PreviewSample[] }>(
        '/api/admin/watermark'
      );
      setSettings(data.settings);
      setSaved(data.settings);
      setUpdatedAt(data.updatedAt);
      setSamples(data.samples);
    } catch (err) {
      setLoadError(err instanceof Error ? err.message : 'Could not load the watermark settings.');
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const dirty = settings !== null && saved !== null && JSON.stringify(settings) !== JSON.stringify(saved);

  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => {
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  const update = (patch: Partial<WatermarkSettings>) => setSettings((s) => (s ? { ...s, ...patch } : s));

  async function save() {
    if (!settings) return;
    setSaving(true);
    setNotice(null);
    try {
      const data = await adminFetch<{ settings: WatermarkSettings; updatedAt: string; message: string }>(
        '/api/admin/watermark',
        { method: 'PUT', body: JSON.stringify({ settings }) }
      );
      setSettings(data.settings);
      setSaved(data.settings);
      setUpdatedAt(data.updatedAt);
      setNotice({ kind: 'ok', text: data.message });
    } catch (err) {
      setNotice({ kind: 'error', text: err instanceof Error ? err.message : 'Could not save. Try again.' });
    } finally {
      setSaving(false);
    }
  }

  async function uploadLogo(file: File) {
    const ext = LOGO_TYPES[file.type];
    if (!ext) {
      setNotice({ kind: 'error', text: 'Use a PNG, JPG or WebP logo. A PNG with a see-through background looks best.' });
      return;
    }
    if (file.size > MAX_LOGO_BYTES) {
      setNotice({ kind: 'error', text: 'That logo is over 5 MB. Please use a smaller file.' });
      return;
    }
    setUploading(true);
    setNotice(null);
    try {
      const path = `watermark/logo-${Date.now()}.${ext}`;
      const result = await supabase.storage.from('media').upload(path, file, { contentType: file.type });
      if (result.error || !result.data?.path) throw new Error(result.error?.message || 'Logo upload failed.');
      const url = toSitePath(supabase.storage.from('media').getPublicUrl(result.data.path).data.publicUrl);
      update({ logoUrl: url });
      setNotice({ kind: 'ok', text: 'Logo uploaded. Check the preview, then save.' });
    } catch (err) {
      setNotice({ kind: 'error', text: err instanceof Error ? err.message : 'Logo upload failed.' });
    } finally {
      setUploading(false);
      if (fileInput.current) fileInput.current.value = '';
    }
  }

  if (!settings) {
    return (
      <div className="max-w-6xl space-y-6">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Image watermark</h1>
          <p className="mt-1 text-gray-600">Put the House of Elle logo or name on product photos.</p>
        </div>
        {loadError ? (
          <div className={`${card} text-center`}>
            <i className="ri-error-warning-line text-2xl text-red-600" aria-hidden />
            <p className="mt-2 text-sm text-red-800">{loadError}</p>
            <button
              type="button"
              onClick={load}
              className="mt-4 rounded-lg border border-gray-300 px-4 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
            >
              Try again
            </button>
          </div>
        ) : (
          <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_400px]" aria-busy="true" aria-label="Loading watermark settings">
            <div className="space-y-4">
              {[80, 220, 260].map((h) => (
                <div key={h} className={`${card} animate-pulse`} style={{ height: h }}>
                  <div className="h-4 w-40 rounded bg-gray-100" />
                  <div className="mt-3 h-3 w-64 max-w-full rounded bg-gray-100" />
                </div>
              ))}
            </div>
            <div className={`${card} aspect-square animate-pulse`}>
              <div className="h-full w-full rounded-lg bg-gray-100" />
            </div>
          </div>
        )}
      </div>
    );
  }

  const showLogo = settings.mode !== 'text';
  const showText = settings.mode !== 'logo';
  const L = WATERMARK_LIMITS;
  const usingStoreLogo = settings.logoUrl === DEFAULT_LOGO_URL;

  return (
    <div className="max-w-6xl space-y-6">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="flex flex-wrap items-center gap-3">
            <h1 className="text-3xl font-bold text-gray-900">Image watermark</h1>
            <span
              className={`inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-semibold ${
                saved?.enabled ? 'border-green-200 bg-green-50 text-green-800' : 'border-gray-200 bg-gray-50 text-gray-600'
              }`}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${saved?.enabled ? 'bg-green-600' : 'bg-gray-400'}`} aria-hidden />
              {saved?.enabled ? 'On for the website' : 'Off'}
            </span>
          </div>
          <p className="mt-1 text-gray-600">
            Put the House of Elle logo or name on product photos, so copied photos still point back to you.
          </p>
          <p className="mt-1 text-xs text-gray-400">{formatSaved(updatedAt)}</p>
        </div>
        <button
          type="button"
          onClick={save}
          disabled={!dirty || saving}
          className="hidden h-11 items-center justify-center gap-2 self-start rounded-lg bg-blue-700 px-5 text-sm font-semibold text-white shadow-sm transition-colors hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50 sm:inline-flex"
        >
          <i className={saving ? 'ri-loader-4-line animate-spin' : dirty ? 'ri-save-3-line' : 'ri-check-line'} aria-hidden />
          {saving ? 'Saving…' : dirty ? 'Save watermark' : 'Saved'}
        </button>
      </div>

      {notice && (
        <div
          role={notice.kind === 'error' ? 'alert' : 'status'}
          className={`flex items-start gap-2 rounded-lg border p-4 text-sm ${
            notice.kind === 'ok' ? 'border-green-100 bg-green-50 text-green-800' : 'border-red-100 bg-red-50 text-red-800'
          }`}
        >
          <i
            className={`${notice.kind === 'ok' ? 'ri-checkbox-circle-fill text-green-600' : 'ri-error-warning-fill text-red-600'} mt-px`}
            aria-hidden
          />
          <span className="flex-1">{notice.text}</span>
          <button type="button" onClick={() => setNotice(null)} aria-label="Dismiss" className="text-current opacity-60 hover:opacity-100">
            <i className="ri-close-line" aria-hidden />
          </button>
        </div>
      )}

      <div className="grid gap-6 xl:grid-cols-[minmax(0,1fr)_400px]">
        <div className="space-y-4">
          {/* On / off */}
          <section className={`${card} flex items-center justify-between gap-4`}>
            <div>
              <p className="font-semibold text-gray-900">Show the watermark on the website</p>
              <p className="mt-0.5 text-sm text-gray-500">
                {settings.enabled
                  ? 'On. Product photos in the shop carry the watermark.'
                  : 'Off. Product photos show exactly as uploaded.'}
              </p>
            </div>
            <button
              type="button"
              role="switch"
              aria-checked={settings.enabled}
              aria-label="Show the watermark on the website"
              onClick={() => update({ enabled: !settings.enabled })}
              className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-700 focus-visible:ring-offset-2 ${
                settings.enabled ? 'bg-blue-700' : 'bg-gray-300'
              }`}
            >
              <span
                className={`inline-block h-6 w-6 rounded-full bg-white shadow transition-transform duration-200 ${
                  settings.enabled ? 'translate-x-[1.375rem]' : 'translate-x-0.5'
                }`}
              />
            </button>
          </section>

          {/* What to show */}
          <section className={`${card} space-y-5`}>
            <div>
              <h2 className="font-semibold text-gray-900">What to show</h2>
              <div className="mt-3 grid grid-cols-3 gap-2" role="group" aria-label="What to show">
                {MODES.map((m) => (
                  <button
                    key={m.value}
                    type="button"
                    onClick={() => update({ mode: m.value })}
                    aria-pressed={settings.mode === m.value}
                    className={`${segmentBase} ${settings.mode === m.value ? segmentOn : segmentOff}`}
                  >
                    <i className={`${m.icon} hidden sm:inline`} aria-hidden /> {m.label}
                  </button>
                ))}
              </div>
            </div>

            {showLogo && (
              <div className="space-y-4 border-t border-gray-100 pt-5">
                <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                  <div className="flex h-20 w-full shrink-0 items-center justify-center rounded-lg border border-gray-200 bg-[repeating-conic-gradient(#f3f4f6_0%_25%,#ffffff_0%_50%)] bg-[length:16px_16px] p-2 sm:w-36">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={settings.logoUrl} alt="Watermark logo" className="max-h-full max-w-full object-contain" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="text-sm font-medium text-gray-800">{usingStoreLogo ? 'Store logo' : 'Your uploaded logo'}</p>
                    <p className="mt-0.5 text-xs text-gray-500">A PNG with a see-through background looks best.</p>
                    <div className="mt-2 flex flex-wrap gap-2">
                      <input
                        ref={fileInput}
                        type="file"
                        accept="image/png,image/jpeg,image/webp"
                        className="hidden"
                        onChange={(e) => e.target.files?.[0] && uploadLogo(e.target.files[0])}
                      />
                      <button
                        type="button"
                        onClick={() => fileInput.current?.click()}
                        disabled={uploading}
                        className="inline-flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50 disabled:opacity-50"
                      >
                        <i className={uploading ? 'ri-loader-4-line animate-spin' : 'ri-upload-2-line'} aria-hidden />
                        {uploading ? 'Uploading…' : 'Upload a different logo'}
                      </button>
                      {!usingStoreLogo && (
                        <button
                          type="button"
                          onClick={() => update({ logoUrl: DEFAULT_LOGO_URL })}
                          className="rounded-lg px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50"
                        >
                          Use store logo
                        </button>
                      )}
                    </div>
                  </div>
                </div>

                <div>
                  <p className="text-sm font-medium text-gray-700">Logo colour</p>
                  <p className="text-xs text-gray-500">White or black keeps a dark logo readable on any photo.</p>
                  <div className="mt-2 grid grid-cols-3 gap-2" role="group" aria-label="Logo colour">
                    {LOGO_TONES.map((t) => (
                      <button
                        key={t.value}
                        type="button"
                        onClick={() => update({ logoTone: t.value })}
                        aria-pressed={settings.logoTone === t.value}
                        className={`${segmentBase} ${settings.logoTone === t.value ? 'border-blue-700 bg-blue-50 text-blue-800 ring-1 ring-blue-700' : segmentOff}`}
                      >
                        <span className={`h-4 w-4 shrink-0 rounded-full border border-gray-300 ${t.swatch}`} aria-hidden />
                        {t.label}
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {showText && (
              <div className="space-y-4 border-t border-gray-100 pt-5">
                <div>
                  <div className="flex items-baseline justify-between">
                    <label htmlFor="wm-text" className="text-sm font-medium text-gray-700">
                      Watermark text
                    </label>
                    <span className="text-xs tabular-nums text-gray-400">
                      {settings.text.length}/{L.textMaxLength}
                    </span>
                  </div>
                  <input
                    id="wm-text"
                    className="mt-1 w-full rounded-lg border border-gray-300 px-3 py-2.5 text-base text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 sm:text-sm"
                    value={settings.text}
                    maxLength={L.textMaxLength}
                    placeholder={DEFAULT_WATERMARK_SETTINGS.text}
                    onChange={(e) => update({ text: e.target.value })}
                  />
                  {settings.mode === 'logo_text' && (
                    <p className="mt-1 text-xs text-gray-500">Shown under the logo, e.g. your website or Instagram name.</p>
                  )}
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div>
                    <p className="text-sm font-medium text-gray-700">Letter style</p>
                    <div className="mt-2 grid grid-cols-2 gap-2" role="group" aria-label="Letter style">
                      {FONTS.map((f) => (
                        <button
                          key={f.value}
                          type="button"
                          onClick={() => update({ font: f.value })}
                          aria-pressed={settings.font === f.value}
                          className={`${segmentBase} ${settings.font === f.value ? segmentOn : segmentOff}`}
                        >
                          <span className={`${f.sample} text-base leading-none`} aria-hidden>
                            Aa
                          </span>
                          {f.label}
                        </button>
                      ))}
                    </div>
                  </div>
                  <div>
                    <p className="text-sm font-medium text-gray-700">Text colour</p>
                    <div className="mt-2 flex flex-wrap items-center gap-2" role="group" aria-label="Text colour">
                      {TEXT_COLOURS.map((c) => (
                        <button
                          key={c.value}
                          type="button"
                          onClick={() => update({ textColor: c.value })}
                          aria-pressed={settings.textColor === c.value}
                          aria-label={c.label}
                          title={c.label}
                          className={`h-10 w-10 rounded-full border-2 transition-shadow focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-700 focus-visible:ring-offset-2 ${
                            settings.textColor === c.value ? 'border-blue-700 ring-2 ring-blue-700 ring-offset-2' : 'border-gray-200'
                          }`}
                          style={{ backgroundColor: c.value }}
                        />
                      ))}
                      <label
                        className={`relative flex h-10 w-10 cursor-pointer items-center justify-center rounded-full border-2 ${
                          TEXT_COLOURS.some((c) => c.value === settings.textColor)
                            ? 'border-dashed border-gray-300 text-gray-500'
                            : 'border-blue-700 ring-2 ring-blue-700 ring-offset-2'
                        }`}
                        style={TEXT_COLOURS.some((c) => c.value === settings.textColor) ? undefined : { backgroundColor: settings.textColor }}
                        title="Pick any colour"
                      >
                        <span className="sr-only">Pick any colour</span>
                        {TEXT_COLOURS.some((c) => c.value === settings.textColor) && <i className="ri-palette-line" aria-hidden />}
                        <input
                          type="color"
                          value={settings.textColor}
                          onChange={(e) => update({ textColor: e.target.value.toLowerCase() })}
                          className="absolute inset-0 h-full w-full cursor-pointer opacity-0"
                        />
                      </label>
                    </div>
                  </div>
                </div>
              </div>
            )}
          </section>

          {/* Placement */}
          <section className={`${card} space-y-5`}>
            <h2 className="font-semibold text-gray-900">Placement</h2>
            <div className="grid gap-6 sm:grid-cols-[auto_minmax(0,1fr)]">
              <div>
                <p className="mb-2 text-sm font-medium text-gray-700">Position</p>
                <div className="flex items-start gap-3 sm:block">
                  <div className="grid w-32 shrink-0 grid-cols-3 gap-1.5 rounded-lg border border-gray-200 bg-gray-50 p-1.5" role="group" aria-label="Position on the photo">
                    {GRID.map((pos) => {
                      const on = settings.position === pos.value;
                      return (
                        <button
                          key={pos.value}
                          type="button"
                          onClick={() => update({ position: pos.value })}
                          aria-label={pos.label}
                          aria-pressed={on}
                          title={pos.label}
                          className={`flex aspect-square items-center justify-center rounded-md transition-colors focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-700 ${
                            on ? 'bg-blue-700' : 'bg-white hover:bg-blue-50'
                          }`}
                        >
                          <span className={`h-1.5 w-1.5 rounded-full ${on ? 'bg-white' : 'bg-gray-300'}`} aria-hidden />
                        </button>
                      );
                    })}
                  </div>
                  <button
                    type="button"
                    onClick={() => update({ position: 'tiled' })}
                    aria-pressed={settings.position === 'tiled'}
                    className={`${segmentBase} flex-1 text-xs sm:mt-2 sm:w-32 sm:flex-none ${settings.position === 'tiled' ? segmentOn : segmentOff}`}
                  >
                    <i className="ri-grid-line" aria-hidden /> Repeat across photo
                  </button>
                </div>
              </div>

              <div className="space-y-5">
                <Slider
                  id="wm-size"
                  label="Size"
                  value={settings.size}
                  min={L.size.min}
                  max={L.size.max}
                  step={1}
                  display={`${settings.size}% of photo width`}
                  onChange={(size) => update({ size })}
                />
                <Slider
                  id="wm-opacity"
                  label="Strength"
                  hint="Lower is more see-through."
                  value={settings.opacity}
                  min={L.opacity.min}
                  max={L.opacity.max}
                  step={0.05}
                  display={`${Math.round(settings.opacity * 100)}%`}
                  onChange={(opacity) => update({ opacity })}
                />
                {settings.position !== 'tiled' && (
                  <Slider
                    id="wm-margin"
                    label="Space from edge"
                    value={settings.margin}
                    min={L.margin.min}
                    max={L.margin.max}
                    step={0.5}
                    display={`${settings.margin}%`}
                    onChange={(margin) => update({ margin })}
                  />
                )}
              </div>
            </div>
          </section>

          {/* Scope */}
          <section className={`${card} space-y-4`}>
            <div>
              <h2 className="font-semibold text-gray-900">Which photos</h2>
              <p className="mt-0.5 text-sm text-gray-500">
                Product photos in the shop, on product pages, in search and in the cart. Logos, banners and the homepage pictures are never
                watermarked.
              </p>
            </div>
            <label className="flex cursor-pointer items-start gap-3 text-sm text-gray-800">
              <input
                type="checkbox"
                checked={settings.includeCategoryImages}
                onChange={(e) => update({ includeCategoryImages: e.target.checked })}
                className="mt-0.5 h-4 w-4 shrink-0 accent-blue-700"
              />
              <span>
                Also watermark category pictures
                <span className="block text-xs text-gray-500">The pictures on the category tiles. Usually left clean.</span>
              </span>
            </label>
            <div>
              <label htmlFor="wm-min" className="text-sm font-medium text-gray-700">
                Leave photos clean if they are narrower than
              </label>
              <div className="mt-1 flex items-center gap-2">
                <input
                  id="wm-min"
                  type="number"
                  inputMode="numeric"
                  className="w-28 rounded-lg border border-gray-300 px-3 py-2 text-base text-gray-900 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500 sm:text-sm"
                  min={L.minImageWidth.min}
                  max={L.minImageWidth.max}
                  value={settings.minImageWidth}
                  onChange={(e) => update({ minImageWidth: Math.max(0, Math.min(L.minImageWidth.max, Number(e.target.value) || 0)) })}
                />
                <span className="text-sm text-gray-500">pixels (keeps thumbnails tidy)</span>
              </div>
            </div>
          </section>
        </div>

        {/* On phones the preview comes first, so changes can be checked without scrolling to the bottom. */}
        <div className="order-first xl:sticky xl:top-6 xl:order-none xl:self-start">
          <WatermarkPreview settings={settings} samples={samples} />
        </div>
      </div>

      {/* Unsaved changes bar: sticks to the bottom of the screen while there is something to save. */}
      {dirty && (
        <div
          className="sticky bottom-0 z-20 -mx-4 border-t border-gray-200 bg-white/95 px-4 py-3 shadow-[0_-4px_16px_rgba(0,0,0,0.06)] backdrop-blur lg:-mx-6 lg:px-6"
          style={{ paddingBottom: 'max(0.75rem, env(safe-area-inset-bottom))' }}
        >
          <div className="mx-auto flex max-w-6xl items-center justify-between gap-3">
            <p className="text-sm text-gray-600">Changes not saved yet.</p>
            <div className="flex shrink-0 gap-2">
              <button
                type="button"
                onClick={() => saved && setSettings(saved)}
                disabled={saving}
                className="rounded-lg px-3 py-2 text-sm font-medium text-gray-600 hover:bg-gray-50 disabled:opacity-50"
              >
                Discard
              </button>
              <button
                type="button"
                onClick={save}
                disabled={saving}
                className="inline-flex h-10 items-center gap-2 rounded-lg bg-blue-700 px-4 text-sm font-semibold text-white shadow-sm hover:bg-blue-800 disabled:cursor-not-allowed disabled:opacity-50"
              >
                <i className={saving ? 'ri-loader-4-line animate-spin' : 'ri-save-3-line'} aria-hidden />
                {saving ? 'Saving…' : 'Save'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
