'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import PageHero from '@/components/PageHero';
import { supabase } from '@/lib/supabase';
import { usePageTitle } from '@/hooks/usePageTitle';

interface BlogPost {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  content: string | null;
  featured_image: string | null;
  published_at: string | null;
  created_at: string | null;
  tags: string[] | null;
}

const formatDate = (value: string | null) =>
  value
    ? new Date(value).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
    : '';

const readTime = (content: string | null) => {
  const words = (content || '').trim().split(/\s+/).filter(Boolean).length;
  return `${Math.max(1, Math.round(words / 200))} min read`;
};

const summary = (post: BlogPost) => {
  if (post.excerpt) return post.excerpt;
  const text = (post.content || '').replace(/\s+/g, ' ').trim();
  return text.length > 180 ? `${text.slice(0, 177)}…` : text;
};

export default function BlogPage() {
  usePageTitle('Blog');
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [activeTag, setActiveTag] = useState<string | null>(null);

  useEffect(() => {
    let active = true;
    supabase
      .from('blog_posts')
      .select('id, title, slug, excerpt, content, featured_image, published_at, created_at, tags')
      .eq('status', 'published')
      .order('published_at', { ascending: false })
      .then(({ data, error: loadError }) => {
        if (!active) return;
        if (loadError) setError(true);
        else {
          const now = Date.now();
          // Hide posts scheduled for a future date.
          setPosts(((data as BlogPost[]) || []).filter((p) => !p.published_at || new Date(p.published_at).getTime() <= now));
        }
        setLoading(false);
      });
    return () => {
      active = false;
    };
  }, []);

  const tags = useMemo(() => {
    const counts = new Map<string, number>();
    for (const post of posts) {
      for (const tag of post.tags || []) {
        const clean = tag.trim();
        if (clean) counts.set(clean, (counts.get(clean) || 0) + 1);
      }
    }
    return Array.from(counts.entries()).sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  }, [posts]);

  const visible = activeTag ? posts.filter((p) => (p.tags || []).some((t) => t.trim() === activeTag)) : posts;
  const [featuredPost, ...rest] = visible;

  const chip = (on: boolean) =>
    `shrink-0 min-h-[44px] px-4 rounded-full text-sm font-semibold whitespace-nowrap transition-colors motion-reduce:transition-none ${
      on ? 'bg-[#2B0B12] text-[#F6EDE3]' : 'shadow-[inset_0_0_0_1px_rgba(31,17,21,0.2)] hover:bg-[#FBF6EF]'
    }`;

  return (
    <main className="min-h-screen bg-[#F1E8DC] text-[#1F1115]">
      <PageHero title="The journal" subtitle="Fragrance tips, gift ideas and news from House of Elle." />

      <div className="max-w-[1360px] mx-auto px-5 sm:px-8 lg:px-12 py-12 md:py-20">
        {loading ? (
          <div className="py-20 flex flex-col items-center gap-2 text-[#6B565B]" role="status">
            <i className="ri-loader-4-line animate-spin motion-reduce:animate-none text-3xl text-[#7A1F2E]" aria-hidden="true" />
            <p>Loading posts…</p>
          </div>
        ) : error ? (
          <div className="py-20 text-center">
            <p className="font-serif text-[26px] leading-tight mb-2">We could not load the journal right now.</p>
            <p className="text-[15px] text-[#6B565B]">Please refresh the page to try again.</p>
          </div>
        ) : posts.length === 0 ? (
          <div className="py-20 text-center">
            <h2 className="font-serif text-[30px] leading-tight mb-2">No posts yet</h2>
            <p className="text-[15px] text-[#6B565B]">Check back soon for fragrance tips and news.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-12 md:gap-16">
            {tags.length > 0 && (
              <div role="group" aria-label="Filter by topic" className="flex gap-2 overflow-x-auto pb-1 -mx-5 px-5 sm:mx-0 sm:px-0 sm:flex-wrap">
                <button type="button" aria-pressed={activeTag === null} onClick={() => setActiveTag(null)} className={chip(activeTag === null)}>
                  All posts <span className="opacity-70 tabular-nums">{posts.length}</span>
                </button>
                {tags.map(([tag, count]) => (
                  <button key={tag} type="button" aria-pressed={activeTag === tag} onClick={() => setActiveTag(tag)} className={chip(activeTag === tag)}>
                    {tag} <span className="opacity-70 tabular-nums">{count}</span>
                  </button>
                ))}
              </div>
            )}

            {featuredPost && (
              <Link href={`/blog/${featuredPost.slug || featuredPost.id}`} className="group grid md:grid-cols-[1.15fr_1fr] gap-6 md:gap-12 md:items-center">
                <span className="relative block h-[260px] sm:h-[340px] md:h-[440px] rounded-[24px] overflow-hidden bg-[#2B0B12]">
                  {featuredPost.featured_image ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={featuredPost.featured_image}
                      alt=""
                      className="absolute inset-0 w-full h-full object-cover transition-transform duration-[900ms] ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-[1.03] motion-reduce:transition-none motion-reduce:group-hover:scale-100"
                    />
                  ) : (
                    <span className="absolute inset-0 flex items-center justify-center">
                      <i className="ri-article-line text-5xl text-[#CDB5AD]" aria-hidden="true" />
                    </span>
                  )}
                  <span className="absolute top-4 left-4 rounded-full bg-[#D9A441] text-[#2B0B12] px-3 py-1.5 text-xs font-bold">Latest</span>
                </span>
                <span className="flex flex-col gap-4">
                  <span className="flex flex-wrap items-center gap-x-3 gap-y-2 text-sm text-[#6B565B]">
                    {featuredPost.tags?.[0] && (
                      <span className="rounded-full bg-[#FBF6EF] shadow-[inset_0_0_0_1px_rgba(31,17,21,0.12)] px-3 py-1 font-semibold text-[#7A1F2E]">{featuredPost.tags[0]}</span>
                    )}
                    <span>{formatDate(featuredPost.published_at || featuredPost.created_at)}</span>
                    <span aria-hidden="true">·</span>
                    <span>{readTime(featuredPost.content)}</span>
                  </span>
                  <h2 className="font-serif text-[30px] md:text-[40px] leading-[1.02] tracking-[-0.02em] text-balance group-hover:text-[#7A1F2E] transition-colors motion-reduce:transition-none">
                    {featuredPost.title}
                  </h2>
                  <p className="text-[15px] md:text-base leading-[1.7] text-[#4D3A3F] max-w-[520px]">{summary(featuredPost)}</p>
                  <span className="inline-flex items-center gap-2 min-h-[44px] font-semibold text-[15px]">
                    Read the post
                    <i className="ri-arrow-right-line transition-transform group-hover:translate-x-1 motion-reduce:transition-none motion-reduce:group-hover:translate-x-0" aria-hidden="true" />
                  </span>
                </span>
              </Link>
            )}

            {rest.length > 0 && (
              <section aria-labelledby="blog-more" className="flex flex-col gap-6 md:gap-8 pt-10 md:pt-14 border-t border-[#1F1115]/14">
                <h2 id="blog-more" className="font-serif text-[30px] md:text-[39px] leading-none">More <em>stories</em></h2>
                <ul className="grid sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-10 md:gap-y-12">
                  {rest.map((post) => (
                    <li key={post.id}>
                      <Link href={`/blog/${post.slug || post.id}`} className="group flex flex-col gap-4">
                        <span className="relative block aspect-[4/3] rounded-[22px] overflow-hidden bg-[#FBF6EF] shadow-[inset_0_0_0_1px_rgba(31,17,21,0.1)]">
                          {post.featured_image ? (
                            // eslint-disable-next-line @next/next/no-img-element
                            <img
                              src={post.featured_image}
                              alt=""
                              loading="lazy"
                              className="absolute inset-0 w-full h-full object-cover transition-transform duration-[900ms] ease-[cubic-bezier(0.22,1,0.36,1)] group-hover:scale-[1.04] motion-reduce:transition-none motion-reduce:group-hover:scale-100"
                            />
                          ) : (
                            <span className="absolute inset-0 flex items-center justify-center">
                              <i className="ri-article-line text-4xl text-[#6B565B]" aria-hidden="true" />
                            </span>
                          )}
                        </span>
                        <span className="flex flex-col gap-2">
                          <span className="flex flex-wrap items-center gap-x-2.5 gap-y-1 text-[13px] text-[#6B565B]">
                            {post.tags?.[0] && <span className="font-semibold text-[#7A1F2E]">{post.tags[0]}</span>}
                            <span>{formatDate(post.published_at || post.created_at)}</span>
                            <span aria-hidden="true">·</span>
                            <span>{readTime(post.content)}</span>
                          </span>
                          <h3 className="font-serif text-[22px] md:text-[24px] leading-[1.1] group-hover:text-[#7A1F2E] transition-colors motion-reduce:transition-none">{post.title}</h3>
                          <p className="text-[15px] leading-[1.65] text-[#4D3A3F] line-clamp-3">{summary(post)}</p>
                        </span>
                      </Link>
                    </li>
                  ))}
                </ul>
              </section>
            )}
          </div>
        )}
      </div>

      <section className="bg-[#2B0B12] text-[#F6EDE3]">
        <div className="max-w-[1360px] mx-auto px-5 sm:px-8 lg:px-12 py-16 md:py-20 flex flex-wrap items-end justify-between gap-6">
          <div className="flex flex-col gap-3">
            <h2 className="font-serif text-[30px] md:text-[39px] leading-none">Ready to find your <em className="text-[#E5B65A]">scent?</em></h2>
            <p className="text-[15px] leading-relaxed text-[#E3CFC7]">Browse our perfumes, body mists, candles and body care.</p>
          </div>
          <Link
            href="/shop"
            className="inline-flex items-center gap-2 min-h-[56px] px-8 rounded-full bg-[#D9A441] text-[#2B0B12] font-semibold hover:bg-[#E5B65A] transition-colors motion-reduce:transition-none whitespace-nowrap"
          >
            Explore products
            <i className="ri-arrow-right-line" aria-hidden="true" />
          </Link>
        </div>
      </section>
    </main>
  );
}
