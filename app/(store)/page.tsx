'use client';

import { Fragment, useEffect, useState } from 'react';
import Link from 'next/link';
import Image from 'next/image';
import { supabase } from '@/lib/supabase';
import SaleSpotlight from '@/components/SaleSpotlight';
import HomeHero from '@/components/home/HomeHero';
import NotesTicker from '@/components/home/NotesTicker';
import NewInRail, { type RailItem } from '@/components/home/NewInRail';
import ScentQuiz from '@/components/home/ScentQuiz';
import Spotlight, { blurb } from '@/components/home/Spotlight';
import VisitStore from '@/components/home/VisitStore';
import { usePageTitle } from '@/hooks/usePageTitle';

const SELECT = '*, categories(name, slug), product_variants(*), product_images(*)';

const withPlainAmpersand = (text: string) =>
  text.split('&').map((part, index, arr) => (
    <Fragment key={`${part}-${index}`}>
      {part}
      {index < arr.length - 1 && <span className="font-sans not-italic text-[0.8em] align-middle">&amp;</span>}
    </Fragment>
  ));

const toList = (v: unknown): string[] =>
  Array.isArray(v) ? v.filter((x) => typeof x === 'string' && x.trim()) : typeof v === 'string' ? v.split(/\n|,/).map((x) => x.trim()).filter(Boolean) : [];

function toItem(p: any): RailItem {
  const variants = p.product_variants || [];
  const hasVariants = variants.length > 0;
  const stock = hasVariants ? variants.reduce((s: number, v: any) => s + (v.quantity || 0), 0) : p.quantity || 0;
  const image = [...(p.product_images || [])].sort((a: any, b: any) => (a.position ?? 0) - (b.position ?? 0))[0]?.url || '/placeholder-product.svg';
  const off = p.compare_at_price > p.price ? Math.round((1 - p.price / p.compare_at_price) * 100) : 0;
  return {
    id: p.id,
    slug: p.slug,
    name: p.name,
    meta: p.categories?.name,
    price: p.price,
    hasVariants,
    minVariantPrice: hasVariants ? Math.min(...variants.map((v: any) => v.price || p.price)) : undefined,
    image,
    stock,
    moq: p.moq || 1,
    badge: off > 0 ? `-${off}%` : stock > 0 && stock <= 12 ? `Only ${stock} left` : undefined,
  };
}

export default function Home() {
  usePageTitle('');
  const [products, setProducts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      try {
        const { data: featured, error } = await supabase.from('products').select(SELECT).eq('status', 'active').eq('featured', true).order('created_at', { ascending: false }).limit(9);
        if (error) throw error;
        let list = featured || [];
        if (list.length < 9) {
          const { data: newest } = await supabase.from('products').select(SELECT).eq('status', 'active').order('created_at', { ascending: false }).limit(12);
          const seen = new Set(list.map((p: any) => p.id));
          list = [...list, ...(newest || []).filter((p: any) => !seen.has(p.id))].slice(0, 9);
        }
        setProducts(list);

        const { data: cats, error: catErr } = await supabase.from('categories').select('id, name, slug, image_url, description, metadata, created_at').eq('status', 'active').order('created_at', { ascending: false });
        if (catErr) throw catErr;
        const active = cats || [];
        const pinned = active.filter((c: any) => c?.metadata?.featured);
        setCategories((pinned.length > 0 ? pinned : active).slice(0, 4));
      } catch (e: unknown) {
        console.error('Error loading home page:', (e as { message?: string })?.message ?? String(e));
      } finally {
        setLoading(false);
      }
    }
    load();
  }, []);

  const items = products.map(toItem);
  const spot = products[0];
  const spotItem = items[0];

  return (
    <main className="bg-[#F1E8DC]">
      <HomeHero pick={spotItem ? { name: spotItem.name, slug: spotItem.slug, price: spotItem.minVariantPrice ?? spotItem.price, image: spotItem.image } : null} />
      <NotesTicker />

      <section aria-labelledby="cats-title" className="bg-[#F1E8DC] text-[#1F1115] py-16 md:py-28">
        <div className="max-w-[1360px] mx-auto px-5 sm:px-8 lg:px-12 flex flex-col gap-8 md:gap-11">
          <div className="flex items-end justify-between gap-6">
            <h2 id="cats-title" className="font-serif text-[34px] md:text-[43px] leading-[0.95] tracking-[-0.02em]">
              The <em>collections</em>
            </h2>
            <Link href="/categories" className="shrink-0 text-sm font-semibold pb-0.5 shadow-[inset_0_-1px_0_currentColor]">See all collections</Link>
          </div>
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-2.5 md:gap-4">
            {(loading ? [null, null, null, null] : categories).map((c: any, i: number) =>
              c ? (
                <Link key={c.id} href={`/shop?category=${c.slug}`} className="group relative block h-[230px] sm:h-[420px] lg:h-[560px] rounded-[16px] md:rounded-[22px] overflow-hidden bg-[#2B0B12]">
                  <Image
                    src={c.image_url || '/Whisk_4e28dc6bf0d6be98458435c0c2950e3ddr.jpeg'}
                    alt=""
                    fill
                    sizes="(max-width: 1024px) 50vw, 25vw"
                    className="object-cover transition-transform duration-1000 ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-105 motion-reduce:transition-none"
                  />
                  <span className="absolute inset-x-2 bottom-2 md:inset-x-3.5 md:bottom-3.5 flex items-center justify-between gap-3 px-3 py-2.5 md:px-5 md:py-4 rounded-xl md:rounded-2xl bg-[#F6EDE3]">
                    <span className="flex flex-col min-w-0">
                      <span className="font-serif text-[15px] md:text-[21px] leading-tight">{withPlainAmpersand(c.name)}</span>
                      {c.description && <span className="hidden md:block text-[13px] text-[#6B565B] truncate">{c.description}</span>}
                    </span>
                    <i className="hidden md:inline ri-arrow-right-line text-lg flex-none transition-transform group-hover:translate-x-1 motion-reduce:transition-none" aria-hidden="true" />
                  </span>
                </Link>
              ) : (
                <div key={i} className="h-[230px] sm:h-[420px] lg:h-[560px] rounded-[16px] md:rounded-[22px] bg-[#E8DCCB] animate-pulse motion-reduce:animate-none" aria-hidden="true" />
              ),
            )}
          </div>
        </div>
      </section>

      <NewInRail items={items} loading={loading} />
      <ScentQuiz />
      <SaleSpotlight />
      {spot && spotItem && (
        <Spotlight
          item={spotItem}
          description={blurb(spot.short_description || spot.description)}
          notes={toList(spot.metadata?.notes ?? spot.metadata?.features)}
        />
      )}
      <VisitStore />
    </main>
  );
}
