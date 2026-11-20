'use client';

import Image from 'next/image';
import { useRouter } from 'next/navigation';
import { useState } from 'react';
import { SCENT_FAMILIES } from './families-data';

const FOR_WHOM = [
  { label: 'Anyone', category: '' },
  { label: 'Her', category: 'body-care-essentials' },
  { label: 'Him', category: 'perfume' },
  { label: 'The home', category: 'home-fragrance' },
] as const;

/** Full-photo opening with the scent finder: pick a family and who it is for. */
export default function HomeHero() {
  const router = useRouter();
  const [family, setFamily] = useState<string>(SCENT_FAMILIES[3].name);
  const [forWhom, setForWhom] = useState<string>(FOR_WHOM[0].label);

  const find = (e: React.FormEvent) => {
    e.preventDefault();
    const f = SCENT_FAMILIES.find((x) => x.name === family);
    const w = FOR_WHOM.find((x) => x.label === forWhom);
    const params = new URLSearchParams();
    if (f) params.set('search', f.keyword);
    if (w?.category) params.set('category', w.category);
    router.push(`/shop?${params.toString()}`);
  };

  const field =
    'relative flex flex-col justify-center gap-0.5 h-[60px] sm:h-16 px-5 rounded-full bg-[#F5EDE4]/10 shadow-[inset_0_0_0_1px_rgba(245,237,228,0.22)] focus-within:shadow-[inset_0_0_0_1.5px_#E2BE72]';
  const select =
    'w-full appearance-none bg-transparent font-serif text-lg sm:text-xl text-[#F5EDE4] pr-7 outline-none cursor-pointer [&>option]:text-[#221B16] [&>option]:font-sans';

  return (
    <section className="relative isolate flex items-end min-h-[720px] md:min-h-[min(860px,calc(100svh-88px))] bg-[#14100D] text-[#F5EDE4] overflow-hidden">
      <Image
        src="/Whisk_a23750058b309cf9155424b5e8ea85dcdr.jpeg"
        alt="Three amber perfume bottles lit from behind"
        fill
        priority
        quality={84}
        sizes="100vw"
        className="object-cover object-[66%_center] md:object-[70%_center] -z-10"
      />
      <div
        className="absolute inset-0 -z-10 bg-[linear-gradient(0deg,#14100D_28%,rgba(20,16,13,0.4)_62%,rgba(20,16,13,0.05))] md:bg-[linear-gradient(90deg,rgba(20,16,13,0.92)_0%,rgba(20,16,13,0.7)_38%,rgba(20,16,13,0.05)_72%),linear-gradient(0deg,rgba(20,16,13,0.85)_0%,rgba(20,16,13,0)_40%)]"
        aria-hidden="true"
      />

      <div className="w-full max-w-[1360px] mx-auto px-5 sm:px-8 lg:px-12 pt-32 pb-24 md:pb-[72px] flex flex-col gap-7 md:gap-10">
        <h1 className="font-serif font-normal text-[54px] sm:text-[80px] lg:text-[124px] leading-[0.94] tracking-[-0.03em] max-w-[900px] text-balance">
          Luxury fragrances <br className="hidden sm:block" />
          for <em className="text-[#E2BE72]">everyone.</em>
        </h1>

        <form
          onSubmit={find}
          aria-label="Scent finder"
          className="max-w-[820px] p-2 sm:p-2.5 rounded-[32px] sm:rounded-full bg-[#14100D]/55 backdrop-blur-xl shadow-[inset_0_0_0_1px_rgba(245,237,228,0.16)]"
        >
          <div className="grid grid-cols-1 sm:grid-cols-[1fr_1fr_auto] gap-2">
            <label className={field}>
              <span className="text-[11px] font-semibold text-[#BFAF9F]">I want to smell</span>
              <select value={family} onChange={(e) => setFamily(e.target.value)} className={select}>
                {SCENT_FAMILIES.map((f) => (
                  <option key={f.name} value={f.name}>{f.mood}</option>
                ))}
              </select>
              <i className="ri-arrow-down-s-line absolute right-4 bottom-3.5 text-lg text-[#E2BE72] pointer-events-none" aria-hidden="true" />
            </label>
            <label className={field}>
              <span className="text-[11px] font-semibold text-[#BFAF9F]">It is for</span>
              <select value={forWhom} onChange={(e) => setForWhom(e.target.value)} className={select}>
                {FOR_WHOM.map((w) => (
                  <option key={w.label} value={w.label}>{w.label}</option>
                ))}
              </select>
              <i className="ri-arrow-down-s-line absolute right-4 bottom-3.5 text-lg text-[#E2BE72] pointer-events-none" aria-hidden="true" />
            </label>
            <button
              type="submit"
              className="inline-flex items-center justify-center gap-2.5 h-14 sm:h-16 px-8 rounded-full bg-[#C89B3C] text-[#14100D] font-semibold whitespace-nowrap hover:bg-[#D4A94B] active:scale-[0.98] transition-[background-color,transform] motion-reduce:active:scale-100"
            >
              Find my scent
              <i className="ri-arrow-right-line text-lg" aria-hidden="true" />
            </button>
          </div>
        </form>
      </div>
    </section>
  );
}
