'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';

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

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const FIELDS = 'id, title, slug, excerpt, content, featured_image, published_at, created_at, tags';

const formatDate = (value: string | null) =>
  value
    ? new Date(value).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' })
    : '';

const readTime = (content: string | null) => {
  const words = (content || '').trim().split(/\s+/).filter(Boolean).length;
  return `${Math.max(1, Math.round(words / 200))} min read`;
};

export default function BlogPostPage() {
  const params = useParams();
  const idOrSlug = decodeURIComponent(String(params.id || ''));
  const [post, setPost] = useState<BlogPost | null>(null);
  const [related, setRelated] = useState<BlogPost[]>([]);
  const [status, setStatus] = useState<'loading' | 'ready' | 'missing' | 'error'>('loading');
  const [shareStatus, setShareStatus] = useState('');

  useEffect(() => {
    let active = true;
    (async () => {
      setStatus('loading');
      const { data, error } = await supabase
        .from('blog_posts')
        .select(FIELDS)
        .eq('status', 'published')
        .eq(UUID_RE.test(idOrSlug) ? 'id' : 'slug', idOrSlug)
        .maybeSingle();
      if (!active) return;
      if (error) {
        setStatus('error');
        return;
      }
      const found = data as BlogPost | null;
      if (!found || (found.published_at && new Date(found.published_at).getTime() > Date.now())) {
        setStatus('missing');
        return;
      }
      setPost(found);
      setStatus('ready');
      document.title = `${found.title} | House of Elle`;

      const { data: others } = await supabase
        .from('blog_posts')
        .select(FIELDS)
        .eq('status', 'published')
        .neq('id', found.id)
        .order('published_at', { ascending: false })
        .limit(12);
      if (!active) return;
      const now = Date.now();
      const list = ((others as BlogPost[]) || []).filter(
        (p) => !p.published_at || new Date(p.published_at).getTime() <= now
      );
      const tags = new Set((found.tags || []).map((t) => t.trim()));
      const sameTag = list.filter((p) => (p.tags || []).some((t) => tags.has(t.trim())));
      const rest = list.filter((p) => !sameTag.includes(p));
      setRelated([...sameTag, ...rest].slice(0, 2));
    })();
    return () => {
      active = false;
    };
  }, [idOrSlug]);

  const share = async (channel?: 'whatsapp' | 'facebook' | 'x') => {
    if (!post) return;
    const url = `${window.location.origin}/blog/${post.slug || post.id}`;
    setShareStatus('');
    if (channel === 'whatsapp') {
      window.open(`https://wa.me/?text=${encodeURIComponent(`${post.title} ${url}`)}`, '_blank', 'noopener,noreferrer');
      return;
    }
    if (channel === 'facebook') {
      window.open(`https://www.facebook.com/sharer/sharer.php?u=${encodeURIComponent(url)}`, '_blank', 'noopener,noreferrer');
      return;
    }
    if (channel === 'x') {
      window.open(`https://twitter.com/intent/tweet?text=${encodeURIComponent(post.title)}&url=${encodeURIComponent(url)}`, '_blank', 'noopener,noreferrer');
      return;
    }
    try {
      if (navigator.share) {
        await navigator.share({ title: post.title, url });
        return;
      }
      await navigator.clipboard.writeText(url);
      setShareStatus('Link copied to your clipboard.');
    } catch (err) {
      if ((err as Error)?.name !== 'AbortError') setShareStatus('Could not share this article.');
    }
  };

  if (status === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <i className="ri-loader-4-line animate-spin text-4xl text-blue-700"></i>
      </div>
    );
  }

  if (status === 'missing' || status === 'error' || !post) {
    return (
      <div className="min-h-[60vh] flex items-center justify-center bg-white px-4">
        <div className="text-center max-w-md">
          <div className="w-20 h-20 flex items-center justify-center bg-gray-100 rounded-full mx-auto mb-6">
            <i className="ri-article-line text-4xl text-gray-400"></i>
          </div>
          <h1 className="text-3xl font-bold text-gray-900 mb-2">
            {status === 'error' ? 'Something went wrong' : 'Post not found'}
          </h1>
          <p className="text-gray-600 mb-6">
            {status === 'error'
              ? 'We could not load this article. Please try again.'
              : 'This article may have been moved or is no longer available.'}
          </p>
          <Link
            href="/blog"
            className="inline-flex items-center gap-2 bg-blue-700 text-white px-6 py-3 rounded-lg font-semibold hover:bg-blue-800 transition-colors"
          >
            <i className="ri-arrow-left-line"></i>
            Back to Blog
          </Link>
        </div>
      </div>
    );
  }

  const paragraphs = (post.content || '')
    .replace(/\r\n/g, '\n')
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);

  return (
    <div className="min-h-screen bg-white">
      <div className="relative h-80 sm:h-96 bg-gray-900">
        {post.featured_image && (
          <img src={post.featured_image} alt={post.title} className="w-full h-full object-cover opacity-50" />
        )}
        <div className="absolute inset-0 flex items-center justify-center">
          <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
            {post.tags?.[0] && (
              <span className="inline-block bg-blue-600 text-white px-4 py-2 rounded-full text-sm font-medium mb-4">
                {post.tags[0]}
              </span>
            )}
            <h1 className="text-3xl sm:text-5xl font-bold text-white mb-6">{post.title}</h1>
            <div className="flex flex-wrap items-center justify-center gap-6 text-blue-100">
              <span className="flex items-center gap-2">
                <i className="ri-calendar-line"></i>
                {formatDate(post.published_at || post.created_at)}
              </span>
              <span className="flex items-center gap-2">
                <i className="ri-time-line"></i>
                {readTime(post.content)}
              </span>
            </div>
          </div>
        </div>
      </div>

      <div className="max-w-4xl mx-auto px-4 sm:px-6 lg:px-8 py-16">
        <article className="max-w-none space-y-6 text-gray-700 text-lg leading-relaxed">
          {paragraphs.map((para, i) => (
            <p key={i} className="whitespace-pre-line">{para}</p>
          ))}
        </article>

        {post.tags && post.tags.length > 0 && (
          <div className="mt-10 flex flex-wrap gap-2">
            {post.tags.map((tag) => (
              <span key={tag} className="px-4 py-2 bg-gray-50 border border-gray-200 rounded-full text-sm text-gray-700">
                #{tag}
              </span>
            ))}
          </div>
        )}

        <div className="mt-12 pt-12 border-t border-gray-200">
          <p className="text-sm text-gray-500 mb-3">Share this article</p>
          <div className="flex gap-3">
            <button onClick={() => share()} aria-label="Share or copy link" className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center hover:bg-blue-100 transition-colors">
              <i className="ri-share-line text-gray-600"></i>
            </button>
            <button onClick={() => share('whatsapp')} aria-label="Share on WhatsApp" className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center hover:bg-blue-100 transition-colors">
              <i className="ri-whatsapp-line text-gray-600"></i>
            </button>
            <button onClick={() => share('facebook')} aria-label="Share on Facebook" className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center hover:bg-blue-100 transition-colors">
              <i className="ri-facebook-fill text-gray-600"></i>
            </button>
            <button onClick={() => share('x')} aria-label="Share on X" className="w-10 h-10 bg-gray-100 rounded-full flex items-center justify-center hover:bg-blue-100 transition-colors">
              <i className="ri-twitter-x-fill text-gray-600"></i>
            </button>
          </div>
          {shareStatus && <p className="mt-3 text-sm text-gray-600" role="status">{shareStatus}</p>}
        </div>

        {related.length > 0 && (
          <div className="mt-16">
            <h2 className="text-3xl font-bold text-gray-900 mb-8">More Articles</h2>
            <div className="grid md:grid-cols-2 gap-8">
              {related.map((item) => (
                <Link
                  key={item.id}
                  href={`/blog/${item.slug || item.id}`}
                  className="bg-white border border-gray-200 rounded-2xl overflow-hidden hover:shadow-lg transition-all"
                >
                  <div className="relative h-48 bg-gray-100">
                    {item.featured_image ? (
                      <img src={item.featured_image} alt={item.title} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center">
                        <i className="ri-article-line text-5xl text-gray-300"></i>
                      </div>
                    )}
                    {item.tags?.[0] && (
                      <span className="absolute top-4 left-4 bg-blue-700 text-white px-3 py-1 rounded-full text-xs font-medium">
                        {item.tags[0]}
                      </span>
                    )}
                  </div>
                  <div className="p-6">
                    <h3 className="text-xl font-bold text-gray-900 leading-tight">{item.title}</h3>
                  </div>
                </Link>
              ))}
            </div>
          </div>
        )}

        <div className="mt-12 text-center">
          <Link href="/blog" className="inline-flex items-center gap-2 text-blue-700 font-medium hover:gap-3 transition-all">
            <i className="ri-arrow-left-line"></i>
            Back to Blog
          </Link>
        </div>
      </div>
    </div>
  );
}
