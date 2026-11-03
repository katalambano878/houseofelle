'use client';

import Link from 'next/link';
import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase';

/** CSV cell: always quoted, inner quotes doubled, formula-looking values defused. */
function csvCell(value: unknown): string {
  let v = value == null ? '' : String(value);
  if (/^[=+\-@\t\r]/.test(v)) v = `'${v}`;
  return `"${v.replace(/"/g, '""')}"`;
}

function downloadCsv(filename: string, header: string[], rows: unknown[][]) {
  const csv = [header, ...rows].map((r) => r.map(csvCell).join(',')).join('\r\n');
  const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}

/** Real mailbox only: skips POS placeholder addresses like walkin@pos.local. */
function isMailable(email: string): boolean {
  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email) && !email.toLowerCase().endsWith('.local');
}

export default function AdminCustomersPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCustomers, setSelectedCustomers] = useState<string[]>([]);
  const [customers, setCustomers] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [sortOption, setSortOption] = useState('Sort by Join Date');
  const [filterStatus, setFilterStatus] = useState('All Customers');
  const [loadError, setLoadError] = useState('');
  const [bulkBusy, setBulkBusy] = useState(false);
  const [notice, setNotice] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  useEffect(() => {
    fetchCustomers();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once on mount
  }, []);

  const fetchCustomers = async () => {
    setLoading(true);
    setLoadError('');
    // The customers table holds both guests and registered shoppers (filled from orders).
    // Its stored order counters miss POS sales and cancellations, so totals are worked out
    // from the orders themselves, matched the same way the customer page matches them.
    const [{ data: customerData, error: cError }, { data: orderRows }] = await Promise.all([
      supabase.from('customers').select('*').order('created_at', { ascending: false }),
      supabase.from('orders').select('email, phone, user_id, total, status, payment_status, created_at'),
    ]);

    if (cError) {
      setLoadError(cError.message || 'Could not load customers.');
      setCustomers([]);
      setLoading(false);
      return;
    }

    const byKey = new Map<string, any[]>();
    const keyOf = (kind: string, v: unknown) => (v ? `${kind}:${String(v).trim().toLowerCase()}` : '');
    (orderRows || []).forEach((o: any) => {
      if (o.payment_status !== 'paid' || o.status === 'cancelled' || o.status === 'refunded') return;
      for (const key of [keyOf('e', o.email), keyOf('p', o.phone), keyOf('u', o.user_id)]) {
        if (!key) continue;
        const list = byKey.get(key) || [];
        list.push(o);
        byKey.set(key, list);
      }
    });

    const processed = (customerData || []).map((customer: any) => {
      const matched = new Set<any>();
      for (const key of [
        keyOf('e', customer.email), keyOf('e', customer.secondary_email),
        keyOf('p', customer.phone), keyOf('p', customer.secondary_phone), keyOf('u', customer.user_id),
      ]) {
        if (key) (byKey.get(key) || []).forEach((o) => matched.add(o));
      }
      const paidOrders = Array.from(matched);
      const totalSpent = paidOrders.reduce((sum, o) => sum + (Number(o.total) || 0), 0);
      const totalOrders = paidOrders.length;
      const lastOrderAt = paidOrders.reduce<string>((latest, o) => (o.created_at > latest ? o.created_at : latest), '');
      const tags: string[] = Array.isArray(customer.tags) ? customer.tags : [];
      const isVipTagged = tags.some((t) => String(t).toLowerCase() === 'vip');

      let status = 'New';
      if (isVipTagged || totalSpent > 1000) status = 'VIP';
      else if (totalOrders > 0) status = 'Active';
      else if (customer.created_at && new Date(customer.created_at).getTime() < Date.now() - 30 * 24 * 60 * 60 * 1000) status = 'Inactive';

      const displayName = customer.full_name ||
        (customer.first_name && customer.last_name ? `${customer.first_name} ${customer.last_name}` : null) ||
        customer.first_name ||
        'No Name';
      // POS sales without an email are stored as <phone>@pos.local; that is not a real address.
      const email = customer.email && isMailable(customer.email) ? customer.email : '';
      const joinedAt = customer.created_at ? new Date(customer.created_at) : new Date(0);

      return {
        id: customer.id,
        name: displayName,
        email,
        phone: customer.phone || '',
        avatar: getInitials(displayName !== 'No Name' ? displayName : email),
        orders: totalOrders,
        totalSpent,
        joined: customer.created_at ? joinedAt.toLocaleDateString() : '',
        lastOrder: lastOrderAt ? timeAgo(new Date(lastOrderAt)) : 'Never',
        lastOrderAt,
        status,
        tags,
        isVipTagged,
        rawJoined: joinedAt,
        rawLastOrder: lastOrderAt ? new Date(lastOrderAt) : null,
        isGuest: !customer.user_id
      };
    });
    setCustomers(processed);
    setLoading(false);
  };

  const getInitials = (name: string) => {
    if (!name) return '??';
    return name
      .split(' ')
      .map(n => n[0])
      .slice(0, 2)
      .join('')
      .toUpperCase();
  };

  const timeAgo = (date: Date) => {
    const seconds = Math.floor((new Date().getTime() - date.getTime()) / 1000);
    let interval = seconds / 31536000;
    if (interval > 1) return Math.floor(interval) + " years ago";
    interval = seconds / 2592000;
    if (interval > 1) return Math.floor(interval) + " months ago";
    interval = seconds / 86400;
    if (interval > 1) return Math.floor(interval) + " days ago";
    interval = seconds / 3600;
    if (interval > 1) return Math.floor(interval) + " hours ago";
    return "Today";
  }

  const statusColors: any = {
    'New': 'bg-blue-100 text-blue-700',
    'Active': 'bg-green-100 text-green-700',
    'VIP': 'bg-yellow-100 text-yellow-800',
    'Inactive': 'bg-gray-100 text-gray-700'
  };

  const handleSelectAll = () => {
    const visibleIds = filteredCustomers.map(c => c.id);
    const allSelected = visibleIds.length > 0 && visibleIds.every(id => selectedCustomers.includes(id));
    setSelectedCustomers(allSelected ? [] : visibleIds);
  };

  const handleSelectCustomer = (customerId: string) => {
    if (selectedCustomers.includes(customerId)) {
      setSelectedCustomers(selectedCustomers.filter(id => id !== customerId));
    } else {
      setSelectedCustomers([...selectedCustomers, customerId]);
    }
  };

  // Memoized filter and sort
  const filteredCustomers = useMemo(() => {
    let result = customers;

    // Filter by Status
    if (filterStatus !== 'All Customers') {
      result = result.filter(c => c.status === filterStatus);
    }

    // Search
    if (searchQuery) {
      const q = searchQuery.toLowerCase();
      result = result.filter(c =>
        c.name.toLowerCase().includes(q) ||
        (c.email || '').toLowerCase().includes(q) ||
        (c.phone || '').toLowerCase().includes(q)
      );
    }

    // Sort
    result = [...result].sort((a, b) => {
      if (sortOption === 'Sort by Name') return a.name.localeCompare(b.name);
      if (sortOption === 'Sort by Orders') return b.orders - a.orders;
      if (sortOption === 'Sort by Spent') return b.totalSpent - a.totalSpent;
      if (sortOption === 'Sort by Join Date') return b.rawJoined.getTime() - a.rawJoined.getTime();
      return 0;
    });

    return result;
  }, [customers, searchQuery, sortOption, filterStatus]);

  const selectedRows = useMemo(
    () => customers.filter(c => selectedCustomers.includes(c.id)),
    [customers, selectedCustomers]
  );

  const exportCustomers = (rows: any[]) => {
    if (rows.length === 0) {
      setNotice({ type: 'error', text: 'No customers to export.' });
      return;
    }
    const header = ['Name', 'Email', 'Phone', 'Paid orders', 'Total spent (GHS)', 'Last order', 'Joined', 'Status', 'Guest', 'Tags'];
    const data = rows.map(c => [
      c.name,
      c.email,
      c.phone,
      c.orders,
      c.totalSpent.toFixed(2),
      c.lastOrderAt ? new Date(c.lastOrderAt).toISOString().slice(0, 10) : '',
      c.rawJoined.getTime() > 0 ? c.rawJoined.toISOString().slice(0, 10) : '',
      c.status,
      c.isGuest ? 'Yes' : 'No',
      (c.tags || []).join('; '),
    ]);
    downloadCsv(`house-of-elle-customers-${new Date().toISOString().slice(0, 10)}.csv`, header, data);
  };

  const emailSelected = () => {
    const emails = Array.from(new Set(selectedRows.map(c => c.email).filter(isMailable)));
    if (emails.length === 0) {
      setNotice({ type: 'error', text: 'None of the selected customers has a real email address.' });
      return;
    }
    window.location.href = `mailto:?bcc=${emails.map(encodeURIComponent).join(',')}`;
  };

  const allSelectedAreVip = selectedRows.length > 0 && selectedRows.every(c => c.isVipTagged);

  const toggleVipForSelected = async () => {
    if (selectedRows.length === 0) return;
    const makeVip = !allSelectedAreVip;
    setBulkBusy(true);
    let failed = 0;
    for (const c of selectedRows) {
      const current: string[] = (c.tags || []).filter((t: string) => String(t).toLowerCase() !== 'vip');
      const nextTags = makeVip ? [...current, 'vip'] : current;
      const { error } = await supabase
        .from('customers')
        .update({ tags: nextTags, updated_at: new Date().toISOString() })
        .eq('id', c.id);
      if (error) failed++;
    }
    setBulkBusy(false);
    if (failed > 0) {
      setNotice({ type: 'error', text: `Could not update ${failed} of ${selectedRows.length} customers.` });
    } else {
      setNotice({
        type: 'success',
        text: makeVip
          ? `Marked ${selectedRows.length} customer${selectedRows.length > 1 ? 's' : ''} as VIP.`
          : `Removed the VIP tag from ${selectedRows.length} customer${selectedRows.length > 1 ? 's' : ''}.`,
      });
    }
    await fetchCustomers();
  };

  // Derived Stats
  const stats = useMemo(() => ({
    total: customers.length,
    newThisMonth: customers.filter(c => {
      const d = new Date(c.rawJoined);
      const now = new Date();
      return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
    }).length,
    vip: customers.filter(c => c.status === 'VIP').length,
    avgLTV: customers.length > 0 ? (customers.reduce((sum, c) => sum + c.totalSpent, 0) / customers.length) : 0
  }), [customers]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Customers</h1>
          <p className="text-gray-600 mt-1">Manage your customer base and relationships</p>
        </div>
        <button
          onClick={() => exportCustomers(filteredCustomers)}
          disabled={loading || filteredCustomers.length === 0}
          className="bg-blue-700 hover:bg-blue-800 text-white px-6 py-3 rounded-lg font-semibold transition-colors whitespace-nowrap cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <i className="ri-download-line mr-2"></i>
          Export Customers
        </button>
      </div>

      {notice && (
        <div
          role="status"
          className={`p-4 rounded-lg border text-sm flex items-center justify-between ${
            notice.type === 'success' ? 'bg-green-50 border-green-200 text-green-800' : 'bg-red-50 border-red-200 text-red-800'
          }`}
        >
          <span>{notice.text}</span>
          <button onClick={() => setNotice(null)} aria-label="Dismiss" className="ml-4 cursor-pointer">
            <i className="ri-close-line"></i>
          </button>
        </div>
      )}

      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
          <p className="text-sm text-gray-600 mb-1">Total Customers</p>
          <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
          <p className="text-sm text-gray-600 mb-1">New This Month</p>
          <p className="text-2xl font-bold text-blue-700">{stats.newThisMonth}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
          <p className="text-sm text-gray-600 mb-1">VIP Customers</p>
          <p className="text-2xl font-bold text-yellow-800">{stats.vip}</p>
        </div>
        <div className="bg-white rounded-xl border border-gray-200 shadow-sm p-4">
          <p className="text-sm text-gray-600 mb-1">Avg Lifetime Value</p>
          <p className="text-2xl font-bold text-gray-900">GH₵ {stats.avgLTV.toLocaleString(undefined, { maximumFractionDigits: 0 })}</p>
        </div>
      </div>

      <div className="bg-white rounded-xl shadow-sm border border-gray-200">
        <div className="p-6 border-b border-gray-200">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between space-y-4 md:space-y-0">
            <div className="flex-1 max-w-md">
              <div className="relative">
                <i className="ri-search-line absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 text-lg flex items-center justify-center"></i>
                <input
                  type="search"
                  aria-label="Search customers"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by name, email, or phone..."
                  className="w-full pl-12 pr-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <select
                aria-label="Filter by customer status"
                value={filterStatus}
                onChange={(e) => setFilterStatus(e.target.value)}
                className="px-4 py-3 pr-8 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-medium cursor-pointer"
              >
                <option>All Customers</option>
                <option>New</option>
                <option>Active</option>
                <option>VIP</option>
                <option>Inactive</option>
              </select>
              <select
                aria-label="Sort customers"
                value={sortOption}
                onChange={(e) => setSortOption(e.target.value)}
                className="px-4 py-3 pr-8 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-medium cursor-pointer"
              >
                <option>Sort by Join Date</option>
                <option>Sort by Name</option>
                <option>Sort by Orders</option>
                <option>Sort by Spent</option>
              </select>
            </div>
          </div>
        </div>

        {selectedCustomers.length > 0 && (
          <div className="p-4 bg-blue-50 border-b border-blue-200 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <p className="text-blue-800 font-semibold">
              {selectedCustomers.length} customer{selectedCustomers.length > 1 ? 's' : ''} selected
            </p>
            <div className="flex flex-wrap items-center gap-2">
              <button
                onClick={emailSelected}
                className="px-4 py-2 bg-blue-700 hover:bg-blue-800 text-white rounded-lg text-sm font-medium transition-colors whitespace-nowrap cursor-pointer"
              >
                <i className="ri-mail-line mr-2"></i>
                Send Email
              </button>
              <button
                onClick={toggleVipForSelected}
                disabled={bulkBusy}
                className="px-4 py-2 bg-yellow-700 hover:bg-yellow-800 text-white rounded-lg text-sm font-medium transition-colors whitespace-nowrap cursor-pointer disabled:opacity-50"
              >
                <i className="ri-vip-crown-line mr-2"></i>
                {bulkBusy ? 'Saving...' : allSelectedAreVip ? 'Remove VIP' : 'Mark as VIP'}
              </button>
              <button
                onClick={() => exportCustomers(selectedRows)}
                className="px-4 py-2 bg-gray-700 hover:bg-gray-800 text-white rounded-lg text-sm font-medium transition-colors whitespace-nowrap cursor-pointer"
              >
                <i className="ri-download-line mr-2"></i>
                Export
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
                    aria-label="Select all customers shown"
                    checked={filteredCustomers.length > 0 && filteredCustomers.every(c => selectedCustomers.includes(c.id))}
                    onChange={handleSelectAll}
                    className="w-4 h-4 text-blue-700 border-gray-300 rounded focus:ring-blue-500 cursor-pointer"
                  />
                </th>
                <th className="text-left py-4 px-4 text-sm font-semibold text-gray-700">Customer</th>
                <th className="text-left py-4 px-4 text-sm font-semibold text-gray-700">Contact</th>
                <th className="text-left py-4 px-4 text-sm font-semibold text-gray-700">Paid Orders</th>
                <th className="text-left py-4 px-4 text-sm font-semibold text-gray-700">Total Spent</th>
                <th className="text-left py-4 px-4 text-sm font-semibold text-gray-700">Last Order</th>
                <th className="text-left py-4 px-4 text-sm font-semibold text-gray-700">Status</th>
                <th className="text-left py-4 px-4 text-sm font-semibold text-gray-700">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr><td colSpan={8} className="p-10 text-center text-gray-500">Loading customers...</td></tr>
              ) : loadError ? (
                <tr>
                  <td colSpan={8} className="p-10 text-center">
                    <p className="text-red-600 mb-3">{loadError}</p>
                    <button onClick={fetchCustomers} className="text-blue-700 font-semibold hover:underline cursor-pointer">Try again</button>
                  </td>
                </tr>
              ) : filteredCustomers.length === 0 ? (
                <tr><td colSpan={8} className="p-10 text-center text-gray-500">{customers.length === 0 ? 'No customers yet. They are added when someone orders online or at the POS.' : 'No customers match this search or filter.'}</td></tr>
              ) : (
                filteredCustomers.map((customer) => (
                  <tr key={customer.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                    <td className="py-4 px-6">
                      <input
                        type="checkbox"
                        aria-label={`Select ${customer.name}`}
                        checked={selectedCustomers.includes(customer.id)}
                        onChange={() => handleSelectCustomer(customer.id)}
                        className="w-4 h-4 text-blue-700 border-gray-300 rounded focus:ring-blue-500 cursor-pointer"
                      />
                    </td>
                    <td className="py-4 px-4">
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 shrink-0 flex items-center justify-center bg-blue-100 text-blue-700 rounded-full font-semibold">
                          {customer.avatar}
                        </div>
                        <div>
                          <Link href={`/admin/customers/${customer.id}`} className="font-semibold text-gray-900 hover:text-blue-700 whitespace-nowrap">
                            {customer.name}
                          </Link>
                          <p className="text-sm text-gray-500">Joined {customer.joined}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      <p className="text-gray-700 text-sm">{customer.email || 'No email'}</p>
                      <p className="text-gray-600 text-sm">{customer.phone || 'No phone'}</p>
                    </td>
                    <td className="py-4 px-4 font-semibold text-gray-900">{customer.orders}</td>
                    <td className="py-4 px-4 font-semibold text-blue-700 whitespace-nowrap">GH₵ {customer.totalSpent.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</td>
                    <td className="py-4 px-4 text-gray-700 text-sm whitespace-nowrap">{customer.lastOrder}</td>
                    <td className="py-4 px-4">
                      <div className="flex items-center gap-2">
                        <span className={`px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap ${statusColors[customer.status]}`}>
                          {customer.status}
                        </span>
                        {customer.isGuest && (
                          <span className="px-2 py-0.5 rounded-full text-xs font-medium bg-gray-100 text-gray-600">
                            Guest
                          </span>
                        )}
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      <div className="flex items-center space-x-2">
                        <Link
                          href={`/admin/customers/${customer.id}`}
                          aria-label={`View ${customer.name}`}
                          title="View customer"
                          className="w-8 h-8 flex items-center justify-center text-gray-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors"
                        >
                          <i className="ri-eye-line text-lg"></i>
                        </Link>
                        {isMailable(customer.email) && (
                          <a
                            href={`mailto:${customer.email}`}
                            title={`Email ${customer.email}`}
                            aria-label={`Email ${customer.name}`}
                            className="w-8 h-8 flex items-center justify-center text-gray-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors"
                          >
                            <i className="ri-mail-line text-lg"></i>
                          </a>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        <div className="p-6 border-t border-gray-200 flex items-center justify-between">
          <p className="text-gray-600">Showing {filteredCustomers.length} of {customers.length} customers</p>
        </div>
      </div>
    </div>
  );
}
