'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import ProductCard from '@/components/ProductCard';
import ProductCardSkeleton from '@/components/skeletons/ProductCardSkeleton';
import type { StorefrontPromo } from '@/hooks/usePromo';
import { useCMS } from '@/context/CMSContext';
import { whatsappLink } from '@/components/sale/SaleBits';

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

/** Card colours for the savings-by-collection tiles, in turn. */
const TIER_TONES = [
  'bg-[#2B0B12] text-[#F6EDE3]',
  'bg-[#4A1520] text-[#F6EDE3]',
  'bg-[#FBF6EF] text-[#1F1115] shadow-[inset_0_0_0_1px_rgba(31,17,21,0.1)]',
  'bg-[#D9A441] text-[#2B0B12]',
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
  const { getSetting } = useCMS();
  // While live, count down to the end; while announced, to the start.
  const countdown = useCountdown(promo ? (promo.live ? promo.ends_at : promo.starts_at) : null);
  const countdownLabel = promo?.live ? 'Sale ends in' : 'Starts in';

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

  // Best real saving in each collection, from the sale items themselves.
  const collections = useMemo(() => {
    const map = new Map<string, number>();
    products.forEach((p) => p.category && map.set(p.category, Math.max(map.get(p.category) || 0, p.percent_off)));
    return [...map.entries()].sort((a, b) => b[1] - a[1]);
  }, [products]);

  const whatsapp = getSetting('contact_whatsapp') || '0570551050';
  const heading = promo ? promo.popup?.title || promo.name : 'No sale on right now';
  const intro = live
    ? `${products.length} hand-picked ${products.length === 1 ? 'product is' : 'products are'} on sale${range ? `, ${range} off` : ''}. Prices are already reduced; no code needed.`
    : promo
      ? promo.popup?.message || 'Our next sale is on its way. Check back soon.'
      : 'Browse the full collection, or come back soon for our next sale.';

  const btn = 'inline-flex whitespace-nowrap items-center justify-center gap-2 min-h-[56px] px-7 rounded-full text-[15px] font-semibold';

  return (
    <main className="min-h-screen bg-[#F1E8DC] text-[#1F1115]">
      <section aria-labelledby="sale-title" className="bg-[#E8C5BE] text-[#2B0B12]">
        <div className="max-w-[1360px] mx-auto px-5 sm:px-8 lg:px-12 pt-10 md:pt-[88px] pb-14 md:pb-24">
          <nav className="text-sm text-[#4A1520] mb-8 md:mb-10" aria-label="Breadcrumb">
            <Link href="/" className="underline-offset-2 hover:underline">Home</Link>
            <span className="mx-2" aria-hidden="true">/</span>
            <span aria-current="page">Sale</span>
          </nav>
          {loading ? (
            <div className="flex flex-col gap-5 animate-pulse motion-reduce:animate-none" aria-hidden="true">
              <div className="h-9 w-2/3 max-w-md rounded-full bg-[#2B0B12]/10" />
              <div className="h-28 w-1/2 max-w-sm rounded-[22px] bg-[#2B0B12]/10" />
            </div>
          ) : (
            <div className="grid gap-10 lg:grid-cols-[1.2fr_1fr] lg:gap-14 lg:items-end">
              <div className="flex flex-col gap-2">
                <h1 id="sale-title" className="font-serif italic text-[30px] md:text-[39px] leading-none text-balance">
                  {heading}
                  {promo && <span className="sr-only">{live ? ', on now' : ', coming soon'}</span>}
                </h1>
                {promo && promo.max_percent > 0 ? (
                  <p className="flex items-start gap-3 md:gap-5">
                    <span className="sr-only">Up to</span>
                    <span className="font-serif text-[96px] sm:text-[130px] lg:text-[150px] leading-[0.82] tracking-[-0.05em] tabular-nums">{promo.max_percent}%</span>
                    <span className="pt-2 md:pt-6 text-base md:text-lg font-bold leading-snug">
                      off
                      {promo.min_percent !== promo.max_percent && (
                        <>
                          <br />
                          at most
                        </>
                      )}
                    </span>
                  </p>
                ) : (
                  promo && <p className="font-serif text-[40px] md:text-[56px] leading-none">{live ? 'On now' : 'Coming soon'}</p>
                )}
              </div>

              <div className="flex flex-col gap-6 md:gap-7">
                <p className="text-[15px] md:text-base leading-relaxed max-w-[460px] text-pretty">{intro}</p>

                {countdown && (
                  <div role="timer" aria-label={`${countdownLabel} ${countdown.map(([l, v]) => `${v} ${l}`).join(' ')}`} className="flex flex-col gap-2.5">
                    <span className="text-[13px] font-bold">{countdownLabel}</span>
                    <div className="grid grid-cols-4 gap-2 max-w-[392px]">
                      {countdown.map(([label, value]) => (
                        <span key={label} className="flex flex-col items-center gap-1 rounded-[20px] bg-[#2B0B12] text-[#F6EDE3] pt-4 pb-3">
                          <span className="font-serif text-[24px] md:text-[29px] leading-none tabular-nums">{String(value).padStart(2, '0')}</span>
                          <span className="text-[11px] font-semibold text-[#E3CFC7]">{label}</span>
                        </span>
                      ))}
                    </div>
                  </div>
                )}

                <div className="flex flex-col sm:flex-row flex-wrap gap-3">
                  <a
                    href={whatsappLink(whatsapp, promo ? `Hello House of Elle, I'd like to know more about the ${promo.name} sale.` : "Hello House of Elle, I'd like some help choosing a scent.")}
                    target="_blank"
                    rel="noopener noreferrer"
                    className={`${btn} bg-[#2B0B12] text-[#F6EDE3] hover:bg-[#4A1520] transition-colors motion-reduce:transition-none`}
                  >
                    <i className="ri-whatsapp-line text-lg" aria-hidden="true" />
                    {live ? 'Order on WhatsApp' : promo ? 'Reserve on WhatsApp' : 'Ask us on WhatsApp'}
                  </a>
                  {live ? (
                    <a href="#deals" className={`${btn} shadow-[inset_0_0_0_1.5px_#2B0B12] hover:bg-[#2B0B12]/5 transition-colors motion-reduce:transition-none`}>
                      See the deals
                    </a>
                  ) : (
                    <Link href="/shop" className={`${btn} shadow-[inset_0_0_0_1.5px_#2B0B12] hover:bg-[#2B0B12]/5 transition-colors motion-reduce:transition-none`}>
                      Browse the collection
                    </Link>
                  )}
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      {live && collections.length > 1 && (
        <section aria-labelledby="sale-collections" className="max-w-[1360px] mx-auto px-5 sm:px-8 lg:px-12 pt-16 md:pt-24 pb-4 md:pb-8 flex flex-col gap-6 md:gap-8">
          <h2 id="sale-collections" className="font-serif text-[30px] md:text-[39px] leading-none">
            Savings by <em>collection</em>
          </h2>
          <ul className="grid grid-cols-2 lg:grid-cols-4 gap-3 md:gap-4">
            {collections.map(([name, best], i) => {
              const tone = TIER_TONES[i % TIER_TONES.length];
              return (
                <li key={name}>
                  <a
                    href="#deals"
                    onClick={() => {
                      setCategory(name);
                      setMinPercent(0);
                    }}
                    className={`flex h-full flex-col justify-between gap-8 md:gap-10 min-h-[170px] md:min-h-[230px] p-5 md:p-[26px] rounded-[24px] ${tone} transition-transform duration-300 hover:-translate-y-0.5 motion-reduce:transition-none motion-reduce:hover:translate-y-0`}
                  >
                    <span className="font-serif text-[19px] md:text-[21px] leading-[1.1]">{name}</span>
                    <span className="flex flex-col gap-0.5">
                      <span className="text-[13px] font-semibold">up to</span>
                      <span className="font-serif text-[36px] md:text-[43px] leading-[0.85] tracking-[-0.03em] tabular-nums">{best}%</span>
                    </span>
                  </a>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      <section id="deals" aria-label={live ? 'The deals' : undefined} className="scroll-mt-24 max-w-[1360px] mx-auto px-5 sm:px-8 lg:px-12 pt-14 md:pt-[72px] pb-20 md:pb-32">
        {loading ? (
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-x-4 gap-y-10 sm:gap-x-6 sm:gap-y-12">
            {Array.from({ length: 8 }).map((_, i) => (
              <ProductCardSkeleton key={i} />
            ))}
          </div>
        ) : failed ? (
          <div className="flex flex-col items-center gap-4 text-center py-16">
            <p className="font-serif text-[26px] leading-tight">We couldn&apos;t load the sale just now.</p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="min-h-[52px] px-7 rounded-full shadow-[inset_0_0_0_1.5px_#2B0B12] font-semibold hover:bg-[#2B0B12]/5 transition-colors motion-reduce:transition-none"
            >
              Try again
            </button>
          </div>
        ) : !live ? (
          <div className="flex flex-col items-center gap-3 text-center py-8 md:py-12 max-w-md mx-auto">
            <h2 className="font-serif text-[28px] md:text-[34px] leading-tight">
              {promo ? 'The sale prices go live soon' : 'Nothing on sale today'}
            </h2>
            <p className="text-[15px] text-[#6B565B]">Our full collection is still here for you.</p>
            <Link
              href="/shop"
              className="mt-3 inline-flex items-center gap-2 min-h-[54px] px-8 rounded-full bg-[#2B0B12] text-[#F6EDE3] font-semibold hover:bg-[#4A1520] transition-colors motion-reduce:transition-none"
            >
              Browse the collection <i className="ri-arrow-right-line" aria-hidden="true" />
            </Link>
          </div>
        ) : (
          <div className="flex flex-col gap-8 md:gap-10">
            <div className="flex flex-col gap-5">
              <div className="flex flex-wrap items-end justify-between gap-4">
                <h2 className="font-serif text-[30px] md:text-[39px] leading-none">
                  The <em>deals</em>
                </h2>
                <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
                  <p className="text-sm text-[#6B565B]" aria-live="polite">
                    Showing <span className="font-semibold text-[#1F1115] tabular-nums">{shown.length}</span> of{' '}
                    <span className="tabular-nums">{products.length}</span> sale items
                  </p>
                  <label className="flex items-center gap-2 text-sm text-[#6B565B]">
                    Sort by
                    <select
                      value={sort}
                      onChange={(e) => setSort(e.target.value as SortKey)}
                      className="h-11 pl-4 pr-9 rounded-full bg-[#FBF6EF] shadow-[inset_0_0_0_1px_rgba(31,17,21,0.18)] text-[#1F1115] font-semibold outline-none focus-visible:shadow-[inset_0_0_0_1.5px_#2B0B12]"
                    >
                      {SORTS.map((s) => (
                        <option key={s.key} value={s.key}>
                          {s.label}
                        </option>
                      ))}
                    </select>
                  </label>
                </div>
              </div>

              <div className="flex gap-2 overflow-x-auto pb-1 -mx-5 px-5 sm:mx-0 sm:px-0 sm:flex-wrap" role="group" aria-label="Filter sale items">
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
                      {name} <span className="opacity-70 tabular-nums">{count}</span>
                    </Chip>
                  ))}
              </div>
            </div>

            {shown.length === 0 ? (
              <div className="flex flex-col items-center gap-3 text-center py-14">
                <p className="font-serif text-[24px] leading-tight">No sale items match these filters.</p>
                <button
                  type="button"
                  onClick={() => {
                    setCategory('all');
                    setMinPercent(0);
                  }}
                  className="min-h-[44px] px-4 font-semibold text-[#7A1F2E] underline underline-offset-4"
                >
                  Clear filters
                </button>
              </div>
            ) : (
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-x-4 gap-y-10 sm:gap-x-6 sm:gap-y-12">
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
          </div>
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
      className={`shrink-0 inline-flex items-center gap-1.5 min-h-[44px] px-4 rounded-full text-sm font-semibold transition-colors motion-reduce:transition-none ${
        active ? 'bg-[#2B0B12] text-[#F6EDE3]' : 'bg-[#FBF6EF] text-[#1F1115] shadow-[inset_0_0_0_1px_rgba(31,17,21,0.16)] hover:bg-white'
      }`}
    >
      {children}
    </button>
  );
}
