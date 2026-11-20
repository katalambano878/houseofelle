'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
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

  return (
    <div className="min-h-screen bg-[#F1E8DC]">
      <div className="bg-gradient-to-br from-blue-50 via-white to-amber-50 py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="max-w-3xl mx-auto text-center">
            <h1 className="text-4xl sm:text-5xl font-bold text-gray-900 mb-6">Our Blog</h1>
            <p className="text-lg sm:text-xl text-gray-600 leading-relaxed">
              Fragrance tips, gift ideas and news from House of Elle.
            </p>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        {loading ? (
          <div className="py-20 text-center text-gray-500">
            <i className="ri-loader-4-line animate-spin text-3xl text-blue-700"></i>
            <p className="mt-2">Loading posts…</p>
          </div>
        ) : error ? (
          <div className="py-20 text-center">
            <p className="text-gray-900 font-semibold mb-2">We could not load the blog right now.</p>
            <p className="text-gray-600">Please refresh the page to try again.</p>
          </div>
        ) : posts.length === 0 ? (
          <div className="py-20 text-center">
            <div className="w-20 h-20 flex items-center justify-center bg-gray-100 rounded-full mx-auto mb-6">
              <i className="ri-article-line text-4xl text-gray-400"></i>
            </div>
            <h2 className="text-2xl font-bold text-gray-900 mb-2">No posts yet</h2>
            <p className="text-gray-600">Check back soon for fragrance tips and news.</p>
          </div>
        ) : (
          <>
            {tags.length > 0 && (
              <div className="mb-10 flex flex-wrap gap-2">
                <button
                  onClick={() => setActiveTag(null)}
                  className={`px-4 py-2 rounded-full text-sm font-medium border transition-colors whitespace-nowrap ${
                    activeTag === null ? 'bg-blue-700 text-white border-blue-700' : 'bg-white text-gray-700 border-gray-200 hover:border-blue-500 hover:text-blue-700'
                  }`}
                >
                  All Posts ({posts.length})
                </button>
                {tags.map(([tag, count]) => (
                  <button
                    key={tag}
                    onClick={() => setActiveTag(tag)}
                    className={`px-4 py-2 rounded-full text-sm font-medium border transition-colors whitespace-nowrap ${
                      activeTag === tag ? 'bg-blue-700 text-white border-blue-700' : 'bg-white text-gray-700 border-gray-200 hover:border-blue-500 hover:text-blue-700'
                    }`}
                  >
                    {tag} ({count})
                  </button>
                ))}
              </div>
            )}

            {featuredPost && (
              <Link href={`/blog/${featuredPost.slug || featuredPost.id}`} className="block mb-16 hover:opacity-90 transition-opacity">
                <div className="bg-white border border-gray-200 rounded-3xl overflow-hidden shadow-lg hover:shadow-2xl transition-shadow">
                  <div className="grid md:grid-cols-2 gap-0">
                    <div className="relative h-72 md:h-auto md:min-h-[24rem] bg-gray-100">
                      {featuredPost.featured_image ? (
                        <img src={featuredPost.featured_image} alt={featuredPost.title} className="absolute inset-0 w-full h-full object-cover" />
                      ) : (
                        <div className="absolute inset-0 flex items-center justify-center">
                          <i className="ri-article-line text-6xl text-gray-300"></i>
                        </div>
                      )}
                      <div className="absolute top-6 left-6">
                        <span className="bg-blue-700 text-white px-4 py-2 rounded-full text-sm font-medium">Latest</span>
                      </div>
                    </div>
                    <div className="p-8 sm:p-12 flex flex-col justify-center">
                      <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500 mb-4">
                        {featuredPost.tags?.[0] && (
                          <span className="bg-amber-100 text-amber-700 px-3 py-1 rounded-full font-medium">{featuredPost.tags[0]}</span>
                        )}
                        <span>{formatDate(featuredPost.published_at || featuredPost.created_at)}</span>
                        <span className="flex items-center gap-1">
                          <i className="ri-time-line"></i>
                          {readTime(featuredPost.content)}
                        </span>
                      </div>
                      <h2 className="text-3xl sm:text-4xl font-bold text-gray-900 mb-4 leading-tight">{featuredPost.title}</h2>
                      <p className="text-gray-600 text-lg leading-relaxed">{summary(featuredPost)}</p>
                    </div>
                  </div>
                </div>
              </Link>
            )}

            {rest.length > 0 && (
              <>
                <h2 className="text-3xl font-bold text-gray-900 mb-8">More Articles</h2>
                <div className="grid md:grid-cols-2 lg:grid-cols-3 gap-8">
                  {rest.map((post) => (
                    <Link
                      key={post.id}
                      href={`/blog/${post.slug || post.id}`}
                      className="bg-white border border-gray-200 rounded-2xl overflow-hidden hover:shadow-lg transition-all"
                    >
                      <div className="relative h-56 bg-gray-100">
                        {post.featured_image ? (
                          <img src={post.featured_image} alt={post.title} className="w-full h-full object-cover" />
                        ) : (
                          <div className="w-full h-full flex items-center justify-center">
                            <i className="ri-article-line text-5xl text-gray-300"></i>
                          </div>
                        )}
                      </div>
                      <div className="p-6">
                        <div className="flex flex-wrap items-center gap-3 text-sm text-gray-500 mb-3">
                          {post.tags?.[0] && (
                            <span className="bg-gray-100 text-gray-700 px-3 py-1 rounded-full font-medium text-xs">{post.tags[0]}</span>
                          )}
                          <span className="text-xs">{formatDate(post.published_at || post.created_at)}</span>
                        </div>
                        <h3 className="text-xl font-bold text-gray-900 mb-3 leading-tight">{post.title}</h3>
                        <p className="text-gray-600 mb-4 leading-relaxed text-sm">{summary(post)}</p>
                        <span className="text-xs text-gray-500 flex items-center gap-1">
                          <i className="ri-time-line"></i>
                          {readTime(post.content)}
                        </span>
                      </div>
                    </Link>
                  ))}
                </div>
              </>
            )}
          </>
        )}
      </div>

      <div className="bg-gradient-to-br from-blue-700 to-blue-900 py-16">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h2 className="text-3xl sm:text-4xl font-bold text-white mb-4">Ready to Start Shopping?</h2>
          <p className="text-xl text-blue-100 mb-8 leading-relaxed">
            Browse our perfumes, body mists, candles and body care
          </p>
          <Link
            href="/shop"
            className="inline-flex items-center gap-2 bg-white text-blue-700 px-8 py-4 rounded-full font-medium hover:bg-blue-50 transition-colors whitespace-nowrap"
          >
            Explore Products
            <i className="ri-arrow-right-line"></i>
          </Link>
        </div>
      </div>
    </div>
  );
}
