'use client';

import { useEffect, useState } from 'react';
import { Fragment } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { supabase } from '@/lib/supabase';
import ProductCard, { type ColorVariant, getColorHex } from '@/components/ProductCard';
import ProductCardSkeleton from '@/components/skeletons/ProductCardSkeleton';
import AnimatedSection, { AnimatedGrid } from '@/components/AnimatedSection';
import NewsletterSection from '@/components/NewsletterSection';
import SaleSpotlight from '@/components/SaleSpotlight';
import { usePageTitle } from '@/hooks/usePageTitle';

export default function Home() {
  usePageTitle('');
  const [featuredProducts, setFeaturedProducts] = useState<any[]>([]);
  const [homepageCategories, setHomepageCategories] = useState<any[]>([]);

  const [loading, setLoading] = useState(true);

  // Config State - Managed in Code
  const [currentSlide, setCurrentSlide] = useState(0);
  const renderNameWithStyledAmpersand = (text: string) =>
    text.split('&').map((part, index, arr) => (
      <Fragment key={`${part}-${index}`}>
        {part}
        {index < arr.length - 1 && <span className="font-sans not-italic text-[0.9em] align-middle">&amp;</span>}
      </Fragment>
    ));

  useEffect(() => {
    const timer = setInterval(() => {
      setCurrentSlide((prev) => (prev + 1) % 3);
    }, 3000);
    return () => clearInterval(timer);
  }, []);

  const config: {
    hero: {
      headline: string;
      subheadline: string;
      primaryButtonText: string;
      primaryButtonLink: string;
      secondaryButtonText: string;
      secondaryButtonLink: string;
      backgroundImage?: string;
    };
    banners?: Array<{ text: string; active: boolean }>;
  } = {
    hero: {
      headline: 'House of Elle — Luxury Fragrances for Everyone',
      subheadline: 'Shop perfumes, splashes, diffusers, scented candles, kids perfumes, body sprays, body butters, scented body lotions, and gift sets.',
      primaryButtonText: 'Shop Collections',
      primaryButtonLink: '/shop',
      secondaryButtonText: 'Our Story',
      secondaryButtonLink: '/about',
      // backgroundImage: 'https://images.unsplash.com/photo-1441986300917-64674bd600d8?q=80&w=2070&auto=format&fit=crop' // Optional override
    },
    banners: [
      { text: '📍 Visit us at Spintex Lashibi, Shalom Spot Junction', active: false },
      { text: '📞 Call 0553347531 for wholesale & retail orders', active: false },
      { text: '✨ New arrivals in perfumes, diffusers, candles, and gift sets', active: false }
    ]
  };

  useEffect(() => {
    async function fetchData() {
      try {
        // Fetch featured products directly from Supabase
        const { data: productsData, error: productsError } = await supabase
          .from('products')
          .select('*, product_variants(*), product_images(*)')
          .eq('status', 'active')
          .eq('featured', true)
          .order('created_at', { ascending: false })
          .limit(8);

        if (productsError) throw productsError;
        setFeaturedProducts(productsData || []);

        const { data: categoriesData, error: categoriesError } = await supabase
          .from('categories')
          .select('id, name, slug, image_url, description, metadata, created_at')
          .eq('status', 'active')
          .order('created_at', { ascending: false });

        if (categoriesError) throw categoriesError;

        const activeCategories = categoriesData || [];
        const featuredCategories = activeCategories.filter((category: any) => category?.metadata?.featured);
        const categoriesForHomepage = (featuredCategories.length > 0 ? featuredCategories : activeCategories).slice(0, 4);
        setHomepageCategories(categoriesForHomepage);

      } catch (error: unknown) {
        const err = error as { message?: string; code?: string };
        const msg = err?.message ?? (error instanceof Error ? error.message : String(error));
        const code = err?.code ?? '';
        if (code === 'PGRST205') {
          console.warn('Products table not found. Run Supabase migrations to create the schema.');
        } else {
          console.error('Error fetching data:', msg, code ? `(${code})` : '');
        }
      } finally {
        setLoading(false);
      }
    }

    fetchData();
  }, []);


  const getHeroImage = () => {
    if (config.hero.backgroundImage) return config.hero.backgroundImage;
    return "/house-of-elle-logo.png";
  };

  const renderBanners = () => {
    const activeBanners = config.banners?.filter(b => b.active) || [];
    if (activeBanners.length === 0) return null;

    return (
      <div className="bg-brand-black text-brand-gold py-2 overflow-hidden relative border-b border-brand-gold/30">
        <div className="flex animate-marquee whitespace-nowrap">
          {activeBanners.concat(activeBanners).map((banner, index) => (
            <span key={index} className="mx-8 text-sm font-semibold tracking-wide flex items-center">
              {banner.text}
            </span>
          ))}
        </div>
      </div>
    );
  };

  return (
    <main className="flex-col items-center justify-between min-h-screen">
      {renderBanners()}

      {/* Hero Section - House of Elle Signature */}
      <section className="relative w-full h-[86vh] md:h-[94vh] overflow-hidden bg-brand-black">
        {/* Progress Bar */}
        <div className="absolute top-0 left-0 right-0 z-30 h-1 bg-brand-ivory/15">
          <div
            key={currentSlide}
            className="h-full bg-brand-gold animate-progress origin-left"
            style={{ animationDuration: '3000ms' }}
          ></div>
        </div>

        {[
          {
            image: '/Whisk_4e28dc6bf0d6be98458435c0c2950e3ddr.jpeg',
            tag: 'Signature Drops',
            heading: <>House of Elle <br /><span className="font-accent font-normal text-brand-champagne block mt-2">Fragrance Rituals</span></>,
            subtext: 'Curated perfumes, body mists, and scent layers selected for bold everyday elegance.',
            cta: { text: 'Shop Signature', href: '/shop' },
            cta2: { text: 'Explore Categories', href: '/categories' },
            position: 'object-center'
          },
          {
            image: '/Whisk_50c2f050b440b4b95064c372c1ec7ee1dr.jpeg',
            tag: 'Body Care Studio',
            heading: <>Layer. Glow. <br /><span className="font-accent font-normal text-brand-champagne block mt-2">Repeat Daily</span></>,
            subtext: 'From sprays to butters and lotions, build a scent routine that stays with you all day.',
            cta: { text: 'Shop Body Care', href: '/shop?search=body' },
            cta2: { text: 'Read Our Story', href: '/about' },
            position: 'object-top'
          },
          {
            image: '/Whisk_64e2698834d1476801a4b505b30c324bdr.jpeg',
            tag: 'Retail + Wholesale',
            heading: <>Accra's Scent <br /><span className="font-accent font-normal text-brand-champagne block mt-2">Destination</span></>,
            subtext: 'Shop personal favorites or place bulk orders with trusted value and premium quality.',
            cta: { text: 'Shop Gift Sets', href: '/shop?search=gift' },
            cta2: { text: 'Contact House of Elle', href: '/contact' },
            position: 'object-center'
          },
        ].map((slide, index) => (
          <div
            key={index}
            className={`absolute inset-0 transition-opacity duration-1000 ease-in-out ${index === currentSlide ? 'opacity-100 z-10' : 'opacity-0 z-0'}`}
          >
            <div className={`absolute inset-0 ${index === currentSlide ? 'animate-ken-burns' : ''}`}>
              <Image
                src={slide.image}
                alt={`House of Elle hero ${index + 1}`}
                fill
                className={`object-cover ${slide.position}`}
                priority={index === 0}
                quality={84}
                sizes="100vw"
              />
            </div>

            {/* Clean luxury overlay - dark left for text readability, fading to clear right */}
            <div className="absolute inset-0 bg-gradient-to-r from-black/90 via-black/50 to-transparent"></div>
            <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent"></div>

            <div className="absolute inset-0 px-6 md:px-12 lg:px-16 py-14 md:py-20">
              <div className="h-full max-w-7xl mx-auto grid md:grid-cols-[1fr_320px] gap-8 items-center">
                <div className="text-left">
                  <div className={`transition-all duration-700 delay-100 ${index === currentSlide ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
                    <span className="inline-flex items-center gap-3 mb-6 text-brand-gold text-[10px] md:text-xs tracking-[0.3em] uppercase font-bold">
                      <span className="w-6 h-[1px] bg-brand-gold/60"></span>
                      {slide.tag}
                      <span className="w-6 h-[1px] bg-brand-gold/60 md:hidden"></span>
                    </span>
                  </div>

                  <div className={`transition-all duration-700 delay-200 ${index === currentSlide ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
                    <h1 className="text-4xl sm:text-5xl md:text-7xl lg:text-8xl font-serif text-white mb-4 md:mb-6 leading-[1.05] drop-shadow-lg">
                      {slide.heading}
                    </h1>
                  </div>

                  <div className={`transition-all duration-700 delay-300 ${index === currentSlide ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
                    <p className="text-sm md:text-xl text-brand-ivory/90 max-w-2xl mb-8 md:mb-9 font-light leading-relaxed drop-shadow">
                      {slide.subtext}
                    </p>
                  </div>

                  <div className={`flex flex-col sm:flex-row items-stretch sm:items-start gap-3 sm:gap-4 transition-all duration-700 delay-400 ${index === currentSlide ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
                    <Link
                      href={slide.cta.href}
                      className="group relative w-full sm:w-auto text-center px-8 py-3.5 btn-gold rounded-full font-semibold text-sm md:text-base overflow-hidden transition-all hover:scale-105"
                    >
                      <span className="relative z-10 flex items-center justify-center gap-2">
                        {slide.cta.text}
                        <i className="ri-arrow-right-line transition-transform group-hover:translate-x-1"></i>
                      </span>
                    </Link>
                    <Link
                      href={slide.cta2.href}
                      className="w-full sm:w-auto text-center px-8 py-3.5 bg-white/10 border border-white/30 text-white rounded-full font-medium text-sm md:text-base backdrop-blur-sm hover:bg-white/20 hover:border-white transition-all"
                    >
                      {slide.cta2.text}
                    </Link>
                  </div>
                </div>

                <div className={`hidden md:block transition-all duration-700 delay-500 ${index === currentSlide ? 'opacity-100 translate-y-0' : 'opacity-0 translate-y-8'}`}>
                  <div className="rounded-2xl border border-white/10 bg-black/20 backdrop-blur-md p-6 text-brand-ivory shadow-2xl">
                    <p className="text-[10px] tracking-[0.3em] uppercase text-brand-gold mb-4 font-bold">House of Elle Edit</p>
                    <ul className="space-y-3 text-sm text-brand-ivory/85">
                      <li className="flex items-center gap-2"><i className="ri-check-line text-brand-gold"></i> Perfumes and body mists</li>
                      <li className="flex items-center gap-2"><i className="ri-check-line text-brand-gold"></i> Candles and diffusers</li>
                      <li className="flex items-center gap-2"><i className="ri-check-line text-brand-gold"></i> Kids and family-friendly scents</li>
                    </ul>
                    <div className="mt-6 pt-4 border-t border-brand-gold/25 text-xs text-brand-ivory/70">
                      Spintex Lashibi, Shalom Spot Junction - Accra
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        ))}

        <div className="absolute bottom-8 left-1/2 -translate-x-1/2 z-20 flex gap-3">
          {[0, 1, 2].map((i) => (
            <button
              key={i}
              onClick={() => setCurrentSlide(i)}
              className={`h-1.5 rounded-full transition-all duration-300 ${currentSlide === i ? 'w-12 bg-brand-gold' : 'w-6 bg-brand-ivory/45 hover:bg-brand-ivory/70'}`}
              aria-label={`Go to slide ${i + 1}`}
            />
          ))}
        </div>

        <div className="absolute bottom-10 right-4 md:right-10 z-20 hidden md:block">
          <div className="text-brand-ivory/45 text-[11px] font-light tracking-[0.25em] vertical-text transform rotate-180" style={{ writingMode: 'vertical-rl' }}>
            HOUSE OF ELLE — ACCRA, GHANA
          </div>
        </div>
      </section>

      {/* Current or upcoming sale */}
      <SaleSpotlight />

      {/* Categories Section - God Level Redesign */}
      <section className="py-20 md:py-32 bg-brand-ivory relative overflow-hidden">
        {/* Decorative Background Element */}
        <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-brand-gold/30 to-transparent"></div>

        <div className="max-w-[1400px] mx-auto px-4 sm:px-6">
          <AnimatedSection className="flex flex-col md:flex-row md:items-end justify-between mb-10 md:mb-16 gap-6">
            <div className="relative">
              <div className="flex items-center justify-between gap-4 mb-3">
                <span className="block text-sm font-bold tracking-[0.2em] text-brand-gold uppercase">Olfactory Families</span>
                <Link href="/categories" aria-label="All categories" className="md:hidden group flex items-center justify-center w-11 h-11 shrink-0 rounded-full border border-brand-gold/50 active:bg-brand-gold active:text-brand-black transition-colors text-brand-gold">
                  <i className="ri-arrow-right-line text-lg" aria-hidden="true"></i>
                </Link>
              </div>
              <h2 className="font-serif text-4xl sm:text-5xl md:text-6xl text-brand-black leading-[1.1]">
                Shop by <span className="italic text-brand-brown">Category</span>
              </h2>
            </div>
            <div className="hidden md:flex items-center gap-6">
              <p className="hidden md:block text-brand-brown max-w-xs text-right font-medium leading-relaxed">
                Explore our curated collection of fragrances, categorized by their dominant notes.
              </p>
              <Link href="/categories" aria-label="All categories" className="group flex items-center justify-center w-14 h-14 rounded-full border border-brand-gold/50 hover:border-brand-gold hover:bg-brand-gold hover:text-brand-black transition-all duration-300 text-brand-gold">
                <i className="ri-arrow-right-line text-xl transition-transform group-hover:translate-x-1"></i>
              </Link>
            </div>
          </AnimatedSection>

          <AnimatedGrid className="grid grid-cols-2 gap-3 sm:gap-6 md:gap-8 max-w-6xl mx-auto">
            {homepageCategories.map((category: any, index: number) => {
              const tintClasses = ['bg-blue-900', 'bg-rose-900', 'bg-amber-900', 'bg-stone-900'];
              const tint = tintClasses[index % tintClasses.length];
              const categoryImage = category.image_url || '/Whisk_4e28dc6bf0d6be98458435c0c2950e3ddr.jpeg';
              const categorySubtitle = category.description || 'Curated fragrance collection';

              return (
              <Link href={`/shop?category=${category.slug}`} key={category.id} className="group block h-full w-full">
                <div className="relative aspect-[3/4] md:aspect-[16/11] overflow-hidden isolate bg-gray-900 shadow-xl md:shadow-2xl rounded-2xl md:rounded-3xl">

                  {/* Image: Cinematic Slow Zoom & Brightness Shift */}
                  <div className="absolute inset-0 transition-transform duration-[1500ms] ease-out group-hover:scale-110 opacity-90 group-hover:opacity-100">
                    <Image
                      src={categoryImage}
                      alt={category.name}
                      fill
                      className="object-cover"
                      sizes="(max-width: 1200px) 50vw, 600px"
                    />
                  </div>

                  {/* Cinematic Grading Overlays */}
                  {/* 1. Base Darkening Gradient (Bottom Up) */}
                  <div className="absolute inset-0 bg-gradient-to-t from-black/90 via-black/20 to-transparent opacity-80 transition-opacity duration-700 group-hover:opacity-90"></div>

                  {/* 2. Color Tint Overlay (Mix Blend) */}
                  <div className={`absolute inset-0 ${tint} mix-blend-overlay opacity-40 transition-opacity duration-700 group-hover:opacity-50`}></div>

                  {/* 3. Top Down Vignette for depth */}
                  <div className="absolute inset-0 bg-gradient-to-b from-black/40 via-transparent to-transparent opacity-60"></div>

                  {/* Content Container */}
                  <div className="absolute inset-0 p-4 sm:p-6 md:p-10 flex flex-col justify-end z-10">

                    {/* Floating 'Explore' Tag - Reveals on Hover */}
                    <div className="absolute top-8 right-8 overflow-hidden hidden md:block">
                      <span className="inline-flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/10 border border-white/20 backdrop-blur-md text-[10px] font-bold text-white tracking-widest uppercase transform translate-y-[-150%] opacity-0 transition-all duration-500 group-hover:translate-y-0 group-hover:opacity-100">
                        Explore <i className="ri-arrow-right-line"></i>
                      </span>
                    </div>

                    {/* Category Title */}
                    <div className="overflow-hidden">
                      <h3 className="font-serif text-lg sm:text-2xl md:text-3xl lg:text-4xl text-white leading-[1.1] mb-2 md:mb-3 transform transition-transform duration-700 ease-out group-hover:-translate-y-2 drop-shadow-xl">
                        {renderNameWithStyledAmpersand(category.name)}
                      </h3>
                    </div>

                    {/* Decorative Line */}
                    <div className="h-[1px] w-8 md:w-12 bg-white/60 md:mb-4 transition-all duration-700 ease-out group-hover:w-full group-hover:bg-white/90"></div>

                    {/* Subtitle / Description */}
                    <div className="overflow-hidden">
                      <p className="hidden md:block text-white/80 font-light text-sm tracking-widest uppercase transform translate-y-full opacity-0 transition-all duration-700 ease-out group-hover:translate-y-0 group-hover:opacity-100 delay-100">
                        {categorySubtitle}
                      </p>
                    </div>
                  </div>

                  {/* Premium Border Frame Effect */}
                  <div className="absolute inset-5 hidden md:block border border-white/20 scale-[0.95] opacity-0 transition-all duration-700 ease-out group-hover:scale-100 group-hover:opacity-100 pointer-events-none z-20">
                    {/* Corner Accents */}
                    <div className="absolute top-0 left-0 w-2 h-2 border-t border-l border-white/60"></div>
                    <div className="absolute top-0 right-0 w-2 h-2 border-t border-r border-white/60"></div>
                    <div className="absolute bottom-0 left-0 w-2 h-2 border-b border-l border-white/60"></div>
                    <div className="absolute bottom-0 right-0 w-2 h-2 border-b border-r border-white/60"></div>
                  </div>

                </div>
              </Link>
            )})}
          </AnimatedGrid>
          {homepageCategories.length === 0 && (
            <div className="mt-8 rounded-2xl border border-brand-gold/25 bg-white/60 p-8 text-center text-brand-brown">
              New collections are on the way. <Link href="/shop" className="font-semibold underline underline-offset-4">Browse the shop</Link> in the meantime.
            </div>
          )}
        </div>
      </section>


      {/* Best sellers */}
      <section className="py-16 md:py-24 bg-stone-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <AnimatedSection className="text-center mb-16">
            <h2 className="font-serif text-3xl sm:text-4xl md:text-5xl text-gray-900 mb-4">Best sellers</h2>
            <p className="text-gray-600 text-lg max-w-2xl mx-auto">Top picks from our latest arrivals</p>
          </AnimatedSection>

          {loading ? (
            <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6 lg:gap-8">
              {[...Array(4)].map((_, i) => (
                <ProductCardSkeleton key={i} />
              ))}
            </div>
          ) : (
            <AnimatedGrid className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4 sm:gap-6 lg:gap-8">
              {featuredProducts.map((product) => {
                const variants = product.product_variants || [];
                const hasVariants = variants.length > 0;
                const minVariantPrice = hasVariants ? Math.min(...variants.map((v: any) => v.price || product.price)) : undefined;
                const totalVariantStock = hasVariants ? variants.reduce((sum: number, v: any) => sum + (v.quantity || 0), 0) : 0;
                const effectiveStock = hasVariants ? totalVariantStock : product.quantity;

                // Extract unique colors from option2
                const colorVariants: ColorVariant[] = [];
                const seenColors = new Set<string>();
                for (const v of variants) {
                  const colorName = (v as any).option2;
                  if (colorName && !seenColors.has(colorName.toLowerCase().trim())) {
                    const hex = getColorHex(colorName);
                    if (hex) {
                      seenColors.add(colorName.toLowerCase().trim());
                      colorVariants.push({ name: colorName.trim(), hex });
                    }
                  }
                }

                return (
                  <ProductCard
                    key={product.id}
                    id={product.id}
                    slug={product.slug}
                    name={product.name}
                    price={product.price}
                    originalPrice={product.compare_at_price}
                    image={[...(product.product_images || [])].sort((a: any, b: any) => (a.position ?? 0) - (b.position ?? 0))[0]?.url || '/placeholder-product.svg'}
                    rating={product.rating_avg || 0}
                    reviewCount={product.review_count || 0}
                    badge={product.featured ? 'Featured' : undefined}
                    inStock={effectiveStock > 0}
                    maxStock={effectiveStock || 50}
                    moq={product.moq || 1}
                    hasVariants={hasVariants}
                    minVariantPrice={minVariantPrice}
                    colorVariants={colorVariants}
                  />
                );
              })}
            </AnimatedGrid>
          )}

          <div className="text-center mt-16">
            <Link
              href="/shop"
              className="inline-flex items-center justify-center bg-brand-gold text-brand-black px-10 py-4 rounded-full font-semibold hover:bg-brand-champagne transition-all shadow-lg hover:shadow-xl hover:-translate-y-1 btn-animate"
            >
              View All Products
            </Link>
          </div>
        </div>
      </section>

      {/* Newsletter - Homepage Only */}
      <NewsletterSection />

    </main>
  );
}
