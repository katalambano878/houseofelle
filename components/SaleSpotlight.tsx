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
import { whatsappLink } from '@/components/sale/SaleBits';

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
  const whatsapp = getSetting('contact_whatsapp') || '0570551050';
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

  const tiles = countdown
    ? [
        ['Days', countdown.days],
        ['Hours', countdown.hours],
        ['Minutes', countdown.minutes],
        ['Seconds', countdown.seconds],
      ]
    : null;

  return (
    <section aria-labelledby="sale-spotlight-title" className="bg-[#C89B3C] text-[#14100D]">
      <div className="max-w-[1360px] mx-auto px-5 sm:px-8 lg:px-12 py-14 md:py-24 grid gap-10 lg:grid-cols-[1.1fr_1fr] lg:gap-16 lg:items-end">
        <div className="flex flex-col gap-2">
          <h2 id="sale-spotlight-title" className="font-serif italic text-[28px] md:text-[44px] leading-none">
            {title}
            <span className="sr-only">{promo.live ? ', on now' : ', coming soon'}</span>
          </h2>
          {range ? (
            <p className="flex items-start gap-3 md:gap-5">
              <span className="font-serif text-[132px] sm:text-[180px] lg:text-[240px] leading-[0.82] tracking-[-0.05em] tabular-nums">{range.max}%</span>
              <span className="pt-3 md:pt-6 text-sm md:text-lg font-semibold leading-snug">
                off
                {range.min !== range.max && (
                  <>
                    <br />
                    at most
                  </>
                )}
              </span>
            </p>
          ) : (
            <p className="font-serif text-6xl md:text-8xl leading-none">{promo.live ? 'On now' : 'Coming soon'}</p>
          )}
        </div>

        <div className="flex flex-col gap-7">
          {message && <p className="text-base md:text-lg leading-relaxed max-w-md text-pretty">{message}</p>}
          {range && range.min !== range.max && (
            <p className="-mt-4 text-sm font-medium">Savings of {formatRange(range)} on selected items.</p>
          )}

          {tiles ? (
            <div role="timer" aria-label={`${timing.label} ${countdown!.days} days ${countdown!.hours} hours ${countdown!.minutes} minutes`}>
              <p className="text-xs font-semibold mb-2">{timing.label}</p>
              <div className="grid grid-cols-4 gap-2 max-w-sm">
                {tiles.map(([label, v]) => (
                  <span key={label as string} className="flex flex-col items-center gap-1 rounded-2xl bg-[#14100D] text-[#F5EDE4] pt-3.5 pb-2.5">
                    <span className="text-2xl md:text-[34px] font-semibold leading-none tabular-nums">{String(v).padStart(2, '0')}</span>
                    <span className="text-[10px] md:text-[11px] font-semibold text-[#BFAF9F]">{label}</span>
                  </span>
                ))}
              </div>
            </div>
          ) : (
            <p className="text-sm font-medium">{promo.live ? 'Limited time only, while stocks last.' : 'Dropping soon. Save your favourites now so you are ready.'}</p>
          )}

          {products.length > 0 && (
            <ul className="grid grid-cols-4 gap-2 max-w-md" aria-label="Top deals">
              {products.map((p) => {
                const img = [...(p.product_images || [])].sort((a, b) => a.position - b.position)[0]?.url;
                return (
                  <li key={p.id}>
                    <Link href={`/product/${p.slug}`} className="group block" aria-label={`${p.name}, ${cedi(p.price)}, ${p.percent_off}% off`}>
                      <span className="relative block aspect-square rounded-2xl bg-[#F5EDE4] overflow-hidden">
                        {img && (
                          // eslint-disable-next-line @next/next/no-img-element
                          <img src={img} alt="" loading="lazy" className="absolute inset-[8%] h-[84%] w-[84%] object-contain mix-blend-multiply transition-transform duration-500 group-hover:scale-105" />
                        )}
                        <span className="absolute top-1.5 left-1.5 rounded-full bg-[#14100D] px-1.5 py-0.5 text-[10px] font-bold text-[#F5EDE4] tabular-nums">-{p.percent_off}%</span>
                      </span>
                    </Link>
                  </li>
                );
              })}
            </ul>
          )}

          <div className="flex flex-col sm:flex-row gap-3">
            <Link
              href={promoHref(promo)}
              className="inline-flex whitespace-nowrap items-center justify-center gap-2 min-h-[54px] px-8 rounded-full bg-[#14100D] text-[#F5EDE4] font-semibold active:scale-[0.98] transition-transform motion-reduce:active:scale-100"
            >
              {promo.live ? promo.popup?.cta_label || 'Shop the sale' : 'Browse the collection'}
            </Link>
            <a
              href={whatsappLink(whatsapp, `Hello House of Elle, I'd like to know more about the ${promo.name} sale.`)}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex whitespace-nowrap items-center justify-center gap-2 min-h-[54px] px-8 rounded-full shadow-[inset_0_0_0_1.5px_#14100D] font-semibold hover:bg-[#14100D]/5 transition-colors"
            >
              <i className="ri-whatsapp-line text-lg" aria-hidden="true" />
              {promo.live ? 'Order on WhatsApp' : 'Reserve on WhatsApp'}
            </a>
          </div>
        </div>
      </div>
    </section>
  );
}
