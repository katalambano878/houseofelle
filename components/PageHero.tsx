import React from 'react';
import Image from 'next/image';

interface PageHeroProps {
  title: string;
  subtitle?: string;
  backgroundImage?: string;
  /** Kept for existing callers; no longer shown. */
  eyebrow?: string;
}

/** Wine page opening shared by the inner pages: a title, a line of text and an optional photo. */
export default function PageHero({ title, subtitle, backgroundImage }: PageHeroProps) {
  return (
    <section className="relative overflow-hidden bg-[#2B0B12] text-[#F6EDE3]">
      {backgroundImage && (
        <>
          <Image src={backgroundImage} alt="" fill priority sizes="100vw" quality={80} className="object-cover opacity-40" />
          <div className="absolute inset-0 bg-gradient-to-r from-[#2B0B12] via-[#2B0B12]/80 to-transparent" aria-hidden="true" />
        </>
      )}
      <div className="relative max-w-[1360px] mx-auto px-5 sm:px-8 lg:px-12 py-14 md:py-20 flex flex-col gap-4 max-w-[1360px]">
        <h1 className="font-serif text-[38px] md:text-[56px] leading-[0.95] tracking-[-0.02em] max-w-[820px] text-balance">{title}</h1>
        {subtitle && <p className="text-[15px] md:text-base leading-relaxed text-[#E3CFC7] max-w-[620px]">{subtitle}</p>}
      </div>
    </section>
  );
}
