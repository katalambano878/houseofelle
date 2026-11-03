'use client';
import { money } from '@/lib/format-money';

import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase';

type CouponType = 'percentage' | 'fixed_amount' | 'free_shipping';

interface Coupon {
  id: string;
  code: string;
  description: string | null;
  type: CouponType;
  value: number;
  minimum_purchase: number | null;
  maximum_discount: number | null;
  usage_limit: number | null;
  usage_count: number | null;
  per_user_limit: number | null;
  start_date: string | null;
  end_date: string | null;
  is_active: boolean | null;
  created_at: string | null;
}

type CouponStatus = 'Active' | 'Scheduled' | 'Expired' | 'Used up' | 'Disabled';

interface FormState {
  code: string;
  description: string;
  type: CouponType;
  value: string;
  minimum_purchase: string;
  maximum_discount: string;
  usage_limit: string;
  start_date: string;
  end_date: string;
  is_active: boolean;
}

const EMPTY_FORM: FormState = {
  code: '',
  description: '',
  type: 'percentage',
  value: '',
  minimum_purchase: '',
  maximum_discount: '',
  usage_limit: '',
  start_date: '',
  end_date: '',
  is_active: true,
};

const CODE_RE = /^[A-Z0-9_-]{2,40}$/;

const TYPE_LABELS: Record<CouponType, string> = {
  percentage: 'Percentage',
  fixed_amount: 'Fixed amount',
  free_shipping: 'Free delivery',
};

function couponStatus(c: Coupon): CouponStatus {
  if (!c.is_active) return 'Disabled';
  const now = Date.now();
  if (c.end_date && new Date(c.end_date).getTime() < now) return 'Expired';
  if (c.usage_limit != null && Number(c.usage_count || 0) >= Number(c.usage_limit)) return 'Used up';
  if (c.start_date && new Date(c.start_date).getTime() > now) return 'Scheduled';
  return 'Active';
}

/** ISO timestamp -> value for <input type="date"> in local time. */
function toDateInput(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  const pad = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function formatDate(iso: string | null): string {
  if (!iso) return '';
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? '' : d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

const statusColors: Record<CouponStatus, string> = {
  Active: 'bg-green-100 text-green-700',
  Scheduled: 'bg-blue-100 text-blue-700',
  Expired: 'bg-gray-100 text-gray-700',
  'Used up': 'bg-amber-100 text-amber-700',
  Disabled: 'bg-red-100 text-red-700',
};

export default function AdminCouponsPage() {
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | CouponStatus>('all');
  const [sortBy, setSortBy] = useState<'date' | 'usage' | 'value' | 'code'>('date');

  const [showForm, setShowForm] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [formError, setFormError] = useState('');
  const [saving, setSaving] = useState(false);

  const [deleteTarget, setDeleteTarget] = useState<Coupon | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [toast, setToast] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  const [busyId, setBusyId] = useState<string | null>(null);

  useEffect(() => {
    fetchCoupons();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once on mount
  }, []);

  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3500);
    return () => clearTimeout(t);
  }, [toast]);

  const fetchCoupons = async () => {
    setLoading(true);
    setLoadError('');
    const { data, error } = await supabase
      .from('coupons')
      .select('id, code, description, type, value, minimum_purchase, maximum_discount, usage_limit, usage_count, per_user_limit, start_date, end_date, is_active, created_at')
      .order('created_at', { ascending: false });
    if (error) {
      setLoadError(error.message || 'Could not load coupons.');
      setCoupons([]);
    } else {
      setCoupons((data || []) as Coupon[]);
    }
    setLoading(false);
  };

  const visibleCoupons = useMemo(() => {
    const q = search.trim().toLowerCase();
    const list = coupons.filter((c) => {
      if (statusFilter !== 'all' && couponStatus(c) !== statusFilter) return false;
      if (!q) return true;
      return c.code.toLowerCase().includes(q) || (c.description || '').toLowerCase().includes(q);
    });
    const sorted = [...list];
    sorted.sort((a, b) => {
      switch (sortBy) {
        case 'usage':
          return Number(b.usage_count || 0) - Number(a.usage_count || 0);
        case 'value':
          return Number(b.value || 0) - Number(a.value || 0);
        case 'code':
          return a.code.localeCompare(b.code);
        default:
          return new Date(b.created_at || 0).getTime() - new Date(a.created_at || 0).getTime();
      }
    });
    return sorted;
  }, [coupons, search, statusFilter, sortBy]);

  const activeCount = coupons.filter((c) => couponStatus(c) === 'Active').length;
  const scheduledCount = coupons.filter((c) => couponStatus(c) === 'Scheduled').length;
  const totalUses = coupons.reduce((sum, c) => sum + Number(c.usage_count || 0), 0);

  const openCreate = () => {
    setEditingId(null);
    setForm(EMPTY_FORM);
    setFormError('');
    setShowForm(true);
  };

  const openEdit = (c: Coupon) => {
    setEditingId(c.id);
    setForm({
      code: c.code,
      description: c.description || '',
      type: c.type,
      value: c.type === 'free_shipping' ? '' : String(c.value ?? ''),
      minimum_purchase: c.minimum_purchase ? String(c.minimum_purchase) : '',
      maximum_discount: c.maximum_discount != null ? String(c.maximum_discount) : '',
      usage_limit: c.usage_limit != null ? String(c.usage_limit) : '',
      start_date: toDateInput(c.start_date),
      end_date: toDateInput(c.end_date),
      is_active: c.is_active !== false,
    });
    setFormError('');
    setShowForm(true);
  };

  const closeForm = () => {
    if (saving) return;
    setShowForm(false);
    setEditingId(null);
  };

  const handleSave = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormError('');

    const code = form.code.trim().toUpperCase();
    if (!CODE_RE.test(code)) {
      setFormError('Code must be 2–40 characters: letters A–Z, numbers, - or _.');
      return;
    }

    let value = 0;
    if (form.type !== 'free_shipping') {
      value = Number(form.value);
      if (!form.value.trim() || !Number.isFinite(value) || value <= 0) {
        setFormError('Enter a discount value greater than 0.');
        return;
      }
      if (form.type === 'percentage' && value > 100) {
        setFormError('A percentage discount cannot be more than 100%.');
        return;
      }
    }

    const minPurchase = form.minimum_purchase.trim() ? Number(form.minimum_purchase) : 0;
    if (!Number.isFinite(minPurchase) || minPurchase < 0) {
      setFormError('Minimum purchase must be 0 or more.');
      return;
    }

    let maxDiscount: number | null = null;
    if (form.type === 'percentage' && form.maximum_discount.trim()) {
      maxDiscount = Number(form.maximum_discount);
      if (!Number.isFinite(maxDiscount) || maxDiscount <= 0) {
        setFormError('Maximum discount must be greater than 0, or left empty.');
        return;
      }
    }

    let usageLimit: number | null = null;
    if (form.usage_limit.trim()) {
      usageLimit = Number(form.usage_limit);
      if (!Number.isInteger(usageLimit) || usageLimit < 1) {
        setFormError('Usage limit must be a whole number of at least 1, or left empty.');
        return;
      }
    }

    // Start of the start day, end of the end day, both in the shop's local time.
    const startDate = form.start_date ? new Date(`${form.start_date}T00:00:00`).toISOString() : null;
    const endDate = form.end_date ? new Date(`${form.end_date}T23:59:59`).toISOString() : null;
    if (startDate && endDate && new Date(endDate) < new Date(startDate)) {
      setFormError('End date must be on or after the start date.');
      return;
    }

    const duplicate = coupons.find((c) => c.code.toUpperCase() === code && c.id !== editingId);
    if (duplicate) {
      setFormError(`A coupon with the code ${code} already exists.`);
      return;
    }

    const payload = {
      code,
      description: form.description.trim() || null,
      type: form.type,
      value,
      minimum_purchase: minPurchase,
      maximum_discount: maxDiscount,
      usage_limit: usageLimit,
      start_date: startDate,
      end_date: endDate,
      is_active: form.is_active,
      updated_at: new Date().toISOString(),
    };

    setSaving(true);
    const { error } = editingId
      ? await supabase.from('coupons').update(payload).eq('id', editingId)
      : await supabase.from('coupons').insert(payload);
    setSaving(false);

    if (error) {
      const msg = /duplicate|unique/i.test(error.message || '')
        ? `A coupon with the code ${code} already exists.`
        : error.message || 'Could not save the coupon.';
      setFormError(msg);
      return;
    }

    setShowForm(false);
    setEditingId(null);
    setToast({ type: 'success', text: editingId ? `Coupon ${code} updated.` : `Coupon ${code} created.` });
    fetchCoupons();
  };

  const toggleActive = async (c: Coupon) => {
    setBusyId(c.id);
    const next = !c.is_active;
    const { error } = await supabase
      .from('coupons')
      .update({ is_active: next, updated_at: new Date().toISOString() })
      .eq('id', c.id);
    setBusyId(null);
    if (error) {
      setToast({ type: 'error', text: error.message || 'Could not update the coupon.' });
      return;
    }
    setCoupons((prev) => prev.map((x) => (x.id === c.id ? { ...x, is_active: next } : x)));
    setToast({ type: 'success', text: `${c.code} ${next ? 'turned on' : 'turned off'}.` });
  };

  const confirmDelete = async () => {
    if (!deleteTarget) return;
    setDeleting(true);
    const { error } = await supabase.from('coupons').delete().eq('id', deleteTarget.id);
    setDeleting(false);
    if (error) {
      setToast({ type: 'error', text: error.message || 'Could not delete the coupon.' });
      return;
    }
    setCoupons((prev) => prev.filter((x) => x.id !== deleteTarget.id));
    setToast({ type: 'success', text: `Coupon ${deleteTarget.code} deleted.` });
    setDeleteTarget(null);
  };

  const copyCode = async (code: string) => {
    try {
      await navigator.clipboard.writeText(code);
      setToast({ type: 'success', text: `${code} copied.` });
    } catch {
      setToast({ type: 'error', text: 'Could not copy. Select the code and copy it by hand.' });
    }
  };

  const valueLabel = (c: Coupon) => {
    if (c.type === 'percentage') {
      return `${Number(c.value)}%${c.maximum_discount != null ? ` (max GH₵ ${money(c.maximum_discount)})` : ''}`;
    }
    if (c.type === 'fixed_amount') return `GH₵ ${money(c.value)}`;
    return 'Free delivery';
  };

  const inputClass =
    'w-full px-4 py-2.5 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm';

  return (
    <div className="space-y-6">
      {toast && (
        <div
          role="status"
          className={`fixed top-4 right-4 z-[60] px-4 py-3 rounded-lg shadow-lg text-sm font-medium ${
            toast.type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'
          }`}
        >
          {toast.text}
        </div>
      )}

      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Coupons & Promotions</h1>
          <p className="text-gray-600 mt-1">Create and manage discount codes</p>
        </div>
        <button
          onClick={openCreate}
          className="bg-blue-700 hover:bg-blue-800 text-white px-6 py-3 rounded-lg font-semibold transition-colors whitespace-nowrap cursor-pointer"
        >
          <i className="ri-add-line mr-2"></i>
          Create Coupon
        </button>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
          <p className="text-sm text-gray-600 mb-1">Total Coupons</p>
          <p className="text-2xl font-bold text-gray-900">{coupons.length}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
          <p className="text-sm text-gray-600 mb-1">Active now</p>
          <p className="text-2xl font-bold text-green-700">{activeCount}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
          <p className="text-sm text-gray-600 mb-1">Scheduled</p>
          <p className="text-2xl font-bold text-blue-700">{scheduledCount}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
          <p className="text-sm text-gray-600 mb-1">Total Uses</p>
          <p className="text-2xl font-bold text-gray-900">{totalUses}</p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-3">
            <h2 className="text-lg font-bold text-gray-900">All Coupons</h2>
            <div className="flex flex-col sm:flex-row sm:items-center gap-3">
              <div className="relative">
                <i className="ri-search-line absolute left-3 top-1/2 -translate-y-1/2 text-gray-400"></i>
                <input
                  type="search"
                  aria-label="Search coupons"
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search code or description"
                  className="pl-9 pr-4 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm w-full sm:w-64"
                />
              </div>
              <select
                aria-label="Filter by status"
                value={statusFilter}
                onChange={(e) => setStatusFilter(e.target.value as 'all' | CouponStatus)}
                className="px-4 py-2 pr-8 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-medium cursor-pointer"
              >
                <option value="all">All Status</option>
                <option value="Active">Active</option>
                <option value="Scheduled">Scheduled</option>
                <option value="Expired">Expired</option>
                <option value="Used up">Used up</option>
                <option value="Disabled">Disabled</option>
              </select>
              <select
                aria-label="Sort coupons"
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
                className="px-4 py-2 pr-8 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-medium cursor-pointer"
              >
                <option value="date">Newest first</option>
                <option value="usage">Most used</option>
                <option value="value">Highest value</option>
                <option value="code">Code A–Z</option>
              </select>
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left py-4 px-6 text-sm font-semibold text-gray-700">Code</th>
                <th className="text-left py-4 px-4 text-sm font-semibold text-gray-700">Type</th>
                <th className="text-left py-4 px-4 text-sm font-semibold text-gray-700">Value</th>
                <th className="text-left py-4 px-4 text-sm font-semibold text-gray-700">Min Purchase</th>
                <th className="text-left py-4 px-4 text-sm font-semibold text-gray-700">Usage</th>
                <th className="text-left py-4 px-4 text-sm font-semibold text-gray-700">Valid Period</th>
                <th className="text-left py-4 px-4 text-sm font-semibold text-gray-700">Status</th>
                <th className="text-left py-4 px-4 text-sm font-semibold text-gray-700">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} className="p-8 text-center text-gray-500">Loading coupons...</td></tr>
              ) : loadError ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center">
                    <p className="text-red-600 mb-3">{loadError}</p>
                    <button onClick={fetchCoupons} className="text-blue-700 font-semibold hover:underline cursor-pointer">Try again</button>
                  </td>
                </tr>
              ) : visibleCoupons.length === 0 ? (
                <tr>
                  <td colSpan={8} className="p-8 text-center text-gray-500">
                    {coupons.length === 0 ? 'No coupons yet. Create your first discount code.' : 'No coupons match your search.'}
                  </td>
                </tr>
              ) : (
                visibleCoupons.map((coupon) => {
                  const status = couponStatus(coupon);
                  const used = Number(coupon.usage_count || 0);
                  return (
                    <tr key={coupon.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                      <td className="py-4 px-6">
                        <div className="flex items-center space-x-2">
                          <span className="font-mono font-bold text-gray-900 bg-gray-100 px-3 py-1 rounded">{coupon.code}</span>
                          <button
                            onClick={() => copyCode(coupon.code)}
                            title="Copy code"
                            aria-label={`Copy ${coupon.code}`}
                            className="w-7 h-7 flex items-center justify-center text-gray-400 hover:text-blue-700 hover:bg-blue-50 rounded transition-colors cursor-pointer"
                          >
                            <i className="ri-file-copy-line"></i>
                          </button>
                        </div>
                        {coupon.description && (
                          <p className="text-xs text-gray-500 mt-1 max-w-xs truncate">{coupon.description}</p>
                        )}
                      </td>
                      <td className="py-4 px-4 text-gray-700 whitespace-nowrap">{TYPE_LABELS[coupon.type] || coupon.type}</td>
                      <td className="py-4 px-4 font-semibold text-gray-900 whitespace-nowrap">{valueLabel(coupon)}</td>
                      <td className="py-4 px-4 text-gray-700 whitespace-nowrap">
                        {Number(coupon.minimum_purchase || 0) > 0 ? `GH₵ ${money(coupon.minimum_purchase)}` : 'No minimum'}
                      </td>
                      <td className="py-4 px-4">
                        <div className="flex items-center space-x-2">
                          <span className="text-gray-900 font-semibold">{used}</span>
                          <span className="text-gray-500">/</span>
                          <span className="text-gray-600">{coupon.usage_limit ?? '∞'}</span>
                        </div>
                        {coupon.usage_limit != null && coupon.usage_limit > 0 && (
                          <div className="w-24 h-2 bg-gray-200 rounded-full mt-2">
                            <div
                              className="h-full bg-blue-700 rounded-full"
                              style={{ width: `${Math.min((used / coupon.usage_limit) * 100, 100)}%` }}
                            ></div>
                          </div>
                        )}
                      </td>
                      <td className="py-4 px-4">
                        <p className="text-sm text-gray-700 whitespace-nowrap">{coupon.start_date ? formatDate(coupon.start_date) : 'Starts now'}</p>
                        <p className="text-sm text-gray-500 whitespace-nowrap">{coupon.end_date ? `to ${formatDate(coupon.end_date)}` : 'No expiry'}</p>
                      </td>
                      <td className="py-4 px-4">
                        <span className={`px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap ${statusColors[status]}`}>
                          {status}
                        </span>
                      </td>
                      <td className="py-4 px-4">
                        <div className="flex items-center space-x-2">
                          <button
                            onClick={() => toggleActive(coupon)}
                            disabled={busyId === coupon.id}
                            title={coupon.is_active ? 'Turn off' : 'Turn on'}
                            aria-label={coupon.is_active ? `Turn off ${coupon.code}` : `Turn on ${coupon.code}`}
                            className={`w-8 h-8 flex items-center justify-center rounded-lg transition-colors cursor-pointer disabled:opacity-50 ${
                              coupon.is_active ? 'text-green-700 hover:bg-green-50' : 'text-gray-400 hover:bg-gray-100'
                            }`}
                          >
                            <i className={`${coupon.is_active ? 'ri-toggle-fill' : 'ri-toggle-line'} text-xl`}></i>
                          </button>
                          <button
                            onClick={() => openEdit(coupon)}
                            title="Edit"
                            aria-label={`Edit ${coupon.code}`}
                            className="w-8 h-8 flex items-center justify-center text-gray-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                          >
                            <i className="ri-edit-line text-lg"></i>
                          </button>
                          <button
                            onClick={() => setDeleteTarget(coupon)}
                            title="Delete"
                            aria-label={`Delete ${coupon.code}`}
                            className="w-8 h-8 flex items-center justify-center text-gray-600 hover:text-red-700 hover:bg-red-50 rounded-lg transition-colors cursor-pointer"
                          >
                            <i className="ri-delete-bin-line text-lg"></i>
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {showForm && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={closeForm}>
          <form
            onSubmit={handleSave}
            onClick={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="coupon-form-title"
            className="bg-white rounded-xl max-w-xl w-full max-h-[90vh] overflow-y-auto"
          >
            <div className="flex items-center justify-between p-6 border-b border-gray-200">
              <h2 id="coupon-form-title" className="text-xl font-bold text-gray-900">{editingId ? 'Edit Coupon' : 'Create Coupon'}</h2>
              <button type="button" onClick={closeForm} aria-label="Close" className="w-8 h-8 flex items-center justify-center text-gray-500 hover:bg-gray-100 rounded-lg cursor-pointer">
                <i className="ri-close-line text-xl"></i>
              </button>
            </div>

            <div className="p-6 space-y-4">
              {formError && (
                <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">{formError}</div>
              )}

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1" htmlFor="coupon-code">Code</label>
                <input
                  id="coupon-code"
                  value={form.code}
                  onChange={(e) => setForm({ ...form, code: e.target.value.toUpperCase().replace(/[^A-Z0-9_-]/g, '') })}
                  maxLength={40}
                  required
                  placeholder="e.g. WELCOME10"
                  className={`${inputClass} font-mono uppercase`}
                />
                <p className="text-xs text-gray-500 mt-1">Letters, numbers, - and _ only. Customers can type it in any case.</p>
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1" htmlFor="coupon-description">Description</label>
                <input
                  id="coupon-description"
                  value={form.description}
                  onChange={(e) => setForm({ ...form, description: e.target.value })}
                  placeholder="Shown to the customer, e.g. 10% off your first order"
                  className={inputClass}
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1" htmlFor="coupon-type">Type</label>
                  <select
                    id="coupon-type"
                    value={form.type}
                    onChange={(e) => setForm({ ...form, type: e.target.value as CouponType })}
                    className={`${inputClass} cursor-pointer`}
                  >
                    <option value="percentage">Percentage</option>
                    <option value="fixed_amount">Fixed amount (GH₵)</option>
                    <option value="free_shipping">Free delivery</option>
                  </select>
                  {form.type === 'free_shipping' && (
                    <p className="text-xs text-amber-700 mt-1">
                      Delivery fees are agreed by phone, not charged at checkout, so this code takes no money off online.
                      The order shows the code; waive the fee when you call the customer.
                    </p>
                  )}
                </div>
                {form.type !== 'free_shipping' && (
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1" htmlFor="coupon-value">
                      {form.type === 'percentage' ? 'Discount (%)' : 'Discount (GH₵)'}
                    </label>
                    <input
                      id="coupon-value"
                      type="number"
                      min="0"
                      step="0.01"
                      max={form.type === 'percentage' ? 100 : undefined}
                      value={form.value}
                      onChange={(e) => setForm({ ...form, value: e.target.value })}
                      required
                      className={inputClass}
                    />
                  </div>
                )}
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1" htmlFor="coupon-min">Minimum purchase (GH₵)</label>
                  <input
                    id="coupon-min"
                    type="number"
                    min="0"
                    step="0.01"
                    value={form.minimum_purchase}
                    onChange={(e) => setForm({ ...form, minimum_purchase: e.target.value })}
                    placeholder="No minimum"
                    className={inputClass}
                  />
                </div>
                {form.type === 'percentage' && (
                  <div>
                    <label className="block text-sm font-semibold text-gray-700 mb-1" htmlFor="coupon-max">Maximum discount (GH₵)</label>
                    <input
                      id="coupon-max"
                      type="number"
                      min="0"
                      step="0.01"
                      value={form.maximum_discount}
                      onChange={(e) => setForm({ ...form, maximum_discount: e.target.value })}
                      placeholder="No cap"
                      className={inputClass}
                    />
                  </div>
                )}
              </div>

              <div>
                <label className="block text-sm font-semibold text-gray-700 mb-1" htmlFor="coupon-limit">Usage limit</label>
                <input
                  id="coupon-limit"
                  type="number"
                  min="1"
                  step="1"
                  value={form.usage_limit}
                  onChange={(e) => setForm({ ...form, usage_limit: e.target.value })}
                  placeholder="Unlimited"
                  className={inputClass}
                />
                <p className="text-xs text-gray-500 mt-1">Total number of orders that can use this code.</p>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1" htmlFor="coupon-start">Start date</label>
                  <input
                    id="coupon-start"
                    type="date"
                    value={form.start_date}
                    onChange={(e) => setForm({ ...form, start_date: e.target.value })}
                    className={inputClass}
                  />
                </div>
                <div>
                  <label className="block text-sm font-semibold text-gray-700 mb-1" htmlFor="coupon-end">End date</label>
                  <input
                    id="coupon-end"
                    type="date"
                    value={form.end_date}
                    onChange={(e) => setForm({ ...form, end_date: e.target.value })}
                    className={inputClass}
                  />
                </div>
              </div>

              <label className="flex items-center gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={form.is_active}
                  onChange={(e) => setForm({ ...form, is_active: e.target.checked })}
                  className="w-4 h-4"
                />
                <span className="text-sm font-semibold text-gray-700">Active (customers can use it)</span>
              </label>
            </div>

            <div className="flex justify-end gap-3 p-6 border-t border-gray-200">
              <button
                type="button"
                onClick={closeForm}
                disabled={saving}
                className="px-5 py-2.5 border-2 border-gray-300 rounded-lg font-semibold text-gray-700 hover:bg-gray-50 cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                type="submit"
                disabled={saving}
                className="px-5 py-2.5 bg-blue-700 hover:bg-blue-800 text-white rounded-lg font-semibold cursor-pointer disabled:opacity-50"
              >
                {saving ? 'Saving...' : editingId ? 'Save changes' : 'Create coupon'}
              </button>
            </div>
          </form>
        </div>
      )}

      {deleteTarget && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => !deleting && setDeleteTarget(null)}>
          <div className="bg-white rounded-xl max-w-md w-full p-6" role="alertdialog" aria-modal="true" onClick={(e) => e.stopPropagation()}>
            <h2 className="text-lg font-bold text-gray-900 mb-2">Delete coupon {deleteTarget.code}?</h2>
            <p className="text-gray-600 text-sm mb-6">
              Customers will no longer be able to use this code. Orders that already used it are not changed. This cannot be undone.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setDeleteTarget(null)}
                disabled={deleting}
                className="px-5 py-2.5 border-2 border-gray-300 rounded-lg font-semibold text-gray-700 hover:bg-gray-50 cursor-pointer disabled:opacity-50"
              >
                Cancel
              </button>
              <button
                onClick={confirmDelete}
                disabled={deleting}
                className="px-5 py-2.5 bg-red-600 hover:bg-red-700 text-white rounded-lg font-semibold cursor-pointer disabled:opacity-50"
              >
                {deleting ? 'Deleting...' : 'Delete'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
