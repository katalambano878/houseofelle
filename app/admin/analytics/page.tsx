'use client';
import { money } from '@/lib/format-money';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { PieChart, Pie, AreaChart, Area, Cell, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';

/** CSV cell: always quoted, inner quotes doubled, formula-looking values defused. */
function csvCell(value: unknown): string {
  let v = value == null ? '' : String(value);
  if (/^[=+\-@\t\r]/.test(v)) v = `'${v}`;
  return `"${v.replace(/"/g, '""')}"`;
}

type SalesPoint = { date: string; day: string; sales: number; orders: number };
type NameValue = { name: string; value: number };
type TopProduct = { name: string; revenue: number; units: number };

const ID_CHUNK = 100;


export default function AnalyticsPage() {
  const [timeRange, setTimeRange] = useState('30days');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [itemsWarning, setItemsWarning] = useState('');

  const [salesData, setSalesData] = useState<SalesPoint[]>([]);
  const [categoryRevenue, setCategoryRevenue] = useState<NameValue[]>([]);
  const [topProducts, setTopProducts] = useState<TopProduct[]>([]);

  const [metrics, setMetrics] = useState({ revenue: 0, orders: 0, aov: 0 });

  const fetchAnalytics = useCallback(async () => {
    setLoading(true);
    setLoadError('');
    setItemsWarning('');

    // Start of the selected range, at local midnight.
    const now = new Date();
    const startDate = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    if (timeRange === '7days') startDate.setDate(startDate.getDate() - 6);
    if (timeRange === '30days') startDate.setDate(startDate.getDate() - 29);
    if (timeRange === '90days') startDate.setDate(startDate.getDate() - 89);
    if (timeRange === 'year') startDate.setMonth(0, 1);

    // Only paid, non-cancelled orders count as revenue.
    const { data: orders, error: orderError } = await supabase
      .from('orders')
      .select('id, created_at, total')
      .gte('created_at', startDate.toISOString())
      .eq('payment_status', 'paid')
      .neq('status', 'cancelled')
      .order('created_at');

    if (orderError) {
      setLoadError(orderError.message || 'Could not load orders.');
      setLoading(false);
      return;
    }

    const paid = orders || [];
    const totalRevenue = paid.reduce((sum, o: any) => sum + (Number(o.total) || 0), 0);
    const totalOrders = paid.length;
    setMetrics({
      revenue: totalRevenue,
      orders: totalOrders,
      aov: totalOrders > 0 ? totalRevenue / totalOrders : 0,
    });

    // Daily series, zero-filled. Keyed by local YYYY-MM-DD so years never collide.
    const keyOf = (dt: Date) =>
      `${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`;
    const salesMap = new Map<string, SalesPoint>();
    for (const d = new Date(startDate); d <= now; d.setDate(d.getDate() + 1)) {
      salesMap.set(keyOf(d), {
        day: keyOf(d),
        date: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }),
        sales: 0,
        orders: 0,
      });
    }
    paid.forEach((o: any) => {
      const point = salesMap.get(keyOf(new Date(o.created_at)));
      if (point) {
        point.sales += Number(o.total) || 0;
        point.orders += 1;
      }
    });
    setSalesData(Array.from(salesMap.values()));

    // Items for those orders, fetched in chunks to keep request URLs short.
    const items: any[] = [];
    const orderIds = paid.map((o: any) => o.id);
    for (let k = 0; k < orderIds.length; k += ID_CHUNK) {
      const { data: chunk, error: itemError } = await supabase
        .from('order_items')
        .select('quantity, unit_price, total_price, product_id, product_name, products(name, categories(name))')
        .in('order_id', orderIds.slice(k, k + ID_CHUNK));
      if (itemError) {
        setItemsWarning(itemError.message || 'Some order items could not be loaded.');
        break;
      }
      if (chunk) items.push(...chunk);
    }

    const itemRevenue = (item: any) =>
      Number(item.total_price) || (Number(item.unit_price) || 0) * (Number(item.quantity) || 0);

    const catMap = new Map<string, number>();
    const prodMap = new Map<string, TopProduct>();
    items.forEach((item) => {
      const product = Array.isArray(item.products) ? item.products[0] : item.products;
      const category = Array.isArray(product?.categories) ? product.categories[0] : product?.categories;
      const catName = category?.name || 'Uncategorized';
      const rev = itemRevenue(item);
      catMap.set(catName, (catMap.get(catName) || 0) + rev);

      // Keep sales of deleted products, which still carry product_name.
      const pName = product?.name || item.product_name || 'Unknown';
      const key = item.product_id || `name:${pName}`;
      const entry = prodMap.get(key) || { name: pName, revenue: 0, units: 0 };
      entry.revenue += rev;
      entry.units += Number(item.quantity) || 0;
      prodMap.set(key, entry);
    });
    setCategoryRevenue(
      Array.from(catMap, ([name, value]) => ({ name, value })).sort((a, b) => b.value - a.value)
    );
    setTopProducts(Array.from(prodMap.values()).sort((a, b) => b.revenue - a.revenue).slice(0, 5));

    setLoading(false);
  }, [timeRange]);

  useEffect(() => {
    fetchAnalytics();
  }, [fetchAnalytics]);

  const exportCsv = () => {
    const lines: unknown[][] = [
      ['Summary'],
      ['Range', timeRange],
      ['Revenue (GHS)', metrics.revenue.toFixed(2)],
      ['Paid orders', metrics.orders],
      ['Avg order value (GHS)', metrics.aov.toFixed(2)],
      [],
      ['Date', 'Sales (GHS)', 'Orders'],
      ...salesData.map((p) => [p.day, p.sales.toFixed(2), p.orders]),
      [],
      ['Category', 'Revenue (GHS)'],
      ...categoryRevenue.map((c) => [c.name, c.value.toFixed(2)]),
      [],
      ['Top product', 'Units', 'Revenue (GHS)'],
      ...topProducts.map((p) => [p.name, p.units, p.revenue.toFixed(2)]),
    ];
    const csv = lines.map((r) => r.map(csvCell).join(',')).join('\r\n');
    const blob = new Blob(['\uFEFF' + csv], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `analytics-${timeRange}-${new Date().toISOString().slice(0, 10)}.csv`;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  };

  const COLORS = ['#10b981', '#3b82f6', '#f59e0b', '#ef4444', '#8b5cf6'];

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="flex flex-col md:flex-row md:items-center justify-between gap-6 mb-8">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold text-gray-900">Advanced Analytics</h1>
            <p className="text-gray-600 mt-1 md:mt-2 text-sm md:text-base">Detailed insights and performance metrics</p>
          </div>
          <div className="flex flex-col sm:flex-row items-stretch sm:items-center gap-3">
            <select
              value={timeRange}
              onChange={(e) => setTimeRange(e.target.value)}
              className="px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-medium pr-8 cursor-pointer bg-white"
            >
              <option value="7days">Last 7 Days</option>
              <option value="30days">Last 30 Days</option>
              <option value="90days">Last 90 Days</option>
              <option value="year">This Year</option>
            </select>
            <button
              onClick={exportCsv}
              disabled={loading || !!loadError}
              className="bg-blue-700 hover:bg-blue-800 text-white px-6 py-3 rounded-lg font-semibold transition-colors whitespace-nowrap cursor-pointer flex items-center justify-center disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <i className="ri-download-line mr-2"></i>
              Export
            </button>
            <Link
              href="/admin"
              className="border-2 border-gray-300 hover:border-gray-400 text-gray-700 px-6 py-3 rounded-lg font-semibold transition-colors whitespace-nowrap text-center"
            >
              Back
            </Link>
          </div>
        </div>

        {loadError && (
          <div className="mb-6 rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 flex items-center justify-between gap-4">
            <span>{loadError}</span>
            <button onClick={fetchAnalytics} className="font-semibold underline">Try again</button>
          </div>
        )}
        {itemsWarning && !loadError && (
          <div className="mb-6 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
            Category and product breakdowns may be incomplete: {itemsWarning}
          </div>
        )}
        {loading && <p className="mb-4 text-sm text-gray-500">Loading analytics...</p>}

        {/* Metrics Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
          <div className="bg-white rounded-xl shadow-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 flex items-center justify-center bg-blue-100 rounded-lg">
                <i className="ri-money-dollar-circle-line text-2xl text-blue-700"></i>
              </div>
            </div>
            <p className="text-sm text-gray-600 mb-1">Total Revenue</p>
            <p className="text-3xl font-bold text-gray-900">GH₵{metrics.revenue.toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 2 })}</p>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 flex items-center justify-center bg-blue-100 rounded-lg">
                <i className="ri-shopping-cart-line text-2xl text-blue-700"></i>
              </div>
            </div>
            <p className="text-sm text-gray-600 mb-1">Paid Orders</p>
            <p className="text-3xl font-bold text-gray-900">{metrics.orders}</p>
          </div>

          <div className="bg-white rounded-xl shadow-sm p-6">
            <div className="flex items-center justify-between mb-4">
              <div className="w-12 h-12 flex items-center justify-center bg-purple-100 rounded-lg">
                <i className="ri-bar-chart-box-line text-2xl text-purple-700"></i>
              </div>
            </div>
            <p className="text-sm text-gray-600 mb-1">Avg. Order Value</p>
            <p className="text-3xl font-bold text-gray-900">GH₵{money(metrics.aov)}</p>
          </div>

        </div>

        {/* Charts */}
        <div className="bg-white rounded-xl shadow-sm p-6 mb-6">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-gray-900">Revenue & Performance Trends</h2>
          </div>
          <div style={{ width: '100%', height: 350 }}>
            <ResponsiveContainer>
              <AreaChart data={salesData.length > 0 ? salesData : [{ date: 'No Data', sales: 0 }]}>
                <defs>
                  <linearGradient id="colorSales" x1="0" y1="0" x2="0" y2="1">
                    <stop offset="5%" stopColor="#10b981" stopOpacity={0.3} />
                    <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                  </linearGradient>
                </defs>
                <CartesianGrid strokeDasharray="3 3" stroke="#f0f0f0" />
                <XAxis dataKey="date" stroke="#6b7280" />
                <YAxis stroke="#6b7280" />
                <Tooltip />
                <Legend />
                <Area type="monotone" dataKey="sales" stroke="#10b981" fillOpacity={1} fill="url(#colorSales)" name="Sales (GH₵)" />
              </AreaChart>
            </ResponsiveContainer>
          </div>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 mb-6">
          {/* Pie Chart */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-6">Revenue by Category</h2>
            <div className="flex items-center justify-center mb-6">
              <div style={{ width: '100%', height: 250 }}>
                <ResponsiveContainer>
                  <PieChart>
                    <Pie
                      data={categoryRevenue.length > 0 ? categoryRevenue : [{ name: 'No Data', value: 1 }]}
                      cx="50%"
                      cy="50%"
                      innerRadius={60}
                      outerRadius={80}
                      paddingAngle={5}
                      dataKey="value"
                    >
                      {categoryRevenue.map((entry, index) => (
                        <Cell key={`cell-${index}`} fill={COLORS[index % COLORS.length]} />
                      ))}
                    </Pie>
                    <Tooltip />
                    <Legend />
                  </PieChart>
                </ResponsiveContainer>
              </div>
            </div>
          </div>

          {/* Top Products */}
          <div className="bg-white rounded-xl shadow-sm p-6">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Top Performing Products</h2>
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead className="border-b border-gray-100">
                  <tr>
                    <th className="text-left pb-3 text-sm font-semibold text-gray-600">Product</th>
                    <th className="text-right pb-3 text-sm font-semibold text-gray-600">Units</th>
                    <th className="text-right pb-3 text-sm font-semibold text-gray-600">Revenue</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-100">
                  {topProducts.map((product, index) => (
                    <tr key={`${product.name}-${index}`}>
                      <td className="py-3 text-sm font-medium text-gray-900">{product.name}</td>
                      <td className="py-3 text-right text-sm text-gray-600">{product.units}</td>
                      <td className="py-3 text-right text-sm font-semibold text-blue-600">GH₵{money(product.revenue)}</td>
                    </tr>
                  ))}
                  {topProducts.length === 0 && <tr><td colSpan={3} className="text-center py-4 text-gray-500">No sales data yet.</td></tr>}
                </tbody>
              </table>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
