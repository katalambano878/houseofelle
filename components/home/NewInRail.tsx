'use client';

import Link from 'next/link';
import { useEffect, useRef, useState } from 'react';
import { useCart } from '@/context/CartContext';
import { money } from '@/lib/format-money';

export interface RailItem {
  id: string;
  slug: string;
  name: string;
  meta?: string;
  price: number;
  minVariantPrice?: number;
  hasVariants: boolean;
  image: string;
  stock: number;
  moq: number;
  badge?: string;
}

/** "New in the house": a sideways rail of large white tiles with arrows and a progress line. */
export default function NewInRail({ items, loading }: { items: RailItem[]; loading: boolean }) {
  const rail = useRef<HTMLDivElement>(null);
  const [progress, setProgress] = useState(0);
  const [atStart, setAtStart] = useState(true);
  const [atEnd, setAtEnd] = useState(false);
  const { addToCart } = useCart();

  const update = () => {
    const el = rail.current;
    if (!el) return;
    const max = el.scrollWidth - el.clientWidth;
    setProgress(max > 0 ? el.scrollLeft / max : 1);
    setAtStart(el.scrollLeft < 4);
    setAtEnd(el.scrollLeft > max - 4);
  };
  useEffect(update, [items]);

  const nudge = (dir: 1 | -1) => {
    const el = rail.current;
    if (!el) return;
    const reduce = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    el.scrollBy({ left: dir * el.clientWidth * 0.8, behavior: reduce ? 'auto' : 'smooth' });
  };

  if (!loading && items.length === 0) return null;
  const arrow = 'w-12 h-12 rounded-full inline-flex items-center justify-center transition-[opacity,background-color] disabled:opacity-35';

  return (
    <section aria-labelledby="newin-title" className="bg-[#FBF6EF] border-y border-[#1F1115]/8 py-16 md:py-24 text-[#1F1115]">
      <div className="max-w-[1360px] mx-auto px-5 sm:px-8 lg:px-12 flex flex-wrap items-end justify-between gap-6 mb-8 md:mb-9">
        <div className="flex flex-col gap-2.5">
          <h2 id="newin-title" className="font-serif text-[34px] md:text-[43px] leading-[0.95] tracking-[-0.02em]">
            New in the <em>house</em>
          </h2>
          <p className="text-[15px] text-[#6B565B]">The latest bottles on our Spintex shelf.</p>
        </div>
        <div className="flex items-center gap-2.5">
          <Link href="/shop?sort=new" className="mr-3 text-sm font-semibold pb-0.5 shadow-[inset_0_-1px_0_currentColor]">Shop all new in</Link>
          <button type="button" onClick={() => nudge(-1)} disabled={atStart} aria-label="Previous products" className={`${arrow} hidden sm:inline-flex shadow-[inset_0_0_0_1px_rgba(31,17,21,0.22)]`}>
            <i className="ri-arrow-left-line text-lg" aria-hidden="true" />
          </button>
          <button type="button" onClick={() => nudge(1)} disabled={atEnd} aria-label="Next products" className={`${arrow} hidden sm:inline-flex bg-[#2B0B12] text-[#F6EDE3]`}>
            <i className="ri-arrow-right-line text-lg" aria-hidden="true" />
          </button>
        </div>
      </div>

      <div
        ref={rail}
        onScroll={update}
        role="list"
        className="flex gap-3 sm:gap-5 overflow-x-auto snap-x snap-mandatory [scrollbar-width:none] [&::-webkit-scrollbar]:hidden px-5 sm:px-8 lg:pl-[max(48px,calc((100vw-1360px)/2+48px))] lg:pr-12 pb-2"
      >
        {(loading ? Array.from({ length: 5 }, () => null) : items).map((p, i) =>
          p ? (
            <article key={p.id} role="listitem" className="group flex-none w-[68%] sm:w-[290px] snap-start flex flex-col gap-3.5">
              <Link href={`/product/${p.slug}`} className="relative flex items-center justify-center h-[300px] sm:h-[360px] rounded-[22px] bg-white overflow-hidden">
                {p.badge && <span className="absolute top-4 left-4 z-[1] rounded-full bg-[#2B0B12] text-[#F6EDE3] text-[11px] font-bold px-3 py-1.5">{p.badge}</span>}
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={p.image} alt={p.name} loading="lazy" className="w-[80%] h-[80%] object-contain transition-transform duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-105 motion-reduce:transition-none" />
              </Link>
              <div className="flex items-center justify-between gap-3 px-1">
                <Link href={`/product/${p.slug}`} className="flex flex-col gap-0.5 min-w-0">
                  <span className="font-serif text-[19px] sm:text-xl leading-tight truncate">{p.name}</span>
                  {p.meta && <span className="text-[13px] text-[#6B565B] truncate">{p.meta}</span>}
                </Link>
                <span className="flex-none text-[15px] font-semibold tabular-nums">
                  {p.hasVariants && p.minVariantPrice ? `From GH₵${money(p.minVariantPrice)}` : `GH₵${money(p.price)}`}
                </span>
              </div>
              {p.stock <= 0 ? (
                <span className="h-[46px] inline-flex items-center justify-center rounded-full text-sm text-[#6B565B] shadow-[inset_0_0_0_1px_rgba(31,17,21,0.12)]">Sold out</span>
              ) : p.hasVariants ? (
                <Link href={`/product/${p.slug}`} className="h-[46px] inline-flex items-center justify-center rounded-full text-sm font-semibold shadow-[inset_0_0_0_1px_rgba(31,17,21,0.2)] group-hover:bg-[#2B0B12] group-hover:text-[#F6EDE3] group-hover:shadow-none transition-colors">
                  Choose an option
                </Link>
              ) : (
                <button
                  type="button"
                  onClick={() => addToCart({ id: p.id, name: p.name, price: p.price, image: p.image, quantity: p.moq, slug: p.slug, maxStock: p.stock, moq: p.moq })}
                  className="h-[46px] rounded-full text-sm font-semibold shadow-[inset_0_0_0_1px_rgba(31,17,21,0.2)] group-hover:bg-[#2B0B12] group-hover:text-[#F6EDE3] group-hover:shadow-none active:scale-[0.98] transition-[background-color,color,box-shadow,transform] motion-reduce:active:scale-100"
                >
                  {p.moq > 1 ? `Add ${p.moq} to bag` : 'Add to bag'}
                </button>
              )}
            </article>
          ) : (
            <div key={i} className="flex-none w-[68%] sm:w-[290px] h-[300px] sm:h-[360px] rounded-[22px] bg-white animate-pulse motion-reduce:animate-none" aria-hidden="true" />
          ),
        )}
      </div>
      <div className="max-w-[1360px] mx-auto px-5 sm:px-8 lg:px-12 mt-6 md:mt-7" aria-hidden="true">
        <span className="block h-0.5 rounded-full bg-[#1F1115]/12 overflow-hidden">
          <span className="block h-full bg-[#2B0B12] transition-[width] duration-200" style={{ width: `${Math.max(12, progress * 100)}%` }} />
        </span>
      </div>
    </section>
  );
}
