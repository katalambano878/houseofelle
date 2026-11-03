'use client';

import Link from 'next/link';
import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase';

/** Mirrors the blog_status enum: ('draft', 'published', 'archived'). */
type BlogStatus = 'draft' | 'published' | 'archived';

interface BlogPost {
  id: string;
  title: string;
  slug: string;
  excerpt: string | null;
  content: string;
  featured_image: string | null;
  status: BlogStatus;
  published_at: string | null;
  seo_title: string | null;
  seo_description: string | null;
  tags: string[] | null;
  created_at: string;
  updated_at: string | null;
}

type FormState = {
  title: string;
  slug: string;
  excerpt: string;
  content: string;
  featured_image: string;
  status: BlogStatus;
  tags: string;
  seo_title: string;
  seo_description: string;
};

const EMPTY_FORM: FormState = {
  title: '',
  slug: '',
  excerpt: '',
  content: '',
  featured_image: '',
  status: 'draft',
  tags: '',
  seo_title: '',
  seo_description: '',
};

const STATUS_LABELS: Record<BlogStatus, string> = {
  draft: 'Draft',
  published: 'Published',
  archived: 'Archived',
};

const STATUS_COLORS: Record<BlogStatus, string> = {
  published: 'bg-emerald-100 text-emerald-700',
  draft: 'bg-gray-100 text-gray-700',
  archived: 'bg-amber-100 text-amber-700',
};

const slugify = (s: string) =>
  s
    .toLowerCase()
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 80);

const SLUG_RE = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

const formatDate = (iso: string | null) =>
  iso ? new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' }) : '-';

export default function AdminBlogPage() {
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [posts, setPosts] = useState<BlogPost[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [selectedPosts, setSelectedPosts] = useState<string[]>([]);
  const [statusFilter, setStatusFilter] = useState<'all' | BlogStatus>('all');
  const [tagFilter, setTagFilter] = useState('all');
  const [sortBy, setSortBy] = useState<'updated' | 'published' | 'title'>('updated');
  const [search, setSearch] = useState('');
  const [busy, setBusy] = useState(false);
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Editor
  const [editorOpen, setEditorOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [slugTouched, setSlugTouched] = useState(false);
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState('');

  // Delete confirm
  const [deleteIds, setDeleteIds] = useState<string[] | null>(null);

  useEffect(() => {
    fetchPosts();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once on mount
  }, []);

  const fetchPosts = async () => {
    setLoading(true);
    setLoadError('');
    const { data, error } = await supabase
      .from('blog_posts')
      .select('id, title, slug, excerpt, content, featured_image, status, published_at, seo_title, seo_description, tags, created_at, updated_at')
      .order('updated_at', { ascending: false });
    if (error) {
      setLoadError(error.message || 'Could not load blog posts.');
      setPosts([]);
    } else {
      setPosts((data || []) as BlogPost[]);
    }
    setLoading(false);
  };

  const allTags = useMemo(
    () => Array.from(new Set(posts.flatMap((p) => p.tags || []))).sort((a, b) => a.localeCompare(b)),
    [posts]
  );

  const filteredPosts = useMemo(() => {
    const q = search.trim().toLowerCase();
    return posts
      .filter((p) => statusFilter === 'all' || p.status === statusFilter)
      .filter((p) => tagFilter === 'all' || (p.tags || []).includes(tagFilter))
      .filter((p) => !q || p.title.toLowerCase().includes(q) || p.slug.includes(q) || (p.excerpt || '').toLowerCase().includes(q))
      .sort((a, b) => {
        if (sortBy === 'title') return a.title.localeCompare(b.title);
        if (sortBy === 'published') {
          return new Date(b.published_at || 0).getTime() - new Date(a.published_at || 0).getTime();
        }
        return new Date(b.updated_at || b.created_at).getTime() - new Date(a.updated_at || a.created_at).getTime();
      });
  }, [posts, statusFilter, tagFilter, sortBy, search]);

  const counts = useMemo(
    () => ({
      total: posts.length,
      published: posts.filter((p) => p.status === 'published').length,
      draft: posts.filter((p) => p.status === 'draft').length,
      archived: posts.filter((p) => p.status === 'archived').length,
    }),
    [posts]
  );

  const visibleSelected = selectedPosts.filter((id) => filteredPosts.some((p) => p.id === id));

  const handleSelectAll = () => {
    if (visibleSelected.length === filteredPosts.length) setSelectedPosts([]);
    else setSelectedPosts(filteredPosts.map((p) => p.id));
  };

  const handleSelectPost = (postId: string) => {
    setSelectedPosts((prev) => (prev.includes(postId) ? prev.filter((id) => id !== postId) : [...prev, postId]));
  };

  const flash = (type: 'success' | 'error', text: string) => {
    setNotice({ type, text });
    setTimeout(() => setNotice((n) => (n?.text === text ? null : n)), 4000);
  };

  // ---------- Status changes ----------
  const setStatus = async (ids: string[], status: BlogStatus) => {
    if (ids.length === 0) return;
    setBusy(true);
    const now = new Date().toISOString();
    // Publishing keeps an existing published_at, so re-publishing does not reorder the blog.
    const needsDate = status === 'published' ? ids.filter((id) => !posts.find((p) => p.id === id)?.published_at) : [];
    const keepDate = ids.filter((id) => !needsDate.includes(id));

    const results = await Promise.all([
      keepDate.length
        ? supabase.from('blog_posts').update({ status, updated_at: now }).in('id', keepDate)
        : Promise.resolve({ error: null }),
      needsDate.length
        ? supabase.from('blog_posts').update({ status, published_at: now, updated_at: now }).in('id', needsDate)
        : Promise.resolve({ error: null }),
    ]);
    setBusy(false);
    const failed = results.find((r) => r.error);
    if (failed?.error) {
      flash('error', `Could not update posts: ${failed.error.message}`);
      return;
    }
    setPosts((prev) =>
      prev.map((p) =>
        ids.includes(p.id)
          ? { ...p, status, updated_at: now, published_at: needsDate.includes(p.id) ? now : p.published_at }
          : p
      )
    );
    setSelectedPosts([]);
    flash('success', `${ids.length} post${ids.length > 1 ? 's' : ''} marked ${STATUS_LABELS[status].toLowerCase()}.`);
  };

  const confirmDelete = async () => {
    if (!deleteIds || deleteIds.length === 0) return;
    setBusy(true);
    const { error } = await supabase.from('blog_posts').delete().in('id', deleteIds);
    setBusy(false);
    if (error) {
      flash('error', `Could not delete: ${error.message}`);
      return;
    }
    setPosts((prev) => prev.filter((p) => !deleteIds.includes(p.id)));
    setSelectedPosts((prev) => prev.filter((id) => !deleteIds.includes(id)));
    flash('success', `${deleteIds.length} post${deleteIds.length > 1 ? 's' : ''} deleted.`);
    setDeleteIds(null);
  };

  // ---------- Editor ----------
  const openNew = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setSlugTouched(false);
    setFormError('');
    setEditorOpen(true);
  };

  const openEdit = (post: BlogPost) => {
    setEditingId(post.id);
    setForm({
      title: post.title,
      slug: post.slug,
      excerpt: post.excerpt || '',
      content: post.content || '',
      featured_image: post.featured_image || '',
      status: post.status,
      tags: (post.tags || []).join(', '),
      seo_title: post.seo_title || '',
      seo_description: post.seo_description || '',
    });
    setSlugTouched(true);
    setFormError('');
    setEditorOpen(true);
  };

  const savePost = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    const title = form.title.trim();
    const slug = (form.slug.trim() || slugify(title)).toLowerCase();
    const content = form.content.trim();
    const image = form.featured_image.trim();

    if (!title) return setFormError('Title is required.');
    if (!SLUG_RE.test(slug)) return setFormError('Slug may only use lowercase letters, numbers and single dashes.');
    if (!content) return setFormError('Content is required.');
    if (image && !/^(https?:\/\/|\/)/i.test(image)) return setFormError('Featured image must be a full https:// link or a /path on this site.');
    if (posts.some((p) => p.slug === slug && p.id !== editingId)) {
      return setFormError('Another post already uses this slug.');
    }

    const existing = editingId ? posts.find((p) => p.id === editingId) : null;
    const now = new Date().toISOString();
    const tags = Array.from(new Set(form.tags.split(',').map((t) => t.trim()).filter(Boolean)));
    const payload = {
      title,
      slug,
      excerpt: form.excerpt.trim() || null,
      content,
      featured_image: image || null,
      status: form.status,
      tags,
      seo_title: form.seo_title.trim() || null,
      seo_description: form.seo_description.trim() || null,
      published_at: form.status === 'published' ? existing?.published_at || now : existing?.published_at || null,
      updated_at: now,
    };

    setSaving(true);
    let result;
    if (editingId) {
      result = await supabase.from('blog_posts').update(payload).eq('id', editingId).select().maybeSingle();
    } else {
      const { data: { session } } = await supabase.auth.getSession();
      result = await supabase
        .from('blog_posts')
        .insert({ ...payload, author_id: session?.user?.id ?? null })
        .select()
        .maybeSingle();
    }
    setSaving(false);

    if (result.error) {
      const msg = result.error.message || 'Could not save the post.';
      setFormError(/duplicate|unique/i.test(msg) ? 'Another post already uses this slug.' : msg);
      return;
    }

    const saved = (result.data || { ...existing, ...payload, id: editingId }) as BlogPost;
    setPosts((prev) => (editingId ? prev.map((p) => (p.id === editingId ? saved : p)) : [saved, ...prev]));
    setEditorOpen(false);
    flash('success', editingId ? 'Post updated.' : 'Post created.');
  };

  const previewHref = (post: BlogPost) => `/blog/${post.slug}`;

  // ---------- Render ----------
  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Blog Posts</h1>
          <p className="text-gray-600 mt-1">Create and manage your blog content</p>
        </div>
        <button
          onClick={openNew}
          className="bg-blue-700 hover:bg-blue-800 text-white px-6 py-3 rounded-lg font-semibold transition-colors whitespace-nowrap"
        >
          <i className="ri-add-line mr-2"></i>
          New Post
        </button>
      </div>

      {notice && (
        <div
          role="status"
          className={`rounded-lg border p-4 text-sm ${notice.type === 'success' ? 'border-emerald-200 bg-emerald-50 text-emerald-800' : 'border-red-200 bg-red-50 text-red-700'}`}
        >
          {notice.text}
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {([
          ['Total Posts', counts.total, 'all'],
          ['Published', counts.published, 'published'],
          ['Drafts', counts.draft, 'draft'],
          ['Archived', counts.archived, 'archived'],
        ] as const).map(([label, value, status]) => (
          <button
            key={label}
            onClick={() => setStatusFilter(status)}
            className={`text-left bg-white rounded-xl border-2 p-4 transition-colors ${statusFilter === status ? 'border-blue-700 bg-blue-50' : 'border-gray-200 hover:border-gray-300'}`}
          >
            <p className="text-sm text-gray-600 mb-1">{label}</p>
            <p className="text-2xl font-bold text-gray-900">{value}</p>
          </button>
        ))}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            <div className="flex flex-col sm:flex-row sm:items-center gap-3 flex-wrap">
              <input
                type="search"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search posts..."
                aria-label="Search posts"
                className="px-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <select
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as 'all' | BlogStatus)}
                aria-label="Filter by status"
                className="px-4 py-2 pr-8 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-medium cursor-pointer"
              >
                <option value="all">All Status</option>
                <option value="published">Published</option>
                <option value="draft">Draft</option>
                <option value="archived">Archived</option>
              </select>
              <select
                value={tagFilter}
                onChange={(e) => setTagFilter(e.target.value)}
                aria-label="Filter by tag"
                className="px-4 py-2 pr-8 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-medium cursor-pointer"
              >
                <option value="all">All Tags</option>
                {allTags.map((t) => (
                  <option key={t} value={t}>{t}</option>
                ))}
              </select>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as 'updated' | 'published' | 'title')}
                aria-label="Sort posts"
                className="px-4 py-2 pr-8 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-medium cursor-pointer"
              >
                <option value="updated">Sort by Last Updated</option>
                <option value="published">Sort by Publish Date</option>
                <option value="title">Sort by Title</option>
              </select>
            </div>
            <div className="flex border-2 border-gray-300 rounded-lg overflow-hidden self-start">
              <button
                onClick={() => setViewMode('grid')}
                aria-label="Grid view"
                aria-pressed={viewMode === 'grid'}
                className={`w-10 h-10 flex items-center justify-center transition-colors ${viewMode === 'grid' ? 'bg-blue-700 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'}`}
              >
                <i className="ri-grid-line text-xl"></i>
              </button>
              <button
                onClick={() => setViewMode('list')}
                aria-label="List view"
                aria-pressed={viewMode === 'list'}
                className={`w-10 h-10 flex items-center justify-center border-l-2 border-gray-300 transition-colors ${viewMode === 'list' ? 'bg-blue-700 text-white' : 'bg-white text-gray-700 hover:bg-gray-50'}`}
              >
                <i className="ri-list-check text-xl"></i>
              </button>
            </div>
          </div>
        </div>

        {visibleSelected.length > 0 && (
          <div className="p-4 bg-blue-50 border-b border-blue-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <p className="text-blue-800 font-semibold">
              {visibleSelected.length} post{visibleSelected.length > 1 ? 's' : ''} selected
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => setStatus(visibleSelected, 'published')}
                disabled={busy}
                className="px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors whitespace-nowrap disabled:opacity-50"
              >
                Publish
              </button>
              <button
                onClick={() => setStatus(visibleSelected, 'draft')}
                disabled={busy}
                className="px-4 py-2 bg-gray-600 hover:bg-gray-700 text-white rounded-lg text-sm font-medium transition-colors whitespace-nowrap disabled:opacity-50"
              >
                Draft
              </button>
              <button
                onClick={() => setStatus(visibleSelected, 'archived')}
                disabled={busy}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-sm font-medium transition-colors whitespace-nowrap disabled:opacity-50"
              >
                Archive
              </button>
              <button
                onClick={() => setDeleteIds(visibleSelected)}
                disabled={busy}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium transition-colors whitespace-nowrap disabled:opacity-50"
              >
                Delete
              </button>
            </div>
          </div>
        )}

        {loading ? (
          <div className="p-12 text-center text-gray-500">Loading posts...</div>
        ) : loadError ? (
          <div className="p-12 text-center">
            <p className="text-red-600 mb-4">{loadError}</p>
            <button onClick={fetchPosts} className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50">
              Try again
            </button>
          </div>
        ) : filteredPosts.length === 0 ? (
          <div className="p-12 text-center text-gray-500">
            <i className="ri-article-line text-4xl text-gray-300"></i>
            <p className="mt-2">{posts.length === 0 ? 'No blog posts yet.' : 'No posts match these filters.'}</p>
            {posts.length === 0 && (
              <button onClick={openNew} className="mt-4 text-blue-700 font-medium hover:underline">Write your first post</button>
            )}
          </div>
        ) : viewMode === 'grid' ? (
          <div className="p-6 grid md:grid-cols-2 lg:grid-cols-3 gap-6">
            {filteredPosts.map((post) => (
              <div key={post.id} className="border-2 border-gray-200 rounded-xl overflow-hidden hover:shadow-lg transition-shadow flex flex-col">
                <div className="relative">
                  <input
                    type="checkbox"
                    checked={selectedPosts.includes(post.id)}
                    onChange={() => handleSelectPost(post.id)}
                    aria-label={`Select ${post.title}`}
                    className="absolute top-3 left-3 w-5 h-5 text-blue-700 border-gray-300 rounded focus:ring-blue-500 cursor-pointer z-10"
                  />
                  <div className="aspect-video bg-gray-100 overflow-hidden flex items-center justify-center">
                    {post.featured_image ? (
                      <img src={post.featured_image} alt={post.title} className="w-full h-full object-cover" />
                    ) : (
                      <i className="ri-image-line text-4xl text-gray-300"></i>
                    )}
                  </div>
                </div>
                <div className="p-4 flex flex-col flex-1">
                  <div className="flex items-center justify-between mb-3 gap-2">
                    <span className="text-xs font-semibold text-blue-700 truncate">{(post.tags || []).join(', ') || 'No tags'}</span>
                    <span className={`px-2 py-1 rounded-full text-xs font-semibold ${STATUS_COLORS[post.status]}`}>
                      {STATUS_LABELS[post.status]}
                    </span>
                  </div>
                  <h3 className="font-bold text-gray-900 mb-2 line-clamp-2">{post.title}</h3>
                  <p className="text-sm text-gray-600 mb-3 line-clamp-2">{post.excerpt || post.content.slice(0, 140)}</p>
                  <div className="flex items-center justify-between text-sm text-gray-600 mb-4 pb-4 border-b border-gray-200 mt-auto">
                    <span>{post.status === 'published' ? `Published ${formatDate(post.published_at)}` : `Updated ${formatDate(post.updated_at || post.created_at)}`}</span>
                  </div>
                  <div className="flex items-center space-x-2">
                    <button
                      onClick={() => openEdit(post)}
                      className="flex-1 bg-blue-700 hover:bg-blue-800 text-white py-2 rounded-lg text-sm font-medium text-center transition-colors whitespace-nowrap"
                    >
                      Edit Post
                    </button>
                    {post.status === 'published' && (
                      <Link
                        href={previewHref(post)}
                        target="_blank"
                        aria-label={`View ${post.title} on the store`}
                        className="w-9 h-9 flex items-center justify-center border-2 border-gray-300 text-gray-700 hover:border-blue-600 hover:text-blue-600 rounded-lg transition-colors"
                      >
                        <i className="ri-eye-line"></i>
                      </Link>
                    )}
                    <button
                      onClick={() => setDeleteIds([post.id])}
                      aria-label={`Delete ${post.title}`}
                      className="w-9 h-9 flex items-center justify-center border-2 border-gray-300 text-gray-700 hover:border-red-600 hover:text-red-600 rounded-lg transition-colors"
                    >
                      <i className="ri-delete-bin-line"></i>
                    </button>
                  </div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="py-4 px-6">
                    <input
                      type="checkbox"
                      checked={filteredPosts.length > 0 && visibleSelected.length === filteredPosts.length}
                      onChange={handleSelectAll}
                      aria-label="Select all posts"
                      className="w-4 h-4 text-blue-700 border-gray-300 rounded focus:ring-blue-500 cursor-pointer"
                    />
                  </th>
                  <th className="text-left py-4 px-4 text-sm font-semibold text-gray-700">Post</th>
                  <th className="text-left py-4 px-4 text-sm font-semibold text-gray-700">Tags</th>
                  <th className="text-left py-4 px-4 text-sm font-semibold text-gray-700">Published</th>
                  <th className="text-left py-4 px-4 text-sm font-semibold text-gray-700">Status</th>
                  <th className="text-left py-4 px-4 text-sm font-semibold text-gray-700">Actions</th>
                </tr>
              </thead>
              <tbody>
                {filteredPosts.map((post) => (
                  <tr key={post.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                    <td className="py-4 px-6">
                      <input
                        type="checkbox"
                        checked={selectedPosts.includes(post.id)}
                        onChange={() => handleSelectPost(post.id)}
                        aria-label={`Select ${post.title}`}
                        className="w-4 h-4 text-blue-700 border-gray-300 rounded focus:ring-blue-500 cursor-pointer"
                      />
                    </td>
                    <td className="py-4 px-4">
                      <div className="flex items-center space-x-3">
                        <div className="w-20 h-14 bg-gray-100 rounded-lg overflow-hidden flex items-center justify-center shrink-0">
                          {post.featured_image ? (
                            <img src={post.featured_image} alt={post.title} className="w-full h-full object-cover" />
                          ) : (
                            <i className="ri-image-line text-xl text-gray-300"></i>
                          )}
                        </div>
                        <div className="min-w-0">
                          <button onClick={() => openEdit(post)} className="font-semibold text-gray-900 hover:text-blue-700 text-left">
                            {post.title}
                          </button>
                          <p className="text-sm text-gray-500 mt-1 truncate">/blog/{post.slug}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-4 text-gray-700 text-sm">{(post.tags || []).join(', ') || '-'}</td>
                    <td className="py-4 px-4 text-gray-700 text-sm whitespace-nowrap">{formatDate(post.published_at)}</td>
                    <td className="py-4 px-4">
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap ${STATUS_COLORS[post.status]}`}>
                        {STATUS_LABELS[post.status]}
                      </span>
                    </td>
                    <td className="py-4 px-4">
                      <div className="flex items-center space-x-2">
                        <button
                          onClick={() => openEdit(post)}
                          aria-label={`Edit ${post.title}`}
                          className="w-8 h-8 flex items-center justify-center text-gray-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors"
                        >
                          <i className="ri-edit-line text-lg"></i>
                        </button>
                        {post.status === 'published' && (
                          <Link
                            href={previewHref(post)}
                            target="_blank"
                            aria-label={`View ${post.title} on the store`}
                            className="w-8 h-8 flex items-center justify-center text-gray-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors"
                          >
                            <i className="ri-eye-line text-lg"></i>
                          </Link>
                        )}
                        <button
                          onClick={() => setDeleteIds([post.id])}
                          aria-label={`Delete ${post.title}`}
                          className="w-8 h-8 flex items-center justify-center text-gray-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors"
                        >
                          <i className="ri-delete-bin-line text-lg"></i>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {!loading && !loadError && filteredPosts.length > 0 && (
          <div className="p-6 border-t border-gray-200">
            <p className="text-gray-600">Showing {filteredPosts.length} of {posts.length} posts</p>
          </div>
        )}
      </div>

      {/* Editor */}
      {editorOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60" onClick={() => !saving && setEditorOpen(false)}>
          <form
            onSubmit={savePost}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label={editingId ? 'Edit post' : 'New post'}
            className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl max-h-[90vh] flex flex-col overflow-hidden"
          >
            <div className="p-5 border-b border-gray-200 flex items-center justify-between">
              <h2 className="text-xl font-bold text-gray-900">{editingId ? 'Edit Post' : 'New Post'}</h2>
              <button
                type="button"
                onClick={() => setEditorOpen(false)}
                disabled={saving}
                aria-label="Close"
                className="w-9 h-9 flex items-center justify-center rounded-full hover:bg-gray-100 text-gray-500"
              >
                <i className="ri-close-line text-xl"></i>
              </button>
            </div>

            <div className="p-5 overflow-y-auto space-y-4">
              <label className="block">
                <span className="text-sm font-semibold text-gray-700">Title</span>
                <input
                  required
                  value={form.title}
                  onChange={(e) => {
                    const title = e.target.value;
                    setForm((f) => ({ ...f, title, slug: slugTouched ? f.slug : slugify(title) }));
                  }}
                  className="mt-1 w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </label>
              <label className="block">
                <span className="text-sm font-semibold text-gray-700">Slug</span>
                <div className="mt-1 flex items-center">
                  <span className="px-3 py-2 bg-gray-50 border-2 border-r-0 border-gray-300 rounded-l-lg text-sm text-gray-500">/blog/</span>
                  <input
                    value={form.slug}
                    onChange={(e) => {
                      setSlugTouched(true);
                      setForm((f) => ({ ...f, slug: e.target.value.toLowerCase() }));
                    }}
                    className="flex-1 min-w-0 px-3 py-2 border-2 border-gray-300 rounded-r-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </div>
              </label>
              <div className="grid sm:grid-cols-2 gap-4">
                <label className="block">
                  <span className="text-sm font-semibold text-gray-700">Status</span>
                  <select
                    value={form.status}
                    onChange={(e) => setForm((f) => ({ ...f, status: e.target.value as BlogStatus }))}
                    className="mt-1 w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="draft">Draft</option>
                    <option value="published">Published</option>
                    <option value="archived">Archived</option>
                  </select>
                </label>
                <label className="block">
                  <span className="text-sm font-semibold text-gray-700">Tags (comma separated)</span>
                  <input
                    value={form.tags}
                    onChange={(e) => setForm((f) => ({ ...f, tags: e.target.value }))}
                    placeholder="perfume, gift ideas"
                    className="mt-1 w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                </label>
              </div>
              <label className="block">
                <span className="text-sm font-semibold text-gray-700">Featured image URL</span>
                <input
                  value={form.featured_image}
                  onChange={(e) => setForm((f) => ({ ...f, featured_image: e.target.value }))}
                  placeholder="https://..."
                  className="mt-1 w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </label>
              <label className="block">
                <span className="text-sm font-semibold text-gray-700">Excerpt</span>
                <textarea
                  rows={2}
                  maxLength={300}
                  value={form.excerpt}
                  onChange={(e) => setForm((f) => ({ ...f, excerpt: e.target.value }))}
                  className="mt-1 w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </label>
              <label className="block">
                <span className="text-sm font-semibold text-gray-700">Content</span>
                <textarea
                  required
                  rows={12}
                  value={form.content}
                  onChange={(e) => setForm((f) => ({ ...f, content: e.target.value }))}
                  className="mt-1 w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
                <span className="text-xs text-gray-500">Plain text. Leave a blank line between paragraphs.</span>
              </label>
              <details className="rounded-lg border border-gray-200 p-3">
                <summary className="cursor-pointer text-sm font-semibold text-gray-700">Search engine (SEO)</summary>
                <div className="mt-3 space-y-3">
                  <label className="block">
                    <span className="text-sm text-gray-700">SEO title</span>
                    <input
                      maxLength={70}
                      value={form.seo_title}
                      onChange={(e) => setForm((f) => ({ ...f, seo_title: e.target.value }))}
                      className="mt-1 w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </label>
                  <label className="block">
                    <span className="text-sm text-gray-700">SEO description</span>
                    <textarea
                      rows={2}
                      maxLength={160}
                      value={form.seo_description}
                      onChange={(e) => setForm((f) => ({ ...f, seo_description: e.target.value }))}
                      className="mt-1 w-full px-3 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    />
                  </label>
                </div>
              </details>
              {formError && <p className="text-sm text-red-600">{formError}</p>}
            </div>

            <div className="p-5 border-t border-gray-200 flex justify-end gap-3">
              <button
                type="button"
                onClick={() => setEditorOpen(false)}
                disabled={saving}
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-5 py-2 bg-blue-700 hover:bg-blue-800 text-white rounded-lg font-semibold disabled:opacity-50"
              >
                {saving ? 'Saving...' : editingId ? 'Save Changes' : 'Create Post'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Delete confirm */}
      {deleteIds && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60" onClick={() => !busy && setDeleteIds(null)}>
          <div
            role="alertdialog"
            aria-modal="true"
            aria-label="Confirm delete"
            onClick={(e) => e.stopPropagation()}
            className="bg-white rounded-2xl shadow-2xl w-full max-w-md p-6"
          >
            <h2 className="text-lg font-bold text-gray-900">
              Delete {deleteIds.length === 1 ? 'this post' : `${deleteIds.length} posts`}?
            </h2>
            <p className="text-sm text-gray-600 mt-2">
              This cannot be undone. To hide a post but keep it, use Archive instead.
            </p>
            <div className="mt-6 flex justify-end gap-3">
              <button
                onClick={() => setDeleteIds(null)}
                disabled={busy}
                className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50 disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                disabled={busy}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg font-semibold disabled:opacity-50"
              >
                {busy ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
