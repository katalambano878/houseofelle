'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useCart } from '@/context/CartContext';
import { useWishlist } from '@/context/WishlistContext';
import ProductCard from '@/components/ProductCard';
import { usePageTitle } from '@/hooks/usePageTitle';
import { supabase } from '@/lib/supabase';
import { asNumber } from '@/lib/format-money';

interface LiveProduct {
  id: string;
  price: number;
  quantity: number;
  moq: number;
  hasVariants: boolean;
  minVariantPrice?: number;
}

export default function WishlistPage() {
  usePageTitle('Wishlist');
  const { wishlist: wishlistItems, removeFromWishlist } = useWishlist();
  const { addToCart } = useCart();
  const [live, setLive] = useState<Record<string, LiveProduct>>({});
  const [liveLoaded, setLiveLoaded] = useState(false);
  const [notice, setNotice] = useState<{ type: 'success' | 'info'; text: string; links?: { name: string; slug: string }[] } | null>(null);
  const [shareStatus, setShareStatus] = useState('');

  const idKey = useMemo(() => wishlistItems.map((i) => i.id).sort().join(','), [wishlistItems]);

  // Wishlist entries are saved snapshots; read current price, stock, MOQ and options.
  useEffect(() => {
    const ids = idKey ? idKey.split(',') : [];
    if (ids.length === 0) {
      setLive({});
      setLiveLoaded(true);
      return;
    }
    let active = true;
    supabase
      .from('products')
      .select('id, price, quantity, moq, status, product_variants(id, price, quantity)')
      .in('id', ids)
      .then(({ data }) => {
        if (!active) return;
        const map: Record<string, LiveProduct> = {};
        for (const row of (data as any[]) || []) {
          const variants = (row.product_variants || []) as { price: unknown }[];
          const variantPrices = variants.map((v) => asNumber(v.price)).filter((p) => p > 0);
          map[row.id] = {
            id: row.id,
            price: asNumber(row.price),
            quantity: asNumber(row.quantity),
            moq: Math.max(1, asNumber(row.moq, 1) || 1),
            hasVariants: variants.length > 0,
            minVariantPrice: variantPrices.length ? Math.min(...variantPrices) : undefined,
          };
        }
        setLive(map);
        setLiveLoaded(true);
      });
    return () => {
      active = false;
    };
  }, [idKey]);

  const addAllToCart = () => {
    const added: string[] = [];
    const needsOption: { name: string; slug: string }[] = [];
    const unavailable: string[] = [];

    for (const item of wishlistItems) {
      const product = live[item.id];
      // Products missing from the live query are no longer for sale.
      if (liveLoaded && !product) {
        unavailable.push(item.name);
        continue;
      }
      if (product?.hasVariants) {
        needsOption.push({ name: item.name, slug: item.slug || item.id });
        continue;
      }
      const stock = product ? product.quantity : item.inStock ? 1 : 0;
      const moq = product?.moq || 1;
      if (!item.inStock || stock <= 0 || stock < moq) {
        unavailable.push(item.name);
        continue;
      }
      addToCart({
        id: item.id,
        name: item.name,
        price: product?.price || item.price,
        image: item.image,
        quantity: moq,
        slug: item.slug || item.id,
        maxStock: stock,
        moq,
      });
      added.push(item.name);
    }

    const parts: string[] = [];
    if (added.length) parts.push(`Added ${added.length} ${added.length === 1 ? 'item' : 'items'} to your cart.`);
    if (needsOption.length) parts.push('Choose a size or option for the items below on their product page.');
    if (unavailable.length) parts.push(`Not available right now: ${unavailable.join(', ')}.`);
    setNotice({
      type: added.length ? 'success' : 'info',
      text: parts.join(' ') || 'Nothing to add.',
      links: needsOption,
    });
  };

  const shareWishlist = async (channel?: 'whatsapp' | 'facebook' | 'x' | 'email') => {
    const origin = window.location.origin;
    const lines = wishlistItems.map((item) => `${item.name}: ${origin}/product/${item.slug || item.id}`);
    const text = `My House of Elle wishlist:\n${lines.join('\n')}`;
    const url = `${origin}/shop`;
    setShareStatus('');

    if (channel === 'whatsapp') {
      window.open(`https://wa.me/?text=${encodeURIComponent(text)}`, '_blank', 'noopener,noreferrer');
      return;
    }
    if (channel === 'facebook') {
      window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`, '_blank', 'noopener,noreferrer');
      return;
    }
    if (channel === 'x') {
      window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(text.slice(0, 250))}`, '_blank', 'noopener,noreferrer');
      return;
    }
    if (channel === 'email') {
      window.location.href = `mailto:?subject=${encodeURIComponent('My House of Elle wishlist')}&body=${encodeURIComponent(text)}`;
      return;
    }

    try {
      if (navigator.share) {
        await navigator.share({ title: 'My House of Elle wishlist', text });
        return;
      }
      await navigator.clipboard.writeText(text);
      setShareStatus('Wishlist copied to your clipboard.');
    } catch (err) {
      if ((err as Error)?.name !== 'AbortError') setShareStatus('Could not share your wishlist. Please try again.');
    }
  };

  const count = wishlistItems.length;
  const shareBtn =
    'w-11 h-11 inline-flex items-center justify-center rounded-full shadow-[inset_0_0_0_1px_rgba(246,237,227,0.3)] text-[#F6EDE3] hover:bg-[#F6EDE3]/10 transition-colors motion-reduce:transition-none';

  return (
    <main className="min-h-screen bg-[#F1E8DC] text-[#1F1115]">
      <section className="max-w-[1280px] mx-auto px-5 sm:px-8 lg:px-12 pt-10 md:pt-16 pb-7 md:pb-10 flex flex-wrap items-end justify-between gap-6">
        <div className="flex flex-col gap-2.5">
          <h1 className="font-serif text-[40px] md:text-[56px] leading-[0.95] tracking-[-0.02em]">
            Saved for <em>later</em>
          </h1>
          <p className="text-[15px] text-[#6B565B] tabular-nums">
            {count} {count === 1 ? 'scent' : 'scents'} saved
          </p>
        </div>
        {count > 0 && (
          <button
            type="button"
            onClick={addAllToCart}
            className="inline-flex items-center gap-2 min-h-[52px] px-7 rounded-full bg-[#2B0B12] text-[#F6EDE3] text-[15px] font-bold hover:bg-[#4A1520] transition-colors motion-reduce:transition-none"
          >
            <i className="ri-shopping-bag-3-line text-lg" aria-hidden="true"></i>
            Add all to bag
          </button>
        )}
      </section>

      {notice && (
        <section className="max-w-[1280px] mx-auto px-5 sm:px-8 lg:px-12 pb-6">
          <div
            role="status"
            className={`flex items-start gap-3 px-4 py-3.5 rounded-2xl text-sm ${notice.type === 'success' ? 'bg-[#DDE7D6] text-[#244A2C]' : 'bg-[#FBF6EF] text-[#4D3A3F] shadow-[inset_0_0_0_1px_rgba(31,17,21,0.12)]'}`}
          >
            <i className="ri-information-line text-lg leading-5" aria-hidden="true"></i>
            <div className="flex-1 min-w-0">
              <p className="leading-5">{notice.text}</p>
              {notice.links && notice.links.length > 0 && (
                <ul className="mt-1.5 flex flex-col">
                  {notice.links.map((link) => (
                    <li key={link.slug}>
                      <Link href={`/product/${link.slug}`} className="inline-flex items-center min-h-[36px] font-semibold underline underline-offset-[3px]">
                        {link.name}
                      </Link>
                    </li>
                  ))}
                </ul>
              )}
            </div>
            <button type="button" onClick={() => setNotice(null)} aria-label="Dismiss" className="-my-2 -mr-2 w-11 h-11 flex-none inline-flex items-center justify-center rounded-full opacity-70 hover:opacity-100">
              <i className="ri-close-line text-lg" aria-hidden="true"></i>
            </button>
          </div>
        </section>
      )}

      {count === 0 ? (
        <section className="max-w-[1280px] mx-auto px-5 sm:px-8 lg:px-12 pb-20 md:pb-28">
          <div className="flex flex-col items-center text-center gap-4 px-6 py-14 md:py-20 rounded-[28px] bg-[#FBF6EF] shadow-[inset_0_0_0_1px_rgba(31,17,21,0.1)]">
            <span className="w-14 h-14 rounded-full bg-[#F1E8DC] text-[#7A1F2E] inline-flex items-center justify-center">
              <i className="ri-heart-line text-2xl" aria-hidden="true"></i>
            </span>
            <h2 className="font-serif text-[28px] md:text-[34px] leading-none">Nothing saved <em>yet</em></h2>
            <p className="text-[15px] leading-relaxed text-[#6B565B] max-w-[420px]">Tap the heart on any scent to keep it here and find it again later.</p>
            <Link
              href="/shop"
              className="mt-2 inline-flex items-center gap-2 min-h-[52px] px-7 rounded-full bg-[#2B0B12] text-[#F6EDE3] text-[15px] font-bold hover:bg-[#4A1520] transition-colors motion-reduce:transition-none"
            >
              Browse the shop
              <i className="ri-arrow-right-line" aria-hidden="true"></i>
            </Link>
          </div>
        </section>
      ) : (
        <section className="max-w-[1280px] mx-auto px-5 sm:px-8 lg:px-12 pb-14 md:pb-20">
          <ul className="grid grid-cols-2 lg:grid-cols-4 gap-x-3 gap-y-8 sm:gap-x-6 sm:gap-y-12">
            {wishlistItems.map((product) => {
              const info = live[product.id];
              return (
                <li key={product.id} className="relative">
                  <ProductCard
                    {...product}
                    slug={product.slug || product.id}
                    price={info?.price || product.price}
                    inStock={liveLoaded ? !!info && product.inStock && (info.hasVariants || info.quantity > 0) : product.inStock}
                    maxStock={info && !info.hasVariants ? Math.max(1, info.quantity) : undefined}
                    moq={info?.moq || 1}
                    hasVariants={info?.hasVariants || false}
                    minVariantPrice={info?.minVariantPrice}
                  />
                  <button
                    type="button"
                    onClick={() => removeFromWishlist(product.id)}
                    aria-label={`Remove ${product.name} from saved items`}
                    className="absolute top-2.5 right-2.5 sm:top-3.5 sm:right-3.5 z-10 w-11 h-11 inline-flex items-center justify-center rounded-full bg-[#FBF6EF] text-[#1F1115] shadow-[0_1px_2px_rgba(31,17,21,0.12),inset_0_0_0_1px_rgba(31,17,21,0.12)] hover:bg-[#2B0B12] hover:text-[#F6EDE3] transition-colors motion-reduce:transition-none"
                  >
                    <i className="ri-close-line text-xl" aria-hidden="true"></i>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
      )}

      {count > 0 && (
        <section className="max-w-[1280px] mx-auto px-5 sm:px-8 lg:px-12 pb-16 md:pb-24">
          <div className="flex flex-wrap items-center justify-between gap-6 p-6 md:p-8 rounded-[24px] bg-[#2B0B12] text-[#F6EDE3]">
            <div className="flex flex-col gap-1.5">
              <h2 className="font-serif text-[26px] md:text-[30px] leading-none">Share your <em>list</em></h2>
              <p className="text-[15px] text-[#E3CFC7]">Let friends and family know what you love.</p>
            </div>
            <div className="flex flex-wrap gap-2.5">
              <button type="button" onClick={() => shareWishlist()} aria-label="Share or copy wishlist" className={shareBtn}>
                <i className="ri-share-line text-xl" aria-hidden="true"></i>
              </button>
              <button type="button" onClick={() => shareWishlist('whatsapp')} aria-label="Share on WhatsApp" className="h-11 px-5 inline-flex items-center gap-2 rounded-full bg-[#D9A441] text-[#2B0B12] text-[14px] font-bold hover:bg-[#E5B65A] transition-colors motion-reduce:transition-none">
                <i className="ri-whatsapp-line text-lg" aria-hidden="true"></i>
                WhatsApp
              </button>
              <button type="button" onClick={() => shareWishlist('facebook')} aria-label="Share on Facebook" className={shareBtn}>
                <i className="ri-facebook-fill text-xl" aria-hidden="true"></i>
              </button>
              <button type="button" onClick={() => shareWishlist('x')} aria-label="Share on X" className={shareBtn}>
                <i className="ri-twitter-x-fill text-xl" aria-hidden="true"></i>
              </button>
              <button type="button" onClick={() => shareWishlist('email')} aria-label="Share by email" className={shareBtn}>
                <i className="ri-mail-line text-xl" aria-hidden="true"></i>
              </button>
            </div>
            {shareStatus && <p className="basis-full text-sm text-[#E3CFC7]" role="status">{shareStatus}</p>}
          </div>
        </section>
      )}
    </main>
  );
}
