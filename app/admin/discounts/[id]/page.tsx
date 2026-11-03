'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useParams, useRouter } from 'next/navigation';
import { adminFetch } from '@/lib/admin-fetch';
import { money } from '@/lib/format-money';
import {
  type CampaignRow,
  PromoPreview,
  StatusPill,
  formatWhen,
  fromLocalInput,
  percentRange,
  timeLeft,
  toLocalInput,
} from '@/components/admin/discounts/shared';
import ProductPicker from '@/components/admin/discounts/ProductPicker';

export type CampaignItem = {
  product_id: string;
  percent_off: number;
  applied: boolean;
  original_price: number | null;
  sale_price: number | null;
  name: string;
  slug: string;
  sku: string | null;
  price: number;
  compare_at_price: number | null;
  quantity: number | null;
  status: string;
  category: string | null;
  image: string | null;
  variant_count: number;
  conflict_campaign: string | null;
};

type Detail = { campaign: CampaignRow; items: CampaignItem[]; busy: { product_id: string; campaign: string }[] };
type Tab = 'products' | 'schedule' | 'promo';

const QUICK = [10, 15, 20, 25, 30, 40];
const round2 = (n: number) => Math.round(n * 100) / 100;

/** The regular (pre-sale) price of an item, whether or not the sale is applied yet. */
function regularPrice(item: CampaignItem) {
  return item.applied && item.original_price != null ? Number(item.original_price) : Number(item.price);
}

export default function CampaignEditorPage() {
  const params = useParams();
  const router = useRouter();
  const id = String(params?.id || '');

  const [data, setData] = useState<Detail | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [tab, setTab] = useState<Tab>('products');
  const [toast, setToast] = useState<{ tone: 'ok' | 'warn' | 'error'; text: string } | null>(null);
  const [busyAction, setBusyAction] = useState('');
  const [confirm, setConfirm] = useState<null | 'start' | 'end' | 'delete'>(null);
  const [pickerOpen, setPickerOpen] = useState(false);

  const load = useCallback(async () => {
    try {
      const d = await adminFetch<Detail>(`/api/admin/discounts/${id}`);
      setData(d);
      setLoadError('');
    } catch (e) {
      setLoadError(e instanceof Error ? e.message : 'Could not load the campaign.');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    load();
  }, [load]);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), toast.tone === 'ok' ? 3500 : 7000);
    return () => clearTimeout(t);
  }, [toast]);

  const notifySkipped = (skipped: string[] | undefined, prefix: string) => {
    if (skipped?.length) {
      setToast({
        tone: 'warn',
        text: `${prefix} ${skipped.length} product${skipped.length === 1 ? ' is' : 's are'} already discounted in another live sale and kept that price: ${skipped.slice(0, 3).join(', ')}${skipped.length > 3 ? '…' : ''}`,
      });
      return true;
    }
    return false;
  };

  const runAction = async (action: 'start' | 'end' | 'schedule' | 'unschedule') => {
    setBusyAction(action);
    try {
      const res = await adminFetch<Detail & { applied?: number; restored?: number; skipped?: string[] }>(
        `/api/admin/discounts/${id}`,
        { method: 'POST', body: JSON.stringify({ action }) }
      );
      setData({ campaign: res.campaign, items: res.items, busy: res.busy });
      if (!notifySkipped(res.skipped, 'Sale started.')) {
        setToast({
          tone: 'ok',
          text:
            action === 'start'
              ? `Sale is live. ${res.applied ?? 0} product prices reduced.`
              : action === 'end'
                ? `Sale ended. ${res.restored ?? 0} prices restored.`
                : action === 'schedule'
                  ? 'Scheduled. It will start on its own at the start time.'
                  : 'Back to draft.',
        });
      }
    } catch (e) {
      setToast({ tone: 'error', text: e instanceof Error ? e.message : 'Something went wrong.' });
    } finally {
      setBusyAction('');
      setConfirm(null);
    }
  };

  const remove = async () => {
    setBusyAction('delete');
    try {
      await adminFetch(`/api/admin/discounts/${id}`, { method: 'DELETE' });
      router.push('/admin/discounts');
    } catch (e) {
      setToast({ tone: 'error', text: e instanceof Error ? e.message : 'Could not delete.' });
      setBusyAction('');
      setConfirm(null);
    }
  };

  const saveFields = async (fields: Record<string, unknown>, message = 'Saved.') => {
    const res = await adminFetch<Detail>(`/api/admin/discounts/${id}`, { method: 'PATCH', body: JSON.stringify(fields) });
    setData(res);
    setToast({ tone: 'ok', text: message });
  };

  const setItems = async (items: { product_id: string; percent_off: number }[], message?: string) => {
    const res = await adminFetch<{ count: number; skipped?: string[] }>(`/api/admin/discounts/${id}/items`, {
      method: 'PUT',
      body: JSON.stringify({ items }),
    });
    await load();
    if (!notifySkipped(res.skipped, 'Saved.')) setToast({ tone: 'ok', text: message || 'Discounts saved.' });
  };

  const removeItems = async (productIds: string[]) => {
    await adminFetch(`/api/admin/discounts/${id}/items`, { method: 'DELETE', body: JSON.stringify({ product_ids: productIds }) });
    await load();
    setToast({ tone: 'ok', text: `${productIds.length} product${productIds.length === 1 ? '' : 's'} removed${data?.campaign.status === 'live' ? ' and their prices restored' : ''}.` });
  };

  const addWholeCatalogue = async (percent: number) => {
    const res = await adminFetch<{ count: number; skipped?: string[] }>(`/api/admin/discounts/${id}/items`, {
      method: 'PUT',
      body: JSON.stringify({ all: true, percent_off: percent }),
    });
    await load();
    if (!notifySkipped(res.skipped, 'Added.')) setToast({ tone: 'ok', text: `${res.count} products added at ${percent}% off.` });
  };

  if (loading) {
    return (
      <div className="max-w-7xl mx-auto animate-pulse space-y-4" aria-busy="true">
        <div className="h-4 w-32 bg-gray-200 rounded" />
        <div className="h-9 w-72 bg-gray-200 rounded" />
        <div className="h-64 bg-white rounded-xl border border-gray-200" />
      </div>
    );
  }
  if (loadError || !data) {
    return (
      <div className="max-w-xl mx-auto text-center py-16">
        <p className="text-red-600 mb-4">{loadError || 'Campaign not found.'}</p>
        <Link href="/admin/discounts" className="text-blue-700 font-semibold">Back to campaigns</Link>
      </div>
    );
  }

  const { campaign: c, items } = data;
  const ended = c.status === 'ended';

  return (
    <div className="max-w-7xl mx-auto pb-24">
      <Link href="/admin/discounts" className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-900 mb-4">
        <i className="ri-arrow-left-line" aria-hidden="true" /> All campaigns
      </Link>

      <div className="flex flex-col lg:flex-row lg:items-start lg:justify-between gap-4 mb-6">
        <div className="min-w-0">
          <NameEditor name={c.name} disabled={false} onSave={(name) => saveFields({ name }, 'Name saved.')} />
          <div className="mt-2 flex items-center gap-3 flex-wrap text-sm text-gray-500">
            <StatusPill status={c.status} announced={c.announce} />
            <StatusLine campaign={c} />
          </div>
        </div>
        <div className="flex flex-wrap gap-2 shrink-0">
          {(c.status === 'draft' || c.status === 'scheduled' || ended) && (
            <button
              type="button"
              onClick={() => setConfirm('start')}
              disabled={!!busyAction || items.length === 0}
              title={items.length === 0 ? 'Add products first' : undefined}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-green-700 hover:bg-green-800 text-white font-semibold disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
            >
              <i className="ri-play-fill" aria-hidden="true" /> {ended ? 'Run again now' : 'Start sale now'}
            </button>
          )}
          {c.status === 'draft' && (
            <button
              type="button"
              onClick={() => (c.starts_at && new Date(c.starts_at) > new Date() ? runAction('schedule') : setTab('schedule'))}
              disabled={!!busyAction || items.length === 0}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border-2 border-gray-300 text-gray-700 font-semibold hover:bg-gray-50 disabled:opacity-50 cursor-pointer disabled:cursor-not-allowed"
            >
              <i className="ri-calendar-schedule-line" aria-hidden="true" /> Schedule
            </button>
          )}
          {c.status === 'scheduled' && (
            <button
              type="button"
              onClick={() => runAction('unschedule')}
              disabled={!!busyAction}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg border-2 border-gray-300 text-gray-700 font-semibold hover:bg-gray-50 disabled:opacity-50 cursor-pointer"
            >
              <i className="ri-close-circle-line" aria-hidden="true" /> Unschedule
            </button>
          )}
          {c.status === 'live' && (
            <button
              type="button"
              onClick={() => setConfirm('end')}
              disabled={!!busyAction}
              className="inline-flex items-center gap-2 px-4 py-2.5 rounded-lg bg-red-600 hover:bg-red-700 text-white font-semibold disabled:opacity-50 cursor-pointer"
            >
              <i className="ri-stop-fill" aria-hidden="true" /> End sale
            </button>
          )}
          {c.status !== 'live' && (
            <button
              type="button"
              onClick={() => setConfirm('delete')}
              disabled={!!busyAction}
              aria-label="Delete campaign"
              className="w-11 h-11 inline-flex items-center justify-center rounded-lg border-2 border-gray-300 text-gray-500 hover:text-red-700 hover:border-red-200 hover:bg-red-50 disabled:opacity-50 cursor-pointer"
            >
              <i className="ri-delete-bin-line text-lg" aria-hidden="true" />
            </button>
          )}
        </div>
      </div>

      <div className="border-b border-gray-200 mb-6 flex gap-1 overflow-x-auto" role="tablist">
        {(
          [
            ['products', 'Products & discounts', 'ri-price-tag-3-line', items.length],
            ['schedule', 'Schedule', 'ri-calendar-line', null],
            ['promo', 'Banner & popup', 'ri-megaphone-line', null],
          ] as const
        ).map(([key, label, icon, count]) => (
          <button
            key={key}
            type="button"
            role="tab"
            aria-selected={tab === key}
            onClick={() => setTab(key)}
            className={`shrink-0 inline-flex items-center gap-2 px-4 py-3 text-sm font-semibold border-b-2 -mb-px transition-colors cursor-pointer ${
              tab === key ? 'border-blue-700 text-blue-700' : 'border-transparent text-gray-500 hover:text-gray-800'
            }`}
          >
            <i className={icon} aria-hidden="true" />
            {label}
            {count != null && <span className="text-xs tabular-nums text-gray-400">{count}</span>}
          </button>
        ))}
      </div>

      {tab === 'products' && (
        <ProductsTab
          campaign={c}
          items={items}
          onOpenPicker={() => setPickerOpen(true)}
          onSetItems={setItems}
          onRemove={removeItems}
          onError={(text) => setToast({ tone: 'error', text })}
        />
      )}
      {tab === 'schedule' && <ScheduleTab campaign={c} onSave={saveFields} onSchedule={() => runAction('schedule')} itemCount={items.length} />}
      {tab === 'promo' && <PromoTab campaign={c} onSave={saveFields} />}

      {pickerOpen && (
        <ProductPicker
          existingIds={new Set(items.map((i) => i.product_id))}
          busy={new Map(data.busy.map((b) => [b.product_id, b.campaign]))}
          campaignName={c.name}
          onClose={() => setPickerOpen(false)}
          onAdd={async (ids, percent) => {
            await setItems(ids.map((product_id) => ({ product_id, percent_off: percent })), `${ids.length} product${ids.length === 1 ? '' : 's'} added at ${percent}% off.`);
            setPickerOpen(false);
          }}
          onAddAll={async (percent) => {
            await addWholeCatalogue(percent);
            setPickerOpen(false);
          }}
        />
      )}

      {confirm && (
        <ConfirmDialog
          kind={confirm}
          campaign={c}
          itemCount={items.length}
          busy={!!busyAction}
          onCancel={() => setConfirm(null)}
          onConfirm={() => (confirm === 'delete' ? remove() : runAction(confirm))}
        />
      )}

      {toast && (
        <div
          role="status"
          className={`fixed bottom-4 left-4 right-4 sm:left-auto sm:right-6 sm:max-w-md z-50 rounded-xl shadow-lg px-4 py-3 text-sm flex items-start gap-3 ${
            toast.tone === 'ok' ? 'bg-blue-800 text-white' : toast.tone === 'warn' ? 'bg-amber-50 text-amber-900 border border-amber-200' : 'bg-red-50 text-red-800 border border-red-200'
          }`}
        >
          <i
            className={`${toast.tone === 'ok' ? 'ri-checkbox-circle-line text-green-400' : toast.tone === 'warn' ? 'ri-alert-line text-amber-600' : 'ri-error-warning-line text-red-600'} text-lg leading-none mt-0.5`}
            aria-hidden="true"
          />
          <span className="flex-1">{toast.text}</span>
          <button type="button" onClick={() => setToast(null)} aria-label="Dismiss" className="opacity-60 hover:opacity-100 cursor-pointer">
            <i className="ri-close-line" aria-hidden="true" />
          </button>
        </div>
      )}
    </div>
  );
}

function StatusLine({ campaign: c }: { campaign: CampaignRow }) {
  const [, tick] = useState(0);
  useEffect(() => {
    const t = setInterval(() => tick((n) => n + 1), 30_000);
    return () => clearInterval(t);
  }, []);
  if (c.status === 'live') {
    const left = timeLeft(c.ends_at);
    return <span>{c.ends_at ? `Ends ${formatWhen(c.ends_at)}${left ? ` · ${left} left` : ''}` : 'Runs until you end it'}</span>;
  }
  if (c.status === 'scheduled') {
    const left = timeLeft(c.starts_at);
    return <span>Starts {formatWhen(c.starts_at)}{left ? ` · in ${left}` : ''}</span>;
  }
  if (c.status === 'ended') return <span>Ended {formatWhen(c.ended_at || c.ends_at)} · prices restored</span>;
  return <span>Not live yet: prices are unchanged until you start or schedule it.</span>;
}

function NameEditor({ name, onSave, disabled }: { name: string; onSave: (n: string) => Promise<void>; disabled: boolean }) {
  const [editing, setEditing] = useState(false);
  const [value, setValue] = useState(name);
  const [saving, setSaving] = useState(false);
  useEffect(() => setValue(name), [name]);
  if (!editing) {
    return (
      <div className="flex items-center gap-2 min-w-0">
        <h1 className="text-2xl sm:text-3xl font-bold text-gray-900 truncate">{name}</h1>
        {!disabled && (
          <button
            type="button"
            onClick={() => setEditing(true)}
            aria-label="Rename campaign"
            className="w-8 h-8 shrink-0 flex items-center justify-center rounded-lg text-gray-400 hover:text-blue-700 hover:bg-blue-50 cursor-pointer"
          >
            <i className="ri-pencil-line" aria-hidden="true" />
          </button>
        )}
      </div>
    );
  }
  const commit = async () => {
    const v = value.trim();
    if (!v || v === name) {
      setEditing(false);
      setValue(name);
      return;
    }
    setSaving(true);
    try {
      await onSave(v);
      setEditing(false);
    } finally {
      setSaving(false);
    }
  };
  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        commit();
      }}
      className="flex items-center gap-2"
    >
      <label htmlFor="rename" className="sr-only">Campaign name</label>
      <input
        id="rename"
        value={value}
        onChange={(e) => setValue(e.target.value)}
        maxLength={60}
        autoFocus
        onKeyDown={(e) => e.key === 'Escape' && (setEditing(false), setValue(name))}
        className="text-2xl font-bold text-gray-900 px-3 py-1 border-2 border-blue-500 rounded-lg w-full max-w-md focus:outline-none"
      />
      <button type="submit" disabled={saving} className="px-3 py-2 rounded-lg bg-blue-700 text-white text-sm font-semibold cursor-pointer disabled:opacity-60">
        Save
      </button>
    </form>
  );
}

function ProductsTab({
  campaign,
  items,
  onOpenPicker,
  onSetItems,
  onRemove,
  onError,
}: {
  campaign: CampaignRow;
  items: CampaignItem[];
  onOpenPicker: () => void;
  onSetItems: (items: { product_id: string; percent_off: number }[], message?: string) => Promise<void>;
  onRemove: (ids: string[]) => Promise<void>;
  onError: (text: string) => void;
}) {
  const [query, setQuery] = useState('');
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [bulkPct, setBulkPct] = useState('20');
  const [working, setWorking] = useState(false);
  const [confirmRemove, setConfirmRemove] = useState(false);
  const ended = campaign.status === 'ended';
  const live = campaign.status === 'live';

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return items;
    return items.filter((i) => i.name.toLowerCase().includes(q) || (i.sku || '').toLowerCase().includes(q) || (i.category || '').toLowerCase().includes(q));
  }, [items, query]);

  const stats = useMemo(() => {
    if (!items.length) return null;
    const pcts = items.map((i) => Number(i.percent_off));
    const avg = pcts.reduce((s, p) => s + p, 0) / pcts.length;
    const saving = items.reduce((s, i) => s + (regularPrice(i) - round2(regularPrice(i) * (1 - i.percent_off / 100))), 0);
    return {
      min: Math.min(...pcts),
      max: Math.max(...pcts),
      avg: Math.round(avg * 10) / 10,
      saving,
      applied: items.filter((i) => i.applied).length,
      conflicts: items.filter((i) => i.conflict_campaign && !i.applied).length,
    };
  }, [items]);

  const allShownSelected = shown.length > 0 && shown.every((i) => selected.has(i.product_id));
  const toggleAll = () => {
    const next = new Set(selected);
    if (allShownSelected) shown.forEach((i) => next.delete(i.product_id));
    else shown.forEach((i) => next.add(i.product_id));
    setSelected(next);
  };

  const applyBulk = async () => {
    const pct = Number(bulkPct);
    if (!Number.isFinite(pct) || pct < 1 || pct > 90) {
      onError('Use a discount between 1% and 90%.');
      return;
    }
    setWorking(true);
    try {
      await onSetItems([...selected].map((product_id) => ({ product_id, percent_off: pct })), `${selected.size} product${selected.size === 1 ? '' : 's'} set to ${pct}% off.`);
      setSelected(new Set());
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Could not save.');
    } finally {
      setWorking(false);
    }
  };

  const removeSelected = async () => {
    setWorking(true);
    try {
      await onRemove([...selected]);
      setSelected(new Set());
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Could not remove.');
    } finally {
      setWorking(false);
      setConfirmRemove(false);
    }
  };

  if (items.length === 0) {
    return (
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-10 sm:p-14 text-center">
        <div className="w-16 h-16 mx-auto rounded-full bg-blue-50 flex items-center justify-center">
          <i className="ri-shopping-bag-3-line text-3xl text-blue-700" aria-hidden="true" />
        </div>
        <h2 className="mt-5 text-lg font-bold text-gray-900">Choose the products on sale</h2>
        <p className="mt-1 text-gray-500 max-w-md mx-auto">
          Pick a few products or the whole catalogue. Each product can have its own discount, from 1% to 90%.
        </p>
        {!ended && (
          <button
            type="button"
            onClick={onOpenPicker}
            className="mt-6 inline-flex items-center gap-2 px-5 py-2.5 rounded-lg bg-blue-700 hover:bg-blue-800 text-white font-semibold cursor-pointer"
          >
            <i className="ri-add-line" aria-hidden="true" /> Add products
          </button>
        )}
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {stats && (
        <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
          <MiniStat label="Products" value={String(items.length)} hint={live ? `${stats.applied} at sale price now` : 'Prices change when the sale starts'} />
          <MiniStat label="Discount range" value={percentRange(stats.min, stats.max)} hint={`Average ${stats.avg}%`} />
          <MiniStat label="Shopper saves" value={`GH₵ ${money(stats.saving)}`} hint="If one of each sold" />
          <MiniStat
            label="Needs attention"
            value={String(stats.conflicts)}
            hint={stats.conflicts ? 'In another live sale' : 'All clear'}
            tone={stats.conflicts ? 'amber' : undefined}
          />
        </div>
      )}

      <div className="bg-white rounded-xl border border-gray-200 shadow-sm">
        <div className="p-4 flex flex-col sm:flex-row gap-3 sm:items-center sm:justify-between border-b border-gray-100">
          <div className="relative flex-1 max-w-md">
            <i className="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" aria-hidden="true" />
            <label htmlFor="item-search" className="sr-only">Search products in this campaign</label>
            <input
              id="item-search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search by name, SKU or category"
              className="w-full pl-10 pr-4 py-2.5 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            />
          </div>
          {!ended && (
            <button
              type="button"
              onClick={onOpenPicker}
              className="inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-lg bg-blue-700 hover:bg-blue-800 text-white font-semibold cursor-pointer"
            >
              <i className="ri-add-line" aria-hidden="true" /> Add products
            </button>
          )}
        </div>

        {selected.size > 0 && !ended && (
          <div className="px-4 py-3 bg-blue-50 border-b border-blue-100 flex flex-col lg:flex-row lg:items-center gap-3">
            <p className="text-sm font-semibold text-blue-800 shrink-0">
              {selected.size} selected
              <button type="button" onClick={() => setSelected(new Set())} className="ml-2 font-normal text-blue-700 underline cursor-pointer">
                Clear
              </button>
            </p>
            <div className="flex flex-wrap items-center gap-2 lg:ml-auto">
              <span className="text-sm text-gray-700">Set discount</span>
              <div className="flex gap-1">
                {QUICK.map((q) => (
                  <button
                    key={q}
                    type="button"
                    onClick={() => setBulkPct(String(q))}
                    aria-pressed={bulkPct === String(q)}
                    className={`px-2.5 py-1.5 rounded-md text-xs font-semibold border cursor-pointer ${
                      bulkPct === String(q) ? 'bg-blue-700 border-blue-700 text-white' : 'bg-white border-gray-200 text-gray-700 hover:border-gray-300'
                    }`}
                  >
                    {q}%
                  </button>
                ))}
              </div>
              <PercentInput value={bulkPct} onChange={setBulkPct} label="Discount for selected products" />
              <button
                type="button"
                onClick={applyBulk}
                disabled={working}
                className="px-4 py-2 rounded-lg bg-blue-700 hover:bg-blue-800 text-white text-sm font-semibold cursor-pointer disabled:opacity-60"
              >
                Apply
              </button>
              <button
                type="button"
                onClick={() => setConfirmRemove(true)}
                disabled={working}
                className="px-4 py-2 rounded-lg border-2 border-red-200 text-red-700 bg-white hover:bg-red-50 text-sm font-semibold cursor-pointer disabled:opacity-60"
              >
                Remove
              </button>
            </div>
          </div>
        )}

        {confirmRemove && (
          <div className="px-4 py-3 bg-red-50 border-b border-red-100 flex flex-col sm:flex-row sm:items-center gap-3" role="alert">
            <p className="text-sm text-red-800 flex-1">
              Remove {selected.size} product{selected.size === 1 ? '' : 's'} from this campaign?
              {live ? ' Their regular prices come back straight away.' : ''}
            </p>
            <div className="flex gap-2">
              <button type="button" onClick={() => setConfirmRemove(false)} className="px-3 py-1.5 rounded-lg border-2 border-gray-300 bg-white text-sm font-semibold text-gray-700 cursor-pointer">
                Keep
              </button>
              <button type="button" onClick={removeSelected} disabled={working} className="px-3 py-1.5 rounded-lg bg-red-600 text-white text-sm font-semibold cursor-pointer disabled:opacity-60">
                Remove
              </button>
            </div>
          </div>
        )}

        {/* Desktop table */}
        <div className="hidden md:block overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-gray-500 border-b border-gray-100">
                <th className="py-3 pl-4 pr-2 w-10">
                  {!ended && (
                    <input type="checkbox" checked={allShownSelected} onChange={toggleAll} aria-label="Select all shown products" className="w-4 h-4 accent-blue-700" />
                  )}
                </th>
                <th className="py-3 px-2 font-semibold">Product</th>
                <th className="py-3 px-2 font-semibold text-right">Regular</th>
                <th className="py-3 px-2 font-semibold">Discount</th>
                <th className="py-3 px-2 font-semibold text-right">Sale price</th>
                <th className="py-3 px-2 font-semibold text-right">Saves</th>
                <th className="py-3 px-4 font-semibold">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-50">
              {shown.map((item) => (
                <ItemRow
                  key={item.product_id}
                  item={item}
                  campaign={campaign}
                  checked={selected.has(item.product_id)}
                  onCheck={(v) => {
                    const next = new Set(selected);
                    if (v) next.add(item.product_id);
                    else next.delete(item.product_id);
                    setSelected(next);
                  }}
                  onPercent={(pct) => onSetItems([{ product_id: item.product_id, percent_off: pct }], `${item.name} set to ${pct}% off.`)}
                  onError={onError}
                />
              ))}
            </tbody>
          </table>
        </div>

        {/* Mobile cards */}
        <ul className="md:hidden divide-y divide-gray-100">
          {shown.map((item) => (
            <ItemCard
              key={item.product_id}
              item={item}
              campaign={campaign}
              checked={selected.has(item.product_id)}
              onCheck={(v) => {
                const next = new Set(selected);
                if (v) next.add(item.product_id);
                else next.delete(item.product_id);
                setSelected(next);
              }}
              onPercent={(pct) => onSetItems([{ product_id: item.product_id, percent_off: pct }], `${item.name} set to ${pct}% off.`)}
              onError={onError}
            />
          ))}
        </ul>

        {shown.length === 0 && <p className="p-8 text-center text-gray-500">No products match “{query}”.</p>}
      </div>
    </div>
  );
}

function MiniStat({ label, value, hint, tone }: { label: string; value: string; hint: string; tone?: 'amber' }) {
  return (
    <div className={`rounded-xl border shadow-sm p-4 ${tone === 'amber' ? 'bg-amber-50 border-amber-200' : 'bg-white border-gray-200'}`}>
      <p className="text-xs text-gray-500">{label}</p>
      <p className="mt-1 text-lg font-bold text-gray-900 tabular-nums truncate">{value}</p>
      <p className="text-xs text-gray-500 truncate">{hint}</p>
    </div>
  );
}

function PercentInput({ value, onChange, label, onCommit, disabled }: { value: string; onChange: (v: string) => void; label: string; onCommit?: () => void; disabled?: boolean }) {
  return (
    <div className="relative w-24">
      <input
        type="number"
        inputMode="decimal"
        min={1}
        max={90}
        step={0.5}
        value={value}
        disabled={disabled}
        aria-label={label}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onCommit}
        onKeyDown={(e) => {
          if (e.key === 'Enter') {
            e.preventDefault();
            onCommit?.();
            (e.target as HTMLInputElement).blur();
          }
        }}
        className="w-full pl-3 pr-7 py-2 border-2 border-gray-200 rounded-lg text-right tabular-nums font-semibold focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50 disabled:text-gray-500"
      />
      <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm pointer-events-none">%</span>
    </div>
  );
}

function useInlinePercent(item: CampaignItem, onPercent: (pct: number) => Promise<void>, onError: (t: string) => void) {
  const [value, setValue] = useState(String(item.percent_off));
  const [saving, setSaving] = useState(false);
  useEffect(() => setValue(String(item.percent_off)), [item.percent_off]);
  const commit = async () => {
    const pct = Math.round(Number(value) * 10) / 10;
    if (value === '' || pct === Number(item.percent_off)) {
      setValue(String(item.percent_off));
      return;
    }
    if (!Number.isFinite(pct) || pct < 1 || pct > 90) {
      onError('Use a discount between 1% and 90%.');
      setValue(String(item.percent_off));
      return;
    }
    setSaving(true);
    try {
      await onPercent(pct);
    } catch (e) {
      onError(e instanceof Error ? e.message : 'Could not save.');
      setValue(String(item.percent_off));
    } finally {
      setSaving(false);
    }
  };
  const pctNum = Number(value);
  const preview = Number.isFinite(pctNum) && pctNum >= 1 && pctNum <= 90 ? pctNum : Number(item.percent_off);
  return { value, setValue, commit, saving, preview };
}

function ItemState({ item, campaign }: { item: CampaignItem; campaign: CampaignRow }) {
  if (item.applied) return <span className="inline-flex items-center gap-1 text-xs font-semibold text-green-700"><i className="ri-check-line" aria-hidden="true" />On sale now</span>;
  if (item.conflict_campaign)
    return (
      <span className="inline-flex items-center gap-1 text-xs font-semibold text-amber-700" title={`Already discounted in ${item.conflict_campaign}`}>
        <i className="ri-alert-line" aria-hidden="true" />In {item.conflict_campaign}
      </span>
    );
  if (item.status !== 'active') return <span className="text-xs font-semibold text-gray-500 capitalize">{item.status} product</span>;
  if (campaign.status === 'ended') return <span className="text-xs text-gray-500">Sale ended</span>;
  return <span className="text-xs text-gray-500">Waiting for start</span>;
}

function ItemRow({
  item,
  campaign,
  checked,
  onCheck,
  onPercent,
  onError,
}: {
  item: CampaignItem;
  campaign: CampaignRow;
  checked: boolean;
  onCheck: (v: boolean) => void;
  onPercent: (pct: number) => Promise<void>;
  onError: (t: string) => void;
}) {
  const { value, setValue, commit, saving, preview } = useInlinePercent(item, onPercent, onError);
  const regular = regularPrice(item);
  const sale = round2(regular * (1 - preview / 100));
  const ended = campaign.status === 'ended';
  return (
    <tr className={checked ? 'bg-blue-50/50' : 'hover:bg-gray-50'}>
      <td className="py-3 pl-4 pr-2">
        {!ended && <input type="checkbox" checked={checked} onChange={(e) => onCheck(e.target.checked)} aria-label={`Select ${item.name}`} className="w-4 h-4 accent-blue-700" />}
      </td>
      <td className="py-3 px-2">
        <div className="flex items-center gap-3 min-w-0">
          <img src={item.image || '/house-of-elle-logo.png'} alt="" className="w-11 h-11 rounded-lg object-cover bg-gray-100 shrink-0" loading="lazy" />
          <div className="min-w-0">
            <Link href={`/admin/products/${item.product_id}`} className="font-semibold text-gray-900 hover:text-blue-700 line-clamp-1">
              {item.name}
            </Link>
            <p className="text-xs text-gray-500 truncate">
              {[item.category, item.sku, item.variant_count ? `${item.variant_count} variants` : null].filter(Boolean).join(' · ') || '—'}
            </p>
          </div>
        </div>
      </td>
      <td className="py-3 px-2 text-right tabular-nums text-gray-600 whitespace-nowrap">GH₵{money(regular)}</td>
      <td className="py-3 px-2">
        <div className="flex items-center gap-2">
          <PercentInput value={value} onChange={setValue} onCommit={commit} disabled={ended || saving} label={`Discount for ${item.name}`} />
          {saving && <i className="ri-loader-4-line animate-spin text-gray-400" aria-hidden="true" />}
        </div>
      </td>
      <td className="py-3 px-2 text-right tabular-nums font-semibold text-gray-900 whitespace-nowrap">GH₵{money(sale)}</td>
      <td className="py-3 px-2 text-right tabular-nums text-green-700 whitespace-nowrap">−GH₵{money(regular - sale)}</td>
      <td className="py-3 px-4 whitespace-nowrap">
        <ItemState item={item} campaign={campaign} />
      </td>
    </tr>
  );
}

function ItemCard(props: {
  item: CampaignItem;
  campaign: CampaignRow;
  checked: boolean;
  onCheck: (v: boolean) => void;
  onPercent: (pct: number) => Promise<void>;
  onError: (t: string) => void;
}) {
  const { item, campaign, checked, onCheck } = props;
  const { value, setValue, commit, saving, preview } = useInlinePercent(item, props.onPercent, props.onError);
  const regular = regularPrice(item);
  const sale = round2(regular * (1 - preview / 100));
  const ended = campaign.status === 'ended';
  return (
    <li className={`p-4 flex gap-3 ${checked ? 'bg-blue-50/50' : ''}`}>
      {!ended && (
        <input type="checkbox" checked={checked} onChange={(e) => onCheck(e.target.checked)} aria-label={`Select ${item.name}`} className="w-5 h-5 mt-3 accent-blue-700 shrink-0" />
      )}
      <img src={item.image || '/house-of-elle-logo.png'} alt="" className="w-14 h-14 rounded-lg object-cover bg-gray-100 shrink-0" loading="lazy" />
      <div className="flex-1 min-w-0">
        <p className="font-semibold text-gray-900 line-clamp-2 leading-snug">{item.name}</p>
        <ItemState item={item} campaign={campaign} />
        <div className="mt-2 flex items-center gap-3 flex-wrap">
          <PercentInput value={value} onChange={setValue} onCommit={commit} disabled={ended || saving} label={`Discount for ${item.name}`} />
          <div className="text-sm tabular-nums">
            <span className="text-gray-400 line-through mr-1.5">GH₵{money(regular)}</span>
            <span className="font-bold text-gray-900">GH₵{money(sale)}</span>
          </div>
        </div>
      </div>
    </li>
  );
}

function ScheduleTab({
  campaign: c,
  onSave,
  onSchedule,
  itemCount,
}: {
  campaign: CampaignRow;
  onSave: (fields: Record<string, unknown>, message?: string) => Promise<void>;
  onSchedule: () => void;
  itemCount: number;
}) {
  const [starts, setStarts] = useState(toLocalInput(c.starts_at));
  const [ends, setEnds] = useState(toLocalInput(c.ends_at));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const live = c.status === 'live';

  const save = async () => {
    setError('');
    const s = fromLocalInput(starts);
    const e = fromLocalInput(ends);
    if (s && e && new Date(e) <= new Date(s)) {
      setError('The end must be after the start.');
      return;
    }
    if (e && new Date(e) <= new Date()) {
      setError('Pick an end time in the future.');
      return;
    }
    setSaving(true);
    try {
      await onSave(live ? { ends_at: e } : { starts_at: s, ends_at: e }, 'Schedule saved.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save.');
    } finally {
      setSaving(false);
    }
  };

  const canSchedule = c.status === 'draft' && !!c.starts_at && new Date(c.starts_at) > new Date() && itemCount > 0;

  return (
    <div className="grid lg:grid-cols-[1fr_22rem] gap-6">
      <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 sm:p-6 space-y-5">
        <div>
          <h2 className="text-lg font-bold text-gray-900">When the sale runs</h2>
          <p className="text-sm text-gray-500 mt-1">Times are in your device’s time zone (Ghana time on store devices).</p>
        </div>
        <div className="grid sm:grid-cols-2 gap-4">
          <div>
            <label htmlFor="starts" className="block text-sm font-semibold text-gray-700 mb-1">Starts</label>
            <input
              id="starts"
              type="datetime-local"
              value={starts}
              disabled={live || c.status === 'ended'}
              onChange={(e) => setStarts(e.target.value)}
              className="w-full px-3 py-2.5 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50 disabled:text-gray-500"
            />
            {live && <p className="text-xs text-gray-500 mt-1">Started {formatWhen(c.started_at)}</p>}
          </div>
          <div>
            <label htmlFor="ends" className="block text-sm font-semibold text-gray-700 mb-1">
              Ends <span className="font-normal text-gray-400">(leave empty to end by hand)</span>
            </label>
            <input
              id="ends"
              type="datetime-local"
              value={ends}
              disabled={c.status === 'ended'}
              onChange={(e) => setEnds(e.target.value)}
              className="w-full px-3 py-2.5 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50 disabled:text-gray-500"
            />
          </div>
        </div>
        {error && (
          <p className="text-sm text-red-600" role="alert">
            {error}
          </p>
        )}
        {c.status !== 'ended' && (
          <div className="flex flex-wrap gap-2">
            <button type="button" onClick={save} disabled={saving} className="px-5 py-2.5 rounded-lg bg-blue-700 hover:bg-blue-800 text-white font-semibold cursor-pointer disabled:opacity-60">
              {saving ? 'Saving…' : 'Save schedule'}
            </button>
            {c.status === 'draft' && (
              <button
                type="button"
                onClick={onSchedule}
                disabled={!canSchedule}
                title={!canSchedule ? 'Save a future start time and add products first' : undefined}
                className="px-5 py-2.5 rounded-lg border-2 border-gray-300 text-gray-700 font-semibold hover:bg-gray-50 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
              >
                Schedule it
              </button>
            )}
          </div>
        )}
      </div>

      <aside className="bg-blue-50 rounded-xl p-5 sm:p-6 text-sm text-gray-700 space-y-3">
        <h3 className="font-bold text-gray-900">How scheduling works</h3>
        <p><span className="font-semibold">At the start time</span>, each product’s price drops by its discount on the website and in the POS. The old price shows crossed out.</p>
        <p><span className="font-semibold">At the end time</span>, regular prices come back. If you change a product’s price by hand during the sale, your new price is kept.</p>
        <p><span className="font-semibold">A product</span> can only be in one live sale at a time.</p>
      </aside>
    </div>
  );
}

function PromoTab({ campaign: c, onSave }: { campaign: CampaignRow; onSave: (fields: Record<string, unknown>, message?: string) => Promise<void> }) {
  const [bannerEnabled, setBannerEnabled] = useState(c.banner_enabled);
  const [bannerText, setBannerText] = useState(c.banner_text || '');
  const [popupEnabled, setPopupEnabled] = useState(c.popup_enabled);
  const [popupTitle, setPopupTitle] = useState(c.popup_title || '');
  const [popupMessage, setPopupMessage] = useState(c.popup_message || '');
  const [cta, setCta] = useState(c.popup_cta_label || '');
  const [announce, setAnnounce] = useState(c.announce);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const dirty =
    bannerEnabled !== c.banner_enabled ||
    bannerText !== (c.banner_text || '') ||
    popupEnabled !== c.popup_enabled ||
    popupTitle !== (c.popup_title || '') ||
    popupMessage !== (c.popup_message || '') ||
    cta !== (c.popup_cta_label || '') ||
    announce !== c.announce;

  const save = async () => {
    setSaving(true);
    setError('');
    try {
      await onSave(
        {
          banner_enabled: bannerEnabled,
          banner_text: bannerText,
          popup_enabled: popupEnabled,
          popup_title: popupTitle,
          popup_message: popupMessage,
          popup_cta_label: cta,
          announce,
        },
        'Banner and popup saved.'
      );
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not save.');
    } finally {
      setSaving(false);
    }
  };

  const visibleNow = c.status === 'live' || (announce && (c.status === 'draft' || c.status === 'scheduled'));

  return (
    <div className="grid lg:grid-cols-[1fr_24rem] gap-6 items-start">
      <div className="space-y-4">
        <div className={`rounded-xl px-4 py-3 text-sm flex items-start gap-3 ${visibleNow ? 'bg-green-50 text-green-800' : 'bg-gray-100 text-gray-700'}`}>
          <i className={`${visibleNow ? 'ri-eye-line' : 'ri-eye-off-line'} text-lg leading-none mt-0.5`} aria-hidden="true" />
          <p>
            {c.status === 'live'
              ? 'Shoppers see this now, while the sale is live.'
              : c.status === 'ended'
                ? 'This sale has ended, so nothing shows on the website.'
                : announce
                  ? 'Shoppers see this now, ahead of the sale. Prices change when the sale starts.'
                  : 'Hidden until the sale starts. Turn on “Announce early” to show it now.'}
          </p>
        </div>

        <section className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 sm:p-6 space-y-4">
          <Toggle
            id="announce"
            checked={announce}
            onChange={setAnnounce}
            label="Announce early"
            hint="Show the banner and popup before the sale starts, to build excitement."
            disabled={c.status === 'live' || c.status === 'ended'}
          />
        </section>

        <section className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 sm:p-6 space-y-4">
          <Toggle id="banner" checked={bannerEnabled} onChange={setBannerEnabled} label="Moving banner" hint="Scrolls across the top of every store page." />
          <div>
            <label htmlFor="banner-text" className="block text-sm font-semibold text-gray-700 mb-1">Banner text</label>
            <input
              id="banner-text"
              value={bannerText}
              onChange={(e) => setBannerText(e.target.value)}
              maxLength={160}
              disabled={!bannerEnabled}
              placeholder="Black Friday sales!!! Enjoy massive discounts, 10 to 40% off"
              className="w-full px-4 py-2.5 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50"
            />
            <p className="text-xs text-gray-500 mt-1 text-right tabular-nums">{bannerText.length}/160</p>
          </div>
        </section>

        <section className="bg-white rounded-xl border border-gray-200 shadow-sm p-5 sm:p-6 space-y-4">
          <Toggle id="popup" checked={popupEnabled} onChange={setPopupEnabled} label="Welcome popup" hint="Shown once to each visitor shortly after they arrive. Never on cart or checkout." />
          <div>
            <label htmlFor="popup-title" className="block text-sm font-semibold text-gray-700 mb-1">Headline</label>
            <input
              id="popup-title"
              value={popupTitle}
              onChange={(e) => setPopupTitle(e.target.value)}
              maxLength={80}
              disabled={!popupEnabled}
              className="w-full px-4 py-2.5 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50"
            />
          </div>
          <div>
            <label htmlFor="popup-message" className="block text-sm font-semibold text-gray-700 mb-1">Message</label>
            <textarea
              id="popup-message"
              value={popupMessage}
              onChange={(e) => setPopupMessage(e.target.value)}
              maxLength={300}
              rows={3}
              disabled={!popupEnabled}
              className="w-full px-4 py-2.5 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50 resize-y"
            />
            <p className="text-xs text-gray-500 mt-1 text-right tabular-nums">{popupMessage.length}/300</p>
          </div>
          <div>
            <label htmlFor="popup-cta" className="block text-sm font-semibold text-gray-700 mb-1">Button label</label>
            <input
              id="popup-cta"
              value={cta}
              onChange={(e) => setCta(e.target.value)}
              maxLength={30}
              disabled={!popupEnabled}
              placeholder="Shop the sale"
              className="w-full sm:w-64 px-4 py-2.5 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 disabled:bg-gray-50"
            />
            <p className="text-xs text-gray-500 mt-1">Opens the sale page once prices are live, the shop before that. The popup also shows the discount range and a countdown when the sale has an end time.</p>
          </div>
        </section>

        {error && <p className="text-sm text-red-600" role="alert">{error}</p>}
        <div className="sticky bottom-4 z-10">
          <button
            type="button"
            onClick={save}
            disabled={!dirty || saving}
            className="w-full sm:w-auto px-6 py-3 rounded-lg bg-blue-700 hover:bg-blue-800 text-white font-semibold shadow-lg cursor-pointer disabled:opacity-50 disabled:shadow-none disabled:cursor-not-allowed"
          >
            {saving ? 'Saving…' : dirty ? 'Save banner & popup' : 'All changes saved'}
          </button>
        </div>
      </div>

      <div className="lg:sticky lg:top-24">
        <PromoPreview
          bannerEnabled={bannerEnabled}
          bannerText={bannerText}
          popupEnabled={popupEnabled}
          popupTitle={popupTitle}
          popupMessage={popupMessage}
          ctaLabel={cta}
          name={c.name}
        />
      </div>
    </div>
  );
}

function Toggle({
  id,
  checked,
  onChange,
  label,
  hint,
  disabled,
}: {
  id: string;
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  hint: string;
  disabled?: boolean;
}) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div>
        <label htmlFor={id} className="font-semibold text-gray-900">{label}</label>
        <p className="text-sm text-gray-500">{hint}</p>
      </div>
      <button
        id={id}
        type="button"
        role="switch"
        aria-checked={checked}
        disabled={disabled}
        onClick={() => onChange(!checked)}
        className={`relative shrink-0 w-12 h-7 rounded-full transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed ${checked ? 'bg-blue-700' : 'bg-gray-300'}`}
      >
        <span className={`absolute top-1 left-1 w-5 h-5 rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-5' : ''}`} />
      </button>
    </div>
  );
}

function ConfirmDialog({
  kind,
  campaign: c,
  itemCount,
  busy,
  onCancel,
  onConfirm,
}: {
  kind: 'start' | 'end' | 'delete';
  campaign: CampaignRow;
  itemCount: number;
  busy: boolean;
  onCancel: () => void;
  onConfirm: () => void;
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && !busy && onCancel();
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, [busy, onCancel]);

  const copy = {
    start: {
      title: `Start ${c.name} now?`,
      body: `${itemCount} product price${itemCount === 1 ? '' : 's'} drop straight away on the website and in the POS. Shoppers see the old price crossed out.${c.ends_at ? ` It ends on its own on ${formatWhen(c.ends_at)}.` : ' It runs until you end it.'}`,
      action: 'Start sale',
      tone: 'bg-green-700 hover:bg-green-800',
    },
    end: {
      title: `End ${c.name}?`,
      body: 'Regular prices come back straight away, and the banner and popup stop showing. Orders already placed keep their sale price.',
      action: 'End sale',
      tone: 'bg-red-600 hover:bg-red-700',
    },
    delete: {
      title: `Delete ${c.name}?`,
      body: 'The campaign and its product list are removed. Product prices are not affected. This cannot be undone.',
      action: 'Delete',
      tone: 'bg-red-600 hover:bg-red-700',
    },
  }[kind];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/50" onClick={() => !busy && onCancel()} aria-hidden="true" />
      <div role="alertdialog" aria-modal="true" aria-labelledby="confirm-title" aria-describedby="confirm-body" className="relative w-full max-w-md bg-white rounded-2xl shadow-xl p-6">
        <h2 id="confirm-title" className="text-lg font-bold text-gray-900">{copy.title}</h2>
        <p id="confirm-body" className="mt-2 text-sm text-gray-600 leading-relaxed">{copy.body}</p>
        <div className="mt-6 flex flex-col-reverse sm:flex-row sm:justify-end gap-2">
          <button type="button" onClick={onCancel} disabled={busy} className="px-5 py-2.5 border-2 border-gray-300 rounded-lg font-semibold text-gray-700 hover:bg-gray-50 cursor-pointer disabled:opacity-50">
            Cancel
          </button>
          <button type="button" onClick={onConfirm} disabled={busy} autoFocus className={`px-5 py-2.5 rounded-lg text-white font-semibold cursor-pointer disabled:opacity-60 inline-flex items-center justify-center gap-2 ${copy.tone}`}>
            {busy && <i className="ri-loader-4-line animate-spin" aria-hidden="true" />}
            {copy.action}
          </button>
        </div>
      </div>
    </div>
  );
}
