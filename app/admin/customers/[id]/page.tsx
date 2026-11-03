'use client';
import { money } from '@/lib/format-money';

import { useState, useEffect, useCallback } from 'react';
import { supabase } from '@/lib/supabase';
import { useParams } from 'next/navigation';
import Link from 'next/link';

type Customer = {
    id: string;
    email: string;
    phone: string | null;
    full_name: string | null;
    first_name: string | null;
    last_name: string | null;
    user_id: string | null;
    notes: string | null;
    tags: string[] | null;
    secondary_email: string | null;
    secondary_phone: string | null;
    created_at: string | null;
};

type Order = {
    id: string;
    order_number: string | null;
    status: string | null;
    payment_status: string | null;
    total: number | string | null;
    created_at: string;
};

/** Strip characters that would break a PostgREST or() filter list. */
function orValue(v: string): string {
    return v.replace(/[,()"'\\]/g, '').trim();
}

/** Real mailbox only: skips POS placeholder addresses like walkin@pos.local. */
function isMailable(email: string | null | undefined): email is string {
    return !!email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && !email.toLowerCase().endsWith('.local');
}

const STATUS_STYLES: Record<string, string> = {
    delivered: 'bg-green-100 text-green-800',
    shipped: 'bg-yellow-100 text-yellow-800',
    processing: 'bg-blue-100 text-blue-800',
    pending: 'bg-amber-100 text-amber-800',
    awaiting_payment: 'bg-amber-100 text-amber-800',
    cancelled: 'bg-red-100 text-red-800',
    refunded: 'bg-gray-100 text-gray-800',
};

export default function CustomerDetailsPage() {
    const params = useParams();
    const customerId = params.id as string;

    const [customer, setCustomer] = useState<Customer | null>(null);
    const [orders, setOrders] = useState<Order[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadError, setLoadError] = useState('');
    const [ordersError, setOrdersError] = useState('');

    const [editing, setEditing] = useState(false);
    const [saving, setSaving] = useState(false);
    const [saveError, setSaveError] = useState('');
    const [form, setForm] = useState({ full_name: '', phone: '', notes: '', tags: '' });

    const fetchCustomerData = useCallback(async () => {
        setLoading(true);
        setLoadError('');
        setOrdersError('');

        const { data: row, error } = await supabase
            .from('customers')
            .select('*')
            .eq('id', customerId)
            .maybeSingle();

        if (error) {
            setLoadError(error.message || 'Could not load customer.');
            setCustomer(null);
            setLoading(false);
            return;
        }
        if (!row) {
            setCustomer(null);
            setLoading(false);
            return;
        }

        const c = row as Customer;
        setCustomer(c);

        // Orders can be linked by any of the customer's emails, phones or account.
        const parts: string[] = [];
        for (const email of [c.email, c.secondary_email]) {
            const v = email ? orValue(email) : '';
            if (v) parts.push(`email.eq.${v}`);
        }
        for (const phone of [c.phone, c.secondary_phone]) {
            const v = phone ? orValue(phone) : '';
            if (v) parts.push(`phone.eq.${v}`);
        }
        if (c.user_id) {
            const v = orValue(c.user_id);
            if (v) parts.push(`user_id.eq.${v}`);
        }

        if (parts.length === 0) {
            setOrders([]);
        } else {
            const { data: ordersData, error: oError } = await supabase
                .from('orders')
                .select('id, order_number, status, payment_status, total, created_at')
                .or(parts.join(','))
                .order('created_at', { ascending: false });
            if (oError) {
                setOrdersError(oError.message || 'Could not load orders.');
                setOrders([]);
            } else {
                setOrders((ordersData || []) as Order[]);
            }
        }
        setLoading(false);
    }, [customerId]);

    useEffect(() => {
        if (customerId) fetchCustomerData();
    }, [customerId, fetchCustomerData]);

    const startEdit = () => {
        if (!customer) return;
        setForm({
            full_name: customer.full_name || '',
            phone: customer.phone || '',
            notes: customer.notes || '',
            tags: (customer.tags || []).join(', '),
        });
        setSaveError('');
        setEditing(true);
    };

    const saveEdit = async () => {
        if (!customer) return;
        setSaving(true);
        setSaveError('');
        const tags = Array.from(
            new Set(
                form.tags
                    .split(',')
                    .map((t) => t.trim())
                    .filter(Boolean)
            )
        );
        const payload = {
            full_name: form.full_name.trim() || null,
            phone: form.phone.trim() || null,
            notes: form.notes.trim() || null,
            tags,
            updated_at: new Date().toISOString(),
        };
        const { error } = await supabase.from('customers').update(payload).eq('id', customer.id);
        setSaving(false);
        if (error) {
            setSaveError(error.message || 'Could not save changes.');
            return;
        }
        setCustomer({ ...customer, ...payload });
        setEditing(false);
    };

    if (loading) return <div className="p-8 text-center text-gray-500">Loading customer details...</div>;
    if (loadError) {
        return (
            <div className="p-8 text-center">
                <p className="text-red-600 mb-4">{loadError}</p>
                <button
                    onClick={fetchCustomerData}
                    className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50"
                >
                    Try again
                </button>
            </div>
        );
    }
    if (!customer) {
        return (
            <div className="p-8 text-center">
                <p className="text-red-500 mb-4">Customer not found</p>
                <Link href="/admin/customers" className="text-blue-700 hover:underline">Back to customers</Link>
            </div>
        );
    }

    // Paid orders that were later cancelled or refunded are not money the customer spent.
    const paidOrders = orders.filter((o) => o.payment_status === 'paid' && o.status !== 'cancelled' && o.status !== 'refunded');
    const totalSpent = paidOrders.reduce((sum, o) => sum + (Number(o.total) || 0), 0);
    const displayName =
        customer.full_name ||
        [customer.first_name, customer.last_name].filter(Boolean).join(' ') ||
        'No Name';
    const initial = (displayName !== 'No Name' ? displayName : customer.email || '?').charAt(0).toUpperCase();
    const mailable = isMailable(customer.email) ? customer.email : isMailable(customer.secondary_email) ? customer.secondary_email : null;

    return (
        <div className="max-w-7xl mx-auto">
            {/* Header */}
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between mb-8">
                <div className="flex items-center space-x-4 min-w-0">
                    <Link href="/admin/customers" aria-label="Back to customers" className="p-2 hover:bg-gray-100 rounded-lg text-gray-500 transition-colors">
                        <i className="ri-arrow-left-line text-xl"></i>
                    </Link>
                    <div className="w-16 h-16 shrink-0 bg-blue-100 rounded-full flex items-center justify-center text-blue-700 text-2xl font-bold">
                        {initial}
                    </div>
                    <div className="min-w-0">
                        <h1 className="text-3xl font-bold text-gray-900 truncate">{displayName}</h1>
                        <p className="text-gray-500 truncate">{isMailable(customer.email) ? customer.email : 'No email on file'}</p>
                        {customer.tags && customer.tags.length > 0 && (
                            <div className="mt-2 flex flex-wrap gap-1">
                                {customer.tags.map((t) => (
                                    <span key={t} className="px-2 py-0.5 rounded-full bg-gray-100 text-gray-700 text-xs font-medium">{t}</span>
                                ))}
                            </div>
                        )}
                    </div>
                </div>
                <div className="flex flex-wrap gap-3">
                    {mailable ? (
                        <a
                            href={`mailto:${encodeURIComponent(mailable)}`}
                            className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50"
                        >
                            <i className="ri-mail-send-line mr-2"></i>
                            Send Email
                        </a>
                    ) : (
                        <button
                            disabled
                            title="No real email address on file"
                            className="px-4 py-2 border border-gray-200 rounded-lg text-gray-400 font-medium cursor-not-allowed"
                        >
                            <i className="ri-mail-send-line mr-2"></i>
                            Send Email
                        </button>
                    )}
                    {!editing && (
                        <button
                            onClick={startEdit}
                            className="px-4 py-2 bg-blue-700 text-white rounded-lg font-bold hover:bg-blue-800"
                        >
                            Edit Customer
                        </button>
                    )}
                </div>
            </div>

            {editing && (
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 mb-8">
                    <h2 className="text-lg font-bold text-gray-900 mb-4">Edit customer</h2>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <label className="block">
                            <span className="text-sm font-medium text-gray-700">Full name</span>
                            <input
                                value={form.full_name}
                                onChange={(e) => setForm({ ...form, full_name: e.target.value })}
                                className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                        </label>
                        <label className="block">
                            <span className="text-sm font-medium text-gray-700">Phone</span>
                            <input
                                type="tel"
                                value={form.phone}
                                onChange={(e) => setForm({ ...form, phone: e.target.value })}
                                className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                        </label>
                        <label className="block md:col-span-2">
                            <span className="text-sm font-medium text-gray-700">Tags (comma separated)</span>
                            <input
                                value={form.tags}
                                onChange={(e) => setForm({ ...form, tags: e.target.value })}
                                placeholder="vip, wholesale"
                                className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                        </label>
                        <label className="block md:col-span-2">
                            <span className="text-sm font-medium text-gray-700">Notes</span>
                            <textarea
                                rows={4}
                                value={form.notes}
                                onChange={(e) => setForm({ ...form, notes: e.target.value })}
                                className="mt-1 w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                            />
                        </label>
                    </div>
                    {saveError && <p className="mt-3 text-sm text-red-600">{saveError}</p>}
                    <div className="mt-4 flex justify-end gap-3">
                        <button
                            onClick={() => setEditing(false)}
                            disabled={saving}
                            className="px-4 py-2 border border-gray-300 rounded-lg text-gray-700 font-medium hover:bg-gray-50 disabled:opacity-50"
                        >
                            Cancel
                        </button>
                        <button
                            onClick={saveEdit}
                            disabled={saving}
                            className="px-4 py-2 bg-blue-700 text-white rounded-lg font-bold hover:bg-blue-800 disabled:opacity-50"
                        >
                            {saving ? 'Saving...' : 'Save changes'}
                        </button>
                    </div>
                </div>
            )}

            {/* Stats Grid */}
            <div className="grid grid-cols-2 md:grid-cols-4 gap-4 md:gap-6 mb-8">
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                    <p className="text-sm font-medium text-gray-500 mb-1">Total Spent</p>
                    <p className="text-2xl font-bold text-gray-900">GH₵{money(totalSpent)}</p>
                </div>
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                    <p className="text-sm font-medium text-gray-500 mb-1">Total Orders</p>
                    <p className="text-2xl font-bold text-gray-900">{orders.length}</p>
                    {orders.length !== paidOrders.length && (
                        <p className="text-xs text-gray-500 mt-1">{paidOrders.length} paid and kept</p>
                    )}
                </div>
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                    <p className="text-sm font-medium text-gray-500 mb-1">Last Order</p>
                    <p className="text-xl font-bold text-gray-900">
                        {orders[0] ? new Date(orders[0].created_at).toLocaleDateString() : 'Never'}
                    </p>
                </div>
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
                    <p className="text-sm font-medium text-gray-500 mb-1">Phone</p>
                    <p className="text-lg font-bold text-gray-900 break-all">{customer.phone || 'N/A'}</p>
                    {customer.secondary_phone && <p className="text-sm text-gray-500">{customer.secondary_phone}</p>}
                </div>
            </div>

            {customer.notes && !editing && (
                <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200 mb-8">
                    <h2 className="text-sm font-medium text-gray-500 mb-2">Notes</h2>
                    <p className="text-gray-900 whitespace-pre-wrap">{customer.notes}</p>
                </div>
            )}

            {/* Orders History */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                <div className="px-6 py-4 border-b border-gray-200">
                    <h2 className="text-lg font-bold text-gray-900">Order History</h2>
                </div>

                {ordersError ? (
                    <div className="p-8 text-center text-red-600">{ordersError}</div>
                ) : orders.length === 0 ? (
                    <div className="p-8 text-center text-gray-500">No orders found.</div>
                ) : (
                    <div className="overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className="bg-gray-50 text-gray-600 text-xs uppercase font-semibold">
                                <tr>
                                    <th className="px-6 py-4">Order</th>
                                    <th className="px-6 py-4">Date</th>
                                    <th className="px-6 py-4">Status</th>
                                    <th className="px-6 py-4">Payment</th>
                                    <th className="px-6 py-4">Total</th>
                                    <th className="px-6 py-4 text-right">Actions</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-gray-100">
                                {orders.map((order) => {
                                    const status = order.status || 'pending';
                                    return (
                                        <tr key={order.id} className="hover:bg-gray-50">
                                            <td className="px-6 py-4 text-sm font-medium text-blue-700 whitespace-nowrap">
                                                <Link href={`/admin/orders/${order.id}`}>#{order.order_number || order.id.slice(0, 8)}</Link>
                                            </td>
                                            <td className="px-6 py-4 text-sm text-gray-600">
                                                {new Date(order.created_at).toLocaleDateString()}
                                            </td>
                                            <td className="px-6 py-4">
                                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium capitalize ${STATUS_STYLES[status] || 'bg-gray-100 text-gray-800'}`}>
                                                    {status === 'shipped' ? 'Packaged' : status.replace(/_/g, ' ')}
                                                </span>
                                            </td>
                                            <td className="px-6 py-4 text-sm text-gray-600 capitalize">
                                                {(order.payment_status || 'pending').replace(/_/g, ' ')}
                                            </td>
                                            <td className="px-6 py-4 text-sm font-bold text-gray-900">
                                                GH₵{money(Number(order.total) || 0)}
                                            </td>
                                            <td className="px-6 py-4 text-right">
                                                <Link href={`/admin/orders/${order.id}`} aria-label={`View order ${order.order_number || order.id.slice(0, 8)}`} className="text-gray-500 hover:text-blue-700">
                                                    <i className="ri-eye-line text-lg"></i>
                                                </Link>
                                            </td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                )}
            </div>
        </div>
    );
}
