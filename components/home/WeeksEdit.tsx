'use client';

import Link from 'next/link';
import ProductCard, { type ColorVariant, getColorHex } from '@/components/ProductCard';
import ProductCardSkeleton from '@/components/skeletons/ProductCardSkeleton';
import { useCart } from '@/context/CartContext';
import { money } from '@/lib/format-money';

const firstImage = (p: any) =>
  [...(p.product_images || [])].sort((a: any, b: any) => (a.position ?? 0) - (b.position ?? 0))[0]?.url || '/placeholder-product.svg';

const stockOf = (p: any) => {
  const v = p.product_variants || [];
  return v.length ? v.reduce((s: number, x: any) => s + (x.quantity || 0), 0) : p.quantity;
};

/** Plain text, first sentence or two of a product description. */
const blurb = (html?: string | null) => {
  const text = (html || '').replace(/<[^>]+>/g, ' ').replace(/\s+/g, ' ').trim();
  if (!text) return '';
  const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
  let out = '';
  for (const s of sentences) {
    if ((out + s).length > 190) break;
    out += s;
  }
  return (out || text.slice(0, 180)).trim();
};

function cardProps(product: any) {
  const variants = product.product_variants || [];
  const hasVariants = variants.length > 0;
  const stock = stockOf(product);
  const colorVariants: ColorVariant[] = [];
  const seen = new Set<string>();
  for (const v of variants) {
    const c = v.option2;
    const k = c?.toLowerCase().trim();
    if (c && !seen.has(k)) {
      const hex = getColorHex(c);
      if (hex) {
        seen.add(k);
        colorVariants.push({ name: c.trim(), hex });
      }
    }
  }
  return {
    id: product.id,
    slug: product.slug,
    name: product.name,
    price: product.price,
    originalPrice: product.compare_at_price || undefined,
    image: firstImage(product),
    inStock: stock > 0,
    maxStock: stock || 50,
    moq: product.moq || 1,
    hasVariants,
    minVariantPrice: hasVariants ? Math.min(...variants.map((v: any) => v.price || product.price)) : undefined,
    colorVariants,
  };
}

/** One wide feature followed by four product cards, from the featured products. */
export default function WeeksEdit({ products, loading }: { products: any[]; loading: boolean }) {
  const { addToCart } = useCart();
  const [feature, ...rest] = products;
  const others = rest.slice(0, 4);

  if (!loading && products.length === 0) return null;

  const f = feature ? cardProps(feature) : null;
  const fBlurb = feature ? blurb(feature.short_description || feature.description) : '';

  return (
    <section aria-labelledby="edit-title" className="bg-[#F5EDE4] text-[#221B16] py-20 md:py-32">
      <div className="max-w-[1360px] mx-auto px-5 sm:px-8 lg:px-12 flex flex-col gap-8 md:gap-12">
        <div className="flex items-end justify-between gap-6">
          <h2 id="edit-title" className="font-serif text-[40px] md:text-[72px] leading-none tracking-[-0.02em]">
            This week&apos;s <em>edit</em>
          </h2>
          <Link href="/shop" className="shrink-0 text-sm font-semibold border-b border-current pb-0.5">
            Shop all<span className="hidden sm:inline"> fragrances</span>
          </Link>
        </div>

        {f ? (
          <article className="grid md:grid-cols-2 rounded-[28px] md:rounded-[36px] overflow-hidden bg-[#E9D5BF]">
            <Link href={`/product/${f.slug}`} className="relative flex items-center justify-center p-8 md:p-12 min-h-[340px] md:min-h-[560px]">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src={f.image} alt={f.name} className="w-full max-w-[520px] h-[300px] md:h-[480px] object-contain mix-blend-multiply" />
              <span className="absolute top-5 left-5 md:top-7 md:left-7 rounded-full bg-[#14100D] text-[#F5EDE4] text-xs font-semibold px-3.5 py-2">Our pick this week</span>
            </Link>
            <div className="flex flex-col justify-center gap-5 md:gap-6 px-6 pb-8 md:py-14 md:pl-6 md:pr-16">
              {feature.categories?.name && <p className="text-sm text-[#5E4632]">{feature.categories.name}</p>}
              <h3 className="font-serif text-[44px] md:text-[76px] leading-[0.95] tracking-[-0.03em] text-balance">{f.name}</h3>
              {fBlurb && <p className="text-base md:text-[17px] leading-relaxed text-[#4A3826] max-w-[440px]">{fBlurb}</p>}
              <div className="flex flex-wrap items-center gap-3 pt-1">
                {f.inStock && !f.hasVariants ? (
                  <button
                    type="button"
                    onClick={() => addToCart({ id: f.id, name: f.name, price: f.price, image: f.image, quantity: f.moq, slug: f.slug, maxStock: f.maxStock, moq: f.moq })}
                    className="inline-flex items-center justify-center min-h-[54px] px-8 rounded-full bg-[#14100D] text-[#F5EDE4] font-semibold whitespace-nowrap tabular-nums active:scale-[0.98] transition-transform motion-reduce:active:scale-100"
                  >
                    Add to bag · GH₵{money(f.price)}
                  </button>
                ) : (
                  <span className="text-2xl font-semibold tabular-nums">
                    {f.hasVariants && f.minVariantPrice ? `From GH₵${money(f.minVariantPrice)}` : `GH₵${money(f.price)}`}
                  </span>
                )}
                <Link href={`/product/${f.slug}`} className="inline-flex items-center justify-center min-h-[54px] px-8 rounded-full shadow-[inset_0_0_0_1px_rgba(20,16,13,0.35)] font-semibold whitespace-nowrap">
                  View the scent
                </Link>
              </div>
            </div>
          </article>
        ) : (
          <div className="rounded-[36px] bg-[#E9D5BF] min-h-[420px] md:min-h-[560px] animate-pulse motion-reduce:animate-none" aria-hidden="true" />
        )}

        <div className="grid grid-cols-2 lg:grid-cols-4 gap-x-3 gap-y-8 sm:gap-6">
          {loading
            ? [...Array(4)].map((_, i) => <ProductCardSkeleton key={i} />)
            : others.map((p) => <ProductCard key={p.id} {...cardProps(p)} />)}
        </div>
      </div>
    </section>
  );
}
