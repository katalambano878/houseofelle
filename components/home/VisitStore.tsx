'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useCMS } from '@/context/CMSContext';
import { whatsappLink } from '@/components/sale/SaleBits';

/** Wine band: ask us on WhatsApp, or visit the Spintex store. */
export default function VisitStore() {
  const { getSetting } = useCMS();
  const phone = getSetting('contact_whatsapp') || '0570551050';
  const address = getSetting('contact_address') || 'Spintex Lashibi, Shalom Spot Junction, Accra';

  return (
    <section aria-labelledby="visit-title" className="grid md:grid-cols-[1.1fr_1fr] bg-[#2B0B12] text-[#F6EDE3]">
      <div className="flex flex-col justify-center gap-6 md:gap-7 px-5 sm:px-8 py-16 md:py-24 md:pr-20 md:pl-[max(48px,calc((100vw-1360px)/2+48px))]">
        <h2 id="visit-title" className="font-serif text-[36px] md:text-[43px] leading-[0.95] tracking-[-0.02em]">
          Not sure? <em className="text-[#E5B65A]">Ask us.</em>
        </h2>
        <p className="text-[15px] md:text-base leading-relaxed text-[#E3CFC7] max-w-[460px]">
          Tell us what you usually wear and we will suggest three bottles on WhatsApp. Or come and smell them at {address}.
        </p>
        <dl className="grid grid-cols-[120px_1fr] md:grid-cols-[130px_1fr] gap-x-5 gap-y-3.5 pt-6 border-t border-[#F6EDE3]/15 text-[15px]">
          <dt className="text-[#CDB5AD]">Call or WhatsApp</dt>
          <dd className="font-semibold tabular-nums"><a href={`tel:${phone.replace(/\s/g, '')}`}>{phone}</a></dd>
          <dt className="text-[#CDB5AD]">Pickup</dt>
          <dd>Free for online orders, at the store</dd>
          <dt className="text-[#CDB5AD]">Wholesale</dt>
          <dd>Shops and resellers welcome. Minimum quantities are shown on each product.</dd>
        </dl>
        <div className="flex flex-wrap gap-3">
          <a
            href={whatsappLink(phone, 'Hello House of Elle, can you suggest a scent for me?')}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-2 min-h-[54px] px-8 rounded-full bg-[#D9A441] text-[#2B0B12] font-semibold whitespace-nowrap"
          >
            <i className="ri-whatsapp-line text-lg" aria-hidden="true" />
            Chat on WhatsApp
          </a>
          <Link href="/about" className="inline-flex items-center justify-center min-h-[54px] px-8 rounded-full shadow-[inset_0_0_0_1px_rgba(246,237,227,0.35)] font-semibold whitespace-nowrap">
            Visit the store
          </Link>
        </div>
      </div>
      <div className="relative min-h-[320px] md:min-h-[560px]">
        <Image src="/Whisk_64e2698834d1476801a4b505b30c324bdr.jpeg" alt="Perfume bottles in warm afternoon light" fill sizes="(max-width: 768px) 100vw, 45vw" className="object-cover" />
      </div>
    </section>
  );
}
