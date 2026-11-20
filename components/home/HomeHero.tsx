'use client';

import Image from 'next/image';
import Link from 'next/link';
import { money } from '@/lib/format-money';

export interface HeroPick {
  name: string;
  slug: string;
  price: number;
  image: string;
}

/** Wine opening: headline and two actions, beside a three-photo collage and this week's pick. */
export default function HomeHero({ pick }: { pick?: HeroPick | null }) {
  return (
    <section className="bg-[#2B0B12] text-[#F6EDE3] overflow-hidden">
      <div className="max-w-[1360px] mx-auto px-5 sm:px-8 lg:px-12 pt-8 pb-14 md:pt-16 md:pb-24 grid lg:grid-cols-[1.1fr_1fr] gap-10 lg:gap-12 items-center lg:min-h-[640px]">
        <div className="flex flex-col gap-8 md:gap-10">
          <h1 className="font-serif text-[46px] sm:text-[60px] lg:text-[70px] leading-[0.94] tracking-[-0.03em] text-balance">
            Luxury fragrances for <em className="text-[#E5B65A]">everyone.</em>
          </h1>
          <div className="flex flex-col sm:flex-row sm:items-center gap-4 sm:gap-7">
            <Link
              href="/shop"
              className="inline-flex items-center justify-center gap-2.5 min-h-[54px] px-8 rounded-full bg-[#D9A441] text-[#2B0B12] font-semibold whitespace-nowrap hover:bg-[#E5B65A] active:scale-[0.98] transition-[background-color,transform] motion-reduce:active:scale-100"
            >
              Shop the collection
              <i className="ri-arrow-right-line text-lg" aria-hidden="true" />
            </Link>
            <a href="#finder" className="self-center sm:self-auto py-3 text-[15px] font-semibold shadow-[inset_0_-1px_0_rgba(246,237,227,0.5)] hover:shadow-[inset_0_-1px_0_#E5B65A] hover:text-[#E5B65A] transition-colors">
              Find your scent in 3 questions
            </a>
          </div>
        </div>

        <div className="relative h-[380px] sm:h-[520px] lg:h-[600px]">
          <div className="absolute left-[12%] top-0 w-[70%] lg:w-[62%] h-[330px] sm:h-[450px] lg:h-[520px] overflow-hidden rounded-t-[999px] rounded-b-[22px]">
            <Image src="/Whisk_a23750058b309cf9155424b5e8ea85dcdr.jpeg" alt="Three amber perfume bottles lit from behind" fill priority sizes="(max-width: 1024px) 70vw, 40vw" className="object-cover" />
          </div>
          <div className="absolute left-0 bottom-0 w-[38%] lg:w-[34%] h-[150px] sm:h-[230px] lg:h-[280px] overflow-hidden rounded-[16px] lg:rounded-[20px] ring-[6px] lg:ring-[10px] ring-[#2B0B12]">
            <Image src="/Whisk_743db4f33bd7ec08b0f46aec28e929cfdr.jpeg" alt="Perfume bottles on display" fill sizes="30vw" className="object-cover" />
          </div>
          <div className="hidden sm:block absolute right-0 top-14 w-[30%] h-[200px] lg:h-[230px] overflow-hidden rounded-[20px] ring-[10px] ring-[#2B0B12]">
            <Image src="/Whisk_64e2698834d1476801a4b505b30c324bdr.jpeg" alt="Perfume bottles in warm afternoon light" fill sizes="25vw" className="object-cover" />
          </div>
          {pick && (
            <Link
              href={`/product/${pick.slug}`}
              className="absolute right-0 bottom-4 lg:bottom-10 flex items-center gap-3 py-2 pl-2 pr-4 rounded-2xl bg-[#F6EDE3] text-[#1F1115] shadow-[0_30px_60px_-30px_rgba(0,0,0,0.6)] max-w-[60%]"
            >
              <span className="flex-none w-12 h-12 lg:w-[60px] lg:h-[60px] rounded-xl bg-white flex items-center justify-center">
                {/* eslint-disable-next-line @next/next/no-img-element */}
                <img src={pick.image} alt="" className="w-[86%] h-[86%] object-contain" />
              </span>
              <span className="flex flex-col min-w-0">
                <span className="text-[11px] lg:text-xs text-[#6B565B]">Our pick this week</span>
                <span className="font-serif text-[15px] lg:text-lg leading-tight truncate">{pick.name}</span>
                <span className="text-[13px] lg:text-sm font-semibold tabular-nums">GH₵{money(pick.price)}</span>
              </span>
            </Link>
          )}
        </div>
      </div>
    </section>
  );
}
