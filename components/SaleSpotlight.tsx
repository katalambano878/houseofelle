'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import {
  formatRange,
  promoCountdownTarget,
  promoHref,
  promoRange,
  useCountdown,
  usePromo,
} from '@/hooks/usePromo';
import { useCMS } from '@/context/CMSContext';
import { CategoryChips, CountdownTiles, SALE_PERKS, whatsappLink } from '@/components/sale/SaleBits';

interface SaleProduct {
  id: string;
  name: string;
  slug: string;
  price: number;
  compare_at_price: number | null;
  percent_off: number;
  product_images: { url: string; position: number }[];
}

const cedi = (n: number) => `GH₵${Number(n).toLocaleString('en-GH', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;

/** Home page band announcing the current (or upcoming) sale. Renders nothing when there is none. */
export default function SaleSpotlight() {
  const promo = usePromo();
  const { getSetting } = useCMS();
  const whatsapp = getSetting('contact_whatsapp') || '0553347531';
  const [products, setProducts] = useState<SaleProduct[]>([]);
  const timing = promo ? promoCountdownTarget(promo) : { target: null, label: '' };
  const countdown = useCountdown(timing.target);

  useEffect(() => {
    if (!promo?.live || promo.product_count === 0) return;
    let alive = true;
    fetch('/api/storefront/promo?products=1')
      .then((r) => (r.ok ? r.json() : { products: [] }))
      .then((d) => alive && setProducts(((d.products as SaleProduct[]) || []).slice(0, 4)))
      .catch(() => {});
    return () => {
      alive = false;
    };
  }, [promo]);

  if (!promo) return null;

  const range = promoRange(promo);
  const title = promo.popup?.title || promo.name;
  const message = promo.popup?.message || promo.banner_text;

  return (
    <section aria-labelledby="sale-spotlight-title" className="bg-brand-ivory px-4 sm:px-6 pt-12 md:pt-20">
      <div className="relative max-w-[1400px] mx-auto overflow-hidden rounded-[2rem] bg-blue-800 text-white">
        <svg className="absolute -right-24 -top-24 w-[28rem] h-[28rem] text-blue-500/20" viewBox="0 0 200 200" fill="none" aria-hidden="true">
          <circle cx="100" cy="100" r="98" stroke="currentColor" />
          <circle cx="100" cy="100" r="74" stroke="currentColor" />
          <circle cx="100" cy="100" r="50" stroke="currentColor" />
        </svg>
        <div className="absolute -bottom-32 left-1/3 w-96 h-96 rounded-full bg-blue-500/15 blur-3xl" aria-hidden="true" />

        <div className="relative grid gap-10 lg:grid-cols-[1.15fr_1fr] px-6 py-10 sm:px-10 sm:py-14 lg:px-16 lg:py-16">
          {/* The offer */}
          <div>
            <p className="inline-flex items-center gap-2 text-[11px] sm:text-xs font-semibold uppercase tracking-[0.28em] text-blue-500">
              <span className={`w-1.5 h-1.5 rounded-full bg-blue-500 ${promo.live ? 'animate-pulse motion-reduce:animate-none' : ''}`} aria-hidden="true" />
              {promo.name} · {promo.live ? 'On now' : 'Coming soon'}
            </p>
            <h2 id="sale-spotlight-title" className="mt-4 font-serif text-4xl sm:text-5xl lg:text-6xl leading-[1.05] text-balance">
              {title}
            </h2>

            {range && (
              <div className="mt-6">
                <p className="text-sm uppercase tracking-[0.2em] text-white/60">{range.min === range.max ? 'Save' : 'Save up to'}</p>
                <p className="mt-1 flex items-baseline gap-3">
                  <span className="text-7xl sm:text-8xl font-bold tracking-tight text-blue-500 tabular-nums leading-none">{range.max}%</span>
                  <span className="text-xl text-white/80">off</span>
                </p>
              </div>
            )}

            {message && <p className="mt-5 max-w-xl text-white/80 text-lg leading-relaxed text-pretty">{message}</p>}
            {range && range.min !== range.max && (
              <p className="mt-2 text-sm text-white/60">Discounts from {formatRange(range)} on selected items.</p>
            )}

            <div className="mt-8">
              {countdown ? (
                <CountdownTiles countdown={countdown} label={timing.label} tone="dark" />
              ) : (
                <p className="text-sm text-white/70">
                  {promo.live ? 'Limited time only, while stocks last.' : 'Dropping soon. Save your favourites now so you are ready.'}
                </p>
              )}
            </div>

            <div className="mt-8 flex flex-col sm:flex-row sm:flex-wrap gap-3">
              <Link
                href={promoHref(promo)}
                className="inline-flex whitespace-nowrap items-center justify-center gap-2 rounded-full bg-blue-500 hover:bg-blue-400 text-blue-900 font-semibold px-7 py-3.5 transition-colors active:scale-[0.98] motion-reduce:active:scale-100"
              >
                {promo.live ? promo.popup?.cta_label || 'Shop the sale' : 'Browse the collection'}
                <i className="ri-arrow-right-line" aria-hidden="true" />
              </Link>
              <a
                href={whatsappLink(whatsapp, `Hello House of Elle, I'd like to know more about the ${promo.name} sale.`)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex whitespace-nowrap items-center justify-center gap-2 rounded-full ring-1 ring-white/25 hover:bg-white/10 text-white font-medium px-7 py-3.5 transition-colors"
              >
                <i className="ri-whatsapp-line text-lg" aria-hidden="true" />
                {promo.live ? 'Order on WhatsApp' : 'Reserve on WhatsApp'}
              </a>
            </div>
          </div>

          {/* What's included */}
          <div className="lg:pl-10 lg:border-l lg:border-white/10 flex flex-col gap-8">
            {products.length > 0 ? (
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/60 mb-3">Top deals</p>
                <ul className="grid grid-cols-2 gap-3">
                  {products.map((p) => {
                    const img = [...(p.product_images || [])].sort((a, b) => a.position - b.position)[0]?.url;
                    return (
                      <li key={p.id}>
                        <Link href={`/product/${p.slug}`} className="group block rounded-2xl bg-white/5 ring-1 ring-white/10 hover:bg-white/10 transition-colors overflow-hidden">
                          <div className="relative aspect-square bg-white/5">
                            {img && (
                              // eslint-disable-next-line @next/next/no-img-element
                              <img src={img} alt="" loading="lazy" className="absolute inset-0 h-full w-full object-cover transition-transform duration-500 group-hover:scale-105" />
                            )}
                            <span className="absolute top-2 left-2 rounded-full bg-blue-500 px-2 py-0.5 text-xs font-bold text-blue-900">-{p.percent_off}%</span>
                          </div>
                          <div className="p-3">
                            <p className="text-sm font-medium line-clamp-1">{p.name}</p>
                            <p className="mt-0.5 text-sm">
                              <span className="font-semibold text-blue-500">{cedi(p.price)}</span>
                              {p.compare_at_price ? <span className="ml-2 text-white/50 line-through">{cedi(p.compare_at_price)}</span> : null}
                            </p>
                          </div>
                        </Link>
                      </li>
                    );
                  })}
                </ul>
              </div>
            ) : (
              <div>
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/60 mb-3">On sale across</p>
                <CategoryChips tone="dark" />
              </div>
            )}

            <div>
              <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/60 mb-3">Why shop with us</p>
              <ul className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
                {SALE_PERKS.map((p) => (
                  <li key={p.title} className="flex items-start gap-3">
                    <span className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-white/10 text-blue-500">
                      <i className={p.icon} aria-hidden="true" />
                    </span>
                    <span className="text-sm leading-snug">
                      <span className="block font-semibold">{p.title}</span>
                      <span className="text-white/60">{p.text}</span>
                    </span>
                  </li>
                ))}
              </ul>
            </div>

            <p className="text-sm text-white/60">
              <i className="ri-map-pin-line mr-1 text-blue-500" aria-hidden="true" />
              Or visit our store at {getSetting('contact_address') || 'Spintex Lashibi, Shalom Spot Junction, Accra'}.
            </p>
          </div>
        </div>
      </div>
    </section>
  );
}
