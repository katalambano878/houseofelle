'use client';

import { useState, useEffect, useMemo } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';

type ReviewStatus = 'pending' | 'approved' | 'rejected';
type SortKey = 'date' | 'rating_high' | 'rating_low' | 'helpful';

export default function AdminReviewsPage() {
  const [statusFilter, setStatusFilter] = useState<'all' | ReviewStatus>('all');
  const [sortBy, setSortBy] = useState<SortKey>('date');
  const [selectedReviews, setSelectedReviews] = useState<string[]>([]);
  const [reviews, setReviews] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [busy, setBusy] = useState(false);
  const [expanded, setExpanded] = useState<string | null>(null);
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    fetchReviews();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once on mount
  }, []);

  const fetchReviews = async () => {
    setLoading(true);
    setLoadError('');
    try {
      const { data, error } = await supabase
        .from('reviews')
        .select(`
          *,
          products:product_id (id, name, slug, product_images (url, position)),
          review_images (url)
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      // Reviewer names come from profiles (no FK edge from reviews, so a second query)
      const rows = data || [];
      const userIds = Array.from(new Set(rows.map((r: any) => r.user_id).filter(Boolean)));
      const profilesById = new Map<string, any>();
      if (userIds.length > 0) {
        const { data: profiles, error: profilesError } = await supabase
          .from('profiles')
          .select('id, full_name, email')
          .in('id', userIds);
        if (profilesError) console.warn('Error fetching reviewer profiles:', profilesError);
        (profiles || []).forEach((p: any) => profilesById.set(p.id, p));
      }
      const formatted = rows.map((r: any) => {
        const profile = profilesById.get(r.user_id);
        const images = Array.isArray(r.products?.product_images) ? [...r.products.product_images] : [];
        images.sort((a: any, b: any) => (a.position ?? 0) - (b.position ?? 0));
        return {
          id: r.id,
          customer: {
            name: profile?.full_name || (r.user_id ? 'Customer' : 'Guest reviewer'),
            email: profile?.email || '',
            avatar: getInitials(profile?.full_name || profile?.email || ''),
          },
          product: {
            id: r.products?.id || r.product_id,
            name: r.products?.name || 'Deleted product',
            slug: r.products?.slug || null,
            image: images[0]?.url || '/house-of-elle-logo.png',
          },
          rating: Number(r.rating) || 0,
          title: r.title,
          comment: r.content || '',
          photos: (Array.isArray(r.review_images) ? r.review_images : []).map((i: any) => i.url).filter(Boolean),
          verified: !!r.verified_purchase,
          createdAt: r.created_at,
          date: new Date(r.created_at).toLocaleDateString(),
          status: String(r.status || 'pending').toLowerCase() as ReviewStatus,
          helpful: r.helpful_votes || 0,
        };
      });
      setReviews(formatted);
    } catch (error: any) {
      console.error('Error fetching reviews:', error);
      setLoadError(error?.message || 'Could not load reviews.');
    } finally {
      setLoading(false);
    }
  };

  const getInitials = (name: string) => {
    if (!name) return '?';
    return name
      .replace(/[^a-zA-Z ]/g, '')
      .split(' ')
      .map(n => n?.[0])
      .slice(0, 2)
      .join('')
      .toUpperCase() || '?';
  };

  const filteredReviews = useMemo(() => {
    const list = reviews.filter(r => statusFilter === 'all' || r.status === statusFilter);
    return [...list].sort((a, b) => {
      if (sortBy === 'rating_high') return b.rating - a.rating;
      if (sortBy === 'rating_low') return a.rating - b.rating;
      if (sortBy === 'helpful') return b.helpful - a.helpful;
      return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    });
  }, [reviews, statusFilter, sortBy]);

  const stats = {
    total: reviews.length,
    pending: reviews.filter(r => r.status === 'pending').length,
    approved: reviews.filter(r => r.status === 'approved').length,
    rejected: reviews.filter(r => r.status === 'rejected').length
  };

  const statusColors: Record<string, string> = {
    'pending': 'bg-amber-100 text-amber-700',
    'approved': 'bg-green-100 text-green-700',
    'rejected': 'bg-red-100 text-red-700'
  };

  const visibleIds = filteredReviews.map(r => r.id);
  const allVisibleSelected = visibleIds.length > 0 && visibleIds.every(id => selectedReviews.includes(id));

  const handleSelectAll = () => {
    setSelectedReviews(allVisibleSelected ? [] : visibleIds);
  };

  const handleSelectReview = (reviewId: string) => {
    if (selectedReviews.includes(reviewId)) {
      setSelectedReviews(selectedReviews.filter(id => id !== reviewId));
    } else {
      setSelectedReviews([...selectedReviews, reviewId]);
    }
  };

  /** Approves or rejects reviews. Only approved reviews show in the shop and count toward ratings. */
  const setStatus = async (ids: string[], newStatus: ReviewStatus) => {
    if (ids.length === 0) return;
    setBusy(true);
    const { error } = await supabase.from('reviews').update({ status: newStatus }).in('id', ids);
    setBusy(false);
    if (error) {
      setNotice({ type: 'error', text: `Could not update ${ids.length > 1 ? 'the reviews' : 'the review'}: ${error.message}` });
      return;
    }
    setReviews(prev => prev.map(r => (ids.includes(r.id) ? { ...r, status: newStatus } : r)));
    setSelectedReviews(prev => prev.filter(id => !ids.includes(id)));
    setNotice({ type: 'success', text: `${ids.length} review${ids.length > 1 ? 's' : ''} ${newStatus}.` });
  };

  const deleteReviews = async (ids: string[]) => {
    if (ids.length === 0) return;
    if (!confirm(`Delete ${ids.length > 1 ? `${ids.length} reviews` : 'this review'} for good? This cannot be undone.`)) return;
    setBusy(true);
    const { error: imagesError } = await supabase.from('review_images').delete().in('review_id', ids);
    const { error } = imagesError ? { error: imagesError } : await supabase.from('reviews').delete().in('id', ids);
    setBusy(false);
    if (error) {
      setNotice({ type: 'error', text: `Could not delete: ${error.message}` });
      return;
    }
    setReviews(prev => prev.filter(r => !ids.includes(r.id)));
    setSelectedReviews(prev => prev.filter(id => !ids.includes(id)));
    setNotice({ type: 'success', text: `${ids.length} review${ids.length > 1 ? 's' : ''} deleted.` });
  };

  const renderStars = (rating: number) => {
    return (
      <div className="flex items-center space-x-1" role="img" aria-label={`${rating} out of 5 stars`}>
        {[1, 2, 3, 4, 5].map((star) => (
          <i
            key={star}
            aria-hidden="true"
            className={`${star <= rating ? 'ri-star-fill text-amber-500' : 'ri-star-line text-gray-300'} text-lg`}
          ></i>
        ))}
      </div>
    );
  };

  const statCard = (key: 'all' | ReviewStatus, label: string, count: number, activeClass: string, countClass: string) => (
    <button
      type="button"
      onClick={() => { setStatusFilter(key); setSelectedReviews([]); }}
      aria-pressed={statusFilter === key}
      className={`p-4 rounded-xl border-2 transition-all text-left ${statusFilter === key ? activeClass : 'border-gray-200 bg-white hover:border-gray-300'}`}
    >
      <p className={`text-2xl font-bold ${countClass}`}>{count}</p>
      <p className="text-sm text-gray-600 mt-1">{label}</p>
    </button>
  );

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-3xl font-bold text-gray-900">Reviews</h1>
        <p className="text-gray-600 mt-1">Approve reviews before they appear on product pages</p>
      </div>

      {notice && (
        <div
          role="status"
          className={`p-4 rounded-lg border text-sm flex items-center justify-between ${notice.type === 'success' ? 'bg-green-50 border-green-200 text-green-800' : 'bg-red-50 border-red-200 text-red-800'}`}
        >
          <span>{notice.text}</span>
          <button onClick={() => setNotice(null)} aria-label="Dismiss" className="ml-4">
            <i className="ri-close-line"></i>
          </button>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {statCard('all', 'Total Reviews', stats.total, 'border-blue-700 bg-blue-50', 'text-gray-900')}
        {statCard('pending', 'Waiting for approval', stats.pending, 'border-amber-600 bg-amber-50', 'text-amber-700')}
        {statCard('approved', 'Approved', stats.approved, 'border-green-600 bg-green-50', 'text-green-700')}
        {statCard('rejected', 'Rejected', stats.rejected, 'border-red-600 bg-red-50', 'text-red-700')}
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="p-4 sm:p-6 border-b border-gray-200">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <h2 className="text-lg font-bold text-gray-900 capitalize">
              {statusFilter === 'all' ? 'All Reviews' : `${statusFilter} Reviews`}
            </h2>
            <select
              aria-label="Sort reviews"
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortKey)}
              className="px-4 py-2 pr-8 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-medium cursor-pointer"
            >
              <option value="date">Newest first</option>
              <option value="rating_high">Highest rating</option>
              <option value="rating_low">Lowest rating</option>
              <option value="helpful">Most helpful</option>
            </select>
          </div>
        </div>

        {selectedReviews.length > 0 && (
          <div className="p-4 bg-blue-50 border-b border-blue-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <p className="text-blue-800 font-semibold">
              {selectedReviews.length} review{selectedReviews.length > 1 ? 's' : ''} selected
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={() => setStatus(selectedReviews, 'approved')}
                disabled={busy}
                className="px-4 py-2 bg-green-700 hover:bg-green-800 text-white rounded-lg text-sm font-medium transition-colors whitespace-nowrap cursor-pointer disabled:opacity-50"
              >
                <i className="ri-check-line mr-2"></i>
                Approve
              </button>
              <button
                onClick={() => setStatus(selectedReviews, 'rejected')}
                disabled={busy}
                className="px-4 py-2 bg-red-600 hover:bg-red-700 text-white rounded-lg text-sm font-medium transition-colors whitespace-nowrap cursor-pointer disabled:opacity-50"
              >
                <i className="ri-close-line mr-2"></i>
                Reject
              </button>
              <button
                onClick={() => deleteReviews(selectedReviews)}
                disabled={busy}
                className="px-4 py-2 border border-red-300 text-red-700 hover:bg-red-50 rounded-lg text-sm font-medium transition-colors whitespace-nowrap cursor-pointer disabled:opacity-50"
              >
                <i className="ri-delete-bin-line mr-2"></i>
                Delete
              </button>
            </div>
          </div>
        )}

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="py-4 px-6">
                  <input
                    type="checkbox"
                    aria-label="Select all reviews shown"
                    checked={allVisibleSelected}
                    onChange={handleSelectAll}
                    className="w-4 h-4 text-blue-700 border-gray-300 rounded focus:ring-blue-500 cursor-pointer"
                  />
                </th>
                <th className="text-left py-4 px-4 text-sm font-semibold text-gray-700 w-1/5">Product</th>
                <th className="text-left py-4 px-4 text-sm font-semibold text-gray-700 w-1/5">Customer</th>
                <th className="text-left py-4 px-4 text-sm font-semibold text-gray-700 w-1/3">Review</th>
                <th className="text-left py-4 px-4 text-sm font-semibold text-gray-700">Date</th>
                <th className="text-left py-4 px-4 text-sm font-semibold text-gray-700">Status</th>
                <th className="text-left py-4 px-4 text-sm font-semibold text-gray-700">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={7} className="p-8 text-center text-gray-500">Loading reviews...</td></tr>
              ) : loadError ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-red-600">
                    <p className="mb-3">{loadError}</p>
                    <button onClick={fetchReviews} className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50">Try again</button>
                  </td>
                </tr>
              ) : filteredReviews.length === 0 ? (
                <tr>
                  <td colSpan={7} className="p-8 text-center text-gray-500">
                    {reviews.length === 0 ? 'No reviews yet. Customer reviews will appear here for approval.' : 'No reviews with this status.'}
                  </td>
                </tr>
              ) : (
                filteredReviews.map((review) => (
                  <tr key={review.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors align-top">
                    <td className="py-4 px-6">
                      <input
                        type="checkbox"
                        aria-label={`Select review of ${review.product.name}`}
                        checked={selectedReviews.includes(review.id)}
                        onChange={() => handleSelectReview(review.id)}
                        className="w-4 h-4 text-blue-700 border-gray-300 rounded focus:ring-blue-500 cursor-pointer"
                      />
                    </td>
                    <td className="py-4 px-4">
                      <div className="flex items-center space-x-3 min-w-[10rem]">
                        <img
                          src={review.product.image}
                          alt=""
                          className="w-12 h-12 shrink-0 rounded-lg object-cover border border-gray-100"
                        />
                        {review.product.id ? (
                          <Link href={`/admin/products/${review.product.id}`} className="text-sm font-medium text-gray-900 hover:text-blue-700 line-clamp-2">
                            {review.product.name}
                          </Link>
                        ) : (
                          <span className="text-sm font-medium text-gray-900 line-clamp-2">{review.product.name}</span>
                        )}
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      <div className="flex items-center space-x-3 min-w-[9rem]">
                        <div className="w-8 h-8 shrink-0 flex items-center justify-center bg-blue-100 text-blue-700 rounded-full text-xs font-semibold">
                          {review.customer.avatar}
                        </div>
                        <div className="min-w-0">
                          <p className="text-sm font-medium text-gray-900">{review.customer.name}</p>
                          {review.customer.email && <p className="text-xs text-gray-500 break-all">{review.customer.email}</p>}
                          {review.verified && (
                            <p className="text-xs text-green-700 font-medium mt-0.5"><i className="ri-shield-check-line mr-1"></i>Verified purchase</p>
                          )}
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      <div className="space-y-1 min-w-[14rem]">
                        {renderStars(review.rating)}
                        {review.title && <p className="text-sm font-bold text-gray-900">{review.title}</p>}
                        <p className={`text-sm text-gray-600 whitespace-pre-line ${expanded === review.id ? '' : 'line-clamp-2'}`}>{review.comment}</p>
                        {review.comment.length > 120 && (
                          <button
                            type="button"
                            onClick={() => setExpanded(expanded === review.id ? null : review.id)}
                            aria-expanded={expanded === review.id}
                            className="text-xs font-semibold text-blue-700 hover:text-blue-800"
                          >
                            {expanded === review.id ? 'Show less' : 'Read full review'}
                          </button>
                        )}
                        {review.photos.length > 0 && (
                          <div className="flex flex-wrap gap-2 pt-1">
                            {review.photos.map((url: string, i: number) => (
                              <a key={url} href={url} target="_blank" rel="noreferrer" aria-label={`Open review photo ${i + 1}`}>
                                <img src={url} alt="" className="w-12 h-12 rounded object-cover border border-gray-200" />
                              </a>
                            ))}
                          </div>
                        )}
                      </div>
                    </td>
                    <td className="py-4 px-4 text-sm text-gray-600 whitespace-nowrap">{review.date}</td>
                    <td className="py-4 px-4">
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap capitalize ${statusColors[review.status] || 'bg-gray-100 text-gray-700'}`}>
                        {review.status}
                      </span>
                    </td>
                    <td className="py-4 px-4">
                      <div className="flex items-center gap-1">
                        {review.status !== 'approved' && (
                          <button
                            onClick={() => setStatus([review.id], 'approved')}
                            disabled={busy}
                            title="Approve"
                            aria-label={`Approve review of ${review.product.name}`}
                            className="w-8 h-8 flex items-center justify-center text-green-700 hover:bg-green-50 rounded-lg disabled:opacity-50"
                          >
                            <i className="ri-check-line text-lg"></i>
                          </button>
                        )}
                        {review.status !== 'rejected' && (
                          <button
                            onClick={() => setStatus([review.id], 'rejected')}
                            disabled={busy}
                            title="Reject"
                            aria-label={`Reject review of ${review.product.name}`}
                            className="w-8 h-8 flex items-center justify-center text-red-600 hover:bg-red-50 rounded-lg disabled:opacity-50"
                          >
                            <i className="ri-close-line text-lg"></i>
                          </button>
                        )}
                        <button
                          onClick={() => deleteReviews([review.id])}
                          disabled={busy}
                          title="Delete"
                          aria-label={`Delete review of ${review.product.name}`}
                          className="w-8 h-8 flex items-center justify-center text-gray-500 hover:text-red-700 hover:bg-red-50 rounded-lg disabled:opacity-50"
                        >
                          <i className="ri-delete-bin-line text-lg"></i>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="p-6 border-t border-gray-200">
          <p className="text-gray-600 text-sm">Showing {filteredReviews.length} of {reviews.length} reviews</p>
        </div>
      </div>
    </div>
  );
}
