'use client';

import { useState, useEffect, Suspense } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { usePageTitle } from '@/hooks/usePageTitle';
import ProductCard, { type ColorVariant } from '@/components/ProductCard';
import ProductCardSkeleton from '@/components/skeletons/ProductCardSkeleton';
import { getColorHex } from '@/components/ProductCard';
import { supabase } from '@/lib/supabase';
import { cachedQuery } from '@/lib/query-cache';
import Link from 'next/link';
import { SCENT_FAMILIES } from '@/components/home/families-data';

const SORTS = [
  ['popular', 'Most popular'],
  ['new', 'Newest'],
  ['price-low', 'Price: low to high'],
  ['price-high', 'Price: high to low'],
  ['rating', 'Highest rated'],
] as const;

function ShopContent() {
  usePageTitle('Shop All Products');
  const searchParams = useSearchParams();
  const router = useRouter();
  const [searchInput, setSearchInput] = useState(searchParams.get('search') || '');

  // State
  const [products, setProducts] = useState<any[]>([]);
  const [categories, setCategories] = useState<any[]>([{ id: 'all', name: 'All Products', count: 0 }]);
  const [loading, setLoading] = useState(true);
  const [totalProducts, setTotalProducts] = useState(0);

  // Filters
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [priceRange, setPriceRange] = useState([0, 5000]);
  const [selectedRating, setSelectedRating] = useState(0);
  const [sortBy, setSortBy] = useState('popular');
  const [isFilterOpen, setIsFilterOpen] = useState(false);
  const [page, setPage] = useState(1);
  const productsPerPage = 12;

  // Initialize from URL params
  useEffect(() => {
    const category = searchParams.get('category');
    const sort = searchParams.get('sort');
    const search = searchParams.get('search');

    // Mirror the URL exactly, so leaving ?category= or starting a new search resets the filters.
    setSelectedCategory(category || 'all');
    const sortAliases: Record<string, string> = { newest: 'new', bestsellers: 'popular' };
    setSortBy(sort ? sortAliases[sort] || sort : 'popular');
    setSearchInput(search || '');
    setPage(1);
    // Search is handled in the fetch function via searchParams directly or we could add a state for it
  }, [searchParams]);

  // Fetch Categories from cached API
  useEffect(() => {
    async function fetchCategories() {
      try {
        const res = await fetch('/api/storefront/categories');
        if (res.ok) {
          const data = await res.json();
          if (data) setCategories(data);
        }
      } catch (err) {
        console.error('Error fetching categories:', err);
      }
    }
    fetchCategories();
  }, []);

  // Fetch Products
  useEffect(() => {
    async function fetchProducts() {
      setLoading(true);
      // Wait for categories before filtering by one (this effect re-runs when they arrive).
      if (selectedCategory !== 'all' && categories.length === 0) return;
      try {
        const search = searchParams.get('search');

        // A category filter needs the category list to resolve slugs to ids (including subcategories).
        let categoryIds: string[] | null = null;
        if (selectedCategory !== 'all') {
          const categoryObj = categories.find(c => c.slug === selectedCategory);
          categoryIds = categoryObj
            ? [categoryObj.id, ...categories.filter(c => c.parent_id === categoryObj.id).map(c => c.id)]
            : [];
        }

        // Build cache key from all filter params
        const cacheKey = `shop:${(categoryIds || ['all']).join(',')}:${search || ''}:${priceRange.join('-')}:${selectedRating}:${sortBy}:${page}`;

        const { data, count, error } = await cachedQuery<{ data: any; count: any; error: any }>(
          cacheKey,
          async () => {
            let query = supabase
              .from('products')
              .select(`
                *,
                categories(name, slug),
                product_images!product_id(url, position),
                product_variants(id, name, price, quantity, option1, option2, image_url)
              `, { count: 'exact' })
              .order('position', { foreignTable: 'product_images', ascending: true });

            // Search
            if (search) {
              // Match names and descriptions, so a note like "vanilla" finds every bottle that has it.
              const term = search.replace(/[,()%*]/g, ' ').trim();
              if (term) query = query.or(`name.ilike.%${term}%,description.ilike.%${term}%`);
            }

            // Category Filter with Subcategories
            if (categoryIds) {
              query = query.in('category_id', categoryIds);
            }

            // Price Filter
            if (priceRange[1] < 5000) {
              query = query.gte('price', priceRange[0]).lte('price', priceRange[1]);
            }

            // Rating Filter
            if (selectedRating > 0) {
              query = query.gte('rating_avg', selectedRating);
            }

            // Sorting
            switch (sortBy) {
              case 'price-low':
                query = query.order('price', { ascending: true });
                break;
              case 'price-high':
                query = query.order('price', { ascending: false });
                break;
              case 'rating':
                query = query.order('rating_avg', { ascending: false });
                break;
              case 'new':
                query = query.order('created_at', { ascending: false });
                break;
              case 'popular':
              default:
                query = query.order('review_count', { ascending: false }).order('created_at', { ascending: false });
                break;
            }

            // Pagination
            const from = (page - 1) * productsPerPage;
            const to = from + productsPerPage - 1;
            query = query.range(from, to);

            return query as any;
          },
          2 * 60 * 1000 // Cache for 2 minutes
        );

        if (error) throw error;

        if (data) {
          const formattedProducts = data.map((p: any) => {
            const variants = p.product_variants || [];
            const hasVariants = variants.length > 0;
            const minVariantPrice = hasVariants ? Math.min(...variants.map((v: any) => v.price || p.price)) : undefined;
            const totalVariantStock = hasVariants ? variants.reduce((sum: number, v: any) => sum + (v.quantity || 0), 0) : 0;
            const effectiveStock = hasVariants ? totalVariantStock : p.quantity;
            // Extract unique colors from option2
            const colorVariants: ColorVariant[] = [];
            const seenColors = new Set<string>();
            for (const v of variants) {
              const colorName = v.option2;
              if (colorName && !seenColors.has(colorName.toLowerCase().trim())) {
                const hex = getColorHex(colorName);
                if (hex) {
                  seenColors.add(colorName.toLowerCase().trim());
                  colorVariants.push({ name: colorName.trim(), hex });
                }
              }
            }

            return {
              id: p.id,           // Product UUID for cart/orders
              slug: p.slug,       // Slug for navigation
              name: p.name,
              price: p.price,
              originalPrice: p.compare_at_price,
              image: p.product_images?.[0]?.url || '/placeholder-product.svg',
              rating: p.rating_avg || 0,
              reviewCount: p.review_count || 0,
              badge: undefined, // The card shows its own -x% pill on sale items
              inStock: effectiveStock > 0,
              maxStock: effectiveStock || 50,
              moq: p.moq || 1,
              category: p.categories?.name,
              hasVariants,
              minVariantPrice,
              colorVariants
            };
          });
          setProducts(formattedProducts);
          setTotalProducts(count || 0);
        }
      } catch (err) {
        console.error('Error fetching products:', err);
      } finally {
        setLoading(false);
      }
    }

    fetchProducts();
  }, [selectedCategory, priceRange, selectedRating, sortBy, page, searchParams, categories]);

  const totalPages = Math.ceil(totalProducts / productsPerPage);

  const search = searchParams.get('search') || '';
  const parents = categories.filter((c) => !c.parent_id && c.id !== 'all');
  const current = categories.find((c) => c.slug === selectedCategory);
  const family = SCENT_FAMILIES.find((f) => f.keyword === search.toLowerCase());
  const title = family ? `${family.name} scents` : search ? `Results for “${search}”` : current?.name || 'All fragrances';
  const filtersOn = (priceRange[1] < 5000 ? 1 : 0) + (selectedRating > 0 ? 1 : 0);

  const pickCategory = (slug: string) => {
    setSelectedCategory(slug);
    setPage(1);
  };
  const clearAll = () => {
    setSelectedCategory('all');
    setPriceRange([0, 5000]);
    setSelectedRating(0);
    setPage(1);
    if (search) router.push('/shop');
  };
  const submitSearch = (e: React.FormEvent) => {
    e.preventDefault();
    const q = searchInput.trim();
    router.push(q ? `/shop?search=${encodeURIComponent(q)}` : '/shop');
  };

  const chip = (on: boolean) =>
    `flex-none inline-flex items-center gap-2 h-10 px-4 rounded-full text-[13px] font-medium whitespace-nowrap transition-colors ${
      on ? 'bg-[#14100D] text-[#F5EDE4]' : 'shadow-[inset_0_0_0_1px_rgba(34,27,22,0.16)] hover:bg-white/70'
    }`;
  const rowBtn = (on: boolean) =>
    `w-full flex items-center justify-between gap-3 min-h-11 px-4 rounded-2xl text-left text-[15px] transition-colors ${
      on ? 'bg-[#14100D] text-[#F5EDE4] font-semibold' : 'hover:bg-white/70'
    }`;

  const filters = (
    <div className="flex flex-col gap-8">
      <div className="flex flex-col gap-3">
        <h3 className="font-serif text-[22px]">Collections</h3>
        <div className="flex flex-col gap-1">
          <button type="button" onClick={() => pickCategory('all')} className={rowBtn(selectedCategory === 'all')}>All products</button>
          {parents.map((parent) => {
            const subs = categories.filter((c) => c.parent_id === parent.id);
            const open = selectedCategory === parent.slug || subs.some((s) => s.slug === selectedCategory);
            return (
              <div key={parent.id} className="flex flex-col gap-1">
                <button type="button" onClick={() => pickCategory(parent.slug)} className={rowBtn(selectedCategory === parent.slug)}>
                  <span>{parent.name}</span>
                  {subs.length > 0 && <i className={`ri-arrow-down-s-line transition-transform ${open ? 'rotate-180' : ''}`} aria-hidden="true" />}
                </button>
                {open && subs.length > 0 && (
                  <div className="ml-4 pl-3 border-l border-[#221B16]/15 flex flex-col gap-1">
                    {subs.map((child) => (
                      <button key={child.id} type="button" onClick={() => { pickCategory(child.slug); setIsFilterOpen(false); }} className={`${rowBtn(selectedCategory === child.slug)} text-sm min-h-10`}>
                        {child.name}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </div>

      <div className="flex flex-col gap-3 pt-7 border-t border-[#221B16]/12">
        <h3 className="font-serif text-[22px]">Price</h3>
        <p className="text-sm text-[#5E5148]">Up to <span className="font-semibold text-[#221B16] tabular-nums">{priceRange[1] >= 5000 ? 'any price' : `GH₵${priceRange[1].toLocaleString()}`}</span></p>
        <input
          type="range"
          min="0"
          max="5000"
          step="50"
          value={priceRange[1]}
          aria-label="Highest price"
          onChange={(e) => {
            setPriceRange([0, parseInt(e.target.value)]);
            setPage(1);
          }}
          className="w-full h-1.5 rounded-full appearance-none cursor-pointer bg-[#221B16]/15 accent-[#14100D]"
        />
        <div className="flex justify-between text-xs text-[#5E5148] tabular-nums"><span>GH₵0</span><span>GH₵5,000+</span></div>
      </div>

      <div className="flex flex-col gap-3 pt-7 border-t border-[#221B16]/12">
        <h3 className="font-serif text-[22px]">Rating</h3>
        <div className="flex flex-col gap-1">
          {[4, 3].map((rating) => (
            <button
              key={rating}
              type="button"
              onClick={() => {
                setSelectedRating(rating === selectedRating ? 0 : rating);
                setPage(1);
              }}
              aria-pressed={selectedRating === rating}
              className={rowBtn(selectedRating === rating)}
            >
              <span className="flex items-center gap-1">
                {[1, 2, 3, 4, 5].map((star) => (
                  <i key={star} className={`${star <= rating ? 'ri-star-fill text-[#C89B3C]' : 'ri-star-line opacity-40'} text-sm`} aria-hidden="true" />
                ))}
                <span className="ml-1.5 text-sm">{rating} and up</span>
              </span>
            </button>
          ))}
        </div>
      </div>
    </div>
  );

  return (
    <main className="min-h-screen bg-[#F5EDE4] text-[#221B16]">
      <section className="max-w-[1360px] mx-auto px-5 sm:px-8 lg:px-12 pt-8 md:pt-14 flex flex-col gap-6 md:gap-8">
        <div className="flex flex-col lg:flex-row lg:items-end lg:justify-between gap-5">
          <div className="flex flex-col gap-2">
            <h1 className="font-serif text-[44px] md:text-[80px] leading-none tracking-[-0.02em] break-words">
              {search || current ? title : <>All <em>fragrances</em></>}
            </h1>
            <p className="text-sm text-[#5E5148] tabular-nums" aria-live="polite">
              {loading ? 'Finding scents…' : `${totalProducts} ${totalProducts === 1 ? 'product' : 'products'}`}
            </p>
          </div>
          <form onSubmit={submitSearch} role="search" className="w-full lg:w-[420px]">
            <label className="flex items-center gap-3 h-[52px] pl-5 pr-2 rounded-full bg-white shadow-[inset_0_0_0_1px_rgba(34,27,22,0.14)] focus-within:shadow-[inset_0_0_0_1.5px_#14100D]">
              <i className="ri-search-line text-lg text-[#5E5148]" aria-hidden="true" />
              <input
                type="search"
                value={searchInput}
                onChange={(e) => setSearchInput(e.target.value)}
                placeholder="Search scents, brands, notes"
                aria-label="Search products"
                className="flex-1 min-w-0 bg-transparent text-base outline-none placeholder:text-[#7A6B5F]"
              />
              <button type="submit" className="h-10 px-4 rounded-full bg-[#14100D] text-[#F5EDE4] text-sm font-semibold">Search</button>
            </label>
          </form>
        </div>

        <div role="group" aria-label="Scent family" className="-mx-5 px-5 sm:mx-0 sm:px-0 flex gap-2 overflow-x-auto sm:flex-wrap [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
          <Link href="/shop" className={chip(!search)}>All scents</Link>
          {SCENT_FAMILIES.map((f) => (
            <Link key={f.name} href={`/shop?search=${encodeURIComponent(f.keyword)}`} className={chip(search.toLowerCase() === f.keyword)}>
              <span className="w-4 h-4 rounded-full shadow-[inset_0_0_0_1px_rgba(34,27,22,0.15)]" style={{ backgroundColor: f.swatch }} aria-hidden="true" />
              {f.name}
            </Link>
          ))}
        </div>
      </section>

      <div className="lg:hidden sticky top-[72px] z-20 bg-[#F5EDE4]/95 backdrop-blur-md mt-4">
        <div className="flex gap-2.5 px-5 py-3">
          <button
            type="button"
            onClick={() => setIsFilterOpen(true)}
            className="flex-1 inline-flex items-center justify-center gap-2 h-12 rounded-2xl bg-[#FBF7F2] shadow-[inset_0_0_0_1px_rgba(34,27,22,0.14)] text-sm font-semibold"
          >
            <i className="ri-equalizer-line text-base" aria-hidden="true" />
            Filters{selectedCategory !== 'all' || filtersOn ? ` · ${filtersOn + (selectedCategory !== 'all' ? 1 : 0)}` : ''}
          </button>
          <label className="relative flex-1">
            <span className="sr-only">Sort by</span>
            <select
              value={sortBy}
              onChange={(e) => {
                setSortBy(e.target.value);
                setPage(1);
              }}
              className="w-full h-12 pl-4 pr-9 rounded-2xl appearance-none bg-[#FBF7F2] shadow-[inset_0_0_0_1px_rgba(34,27,22,0.14)] text-sm font-semibold text-center"
            >
              {SORTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
            </select>
            <i className="ri-arrow-down-s-line absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none" aria-hidden="true" />
          </label>
        </div>
      </div>

      {isFilterOpen && (
        <div className="lg:hidden fixed inset-0 z-[60]" role="dialog" aria-modal="true" aria-label="Filters">
          <div className="absolute inset-0 bg-[#14100D]/50" onClick={() => setIsFilterOpen(false)} aria-hidden="true" />
          <div className="absolute inset-x-0 bottom-0 max-h-[88dvh] flex flex-col rounded-t-[28px] bg-[#F5EDE4] animate-in slide-in-from-bottom duration-300">
            <div className="flex items-center justify-between px-5 h-16 border-b border-[#221B16]/10">
              <h2 className="font-serif text-2xl">Filters</h2>
              <button type="button" onClick={() => setIsFilterOpen(false)} aria-label="Close filters" className="w-11 h-11 -mr-2 inline-flex items-center justify-center rounded-full">
                <i className="ri-close-line text-2xl" aria-hidden="true" />
              </button>
            </div>
            <div className="flex-1 overflow-y-auto px-5 py-6">{filters}</div>
            <div className="flex gap-3 px-5 pt-3 pb-[max(16px,env(safe-area-inset-bottom))] border-t border-[#221B16]/10">
              <button type="button" onClick={clearAll} className="h-14 px-6 rounded-full shadow-[inset_0_0_0_1px_rgba(34,27,22,0.25)] font-semibold">Clear</button>
              <button type="button" onClick={() => setIsFilterOpen(false)} className="flex-1 h-14 rounded-full bg-[#14100D] text-[#F5EDE4] font-semibold tabular-nums">
                Show {totalProducts} {totalProducts === 1 ? 'product' : 'products'}
              </button>
            </div>
          </div>
        </div>
      )}

      <section className="max-w-[1360px] mx-auto px-5 sm:px-8 lg:px-12 pt-4 lg:pt-10 pb-24 md:pb-32">
        <div className="flex gap-12">
          <aside className="hidden lg:block w-[260px] flex-none" aria-label="Filters">
            <div className="sticky top-[112px]">{filters}</div>
          </aside>

          <div className="flex-1 min-w-0">
            <div className="hidden lg:flex items-center justify-between gap-4 mb-8 pb-5 border-b border-[#221B16]/12">
              <p className="text-sm text-[#5E5148] tabular-nums">
                Showing <span className="font-semibold text-[#221B16]">{products.length}</span> of <span className="font-semibold text-[#221B16]">{totalProducts}</span>
              </p>
              <label className="flex items-center gap-3 text-sm">
                <span className="text-[#5E5148]">Sort by</span>
                <span className="relative">
                  <select
                    value={sortBy}
                    onChange={(e) => {
                      setSortBy(e.target.value);
                      setPage(1);
                    }}
                    className="h-11 pl-4 pr-10 rounded-full appearance-none bg-white shadow-[inset_0_0_0_1px_rgba(34,27,22,0.16)] font-semibold cursor-pointer"
                  >
                    {SORTS.map(([v, l]) => <option key={v} value={v}>{l}</option>)}
                  </select>
                  <i className="ri-arrow-down-s-line absolute right-3.5 top-1/2 -translate-y-1/2 pointer-events-none" aria-hidden="true" />
                </span>
              </label>
            </div>

            {loading ? (
              <div className="grid grid-cols-2 xl:grid-cols-3 gap-x-3 gap-y-8 sm:gap-x-6 sm:gap-y-12">
                {[...Array(6)].map((_, i) => <ProductCardSkeleton key={i} />)}
              </div>
            ) : products.length > 0 ? (
              <div className="grid grid-cols-2 xl:grid-cols-3 gap-x-3 gap-y-8 sm:gap-x-6 sm:gap-y-12" data-product-shop>
                {products.map((product) => <ProductCard key={product.id} {...product} />)}
              </div>
            ) : (
              <div className="flex flex-col items-center text-center gap-4 py-20 md:py-28 rounded-[28px] bg-[#FBF7F2]">
                <p className="font-serif text-3xl md:text-4xl">Nothing matches yet</p>
                <p className="max-w-sm text-[#5E5148]">Try another scent family, widen the price, or ask us on WhatsApp. We may have it in store.</p>
                <button type="button" onClick={clearAll} className="mt-2 inline-flex items-center min-h-[52px] px-7 rounded-full bg-[#14100D] text-[#F5EDE4] font-semibold">
                  Clear all filters
                </button>
              </div>
            )}

            {totalPages > 1 && (
              <nav aria-label="Pages" className="mt-14 md:mt-20 flex items-center justify-center gap-3">
                <button
                  type="button"
                  onClick={() => { setPage((p) => Math.max(1, p - 1)); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                  disabled={page === 1}
                  aria-label="Previous page"
                  className="w-12 h-12 inline-flex items-center justify-center rounded-full shadow-[inset_0_0_0_1px_rgba(34,27,22,0.2)] disabled:opacity-35"
                >
                  <i className="ri-arrow-left-line text-lg" aria-hidden="true" />
                </button>
                <span className="px-3 text-sm font-medium tabular-nums">Page {page} of {totalPages}</span>
                <button
                  type="button"
                  onClick={() => { setPage((p) => Math.min(totalPages, p + 1)); window.scrollTo({ top: 0, behavior: 'smooth' }); }}
                  disabled={page === totalPages}
                  aria-label="Next page"
                  className="w-12 h-12 inline-flex items-center justify-center rounded-full bg-[#14100D] text-[#F5EDE4] disabled:opacity-35"
                >
                  <i className="ri-arrow-right-line text-lg" aria-hidden="true" />
                </button>
              </nav>
            )}
          </div>
        </div>
      </section>
    </main>
  );
}

export default function ShopPage() {
  return (
    <Suspense fallback={<div className="min-h-screen bg-[#F5EDE4]" />}>
      <ShopContent />
    </Suspense>
  );
}