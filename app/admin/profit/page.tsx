'use client';

import Link from 'next/link';
import { useCallback, useEffect, useId, useMemo, useState } from 'react';
import { adminFetch, cedis } from '@/lib/admin-fetch';
import { formatDateTime } from '@/lib/report-dates';
import {
  EmptyState,
  ErrorBanner,
  Flash,
  MoneyInput,
  PageHeader,
  Panel,
  SkeletonRows,
  SkeletonStats,
  Stat,
  btnSecondary,
  csvMoney,
  downloadCsv,
  inputBase,
  labelBase,
  parseMoney,
} from '@/components/admin/reports/ReportKit';

type Variant = {
  id: string;
  name: string;
  sku: string | null;
  stock: number | null;
  currentPrice: number;
  regularPrice: number;
  onSale: boolean;
  cost: number | null;
  effectiveCost: number | null;
  costInherited: boolean;
};

type Product = {
  id: string;
  name: string;
  slug: string;
  sku: string | null;
  status: string;
  category: string | null;
  image: string | null;
  stock: number | null;
  currentPrice: number;
  regularPrice: number;
  onSale: boolean;
  campaign: { id: string; name: string; percentOff: number | null; endsAt: string | null } | null;
  cost: number | null;
  variants: Variant[];
  units30d: number;
  revenue30d: number;
};

type Filter = 'all' | 'missing' | 'low' | 'loss' | 'sale';
type SortKey = 'name' | 'margin_asc' | 'margin_desc' | 'profit_desc' | 'price_desc' | 'sold_desc';

const SORTS: { key: SortKey; label: string }[] = [
  { key: 'margin_asc', label: 'Lowest margin first' },
  { key: 'margin_desc', label: 'Highest margin first' },
  { key: 'profit_desc', label: 'Most profit per unit' },
  { key: 'price_desc', label: 'Highest price' },
  { key: 'sold_desc', label: 'Best sellers (30 days)' },
  { key: 'name', label: 'Name A–Z' },
];

const THRESHOLD_KEY = 'hoe-profit-low-margin';
const DEFAULT_THRESHOLD = 25;

type Margin = { amount: number; pct: number } | null;

function marginOf(price: number, cost: number | null): Margin {
  if (cost == null || !(price > 0)) return null;
  const amount = Math.round((price - cost) * 100) / 100;
  return { amount, pct: (amount / price) * 100 };
}

type Tone = 'none' | 'loss' | 'low' | 'ok';
function toneOf(m: Margin, threshold: number): Tone {
  if (!m) return 'none';
  if (m.amount < 0) return 'loss';
  if (m.pct < threshold) return 'low';
  return 'ok';
}

/** Every priced unit of a product: the product itself, then each variant. */
function units(p: Product) {
  const list = [{ price: p.regularPrice, sale: p.onSale ? p.currentPrice : null, cost: p.cost }];
  for (const v of p.variants) list.push({ price: v.regularPrice, sale: v.onSale ? v.currentPrice : null, cost: v.effectiveCost });
  return list;
}

/** The weakest margin among a product and its variants, at the price customers pay today. */
function worstMargin(p: Product): Margin {
  let worst: Margin = null;
  for (const u of units(p)) {
    const m = marginOf(u.sale ?? u.price, u.cost);
    if (m && (!worst || m.pct < worst.pct)) worst = m;
  }
  return worst;
}

function missingCost(p: Product): boolean {
  return p.cost == null && (p.variants.length === 0 || p.variants.some((v) => v.effectiveCost == null));
}

export default function ProfitPage() {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [flash, setFlash] = useState('');
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [sort, setSort] = useState<SortKey>('margin_asc');
  const [threshold, setThreshold] = useState(DEFAULT_THRESHOLD);
  const [thresholdText, setThresholdText] = useState(String(DEFAULT_THRESHOLD));
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [loadedAt, setLoadedAt] = useState<string | null>(null);

  useEffect(() => {
    try {
      const saved = Number(window.localStorage.getItem(THRESHOLD_KEY));
      if (Number.isFinite(saved) && saved > 0 && saved < 100) {
        setThreshold(saved);
        setThresholdText(String(saved));
      }
    } catch {
      /* storage unavailable */
    }
  }, []);

  const updateThreshold = (text: string) => {
    setThresholdText(text);
    const n = Number(text);
    if (Number.isFinite(n) && n > 0 && n < 100) {
      setThreshold(n);
      try {
        window.localStorage.setItem(THRESHOLD_KEY, String(n));
      } catch {
        /* storage unavailable */
      }
    }
  };

  const load = useCallback(async () => {
    setError('');
    try {
      const data = await adminFetch<{ products: Product[] }>('/api/admin/profit');
      setProducts(data.products);
      setLoadedAt(new Date().toISOString());
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not load products.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  /** Applies a saved cost locally so the table updates without a reload. */
  const applyCost = (productId: string, variantId: string | null, cost: number | null) => {
    setProducts((prev) =>
      prev.map((p) => {
        if (p.id !== productId) return p;
        if (variantId) {
          return {
            ...p,
            variants: p.variants.map((v) =>
              v.id === variantId ? { ...v, cost, effectiveCost: cost ?? p.cost, costInherited: cost == null && p.cost != null } : v
            ),
          };
        }
        return {
          ...p,
          cost,
          variants: p.variants.map((v) => (v.cost == null ? { ...v, effectiveCost: cost, costInherited: cost != null } : v)),
        };
      })
    );
  };

  const saveCost = async (product: Product, variant: Variant | null, cost: number | null) => {
    const res = await adminFetch<{ message: string; cost: number | null }>('/api/admin/profit', {
      method: 'PUT',
      body: JSON.stringify({ productId: product.id, variantId: variant?.id ?? null, cost }),
    });
    applyCost(product.id, variant?.id ?? null, res.cost);
    setFlash(res.message);
  };

  const campaigns = useMemo(() => {
    const map = new Map<string, { name: string; count: number }>();
    for (const p of products) {
      if (p.campaign) {
        const cur = map.get(p.campaign.id) || { name: p.campaign.name, count: 0 };
        cur.count += 1;
        map.set(p.campaign.id, cur);
      }
    }
    return [...map.values()];
  }, [products]);

  const stats = useMemo(() => {
    let costed = 0;
    let pctSum = 0;
    let salePctSum = 0;
    let saleCount = 0;
    let stockCost = 0;
    let stockRetail = 0;
    let profit30 = 0;
    let profit30Covered = 0;
    let loss = 0;
    let low = 0;
    for (const p of products) {
      const m = marginOf(p.regularPrice, p.cost);
      if (p.cost != null && m) {
        costed += 1;
        pctSum += m.pct;
        if (p.onSale) {
          const s = marginOf(p.currentPrice, p.cost);
          if (s) {
            salePctSum += s.pct;
            saleCount += 1;
          }
        }
      }
      const t = toneOf(worstMargin(p), threshold);
      if (t === 'loss') loss += 1;
      if (t === 'low') low += 1;

      if (p.variants.length) {
        for (const v of p.variants) {
          if (v.effectiveCost != null && v.stock && v.stock > 0) {
            stockCost += v.effectiveCost * v.stock;
            stockRetail += v.currentPrice * v.stock;
          }
        }
      } else if (p.cost != null && p.stock && p.stock > 0) {
        stockCost += p.cost * p.stock;
        stockRetail += p.currentPrice * p.stock;
      }

      if (p.units30d > 0 && p.cost != null) {
        profit30 += p.revenue30d - p.cost * p.units30d;
        profit30Covered += 1;
      }
    }
    return {
      costed,
      total: products.length,
      missing: products.filter(missingCost).length,
      avgPct: costed ? pctSum / costed : null,
      avgSalePct: saleCount ? salePctSum / saleCount : null,
      stockCost,
      stockProfit: stockRetail - stockCost,
      profit30,
      profit30Covered,
      sellers30: products.filter((p) => p.units30d > 0).length,
      loss,
      low,
      onSale: products.filter((p) => p.onSale).length,
    };
  }, [products, threshold]);

  const visible = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = products.filter((p) => {
      if (q) {
        const hay = `${p.name} ${p.sku || ''} ${p.category || ''} ${p.variants.map((v) => `${v.name} ${v.sku || ''}`).join(' ')}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      switch (filter) {
        case 'missing':
          return missingCost(p);
        case 'low':
          return toneOf(worstMargin(p), threshold) === 'low';
        case 'loss':
          return toneOf(worstMargin(p), threshold) === 'loss';
        case 'sale':
          return p.onSale;
        default:
          return true;
      }
    });
    const pct = (p: Product) => marginOf(p.onSale ? p.currentPrice : p.regularPrice, p.cost)?.pct ?? null;
    const amt = (p: Product) => marginOf(p.onSale ? p.currentPrice : p.regularPrice, p.cost)?.amount ?? null;
    const nullsLast = (a: number | null, b: number | null, dir: 1 | -1) => {
      if (a == null && b == null) return 0;
      if (a == null) return 1;
      if (b == null) return -1;
      return (a - b) * dir;
    };
    return [...list].sort((a, b) => {
      switch (sort) {
        case 'margin_asc':
          return nullsLast(pct(a), pct(b), 1) || a.name.localeCompare(b.name);
        case 'margin_desc':
          return nullsLast(pct(a), pct(b), -1) || a.name.localeCompare(b.name);
        case 'profit_desc':
          return nullsLast(amt(a), amt(b), -1) || a.name.localeCompare(b.name);
        case 'price_desc':
          return b.currentPrice - a.currentPrice || a.name.localeCompare(b.name);
        case 'sold_desc':
          return b.units30d - a.units30d || a.name.localeCompare(b.name);
        default:
          return a.name.localeCompare(b.name);
      }
    });
  }, [products, search, filter, sort, threshold]);

  const filters: { key: Filter; label: string; count: number; tone?: string }[] = [
    { key: 'all', label: 'All products', count: products.length },
    { key: 'missing', label: 'No cost yet', count: stats.missing },
    { key: 'low', label: `Below ${threshold}%`, count: stats.low, tone: 'text-amber-700' },
    { key: 'loss', label: 'Selling at a loss', count: stats.loss, tone: 'text-red-700' },
    { key: 'sale', label: 'On sale', count: stats.onSale },
  ];

  const toggle = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });

  const exportCsv = () => {
    const rows: unknown[][] = [
      ['Product', 'Variant', 'SKU', 'Category', 'Status', 'Regular price', 'Sale price', 'Campaign', 'Cost', 'Cost source', 'Regular margin', 'Regular margin %', 'Sale margin', 'Sale margin %', 'Stock', 'Units sold (30 days)'],
    ];
    const line = (p: Product, v: Variant | null) => {
      const regular = v ? v.regularPrice : p.regularPrice;
      const sale = v ? (v.onSale ? v.currentPrice : null) : p.onSale ? p.currentPrice : null;
      const cost = v ? v.effectiveCost : p.cost;
      const rm = marginOf(regular, cost);
      const sm = sale != null ? marginOf(sale, cost) : null;
      rows.push([
        p.name,
        v?.name ?? '',
        (v ? v.sku : p.sku) ?? '',
        p.category ?? '',
        p.status,
        csvMoney(regular),
        csvMoney(sale),
        sale != null ? p.campaign?.name ?? '' : '',
        csvMoney(cost),
        v ? (v.cost != null ? 'Variant' : v.costInherited ? 'Product' : '') : cost != null ? 'Product' : '',
        csvMoney(rm?.amount),
        rm ? rm.pct.toFixed(1) : '',
        csvMoney(sm?.amount),
        sm ? sm.pct.toFixed(1) : '',
        (v ? v.stock : p.stock) ?? '',
        v ? '' : p.units30d,
      ]);
    };
    for (const p of visible) {
      line(p, null);
      p.variants.forEach((v) => line(p, v));
    }
    downloadCsv(`house-of-elle-profit-margins-${new Date().toISOString().slice(0, 10)}.csv`, rows);
  };

  return (
    <div className="mx-auto max-w-7xl space-y-6">
      <PageHeader
        eyebrow="Reports · Owner only"
        title="Profit margins"
        description="Record what each product costs you. Margins use today's selling price, and products in a live sale show both the regular and the sale margin."
        actions={
          <button type="button" onClick={exportCsv} disabled={!visible.length} className={btnSecondary}>
            <i className="ri-download-2-line" aria-hidden="true" />
            Export CSV
          </button>
        }
      />

      <Flash message={flash} onDone={() => setFlash('')} />
      {error && <ErrorBanner message={error} onRetry={() => { setLoading(true); load(); }} />}

      {campaigns.length > 0 && (
        <div className="flex items-start gap-3 rounded-xl border border-blue-200 bg-blue-50 px-4 py-3 text-sm text-blue-800">
          <i className="ri-price-tag-3-line mt-0.5 text-lg text-blue-600" aria-hidden="true" />
          <p>
            {campaigns.map((c, i) => (
              <span key={c.name}>
                {i > 0 && ', '}
                <span className="font-semibold">{c.name}</span> is live on {c.count} {c.count === 1 ? 'product' : 'products'}
              </span>
            ))}
            . Customers pay the sale price, so the sale margin is what you earn on each one sold right now.{' '}
            <Link href="/admin/discounts" className="font-semibold underline underline-offset-2">Manage sales</Link>
          </p>
        </div>
      )}

      {loading ? (
        <SkeletonStats />
      ) : (
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat
            emphasis
            label="Average margin"
            icon="ri-scales-3-line"
            value={stats.avgPct == null ? '—' : `${stats.avgPct.toFixed(1)}%`}
            hint={
              stats.avgSalePct != null
                ? `At regular prices · ${stats.avgSalePct.toFixed(1)}% on sale items`
                : `At regular prices, ${stats.costed} costed products`
            }
          />
          <Stat
            label="Products with a cost"
            icon="ri-price-tag-2-line"
            tone={stats.missing ? 'warn' : 'good'}
            value={`${stats.costed} of ${stats.total}`}
            hint={stats.missing ? `${stats.missing} still need a cost price` : 'Every product has a cost'}
          />
          <Stat
            label="Stock at cost"
            icon="ri-archive-stack-line"
            tone="brand"
            value={cedis(stats.stockCost)}
            hint={`${cedis(stats.stockProfit)} profit if it all sells at today's prices`}
          />
          <Stat
            label="Gross profit, 30 days"
            icon="ri-line-chart-line"
            tone={stats.profit30 < 0 ? 'bad' : 'good'}
            value={cedis(stats.profit30)}
            hint={
              stats.sellers30
                ? `Paid sales of ${stats.profit30Covered} of ${stats.sellers30} products that sold have a cost`
                : 'No paid sales in the last 30 days'
            }
          />
        </div>
      )}

      <Panel flush>
        <div className="space-y-3 border-b border-gray-100 p-4 sm:p-5">
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-[1fr_220px_160px]">
            <div>
              <label htmlFor="profit-search" className={labelBase}>Search</label>
              <div className="relative">
                <i className="ri-search-line pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" aria-hidden="true" />
                <input
                  id="profit-search"
                  type="search"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Product, variant, SKU or category"
                  className={`${inputBase} pl-9`}
                />
              </div>
            </div>
            <div>
              <label htmlFor="profit-sort" className={labelBase}>Sort</label>
              <select id="profit-sort" value={sort} onChange={(e) => setSort(e.target.value as SortKey)} className={inputBase}>
                {SORTS.map((s) => (
                  <option key={s.key} value={s.key}>{s.label}</option>
                ))}
              </select>
            </div>
            <div>
              <label htmlFor="profit-threshold" className={labelBase}>Flag margins below</label>
              <div className="relative">
                <input
                  id="profit-threshold"
                  type="text"
                  inputMode="decimal"
                  value={thresholdText}
                  onChange={(e) => updateThreshold(e.target.value.replace(/[^0-9.]/g, ''))}
                  onBlur={() => setThresholdText(String(threshold))}
                  aria-describedby="profit-threshold-hint"
                  className={`${inputBase} pr-8 tabular-nums`}
                />
                <span className="pointer-events-none absolute inset-y-0 right-3 flex items-center text-sm text-gray-500">%</span>
              </div>
              <p id="profit-threshold-hint" className="sr-only">Between 1 and 99 percent. Saved on this device.</p>
            </div>
          </div>
          <div className="-mx-1 flex gap-1.5 overflow-x-auto px-1 pb-1" role="group" aria-label="Show">
            {filters.map((f) => (
              <button
                key={f.key}
                type="button"
                aria-pressed={filter === f.key}
                onClick={() => setFilter(f.key)}
                className={`flex shrink-0 items-center gap-1.5 rounded-full px-3.5 py-1.5 text-sm font-medium transition-colors ${
                  filter === f.key ? 'bg-blue-800 text-white' : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
              >
                <span className={filter === f.key ? '' : f.tone}>{f.label}</span>
                <span className={`rounded-full px-1.5 text-xs tabular-nums ${filter === f.key ? 'bg-white/20' : 'bg-white text-gray-600'}`}>{f.count}</span>
              </button>
            ))}
          </div>
        </div>

        {loading ? (
          <SkeletonRows rows={8} />
        ) : products.length === 0 ? (
          <EmptyState icon="ri-box-3-line" title="No products yet" body="Add products first, then record what each one costs you." action={<Link href="/admin/products/new" className={btnSecondary}>Add a product</Link>} />
        ) : visible.length === 0 ? (
          <EmptyState
            compact
            icon={filter === 'missing' ? 'ri-checkbox-circle-line' : 'ri-search-line'}
            title={filter === 'missing' && !search ? 'Every product has a cost price' : filter === 'loss' && !search ? 'Nothing is selling at a loss' : 'No products match'}
            body={search ? 'Try a different search.' : 'Pick another filter to see more products.'}
          />
        ) : (
          <>
            {/* Desktop table */}
            <div className="hidden overflow-x-auto lg:block">
              <table className="w-full text-sm">
                <thead className="bg-gray-50 text-left text-xs font-semibold uppercase tracking-wide text-gray-500">
                  <tr>
                    <th className="px-4 py-3">Product</th>
                    <th className="px-4 py-3 text-right">Price</th>
                    <th className="w-44 px-4 py-3">Cost per unit</th>
                    <th className="px-4 py-3 text-right">Regular margin</th>
                    <th className="px-4 py-3 text-right">Sale margin</th>
                    <th className="px-4 py-3 text-right">Sold, 30 days</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {visible.map((p) => {
                    const open = expanded.has(p.id);
                    return (
                      <ProductRows
                        key={p.id}
                        product={p}
                        open={open}
                        onToggle={() => toggle(p.id)}
                        threshold={threshold}
                        onSave={saveCost}
                      />
                    );
                  })}
                </tbody>
              </table>
            </div>

            {/* Phone and tablet cards */}
            <ul className="divide-y divide-gray-100 lg:hidden">
              {visible.map((p) => (
                <ProductCard key={p.id} product={p} open={expanded.has(p.id)} onToggle={() => toggle(p.id)} threshold={threshold} onSave={saveCost} />
              ))}
            </ul>

            <div className="flex flex-wrap items-center justify-between gap-2 border-t border-gray-100 bg-gray-50 px-4 py-3 text-xs text-gray-500 sm:px-5">
              <span>
                {visible.length} of {products.length} products · archived products are hidden
              </span>
              {loadedAt && <span>Prices as of {formatDateTime(loadedAt)}</span>}
            </div>
          </>
        )}
      </Panel>
    </div>
  );
}

type SaveFn = (product: Product, variant: Variant | null, cost: number | null) => Promise<void>;

function Thumb({ product }: { product: Product }) {
  const [broken, setBroken] = useState(false);
  return (
    <span className="flex h-10 w-10 shrink-0 items-center justify-center overflow-hidden rounded-lg bg-blue-50">
      {product.image && !broken ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={product.image} alt="" className="h-full w-full object-cover" loading="lazy" onError={() => setBroken(true)} />
      ) : (
        <i className="ri-image-line text-blue-300" aria-hidden="true" />
      )}
    </span>
  );
}

function SaleBadge({ product }: { product: Product }) {
  if (!product.campaign) return null;
  return (
    <span className="inline-flex items-center gap-1 whitespace-nowrap rounded-md bg-blue-500/15 px-1.5 py-0.5 text-xs font-semibold text-blue-800" title={product.campaign.endsAt ? `Ends ${formatDateTime(product.campaign.endsAt)}` : undefined}>
      <i className="ri-price-tag-3-fill text-blue-600" aria-hidden="true" />
      {product.campaign.name}
      {product.campaign.percentOff != null && <span className="font-normal">· {Number(product.campaign.percentOff)}% off</span>}
    </span>
  );
}

function PriceCell({ regular, current, onSale }: { regular: number; current: number; onSale: boolean }) {
  if (!onSale) return <span className="font-medium text-gray-900 tabular-nums">{cedis(regular)}</span>;
  return (
    <span className="inline-flex flex-col items-end leading-tight">
      <span className="font-semibold text-gray-900 tabular-nums">{cedis(current)}</span>
      <span className="text-xs text-gray-400 line-through tabular-nums">{cedis(regular)}</span>
    </span>
  );
}

const TONE_CLASS: Record<Tone, string> = {
  none: 'text-gray-400',
  loss: 'bg-red-50 text-red-700',
  low: 'bg-amber-50 text-amber-800',
  ok: 'bg-green-50 text-green-800',
};

function MarginPill({ margin, threshold, align = 'right' }: { margin: Margin; threshold: number; align?: 'right' | 'left' }) {
  const tone = toneOf(margin, threshold);
  if (!margin) return <span className="text-sm text-gray-400">—</span>;
  return (
    <span className={`inline-flex flex-col ${align === 'right' ? 'items-end' : 'items-start'} leading-tight`}>
      <span className={`inline-flex items-center gap-1 rounded-md px-1.5 py-0.5 text-sm font-semibold tabular-nums ${TONE_CLASS[tone]}`}>
        {tone === 'loss' && <i className="ri-arrow-down-line" aria-hidden="true" />}
        {tone === 'low' && <i className="ri-alert-line" aria-hidden="true" />}
        {margin.pct.toFixed(1)}%
      </span>
      <span className={`mt-0.5 text-xs tabular-nums ${margin.amount < 0 ? 'text-red-600' : 'text-gray-500'}`}>
        {margin.amount < 0 ? '−' : ''}
        {cedis(Math.abs(margin.amount))} each
      </span>
      {tone === 'loss' && <span className="sr-only">Selling at a loss</span>}
      {tone === 'low' && <span className="sr-only">Below {threshold}% margin</span>}
    </span>
  );
}

function ProductRows({ product: p, open, onToggle, threshold, onSave }: { product: Product; open: boolean; onToggle: () => void; threshold: number; onSave: SaveFn }) {
  const regular = marginOf(p.regularPrice, p.cost);
  const sale = p.onSale ? marginOf(p.currentPrice, p.cost) : null;
  return (
    <>
      <tr className="align-middle hover:bg-gray-50/60">
        <td className="px-4 py-3">
          <div className="flex items-center gap-3">
            <Thumb product={p} />
            <div className="min-w-0">
              <Link href={`/admin/products/${p.id}`} className="font-semibold text-gray-900 hover:text-blue-700">{p.name}</Link>
              <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-gray-500">
                {p.category && <span>{p.category}</span>}
                {p.sku && <span className="font-mono">{p.sku}</span>}
                {p.status === 'draft' && <span className="rounded bg-gray-100 px-1.5 font-medium text-gray-600">Draft</span>}
                <SaleBadge product={p} />
              </div>
              {p.variants.length > 0 && (
                <button type="button" onClick={onToggle} aria-expanded={open} className="mt-1 inline-flex items-center gap-1 text-xs font-semibold text-blue-700 hover:text-blue-800">
                  <i className={open ? 'ri-arrow-down-s-line' : 'ri-arrow-right-s-line'} aria-hidden="true" />
                  {p.variants.length} {p.variants.length === 1 ? 'variant' : 'variants'}
                </button>
              )}
            </div>
          </div>
        </td>
        <td className="whitespace-nowrap px-4 py-3 text-right">
          <PriceCell regular={p.regularPrice} current={p.currentPrice} onSale={p.onSale} />
        </td>
        <td className="px-4 py-3">
          <CostEditor label={p.name} value={p.cost} price={p.onSale ? p.currentPrice : p.regularPrice} onSave={(c) => onSave(p, null, c)} />
        </td>
        <td className="whitespace-nowrap px-4 py-3 text-right">
          <MarginPill margin={regular} threshold={threshold} />
        </td>
        <td className="whitespace-nowrap px-4 py-3 text-right">
          {p.onSale ? <MarginPill margin={sale} threshold={threshold} /> : <span className="text-xs text-gray-400">Not on sale</span>}
        </td>
        <td className="whitespace-nowrap px-4 py-3 text-right tabular-nums">
          <span className="font-medium text-gray-900">{p.units30d}</span>
          {p.stock != null && <p className="text-xs text-gray-500">{p.stock} in stock</p>}
        </td>
      </tr>
      {open &&
        p.variants.map((v) => (
          <tr key={v.id} className="bg-gray-50/70 align-middle">
            <td className="py-2.5 pl-[4.25rem] pr-4">
              <p className="font-medium text-gray-800">{v.name}</p>
              <p className="text-xs text-gray-500">
                {v.sku && <span className="mr-2 font-mono">{v.sku}</span>}
                {v.stock != null && `${v.stock} in stock`}
              </p>
            </td>
            <td className="whitespace-nowrap px-4 py-2.5 text-right">
              <PriceCell regular={v.regularPrice} current={v.currentPrice} onSale={v.onSale} />
            </td>
            <td className="px-4 py-2.5">
              <CostEditor
                label={`${p.name}, ${v.name}`}
                value={v.cost}
                inheritedFrom={v.costInherited ? p.cost : null}
                price={v.onSale ? v.currentPrice : v.regularPrice}
                onSave={(c) => onSave(p, v, c)}
              />
            </td>
            <td className="whitespace-nowrap px-4 py-2.5 text-right">
              <MarginPill margin={marginOf(v.regularPrice, v.effectiveCost)} threshold={threshold} />
            </td>
            <td className="whitespace-nowrap px-4 py-2.5 text-right">
              {v.onSale ? <MarginPill margin={marginOf(v.currentPrice, v.effectiveCost)} threshold={threshold} /> : <span className="text-xs text-gray-400">—</span>}
            </td>
            <td className="px-4 py-2.5" />
          </tr>
        ))}
    </>
  );
}

function ProductCard({ product: p, open, onToggle, threshold, onSave }: { product: Product; open: boolean; onToggle: () => void; threshold: number; onSave: SaveFn }) {
  const regular = marginOf(p.regularPrice, p.cost);
  const sale = p.onSale ? marginOf(p.currentPrice, p.cost) : null;
  return (
    <li className="px-4 py-4 sm:px-5">
      <div className="flex items-start gap-3">
        <Thumb product={p} />
        <div className="min-w-0 flex-1">
          <div className="flex items-start justify-between gap-3">
            <Link href={`/admin/products/${p.id}`} className="min-w-0 break-words font-semibold text-gray-900">{p.name}</Link>
            <PriceCell regular={p.regularPrice} current={p.currentPrice} onSale={p.onSale} />
          </div>
          <div className="mt-0.5 flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-gray-500">
            {p.category && <span>{p.category}</span>}
            {p.stock != null && <span>{p.stock} in stock</span>}
            <span>{p.units30d} sold in 30 days</span>
            <SaleBadge product={p} />
          </div>
        </div>
      </div>
      <div className="mt-3 grid grid-cols-1 gap-3 rounded-lg bg-gray-50 p-3 sm:grid-cols-3">
        <div>
          <p className="mb-1 text-xs font-semibold text-gray-600">Cost per unit</p>
          <CostEditor label={p.name} value={p.cost} price={p.onSale ? p.currentPrice : p.regularPrice} onSave={(c) => onSave(p, null, c)} />
        </div>
        <div className="flex items-start justify-between gap-2 sm:block">
          <p className="mb-1 text-xs font-semibold text-gray-600">Regular margin</p>
          <MarginPill margin={regular} threshold={threshold} align="left" />
        </div>
        {p.onSale && (
          <div className="flex items-start justify-between gap-2 sm:block">
            <p className="mb-1 text-xs font-semibold text-gray-600">Sale margin</p>
            <MarginPill margin={sale} threshold={threshold} align="left" />
          </div>
        )}
      </div>
      {p.variants.length > 0 && (
        <div className="mt-2">
          <button type="button" onClick={onToggle} aria-expanded={open} className="inline-flex items-center gap-1 py-1 text-sm font-semibold text-blue-700">
            <i className={open ? 'ri-arrow-down-s-line' : 'ri-arrow-right-s-line'} aria-hidden="true" />
            {p.variants.length} {p.variants.length === 1 ? 'variant' : 'variants'}
          </button>
          {open && (
            <ul className="mt-2 space-y-2">
              {p.variants.map((v) => (
                <li key={v.id} className="rounded-lg border border-gray-200 p-3">
                  <div className="flex items-start justify-between gap-3">
                    <p className="font-medium text-gray-800">{v.name}</p>
                    <PriceCell regular={v.regularPrice} current={v.currentPrice} onSale={v.onSale} />
                  </div>
                  <div className="mt-2 grid grid-cols-1 gap-3 sm:grid-cols-3">
                    <CostEditor
                      label={`${p.name}, ${v.name}`}
                      value={v.cost}
                      inheritedFrom={v.costInherited ? p.cost : null}
                      price={v.onSale ? v.currentPrice : v.regularPrice}
                      onSave={(c) => onSave(p, v, c)}
                    />
                    <div className="flex items-center justify-between gap-2 sm:block">
                      <span className="text-xs text-gray-500 sm:hidden">Regular</span>
                      <MarginPill margin={marginOf(v.regularPrice, v.effectiveCost)} threshold={threshold} align="left" />
                    </div>
                    {v.onSale && (
                      <div className="flex items-center justify-between gap-2 sm:block">
                        <span className="text-xs text-gray-500 sm:hidden">Sale</span>
                        <MarginPill margin={marginOf(v.currentPrice, v.effectiveCost)} threshold={threshold} align="left" />
                      </div>
                    )}
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      )}
    </li>
  );
}

/** Click to edit a cost; Enter saves, Escape cancels. Empty clears it. */
function CostEditor({
  label,
  value,
  price,
  inheritedFrom,
  onSave,
}: {
  label: string;
  value: number | null;
  price: number;
  inheritedFrom?: number | null;
  onSave: (cost: number | null) => Promise<void>;
}) {
  const uid = useId();
  const [editing, setEditing] = useState(false);
  const [text, setText] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const start = () => {
    setText(value != null ? String(value) : '');
    setError('');
    setEditing(true);
  };

  const parsed = parseMoney(text);
  const warn = parsed != null && price > 0 && parsed >= price ? 'This is at or above the selling price.' : '';

  const commit = async () => {
    if (text.trim() !== '' && parsed == null) {
      setError('Enter a number, like 45.50.');
      return;
    }
    if (parsed === value || (text.trim() === '' && value == null)) {
      setEditing(false);
      return;
    }
    setSaving(true);
    setError('');
    try {
      await onSave(text.trim() === '' ? null : parsed);
      setEditing(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not save.');
    } finally {
      setSaving(false);
    }
  };

  if (!editing) {
    if (value != null) {
      return (
        <button
          type="button"
          onClick={start}
          className="group inline-flex items-center gap-2 rounded-lg px-2 py-1.5 -mx-2 text-left font-medium text-gray-900 tabular-nums hover:bg-blue-50 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
          aria-label={`Edit cost for ${label}, currently ${cedis(value)}`}
        >
          {cedis(value)}
          <i className="ri-pencil-line text-gray-400 group-hover:text-blue-700" aria-hidden="true" />
        </button>
      );
    }
    return (
      <button
        type="button"
        onClick={start}
        className="inline-flex flex-col items-start rounded-lg border border-dashed border-gray-300 px-2.5 py-1.5 text-left text-sm font-medium text-gray-600 hover:border-blue-500 hover:bg-blue-50 hover:text-blue-800 focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
        aria-label={`Add cost for ${label}`}
      >
        <span className="inline-flex items-center gap-1">
          <i className="ri-add-line" aria-hidden="true" />
          {inheritedFrom != null ? 'Own cost' : 'Add cost'}
        </span>
        {inheritedFrom != null && <span className="text-xs font-normal text-gray-500 tabular-nums">Uses product cost {cedis(inheritedFrom)}</span>}
      </button>
    );
  }

  return (
    <div className="min-w-[10rem]">
      <div className="flex items-center gap-1.5">
        <MoneyInput
          id={`${uid}-cost`}
          value={text}
          onChange={setText}
          autoFocus
          disabled={saving}
          invalid={Boolean(error)}
          ariaLabel={`Cost for ${label}`}
          describedBy={error || warn ? `${uid}-msg` : undefined}
          className="flex-1"
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              e.preventDefault();
              commit();
            } else if (e.key === 'Escape') {
              e.preventDefault();
              setEditing(false);
            }
          }}
        />
        <button type="button" onClick={commit} disabled={saving} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-blue-700 text-white hover:bg-blue-800 disabled:opacity-50" aria-label="Save cost">
          <i className={saving ? 'ri-loader-4-line animate-spin' : 'ri-check-line'} aria-hidden="true" />
        </button>
        <button type="button" onClick={() => setEditing(false)} disabled={saving} className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg text-gray-500 hover:bg-gray-100" aria-label="Cancel">
          <i className="ri-close-line" aria-hidden="true" />
        </button>
      </div>
      {(error || warn) && (
        <p id={`${uid}-msg`} className={`mt-1 text-xs font-medium ${error ? 'text-red-600' : 'text-amber-700'}`}>
          {error || warn}
        </p>
      )}
      {!error && !warn && value != null && <p className="mt-1 text-xs text-gray-400">Clear the box to remove the cost.</p>}
    </div>
  );
}
