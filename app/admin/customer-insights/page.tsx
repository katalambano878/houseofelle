'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';

// Helper for currency formatting
const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('en-GH', {
    style: 'currency',
    currency: 'GHS'
  }).format(amount);
};

const DAY = 1000 * 3600 * 24;

/** CSV cell: always quoted, inner quotes doubled, formula-looking values defused. */
function csvCell(value: unknown): string {
  let v = value == null ? '' : String(value);
  if (/^[=+\-@\t\r]/.test(v)) v = `'${v}`;
  return `"${v.replace(/"/g, '""')}"`;
}

const normEmail = (e: unknown) => (typeof e === 'string' ? e.trim().toLowerCase() : '');
const normPhone = (p: unknown) => (typeof p === 'string' ? p.replace(/\D/g, '').slice(-9) : '');

type InsightCustomer = {
  id: string;
  name: string;
  email: string;
  phone: string;
  segment: 'vip' | 'returning' | 'new' | 'at-risk' | 'no-orders';
  totalSpent: number;
  orders: number;
  avgOrderValue: number;
  joinDate: string | null;
  lastOrder: string | null;
  riskLevel: 'low' | 'medium' | 'high' | 'none';
  tags: string[];
};

export default function CustomerInsightsPage() {
  const [selectedSegment, setSelectedSegment] = useState('all');
  const [searchTerm, setSearchTerm] = useState('');
  const [customers, setCustomers] = useState<InsightCustomer[]>([]);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  // Statistics
  const [stats, setStats] = useState({
    vip: 0,
    returning: 0,
    new: 0,
    atRisk: 0,
    noOrders: 0,
    avgCLV: 0
  });

  useEffect(() => {
    fetchCustomerData();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once on mount
  }, []);

  const fetchCustomerData = async () => {
    setLoading(true);
    setLoadError('');

    const [{ data: rows, error: cError }, { data: orders, error: oError }] = await Promise.all([
      supabase.from('customers').select('*'),
      supabase
        .from('orders')
        .select('user_id, email, phone, total, created_at, payment_status')
        .eq('payment_status', 'paid'),
    ]);

    if (cError || oError) {
      setLoadError((cError || oError)?.message || 'Could not load customer insights.');
      setCustomers([]);
      setLoading(false);
      return;
    }

    // Index paid orders by account, email and phone so each customer finds theirs once.
    type PaidOrder = { idx: number; total: number; created_at: string };
    const byUser = new Map<string, PaidOrder[]>();
    const byEmail = new Map<string, PaidOrder[]>();
    const byPhone = new Map<string, PaidOrder[]>();
    const push = (m: Map<string, PaidOrder[]>, k: string, o: PaidOrder) => {
      if (!k) return;
      const list = m.get(k);
      if (list) list.push(o);
      else m.set(k, [o]);
    };
    (orders || []).forEach((o: any, idx: number) => {
      const po = { idx, total: Number(o.total) || 0, created_at: o.created_at };
      push(byUser, o.user_id || '', po);
      push(byEmail, normEmail(o.email), po);
      push(byPhone, normPhone(o.phone), po);
    });

    const now = Date.now();
    const aggregated: InsightCustomer[] = (rows || []).map((c: any) => {
      const seen = new Map<number, PaidOrder>();
      const add = (list?: PaidOrder[]) => list?.forEach((o) => seen.set(o.idx, o));
      if (c.user_id) add(byUser.get(c.user_id));
      add(byEmail.get(normEmail(c.email)));
      add(byEmail.get(normEmail(c.secondary_email)));
      add(byPhone.get(normPhone(c.phone)));
      add(byPhone.get(normPhone(c.secondary_phone)));
      const userOrders = Array.from(seen.values());

      const totalSpent = userOrders.reduce((sum, o) => sum + o.total, 0);
      const orderCount = userOrders.length;
      const lastOrderDate = userOrders.reduce<string | null>(
        (latest, o) => (!latest || new Date(o.created_at) > new Date(latest) ? o.created_at : latest),
        null
      );
      const tags: string[] = Array.isArray(c.tags) ? c.tags : [];
      const isVipTagged = tags.some((t) => String(t).toLowerCase() === 'vip');

      const daysSinceJoin = c.created_at ? (now - new Date(c.created_at).getTime()) / DAY : Infinity;
      const daysSinceLastOrder = lastOrderDate ? (now - new Date(lastOrderDate).getTime()) / DAY : Infinity;

      let segment: InsightCustomer['segment'];
      if (isVipTagged || totalSpent > 1000) segment = 'vip';
      else if (orderCount > 0 && daysSinceLastOrder > 90) segment = 'at-risk';
      else if (orderCount > 1) segment = 'returning';
      else if (orderCount === 1 || daysSinceJoin < 30) segment = 'new';
      else segment = 'no-orders';

      let riskLevel: InsightCustomer['riskLevel'] = 'none';
      if (orderCount > 0) {
        riskLevel = 'low';
        if (daysSinceLastOrder > 60) riskLevel = 'medium';
        if (daysSinceLastOrder > 120) riskLevel = 'high';
      }

      const name =
        c.full_name ||
        [c.first_name, c.last_name].filter(Boolean).join(' ') ||
        'Unknown';

      return {
        id: c.id,
        name,
        email: c.email || '',
        phone: c.phone || '-',
        segment,
        totalSpent,
        orders: orderCount,
        avgOrderValue: orderCount > 0 ? totalSpent / orderCount : 0,
        joinDate: c.created_at || null,
        lastOrder: lastOrderDate,
        riskLevel,
        tags,
      };
    });

    setCustomers(aggregated);

    const buyers = aggregated.filter((c) => c.orders > 0);
    const totalCLV = buyers.reduce((sum, c) => sum + c.totalSpent, 0);
    setStats({
      vip: aggregated.filter(c => c.segment === 'vip').length,
      returning: aggregated.filter(c => c.segment === 'returning').length,
      new: aggregated.filter(c => c.segment === 'new').length,
      atRisk: aggregated.filter(c => c.segment === 'at-risk').length,
      noOrders: aggregated.filter(c => c.segment === 'no-orders').length,
      avgCLV: buyers.length > 0 ? totalCLV / buyers.length : 0
    });
    setLoading(false);
  };

  const exportList = () => {
    const header = ['Name', 'Email', 'Phone', 'Segment', 'Paid orders', 'Total spent', 'Avg order', 'Last order', 'Joined', 'Tags'];
    const rows = filteredCustomers.map((c) => [
      c.name,
      c.email,
      c.phone === '-' ? '' : c.phone,
      getSegmentLabel(c.segment),
      c.orders,
      c.totalSpent.toFixed(2),
      c.avgOrderValue.toFixed(2),
      c.lastOrder ? new Date(c.lastOrder).toISOString().slice(0, 10) : '',
      c.joinDate ? new Date(c.joinDate).toISOString().slice(0, 10) : '',
      c.tags.join('; '),
    ]);
    const csv = [header, ...rows].map((r) => r.map(csvCell).join(',')).join('\r\n');
    const blob = new Blob(['﻿' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `customer-insights-${selectedSegment}-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const filteredCustomers = customers.filter(customer => {
    const q = searchTerm.toLowerCase();
    const matchesSearch = customer.name.toLowerCase().includes(q) ||
      customer.email.toLowerCase().includes(q) ||
      customer.phone.toLowerCase().includes(q);
    const matchesSegment = selectedSegment === 'all' || customer.segment === selectedSegment;
    return matchesSearch && matchesSegment;
  });

  function getSegmentBadge(segment: string) {
    const badges: Record<string, string> = {
      vip: 'bg-purple-100 text-purple-700',
      returning: 'bg-blue-100 text-blue-700',
      new: 'bg-amber-100 text-amber-700',
      'at-risk': 'bg-red-100 text-red-700',
      'no-orders': 'bg-gray-100 text-gray-700'
    };
    return badges[segment] || 'bg-gray-100 text-gray-700';
  }

  function getSegmentLabel(segment: string) {
    const labels: Record<string, string> = {
      vip: 'VIP Customer',
      returning: 'Returning',
      new: 'New Customer',
      'at-risk': 'At Risk',
      'no-orders': 'No paid orders'
    };
    return labels[segment] || segment;
  }

  const getRiskBadge = (risk: string) => {
    const badges: Record<string, string> = {
      low: 'bg-blue-100 text-blue-700',
      medium: 'bg-amber-100 text-amber-700',
      high: 'bg-red-100 text-red-700'
    };
    return badges[risk] || 'bg-gray-100';
  };

  if (loading) return <div className="p-8 text-center text-gray-500">Loading Insights...</div>;
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

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Customer Insights</h1>
            <p className="text-gray-600 mt-1 md:mt-2 text-sm md:text-base">Deep dive into customer behavior and lifetime value</p>
          </div>
          <div className="flex flex-col sm:flex-row gap-3">
            <button
              onClick={exportList}
              disabled={filteredCustomers.length === 0}
              className="border-2 border-gray-300 hover:border-gray-400 text-gray-700 px-6 py-3 rounded-lg font-semibold transition-colors whitespace-nowrap flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <i className="ri-download-line mr-2"></i>
              Export List
            </button>
            <Link
              href="/admin"
              className="bg-gray-900 hover:bg-gray-800 text-white px-6 py-3 rounded-lg font-semibold transition-colors whitespace-nowrap text-center"
            >
              Back to Dashboard
            </Link>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
          <div className="bg-white rounded-xl shadow-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 flex items-center justify-center bg-blue-100 rounded-lg">
                <i className="ri-vip-crown-line text-2xl text-blue-700"></i>
              </div>
            </div>
            <p className="text-sm text-gray-600 mb-1">VIP Customers</p>
            <p className="text-3xl font-bold text-gray-900">{stats.vip}</p>
            <p className="text-sm text-blue-700 font-semibold mt-2">Spent &gt; GH₵1,000</p>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 flex items-center justify-center bg-blue-100 rounded-lg">
                <i className="ri-refresh-line text-2xl text-blue-700"></i>
              </div>
            </div>
            <p className="text-sm text-gray-600 mb-1">Returning Customers</p>
            <p className="text-3xl font-bold text-gray-900">{stats.returning}</p>
            <p className="text-sm text-blue-700 font-semibold mt-2">More than 1 order</p>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 flex items-center justify-center bg-red-100 rounded-lg">
                <i className="ri-alert-line text-2xl text-red-700"></i>
              </div>
            </div>
            <p className="text-sm text-gray-600 mb-1">At Risk</p>
            <p className="text-3xl font-bold text-gray-900">{stats.atRisk}</p>
            <p className="text-sm text-red-700 font-semibold mt-2">Inactive &gt; 90 days</p>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 flex items-center justify-center bg-purple-100 rounded-lg">
                <i className="ri-line-chart-line text-2xl text-purple-700"></i>
              </div>
            </div>
            <p className="text-sm text-gray-600 mb-1">Avg. Lifetime Value</p>
            <p className="text-3xl font-bold text-gray-900">{formatCurrency(stats.avgCLV)}</p>
            <p className="text-sm text-gray-500 mt-2">Per paying customer</p>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between space-y-4 md:space-y-0">
            <div className="flex-1 max-w-md">
              <div className="relative">
                <i className="ri-search-line absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 text-xl"></i>
                <input
                  type="text"
                  placeholder="Search customers by name or email..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full pl-12 pr-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                />
              </div>
            </div>

            <div className="flex flex-wrap gap-2 bg-gray-100 rounded-lg p-1">
              {[
                { value: 'all', label: 'All', count: customers.length },
                { value: 'vip', label: 'VIP', count: stats.vip },
                { value: 'returning', label: 'Returning', count: stats.returning },
                { value: 'new', label: 'New', count: stats.new },
                { value: 'at-risk', label: 'At Risk', count: stats.atRisk },
                { value: 'no-orders', label: 'No orders', count: stats.noOrders }
              ].map((segment) => (
                <button
                  key={segment.value}
                  onClick={() => setSelectedSegment(segment.value)}
                  className={`px-3 py-2 rounded-md font-medium text-sm transition-colors whitespace-nowrap flex-grow sm:flex-grow-0 ${selectedSegment === segment.value
                    ? 'bg-white text-gray-900 shadow-sm'
                    : 'text-gray-600 hover:text-gray-900'
                    }`}
                >
                  {segment.label} ({segment.count})
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 gap-6">
          {filteredCustomers.length === 0 ? (
            <div className="text-center py-12 bg-white rounded-xl">
              <p className="text-gray-500">No customers found matching this criteria.</p>
            </div>
          ) : (
            filteredCustomers.map((customer) => (
              <div key={customer.id} className="bg-white rounded-xl shadow-sm p-6 hover:shadow-md transition-shadow">
                <div className="flex items-start justify-between mb-4">
                  <div className="flex items-start space-x-4">
                    <div className="w-16 h-16 flex items-center justify-center bg-gradient-to-br from-blue-500 to-blue-700 rounded-full text-white text-2xl font-bold">
                      {customer.name?.charAt(0).toUpperCase() || 'U'}
                    </div>
                    <div>
                      <h3 className="text-xl font-bold text-gray-900">
                        <Link href={`/admin/customers/${customer.id}`} className="hover:text-blue-700">{customer.name}</Link>
                      </h3>
                      <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1 text-sm text-gray-600">
                        <span className="flex items-center">
                          <i className="ri-mail-line mr-1"></i>
                          {customer.email}
                        </span>
                        <span className="flex items-center">
                          <i className="ri-phone-line mr-1"></i>
                          {customer.phone}
                        </span>
                      </div>
                      <div className="flex items-center space-x-2 mt-3">
                        <span className={`px-3 py-1 rounded-full text-sm font-medium ${getSegmentBadge(customer.segment)} whitespace-nowrap`}>
                          {getSegmentLabel(customer.segment)}
                        </span>
                        {customer.riskLevel !== 'none' && (
                          <span className={`px-3 py-1 rounded-full text-sm font-medium ${getRiskBadge(customer.riskLevel)} whitespace-nowrap`}>
                            {customer.riskLevel === 'low' && 'Low Risk'}
                            {customer.riskLevel === 'medium' && 'Medium Risk'}
                            {customer.riskLevel === 'high' && 'High Risk'}
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-4">
                  <div className="bg-gray-50 rounded-lg p-4">
                    <p className="text-sm text-gray-600 mb-1">Total Spent (paid)</p>
                    <p className="text-2xl font-bold text-gray-900">{formatCurrency(customer.totalSpent)}</p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-4">
                    <p className="text-sm text-gray-600 mb-1">Paid Orders</p>
                    <p className="text-2xl font-bold text-gray-900">{customer.orders}</p>
                  </div>
                  <div className="bg-gray-50 rounded-lg p-4">
                    <p className="text-sm text-gray-600 mb-1">Avg. Order</p>
                    <p className="text-2xl font-bold text-gray-900">{formatCurrency(customer.avgOrderValue)}</p>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-4 border-t border-gray-200">
                  <div className="flex items-center space-x-6 text-sm text-gray-600">
                    <span>
                      <span className="font-medium">Joined:</span> {customer.joinDate ? new Date(customer.joinDate).toLocaleDateString('en-GB') : '-'}
                    </span>
                    <span>
                      <span className="font-medium">Last Order:</span> {customer.lastOrder ? new Date(customer.lastOrder).toLocaleDateString('en-GB') : 'Never'}
                    </span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>
    </div>
  );
}
