'use client';

import { Fragment, useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { supabase } from '@/lib/supabase';
import SaleSpotlight from '@/components/SaleSpotlight';
import HomeHero from '@/components/home/HomeHero';
import BrandMarquee from '@/components/home/BrandMarquee';
import WeeksEdit from '@/components/home/WeeksEdit';
import ScentFamilies from '@/components/home/ScentFamilies';
import VisitStore from '@/components/home/VisitStore';
import { usePageTitle } from '@/hooks/usePageTitle';

const withPlainAmpersand = (text: string) =>
  text.split('&').map((part, index, arr) => (
    <Fragment key={`${part}-${index}`}>
      {part}
      {index < arr.length - 1 && <span className="font-sans not-italic text-[0.8em] align-middle">&amp;</span>}
    </Fragment>
  ));

export default function Home() {
  usePageTitle('');
  const [featuredProducts, setFeaturedProducts] = useState<any[]>([]);
  const [homepageCategories, setHomepageCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const { data: productsData, error: productsError } = await supabase
          .from('products')
          .select('*, categories(name, slug), product_variants(*), product_images(*)')
          .eq('status', 'active')
          .eq('featured', true)
          .order('created_at', { ascending: false })
          .limit(5);
        if (productsError) throw productsError;

        let products = productsData || [];
        // Fewer than five featured: fill the edit with the newest arrivals.
        if (products.length < 5) {
          const { data: newest } = await supabase
            .from('products')
            .select('*, categories(name, slug), product_variants(*), product_images(*)')
            .eq('status', 'active')
            .order('created_at', { ascending: false })
            .limit(10);
          const seen = new Set(products.map((p: any) => p.id));
          products = [...products, ...(newest || []).filter((p: any) => !seen.has(p.id))].slice(0, 5);
        }
        setFeaturedProducts(products);

        const { data: categoriesData, error: categoriesError } = await supabase
          .from('categories')
          .select('id, name, slug, image_url, description, metadata, created_at')
          .eq('status', 'active')
          .order('created_at', { ascending: false });
        if (categoriesError) throw categoriesError;

        const active = categoriesData || [];
        const featured = active.filter((c: any) => c?.metadata?.featured);
        setHomepageCategories((featured.length > 0 ? featured : active).slice(0, 4));
      } catch (error: unknown) {
        const err = error as { message?: string; code?: string };
        console.error('Error fetching home data:', err?.message ?? String(error));
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  return (
    <main className="bg-[#F5EDE4]">
      <HomeHero />
      <BrandMarquee />
      <WeeksEdit products={featuredProducts} loading={loading} />
      <SaleSpotlight />

      <section aria-labelledby="cats-title" className="bg-[#F5EDE4] text-[#221B16] py-20 md:py-32">
        <div className="max-w-[1360px] mx-auto px-5 sm:px-8 lg:px-12 flex flex-col gap-8 md:gap-12">
          <div className="flex items-end justify-between gap-6">
            <h2 id="cats-title" className="font-serif text-[40px] md:text-[72px] leading-none tracking-[-0.02em]">
              Shop by <em>category</em>
            </h2>
            <Link href="/categories" className="shrink-0 text-sm font-semibold border-b border-current pb-0.5">
              All categories
            </Link>
          </div>

          <div className="grid grid-cols-2 gap-x-3 gap-y-6 sm:gap-x-8 sm:gap-y-10">
            {(loading ? [null, null, null, null] : homepageCategories).map((category: any, i: number) =>
              category ? (
                <Link key={category.id} href={`/shop?category=${category.slug}`} className="group flex flex-col gap-3 md:gap-5">
                  <span className="relative block aspect-[4/5] md:aspect-[16/11] rounded-[18px] md:rounded-[28px] overflow-hidden bg-[#221B16]">
                    <Image
                      src={category.image_url || '/Whisk_4e28dc6bf0d6be98458435c0c2950e3ddr.jpeg'}
                      alt=""
                      fill
                      sizes="(max-width: 768px) 50vw, 640px"
                      className="object-cover transition-transform duration-[900ms] ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-[1.04] motion-reduce:transition-none"
                    />
                  </span>
                  <span className="flex items-center justify-between gap-4">
                    <span className="flex flex-col gap-1 min-w-0">
                      <span className="font-serif text-lg md:text-[34px] leading-tight">{withPlainAmpersand(category.name)}</span>
                      {category.description && (
                        <span className="hidden md:block text-sm text-[#5E5148] line-clamp-1">{category.description}</span>
                      )}
                    </span>
                    <span className="hidden md:inline-flex flex-none w-[52px] h-[52px] rounded-full items-center justify-center shadow-[inset_0_0_0_1px_rgba(34,27,22,0.25)] transition-colors group-hover:bg-[#14100D] group-hover:text-[#F5EDE4]" aria-hidden="true">
                      <i className="ri-arrow-right-line text-lg" />
                    </span>
                  </span>
                </Link>
              ) : (
                <div key={i} className="aspect-[4/5] md:aspect-[16/11] rounded-[18px] md:rounded-[28px] bg-[#E9DCCB] animate-pulse motion-reduce:animate-none" aria-hidden="true" />
              ),
            )}
          </div>
          {!loading && homepageCategories.length === 0 && (
            <p className="rounded-3xl bg-white/60 p-8 text-center text-[#5E5148]">
              New collections are on the way. <Link href="/shop" className="font-semibold underline underline-offset-4">Browse the shop</Link> in the meantime.
            </p>
          )}
        </div>
      </section>

      <ScentFamilies />
      <VisitStore />
    </main>
  );
}
