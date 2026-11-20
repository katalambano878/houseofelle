'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import ProductCard from '@/components/ProductCard';
import ProductCardSkeleton from '@/components/skeletons/ProductCardSkeleton';
import type { StorefrontPromo } from '@/hooks/usePromo';

type SaleProduct = {
  id: string;
  name: string;
  slug: string;
  price: number;
  compare_at_price: number | null;
  quantity: number;
  moq: number | null;
  rating_avg: number | null;
  review_count: number | null;
  percent_off: number;
  category: string | null;
  category_slug: string | null;
  product_images: { url: string; position: number }[];
  product_variants: { price: number | null; quantity: number | null }[];
};

type SortKey = 'discount' | 'price-asc' | 'price-desc' | 'name';

const SORTS: { key: SortKey; label: string }[] = [
  { key: 'discount', label: 'Biggest saving' },
  { key: 'price-asc', label: 'Price: low to high' },
  { key: 'price-desc', label: 'Price: high to low' },
  { key: 'name', label: 'A to Z' },
];

function useCountdown(endsAt: string | null | undefined) {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    if (!endsAt) return;
    const t = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(t);
  }, [endsAt]);
  if (!endsAt) return null;
  const ms = new Date(endsAt).getTime() - now;
  if (ms <= 0) return null;
  return [
    ['Days', Math.floor(ms / 86_400_000)],
    ['Hours', Math.floor((ms % 86_400_000) / 3_600_000)],
    ['Minutes', Math.floor((ms % 3_600_000) / 60_000)],
    ['Seconds', Math.floor((ms % 60_000) / 1000)],
  ] as const;
}

export default function SalePage() {
  const [promo, setPromo] = useState<StorefrontPromo | null>(null);
  const [products, setProducts] = useState<SaleProduct[]>([]);
  const [loading, setLoading] = useState(true);
  const [failed, setFailed] = useState(false);
  const [category, setCategory] = useState('all');
  const [minPercent, setMinPercent] = useState(0);
  const [sort, setSort] = useState<SortKey>('discount');
  const countdown = useCountdown(promo?.live ? promo.ends_at : null);

  useEffect(() => {
    document.title = 'Sale | House of Elle';
    fetch('/api/storefront/promo?products=1', { cache: 'no-store' })
      .then((r) => (r.ok ? r.json() : Promise.reject()))
      .then((d) => {
        setPromo(d.promo ?? null);
        setProducts(Array.isArray(d.products) ? d.products : []);
      })
      .catch(() => setFailed(true))
      .finally(() => setLoading(false));
  }, []);

  const categories = useMemo(() => {
    const map = new Map<string, number>();
    products.forEach((p) => p.category && map.set(p.category, (map.get(p.category) || 0) + 1));
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  }, [products]);

  const tiers = useMemo(() => {
    // Only thresholds that actually narrow the list.
    const steps = [10, 20, 30, 40, 50].filter(
      (t) => products.some((p) => p.percent_off >= t) && products.some((p) => p.percent_off < t)
    );
    return steps;
  }, [products]);

  const shown = useMemo(() => {
    const list = products.filter(
      (p) => (category === 'all' || p.category === category) && p.percent_off >= minPercent
    );
    const sorted = [...list];
    if (sort === 'discount') sorted.sort((a, b) => b.percent_off - a.percent_off || a.name.localeCompare(b.name));
    if (sort === 'price-asc') sorted.sort((a, b) => a.price - b.price);
    if (sort === 'price-desc') sorted.sort((a, b) => b.price - a.price);
    if (sort === 'name') sorted.sort((a, b) => a.name.localeCompare(b.name));
    return sorted;
  }, [products, category, minPercent, sort]);

  const range =
    promo && promo.max_percent > 0
      ? promo.min_percent === promo.max_percent
        ? `${promo.max_percent}%`
        : `${promo.min_percent}–${promo.max_percent}%`
      : null;

  const live = Boolean(promo?.live && products.length);

  return (
    <main className="min-h-screen bg-[#F1E8DC]">
      <section className="relative overflow-hidden bg-blue-800 text-white">
        <svg
          className="pointer-events-none absolute -right-24 -top-24 w-[28rem] h-[28rem] text-blue-500/20"
          viewBox="0 0 200 200"
          fill="none"
          aria-hidden="true"
        >
          <circle cx="100" cy="100" r="99" stroke="currentColor" />
          <circle cx="100" cy="100" r="80" stroke="currentColor" />
          <circle cx="100" cy="100" r="61" stroke="currentColor" />
          <circle cx="100" cy="100" r="42" stroke="currentColor" />
        </svg>
        <div className="relative max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-14 sm:py-20">
          <nav className="text-sm text-white/60 mb-6" aria-label="Breadcrumb">
            <Link href="/" className="hover:text-white">Home</Link>
            <span className="mx-2" aria-hidden="true">/</span>
            <span className="text-white/90">Sale</span>
          </nav>
          {loading ? (
            <div className="space-y-4 animate-pulse" aria-hidden="true">
              <div className="h-4 w-40 bg-white/15 rounded" />
              <div className="h-12 w-3/4 max-w-xl bg-white/15 rounded" />
              <div className="h-5 w-2/3 max-w-md bg-white/10 rounded" />
            </div>
          ) : (
            <div className="grid lg:grid-cols-[1.3fr_1fr] gap-10 items-end">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.3em] text-blue-500">
                  {promo ? (live ? `${promo.name} · On now` : `${promo.name} · Coming soon`) : 'House of Elle'}
                </p>
                <h1 className="mt-4 font-serif text-4xl sm:text-6xl leading-[1.05] text-balance">
                  {live && range ? (
                    <>
                      Up to <span className="text-blue-500">{promo!.max_percent}%</span> off
                      <span className="block text-white/90 text-3xl sm:text-4xl mt-2">perfumes, mists &amp; candles</span>
                    </>
                  ) : promo ? (
                    promo.popup?.title || promo.name
                  ) : (
                    'No sale on right now'
                  )}
                </h1>
                <p className="mt-5 max-w-xl text-white/75 leading-relaxed text-pretty">
                  {live
                    ? `${products.length} hand-picked ${products.length === 1 ? 'product is' : 'products are'} on sale${range ? `, ${range} off` : ''}. Prices are already reduced; no code needed.`
                    : promo
                      ? promo.popup?.message || 'Our next sale is on its way. Check back soon.'
                      : 'Browse the full collection, or come back soon for our next sale.'}
                </p>
              </div>
              {countdown && (
                <div aria-label="Time left in the sale">
                  <p className="text-xs font-semibold uppercase tracking-wider text-white/60 mb-3">Sale ends in</p>
                  <div className="grid grid-cols-4 gap-2 sm:gap-3 max-w-md">
                    {countdown.map(([label, value]) => (
                      <div key={label} className="rounded-2xl bg-white/[0.07] ring-1 ring-white/10 py-3 sm:py-4 text-center">
                        <span className="block text-2xl sm:text-4xl font-bold tabular-nums">{String(value).padStart(2, '0')}</span>
                        <span className="block mt-1 text-[10px] sm:text-xs uppercase tracking-wider text-white/60">{label}</span>
                      </div>
                    ))}
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      </section>

      <section className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-10 sm:py-14">
        {loading ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
            {Array.from({ length: 8 }).map((_, i) => (
              <ProductCardSkeleton key={i} />
            ))}
          </div>
        ) : failed ? (
          <div className="text-center py-20">
            <p className="text-gray-700 font-semibold">We couldn&apos;t load the sale just now.</p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-4 px-5 py-2.5 rounded-lg border-2 border-gray-300 font-semibold text-gray-700 hover:bg-gray-50"
            >
              Try again
            </button>
          </div>
        ) : !live ? (
          <div className="text-center py-16 max-w-md mx-auto">
            <div className="w-16 h-16 mx-auto rounded-full bg-blue-50 flex items-center justify-center">
              <i className="ri-price-tag-3-line text-3xl text-blue-700" aria-hidden="true" />
            </div>
            <h2 className="mt-5 text-2xl font-serif text-gray-900">
              {promo ? 'The sale prices go live soon' : 'Nothing on sale today'}
            </h2>
            <p className="mt-2 text-gray-600">Our full collection is still here for you.</p>
            <Link
              href="/shop"
              className="mt-6 inline-flex items-center gap-2 px-6 py-3 rounded-xl bg-blue-700 hover:bg-blue-800 text-white font-semibold transition-colors"
            >
              Browse the collection <i className="ri-arrow-right-line" aria-hidden="true" />
            </Link>
          </div>
        ) : (
          <>
            <div className="flex flex-col gap-4 mb-8">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
                <p className="text-sm text-gray-600">
                  Showing <span className="font-semibold text-gray-900 tabular-nums">{shown.length}</span> of{' '}
                  <span className="tabular-nums">{products.length}</span> sale items
                </p>
                <label className="flex items-center gap-2 text-sm text-gray-600">
                  Sort by
                  <select
                    value={sort}
                    onChange={(e) => setSort(e.target.value as SortKey)}
                    className="px-3 py-2 pr-8 border-2 border-gray-200 rounded-lg text-gray-900 font-medium focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    {SORTS.map((s) => (
                      <option key={s.key} value={s.key}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              <div className="flex gap-2 overflow-x-auto pb-1 -mx-4 px-4 sm:mx-0 sm:px-0 sm:flex-wrap" role="group" aria-label="Filter sale items">
                <Chip active={category === 'all' && minPercent === 0} onClick={() => { setCategory('all'); setMinPercent(0); }}>
                  All
                </Chip>
                {tiers.map((t) => (
                  <Chip key={t} active={minPercent === t} onClick={() => setMinPercent(minPercent === t ? 0 : t)}>
                    {t}%+ off
                  </Chip>
                ))}
                {categories.length > 1 &&
                  categories.map(([name, count]) => (
                    <Chip key={name} active={category === name} onClick={() => setCategory(category === name ? 'all' : name)}>
                      {name} <span className="opacity-60 tabular-nums">{count}</span>
                    </Chip>
                  ))}
              </div>
            </div>

            {shown.length === 0 ? (
              <div className="text-center py-16">
                <p className="text-gray-700 font-semibold">No sale items match these filters.</p>
                <button
                  type="button"
                  onClick={() => {
                    setCategory('all');
                    setMinPercent(0);
                  }}
                  className="mt-3 text-blue-700 font-semibold hover:text-blue-800"
                >
                  Clear filters
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4 sm:gap-6">
                {shown.map((p) => {
                  const images = [...(p.product_images || [])].sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
                  const variants = p.product_variants || [];
                  const hasVariants = variants.length > 0;
                  const stock = hasVariants ? variants.reduce((s, v) => s + (Number(v.quantity) || 0), 0) : Number(p.quantity) || 0;
                  const variantPrices = variants.map((v) => Number(v.price)).filter((n) => n > 0);
                  return (
                    <ProductCard
                      key={p.id}
                      id={p.id}
                      slug={p.slug}
                      name={p.name}
                      price={Number(p.price)}
                      originalPrice={p.compare_at_price ? Number(p.compare_at_price) : undefined}
                      image={images[0]?.url || '/placeholder-product.svg'}
                      rating={Number(p.rating_avg) || 0}
                      reviewCount={Number(p.review_count) || 0}
                      inStock={stock > 0}
                      maxStock={stock || 50}
                      moq={p.moq || 1}
                      hasVariants={hasVariants}
                      minVariantPrice={variantPrices.length ? Math.min(...variantPrices) : undefined}
                    />
                  );
                })}
              </div>
            )}
          </>
        )}
      </section>
    </main>
  );
}

function Chip({ active, onClick, children }: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={active}
      className={`shrink-0 inline-flex items-center gap-1.5 px-4 py-2 rounded-full text-sm font-semibold border-2 transition-colors cursor-pointer ${
        active ? 'bg-blue-800 border-blue-800 text-white' : 'bg-white border-gray-200 text-gray-700 hover:border-gray-300'
      }`}
    >
      {children}
    </button>
  );
}
