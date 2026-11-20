'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { useCart } from '@/context/CartContext';
import PageHero from '@/components/PageHero';
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

  return (
    <main className="min-h-screen bg-[#F1E8DC]">
      <PageHero title="My Wishlist" backgroundImage="/Whisk_a23750058b309cf9155424b5e8ea85dcdr.jpeg" />

      <section className="py-8 bg-white border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6">
          <div className="flex items-center justify-between">
            <div>
              <nav className="flex items-center space-x-2 text-sm mb-2">
                <Link href="/" className="text-gray-600 hover:text-blue-700 transition-colors">Home</Link>
                <i className="ri-arrow-right-s-line text-gray-400"></i>
                <span className="text-gray-900 font-medium">Wishlist</span>
              </nav>
              <p className="text-gray-600">
                {wishlistItems.length} {wishlistItems.length === 1 ? 'item' : 'items'} saved
              </p>
            </div>
            {wishlistItems.length > 0 && (
              <button
                onClick={addAllToCart}
                className="bg-gray-900 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-semibold transition-colors whitespace-nowrap"
              >
                Add All to Cart
              </button>
            )}
          </div>
        </div>
      </section>

      {notice && (
        <section className="pt-6">
          <div className="max-w-7xl mx-auto px-4 sm:px-6">
            <div className={`p-4 rounded-lg border text-sm flex items-start gap-3 ${notice.type === 'success' ? 'bg-blue-50 border-blue-200 text-blue-800' : 'bg-amber-50 border-amber-200 text-amber-800'}`}>
              <i className="ri-information-line text-lg mt-0.5"></i>
              <div className="flex-1">
                <p>{notice.text}</p>
                {notice.links && notice.links.length > 0 && (
                  <ul className="mt-2 space-y-1">
                    {notice.links.map((link) => (
                      <li key={link.slug}>
                        <Link href={`/product/${link.slug}`} className="font-semibold underline hover:no-underline">
                          {link.name}
                        </Link>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
              <button onClick={() => setNotice(null)} aria-label="Dismiss" className="text-current opacity-60 hover:opacity-100">
                <i className="ri-close-line text-lg"></i>
              </button>
            </div>
          </div>
        </section>
      )}

      {wishlistItems.length === 0 ? (
        <section className="py-20">
          <div className="max-w-7xl mx-auto px-4 sm:px-6 text-center">
            <div className="w-24 h-24 flex items-center justify-center mx-auto mb-6 bg-gray-200 rounded-full">
              <i className="ri-heart-line text-5xl text-gray-400"></i>
            </div>
            <h2 className="text-3xl font-bold text-gray-900 mb-4">Your wishlist is empty</h2>
            <p className="text-gray-600 mb-8 text-lg">Save your favourite items here to easily find them later</p>
            <Link href="/shop" className="inline-block bg-gray-900 hover:bg-blue-700 text-white px-8 py-4 rounded-lg font-semibold transition-colors whitespace-nowrap">
              Explore Products
            </Link>
          </div>
        </section>
      ) : (
        <section className="py-12">
          <div className="max-w-7xl mx-auto px-4 sm:px-6">
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-8">
              {wishlistItems.map((product) => {
                const info = live[product.id];
                return (
                <div key={product.id} className="relative">
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
                    onClick={() => removeFromWishlist(product.id)}
                    aria-label={`Remove ${product.name} from wishlist`}
                    className="absolute top-3 right-3 w-10 h-10 flex items-center justify-center bg-white rounded-full shadow-md hover:bg-red-50 transition-colors z-10"
                  >
                    <i className="ri-close-line text-gray-700 text-xl"></i>
                  </button>
                </div>
                );
              })}
            </div>
          </div>
        </section>
      )}

      {wishlistItems.length > 0 && (
        <section className="py-16 bg-white">
          <div className="max-w-7xl mx-auto px-4 sm:px-6">
            <div className="bg-gradient-to-r from-blue-700 to-blue-800 rounded-2xl p-8 sm:p-12 text-center text-white">
              <h2 className="text-3xl font-bold mb-4">Share Your Wishlist</h2>
              <p className="text-blue-100 mb-8 text-lg">Let friends and family know what you love</p>
              <div className="flex flex-wrap justify-center gap-4">
                <button onClick={() => shareWishlist()} aria-label="Share or copy wishlist" className="w-12 h-12 flex items-center justify-center bg-white/20 hover:bg-white/30 rounded-lg transition-colors">
                  <i className="ri-share-line text-xl"></i>
                </button>
                <button onClick={() => shareWishlist('whatsapp')} aria-label="Share on WhatsApp" className="w-12 h-12 flex items-center justify-center bg-white/20 hover:bg-white/30 rounded-lg transition-colors">
                  <i className="ri-whatsapp-fill text-xl"></i>
                </button>
                <button onClick={() => shareWishlist('facebook')} aria-label="Share on Facebook" className="w-12 h-12 flex items-center justify-center bg-white/20 hover:bg-white/30 rounded-lg transition-colors">
                  <i className="ri-facebook-fill text-xl"></i>
                </button>
                <button onClick={() => shareWishlist('x')} aria-label="Share on X" className="w-12 h-12 flex items-center justify-center bg-white/20 hover:bg-white/30 rounded-lg transition-colors">
                  <i className="ri-twitter-x-fill text-xl"></i>
                </button>
                <button onClick={() => shareWishlist('email')} aria-label="Share by email" className="w-12 h-12 flex items-center justify-center bg-white/20 hover:bg-white/30 rounded-lg transition-colors">
                  <i className="ri-mail-fill text-xl"></i>
                </button>
              </div>
              {shareStatus && <p className="mt-4 text-sm text-blue-100" role="status">{shareStatus}</p>}
            </div>
          </div>
        </section>
      )}
    </main>
  );
}
