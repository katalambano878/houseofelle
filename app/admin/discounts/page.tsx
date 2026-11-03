'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { adminFetch } from '@/lib/admin-fetch';
import {
  CAMPAIGN_TEMPLATES,
  type CampaignRow,
  StatusPill,
  formatWhen,
  fromLocalInput,
  percentRange,
  timeLeft,
} from '@/components/admin/discounts/shared';

type Filter = 'all' | 'live' | 'scheduled' | 'draft' | 'ended';

const FILTERS: { key: Filter; label: string }[] = [
  { key: 'all', label: 'All' },
  { key: 'live', label: 'Live' },
  { key: 'scheduled', label: 'Scheduled' },
  { key: 'draft', label: 'Drafts' },
  { key: 'ended', label: 'Ended' },
];

export default function DiscountsPage() {
  const router = useRouter();
  const [campaigns, setCampaigns] = useState<CampaignRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [creating, setCreating] = useState(false);

  const load = async () => {
    setError('');
    try {
      const data = await adminFetch<{ campaigns: CampaignRow[] }>('/api/admin/discounts');
      setCampaigns(data.campaigns);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not load campaigns.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    load();
  }, []);

  const counts = useMemo(() => {
    const c: Record<Filter, number> = { all: campaigns.length, live: 0, scheduled: 0, draft: 0, ended: 0 };
    campaigns.forEach((x) => (c[x.status] += 1));
    return c;
  }, [campaigns]);

  const shown = filter === 'all' ? campaigns : campaigns.filter((c) => c.status === filter);
  const live = campaigns.find((c) => c.status === 'live');
  const announced = !live ? campaigns.find((c) => c.announce && (c.status === 'draft' || c.status === 'scheduled')) : undefined;
  const onSaleNow = live?.applied_count ?? 0;

  return (
    <div className="max-w-7xl mx-auto">
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl sm:text-3xl font-bold text-gray-900">Discounts &amp; Sales</h1>
          <p className="text-gray-600 mt-1 max-w-2xl">
            Run a sale like Black Friday: choose products, give each its own discount, and announce it with the moving
            banner and welcome popup. Prices change on the website and in the POS while the sale is live, and go back when it ends.
          </p>
        </div>
        <button
          type="button"
          onClick={() => setCreating(true)}
          className="inline-flex items-center justify-center gap-2 px-5 py-2.5 rounded-lg bg-blue-700 hover:bg-blue-800 text-white font-semibold transition-colors cursor-pointer shrink-0"
        >
          <i className="ri-add-line text-lg" aria-hidden="true" /> New campaign
        </button>
      </div>

      {!loading && !error && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 sm:gap-4 mb-6">
          <Stat label="Live now" value={live ? live.name : 'None'} icon="ri-broadcast-line" tone={live ? 'green' : 'gray'} />
          <Stat label="Products on sale" value={String(onSaleNow)} icon="ri-price-tag-3-line" tone="blue" />
          <Stat label="Scheduled" value={String(counts.scheduled)} icon="ri-time-line" tone="amber" />
          <Stat
            label="Storefront banner"
            value={live?.banner_enabled || announced?.banner_enabled ? 'Showing' : 'Off'}
            icon="ri-megaphone-line"
            tone={live?.banner_enabled || announced?.banner_enabled ? 'blue' : 'gray'}
          />
        </div>
      )}

      {(live || announced) && (
        <FeaturedCampaign campaign={(live || announced)!} />
      )}

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
        <div className="px-4 sm:px-6 pt-4 border-b border-gray-200 flex gap-1 overflow-x-auto" role="tablist" aria-label="Filter campaigns">
          {FILTERS.map((f) => (
            <button
              key={f.key}
              type="button"
              role="tab"
              aria-selected={filter === f.key}
              onClick={() => setFilter(f.key)}
              className={`shrink-0 px-3 sm:px-4 py-2.5 text-sm font-semibold border-b-2 -mb-px transition-colors cursor-pointer ${
                filter === f.key ? 'border-blue-700 text-blue-700' : 'border-transparent text-gray-500 hover:text-gray-800'
              }`}
            >
              {f.label}
              <span className="ml-1.5 text-xs tabular-nums text-gray-400">{counts[f.key]}</span>
            </button>
          ))}
        </div>

        {loading ? (
          <div className="divide-y divide-gray-100" aria-busy="true">
            {Array.from({ length: 3 }).map((_, i) => (
              <div key={i} className="p-5 flex items-center gap-4 animate-pulse">
                <div className="w-11 h-11 rounded-xl bg-gray-100" />
                <div className="flex-1 space-y-2">
                  <div className="h-4 w-48 bg-gray-100 rounded" />
                  <div className="h-3 w-72 max-w-full bg-gray-100 rounded" />
                </div>
              </div>
            ))}
          </div>
        ) : error ? (
          <div className="p-10 text-center">
            <p className="text-red-600 mb-4">{error}</p>
            <button
              type="button"
              onClick={() => {
                setLoading(true);
                load();
              }}
              className="px-4 py-2 border-2 border-gray-300 rounded-lg font-semibold text-gray-700 hover:bg-gray-50 cursor-pointer"
            >
              Try again
            </button>
          </div>
        ) : shown.length === 0 ? (
          <div className="p-12 text-center">
            <div className="w-14 h-14 mx-auto rounded-full bg-blue-50 flex items-center justify-center">
              <i className="ri-price-tag-3-line text-2xl text-blue-700" aria-hidden="true" />
            </div>
            <p className="mt-4 font-semibold text-gray-900">
              {filter === 'all' ? 'No campaigns yet' : `No ${FILTERS.find((f) => f.key === filter)!.label.toLowerCase()} campaigns`}
            </p>
            {filter === 'all' && (
              <p className="mt-1 text-sm text-gray-500">Create one to put products on sale and announce it on the website.</p>
            )}
          </div>
        ) : (
          <ul className="divide-y divide-gray-100">
            {shown.map((c) => (
              <li key={c.id}>
                <Link
                  href={`/admin/discounts/${c.id}`}
                  className="flex flex-col sm:flex-row sm:items-center gap-3 sm:gap-5 px-4 sm:px-6 py-4 hover:bg-gray-50 transition-colors"
                >
                  <div className="flex items-center gap-4 flex-1 min-w-0">
                    <div
                      className={`w-11 h-11 rounded-xl flex items-center justify-center shrink-0 ${
                        c.status === 'live' ? 'bg-green-100 text-green-700' : 'bg-blue-50 text-blue-700'
                      }`}
                    >
                      <i className="ri-price-tag-3-line text-xl" aria-hidden="true" />
                    </div>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 flex-wrap">
                        <p className="font-semibold text-gray-900 truncate">{c.name}</p>
                        <StatusPill status={c.status} announced={c.announce} />
                      </div>
                      <p className="text-sm text-gray-500 mt-0.5 truncate">
                        {c.status === 'live'
                          ? c.ends_at
                            ? `Ends ${formatWhen(c.ends_at)}`
                            : 'Runs until you end it'
                          : c.status === 'scheduled'
                            ? `Starts ${formatWhen(c.starts_at)}`
                            : c.status === 'ended'
                              ? `Ended ${formatWhen(c.ended_at || c.ends_at)}`
                              : `Edited ${formatWhen(c.updated_at)}`}
                      </p>
                    </div>
                  </div>
                  <div className="flex items-center gap-6 sm:gap-8 pl-[3.75rem] sm:pl-0 text-sm">
                    <div>
                      <p className="text-gray-500 text-xs">Products</p>
                      <p className="font-semibold text-gray-900 tabular-nums">{c.product_count ?? 0}</p>
                    </div>
                    <div>
                      <p className="text-gray-500 text-xs">Discount</p>
                      <p className="font-semibold text-gray-900 tabular-nums whitespace-nowrap">
                        {percentRange(c.min_percent, c.max_percent)}
                      </p>
                    </div>
                    <i className="ri-arrow-right-s-line text-xl text-gray-400 hidden sm:block" aria-hidden="true" />
                  </div>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </div>

      {creating && (
        <CreateDialog
          existing={campaigns}
          onClose={() => setCreating(false)}
          onCreated={(id) => router.push(`/admin/discounts/${id}`)}
        />
      )}
    </div>
  );
}

function Stat({ label, value, icon, tone }: { label: string; value: string; icon: string; tone: 'green' | 'blue' | 'amber' | 'gray' }) {
  const tones = {
    green: 'bg-green-100 text-green-700',
    blue: 'bg-blue-100 text-blue-700',
    amber: 'bg-amber-100 text-amber-700',
    gray: 'bg-gray-100 text-gray-500',
  };
  return (
    <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4 flex items-center gap-3 min-w-0">
      <div className={`w-10 h-10 rounded-lg flex items-center justify-center shrink-0 ${tones[tone]}`}>
        <i className={`${icon} text-lg`} aria-hidden="true" />
      </div>
      <div className="min-w-0">
        <p className="text-xs text-gray-500">{label}</p>
        <p className="font-bold text-gray-900 truncate tabular-nums">{value}</p>
      </div>
    </div>
  );
}

function FeaturedCampaign({ campaign: c }: { campaign: CampaignRow }) {
  const [, tick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => tick((n) => n + 1), 30_000);
    return () => clearInterval(t);
  }, []);
  const left = c.status === 'live' ? timeLeft(c.ends_at) : timeLeft(c.starts_at);
  return (
    <div className="relative overflow-hidden rounded-xl bg-blue-800 text-white mb-6">
      <svg className="absolute -right-12 -top-12 w-56 h-56 text-blue-500/20" viewBox="0 0 200 200" fill="none" aria-hidden="true">
        <circle cx="100" cy="100" r="98" stroke="currentColor" />
        <circle cx="100" cy="100" r="72" stroke="currentColor" />
        <circle cx="100" cy="100" r="46" stroke="currentColor" />
      </svg>
      <div className="relative p-5 sm:p-6 flex flex-col md:flex-row md:items-center gap-5">
        <div className="flex-1 min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.25em] text-blue-500">
            {c.status === 'live' ? 'Live on the website' : 'Announced on the website'}
          </p>
          <h2 className="mt-2 text-2xl font-serif truncate">{c.name}</h2>
          <p className="mt-1 text-sm text-white/70 truncate">{c.banner_text || 'No banner text'}</p>
        </div>
        <div className="flex items-center gap-6 sm:gap-8">
          <div>
            <p className="text-xs text-white/60">Products</p>
            <p className="text-xl font-bold tabular-nums">{c.status === 'live' ? c.applied_count : c.product_count}</p>
          </div>
          <div>
            <p className="text-xs text-white/60">Discount</p>
            <p className="text-xl font-bold tabular-nums whitespace-nowrap">{percentRange(c.min_percent, c.max_percent).replace(' off', '')}</p>
          </div>
          {left && (
            <div>
              <p className="text-xs text-white/60">{c.status === 'live' ? 'Ends in' : 'Starts in'}</p>
              <p className="text-xl font-bold tabular-nums whitespace-nowrap">{left}</p>
            </div>
          )}
        </div>
        <Link
          href={`/admin/discounts/${c.id}`}
          className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-white text-blue-800 font-semibold hover:bg-blue-50 transition-colors shrink-0"
        >
          Manage <i className="ri-arrow-right-line" aria-hidden="true" />
        </Link>
      </div>
    </div>
  );
}

function CreateDialog({
  existing,
  onClose,
  onCreated,
}: {
  existing: CampaignRow[];
  onClose: () => void;
  onCreated: (id: string) => void;
}) {
  const [name, setName] = useState('');
  const [template, setTemplate] = useState<number | null>(null);
  const [startsAt, setStartsAt] = useState('');
  const [endsAt, setEndsAt] = useState('');
  const [copyFrom, setCopyFrom] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && !saving && onClose();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [onClose, saving]);

  const pick = (i: number) => {
    setTemplate(i);
    setName(CAMPAIGN_TEMPLATES[i].name);
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      setError('Give the campaign a name.');
      return;
    }
    const starts = fromLocalInput(startsAt);
    const ends = fromLocalInput(endsAt);
    if (starts && ends && new Date(ends) <= new Date(starts)) {
      setError('The end must be after the start.');
      return;
    }
    setSaving(true);
    setError('');
    const t = template != null ? CAMPAIGN_TEMPLATES[template] : null;
    try {
      const { campaign } = await adminFetch<{ campaign: { id: string } }>('/api/admin/discounts', {
        method: 'POST',
        body: JSON.stringify({
          name: name.trim(),
          starts_at: starts,
          ends_at: ends,
          banner_text: t?.banner || `${name.trim()}: selected products on sale`,
          popup_title: t?.popupTitle || name.trim(),
          popup_message: t?.popupMessage || 'Selected perfumes, body mists and candles are on sale now.',
          popup_cta_label: 'Shop the sale',
          copy_from: copyFrom || undefined,
        }),
      });
      onCreated(campaign.id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create the campaign.');
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4">
      <div className="absolute inset-0 bg-black/50" onClick={() => !saving && onClose()} aria-hidden="true" />
      <form
        onSubmit={submit}
        role="dialog"
        aria-modal="true"
        aria-labelledby="new-campaign-title"
        className="relative w-full sm:max-w-lg bg-white rounded-t-2xl sm:rounded-2xl shadow-xl max-h-[92vh] overflow-y-auto"
      >
        <div className="px-6 pt-6 pb-4 border-b border-gray-100 flex items-start justify-between gap-4">
          <div>
            <h2 id="new-campaign-title" className="text-xl font-bold text-gray-900">New campaign</h2>
            <p className="text-sm text-gray-500 mt-1">You will choose products and discounts next.</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="w-9 h-9 flex items-center justify-center text-gray-500 hover:bg-gray-100 rounded-lg cursor-pointer"
          >
            <i className="ri-close-line text-xl" aria-hidden="true" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-5">
          <fieldset>
            <legend className="block text-sm font-semibold text-gray-700 mb-2">Start from a template</legend>
            <div className="flex flex-wrap gap-2">
              {CAMPAIGN_TEMPLATES.map((t, i) => (
                <button
                  key={t.name}
                  type="button"
                  onClick={() => pick(i)}
                  aria-pressed={template === i}
                  className={`px-3 py-1.5 rounded-full text-sm font-semibold border-2 transition-colors cursor-pointer ${
                    template === i ? 'border-blue-700 bg-blue-50 text-blue-700' : 'border-gray-200 text-gray-700 hover:border-gray-300'
                  }`}
                >
                  {t.name}
                </button>
              ))}
            </div>
          </fieldset>

          <div>
            <label htmlFor="campaign-name" className="block text-sm font-semibold text-gray-700 mb-1">Campaign name</label>
            <input
              id="campaign-name"
              value={name}
              onChange={(e) => {
                setName(e.target.value);
                setTemplate(null);
              }}
              maxLength={60}
              placeholder="e.g. Black Friday"
              className="w-full px-4 py-2.5 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              autoFocus
            />
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <label htmlFor="campaign-start" className="block text-sm font-semibold text-gray-700 mb-1">
                Starts <span className="font-normal text-gray-400">(optional)</span>
              </label>
              <input
                id="campaign-start"
                type="datetime-local"
                value={startsAt}
                onChange={(e) => setStartsAt(e.target.value)}
                className="w-full px-3 py-2.5 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div>
              <label htmlFor="campaign-end" className="block text-sm font-semibold text-gray-700 mb-1">
                Ends <span className="font-normal text-gray-400">(optional)</span>
              </label>
              <input
                id="campaign-end"
                type="datetime-local"
                value={endsAt}
                onChange={(e) => setEndsAt(e.target.value)}
                className="w-full px-3 py-2.5 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
          </div>

          {existing.some((c) => (c.product_count ?? 0) > 0) && (
            <div>
              <label htmlFor="campaign-copy" className="block text-sm font-semibold text-gray-700 mb-1">
                Copy products from <span className="font-normal text-gray-400">(optional)</span>
              </label>
              <select
                id="campaign-copy"
                value={copyFrom}
                onChange={(e) => setCopyFrom(e.target.value)}
                className="w-full px-3 py-2.5 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="">Start empty</option>
                {existing
                  .filter((c) => (c.product_count ?? 0) > 0)
                  .map((c) => (
                    <option key={c.id} value={c.id}>
                      {c.name} · {c.product_count} products
                    </option>
                  ))}
              </select>
            </div>
          )}

          {error && (
            <p className="text-sm text-red-600 flex items-center gap-2" role="alert">
              <i className="ri-error-warning-line" aria-hidden="true" /> {error}
            </p>
          )}
        </div>

        <div className="px-6 py-4 border-t border-gray-100 flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            disabled={saving}
            className="px-5 py-2.5 border-2 border-gray-300 rounded-lg font-semibold text-gray-700 hover:bg-gray-50 cursor-pointer disabled:opacity-50"
          >
            Cancel
          </button>
          <button
            type="submit"
            disabled={saving}
            className="px-5 py-2.5 rounded-lg bg-blue-700 hover:bg-blue-800 text-white font-semibold cursor-pointer disabled:opacity-60 inline-flex items-center justify-center gap-2"
          >
            {saving && <i className="ri-loader-4-line animate-spin" aria-hidden="true" />}
            Create and add products
          </button>
        </div>
      </form>
    </div>
  );
}
