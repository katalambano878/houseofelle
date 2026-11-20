'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useEffect, useState } from 'react';
import { useCMS } from '@/context/CMSContext';
import { usePageTitle } from '@/hooks/usePageTitle';
import { supabase } from '@/lib/supabase';
import { whatsappLink } from '@/components/sale/SaleBits';

const STRIP = [
  { src: '/Whisk_743db4f33bd7ec08b0f46aec28e929cfdr.jpeg', alt: 'Perfume bottles on display', h: 'h-[220px] md:h-[420px]' },
  { src: '/Whisk_64e2698834d1476801a4b505b30c324bdr.jpeg', alt: 'Perfume bottles in warm afternoon light', h: 'h-[260px] md:h-[520px]' },
  { src: '/Whisk_6ec7df94ec3ca85b49644810b7fab2ecdr.jpeg', alt: 'Perfume bottles with rose petals', h: 'h-[200px] md:h-[380px]' },
  { src: '/Whisk_a23750058b309cf9155424b5e8ea85dcdr.jpeg', alt: 'Three amber perfume bottles lit from behind', h: 'h-[240px] md:h-[460px]' },
];

const PROMISES = [
  { t: 'A short, curated shelf', d: 'Four collections: scents for her, scents for him, home and candles, and gift sets. Finding yours takes minutes.' },
  { t: 'Prices in cedis', d: 'Every price is in Ghana cedis. Pay online with Mobile Money, or with cash or MoMo in store.' },
  { t: 'Smell before you buy', d: 'Visit the Spintex store and try anything. Shopping online? Ask us on WhatsApp what a scent is like.' },
];

const HOUSES = [
  { n: 'Lattafa', d: 'Asad, Angham, Mayar' },
  { n: 'Khadlaj', d: 'Oud Noir, Island' },
  { n: 'Armaf', d: 'Club de Nuit' },
  { n: 'Riiffs', d: 'Momento' },
  { n: 'Ard Al Zafaran', d: 'Aneesa' },
  { n: 'Le Falcone', d: 'Bonita' },
];

export default function AboutPage() {
  usePageTitle('Our Story');
  const { getSetting } = useCMS();
  const phone = getSetting('contact_whatsapp') || '0570551050';
  const address = getSetting('contact_address') || 'Spintex Lashibi, Shalom Spot Junction, Accra';
  const hours = getSetting('business_hours') || '';
  const [houseImages, setHouseImages] = useState<Record<string, string>>({});

  // One bottle photo per brand, from the shelf.
  useEffect(() => {
    let alive = true;
    Promise.all(
      HOUSES.map(async (h) => {
        const { data } = await supabase
          .from('products')
          .select('name, product_images(url, position)')
          .eq('status', 'active')
          .or(`name.ilike.%${h.n}%,description.ilike.%${h.n}%`)
          .limit(1);
        const p: any = data?.[0];
        const url = [...(p?.product_images || [])].sort((a: any, b: any) => (a.position ?? 0) - (b.position ?? 0))[0]?.url;
        return [h.n, url] as const;
      }),
    ).then((pairs) => {
      if (alive) setHouseImages(Object.fromEntries(pairs.filter(([, u]) => u)));
    });
    return () => {
      alive = false;
    };
  }, []);

  return (
    <main className="bg-[#F1E8DC] text-[#1F1115]">
      <section className="bg-[#2B0B12] text-[#F6EDE3]">
        <div className="max-w-[1360px] mx-auto px-5 sm:px-8 lg:px-12 pt-14 md:pt-24 pb-16 md:pb-28 flex flex-col gap-8 md:gap-12">
          <h1 className="font-serif text-[46px] sm:text-[60px] lg:text-[75px] leading-[0.9] tracking-[-0.03em] max-w-[1000px] text-balance">
            Every bottle, <em className="text-[#E5B65A]">chosen by hand.</em>
          </h1>
          <p className="md:self-end text-base md:text-lg leading-relaxed text-[#E3CFC7] max-w-[600px]">
            House of Elle is a fragrance house in Spintex, Accra. We stock perfumes, body mists, candles, body care and gift sets that we would wear or give ourselves.
          </p>
        </div>
      </section>

      <section aria-label="Photos from House of Elle" className="max-w-[1360px] mx-auto px-5 sm:px-8 lg:px-12 grid grid-cols-2 md:grid-cols-[1fr_1.4fr_1fr_1.2fr] gap-3 md:gap-4 items-start pb-20 md:pb-32">
        {STRIP.map((p) => (
          <div key={p.src} className={`relative overflow-hidden rounded-b-[18px] md:rounded-b-[24px] ${p.h}`}>
            <Image src={p.src} alt={p.alt} fill sizes="(max-width: 768px) 50vw, 25vw" className="object-cover" />
          </div>
        ))}
      </section>

      <section className="bg-[#4A1520] text-[#F6EDE3]">
        <div className="max-w-[1360px] mx-auto px-5 sm:px-8 lg:px-12 py-16 md:py-28 flex flex-col gap-10 md:gap-14">
          <h2 className="font-serif text-[36px] md:text-[43px] leading-[0.95] tracking-[-0.02em]">
            What you can <em className="text-[#E5B65A]">count on</em>
          </h2>
          <div className="grid md:grid-cols-3 border-t border-[#F6EDE3]/18">
            {PROMISES.map((p) => (
              <div key={p.t} className="flex flex-col gap-3 pt-7 md:pt-9 pb-6 md:pr-10">
                <h3 className="font-serif text-2xl md:text-[26px] leading-tight">{p.t}</h3>
                <p className="text-[15px] leading-relaxed text-[#E3CFC7] max-w-[340px]">{p.d}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      <section className="max-w-[1360px] mx-auto px-5 sm:px-8 lg:px-12 py-16 md:py-28 flex flex-col gap-8 md:gap-11">
        <div className="flex flex-wrap items-end justify-between gap-4">
          <h2 className="font-serif text-[36px] md:text-[43px] leading-[0.95] tracking-[-0.02em]">
            Houses we <em>carry</em>
          </h2>
          <Link href="/shop" className="text-sm font-semibold pb-0.5 shadow-[inset_0_-1px_0_currentColor]">Shop all fragrances</Link>
        </div>
        <ul className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
          {HOUSES.map((h) => (
            <li key={h.n}>
              <Link href={`/shop?search=${encodeURIComponent(h.n)}`} className="group grid grid-cols-[104px_1fr] md:grid-cols-[120px_1fr] items-center gap-5 p-3.5 rounded-[22px] bg-[#FBF6EF] shadow-[inset_0_0_0_1px_rgba(31,17,21,0.1)] hover:shadow-[inset_0_0_0_1px_rgba(31,17,21,0.28)] transition-shadow">
                <span className="relative flex items-center justify-center h-[124px] md:h-[140px] rounded-[14px] bg-white overflow-hidden">
                  <span aria-hidden="true" className="absolute inset-1.5 rounded-[10px] shadow-[inset_0_0_0_1px_rgba(74,21,32,0.18)]" />
                  {houseImages[h.n] ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={houseImages[h.n]} alt="" loading="lazy" className="w-[78%] h-[78%] object-contain transition-transform duration-500 group-hover:scale-[1.06] motion-reduce:transition-none" />
                  ) : (
                    <span className="font-serif italic text-3xl text-[#4A1520]/40" aria-hidden="true">{h.n[0]}</span>
                  )}
                </span>
                <span className="flex flex-col gap-2 pr-2">
                  <span className="font-serif text-2xl md:text-[26px] leading-none">{h.n}</span>
                  <span className="text-[13px] leading-snug text-[#6B565B]">{h.d}</span>
                  <span className="inline-flex items-center gap-1.5 mt-1 text-[13px] font-bold text-[#7A1F2E]">
                    Shop {h.n}
                    <i className="ri-arrow-right-line transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none" aria-hidden="true" />
                  </span>
                </span>
              </Link>
            </li>
          ))}
        </ul>
      </section>

      <section className="grid md:grid-cols-2 bg-[#E8C5BE] text-[#2B0B12]">
        <div className="flex flex-col justify-center gap-7 px-5 sm:px-8 py-16 md:py-24 md:pr-20 md:pl-[max(48px,calc((100vw-1360px)/2+48px))]">
          <h2 className="font-serif text-[36px] md:text-[43px] leading-[0.95] tracking-[-0.02em]">
            Come and <em>smell them</em>
          </h2>
          <dl className="grid grid-cols-[96px_1fr] md:grid-cols-[110px_1fr] gap-x-6 gap-y-4 text-[15px] md:text-base leading-snug">
            <dt className="text-[#4D3A3F]">Address</dt>
            <dd>{address}</dd>
            {hours && (
              <>
                <dt className="text-[#4D3A3F]">Hours</dt>
                <dd className="whitespace-pre-line">{hours}</dd>
              </>
            )}
            <dt className="text-[#4D3A3F]">Phone</dt>
            <dd className="font-semibold tabular-nums"><a href={`tel:${phone.replace(/\s/g, '')}`}>{phone}</a>, call or WhatsApp</dd>
          </dl>
          <div className="flex flex-wrap gap-3">
            <a href={whatsappLink(phone, 'Hello House of Elle, please send me directions to your Spintex store.')} target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center gap-2 min-h-[54px] px-7 rounded-full bg-[#2B0B12] text-[#F6EDE3] font-semibold whitespace-nowrap">
              <i className="ri-whatsapp-line text-lg" aria-hidden="true" />
              Get directions
            </a>
            <Link href="/contact" className="inline-flex items-center justify-center min-h-[54px] px-7 rounded-full shadow-[inset_0_0_0_1.5px_#2B0B12] font-semibold whitespace-nowrap">
              Contact us
            </Link>
          </div>
        </div>
        <iframe
          title="Map to House of Elle, Spintex Lashibi"
          src={`https://maps.google.com/maps?q=${encodeURIComponent(address)}&z=15&output=embed`}
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          className="w-full h-[360px] md:h-full md:min-h-[560px] border-0 sepia-[0.25]"
        />
      </section>
    </main>
  );
}
