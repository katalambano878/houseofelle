'use client';

import Image from 'next/image';
import Link from 'next/link';
import { useCMS } from '@/context/CMSContext';
import { whatsappLink } from '@/components/sale/SaleBits';

/** Photo beside the store address, phone and wholesale note. */
export default function VisitStore() {
  const { getSetting } = useCMS();
  const phone = getSetting('contact_whatsapp') || '0570551050';
  const address = getSetting('contact_address') || 'Spintex Lashibi, Shalom Spot Junction, Accra';

  return (
    <section aria-labelledby="visit-title" className="grid md:grid-cols-2 md:min-h-[640px] bg-[#E9DCCB] text-[#221B16]">
      <div className="relative min-h-[320px] md:min-h-0">
        <Image src="/Whisk_64e2698834d1476801a4b505b30c324bdr.jpeg" alt="Perfume bottles in warm afternoon light" fill sizes="(max-width: 768px) 100vw, 50vw" className="object-cover" />
      </div>
      <div className="flex flex-col justify-center gap-6 md:gap-7 px-5 sm:px-8 py-14 md:py-20 md:pl-20 md:pr-[max(48px,calc((100vw-1360px)/2+48px))]">
        <h2 id="visit-title" className="font-serif text-[40px] md:text-[64px] leading-none tracking-[-0.02em]">
          Smell it on <em>your skin</em> first
        </h2>
        <p className="text-base md:text-[17px] leading-relaxed text-[#4E4239] max-w-[460px]">
          Visit us at {address}. Try any scent before you buy, or collect your online order for free.
        </p>
        <dl className="grid grid-cols-[120px_1fr] gap-x-5 gap-y-3.5 pt-6 border-t border-[#221B16]/15 text-[15px]">
          <dt className="text-[#5E5148]">Call or WhatsApp</dt>
          <dd className="font-semibold tabular-nums">
            <a href={`tel:${phone.replace(/\s/g, '')}`}>{phone}</a>
          </dd>
          <dt className="text-[#5E5148]">Wholesale</dt>
          <dd>Shops and resellers welcome. Minimum quantities are shown on each product.</dd>
        </dl>
        <div className="flex flex-wrap gap-3">
          <a
            href={whatsappLink(phone, 'Hello House of Elle, please send me directions to your Spintex store.')}
            target="_blank"
            rel="noopener noreferrer"
            className="inline-flex items-center justify-center gap-2 min-h-[54px] px-8 rounded-full bg-[#221B16] text-[#F5EDE4] font-semibold whitespace-nowrap"
          >
            <i className="ri-whatsapp-line text-lg" aria-hidden="true" />
            Get directions
          </a>
          <Link href="/about" className="inline-flex items-center justify-center min-h-[54px] px-8 rounded-full shadow-[inset_0_0_0_1px_rgba(34,27,22,0.3)] font-semibold whitespace-nowrap">
            Our story
          </Link>
        </div>
      </div>
    </section>
  );
}
