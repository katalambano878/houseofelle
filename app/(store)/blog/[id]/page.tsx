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
      <main className="min-h-screen flex items-center justify-center bg-[#F1E8DC]" role="status">
        <i className="ri-loader-4-line animate-spin motion-reduce:animate-none text-4xl text-[#7A1F2E]" aria-hidden="true" />
        <span className="sr-only">Loading the post</span>
      </main>
    );
  }

  if (status === 'missing' || status === 'error' || !post) {
    return (
      <main className="min-h-[60vh] flex items-center justify-center bg-[#F1E8DC] text-[#1F1115] px-5 py-16">
        <div className="text-center max-w-md flex flex-col items-center gap-3">
          <h1 className="font-serif text-[36px] md:text-[44px] leading-none">
            {status === 'error' ? 'Something went wrong' : 'Post not found'}
          </h1>
          <p className="text-[15px] text-[#6B565B]">
            {status === 'error'
              ? 'We could not load this article. Please try again.'
              : 'This article may have been moved or is no longer available.'}
          </p>
          <Link
            href="/blog"
            className="mt-3 inline-flex items-center gap-2 min-h-[52px] px-7 rounded-full bg-[#2B0B12] text-[#F6EDE3] font-semibold hover:bg-[#4A1520] transition-colors motion-reduce:transition-none"
          >
            <i className="ri-arrow-left-line" aria-hidden="true" />
            Back to the journal
          </Link>
        </div>
      </main>
    );
  }

  const paragraphs = (post.content || '')
    .replace(/\r\n/g, '\n')
    .split(/\n{2,}/)
    .map((p) => p.trim())
    .filter(Boolean);

  return (
    <main className="min-h-screen bg-[#F1E8DC] text-[#1F1115]">
      <section className="bg-[#2B0B12] text-[#F6EDE3]">
        <div className="max-w-[1360px] mx-auto px-5 sm:px-8 lg:px-12 pt-10 md:pt-16 pb-14 md:pb-20">
          <div className="max-w-[820px] mx-auto flex flex-col gap-5">
            <Link href="/blog" className="self-start inline-flex items-center gap-2 min-h-[44px] text-sm font-semibold text-[#E3CFC7] hover:text-[#F6EDE3]">
              <i className="ri-arrow-left-line" aria-hidden="true" />
              The journal
            </Link>
            <h1 className="font-serif text-[36px] md:text-[52px] leading-[1] tracking-[-0.02em] text-balance">{post.title}</h1>
            <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-[#CDB5AD]">
              {post.tags?.[0] && <span className="font-semibold text-[#E5B65A]">{post.tags[0]}</span>}
              <span>{formatDate(post.published_at || post.created_at)}</span>
              <span aria-hidden="true">·</span>
              <span>{readTime(post.content)}</span>
            </p>
          </div>
        </div>
      </section>

      {post.featured_image && (
        <div className="max-w-[1360px] mx-auto px-5 sm:px-8 lg:px-12 -mt-6 md:-mt-8">
          <div className="max-w-[1000px] mx-auto relative h-[240px] sm:h-[360px] md:h-[480px] rounded-[24px] overflow-hidden bg-[#4A1520]">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={post.featured_image} alt="" className="absolute inset-0 w-full h-full object-cover" />
          </div>
        </div>
      )}

      <div className="max-w-[1360px] mx-auto px-5 sm:px-8 lg:px-12 py-12 md:py-16">
        <div className="max-w-[720px] mx-auto">
          <article className="flex flex-col gap-6 text-[16px] md:text-[17px] leading-[1.8] text-[#2E1E22]">
            {paragraphs.map((para, i) => (
              <p key={i} className="whitespace-pre-line">{para}</p>
            ))}
          </article>

          {post.tags && post.tags.length > 0 && (
            <ul className="mt-10 flex flex-wrap gap-2" aria-label="Tags">
              {post.tags.map((tag) => (
                <li key={tag} className="px-3.5 py-1.5 rounded-full bg-[#FBF6EF] shadow-[inset_0_0_0_1px_rgba(31,17,21,0.12)] text-sm text-[#4D3A3F]">
                  {tag}
                </li>
              ))}
            </ul>
          )}

          <div className="mt-12 pt-8 border-t border-[#1F1115]/14 flex flex-wrap items-center justify-between gap-4">
            <p className="text-[15px] font-semibold">Share this article</p>
            <div className="flex gap-2">
              <button type="button" onClick={() => share()} aria-label="Share or copy link" className="w-11 h-11 rounded-full inline-flex items-center justify-center shadow-[inset_0_0_0_1px_rgba(31,17,21,0.2)] hover:bg-[#2B0B12] hover:text-[#F6EDE3] transition-colors motion-reduce:transition-none">
                <i className="ri-share-line text-lg" aria-hidden="true" />
              </button>
              <button type="button" onClick={() => share('whatsapp')} aria-label="Share on WhatsApp" className="w-11 h-11 rounded-full inline-flex items-center justify-center shadow-[inset_0_0_0_1px_rgba(31,17,21,0.2)] hover:bg-[#2B0B12] hover:text-[#F6EDE3] transition-colors motion-reduce:transition-none">
                <i className="ri-whatsapp-line text-lg" aria-hidden="true" />
              </button>
              <button type="button" onClick={() => share('facebook')} aria-label="Share on Facebook" className="w-11 h-11 rounded-full inline-flex items-center justify-center shadow-[inset_0_0_0_1px_rgba(31,17,21,0.2)] hover:bg-[#2B0B12] hover:text-[#F6EDE3] transition-colors motion-reduce:transition-none">
                <i className="ri-facebook-fill text-lg" aria-hidden="true" />
              </button>
              <button type="button" onClick={() => share('x')} aria-label="Share on X" className="w-11 h-11 rounded-full inline-flex items-center justify-center shadow-[inset_0_0_0_1px_rgba(31,17,21,0.2)] hover:bg-[#2B0B12] hover:text-[#F6EDE3] transition-colors motion-reduce:transition-none">
                <i className="ri-twitter-x-fill text-lg" aria-hidden="true" />
              </button>
            </div>
            {shareStatus && <p className="w-full text-sm text-[#6B565B]" role="status">{shareStatus}</p>}
          </div>
        </div>

        {related.length > 0 && (
          <section aria-labelledby="post-more" className="max-w-[1000px] mx-auto mt-16 md:mt-20 flex flex-col gap-6">
            <h2 id="post-more" className="font-serif text-[28px] md:text-[34px] leading-none">Keep <em>reading</em></h2>
            <ul className="grid sm:grid-cols-2 gap-x-6 gap-y-10">
              {related.map((item) => (
                <li key={item.id}>
                  <Link href={`/blog/${item.slug || item.id}`} className="group flex flex-col gap-4">
                    <span className="relative block aspect-[4/3] rounded-[22px] overflow-hidden bg-[#FBF6EF] shadow-[inset_0_0_0_1px_rgba(31,17,21,0.1)]">
                      {item.featured_image ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={item.featured_image}
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
                    <span className="flex flex-col gap-1.5">
                      {item.tags?.[0] && <span className="text-[13px] font-semibold text-[#7A1F2E]">{item.tags[0]}</span>}
                      <h3 className="font-serif text-[22px] md:text-[24px] leading-[1.1] group-hover:text-[#7A1F2E] transition-colors motion-reduce:transition-none">{item.title}</h3>
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        <div className="mt-14 text-center">
          <Link
            href="/blog"
            className="inline-flex items-center gap-2 min-h-[52px] px-7 rounded-full shadow-[inset_0_0_0_1.5px_rgba(31,17,21,0.3)] font-semibold hover:bg-[#FBF6EF] transition-colors motion-reduce:transition-none"
          >
            <i className="ri-arrow-left-line" aria-hidden="true" />
            Back to the journal
          </Link>
        </div>
      </div>
    </main>
  );
}
