'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useCMS } from '@/context/CMSContext';
import { usePageTitle } from '@/hooks/usePageTitle';
import { whatsappLink } from '@/components/sale/SaleBits';

const MOSAIC = [
  { src: '/Whisk_64e2698834d1476801a4b505b30c324bdr.jpeg', alt: 'Perfume bottles in warm afternoon light', tall: true },
  { src: '/Whisk_743db4f33bd7ec08b0f46aec28e929cfdr.jpeg', alt: 'Perfume bottles on display' },
  { src: '/Whisk_6ec7df94ec3ca85b49644810b7fab2ecdr.jpeg', alt: 'Perfume bottles with rose petals' },
  { src: '/Whisk_50c2f050b440b4b95064c372c1ec7ee1dr.jpeg', alt: 'Two perfume bottles on a soft pink background' },
  { src: '/Whisk_4e28dc6bf0d6be98458435c0c2950e3ddr.jpeg', alt: 'Amber perfume bottles on a bright surface' },
];

const PROMISES = [
  { n: '01', t: 'A short, curated shelf', d: 'Four collections: scents for her, scents for him, home and candles, and gift sets. Finding yours takes minutes.' },
  { n: '02', t: 'Prices in cedis', d: 'Every price is in Ghana cedis. Pay online with Mobile Money, or with cash or MoMo in store.' },
  { n: '03', t: 'Smell before you buy', d: 'Visit the Spintex store and try anything. Shopping online? Ask us on WhatsApp what a scent is like.' },
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
  const wa = (text: string) => whatsappLink(phone, text);

  const ways = [
    { t: 'Online', d: 'Order here, pay with MTN, Telecel or AT Mobile Money, and get an SMS at every step.', cta: 'Shop online', href: '/shop', cls: 'bg-[#221B16] text-[#F5EDE4]' },
    { t: 'In store', d: 'Try anything on your skin at Spintex Lashibi, and collect online orders for free.', cta: 'Plan a visit', href: '/contact', cls: 'bg-white text-[#221B16]' },
    { t: 'Wholesale', d: 'Shops and resellers buy at wholesale prices. Minimum quantities are shown on each product.', cta: 'WhatsApp us', href: wa('Hello House of Elle, I would like to ask about wholesale orders.'), cls: 'bg-[#C89B3C] text-[#14100D]', external: true },
  ];

  return (
    <main className="bg-[#F5EDE4] text-[#221B16]">
      <section className="max-w-[1360px] mx-auto px-5 sm:px-8 lg:px-12 pt-16 md:pt-28 pb-10 md:pb-[72px] grid lg:grid-cols-[1.15fr_1fr] gap-6 lg:gap-14 lg:items-end">
        <h1 className="font-serif text-[56px] sm:text-[80px] lg:text-[116px] leading-[0.94] tracking-[-0.03em]">
          Every bottle, chosen <em className="text-[#8A6420]">by hand.</em>
        </h1>
        <p className="text-[17px] md:text-[19px] leading-relaxed text-[#4E4239] max-w-[480px] lg:mb-3">
          House of Elle is a fragrance house in Spintex, Accra. We stock perfumes, body mists, candles, body care and gift sets that we would wear or give ourselves.
        </p>
      </section>

      <section className="max-w-[1360px] mx-auto px-5 sm:px-8 lg:px-12 pb-20 md:pb-36 grid grid-cols-2 lg:grid-cols-[1.4fr_1fr_1fr] lg:grid-rows-[300px_300px] gap-3 md:gap-4" aria-label="Photos from House of Elle">
        {MOSAIC.map((m) => (
          <div key={m.src} className={`relative overflow-hidden rounded-[20px] md:rounded-[28px] ${m.tall ? 'col-span-2 lg:col-span-1 lg:row-span-2 aspect-[4/3] lg:aspect-auto' : 'aspect-square lg:aspect-auto'}`}>
            <Image src={m.src} alt={m.alt} fill sizes="(max-width: 1024px) 50vw, 33vw" className="object-cover" />
          </div>
        ))}
      </section>

      <section className="max-w-[1360px] mx-auto px-5 sm:px-8 lg:px-12 pb-20 md:pb-36 flex flex-col gap-10 md:gap-16">
        <h2 className="font-serif text-[40px] md:text-[72px] leading-none tracking-[-0.02em]">
          What you can <em>count on</em>
        </h2>
        <div className="grid md:grid-cols-3 border-t border-[#221B16]/15">
          {PROMISES.map((p) => (
            <div key={p.n} className="flex flex-col gap-3 md:gap-4 pt-7 md:pt-9 pb-4 md:pr-10">
              <span className="font-serif text-6xl md:text-[88px] leading-[0.9] text-[#B08530] tabular-nums" aria-hidden="true">{p.n}</span>
              <h3 className="font-serif text-2xl md:text-[32px] leading-tight">{p.t}</h3>
              <p className="text-[15px] md:text-base leading-relaxed text-[#4E4239] max-w-[340px]">{p.d}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="bg-[#14100D] text-[#F5EDE4]">
        <div className="max-w-[1360px] mx-auto px-5 sm:px-8 lg:px-12 py-20 md:py-28 flex flex-col gap-10 md:gap-12">
          <div className="flex flex-wrap items-end justify-between gap-4">
            <h2 className="font-serif text-[40px] md:text-[64px] leading-none tracking-[-0.02em]">
              Houses we <em className="text-[#E2BE72]">carry</em>
            </h2>
            <Link href="/shop" className="text-sm font-semibold border-b border-current pb-0.5">Shop all fragrances</Link>
          </div>
          <ul className="grid sm:grid-cols-2 lg:grid-cols-3 border-t border-[#F5EDE4]/15">
            {HOUSES.map((h) => (
              <li key={h.n}>
                <Link href={`/shop?search=${encodeURIComponent(h.n)}`} className="flex items-baseline justify-between gap-4 py-6 md:py-8 sm:pr-8 border-b border-[#F5EDE4]/15 hover:text-[#E2BE72] transition-colors">
                  <span className="font-serif italic text-3xl md:text-[40px] leading-none">{h.n}</span>
                  <span className="text-[13px] text-[#BFAF9F]">{h.d}</span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="max-w-[1360px] mx-auto px-5 sm:px-8 lg:px-12 py-20 md:py-36 flex flex-col gap-10 md:gap-14">
        <h2 className="font-serif text-[40px] md:text-[72px] leading-none tracking-[-0.02em]">
          Three ways to <em>shop with us</em>
        </h2>
        <div className="grid md:grid-cols-3 gap-4 md:gap-5">
          {ways.map((w) => {
            const body = (
              <>
                <span className="flex flex-col gap-3">
                  <span className="font-serif text-3xl md:text-4xl leading-tight">{w.t}</span>
                  <span className="text-[15px] leading-relaxed opacity-85">{w.d}</span>
                </span>
                <span className="inline-flex items-center gap-2.5 font-semibold">
                  {w.cta}
                  <i className="ri-arrow-right-line text-lg transition-transform group-hover:translate-x-1 motion-reduce:transition-none" aria-hidden="true" />
                </span>
              </>
            );
            const cls = `group flex flex-col justify-between gap-10 md:min-h-[340px] p-7 md:p-9 rounded-[24px] md:rounded-[28px] ${w.cls}`;
            return w.external ? (
              <a key={w.t} href={w.href} target="_blank" rel="noopener noreferrer" className={cls}>{body}</a>
            ) : (
              <Link key={w.t} href={w.href} className={cls}>{body}</Link>
            );
          })}
        </div>
      </section>

      <section className="grid md:grid-cols-2 bg-[#E9DCCB]">
        <div className="flex flex-col justify-center gap-7 px-5 sm:px-8 py-14 md:py-24 md:pr-20 md:pl-[max(48px,calc((100vw-1360px)/2+48px))]">
          <h2 className="font-serif text-[40px] md:text-[64px] leading-none tracking-[-0.02em]">
            Come and <em>smell them</em>
          </h2>
          <dl className="grid grid-cols-[96px_1fr] md:grid-cols-[110px_1fr] gap-x-6 gap-y-4 text-base leading-snug">
            <dt className="text-[#5E5148]">Address</dt>
            <dd>{address}</dd>
            {hours && (
              <>
                <dt className="text-[#5E5148]">Hours</dt>
                <dd className="whitespace-pre-line">{hours}</dd>
              </>
            )}
            <dt className="text-[#5E5148]">Phone</dt>
            <dd className="font-semibold tabular-nums"><a href={`tel:${phone.replace(/\s/g, '')}`}>{phone}</a>, call or WhatsApp</dd>
          </dl>
          <div className="flex flex-wrap gap-3">
            <a href={wa('Hello House of Elle, please send me directions to your Spintex store.')} target="_blank" rel="noopener noreferrer" className="inline-flex items-center justify-center gap-2 min-h-[54px] px-8 rounded-full bg-[#221B16] text-[#F5EDE4] font-semibold whitespace-nowrap">
              <i className="ri-whatsapp-line text-lg" aria-hidden="true" />
              Get directions
            </a>
            <Link href="/contact" className="inline-flex items-center justify-center min-h-[54px] px-8 rounded-full shadow-[inset_0_0_0_1px_rgba(34,27,22,0.3)] font-semibold whitespace-nowrap">
              Contact us
            </Link>
          </div>
        </div>
        <iframe
          title="Map to House of Elle, Spintex Lashibi"
          src={`https://maps.google.com/maps?q=${encodeURIComponent(address)}&z=15&output=embed`}
          loading="lazy"
          referrerPolicy="no-referrer-when-downgrade"
          className="w-full h-[360px] md:h-full md:min-h-[560px] border-0 grayscale-[0.35] sepia-[0.2]"
        />
      </section>
    </main>
  );
}
