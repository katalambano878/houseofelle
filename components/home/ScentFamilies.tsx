'use client';

import Link from 'next/link';
import { useEffect, useState } from 'react';
import { supabase } from '@/lib/supabase';
import { money } from '@/lib/format-money';
import { SCENT_FAMILIES } from './families-data';

interface Bottle {
  id: string;
  name: string;
  slug: string;
  price: number;
  image: string;
}

const cache = new Map<string, Bottle[]>();

/** Pick a scent family, see its notes and two bottles from the shelf. */
export default function ScentFamilies() {
  const [active, setActive] = useState(3);
  const [bottles, setBottles] = useState<Bottle[] | null>(null);
  const family = SCENT_FAMILIES[active];
  const light = family.ink === 'light';

  useEffect(() => {
    let alive = true;
    const key = family.keyword;
    if (cache.has(key)) {
      setBottles(cache.get(key)!);
      return;
    }
    setBottles(null);
    supabase
      .from('products')
      .select('id, name, slug, price, product_images(url, position)')
      .eq('status', 'active')
      .or(`name.ilike.%${key}%,description.ilike.%${key}%`)
      .limit(2)
      .then(({ data }) => {
        const list: Bottle[] = (data || []).map((p: any) => ({
          id: p.id,
          name: p.name,
          slug: p.slug,
          price: p.price,
          image: [...(p.product_images || [])].sort((a: any, b: any) => (a.position ?? 0) - (b.position ?? 0))[0]?.url || '/placeholder-product.svg',
        }));
        cache.set(key, list);
        if (alive) setBottles(list);
      });
    return () => {
      alive = false;
    };
  }, [family.keyword]);

  const onKey = (e: React.KeyboardEvent) => {
    if (e.key !== 'ArrowRight' && e.key !== 'ArrowLeft') return;
    e.preventDefault();
    const next = (active + (e.key === 'ArrowRight' ? 1 : -1) + SCENT_FAMILIES.length) % SCENT_FAMILIES.length;
    setActive(next);
    document.getElementById(`fam-tab-${next}`)?.focus();
  };

  return (
    <section aria-labelledby="families-title" className="bg-[#F5EDE4] text-[#221B16] pb-20 md:pb-36">
      <div className="max-w-[1360px] mx-auto px-5 sm:px-8 lg:px-12 flex flex-col gap-7 md:gap-9">
        <div className="flex flex-wrap items-end justify-between gap-x-8 gap-y-3">
          <h2 id="families-title" className="font-serif text-[40px] md:text-[72px] leading-none tracking-[-0.02em]">
            Shop by how it <em className="text-[#8A6420]">smells</em>
          </h2>
          <p className="max-w-[360px] text-[15px] md:text-base leading-relaxed text-[#5E5148]">
            Don&apos;t know the name? Pick a scent family and see the bottles that fit it.
          </p>
        </div>

        <div role="tablist" aria-label="Scent families" onKeyDown={onKey} className="-mx-5 px-5 sm:mx-0 sm:px-0 flex gap-2.5 overflow-x-auto sm:flex-wrap [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          {SCENT_FAMILIES.map((f, i) => {
            const on = i === active;
            return (
              <button
                key={f.name}
                id={`fam-tab-${i}`}
                type="button"
                role="tab"
                aria-selected={on}
                aria-controls="fam-panel"
                tabIndex={on ? 0 : -1}
                onClick={() => setActive(i)}
                className={`flex-none inline-flex items-center gap-2.5 h-12 md:h-[52px] pl-3.5 pr-5 rounded-full text-[15px] font-semibold transition-colors ${
                  on ? 'bg-[#14100D] text-[#F5EDE4]' : 'shadow-[inset_0_0_0_1px_rgba(34,27,22,0.16)] hover:bg-white/60'
                }`}
              >
                <span className="w-6 h-6 rounded-full shadow-[inset_0_0_0_1px_rgba(34,27,22,0.15)]" style={{ backgroundColor: f.swatch }} aria-hidden="true" />
                {f.name}
              </button>
            );
          })}
        </div>

        <div
          id="fam-panel"
          role="tabpanel"
          aria-labelledby={`fam-tab-${active}`}
          className={`grid lg:grid-cols-[0.9fr_1.1fr] rounded-[28px] md:rounded-[36px] overflow-hidden transition-colors duration-500 ${light ? 'text-[#F5EDE4]' : 'text-[#14100D]'}`}
          style={{ backgroundColor: family.panel }}
        >
          <div className="flex flex-col justify-between gap-8 md:gap-10 p-7 md:p-14">
            <div className="flex flex-col gap-4 md:gap-5">
              <p className="font-serif text-[64px] md:text-[104px] leading-[0.9] tracking-[-0.03em]">{family.name}</p>
              <p className={`max-w-[420px] text-base md:text-lg leading-relaxed ${light ? 'text-[#D9CCBE]' : 'text-[#4A3826]'}`}>{family.description}</p>
            </div>
            <div className="flex flex-col gap-3">
              <p className={`text-[13px] font-semibold ${light ? 'text-[#E2BE72]' : 'text-[#6B4A22]'}`}>Notes you&apos;ll find</p>
              <ul className="flex flex-wrap gap-2">
                {family.notes.map((n) => (
                  <li key={n} className={`px-4 py-2.5 rounded-full text-sm ${light ? 'bg-[#F5EDE4]/10' : 'bg-white/55'}`}>{n}</li>
                ))}
              </ul>
            </div>
            <Link
              href={`/shop?search=${encodeURIComponent(family.keyword)}`}
              className={`self-start inline-flex items-center gap-2.5 min-h-[54px] px-8 rounded-full font-semibold whitespace-nowrap ${
                light ? 'bg-[#C89B3C] text-[#14100D]' : 'bg-[#14100D] text-[#F5EDE4]'
              }`}
            >
              Shop {family.name.toLowerCase()} scents
              <i className="ri-arrow-right-line text-lg" aria-hidden="true" />
            </Link>
          </div>

          <div className="grid grid-cols-2 gap-3 md:gap-4 p-3 pt-0 md:p-6 lg:pl-0 lg:pt-6">
            {(bottles ?? [null, null]).map((b, i) =>
              b ? (
                <Link key={b.id} href={`/product/${b.slug}`} className="group flex flex-col justify-between gap-3 md:gap-4 p-4 md:p-6 rounded-[20px] md:rounded-[26px]" style={{ backgroundColor: family.card }}>
                  <span className="flex items-center justify-center h-44 md:h-[380px]">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img src={b.image} alt={b.name} loading="lazy" className={`w-[90%] h-full object-contain transition-transform duration-700 group-hover:scale-105 ${light ? '' : 'mix-blend-multiply'}`} />
                  </span>
                  <span className="flex flex-col md:flex-row md:items-end md:justify-between gap-1 md:gap-3">
                    <span className="font-serif text-lg md:text-[26px] leading-tight line-clamp-2">{b.name}</span>
                    <span className="text-[15px] md:text-[17px] font-semibold tabular-nums">GH₵{money(b.price)}</span>
                  </span>
                </Link>
              ) : (
                <div key={i} className="rounded-[20px] md:rounded-[26px] min-h-[240px] md:min-h-[460px] animate-pulse motion-reduce:animate-none" style={{ backgroundColor: family.card }} aria-hidden="true" />
              ),
            )}
            {bottles && bottles.length === 0 && (
              <p className="col-span-2 self-center text-center py-16 text-sm opacity-80">New {family.name.toLowerCase()} scents are on the way.</p>
            )}
          </div>
        </div>
      </div>
    </section>
  );
}
