'use client';
import { money } from '@/lib/format-money';

import Link from 'next/link';
import Image from 'next/image';
import { Fragment, useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { cachedQuery } from '@/lib/query-cache';
import ProductCard from '@/components/ProductCard';
import { whatsappLink } from '@/components/sale/SaleBits';
import { useCMS } from '@/context/CMSContext';
import ProductReviews from '@/components/ProductReviews';
import { StructuredData, generateProductSchema, generateBreadcrumbSchema } from '@/components/SEOHead';
import { notFound, useRouter } from 'next/navigation';
import { useCart } from '@/context/CartContext';
import { useWishlist } from '@/context/WishlistContext';
import { usePageTitle } from '@/hooks/usePageTitle';

// Map common color names to hex values for the swatch preview
function colorNameToHex(name: string): string {
  const map: Record<string, string> = {
    red: '#ef4444', blue: '#3b82f6', green: '#22c55e', yellow: '#eab308',
    orange: '#f97316', purple: '#a855f7', pink: '#ec4899', black: '#111827',
    white: '#ffffff', gray: '#6b7280', grey: '#6b7280', brown: '#92400e',
    navy: '#1e3a5f', gold: '#d4a017', silver: '#c0c0c0', beige: '#f5f5dc',
    maroon: '#800000', teal: '#14b8a6', coral: '#ff7f50', ivory: '#fffff0',
    cream: '#fffdd0', burgundy: '#800020', lavender: '#e6e6fa', cyan: '#06b6d4',
    magenta: '#d946ef', olive: '#84cc16', peach: '#ffcba4', mint: '#98f5e1',
    rose: '#f43f5e', wine: '#722f37', charcoal: '#374151', sky: '#0ea5e9',
  };
  return map[name.toLowerCase().trim()] || '#d1d5db';
}

const optionClass = (selected: boolean, out: boolean) =>
  `inline-flex items-center gap-2.5 min-h-12 px-5 rounded-full text-[15px] font-medium whitespace-nowrap transition-colors ${
    selected
      ? 'bg-[#2B0B12] text-[#F6EDE3]'
      : out
        ? 'text-[#1F1115]/35 line-through shadow-[inset_0_0_0_1px_rgba(31,17,21,0.1)] cursor-not-allowed'
        : 'shadow-[inset_0_0_0_1px_rgba(31,17,21,0.2)] hover:shadow-[inset_0_0_0_1px_#2B0B12]'
  }`;

/** Accepts a list, or text with one item per line / comma, from product metadata. */
function toList(value: unknown): string[] {
  if (Array.isArray(value)) return value.filter((v) => typeof v === 'string' && v.trim()).map((v) => v.trim());
  if (typeof value === 'string') return value.split(/\n|,/).map((v) => v.trim()).filter(Boolean);
  return [];
}

export default function ProductDetailClient({ slug }: { slug: string }) {
  const [product, setProduct] = useState<any>(null);
  usePageTitle(product?.name || 'Product');
  const [loading, setLoading] = useState(true);
  const [selectedImage, setSelectedImage] = useState(0);
  const [selectedVariant, setSelectedVariant] = useState<any>(null);
  const [selectedColor, setSelectedColor] = useState('');
  const [selectedSize, setSelectedSize] = useState('');
  const [quantity, setQuantity] = useState(1);
  const [activeTab, setActiveTab] = useState('description');
  const router = useRouter();
  const { isInWishlist, addToWishlist, removeFromWishlist } = useWishlist();
  const [relatedProducts, setRelatedProducts] = useState<any[]>([]);

  const { addToCart } = useCart();
  const { getSetting } = useCMS();
  const whatsapp = getSetting('contact_whatsapp') || '0570551050';
  const renderNameWithPlainAmpersand = (text: string) =>
    text.split('&').map((part, index, arr) => (
      <Fragment key={`${part}-${index}`}>
        {part}
        {index < arr.length - 1 && <span className="font-sans not-italic">&amp;</span>}
      </Fragment>
    ));

  useEffect(() => {
    async function fetchProduct() {
      try {
        setLoading(true);
        // Fetch main product (cached for 2 minutes)
        const { data: productData, error } = await cachedQuery<{ data: any; error: any }>(
          `product:${slug}`,
          async () => {
            let query = supabase
              .from('products')
              .select(`
                *,
                categories(name, slug),
                product_variants(*),
                product_images(url, position, alt_text)
              `);

            const isUUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(slug);

            if (isUUID) {
              query = query.or(`id.eq.${slug},slug.eq.${slug}`);
            } else {
              query = query.eq('slug', slug);
            }

            return query.single() as any;
          },
          2 * 60 * 1000 // 2 minutes
        );

        if (error || !productData) {
          console.error('Error fetching product:', error);
          setLoading(false);
          return;
        }

        // Transform product data
        // Map variant colors from option2, and extract color_hex from metadata
        const rawVariants = (productData.product_variants || []).map((v: any) => ({
          ...v,
          color: v.option2 || '',
          colorHex: v.metadata?.color_hex || ''
        }));

        // Build a color-to-hex map from variants (prefer stored hex, fallback to colorNameToHex)
        const colorHexMap: Record<string, string> = {};
        rawVariants.forEach((v: any) => {
          if (v.color) {
            if (!colorHexMap[v.color]) {
              colorHexMap[v.color] = v.colorHex || colorNameToHex(v.color);
            }
          }
        });

        const transformedProduct = {
          ...productData,
          images: productData.product_images?.sort((a: any, b: any) => a.position - b.position).map((img: any) => img.url) || [],
          category: productData.categories?.name || 'Shop',
          categorySlug: productData.categories?.slug || '',
          rating: productData.rating_avg || 0,
          reviewCount: productData.review_count || 0,
          stockCount: productData.quantity,
          moq: productData.moq || 1,
          colors: [...new Set(rawVariants.map((v: any) => v.color).filter(Boolean))],
          colorHexMap,
          variants: rawVariants,
          sizes: rawVariants.map((v: any) => v.name) || [],
          // Optional details the team can add in product metadata; tabs hide when empty.
          features: toList(productData.metadata?.features ?? productData.metadata?.notes),
          care: typeof productData.metadata?.care === 'string' ? productData.metadata.care : '',
          preorderShipping: productData.metadata?.preorder_shipping || null
        };

        // Ensure at least one image/placeholder
        if (transformedProduct.images.length === 0) {
          transformedProduct.images = ['/placeholder-product.svg'];
        }

        setProduct(transformedProduct);

        // Set initial quantity to MOQ
        if (transformedProduct.moq > 1) {
          setQuantity(transformedProduct.moq);
        }

        // If variants exist, do NOT pre-select — force user to choose
        // Reset variant and color selection
        setSelectedVariant(null);
        setSelectedSize('');
        setSelectedColor('');

        // Fetch related products (cached for 5 minutes)
        if (productData.category_id) {
          const { data: related } = await cachedQuery<{ data: any; error: any }>(
            `related:${productData.category_id}:${productData.id}`,
            (() => supabase
              .from('products')
              .select('*, product_images(url, position), product_variants(id, name, price, quantity)')
              .eq('category_id', productData.category_id)
              .neq('id', productData.id)
              .limit(4)) as any,
            5 * 60 * 1000
          );

          if (related) {
            setRelatedProducts(related.map((p: any) => {
              const variants = p.product_variants || [];
              const hasVariants = variants.length > 0;
              const minVariantPrice = hasVariants ? Math.min(...variants.map((v: any) => v.price || p.price)) : undefined;
              const totalVariantStock = hasVariants ? variants.reduce((sum: number, v: any) => sum + (v.quantity || 0), 0) : 0;
              const effectiveStock = hasVariants ? totalVariantStock : p.quantity;
              return {
                id: p.id,
                slug: p.slug,
                name: p.name,
                price: p.price,
                image: p.product_images?.[0]?.url || '/placeholder-product.svg',
                rating: p.rating_avg || 0,
                reviewCount: 0,
                inStock: effectiveStock > 0,
                maxStock: effectiveStock || 50,
                moq: p.moq || 1,
                hasVariants,
                minVariantPrice
              };
            }));
          }
        }

      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    }

    if (slug) {
      fetchProduct();
    }
  }, [slug]);

  const hasVariants = product?.variants?.length > 0;
  const hasColors = product?.colors?.length > 0;
  const needsVariantSelection = hasVariants && !selectedVariant;
  const needsColorSelection = hasColors && !selectedColor;

  // Determine the active price: variant price if selected, otherwise base price
  const activePrice = selectedVariant?.price ?? product?.price ?? 0;
  const activeStock = selectedVariant ? (selectedVariant.stock ?? selectedVariant.quantity ?? product?.stockCount ?? 0) : (product?.stockCount ?? 0);

  const handleAddToCart = () => {
    if (!product) return;
    if (needsVariantSelection) return; // Safety check

    // Build variant display string: "Color / Name" or just "Name" or just "Color"
    let variantLabel: string | undefined;
    if (selectedVariant) {
      const color = selectedVariant.color || selectedColor || '';
      const name = selectedVariant.name || '';
      if (color && name) {
        variantLabel = `${color} / ${name}`;
      } else {
        variantLabel = color || name || undefined;
      }
    }

    addToCart({
      id: product.id,
      name: product.name,
      price: activePrice,
      image: product.images[0],
      quantity: quantity,
      variant: variantLabel,
      variantId: selectedVariant?.id || undefined,
      slug: product.slug,
      maxStock: activeStock,
      moq: product.moq || 1
    });
  };

  const handleBuyNow = () => {
    handleAddToCart();
    router.push('/checkout');
  };

  const wishlisted = product ? isInWishlist(product.id) : false;
  const toggleWishlist = () => {
    if (!product) return;
    if (wishlisted) {
      removeFromWishlist(product.id);
    } else {
      addToWishlist({
        id: product.id,
        name: product.name,
        price: product.variants?.length ? Math.min(...product.variants.map((v: any) => v.price || product.price)) : product.price,
        originalPrice: product.compare_at_price || undefined,
        image: product.images?.[0] || '/placeholder-product.svg',
        rating: product.rating,
        reviewCount: product.reviewCount,
        inStock: (product.stockCount ?? 0) > 0 || product.continue_selling,
        slug: product.slug,
      });
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#F1E8DC]">
        <div className="max-w-[1360px] mx-auto px-5 sm:px-8 lg:px-12 pt-12 grid lg:grid-cols-[1.1fr_1fr] gap-8 lg:gap-16 animate-pulse motion-reduce:animate-none" aria-label="Loading product">
          <div className="aspect-[4/5] sm:aspect-square rounded-[36px] bg-[#EFE6DB]" />
          <div className="flex flex-col gap-4 pt-4">
            <div className="h-4 w-32 rounded bg-[#E8DCCB]" />
            <div className="h-14 w-3/4 rounded-xl bg-[#E8DCCB]" />
            <div className="h-8 w-40 rounded-lg bg-[#E8DCCB]" />
            <div className="h-24 rounded-xl bg-[#E8DCCB]" />
            <div className="h-14 rounded-full bg-[#E8DCCB]" />
          </div>
        </div>
      </div>
    );
  }

  if (!product) {
    return (
      <div className="min-h-[70vh] bg-[#F1E8DC] flex flex-col items-center justify-center gap-5 px-5 text-center">
        <h1 className="font-serif text-4xl md:text-5xl text-[#1F1115]">We can&apos;t find that scent</h1>
        <p className="text-[#6B565B] max-w-sm">It may have sold out or moved. Browse the shop or ask us on WhatsApp.</p>
        <Link href="/shop" className="inline-flex items-center min-h-[52px] px-7 rounded-full bg-[#2B0B12] text-[#F6EDE3] font-semibold">Back to the shop</Link>
      </div>
    );
  }

  const tint = '#FBF6EF';
  const discount = product.compare_at_price ? Math.round((1 - activePrice / product.compare_at_price) * 100) : 0;
  const minVariantPrice = hasVariants ? Math.min(...product.variants.map((v: any) => v.price || product.price)) : product.price;

  const productSchema = generateProductSchema({
    name: product.name,
    description: product.description,
    image: product.images[0],
    price: hasVariants ? minVariantPrice : product.price,
    currency: 'GHS',
    sku: product.sku,
    rating: product.rating,
    reviewCount: product.reviewCount,
    availability: product.quantity > 0 ? 'in_stock' : 'out_of_stock',
    category: product.category
  });

  const siteOrigin = (process.env.NEXT_PUBLIC_APP_URL || (typeof window !== 'undefined' ? window.location.origin : '')).replace(/\/+$/, '');
  const categoryHref = product.categorySlug ? `/shop?category=${product.categorySlug}` : '/shop';
  const breadcrumbSchema = generateBreadcrumbSchema([
    { name: 'Home', url: siteOrigin || '/' },
    { name: 'Shop', url: `${siteOrigin}/shop` },
    { name: product.category, url: `${siteOrigin}${categoryHref}` },
    { name: product.name, url: `${siteOrigin}/product/${product.slug || slug}` }
  ]);

  return (
    <>
      <StructuredData data={productSchema} />
      <StructuredData data={breadcrumbSchema} />

      <main className="min-h-screen bg-[#F1E8DC] text-[#1F1115]">
        <nav aria-label="Breadcrumb" className="max-w-[1360px] mx-auto px-5 sm:px-8 lg:px-12 pt-5 md:pt-8">
          <ol className="flex items-center gap-2 text-[13px] text-[#6B565B] overflow-hidden whitespace-nowrap">
            <li><Link href="/" className="hover:text-[#1F1115]">Home</Link></li>
            <li aria-hidden="true">/</li>
            <li><Link href="/shop" className="hover:text-[#1F1115]">Shop</Link></li>
            <li aria-hidden="true">/</li>
            <li><Link href={categoryHref} className="hover:text-[#1F1115]">{product.category}</Link></li>
            <li aria-hidden="true" className="hidden sm:block">/</li>
            <li className="hidden sm:block truncate text-[#1F1115]" aria-current="page">{renderNameWithPlainAmpersand(product.name)}</li>
          </ol>
        </nav>

        <section className="max-w-[1360px] mx-auto px-5 sm:px-8 lg:px-12 pt-5 md:pt-8 pb-16 md:pb-24 grid lg:grid-cols-[1.1fr_1fr] gap-8 lg:gap-16 items-start">
          <div className="lg:sticky lg:top-[112px] flex flex-col gap-3">
            <div className="relative aspect-[4/5] sm:aspect-square rounded-[28px] md:rounded-[36px] overflow-hidden" style={{ backgroundColor: tint }}>
              <Image
                src={product.images[selectedImage]}
                alt={product.name}
                fill
                className="object-contain p-[9%] mix-blend-multiply"
                sizes="(max-width: 1024px) 100vw, 55vw"
                priority
                quality={82}
              />
              {discount > 0 && (
                <span className="absolute top-4 left-4 md:top-6 md:left-6 rounded-full bg-[#D9A441] text-[#2B0B12] text-sm font-bold px-3.5 py-1.5 tabular-nums">Save {discount}%</span>
              )}
              <button
                type="button"
                onClick={toggleWishlist}
                aria-pressed={wishlisted}
                aria-label={wishlisted ? 'Remove from wishlist' : 'Save to wishlist'}
                className="absolute top-3 right-3 md:top-5 md:right-5 w-12 h-12 rounded-full bg-[#F1E8DC]/90 inline-flex items-center justify-center"
              >
                <i className={`${wishlisted ? 'ri-heart-fill text-[#7A1F2E]' : 'ri-heart-line'} text-xl`} aria-hidden="true" />
              </button>
              {product.images.length > 1 && (
                <span className="sm:hidden absolute bottom-4 inset-x-0 flex justify-center gap-1.5" aria-hidden="true">
                  {product.images.map((_: string, i: number) => (
                    <span key={i} className={`h-1.5 rounded-full transition-all ${i === selectedImage ? 'w-5 bg-[#1F1115]' : 'w-1.5 bg-[#1F1115]/25'}`} />
                  ))}
                </span>
              )}
            </div>

            {product.images.length > 1 && (
              <div className="grid grid-cols-5 gap-2 md:gap-3" role="group" aria-label="Photos">
                {product.images.map((image: string, index: number) => (
                  <button
                    key={index}
                    type="button"
                    onClick={() => setSelectedImage(index)}
                    aria-label={`Show photo ${index + 1}`}
                    aria-pressed={selectedImage === index}
                    className={`relative aspect-square rounded-2xl overflow-hidden transition-shadow ${selectedImage === index ? 'shadow-[inset_0_0_0_2px_#2B0B12]' : 'shadow-[inset_0_0_0_1px_rgba(31,17,21,0.12)]'}`}
                    style={{ backgroundColor: tint }}
                  >
                    <Image src={image} alt="" fill className="object-contain p-2 mix-blend-multiply" sizes="96px" quality={60} />
                  </button>
                ))}
              </div>
            )}
          </div>

          <div className="flex flex-col gap-7">
            <div className="flex flex-col gap-4">
              <Link href={categoryHref} className="self-start text-sm text-[#6B565B] hover:text-[#1F1115]">{product.category}</Link>
              <h1 className="font-serif text-[36px] md:text-[50px] leading-[0.95] tracking-[-0.02em] text-balance">{renderNameWithPlainAmpersand(product.name)}</h1>
              {product.reviewCount > 0 && (
                <a href="#details-reviews" onClick={() => setActiveTab('reviews')} className="self-start flex items-center gap-2 text-sm">
                  <span className="flex gap-0.5" aria-hidden="true">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <i key={star} className={`${star <= Math.round(product.rating) ? 'ri-star-fill text-[#D9A441]' : 'ri-star-line text-[#D9A441]/40'}`} />
                    ))}
                  </span>
                  <span className="tabular-nums">{Number(product.rating).toFixed(1)} · {product.reviewCount} {product.reviewCount === 1 ? 'review' : 'reviews'}</span>
                </a>
              )}
              <div className="flex flex-wrap items-center justify-between gap-3">
                <p className="flex items-baseline gap-3 tabular-nums">
                  <span className={`text-[28px] font-semibold ${product.compare_at_price && product.compare_at_price > activePrice ? 'text-[#7A1F2E]' : ''}`}>
                    {hasVariants && !selectedVariant ? `From GH₵${money(minVariantPrice)}` : `GH₵${money(activePrice)}`}
                  </span>
                  {product.compare_at_price && product.compare_at_price > activePrice && (
                    <span className="text-lg text-[#6B565B] line-through">GH₵{money(product.compare_at_price)}</span>
                  )}
                </p>
                <p className={`inline-flex items-center gap-2 text-sm font-medium ${activeStock === 0 ? 'text-[#A23B2A]' : activeStock <= 10 ? 'text-[#8A5A12]' : 'text-[#2F6B3A]'}`}>
                  <span className="w-2 h-2 rounded-full bg-current" aria-hidden="true" />
                  {activeStock === 0 ? 'Sold out' : activeStock <= 10 ? `Only ${activeStock} left` : 'In stock'}
                </p>
              </div>
              {product.description && (
                <p className="text-base md:text-[17px] leading-relaxed text-[#4D3A3F] line-clamp-4 whitespace-pre-line">{product.description}</p>
              )}
            </div>

            {product.features.length > 0 && (
              <div className="flex flex-col gap-3 p-5 rounded-[22px] bg-[#FBF6EF] shadow-[inset_0_0_0_1px_rgba(31,17,21,0.08)]">
                <p className="text-[13px] font-semibold text-[#7A1F2E]">Notes and highlights</p>
                <ul className="flex flex-wrap gap-2">
                  {product.features.map((f: string, i: number) => (
                    <li key={i} className="px-3.5 py-2 rounded-full bg-white text-sm">{f}</li>
                  ))}
                </ul>
              </div>
            )}

            {hasVariants && product.colors.length > 0 && (
              <fieldset className="flex flex-col gap-3">
                <legend className="mb-3 text-[15px] font-semibold">
                  Colour{selectedColor ? <span className="font-normal text-[#6B565B]">: {selectedColor}</span> : <span className="font-normal text-[#8A5A12]"> · choose one</span>}
                </legend>
                <div className="flex flex-wrap gap-2.5">
                  {product.colors.map((color: string) => {
                    const isSelected = selectedColor === color;
                    const colorStock = product.variants.filter((v: any) => v.color === color).reduce((sum: number, v: any) => sum + (v.stock ?? v.quantity ?? 0), 0);
                    const isOutOfStock = colorStock === 0 && product.stockCount === 0;
                    return (
                      <button
                        key={color}
                        type="button"
                        aria-pressed={isSelected}
                        onClick={() => {
                          setSelectedColor(color);
                          const matching = product.variants.filter((v: any) => v.color === color);
                          if (matching.length === 1) {
                            setSelectedVariant(matching[0]);
                            setSelectedSize(matching[0].name);
                          } else {
                            setSelectedVariant(null);
                            setSelectedSize('');
                          }
                        }}
                        disabled={isOutOfStock}
                        className={optionClass(isSelected, isOutOfStock)}
                      >
                        <span className="w-5 h-5 rounded-full shadow-[inset_0_0_0_1px_rgba(31,17,21,0.2)]" style={{ backgroundColor: product.colorHexMap?.[color] || colorNameToHex(color) }} aria-hidden="true" />
                        {color}
                      </button>
                    );
                  })}
                </div>
              </fieldset>
            )}

            {hasVariants && (() => {
              const hasColors = product.colors.length > 0;
              const visible = hasColors ? (selectedColor ? product.variants.filter((v: any) => v.color === selectedColor) : []) : product.variants;
              if (hasColors && visible.length <= 1) return null;
              return (
                <fieldset className="flex flex-col">
                  <legend className="mb-3 text-[15px] font-semibold">
                    {hasColors ? 'Size' : 'Option'}
                    {selectedVariant ? <span className="font-normal text-[#6B565B]">: {selectedVariant.name}</span> : <span className="font-normal text-[#8A5A12]"> · choose one</span>}
                  </legend>
                  <div className="flex flex-wrap gap-2.5">
                    {visible.map((variant: any) => {
                      const isSelected = hasColors ? selectedVariant?.id === variant.id : selectedVariant?.id === variant.id || selectedVariant?.name === variant.name;
                      const isOutOfStock = (variant.stock ?? variant.quantity ?? 0) === 0 && product.stockCount === 0;
                      return (
                        <button
                          key={variant.id || variant.name}
                          type="button"
                          aria-pressed={isSelected}
                          onClick={() => {
                            setSelectedVariant(variant);
                            setSelectedSize(variant.name);
                          }}
                          disabled={isOutOfStock}
                          className={optionClass(isSelected, isOutOfStock)}
                        >
                          <span>{variant.name}</span>
                          <span className={`tabular-nums ${isSelected ? 'text-[#F6EDE3]/75' : 'text-[#6B565B]'}`}>GH₵{money(variant.price || product.price)}</span>
                        </button>
                      );
                    })}
                  </div>
                </fieldset>
              );
            })()}

            <div className="flex flex-col gap-3">
              <div className="flex gap-3">
                <div role="group" aria-label="Quantity" className="flex-none inline-flex items-center h-14 rounded-full shadow-[inset_0_0_0_1px_rgba(31,17,21,0.2)]">
                  <button
                    type="button"
                    aria-label="Decrease quantity"
                    onClick={() => setQuantity(Math.max(product.moq || 1, quantity - 1))}
                    disabled={activeStock === 0 || quantity <= (product.moq || 1)}
                    className="w-12 h-14 inline-flex items-center justify-center disabled:opacity-35"
                  >
                    <i className="ri-subtract-line text-lg" aria-hidden="true" />
                  </button>
                  <input
                    type="number"
                    inputMode="numeric"
                    aria-label="Quantity"
                    value={quantity}
                    onChange={(e) => setQuantity(Math.max(product.moq || 1, Math.min(activeStock, parseInt(e.target.value) || (product.moq || 1))))}
                    className="w-10 h-14 text-center bg-transparent text-base font-semibold tabular-nums outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none"
                    min={product.moq || 1}
                    max={activeStock}
                    disabled={activeStock === 0}
                  />
                  <button
                    type="button"
                    aria-label="Increase quantity"
                    onClick={() => setQuantity(Math.min(activeStock, quantity + 1))}
                    disabled={activeStock === 0 || quantity >= activeStock}
                    className="w-12 h-14 inline-flex items-center justify-center disabled:opacity-35"
                  >
                    <i className="ri-add-line text-lg" aria-hidden="true" />
                  </button>
                </div>
                <button
                  type="button"
                  disabled={activeStock === 0 || needsVariantSelection || needsColorSelection}
                  onClick={handleAddToCart}
                  className="flex-1 h-14 rounded-full bg-[#2B0B12] text-[#F6EDE3] font-semibold whitespace-nowrap tabular-nums disabled:opacity-45 active:scale-[0.98] transition-transform motion-reduce:active:scale-100"
                >
                  {activeStock === 0
                    ? 'Sold out'
                    : needsColorSelection
                      ? 'Choose a colour'
                      : needsVariantSelection
                        ? 'Choose an option'
                        : `Add to bag · GH₵${money(activePrice * quantity)}`}
                </button>
              </div>
              {activeStock > 0 && !needsVariantSelection && !needsColorSelection && (
                <button type="button" onClick={handleBuyNow} className="h-14 rounded-full bg-[#D9A441] text-[#2B0B12] font-semibold hover:bg-[#E5B65A] transition-colors">
                  Buy now
                </button>
              )}
              {product.moq > 1 && <p className="text-sm text-[#8A5A12]">Wholesale item: minimum order of {product.moq} units.</p>}
              <a
                href={whatsappLink(whatsapp, `Hello House of Elle, I'd like to ask about ${product.name}.`)}
                target="_blank"
                rel="noopener noreferrer"
                className="h-14 inline-flex items-center justify-center gap-2 rounded-full shadow-[inset_0_0_0_1px_rgba(31,17,21,0.2)] font-medium hover:bg-white/60 transition-colors"
              >
                <i className="ri-whatsapp-line text-lg" aria-hidden="true" />
                Ask about this scent on WhatsApp
              </a>
            </div>

            <ul className="flex flex-col gap-3.5 pt-6 border-t border-[#1F1115]/12 text-[15px] text-[#4D3A3F]">
              <li className="flex gap-3"><i className="ri-truck-line text-lg text-[#7A1F2E]" aria-hidden="true" />Delivery in Accra and beyond, fee agreed by phone</li>
              <li className="flex gap-3"><i className="ri-store-2-line text-lg text-[#7A1F2E]" aria-hidden="true" />Free pickup at our Spintex store</li>
              <li className="flex gap-3"><i className="ri-smartphone-line text-lg text-[#7A1F2E]" aria-hidden="true" />Pay with MTN, Telecel or AT Mobile Money</li>
            </ul>

            <div className="flex flex-col border-t border-[#1F1115]/12">
              {[
                { id: 'description', title: 'Description', show: !!product.description, body: <p className="whitespace-pre-line">{product.description}</p> },
                { id: 'care', title: 'How to use', show: !!product.care, body: <p className="whitespace-pre-line">{product.care}</p> },
                {
                  id: 'delivery',
                  title: 'Delivery and returns',
                  show: true,
                  body: (
                    <p>
                      We deliver within Accra and outside Accra, and call you to agree the fee before we dispatch. You can also collect for free from Spintex Lashibi. See our <Link href="/shipping" className="underline underline-offset-4">delivery</Link> and <Link href="/returns" className="underline underline-offset-4">returns</Link> pages.
                    </p>
                  ),
                },
                { id: 'reviews', title: `Reviews${product.reviewCount ? ` (${product.reviewCount})` : ''}`, show: true, body: <ProductReviews productId={product.id} /> },
              ]
                .filter((d) => d.show)
                .map((d) => (
                  <details
                    key={d.id}
                    id={`details-${d.id}`}
                    open={activeTab === d.id}
                    onToggle={(e) => (e.currentTarget as HTMLDetailsElement).open && setActiveTab(d.id)}
                    className="group border-b border-[#1F1115]/12"
                  >
                    <summary className="flex items-center justify-between min-h-16 cursor-pointer list-none [&::-webkit-details-marker]:hidden font-serif text-xl">
                      {d.title}
                      <i className="ri-add-line text-xl transition-transform group-open:rotate-45" aria-hidden="true" />
                    </summary>
                    <div className="pb-6 text-[15px] leading-relaxed text-[#4D3A3F]">{d.body}</div>
                  </details>
                ))}
            </div>
          </div>
        </section>

        {relatedProducts.length > 0 && (
          <section className="bg-[#FBF6EF] border-t border-[#1F1115]/8 py-16 md:py-24" data-product-shop>
            <div className="max-w-[1360px] mx-auto px-5 sm:px-8 lg:px-12 flex flex-col gap-8 md:gap-10">
              <h2 className="font-serif text-[30px] md:text-[40px] leading-none tracking-[-0.02em]">You may also <em>like</em></h2>
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-x-3 gap-y-8 sm:gap-6">
                {relatedProducts.map((p) => <ProductCard key={p.id} {...p} />)}
              </div>
            </div>
          </section>
        )}
      </main>
    </>
  );
}
