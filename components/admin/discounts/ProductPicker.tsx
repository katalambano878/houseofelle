'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { money } from '@/lib/format-money';

type PickerProduct = {
  id: string;
  name: string;
  sku: string | null;
  price: number;
  quantity: number | null;
  status: string;
  category_id: string | null;
  categories: { name: string } | null;
  product_images: { url: string; position: number | null }[] | null;
};

const QUICK = [10, 15, 20, 25, 30, 40];

/** Slide-over for choosing products to add to a campaign, all at one discount. */
export default function ProductPicker({
  existingIds,
  busy,
  campaignName,
  onClose,
  onAdd,
  onAddAll,
}: {
  existingIds: Set<string>;
  busy: Map<string, string>;
  campaignName: string;
  onClose: () => void;
  onAdd: (ids: string[], percent: number) => Promise<void>;
  onAddAll: (percent: number) => Promise<void>;
}) {
  const [products, setProducts] = useState<PickerProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [query, setQuery] = useState('');
  const [category, setCategory] = useState('all');
  const [inStockOnly, setInStockOnly] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [percent, setPercent] = useState('20');
  const [saving, setSaving] = useState(false);
  const [confirmAll, setConfirmAll] = useState(false);
  const searchRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    searchRef.current?.focus();
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && !saving && onClose();
    document.addEventListener('keydown', onKey);
    const prev = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = prev;
    };
  }, [onClose, saving]);

  useEffect(() => {
    supabase
      .from('products')
      .select('id, name, sku, price, quantity, status, category_id, categories(name), product_images(url, position)')
      .neq('status', 'archived')
      .order('name')
      .limit(2000)
      .then(({ data, error: err }) => {
        if (err) setError(err.message || 'Could not load products.');
        else setProducts((data || []) as unknown as PickerProduct[]);
        setLoading(false);
      });
  }, []);

  const categories = useMemo(() => {
    const map = new Map<string, string>();
    products.forEach((p) => p.category_id && p.categories?.name && map.set(p.category_id, p.categories.name));
    return [...map.entries()].sort((a, b) => a[1].localeCompare(b[1]));
  }, [products]);

  const shown = useMemo(() => {
    const q = query.trim().toLowerCase();
    return products.filter((p) => {
      if (category !== 'all' && p.category_id !== category) return false;
      if (inStockOnly && !(Number(p.quantity) > 0)) return false;
      if (!q) return true;
      return p.name.toLowerCase().includes(q) || (p.sku || '').toLowerCase().includes(q);
    });
  }, [products, query, category, inStockOnly]);

  const selectable = shown.filter((p) => !existingIds.has(p.id) && Number(p.price) > 0);
  const allSelected = selectable.length > 0 && selectable.every((p) => selected.has(p.id));
  const pct = Number(percent);
  const pctValid = Number.isFinite(pct) && pct >= 1 && pct <= 90;
  const selectedBusy = [...selected].filter((id) => busy.has(id)).length;
  const activeCount = products.filter((p) => p.status === 'active' && Number(p.price) > 0).length;

  const toggle = (id: string) => {
    const next = new Set(selected);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelected(next);
  };

  const toggleAll = () => {
    const next = new Set(selected);
    if (allSelected) selectable.forEach((p) => next.delete(p.id));
    else selectable.forEach((p) => next.add(p.id));
    setSelected(next);
  };

  const add = async () => {
    if (!pctValid || selected.size === 0) return;
    setSaving(true);
    try {
      await onAdd([...selected], Math.round(pct * 10) / 10);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not add products.');
      setSaving(false);
    }
  };

  const addAll = async () => {
    if (!pctValid) return;
    setSaving(true);
    try {
      await onAddAll(Math.round(pct * 10) / 10);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Could not add products.');
      setSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex justify-end">
      <div className="absolute inset-0 bg-black/40 promo-backdrop-in" onClick={() => !saving && onClose()} aria-hidden="true" />
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="picker-title"
        className="relative w-full sm:max-w-xl h-full bg-white shadow-2xl flex flex-col"
      >
        <div className="px-5 pt-5 pb-4 border-b border-gray-100">
          <div className="flex items-start justify-between gap-4">
            <div>
              <h2 id="picker-title" className="text-lg font-bold text-gray-900">Add products to {campaignName}</h2>
              <p className="text-sm text-gray-500">Pick products, choose a discount, then fine-tune each one afterwards.</p>
            </div>
            <button type="button" onClick={onClose} aria-label="Close" className="w-9 h-9 shrink-0 flex items-center justify-center text-gray-500 hover:bg-gray-100 rounded-lg cursor-pointer">
              <i className="ri-close-line text-xl" aria-hidden="true" />
            </button>
          </div>

          <div className="mt-4 space-y-3">
            <div className="relative">
              <i className="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" aria-hidden="true" />
              <label htmlFor="picker-search" className="sr-only">Search products</label>
              <input
                id="picker-search"
                ref={searchRef}
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search by name or SKU"
                className="w-full pl-10 pr-4 py-2.5 border-2 border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            </div>
            <div className="flex flex-wrap items-center gap-3">
              <label htmlFor="picker-category" className="sr-only">Category</label>
              <select
                id="picker-category"
                value={category}
                onChange={(e) => setCategory(e.target.value)}
                className="flex-1 min-w-[10rem] px-3 py-2 border-2 border-gray-200 rounded-lg text-sm focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="all">All categories</option>
                {categories.map(([cid, name]) => (
                  <option key={cid} value={cid}>
                    {name}
                  </option>
                ))}
              </select>
              <label className="inline-flex items-center gap-2 text-sm text-gray-700 cursor-pointer">
                <input type="checkbox" checked={inStockOnly} onChange={(e) => setInStockOnly(e.target.checked)} className="w-4 h-4 accent-blue-700" />
                In stock only
              </label>
            </div>
          </div>
        </div>

        <div className="px-5 py-2.5 border-b border-gray-100 flex items-center justify-between text-sm bg-gray-50">
          <label className="inline-flex items-center gap-2 font-semibold text-gray-700 cursor-pointer">
            <input type="checkbox" checked={allSelected} onChange={toggleAll} disabled={!selectable.length} className="w-4 h-4 accent-blue-700" />
            Select all {selectable.length ? <span className="tabular-nums font-normal text-gray-500">({selectable.length})</span> : null}
          </label>
          <span className="text-gray-500 tabular-nums">{shown.length} shown</span>
        </div>

        <div className="flex-1 overflow-y-auto overscroll-contain">
          {loading ? (
            <ul className="divide-y divide-gray-50" aria-busy="true">
              {Array.from({ length: 8 }).map((_, i) => (
                <li key={i} className="px-5 py-3 flex items-center gap-3 animate-pulse">
                  <div className="w-4 h-4 bg-gray-100 rounded" />
                  <div className="w-11 h-11 bg-gray-100 rounded-lg" />
                  <div className="flex-1 h-4 bg-gray-100 rounded" />
                </li>
              ))}
            </ul>
          ) : error ? (
            <p className="p-8 text-center text-red-600">{error}</p>
          ) : shown.length === 0 ? (
            <p className="p-10 text-center text-gray-500">No products match these filters.</p>
          ) : (
            <ul className="divide-y divide-gray-50">
              {shown.map((p) => {
                const added = existingIds.has(p.id);
                const otherSale = busy.get(p.id);
                const noPrice = !(Number(p.price) > 0);
                const disabled = added || noPrice;
                const img = [...(p.product_images || [])].sort((a, b) => (a.position ?? 0) - (b.position ?? 0))[0]?.url;
                return (
                  <li key={p.id}>
                    <label
                      className={`px-5 py-3 flex items-center gap-3 ${disabled ? 'opacity-60' : 'cursor-pointer hover:bg-gray-50'} ${selected.has(p.id) ? 'bg-blue-50/60' : ''}`}
                    >
                      <input
                        type="checkbox"
                        checked={added || selected.has(p.id)}
                        disabled={disabled}
                        onChange={() => toggle(p.id)}
                        className="w-4 h-4 accent-blue-700 shrink-0"
                      />
                      <img src={img || '/house-of-elle-logo.png'} alt="" loading="lazy" className="w-11 h-11 rounded-lg object-cover bg-gray-100 shrink-0" />
                      <span className="flex-1 min-w-0">
                        <span className="block font-semibold text-gray-900 text-sm line-clamp-1">{p.name}</span>
                        <span className="block text-xs text-gray-500 truncate">
                          {[p.categories?.name, p.sku, Number(p.quantity) > 0 ? `${p.quantity} in stock` : 'Out of stock', p.status !== 'active' ? p.status : null]
                            .filter(Boolean)
                            .join(' · ')}
                        </span>
                        {added && <span className="block text-xs font-semibold text-blue-700">Already in this campaign</span>}
                        {!added && otherSale && <span className="block text-xs font-semibold text-amber-700">Discounted in {otherSale} right now</span>}
                      </span>
                      <span className="text-sm tabular-nums text-right shrink-0">
                        <span className="block text-gray-500">GH₵{money(p.price)}</span>
                        {selected.has(p.id) && pctValid && (
                          <span className="block font-semibold text-gray-900">GH₵{money(Math.round(Number(p.price) * (1 - pct / 100) * 100) / 100)}</span>
                        )}
                      </span>
                    </label>
                  </li>
                );
              })}
            </ul>
          )}
        </div>

        <div className="border-t border-gray-200 p-5 space-y-3 bg-white pb-[max(1.25rem,env(safe-area-inset-bottom))]">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-sm font-semibold text-gray-700 mr-1">Discount</span>
            {QUICK.map((q) => (
              <button
                key={q}
                type="button"
                onClick={() => setPercent(String(q))}
                aria-pressed={percent === String(q)}
                className={`px-3 py-1.5 rounded-lg text-sm font-semibold border-2 cursor-pointer ${
                  percent === String(q) ? 'bg-blue-700 border-blue-700 text-white' : 'border-gray-200 text-gray-700 hover:border-gray-300'
                }`}
              >
                {q}%
              </button>
            ))}
            <div className="relative w-24">
              <label htmlFor="picker-pct" className="sr-only">Custom discount percent</label>
              <input
                id="picker-pct"
                type="number"
                min={1}
                max={90}
                step={0.5}
                value={percent}
                onChange={(e) => setPercent(e.target.value)}
                className="w-full pl-3 pr-7 py-1.5 border-2 border-gray-200 rounded-lg text-right tabular-nums font-semibold focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 text-sm pointer-events-none">%</span>
            </div>
          </div>
          {!pctValid && <p className="text-xs text-red-600">Use a discount between 1% and 90%.</p>}
          {selectedBusy > 0 && (
            <p className="text-xs text-amber-800 bg-amber-50 rounded-lg px-3 py-2">
              {selectedBusy} selected product{selectedBusy === 1 ? ' is' : 's are'} in another live sale. They will keep that sale’s price until it ends.
            </p>
          )}

          {confirmAll ? (
            <div className="rounded-lg bg-blue-50 p-3 text-sm">
              <p className="text-blue-800">
                Add all <span className="font-semibold tabular-nums">{activeCount}</span> active products at{' '}
                <span className="font-semibold">{pctValid ? pct : '—'}%</span> off? You can change single products afterwards.
              </p>
              <div className="mt-3 flex gap-2">
                <button type="button" onClick={() => setConfirmAll(false)} className="px-3 py-2 rounded-lg border-2 border-gray-300 bg-white font-semibold text-gray-700 cursor-pointer">
                  Back
                </button>
                <button type="button" onClick={addAll} disabled={!pctValid || saving} className="px-3 py-2 rounded-lg bg-blue-700 text-white font-semibold cursor-pointer disabled:opacity-60">
                  {saving ? 'Adding…' : 'Add whole catalogue'}
                </button>
              </div>
            </div>
          ) : (
            <div className="flex flex-col-reverse sm:flex-row gap-2">
              <button
                type="button"
                onClick={() => setConfirmAll(true)}
                disabled={saving}
                className="px-4 py-2.5 rounded-lg border-2 border-gray-300 font-semibold text-gray-700 hover:bg-gray-50 cursor-pointer disabled:opacity-50"
              >
                Whole catalogue…
              </button>
              <button
                type="button"
                onClick={add}
                disabled={!pctValid || selected.size === 0 || saving}
                className="flex-1 px-4 py-2.5 rounded-lg bg-blue-700 hover:bg-blue-800 text-white font-semibold cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed inline-flex items-center justify-center gap-2"
              >
                {saving && <i className="ri-loader-4-line animate-spin" aria-hidden="true" />}
                {selected.size ? `Add ${selected.size} product${selected.size === 1 ? '' : 's'} at ${pctValid ? pct : '—'}% off` : 'Select products to add'}
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
