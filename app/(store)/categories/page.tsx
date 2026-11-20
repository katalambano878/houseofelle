import Link from 'next/link';
import { supabaseAdmin as supabase } from '@/lib/supabase-admin';
import { SCENT_FAMILIES } from '@/components/home/families-data';

export const revalidate = 0; // Ensure fresh data on every visit

export default async function CategoriesPage() {
  const { data: categoriesData } = await supabase
    .from('categories')
    .select(`
      id,
      name,
      slug,
      description,
      image_url,
      position
    `)
    .eq('status', 'active')
    .order('position', { ascending: true });

  const categories = ((categoriesData as any[]) || []).map((c) => ({
    ...c,
    image: c.image_url || '/placeholder-product.svg',
  }));

  return (
    <main className="min-h-screen bg-[#F1E8DC] text-[#1F1115]">
      <section className="max-w-[1360px] mx-auto px-5 sm:px-8 lg:px-12 pt-10 md:pt-20 pb-8 md:pb-10 flex flex-wrap items-end justify-between gap-5">
        <h1 className="font-serif text-[40px] md:text-[56px] leading-[0.95] tracking-[-0.02em]">
          The <em>collections</em>
        </h1>
        <p className="text-[15px] leading-relaxed text-[#6B565B] max-w-[420px]">
          Explore House of Elle collections by scent profile, mood, and everyday lifestyle.
        </p>
      </section>

      <section aria-label="Collections" className="max-w-[1360px] mx-auto px-5 sm:px-8 lg:px-12 pb-20 md:pb-[120px]">
        {categories.length > 0 ? (
          <ul className="border-t border-[#1F1115]/14">
            {categories.map((category, i) => (
              <li key={category.id} className="border-b border-[#1F1115]/14">
                <Link
                  href={`/shop?category=${category.slug}`}
                  className="group grid gap-5 md:gap-10 md:grid-cols-2 lg:grid-cols-[minmax(0,1fr)_minmax(0,1.2fr)] md:items-center py-8 md:py-10"
                >
                  <span className={`flex flex-col gap-3 md:gap-3.5 ${i % 2 === 1 ? 'md:order-2 md:pl-4 lg:pl-8' : ''}`}>
                    <span className="font-serif text-[30px] md:text-[39px] leading-[0.95] tracking-[-0.02em]">{category.name}</span>
                    {category.description && (
                      <span className="text-[15px] leading-[1.65] text-[#4D3A3F] max-w-[380px]">{category.description}</span>
                    )}
                    <span className="inline-flex items-center gap-2.5 min-h-[44px] mt-1 font-semibold text-[15px]">
                      Shop {category.name}
                      <i className="ri-arrow-right-line text-lg transition-transform duration-300 group-hover:translate-x-1 motion-reduce:transition-none motion-reduce:group-hover:translate-x-0" aria-hidden="true" />
                    </span>
                  </span>
                  <span className="relative block h-[240px] sm:h-[300px] md:h-[360px] rounded-[24px] overflow-hidden bg-[#2B0B12]">
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={category.image}
                      alt=""
                      loading={i < 2 ? 'eager' : 'lazy'}
                      className="absolute inset-0 w-full h-full object-cover transition-transform duration-[900ms] ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-[1.04] motion-reduce:transition-none motion-reduce:group-hover:scale-100"
                    />
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        ) : (
          <div className="flex flex-col items-center gap-4 text-center py-20 rounded-[24px] bg-[#FBF6EF] shadow-[inset_0_0_0_1px_rgba(31,17,21,0.1)]">
            <p className="font-serif text-[26px] leading-tight">No collections to show yet.</p>
            <Link href="/shop" className="inline-flex items-center gap-2 min-h-[52px] px-7 rounded-full bg-[#2B0B12] text-[#F6EDE3] font-semibold">
              Browse everything <i className="ri-arrow-right-line" aria-hidden="true" />
            </Link>
          </div>
        )}
      </section>

      <section aria-labelledby="by-smell" className="bg-[#2B0B12] text-[#F6EDE3]">
        <div className="max-w-[1360px] mx-auto px-5 sm:px-8 lg:px-12 pt-16 md:pt-[104px] pb-20 md:pb-28 flex flex-col gap-8 md:gap-11">
          <div className="flex flex-wrap items-end justify-between gap-5 md:gap-8">
            <h2 id="by-smell" className="font-serif text-[32px] md:text-[41px] leading-[0.95] tracking-[-0.02em]">
              Or shop by how it <em className="text-[#E5B65A]">smells</em>
            </h2>
            <p className="text-[15px] leading-[1.7] text-[#E3CFC7] max-w-[340px]">Pick a family and we&apos;ll show you bottles with those notes.</p>
          </div>
          <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3 md:gap-4">
            {SCENT_FAMILIES.map((f) => (
              <li key={f.name}>
                <Link
                  href={`/shop?search=${encodeURIComponent(f.keyword)}`}
                  className="group flex h-full flex-col gap-6 md:gap-[26px] p-6 md:p-7 rounded-[24px] bg-[#F6EDE3]/5 shadow-[inset_0_0_0_1px_rgba(246,237,227,0.14)] hover:bg-[#F6EDE3]/10 transition-colors motion-reduce:transition-none"
                >
                  <span className="flex items-center justify-between">
                    <span className="w-11 h-11 rounded-full shadow-[inset_0_0_0_1px_rgba(246,237,227,0.25)]" style={{ backgroundColor: f.swatch }} aria-hidden="true" />
                    <i className="ri-arrow-right-line text-xl transition-transform duration-300 group-hover:translate-x-1 motion-reduce:transition-none motion-reduce:group-hover:translate-x-0" aria-hidden="true" />
                  </span>
                  <span className="flex flex-col gap-1.5">
                    <span className="font-serif text-[26px] md:text-[30px] leading-none">{f.name}</span>
                    <span className="text-sm text-[#CDB5AD]">{f.notes.slice(0, 3).join(', ')}</span>
                  </span>
                </Link>
              </li>
            ))}
          </ul>
        </div>
      </section>
    </main>
  );
}
