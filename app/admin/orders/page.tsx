'use client';
import { money } from '@/lib/format-money';

import Link from 'next/link';
import { useState, useEffect, useMemo } from 'react';
import { supabase } from '@/lib/supabase';
import ProductSalesStats from './ProductSalesStats';

interface Order {
  id: string;
  order_number: string;
  email: string;
  total: number;
  status: string;
  payment_status: string;
  payment_method: string;
  shipping_method: string;
  created_at: string;
  phone?: string;
  shipping_address?: any;
  metadata?: any;
  profiles?: {
    full_name: string;
    email: string;
  };
  order_items?: {
    quantity: number;
    product_name?: string;
  }[];
}

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

/** Orders that were paid at some point (including later refunds) count as confirmed. */
const CONFIRMED_PAYMENT = ['paid', 'refunded', 'partially_refunded'];
const isConfirmed = (o: { payment_status: string }) => CONFIRMED_PAYMENT.includes(o.payment_status);

interface OrderStats {
  label: string;
  count: number;
  status: string;
}

export default function AdminOrdersPage() {
  const [searchQuery, setSearchQuery] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [selectedOrders, setSelectedOrders] = useState<string[]>([]);
  const [showFilters, setShowFilters] = useState(false);
  const [sortBy, setSortBy] = useState('date');
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [orderViewTab, setOrderViewTab] = useState<'confirmed' | 'abandoned'>('confirmed');
  const [sendingPaymentLink, setSendingPaymentLink] = useState<string | null>(null);
  const [orderStats, setOrderStats] = useState<OrderStats[]>([
    { label: 'All Orders', count: 0, status: 'all' },
    { label: 'Pending', count: 0, status: 'pending' },
    { label: 'Processing', count: 0, status: 'processing' },
    { label: 'Packaged', count: 0, status: 'shipped' },
    { label: 'Delivered', count: 0, status: 'delivered' },
    { label: 'Cancelled', count: 0, status: 'cancelled' },
    { label: 'Refunded', count: 0, status: 'refunded' }
  ]);
  const [abandonedCount, setAbandonedCount] = useState(0);
  const [confirmedCount, setConfirmedCount] = useState(0);
  const [showProductStats, setShowProductStats] = useState(false);
  const [productFilter, setProductFilter] = useState('all');
  const [availableProducts, setAvailableProducts] = useState<string[]>([]);
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [paymentMethodFilter, setPaymentMethodFilter] = useState('all');
  const [shippingMethodFilter, setShippingMethodFilter] = useState('all');
  const [loadError, setLoadError] = useState('');
  const [bulkBusy, setBulkBusy] = useState(false);

  useEffect(() => {
    fetchOrders();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- run once on mount
  }, []);

  const fetchOrders = async () => {
    try {
      setLoading(true);
      setLoadError('');

      // Fetch orders with related data
      const { data: ordersData, error } = await supabase
        .from('orders')
        .select(`
          id,
          order_number,
          email,
          total,
          status,
          payment_status,
          payment_method,
          shipping_method,
          created_at,
          phone,
          shipping_address,
          metadata,
          order_items (
            quantity,
            product_name
          )
        `)
        .order('created_at', { ascending: false });

      if (error) throw error;

      setOrders((ordersData || []) as Order[]);

      // Extract unique product names for filter
      const productNames = new Set<string>();
      ordersData?.forEach(o => {
        o.order_items?.forEach((item: any) => {
          if (item.product_name) productNames.add(item.product_name);
        });
      });
      setAvailableProducts(Array.from(productNames).sort());

      // Separate confirmed (paid) from abandoned (pending payment)
      const confirmedOrders = ordersData?.filter(o => isConfirmed(o)) || [];
      const abandonedOrders = ordersData?.filter(o => !isConfirmed(o)) || [];
      
      setConfirmedCount(confirmedOrders.length);
      setAbandonedCount(abandonedOrders.length);

      // Calculate stats based on confirmed orders only
      const stats = [
        { label: 'All Orders', count: confirmedOrders.length, status: 'all' },
        { label: 'Pending', count: confirmedOrders.filter(o => o.status === 'pending').length, status: 'pending' },
        { label: 'Processing', count: confirmedOrders.filter(o => o.status === 'processing').length, status: 'processing' },
        { label: 'Packaged', count: confirmedOrders.filter(o => o.status === 'shipped').length, status: 'shipped' },
        { label: 'Delivered', count: confirmedOrders.filter(o => o.status === 'delivered').length, status: 'delivered' },
        { label: 'Cancelled', count: confirmedOrders.filter(o => o.status === 'cancelled').length, status: 'cancelled' },
        { label: 'Refunded', count: confirmedOrders.filter(o => o.status === 'refunded').length, status: 'refunded' }
      ];
      setOrderStats(stats);

    } catch (error: any) {
      console.error('Error fetching orders:', error);
      setLoadError(error?.message || 'Could not load orders.');
    } finally {
      setLoading(false);
    }
  };

  const statusColors: Record<string, string> = {
    'pending': 'bg-amber-100 text-amber-700 border-amber-200',
    'processing': 'bg-blue-100 text-blue-700 border-blue-200',
    'shipped': 'bg-purple-100 text-purple-700 border-purple-200',
    'delivered': 'bg-blue-100 text-blue-700 border-blue-200',
    'cancelled': 'bg-red-100 text-red-700 border-red-200',
    'awaiting_payment': 'bg-gray-100 text-gray-700 border-gray-200',
    'refunded': 'bg-gray-100 text-gray-700 border-gray-200'
  };

  const formatStatus = (status: string) => {
    if (status === 'shipped') return 'Packaged';
    return status ? (status.charAt(0).toUpperCase() + status.slice(1)).replace(/_/g, ' ') : 'Unknown';
  };

  const getCustomerName = (order: Order) => {
    // Try shipping address names first (most reliable — entered at checkout)
    if (order.shipping_address?.firstName || order.shipping_address?.lastName) {
      const first = order.shipping_address.firstName?.trim() || '';
      const last = order.shipping_address.lastName?.trim() || '';
      return `${first} ${last}`.trim();
    }
    if (order.shipping_address?.full_name) return order.shipping_address.full_name;
    // Try metadata names
    if (order.metadata?.first_name || order.metadata?.last_name) {
      const first = order.metadata.first_name?.trim() || '';
      const last = order.metadata.last_name?.trim() || '';
      return `${first} ${last}`.trim();
    }
    if (order.profiles?.full_name) return order.profiles.full_name;
    if (order.email) {
      const name = order.email.split('@')[0];
      return name.charAt(0).toUpperCase() + name.slice(1);
    }
    return 'Guest';
  };

  const getCustomerEmail = (order: Order) => {
    return order.email || order.profiles?.email || 'N/A';
  };

  const getCustomerAvatar = (order: Order) => {
    const name = getCustomerName(order);
    const parts = name.split(' ');
    if (parts.length >= 2) {
      return parts[0][0] + parts[1][0];
    }
    return name.substring(0, 2).toUpperCase();
  };

  const getItemCount = (order: Order) => {
    if (!order.order_items) return 0;
    return order.order_items.reduce((sum, item) => sum + (Number(item.quantity) || 0), 0);
  };

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  };

  const handleSelectAll = () => {
    if (selectedOrders.length === filteredOrders.length) {
      setSelectedOrders([]);
    } else {
      setSelectedOrders(filteredOrders.map(o => o.id));
    }
  };

  const handleSelectOrder = (orderId: string) => {
    if (selectedOrders.includes(orderId)) {
      setSelectedOrders(selectedOrders.filter(id => id !== orderId));
    } else {
      setSelectedOrders([...selectedOrders, orderId]);
    }
  };

  const csvHeader = ['Order ID', 'Customer', 'Email', 'Phone', 'Date', 'Items', 'Total', 'Status', 'Payment status', 'Payment method', 'Shipping method'];
  const csvRow = (o: Order) => [
    o.order_number || o.id,
    getCustomerName(o),
    getCustomerEmail(o),
    o.phone || o.shipping_address?.phone || '',
    new Date(o.created_at).toISOString(),
    getItemCount(o),
    money(o.total),
    formatStatus(o.status),
    o.payment_status,
    o.payment_method || '',
    o.shipping_method || '',
  ];

  const handleBulkAction = async (action: string, newStatus?: string) => {
    // Only act on selected rows that are still visible under the current filters.
    const visibleIds = new Set(filteredOrders.map(o => o.id));
    const targets = orders.filter(o => selectedOrders.includes(o.id) && visibleIds.has(o.id));
    if (targets.length === 0) return;

    if (newStatus) {
      const changing = targets.filter(o => o.status !== newStatus);
      if (changing.length === 0) {
        alert(`All selected orders are already ${formatStatus(newStatus)}.`);
        return;
      }
      if (!confirm(`Mark ${changing.length} order${changing.length > 1 ? 's' : ''} as ${formatStatus(newStatus)}? Customers will be notified.`)) return;

      setBulkBusy(true);
      const ids = changing.map(o => o.id);
      const { error } = await supabase
        .from('orders')
        .update({ status: newStatus, updated_at: new Date().toISOString() })
        .in('id', ids);

      if (error) {
        setBulkBusy(false);
        alert(`Failed to update orders: ${error.message}`);
        return;
      }

      const { data: { session } } = await supabase.auth.getSession();
      const authToken = session?.access_token;

      const { error: historyError } = await supabase.from('order_status_history').insert(
        ids.map(id => ({
          order_id: id,
          status: newStatus,
          notes: 'Bulk update from orders list',
          created_by: session?.user?.id ?? null,
        }))
      );

      changing.forEach(order => {
        fetch('/api/notifications', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            ...(authToken && { 'Authorization': `Bearer ${authToken}` })
          },
          body: JSON.stringify({
            type: 'order_updated',
            payload: { order: { ...order, status: newStatus }, status: newStatus }
          })
        }).catch(err => console.error('Notification error', err));
      });

      await fetchOrders();
      setSelectedOrders([]);
      setBulkBusy(false);
      alert(
        `${changing.length} order${changing.length > 1 ? 's' : ''} updated to ${formatStatus(newStatus)}` +
        (historyError ? ` (status history not saved: ${historyError.message})` : '')
      );
    } else if (action === 'Export') {
      downloadCsv(`selected-orders-${new Date().toISOString().slice(0, 10)}.csv`, csvHeader, targets.map(csvRow));
    }
  };

  const handleExportAll = () => {
    downloadCsv(`orders-${orderViewTab}-${new Date().toISOString().slice(0, 10)}.csv`, csvHeader, filteredOrders.map(csvRow));
  };

  const handlePrintInvoice = (orderId: string) => {
    window.open(`/admin/orders/${orderId}?print=true`, '_blank');
  };

  const handleResendPaymentLink = async (order: Order) => {
    setSendingPaymentLink(order.id);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const response = await fetch('/api/notifications', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(session?.access_token && { 'Authorization': `Bearer ${session.access_token}` })
        },
        body: JSON.stringify({
          type: 'payment_link',
          payload: order
        })
      });
      
      if (!response.ok) throw new Error('Failed to send');
      
      alert(`Payment link sent to ${order.phone || order.email}`);
    } catch (error) {
      console.error('Error sending payment link:', error);
      alert('Failed to send payment link');
    } finally {
      setSendingPaymentLink(null);
    }
  };

  const paymentMethods = useMemo(
    () => Array.from(new Set(orders.map(o => o.payment_method).filter(Boolean))).sort(),
    [orders]
  );
  const shippingMethods = useMemo(
    () => Array.from(new Set(orders.map(o => o.shipping_method).filter(Boolean))).sort(),
    [orders]
  );

  const q = searchQuery.trim().toLowerCase();
  const fromTime = dateFrom ? new Date(`${dateFrom}T00:00:00`).getTime() : null;
  const toTime = dateTo ? new Date(`${dateTo}T23:59:59.999`).getTime() : null;

  const filteredOrders = orders
    .filter(order => {
      const customerName = getCustomerName(order).toLowerCase();
      const customerEmail = getCustomerEmail(order).toLowerCase();
      const orderId = (order.order_number || order.id).toLowerCase();
      const phone = (order.phone || '').toLowerCase();

      // First filter by view tab (confirmed vs abandoned)
      const matchesViewTab = orderViewTab === 'confirmed' ? isConfirmed(order) : !isConfirmed(order);

      const matchesSearch = !q || orderId.includes(q) || customerName.includes(q) || customerEmail.includes(q) || phone.includes(q);
      const matchesStatus = statusFilter === 'all' || order.status === statusFilter;
      const matchesProduct = productFilter === 'all' ||
        order.order_items?.some((item) => item.product_name === productFilter);
      const created = new Date(order.created_at).getTime();
      const matchesDate = (fromTime == null || created >= fromTime) && (toTime == null || created <= toTime);
      const matchesPayment = paymentMethodFilter === 'all' || order.payment_method === paymentMethodFilter;
      const matchesShipping = shippingMethodFilter === 'all' || order.shipping_method === shippingMethodFilter;
      return matchesViewTab && matchesSearch && matchesStatus && matchesProduct && matchesDate && matchesPayment && matchesShipping;
    })
    .sort((a, b) => {
      switch (sortBy) {
        case 'total':
          return (Number(b.total) || 0) - (Number(a.total) || 0);
        case 'customer':
          return getCustomerName(a).localeCompare(getCustomerName(b));
        case 'status':
          return (a.status || '').localeCompare(b.status || '');
        default:
          return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
      }
    });

  const activeFilterCount =
    (dateFrom ? 1 : 0) + (dateTo ? 1 : 0) + (paymentMethodFilter !== 'all' ? 1 : 0) + (shippingMethodFilter !== 'all' ? 1 : 0);

  const switchTab = (tab: 'confirmed' | 'abandoned') => {
    setOrderViewTab(tab);
    setStatusFilter('all');
    setSelectedOrders([]);
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold text-gray-900">Orders</h1>
          <p className="text-gray-600 mt-1">Manage and track all customer orders</p>
        </div>
        <div className="flex items-center gap-3 w-full md:w-auto">
          <button
            onClick={() => setShowProductStats(true)}
            className="flex-1 md:flex-none bg-white border border-gray-300 hover:bg-gray-50 text-gray-700 px-6 py-3 rounded-lg font-semibold transition-colors whitespace-nowrap cursor-pointer shadow-sm flex items-center justify-center"
          >
            <i className="ri-bar-chart-groupped-line mr-2"></i>
            Stats
          </button>
          <button
            onClick={handleExportAll}
            className="flex-1 md:flex-none bg-blue-700 hover:bg-blue-800 text-white px-6 py-3 rounded-lg font-semibold transition-colors whitespace-nowrap cursor-pointer shadow-sm flex items-center justify-center"
          >
            <i className="ri-download-line mr-2"></i>
            Export
          </button>
        </div>
      </div>

      {/* View Tabs: Confirmed Orders vs Abandoned Carts */}
      <div className="flex border-b border-gray-200">
        <button
          onClick={() => switchTab('confirmed')}
          className={`px-6 py-3 font-semibold text-sm border-b-2 transition-colors cursor-pointer ${
            orderViewTab === 'confirmed'
              ? 'border-blue-700 text-blue-700'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <i className="ri-check-double-line mr-2"></i>
          Confirmed Orders ({confirmedCount})
        </button>
        <button
          onClick={() => switchTab('abandoned')}
          className={`px-6 py-3 font-semibold text-sm border-b-2 transition-colors cursor-pointer ${
            orderViewTab === 'abandoned'
              ? 'border-amber-600 text-amber-600'
              : 'border-transparent text-gray-500 hover:text-gray-700'
          }`}
        >
          <i className="ri-shopping-cart-2-line mr-2"></i>
          Abandoned Carts ({abandonedCount})
        </button>
      </div>

      {orderViewTab === 'confirmed' && (
      <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-7 gap-4">
        {orderStats.map((stat) => (
          <button
            key={stat.status}
            onClick={() => setStatusFilter(stat.status)}
            className={`p-4 rounded-xl border-2 transition-all text-left cursor-pointer ${statusFilter === stat.status
              ? 'border-blue-700 bg-blue-50'
              : 'border-gray-200 bg-white hover:border-gray-300'
              }`}
          >
            <p className="text-2xl font-bold text-gray-900">{stat.count}</p>
            <p className="text-sm text-gray-600 mt-1">{stat.label}</p>
          </button>
        ))}
      </div>
      )}

      {loadError && (
        <div className="rounded-lg border border-red-200 bg-red-50 p-4 text-sm text-red-700 flex items-center justify-between gap-4">
          <span>{loadError}</span>
          <button onClick={fetchOrders} className="font-semibold underline">Try again</button>
        </div>
      )}

      {/* Abandoned carts info banner */}
      {orderViewTab === 'abandoned' && abandonedCount > 0 && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg p-4">
          <div className="flex items-start space-x-3">
            <i className="ri-information-line text-xl text-amber-600 mt-0.5"></i>
            <div>
              <p className="text-sm font-semibold text-amber-800">Abandoned Carts</p>
              <p className="text-sm text-amber-700 mt-1">
                These orders were created but payment was not completed. You can resend payment links to customers.
              </p>
            </div>
          </div>
        </div>
      )}

      <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-6 border-b border-gray-200">
          <div className="flex flex-col md:flex-row md:items-center md:justify-between space-y-4 md:space-y-0">
            <div className="flex-1 max-w-md">
              <div className="relative">
                <i className="ri-search-line absolute left-4 top-1/2 -translate-y-1/2 text-gray-400 text-lg w-5 h-5 flex items-center justify-center"></i>
                <input
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search by order ID, customer name, or email..."
                  className="w-full pl-12 pr-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
                />
              </div>
            </div>

            <div className="flex items-center space-x-3">
              <button
                onClick={() => setShowFilters(!showFilters)}
                className="px-4 py-3 border-2 border-gray-300 text-gray-700 rounded-lg hover:border-gray-400 transition-colors font-medium whitespace-nowrap cursor-pointer"
              >
                <i className="ri-filter-line mr-2"></i>
                Filters{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}
              </button>
              <select
                value={productFilter}
                onChange={(e) => setProductFilter(e.target.value)}
                className="px-4 py-3 pr-8 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-medium cursor-pointer"
              >
                <option value="all">All Products</option>
                {availableProducts.map((name) => (
                  <option key={name} value={name}>{name}</option>
                ))}
              </select>
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value)}
                className="px-4 py-3 pr-8 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 font-medium cursor-pointer"
              >
                <option value="date">Sort by Date</option>
                <option value="total">Sort by Total</option>
                <option value="customer">Sort by Customer</option>
                <option value="status">Sort by Status</option>
              </select>
            </div>
          </div>

          {showFilters && (
            <div className="mt-4 p-4 bg-gray-50 rounded-lg grid md:grid-cols-4 gap-4">
              <div>
                <label htmlFor="orders-date-from" className="block text-sm font-semibold text-gray-700 mb-2">From</label>
                <input
                  id="orders-date-from"
                  type="date"
                  value={dateFrom}
                  max={dateTo || undefined}
                  onChange={(e) => setDateFrom(e.target.value)}
                  className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg text-sm"
                />
              </div>
              <div>
                <label htmlFor="orders-date-to" className="block text-sm font-semibold text-gray-700 mb-2">To</label>
                <input
                  id="orders-date-to"
                  type="date"
                  value={dateTo}
                  min={dateFrom || undefined}
                  onChange={(e) => setDateTo(e.target.value)}
                  className="w-full px-3 py-2 border-2 border-gray-300 rounded-lg text-sm"
                />
              </div>
              <div>
                <label htmlFor="orders-payment-method" className="block text-sm font-semibold text-gray-700 mb-2">Payment Method</label>
                <select
                  id="orders-payment-method"
                  value={paymentMethodFilter}
                  onChange={(e) => setPaymentMethodFilter(e.target.value)}
                  className="w-full px-3 py-2 pr-8 border-2 border-gray-300 rounded-lg text-sm cursor-pointer"
                >
                  <option value="all">All Methods</option>
                  {paymentMethods.map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>
              <div>
                <label htmlFor="orders-shipping-method" className="block text-sm font-semibold text-gray-700 mb-2">Shipping Method</label>
                <select
                  id="orders-shipping-method"
                  value={shippingMethodFilter}
                  onChange={(e) => setShippingMethodFilter(e.target.value)}
                  className="w-full px-3 py-2 pr-8 border-2 border-gray-300 rounded-lg text-sm cursor-pointer"
                >
                  <option value="all">All Methods</option>
                  {shippingMethods.map((m) => (
                    <option key={m} value={m}>{m}</option>
                  ))}
                </select>
              </div>
              {activeFilterCount > 0 && (
                <div className="md:col-span-4 flex justify-end">
                  <button
                    onClick={() => { setDateFrom(''); setDateTo(''); setPaymentMethodFilter('all'); setShippingMethodFilter('all'); }}
                    className="text-sm font-medium text-blue-700 hover:text-blue-800"
                  >
                    Clear filters
                  </button>
                </div>
              )}
            </div>
          )}
        </div>

        {selectedOrders.length > 0 && (
          <div className="p-4 bg-blue-50 border-b border-blue-200 flex items-center justify-between">
            <p className="text-blue-800 font-semibold">
              {selectedOrders.length} order{selectedOrders.length > 1 ? 's' : ''} selected
            </p>
            <div className="flex items-center space-x-2">
              <button
                onClick={() => handleBulkAction('Mark as Processing', 'processing')}
                disabled={bulkBusy}
                className="disabled:opacity-50 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-sm font-medium transition-colors whitespace-nowrap cursor-pointer"
              >
                Mark Processing
              </button>
              <button
                onClick={() => handleBulkAction('Mark as Packaged', 'shipped')}
                disabled={bulkBusy}
                className="disabled:opacity-50 px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-medium transition-colors whitespace-nowrap cursor-pointer"
              >
                Mark Packaged
              </button>
              <button
                onClick={() => handleBulkAction('Export')}
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
                    checked={selectedOrders.length === filteredOrders.length && filteredOrders.length > 0}
                    onChange={handleSelectAll}
                    className="w-4 h-4 text-blue-700 border-gray-300 rounded focus:ring-blue-500 cursor-pointer"
                  />
                </th>
                <th className="text-left py-4 px-4 text-sm font-semibold text-gray-700">Order ID</th>
                <th className="text-left py-4 px-4 text-sm font-semibold text-gray-700">Customer</th>
                <th className="text-left py-4 px-4 text-sm font-semibold text-gray-700">Date</th>
                <th className="text-left py-4 px-4 text-sm font-semibold text-gray-700">Items</th>
                <th className="text-left py-4 px-4 text-sm font-semibold text-gray-700">Total</th>
                <th className="text-left py-4 px-4 text-sm font-semibold text-gray-700">Payment</th>
                <th className="text-left py-4 px-4 text-sm font-semibold text-gray-700">Status</th>
                <th className="text-left py-4 px-4 text-sm font-semibold text-gray-700">Actions</th>
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-gray-500">
                    <i className="ri-loader-4-line animate-spin text-3xl text-blue-700"></i>
                    <p className="mt-2">Loading orders...</p>
                  </td>
                </tr>
              ) : filteredOrders.length === 0 ? (
                <tr>
                  <td colSpan={9} className="py-12 text-center text-gray-500">
                    <i className="ri-inbox-line text-4xl text-gray-300"></i>
                    <p className="mt-2">No orders found</p>
                    <p className="text-sm">Orders will appear here when customers place them</p>
                  </td>
                </tr>
              ) : (
                filteredOrders.map((order) => (
                  <tr key={order.id} className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
                    <td className="py-4 px-6">
                      <input
                        type="checkbox"
                        checked={selectedOrders.includes(order.id)}
                        onChange={() => handleSelectOrder(order.id)}
                        className="w-4 h-4 text-blue-700 border-gray-300 rounded focus:ring-blue-500 cursor-pointer"
                      />
                    </td>
                    <td className="py-4 px-4">
                      <Link href={`/admin/orders/${order.id}`} className="text-blue-700 hover:text-blue-800 font-semibold whitespace-nowrap cursor-pointer">
                        {order.order_number || order.id.substring(0, 8)}
                      </Link>
                    </td>
                    <td className="py-4 px-4">
                      <div className="flex items-center space-x-3">
                        <div className="w-10 h-10 flex items-center justify-center bg-gray-200 text-gray-700 rounded-full font-semibold text-sm">
                          {getCustomerAvatar(order)}
                        </div>
                        <div>
                          <p className="font-medium text-gray-900 whitespace-nowrap">{getCustomerName(order)}</p>
                          <p className="text-sm text-gray-500">{getCustomerEmail(order)}</p>
                        </div>
                      </div>
                    </td>
                    <td className="py-4 px-4 text-gray-700 text-sm whitespace-nowrap">{formatDate(order.created_at)}</td>
                    <td className="py-4 px-4 text-gray-700">{getItemCount(order)}</td>
                    <td className="py-4 px-4 font-semibold text-gray-900 whitespace-nowrap">GH₵ {money(order.total)}</td>
                    <td className="py-4 px-4 text-sm whitespace-nowrap">
                      <div className="flex flex-col">
                        <span className="text-gray-700">{order.payment_method || 'N/A'}</span>
                        {orderViewTab === 'abandoned' && (
                          <span className={`text-xs mt-1 ${order.payment_status === 'failed' ? 'text-red-600' : 'text-amber-600'}`}>
                            {order.payment_status === 'failed' ? 'Failed' : 'Pending'}
                          </span>
                        )}
                        {order.payment_status === 'refunded' || order.payment_status === 'partially_refunded' ? (
                          <span className="text-xs mt-1 text-gray-500">
                            {order.payment_status === 'refunded' ? 'Refunded' : 'Partly refunded'}
                          </span>
                        ) : null}
                      </div>
                    </td>
                    <td className="py-4 px-4">
                      <span className={`px-3 py-1 rounded-full text-xs font-semibold border whitespace-nowrap ${statusColors[order.status] || 'bg-gray-100 text-gray-700 border-gray-200'}`}>
                        {formatStatus(order.status)}
                      </span>
                    </td>
                    <td className="py-4 px-4">
                      <div className="flex items-center space-x-2">
                        <Link
                          href={`/admin/orders/${order.id}`}
                          className="w-8 h-8 flex items-center justify-center text-gray-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                          title="View Order"
                        >
                          <i className="ri-eye-line text-lg w-4 h-4 flex items-center justify-center"></i>
                        </Link>
                        {orderViewTab === 'abandoned' && order.payment_status !== 'paid' && (
                          <button
                            onClick={() => handleResendPaymentLink(order)}
                            disabled={sendingPaymentLink === order.id}
                            className="w-8 h-8 flex items-center justify-center text-amber-600 hover:text-amber-800 hover:bg-amber-50 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
                            title="Resend Payment Link"
                          >
                            {sendingPaymentLink === order.id ? (
                              <i className="ri-loader-4-line text-lg w-4 h-4 flex items-center justify-center animate-spin"></i>
                            ) : (
                              <i className="ri-send-plane-line text-lg w-4 h-4 flex items-center justify-center"></i>
                            )}
                          </button>
                        )}
                        <button
                          onClick={() => handlePrintInvoice(order.id)}
                          className="w-8 h-8 flex items-center justify-center text-gray-600 hover:text-blue-700 hover:bg-blue-50 rounded-lg transition-colors cursor-pointer"
                          title="Print Invoice"
                        >
                          <i className="ri-printer-line text-lg w-4 h-4 flex items-center justify-center"></i>
                        </button>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>

        {filteredOrders.length > 0 && (
          <div className="p-6 border-t border-gray-200 flex items-center justify-between">
            <p className="text-gray-600">Showing {filteredOrders.length} of {orders.length} orders</p>
          </div>
        )}
      </div>

      <ProductSalesStats isOpen={showProductStats} onClose={() => setShowProductStats(false)} />
    </div>
  );
}
