'use client';
import { money } from '@/lib/format-money';

import { Fragment } from 'react';
import Link from 'next/link';
import LazyImage from './LazyImage';
import { useCart } from '@/context/CartContext';

// Map common color names to hex values for swatches
const COLOR_MAP: Record<string, string> = {
  black: '#000000', white: '#FFFFFF', red: '#EF4444', blue: '#3B82F6',
  navy: '#1E3A5F', green: '#22C55E', yellow: '#EAB308', orange: '#F97316',
  pink: '#EC4899', purple: '#A855F7', brown: '#92400E', beige: '#D4C5A9',
  grey: '#6B7280', gray: '#6B7280', cream: '#FFFDD0', teal: '#14B8A6',
  maroon: '#800000', coral: '#FF7F50', burgundy: '#800020', olive: '#808000',
  tan: '#D2B48C', khaki: '#C3B091', charcoal: '#36454F', ivory: '#FFFFF0',
  gold: '#FFD700', silver: '#C0C0C0', rose: '#FF007F', lavender: '#E6E6FA',
  mint: '#98FB98', peach: '#FFDAB9', wine: '#722F37', denim: '#1560BD',
  nude: '#E3BC9A', camel: '#C19A6B', sage: '#BCB88A', rust: '#B7410E',
  mustard: '#FFDB58', plum: '#8E4585', lilac: '#C8A2C8', stone: '#928E85',
  sand: '#C2B280', taupe: '#483C32', mauve: '#E0B0FF', sky: '#87CEEB',
  forest: '#228B22', cobalt: '#0047AB', emerald: '#50C878', scarlet: '#FF2400',
  aqua: '#00FFFF', turquoise: '#40E0D0', indigo: '#4B0082', crimson: '#DC143C',
  magenta: '#FF00FF', cyan: '#00FFFF', chocolate: '#7B3F00', coffee: '#6F4E37',
};

export function getColorHex(colorName: string): string | null {
  const lower = colorName.toLowerCase().trim();
  if (COLOR_MAP[lower]) return COLOR_MAP[lower];
  // Try partial match (e.g. "Light Blue" -> "blue")
  for (const [key, val] of Object.entries(COLOR_MAP)) {
    if (lower.includes(key)) return val;
  }
  return null;
}

/** Soft backgrounds for bottle photos shot on white; the photo is multiplied onto it. */
const TINTS = ['#EFE6DB', '#F0E1D8', '#E6E1D8', '#F2E3DD', '#EAE2D3', '#E9E0DE'];
export function tintFor(key: string): string {
  let h = 0;
  for (let i = 0; i < key.length; i++) h = (h * 31 + key.charCodeAt(i)) >>> 0;
  return TINTS[h % TINTS.length];
}

export interface ColorVariant {
  name: string;
  hex: string;
}

interface ProductCardProps {
  id: string;
  slug: string;
  name: string;
  price: number;
  originalPrice?: number;
  image: string;
  rating?: number;
  reviewCount?: number;
  badge?: string;
  inStock?: boolean;
  maxStock?: number;
  moq?: number;
  hasVariants?: boolean;
  minVariantPrice?: number;
  colorVariants?: ColorVariant[];
}

export default function ProductCard({
  id,
  slug,
  name,
  price,
  originalPrice,
  image,
  rating = 5,
  reviewCount = 0,
  badge,
  inStock = true,
  maxStock = 50,
  moq = 1,
  hasVariants = false,
  minVariantPrice,
  colorVariants = []
}: ProductCardProps) {
  const { addToCart } = useCart();
  const displayPrice = hasVariants && minVariantPrice ? minVariantPrice : price;
  const discount = originalPrice ? Math.round((1 - displayPrice / originalPrice) * 100) : 0;
  const MAX_SWATCHES = 5;

  const formatPrice = (val: number) => `GH\u20B5${money(val)}`;
  const renderNameWithPlainAmpersand = (text: string) =>
    text.split('&').map((part, index, arr) => (
      <Fragment key={`${part}-${index}`}>
        {part}
        {index < arr.length - 1 && <span className="font-sans not-italic">&amp;</span>}
      </Fragment>
    ));

  const tint = tintFor(id);
  const add = (e: React.MouseEvent) => {
    e.preventDefault();
    addToCart({ id, name, price, image, quantity: moq, slug, maxStock, moq });
  };

  return (
    <div className="group h-full flex flex-col gap-4">
      <Link
        href={`/product/${slug}`}
        className="relative flex items-center justify-center aspect-[4/5] overflow-hidden rounded-[22px] sm:rounded-[28px]"
        style={{ backgroundColor: tint }}
      >
        <LazyImage
          src={image}
          alt={name}
          fit="contain"
          className="w-[84%] h-[84%] object-contain mix-blend-multiply transition-transform duration-700 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-105 motion-reduce:transition-none"
        />

        <div className="absolute top-3 left-3 sm:top-4 sm:left-4 flex flex-col items-start gap-1.5">
          {discount > 0 && (
            <span className="rounded-full bg-[#C89B3C] text-[#14100D] text-[11px] font-bold px-2.5 py-1 tabular-nums">-{discount}%</span>
          )}
          {badge && (
            <span className="rounded-full bg-[#14100D] text-[#F5EDE4] text-[11px] font-semibold px-2.5 py-1">{badge}</span>
          )}
        </div>

        {!inStock && (
          <div className="absolute inset-0 bg-[#F5EDE4]/60 flex items-center justify-center">
            <span className="rounded-full bg-[#14100D] text-[#F5EDE4] px-4 py-2 text-sm font-medium">Sold out</span>
          </div>
        )}
      </Link>

      <div className="flex flex-col gap-1 flex-grow">
        <div className="flex items-start justify-between gap-3">
          <Link href={`/product/${slug}`} className="min-w-0">
            <h3 className="font-serif text-[19px] sm:text-[22px] leading-[1.15] text-[#221B16] line-clamp-2">
              {renderNameWithPlainAmpersand(name)}
            </h3>
          </Link>
          {inStock && (hasVariants ? (
            <Link
              href={`/product/${slug}`}
              aria-label={`Choose options for ${name}`}
              className="flex-none w-11 h-11 -mt-1 rounded-full inline-flex items-center justify-center shadow-[inset_0_0_0_1px_rgba(34,27,22,0.2)] hover:bg-[#14100D] hover:text-[#F5EDE4] transition-colors"
            >
              <i className="ri-arrow-right-line text-lg" aria-hidden="true"></i>
            </Link>
          ) : (
            <button
              onClick={add}
              aria-label={moq > 1 ? `Add ${moq} ${name} to bag` : `Add ${name} to bag`}
              className="flex-none w-11 h-11 -mt-1 rounded-full inline-flex items-center justify-center shadow-[inset_0_0_0_1px_rgba(34,27,22,0.2)] hover:bg-[#14100D] hover:text-[#F5EDE4] active:scale-95 transition-[background-color,color,transform] motion-reduce:active:scale-100"
            >
              <i className="ri-add-line text-xl" aria-hidden="true"></i>
            </button>
          ))}
        </div>

        {colorVariants.length > 0 && (
          <div className="flex items-center gap-1.5" aria-label="Available options">
            {colorVariants.slice(0, MAX_SWATCHES).map((color) => (
              <span
                key={color.name}
                title={color.name}
                aria-label={color.name}
                className="w-3.5 h-3.5 rounded-full flex-shrink-0 shadow-[inset_0_0_0_1px_rgba(34,27,22,0.15)]"
                style={{ backgroundColor: color.hex }}
              />
            ))}
            {colorVariants.length > MAX_SWATCHES && (
              <span className="text-xs text-[#5E5148] ml-0.5">+{colorVariants.length - MAX_SWATCHES}</span>
            )}
          </div>
        )}

        <div className="flex items-baseline gap-2 text-[15px] tabular-nums">
          <span className={`font-semibold ${originalPrice ? 'text-[#8A6420]' : 'text-[#221B16]'}`}>
            {hasVariants && minVariantPrice ? `From ${formatPrice(minVariantPrice)}` : formatPrice(price)}
          </span>
          {originalPrice && <span className="text-sm text-[#5E5148] line-through">{formatPrice(originalPrice)}</span>}
          {moq > 1 && <span className="text-xs text-[#5E5148]">Min. {moq}</span>}
        </div>
      </div>
    </div>
  );
}
