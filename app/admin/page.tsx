'use client';
import { money } from '@/lib/format-money';

import Link from 'next/link';
import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer } from 'recharts';

type StatCard = { title: string; value: string; note?: string; icon: string; tone: 'blue' | 'purple' | 'amber' };

const TONE_CLASSES: Record<StatCard['tone'], string> = {
  blue: 'bg-blue-100 text-blue-700',
  purple: 'bg-purple-100 text-purple-700',
  amber: 'bg-amber-100 text-amber-700',
};

const lowStockThreshold = (p: any) => {
  const t = Number(p?.metadata?.low_stock_threshold);
  return Number.isFinite(t) && p?.metadata?.low_stock_threshold != null ? t : 5;
};

/** Local YYYY-MM-DD, so a late-evening order lands on the right day. */
const dayKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

export default function AdminDashboard() {
  const [dateRange, setDateRange] = useState<'7days' | '30days'>('7days');
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');

  const [stats, setStats] = useState<StatCard[]>([]);
  const [paidOrders, setPaidOrders] = useState<{ total: number; created_at: string }[]>([]);
  const [recentOrders, setRecentOrders] = useState<any[]>([]);
  const [lowStockProducts, setLowStockProducts] = useState<any[]>([]);
  const [topProducts, setTopProducts] = useState<any[]>([]);

  useEffect(() => {
    async function fetchDashboardData() {
      setLoadError('');
      const [ordersRes, customersRes, recentRes, stockRes, productsRes] = await Promise.all([
        supabase.from('orders').select('total, payment_status, created_at'),
        supabase.from('customers').select('id', { count: 'exact', head: true }),
        supabase
          .from('orders')
          .select('id, order_number, email, created_at, total, status, shipping_address')
          .eq('payment_status', 'paid')
          .order('created_at', { ascending: false })
          .limit(5),
        supabase
          .from('products')
          .select('id, name, quantity, metadata')
          .eq('status', 'active')
          .eq('track_quantity', true)
          .order('quantity', { ascending: true })
          .limit(50),
        supabase
          .from('products')
          .select('id, name, quantity, product_images(url, position)')
          .order('created_at', { ascending: false })
          .limit(4),
      ]);

      if (ordersRes.error) {
        setLoadError(ordersRes.error.message || 'Could not load orders.');
        setLoading(false);
        return;
      }

      const allOrders = ordersRes.data || [];
      // Only PAID orders count toward revenue and average order value.
      const paid = allOrders
        .filter((o: any) => o.payment_status === 'paid')
        .map((o: any) => ({ total: Number(o.total) || 0, created_at: o.created_at as string }));
      const totalRevenue = paid.reduce((sum, o) => sum + o.total, 0);
      const avgOrderValue = paid.length > 0 ? totalRevenue / paid.length : 0;
      setPaidOrders(paid);

      setStats([
        { title: 'Total Revenue', value: `GH₵ ${money(totalRevenue)}`, note: 'Paid orders, all time', icon: 'ri-money-dollar-circle-line', tone: 'blue' },
        { title: 'Orders', value: allOrders.length.toString(), note: `${paid.length} paid`, icon: 'ri-shopping-bag-line', tone: 'blue' },
        {
          title: 'Customers',
          value: customersRes.error ? '-' : String(customersRes.count ?? 0),
          icon: 'ri-group-line',
          tone: 'purple',
        },
        { title: 'Avg Order Value', value: `GH₵ ${money(avgOrderValue)}`, note: 'Paid orders', icon: 'ri-line-chart-line', tone: 'amber' },
      ]);

      setRecentOrders(
        (recentRes.data || []).map((o: any) => {
          const addr = o.shipping_address || {};
          const email: string = o.email || '';
          const customerName = (addr.firstName && addr.lastName)
            ? `${String(addr.firstName).trim()} ${String(addr.lastName).trim()}`
            : addr.full_name || addr.firstName || email.split('@')[0] || 'Guest';
          return {
            id: o.id,
            displayId: o.order_number || o.id.slice(0, 8),
            customer: customerName,
            email,
            date: new Date(o.created_at).toLocaleDateString(),
            total: o.total,
            status: o.status || 'pending',
          };
        })
      );

      setLowStockProducts(
        (stockRes.data || [])
          .filter((p: any) => Number(p.quantity ?? 0) <= lowStockThreshold(p))
          .slice(0, 5)
          .map((p: any) => {
            const stock = Number(p.quantity ?? 0);
            return { id: p.id, name: p.name, stock, status: stock <= 0 ? 'critical' : 'low' };
          })
      );

      setTopProducts(
        (productsRes.data || []).map((p: any) => {
          const images = Array.isArray(p.product_images) ? [...p.product_images] : [];
          images.sort((a: any, b: any) => (a.position ?? 0) - (b.position ?? 0));
          return {
            id: p.id,
            name: p.name,
            image: images[0]?.url || '/house-of-elle-logo.png',
            stock: Number(p.quantity ?? 0),
          };
        })
      );

      setLoading(false);
    }

    fetchDashboardData();
  }, []);

  const chartData = useMemo(() => {
    const days = dateRange === '30days' ? 30 : 7;
    const buckets = new Map<string, number>();
    const labels: { key: string; date: string }[] = [];
    for (let i = days - 1; i >= 0; i--) {
      const d = new Date();
      d.setHours(0, 0, 0, 0);
      d.setDate(d.getDate() - i);
      const key = dayKey(d);
      buckets.set(key, 0);
      labels.push({ key, date: d.toLocaleDateString('en-US', { month: 'short', day: 'numeric' }) });
    }
    paidOrders.forEach((o) => {
      const key = dayKey(new Date(o.created_at));
      if (buckets.has(key)) buckets.set(key, (buckets.get(key) || 0) + o.total);
    });
    return labels.map(({ key, date }) => ({ date, revenue: buckets.get(key) || 0 }));
  }, [paidOrders, dateRange]);

  const statusColors: Record<string, string> = {
    'pending': 'bg-amber-100 text-amber-700',
    'processing': 'bg-blue-100 text-blue-700',
    'shipped': 'bg-purple-100 text-purple-700',
    'delivered': 'bg-blue-100 text-blue-700',
    'cancelled': 'bg-red-100 text-red-700',
    'awaiting_payment': 'bg-amber-100 text-amber-700',
    'refunded': 'bg-gray-100 text-gray-700'
  };

  if (loading) {
    return <div className="p-8 text-center text-gray-500">Loading Dashboard...</div>;
  }
  if (loadError) {
    return (
      <div className="p-8 text-center">
        <p className="text-red-600 mb-4">{loadError}</p>
        <button
          onClick={() => window.location.reload()}
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
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-3xl font-bold text-gray-900">Dashboard</h1>
            <p className="text-gray-600 mt-1">Welcome back! Here&apos;s what&apos;s happening with your store.</p>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6 mb-8">
          {stats.map((stat) => (
            <div key={stat.title} className="bg-white rounded-xl shadow-sm border border-gray-200 p-6 hover:shadow-md transition-shadow">
              <div className="flex items-center justify-between mb-4">
                <div className={`w-12 h-12 flex items-center justify-center rounded-lg ${TONE_CLASSES[stat.tone]}`}>
                  <i className={`${stat.icon} text-2xl`}></i>
                </div>
              </div>
              <h3 className="text-2xl font-bold text-gray-900 mb-1">{stat.value}</h3>
              <p className="text-gray-600 text-sm">{stat.title}</p>
              {stat.note && <p className="text-gray-400 text-xs mt-1">{stat.note}</p>}
            </div>
          ))}
        </div>

        {/* Revenue Chart & Quick Actions */}
        <div className="grid lg:grid-cols-3 gap-6 mb-8">
          <div className="lg:col-span-2 bg-white p-6 rounded-xl shadow-sm border border-gray-200">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-900">Revenue Trend</h2>
              <select
                className="bg-gray-50 border border-gray-200 text-gray-700 text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block p-2"
                value={dateRange}
                onChange={(e) => setDateRange(e.target.value as '7days' | '30days')}
              >
                <option value="7days">Last 7 Days</option>
                <option value="30days">Last 30 Days</option>
              </select>
            </div>
            <div className="h-80 w-full">
              <ResponsiveContainer width="100%" height="100%">
                <AreaChart data={chartData} margin={{ top: 10, right: 10, left: 0, bottom: 0 }}>
                  <defs>
                    <linearGradient id="colorRevenue" x1="0" y1="0" x2="0" y2="1">
                      <stop offset="5%" stopColor="#10b981" stopOpacity={0.1} />
                      <stop offset="95%" stopColor="#10b981" stopOpacity={0} />
                    </linearGradient>
                  </defs>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#f1f5f9" />
                  <XAxis dataKey="date" axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} dy={10} />
                  <YAxis axisLine={false} tickLine={false} tick={{ fontSize: 12, fill: '#64748b' }} tickFormatter={(value) => `GH₵${value}`} />
                  <Tooltip
                    contentStyle={{ backgroundColor: '#fff', borderRadius: '8px', border: '1px solid #e2e8f0', boxShadow: '0 4px 6px -1px rgb(0 0 0 / 0.1)' }}
                    formatter={(value) => [`GH₵${money(value as number)}`, 'Revenue']}
                  />
                  <Area type="monotone" dataKey="revenue" stroke="#10b981" strokeWidth={3} fillOpacity={1} fill="url(#colorRevenue)" />
                </AreaChart>
              </ResponsiveContainer>
            </div>
          </div>

          <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-200">
            <h2 className="text-xl font-bold text-gray-900 mb-4">Quick Actions</h2>
            <div className="space-y-3">
              <Link href="/admin/products/new" className="flex items-center justify-between p-4 bg-gray-50 hover:bg-blue-50 text-gray-700 hover:text-blue-700 rounded-lg transition-colors group">
                <div className="flex items-center font-medium">
                  <span className="w-8 h-8 rounded-full bg-white flex items-center justify-center mr-3 group-hover:bg-blue-100 transition-colors shadow-sm">
                    <i className="ri-add-line"></i>
                  </span>
                  Add Product
                </div>
                <i className="ri-arrow-right-line"></i>
              </Link>
              <Link href="/admin/pos" className="flex items-center justify-between p-4 bg-gray-50 hover:bg-blue-50 text-gray-700 hover:text-blue-700 rounded-lg transition-colors group">
                <div className="flex items-center font-medium">
                  <span className="w-8 h-8 rounded-full bg-white flex items-center justify-center mr-3 group-hover:bg-blue-100 transition-colors shadow-sm">
                    <i className="ri-computer-line"></i>
                  </span>
                  Open POS
                </div>
                <i className="ri-arrow-right-line"></i>
              </Link>
              <Link href="/admin/orders" className="flex items-center justify-between p-4 bg-gray-50 hover:bg-blue-50 text-gray-700 hover:text-blue-700 rounded-lg transition-colors group">
                <div className="flex items-center font-medium">
                  <span className="w-8 h-8 rounded-full bg-white flex items-center justify-center mr-3 group-hover:bg-blue-100 transition-colors shadow-sm">
                    <i className="ri-file-list-line"></i>
                  </span>
                  Manage Orders
                </div>
                <i className="ri-arrow-right-line"></i>
              </Link>
            </div>
          </div>
        </div>

        <div className="grid lg:grid-cols-3 gap-6 mb-8">
          <div className="lg:col-span-2 bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6 overflow-hidden">
            <div className="flex items-center justify-between mb-6">
              <h2 className="text-xl font-bold text-gray-900">Recent Orders</h2>
              <Link href="/admin/orders" className="text-blue-700 hover:text-blue-800 font-medium text-sm whitespace-nowrap cursor-pointer">
                View All <i className="ri-arrow-right-line ml-1"></i>
              </Link>
            </div>

            <div className="overflow-x-auto -mx-4 sm:mx-0 px-4 sm:px-0">
              {recentOrders.length === 0 ? (
                <p className="text-gray-500 text-center py-4">No recent orders.</p>
              ) : (
                <table className="w-full">
                  <thead className="bg-gray-50 border-b border-gray-200">
                    <tr>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Order ID</th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Customer</th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Date</th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Total</th>
                      <th className="text-left py-3 px-4 text-sm font-semibold text-gray-700">Status</th>
                    </tr>
                  </thead>
                  <tbody>
                    {recentOrders.map((order) => (
                      <tr key={order.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                        <td className="py-4 px-4">
                          <Link href={`/admin/orders/${order.id}`} className="text-blue-700 hover:text-blue-800 font-medium whitespace-nowrap cursor-pointer">
                            {order.displayId}
                          </Link>
                        </td>
                        <td className="py-4 px-4">
                          <p className="font-medium text-gray-900 whitespace-nowrap">{order.customer}</p>
                          <p className="text-sm text-gray-500">{order.email}</p>
                        </td>
                        <td className="py-4 px-4 text-gray-700 whitespace-nowrap">{order.date}</td>
                        <td className="py-4 px-4 font-semibold text-gray-900 whitespace-nowrap">GH₵ {money(order.total)}</td>
                        <td className="py-4 px-4">
                          <span className={`px-3 py-1 rounded-full text-xs font-semibold whitespace-nowrap ${statusColors[order.status] || 'bg-gray-100'}`}>
                            {order.status === 'shipped' ? 'Packaged' : (order.status.charAt(0).toUpperCase() + order.status.slice(1)).replace(/_/g, ' ')}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              )}
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-4">Low Stock Alert</h2>
              {lowStockProducts.length === 0 ? (
                <p className="text-gray-500">Inventory looks good!</p>
              ) : (
                <div className="space-y-3">
                  {lowStockProducts.map((product) => (
                    <Link key={product.id} href={`/admin/products/${product.id}`} className="flex items-center justify-between p-3 bg-gray-50 hover:bg-gray-100 rounded-lg">
                      <div className="flex-1">
                        <p className="font-medium text-gray-900 text-sm truncate pr-2">{product.name}</p>
                        <p className="text-xs text-gray-600 mt-1">Stock: {product.stock} units</p>
                      </div>
                      <span className={`px-2 py-1 rounded-full text-xs font-semibold whitespace-nowrap ${product.status === 'critical' ? 'bg-red-100 text-red-700' : 'bg-amber-100 text-amber-700'
                        }`}>
                        {product.status === 'critical' ? 'Out of stock' : 'Low'}
                      </span>
                    </Link>
                  ))}
                </div>
              )}
              <Link href="/admin/products?filter=low-stock" className="block text-center mt-4 text-blue-700 hover:text-blue-800 font-medium text-sm whitespace-nowrap cursor-pointer">
                View All Products <i className="ri-arrow-right-line ml-1"></i>
              </Link>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-4 sm:p-6 overflow-hidden">
          <div className="flex items-center justify-between mb-6">
            <h2 className="text-xl font-bold text-gray-900">Recently Added Products</h2>
            <Link href="/admin/products" className="text-blue-700 hover:text-blue-800 font-medium text-sm whitespace-nowrap cursor-pointer">
              View All <i className="ri-arrow-right-line ml-1"></i>
            </Link>
          </div>

          <div className="grid md:grid-cols-2 lg:grid-cols-4 gap-4">
            {topProducts.map((product) => (
              <div key={product.id} className="border border-gray-200 rounded-xl p-4 hover:shadow-md transition-shadow">
                <div className="aspect-square bg-gray-100 rounded-lg overflow-hidden mb-3">
                  <img src={product.image} alt={product.name} className="w-full h-full object-cover" />
                </div>
                <h3 className="font-semibold text-gray-900 mb-2 line-clamp-2">{product.name}</h3>
                <div className="mt-3 pt-3 border-t border-gray-200 flex items-center justify-between">
                  <span className="text-sm text-gray-600">Stock: {product.stock}</span>
                  <Link href={`/admin/products/${product.id}`} className="text-blue-700 hover:text-blue-800 text-sm font-medium whitespace-nowrap cursor-pointer">
                    Edit <i className="ri-arrow-right-line ml-1"></i>
                  </Link>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
