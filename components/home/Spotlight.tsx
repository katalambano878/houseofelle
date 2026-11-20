'use client';

import Link from 'next/link';
import { useCart } from '@/context/CartContext';
import { money } from '@/lib/format-money';
import type { RailItem } from './NewInRail';

/** Plain text, first sentence or two of a description. */
export const blurb = (html?: string | null, limit = 220) => {
  const text = (html || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  if (!text) return '';
  let out = '';
  for (const s of text.match(/[^.!?]+[.!?]+/g) || [text]) {
    if ((out + s).length > limit) break;
    out += s;
  }
  return (out || text.slice(0, limit)).trim();
};

/** One product in the spotlight: framed label photo beside its story and notes. */
export default function Spotlight({ item, description, notes }: { item: RailItem; description: string; notes: string[] }) {
  const { addToCart } = useCart();
  const words = item.name.split(' ');
  const last = words.length > 1 ? words.pop() : '';

  return (
    <section aria-labelledby="spot-title" className="bg-[#F1E8DC] text-[#1F1115] py-16 md:py-28">
      <div className="max-w-[1360px] mx-auto px-5 sm:px-8 lg:px-12 grid md:grid-cols-2 gap-10 md:gap-[72px] items-center">
        <Link href={`/product/${item.slug}`} className="relative aspect-[4/5] rounded-[26px] md:rounded-[30px] bg-[#FBF6EF] shadow-[inset_0_0_0_1px_rgba(31,17,21,0.1)] flex items-center justify-center">
          <span aria-hidden="true" className="absolute inset-3 md:inset-3.5 rounded-[18px] md:rounded-[20px] shadow-[inset_0_0_0_1px_rgba(74,21,32,0.25)]" />
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={item.image} alt={item.name} loading="lazy" className="w-[72%] h-[72%] object-contain mix-blend-multiply" />
        </Link>
        <div className="flex flex-col gap-6 md:gap-7">
          {item.meta && <p className="text-sm text-[#6B565B]">{item.meta}</p>}
          <h2 id="spot-title" className="font-serif text-[40px] md:text-[50px] leading-[0.95] tracking-[-0.03em]">
            {words.join(' ')} {last && <em>{last}</em>}
          </h2>
          {description && <p className="text-[15px] md:text-base leading-relaxed text-[#4D3A3F] max-w-[480px]">{description}</p>}
          {notes.length > 0 && (
            <ul className="flex flex-col border-t border-[#1F1115]/14">
              {notes.slice(0, 4).map((n) => (
                <li key={n} className="py-4 border-b border-[#1F1115]/14 font-serif text-lg">{n}</li>
              ))}
            </ul>
          )}
          <div className="flex flex-wrap items-center gap-3">
            {item.stock > 0 && !item.hasVariants ? (
              <button
                type="button"
                onClick={() => addToCart({ id: item.id, name: item.name, price: item.price, image: item.image, quantity: item.moq, slug: item.slug, maxStock: item.stock, moq: item.moq })}
                className="inline-flex items-center justify-center min-h-[54px] px-8 rounded-full bg-[#2B0B12] text-[#F6EDE3] font-semibold whitespace-nowrap tabular-nums active:scale-[0.98] transition-transform motion-reduce:active:scale-100"
              >
                Add to bag · GH₵{money(item.price)}
              </button>
            ) : (
              <span className="text-xl font-semibold tabular-nums">
                {item.hasVariants && item.minVariantPrice ? `From GH₵${money(item.minVariantPrice)}` : `GH₵${money(item.price)}`}
              </span>
            )}
            <Link href={`/product/${item.slug}`} className="inline-flex items-center justify-center min-h-[54px] px-8 rounded-full shadow-[inset_0_0_0_1px_rgba(31,17,21,0.3)] font-semibold whitespace-nowrap">
              Read the notes
            </Link>
          </div>
        </div>
      </div>
    </section>
  );
}
