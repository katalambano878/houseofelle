'use client';
import { money } from '@/lib/format-money';

import Link from 'next/link';
import { useState, useEffect, useCallback, useRef } from 'react';
import { supabase } from '@/lib/supabase';
import { recordStaffAction } from '@/lib/staff-audit';
import FraudDetectionAlert from '@/components/FraudDetectionAlert';
import { deliveryLabel, orderSource } from '@/lib/delivery';

interface OrderDetailClientProps {
  orderId: string;
}

type RiskLevel = 'low' | 'medium' | 'high';

interface FraudAnalysis {
  riskLevel: RiskLevel;
  reasons: string[];
}

interface StatusHistoryEntry {
  id: string;
  status: string;
  notes: string | null;
  created_at: string;
}

const ORDER_SELECT = `
  *,
  order_items (
    id,
    product_id,
    variant_id,
    product_name,
    variant_name,
    sku,
    quantity,
    unit_price,
    total_price,
    metadata,
    products (
      product_images (url, position)
    )
  )
`;

const HIGH_VALUE_TOTAL = 5000;

/** Strip characters that would break a PostgREST or() filter list. */
const orValue = (v: string) => v.replace(/[,()"'\\]/g, '').trim();

const firstImage = (item: any): string | null => {
  const images = Array.isArray(item?.products?.product_images) ? [...item.products.product_images] : [];
  images.sort((a: any, b: any) => (a.position ?? 0) - (b.position ?? 0));
  return images[0]?.url || null;
};

/**
 * Simple, explainable risk checks from data the store already has.
 * Each reason says exactly what was found, so staff can judge it.
 */
async function analyseOrder(order: any): Promise<FraudAnalysis> {
  const reasons: string[] = [];
  let score = 0;

  const total = Number(order.total) || 0;
  if (total >= HIGH_VALUE_TOTAL) {
    reasons.push(`High order value (GH₵ ${money(total)})`);
    score += 1;
  }

  const ship = order.shipping_address || {};
  const bill = order.billing_address || {};
  const shipPhone = String(ship.phone || '').replace(/\D/g, '').slice(-9);
  const orderPhone = String(order.phone || '').replace(/\D/g, '').slice(-9);
  if (shipPhone && orderPhone && shipPhone !== orderPhone) {
    reasons.push('Shipping phone differs from the contact phone');
    score += 1;
  }
  const shipName = `${ship.firstName || ''} ${ship.lastName || ''}`.trim().toLowerCase() || String(ship.full_name || '').toLowerCase();
  const billName = `${bill.firstName || ''} ${bill.lastName || ''}`.trim().toLowerCase() || String(bill.full_name || '').toLowerCase();
  if (shipName && billName && shipName !== billName) {
    reasons.push('Billing name differs from shipping name');
    score += 1;
  }

  // Other orders from the same email or phone.
  const parts: string[] = [];
  if (order.email) {
    const v = orValue(order.email);
    if (v) parts.push(`email.eq.${v}`);
  }
  if (order.phone) {
    const v = orValue(order.phone);
    if (v) parts.push(`phone.eq.${v}`);
  }
  if (parts.length > 0) {
    const since = new Date(new Date(order.created_at).getTime() - 7 * 24 * 3600 * 1000).toISOString();
    const { data: related } = await supabase
      .from('orders')
      .select('id, created_at, payment_status')
      .or(parts.join(','))
      .gte('created_at', since)
      .neq('id', order.id);
    const others = related || [];
    const placed = new Date(order.created_at).getTime();
    const sameDay = others.filter((o: any) => Math.abs(new Date(o.created_at).getTime() - placed) <= 24 * 3600 * 1000).length;
    const failed = others.filter((o: any) => o.payment_status === 'failed').length;
    if (sameDay >= 3) {
      reasons.push(`${sameDay} other orders from this email or phone within 24 hours`);
      score += sameDay >= 5 ? 3 : 1;
    }
    if (failed >= 2) {
      reasons.push(`${failed} failed payments from this email or phone in the last 7 days`);
      score += failed >= 4 ? 2 : 1;
    }
  }

  const riskLevel: RiskLevel = score >= 3 ? 'high' : score >= 1 ? 'medium' : 'low';
  return { riskLevel, reasons };
}

export default function OrderDetailClient({ orderId }: OrderDetailClientProps) {
  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showStatusMenu, setShowStatusMenu] = useState(false);
  const [trackingNumber, setTrackingNumber] = useState('');
  const [adminNotes, setAdminNotes] = useState('');
  const [statusUpdating, setStatusUpdating] = useState(false);
  const [history, setHistory] = useState<StatusHistoryEntry[]>([]);
  const [fraudAnalysis, setFraudAnalysis] = useState<FraudAnalysis>({ riskLevel: 'low', reasons: [] });
  const autoPrinted = useRef(false);

  const handlePrint = () => {
    window.print();
  };

  // Inject print styles
  useEffect(() => {
    const styleId = 'order-print-styles';
    if (!document.getElementById(styleId)) {
      const style = document.createElement('style');
      style.id = styleId;
      style.textContent = '@media print { body * { visibility: hidden; } .print-section, .print-section * { visibility: visible; } .print-section { position: absolute; left: 0; top: 0; width: 100%; padding: 20px; } .no-print { display: none !important; } }';
      document.head.appendChild(style);
    }
    return () => {
      const el = document.getElementById(styleId);
      if (el) el.remove();
    };
  }, []);

  const fetchOrderDetails = useCallback(async () => {
    setLoading(true);
    setError(null);

    // The route param may be the order id or its order number.
    let { data, error: fetchError } = await supabase
      .from('orders')
      .select(ORDER_SELECT)
      .eq('id', orderId)
      .maybeSingle();

    if (!fetchError && !data) {
      const byNumber = await supabase
        .from('orders')
        .select(ORDER_SELECT)
        .eq('order_number', orderId)
        .maybeSingle();
      data = byNumber.data;
      fetchError = byNumber.error;
    }

    if (fetchError || !data) {
      setError(fetchError ? `Failed to load order details: ${fetchError.message}` : 'Order not found');
      setOrder(null);
      setLoading(false);
      return;
    }

    const loaded: any = data;
    setOrder(loaded);
    setTrackingNumber(loaded.metadata?.tracking_number || '');
    setAdminNotes(loaded.notes || '');

    const { data: historyRows } = await supabase
      .from('order_status_history')
      .select('id, status, notes, created_at')
      .eq('order_id', loaded.id)
      .order('created_at', { ascending: true });
    setHistory((historyRows || []) as StatusHistoryEntry[]);

    setLoading(false);

    analyseOrder(loaded)
      .then(setFraudAnalysis)
      .catch(() => setFraudAnalysis({ riskLevel: 'low', reasons: [] }));
  }, [orderId]);

  useEffect(() => {
    fetchOrderDetails();
  }, [fetchOrderDetails]);

  // "Print Invoice" on the orders list opens this page with ?print=true.
  useEffect(() => {
    if (loading || !order || autoPrinted.current) return;
    if (new URLSearchParams(window.location.search).get('print') !== 'true') return;
    autoPrinted.current = true;
    const t = setTimeout(() => window.print(), 300);
    return () => clearTimeout(t);
  }, [loading, order]);

  const customerNameOf = (o: any) => {
    const addr = o?.shipping_address || {};
    return (addr.firstName && addr.lastName)
      ? `${String(addr.firstName).trim()} ${String(addr.lastName).trim()}`
      : addr.full_name || addr.firstName || (o?.email && !String(o.email).toLowerCase().endsWith('.local') ? o.email.split('@')[0] : '') || 'Walk-in customer';
  };

  const handleUpdateStatus = async (newStatus?: string) => {
    if (!order) return;
    setStatusUpdating(true);
    const statusToUpdate = newStatus || order.status;
    const statusChanged = statusToUpdate !== order.status;
    const previousTracking = order.metadata?.tracking_number || '';
    const trackingChanged = trackingNumber !== previousTracking;
    const nextMetadata = { ...(order.metadata || {}), tracking_number: trackingNumber };

    const { error: updateError } = await supabase
      .from('orders')
      .update({
        status: statusToUpdate,
        notes: adminNotes,
        metadata: nextMetadata,
        updated_at: new Date().toISOString(),
      })
      .eq('id', order.id);

    if (updateError) {
      setStatusUpdating(false);
      alert(`Failed to update order: ${updateError.message}`);
      return;
    }

    const { data: { session } } = await supabase.auth.getSession();
    const authToken = session?.access_token;

    let historyWarning = '';
    if (statusChanged) {
      const { data: inserted, error: historyError } = await supabase
        .from('order_status_history')
        .insert({
          order_id: order.id,
          status: statusToUpdate,
          notes: trackingChanged && trackingNumber ? `Tracking: ${trackingNumber}` : null,
          created_by: session?.user?.id ?? null,
        })
        .select('id, status, notes, created_at')
        .maybeSingle();
      if (historyError) historyWarning = ` (status history not saved: ${historyError.message})`;
      else if (inserted) setHistory((h) => [...h, inserted as StatusHistoryEntry]);
    }

    if (statusChanged || trackingChanged) {
      recordStaffAction({
        action: statusChanged ? 'status_change' : 'update',
        entityType: 'orders',
        entityId: order.id,
        details: {
          label: order.order_number || order.id,
          ...(statusChanged ? { from: order.status } : {}),
          changes: {
            ...(statusChanged ? { status: statusToUpdate } : {}),
            ...(trackingChanged ? { tracking_number: trackingNumber || 'removed' } : {}),
          },
        },
      });
    }

    setOrder({ ...order, status: statusToUpdate, notes: adminNotes, metadata: nextMetadata });

    // Email + SMS when the status changed or a tracking number was added/changed.
    if (statusChanged || (trackingChanged && trackingNumber)) {
      const addr = order.shipping_address || {};
      fetch('/api/notifications', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(authToken && { 'Authorization': `Bearer ${authToken}` })
        },
        body: JSON.stringify({
          type: 'order_status',
          payload: {
            email: order.email,
            name: customerNameOf(order),
            orderId: order.id,
            orderNumber: order.order_number || order.id,
            status: statusToUpdate,
            trackingNumber,
            phone: addr.phone || order.phone
          }
        })
      }).catch(err => console.error('Notification error:', err));
    }

    setStatusUpdating(false);
    setShowStatusMenu(false);
    alert(`Order updated successfully${historyWarning}`);
  };

  const handleCancelFromAlert = () => {
    if (!order || order.status === 'cancelled') return;
    if (!confirm(`Cancel order ${order.order_number || order.id}? The customer will be notified.`)) return;
    handleUpdateStatus('cancelled');
  };

  const [resendingNotification, setResendingNotification] = useState(false);
  const [checkingPayment, setCheckingPayment] = useState(false);

  /** Asks the order's gateway (Moolre or Zoe Pay) whether an unpaid order has been paid, and marks it paid if so. */
  const handleCheckPayment = async () => {
    if (!order?.order_number) return;
    const gatewayName = order.payment_method === 'zoepay' ? 'Zoe Pay' : 'Moolre';
    setCheckingPayment(true);
    try {
      const res = await fetch(order.payment_method === 'zoepay' ? '/api/payment/zoepay/verify' : '/api/payment/moolre/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderNumber: order.order_number }),
      });
      const result = await res.json().catch(() => ({}));
      if (result?.success) {
        await fetchOrderDetails();
        alert(result.message === 'Order already paid' ? 'This order is already paid.' : `Payment confirmed by ${gatewayName}. The order is now marked paid.`);
      } else {
        alert(result?.message || `${gatewayName} has not confirmed a payment for this order yet.`);
      }
    } catch (err: any) {
      alert(`Could not check the payment: ${err?.message || 'network error'}`);
    } finally {
      setCheckingPayment(false);
    }
  };

  const handleResendNotification = async () => {
    if (!order) return;

    try {
      setResendingNotification(true);

      // Get auth token
      const { data: { session } } = await supabase.auth.getSession();
      const authToken = session?.access_token;

      const shippingAddress = order.shipping_address || {};
      const customerName = customerNameOf(order);

      const response = await fetch('/api/notifications', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(authToken && { 'Authorization': `Bearer ${authToken}` })
        },
        body: JSON.stringify({
          type: 'order_status',
          payload: {
            email: order.email,
            name: customerName,
            orderNumber: order.order_number || order.id,
            status: order.status,
            trackingNumber: order.metadata?.tracking_number || '',
            phone: order.phone || shippingAddress.phone
          }
        })
      });

      const result = await response.json();

      if (!response.ok) {
        throw new Error(result.error || 'Failed to send notification');
      }

      alert('Notification sent successfully! (Email + SMS if phone available)');
    } catch (err: any) {
      console.error('Error resending notification:', err);
      alert(`Failed to resend notification: ${err.message || 'Unknown error'}`);
    } finally {
      setResendingNotification(false);
    }
  };

  const statusOptions = ['pending', 'awaiting_payment', 'processing', 'shipped', 'delivered', 'cancelled', 'refunded'];
  const statusLabel = (s: string) => s === 'shipped' ? 'Packaged' : (s.charAt(0).toUpperCase() + s.slice(1)).replace(/_/g, ' ');
  const statusColors: Record<string, string> = {
    'pending': 'bg-amber-100 text-amber-700 border-amber-200',
    'processing': 'bg-blue-100 text-blue-700 border-blue-200',
    'shipped': 'bg-yellow-100 text-yellow-800 border-yellow-200',
    'delivered': 'bg-green-100 text-green-700 border-green-200',
    'cancelled': 'bg-red-100 text-red-700 border-red-200',
    'awaiting_payment': 'bg-gray-100 text-gray-700 border-gray-200',
    'refunded': 'bg-gray-100 text-gray-700 border-gray-200'
  };
  const paymentColors: Record<string, string> = {
    paid: 'bg-green-100 text-green-700',
    pending: 'bg-amber-100 text-amber-700',
    failed: 'bg-red-100 text-red-700',
    refunded: 'bg-gray-100 text-gray-700',
    partially_refunded: 'bg-gray-100 text-gray-700',
  };

  if (loading) return <div className="p-8 text-center text-gray-500">Loading order...</div>;
  if (error || !order) {
    return (
      <div className="p-8 text-center">
        <p className="text-red-600 mb-4">{error || 'Order not found'}</p>
        <Link href="/admin/orders" className="text-blue-700 hover:text-blue-800 font-medium">
          <i className="ri-arrow-left-line mr-1"></i>Back to orders
        </Link>
      </div>
    );
  }

  const currentStatus = order.status || 'pending';
  const shippingAddress = order.shipping_address || {};
  const customerName = customerNameOf(order);

  // Timeline: fixed milestones, dated from order_status_history when it has them.
  const reachedAt = (s: string) => history.find((h) => h.status === s)?.created_at;
  const fmt = (iso?: string) => (iso ? new Date(iso).toLocaleString() : '');
  const paymentVerifiedAt = order.metadata?.payment_verified_at as string | undefined;
  const timeline = [
    { status: 'Order Placed', date: fmt(order.created_at), completed: true },
    {
      status: 'Payment',
      date: order.payment_status === 'paid' ? fmt(paymentVerifiedAt) || 'Paid' : (order.payment_status || 'pending').replace(/_/g, ' '),
      completed: order.payment_status === 'paid'
    },
    { status: 'Processing', date: fmt(reachedAt('processing')), completed: ['processing', 'shipped', 'delivered'].includes(order.status) },
    { status: 'Packaged', date: fmt(reachedAt('shipped')), completed: ['shipped', 'delivered'].includes(order.status) },
    { status: 'Delivered', date: fmt(reachedAt('delivered')), completed: order.status === 'delivered' }
  ];
  if (order.status === 'cancelled' || order.status === 'refunded') {
    timeline.push({
      status: order.status === 'cancelled' ? 'Cancelled' : 'Refunded',
      date: fmt(reachedAt(order.status)) || order.cancel_reason || '',
      completed: true
    });
  }

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Print styles injected via useEffect */}

      {/* Printable Order Slip */}
      <div className="print-section hidden print:block bg-white p-8">
        <div className="border-2 border-gray-800 p-6">
          {/* Header */}
          <div className="flex justify-between items-start border-b-2 border-gray-800 pb-4 mb-4">
            <div>
              <h1 className="text-2xl font-bold">House of Elle</h1>
              <p className="text-sm text-gray-600">Order Packing Slip</p>
            </div>
            <div className="text-right">
              <p className="font-bold text-lg">{order?.order_number}</p>
              <p className="text-sm">{order ? new Date(order.created_at).toLocaleDateString() : ''}</p>
            </div>
          </div>

          {/* Ship To */}
          <div className="mb-6">
            <h2 className="font-bold text-lg mb-2 bg-gray-200 px-2 py-1">SHIP TO:</h2>
            <div className="pl-2">
              <p className="font-bold text-lg">{customerName}</p>
              <p>{shippingAddress.phone || order?.phone}</p>
              <p>{shippingAddress.address || shippingAddress.address_line1}</p>
              <p>{shippingAddress.city}{(shippingAddress.region || shippingAddress.state) && `, ${shippingAddress.region || shippingAddress.state}`}</p>
            </div>
          </div>

          {/* Order Items */}
          <div className="mb-6">
            <h2 className="font-bold text-lg mb-2 bg-gray-200 px-2 py-1">ORDER ITEMS:</h2>
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-400">
                  <th className="text-left py-2 px-2">Product</th>
                  <th className="text-left py-2 px-2">Variant</th>
                  <th className="text-center py-2 px-2">Qty</th>
                  <th className="text-right py-2 px-2">Price</th>
                </tr>
              </thead>
              <tbody>
                {order?.order_items?.map((item: any) => (
                  <tr key={item.id} className="border-b border-gray-200">
                    <td className="py-2 px-2 font-medium">{item.product_name}</td>
                    <td className="py-2 px-2 text-sm">{item.variant_name || '-'}</td>
                    <td className="py-2 px-2 text-center font-bold">{item.quantity}</td>
                    <td className="py-2 px-2 text-right">GH₵ {money(item.unit_price)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {/* Order Summary */}
          <div className="flex justify-between mb-6">
            <div>
              <p><span className="font-semibold">Delivery:</span> {deliveryLabel(order?.shipping_method)}</p>
              <p><span className="font-semibold">Source:</span> {orderSource(order) === 'pos' ? 'POS (in store)' : 'Website'}</p>
              <p><span className="font-semibold">Payment:</span> {order?.payment_method} ({order?.payment_status})</p>
              {trackingNumber && <p><span className="font-semibold">Tracking #:</span> {trackingNumber}</p>}
            </div>
            <div className="text-right">
              <p>Subtotal: GH₵ {money(order?.subtotal)}</p>
              {Number(order?.discount_total) > 0 && <p>Discount: -GH₵ {money(order?.discount_total)}</p>}
              <p>Delivery: GH₵ {money(order?.shipping_total)}</p>
              <p className="font-bold text-lg border-t border-gray-400 pt-1 mt-1">Total: GH₵ {money(order?.total)}</p>
            </div>
          </div>

          {/* Footer */}
          <div className="border-t-2 border-gray-800 pt-4 text-center text-sm text-gray-600">
            <p>Thank you for shopping with House of Elle!</p>
            <p>Questions? Call 0570551050 or WhatsApp 0570551050 · support@houseofelle.com</p>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto p-6 no-print">
        {/* Page Header with Print Button */}
        <div className="flex flex-wrap items-center justify-between gap-4 mb-6">
          <div className="flex items-center space-x-4 min-w-0">
            <Link href="/admin/orders" aria-label="Back to orders" className="text-gray-600 hover:text-gray-900">
              <i className="ri-arrow-left-line text-2xl"></i>
            </Link>
            <div className="min-w-0">
              <h1 className="text-xl sm:text-2xl font-bold text-gray-900 break-all">{order?.order_number}</h1>
              <p className="text-sm text-gray-600">Order placed on {order ? new Date(order.created_at).toLocaleDateString() : ''}</p>
            </div>
          </div>
          <button
            onClick={handlePrint}
            className="flex items-center space-x-2 bg-gray-800 hover:bg-gray-900 text-white px-4 py-2 rounded-lg font-medium transition-colors"
          >
            <i className="ri-printer-line text-lg"></i>
            <span>Print Order</span>
          </button>
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="lg:col-span-2 space-y-6">
            {fraudAnalysis.riskLevel !== 'low' && (
              <FraudDetectionAlert
                riskLevel={fraudAnalysis.riskLevel}
                reasons={fraudAnalysis.reasons}
                orderId={order.order_number || orderId}
                contactEmail={order.email}
                contactPhone={shippingAddress.phone || order.phone}
                onCancelOrder={order.status !== 'cancelled' ? handleCancelFromAlert : undefined}
                cancelling={statusUpdating}
              />
            )}

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <div className="flex items-center justify-between mb-6">
                <h2 className="text-xl font-bold text-gray-900">Order Items</h2>
                <span className="text-gray-600">{order.order_items?.length || 0} items</span>
              </div>

              <div className="space-y-4">
                {order.order_items?.map((item: any) => (
                  <div key={item.id} className="flex items-start space-x-4 p-4 bg-gray-50 rounded-lg">
                    <div className="w-20 h-20 bg-white rounded-lg overflow-hidden border border-gray-200 flex items-center justify-center relative">
                      {firstImage(item) ? (
                        <img
                          src={firstImage(item) as string}
                          alt={item.product_name}
                          className="w-full h-full object-cover"
                        />
                      ) : (
                        <i className="ri-image-line text-2xl text-gray-300"></i>
                      )}
                    </div>
                    <div className="flex-1">
                      <h3 className="font-semibold text-gray-900 mb-1">{item.product_name}</h3>
                      {item.variant_name && <p className="text-sm text-gray-600 mb-1">{item.variant_name}</p>}
                      {item.sku && <p className="text-xs text-gray-500">SKU: {item.sku}</p>}
                    </div>
                    <div className="text-right">
                      <p className="font-semibold text-gray-900 mb-1">GH₵ {money(item.unit_price)}</p>
                      <p className="text-sm text-gray-600">Qty: {item.quantity}</p>
                    </div>
                  </div>
                ))}
              </div>

              <div className="mt-6 pt-6 border-t border-gray-200 space-y-3">
                <div className="flex justify-between text-gray-700">
                  <span>Subtotal</span>
                  <span>GH₵ {money(order.subtotal)}</span>
                </div>
                <div className="flex justify-between text-gray-700">
                  <span>Delivery</span>
                  <span>GH₵ {money(order.shipping_total)}</span>
                </div>
                <div className="flex justify-between text-gray-700">
                  <span>Tax</span>
                  <span>GH₵ {money(order.tax_total)}</span>
                </div>
                {(Number(order.discount_total) > 0 || order.metadata?.coupon_code) && (
                  <div className="flex justify-between text-blue-700 font-semibold">
                    <span>Discount{order.metadata?.coupon_code ? ` (code ${order.metadata.coupon_code})` : ''}</span>
                    <span>-GH₵ {money(order.discount_total)}</span>
                  </div>
                )}
                <div className="flex justify-between text-xl font-bold text-gray-900 pt-3 border-t border-gray-200">
                  <span>Total</span>
                  <span>GH₵ {money(order.total)}</span>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h2 className="text-xl font-bold text-gray-900 mb-6">Order Timeline</h2>
              <div className="space-y-4">
                {timeline.map((event) => (
                  <div key={event.status} className="flex items-start space-x-4">
                    <div className={`w-10 h-10 flex items-center justify-center rounded-full border-2 ${event.completed ? 'bg-blue-700 border-blue-700' : 'bg-white border-gray-300'
                      }`}>
                      {event.completed ? (
                        <i className="ri-check-line text-white text-xl"></i>
                      ) : (
                        <span className="w-3 h-3 bg-gray-300 rounded-full"></span>
                      )}
                    </div>
                    <div className="flex-1 pb-6 border-b border-gray-200 last:border-0">
                      <p className={`font-semibold ${event.completed ? 'text-gray-900' : 'text-gray-500'}`}>
                        {event.status}
                      </p>
                      {event.date && (
                        <p className="text-sm text-gray-600 mt-1">{event.date}</p>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          </div>

          <div className="space-y-6">
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-bold text-gray-900 mb-4">Order Status</h2>
              <div className="relative">
                <button
                  onClick={() => setShowStatusMenu(!showStatusMenu)}
                  disabled={statusUpdating}
                  aria-haspopup="listbox"
                  aria-expanded={showStatusMenu}
                  aria-label={`Order status: ${statusLabel(currentStatus)}. Change status`}
                  className={`w-full px-4 py-3 rounded-lg border-2 font-semibold text-left flex items-center justify-between ${statusColors[currentStatus] || 'bg-gray-100'}`}
                >
                  <span>{statusLabel(currentStatus)}</span>
                  <i className="ri-arrow-down-s-line text-xl"></i>
                </button>
                {showStatusMenu && (
                  <div className="absolute top-full left-0 right-0 mt-2 bg-white border-2 border-gray-200 rounded-lg shadow-lg overflow-hidden z-10">
                    {statusOptions.map((status) => (
                      <button
                        key={status}
                        onClick={() => {
                          if (status === currentStatus) {
                            setShowStatusMenu(false);
                            return;
                          }
                          if (!confirm(`Change this order to ${statusLabel(status)}? The customer will get an email and SMS.`)) return;
                          handleUpdateStatus(status);
                        }}
                        className={`w-full px-4 py-3 text-left hover:bg-gray-50 transition-colors ${status === currentStatus ? 'bg-blue-50 font-semibold' : ''
                          }`}
                      >
                        {statusLabel(status)}
                      </button>
                    ))}
                  </div>
                )}
              </div>

              <div className="mt-4">
                <label htmlFor="order-tracking-number" className="block text-sm font-semibold text-gray-900 mb-2">
                  Tracking Number
                </label>
                <input
                  id="order-tracking-number"
                  type="text"
                  value={trackingNumber}
                  onChange={(e) => setTrackingNumber(e.target.value)}
                  className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                />
              </div>

              <button
                onClick={() => handleUpdateStatus()}
                disabled={statusUpdating}
                className="w-full mt-4 bg-blue-700 hover:bg-blue-800 text-white py-3 rounded-lg font-semibold transition-colors whitespace-nowrap disabled:opacity-50"
              >
                {statusUpdating ? 'Saving...' : 'Save Tracking Number'}
              </button>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-bold text-gray-900 mb-4">Customer</h2>
              <div className="flex items-start space-x-3 mb-4">
                <div className="w-12 h-12 flex items-center justify-center bg-blue-100 text-blue-700 rounded-full font-semibold uppercase">
                  {customerName.substring(0, 2)}
                </div>
                <div>
                  <p className="font-semibold text-gray-900">{customerName}</p>
                  <p className="text-sm text-gray-600 break-all">{order.email && !String(order.email).toLowerCase().endsWith('.local') ? order.email : 'No email'}</p>
                  <p className="text-sm text-gray-600">{shippingAddress.phone || order.phone}</p>
                </div>
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-bold text-gray-900 mb-4">Delivery</h2>
              <div className="flex flex-wrap items-center gap-2 mb-3">
                <span className="px-2 py-0.5 rounded-full text-xs font-semibold border bg-blue-50 text-blue-800 border-blue-200">
                  {orderSource(order) === 'pos' ? 'POS (in store)' : 'Website'}
                </span>
                <span className="text-sm font-semibold text-gray-900">{deliveryLabel(order.shipping_method)}</span>
              </div>
              {order.metadata?.sold_by_name && (
                <p className="text-sm text-gray-600 mb-3">Sold by {order.metadata.sold_by_name}</p>
              )}
              <div className="text-gray-700 space-y-1">
                {!(shippingAddress.address || shippingAddress.address_line1 || shippingAddress.city) && (
                  <p className="text-sm text-gray-500">No delivery address on this order.</p>
                )}
                {/* Support both old field names (address_line1) and new (address) */}
                <p>{shippingAddress.address || shippingAddress.address_line1}</p>
                {(shippingAddress.address_line2) && <p>{shippingAddress.address_line2}</p>}
                <p>
                  {shippingAddress.city}
                  {(shippingAddress.region || shippingAddress.state) && `, ${shippingAddress.region || shippingAddress.state}`}
                </p>
                {shippingAddress.postal_code && <p>{shippingAddress.postal_code}</p>}
                {shippingAddress.country && <p className="font-semibold">{shippingAddress.country}</p>}
              </div>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-bold text-gray-900 mb-4">Payment Info</h2>
              <div className="space-y-3">
                <div className="flex justify-between">
                  <span className="text-gray-600">Method</span>
                  <span className="font-semibold text-gray-900 capitalize">{order.payment_method}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-gray-600">Status</span>
                  <span className={`px-3 py-1 rounded-full text-sm font-semibold whitespace-nowrap capitalize ${paymentColors[order.payment_status] || 'bg-gray-100 text-gray-700'}`}>
                    {(order.payment_status || 'pending').replace(/_/g, ' ')}
                  </span>
                </div>
                <div className="flex justify-between">
                  {/* Transaction ID might be in metadata depending on callback */}
                  <span className="text-gray-600">Transaction</span>
                  <span className="text-sm text-gray-900 font-mono truncate max-w-[150px]" title={order.metadata?.moolre_reference || order.payment_transaction_id || ''}>
                    {order.metadata?.moolre_reference || order.payment_transaction_id || 'N/A'}
                  </span>
                </div>
              </div>
              {order.payment_status !== 'paid' && (order.payment_method === 'moolre' || order.payment_method === 'zoepay') && order.status !== 'cancelled' && /^ORD-\d+-\d+$/.test(order.order_number || '') && (
                <button
                  onClick={handleCheckPayment}
                  disabled={checkingPayment}
                  className="w-full mt-4 border-2 border-blue-700 text-blue-700 hover:bg-blue-50 py-2.5 rounded-lg font-semibold transition-colors disabled:opacity-50 flex items-center justify-center"
                >
                  <i className={`${checkingPayment ? 'ri-loader-4-line animate-spin' : 'ri-refresh-line'} mr-2`}></i>
                  {checkingPayment ? `Checking with ${order.payment_method === 'zoepay' ? 'Zoe Pay' : 'Moolre'}...` : order.payment_method === 'zoepay' ? 'Check Zoe Pay payment' : 'Check Mobile Money payment'}
                </button>
              )}
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-bold text-gray-900 mb-4">Notifications</h2>
              <p className="text-sm text-gray-600 mb-4">
                Resend email and SMS notifications to the customer about the current order status.
              </p>
              <button
                onClick={handleResendNotification}
                disabled={resendingNotification}
                className="w-full bg-blue-700 hover:bg-blue-800 text-white py-3 rounded-lg font-semibold transition-colors whitespace-nowrap disabled:opacity-50 flex items-center justify-center"
              >
                {resendingNotification ? (
                  <>
                    <i className="ri-loader-4-line animate-spin mr-2"></i>
                    Sending...
                  </>
                ) : (
                  <>
                    <i className="ri-notification-3-line mr-2"></i>
                    Resend Notifications
                  </>
                )}
              </button>
              <p className="text-xs text-gray-500 mt-2">
                Phone: {order.phone || shippingAddress.phone || 'Not provided'}
              </p>
            </div>

            <div className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
              <h2 className="text-lg font-bold text-gray-900 mb-4"><label htmlFor="order-admin-notes">Admin Notes</label></h2>
              <textarea
                id="order-admin-notes"
                value={adminNotes}
                onChange={(e) => setAdminNotes(e.target.value)}
                placeholder="Add internal notes about this order..."
                rows={4}
                maxLength={500}
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 resize-none"
              />
              <button
                onClick={() => handleUpdateStatus()}
                disabled={statusUpdating}
                className="w-full mt-3 bg-gray-700 hover:bg-gray-800 text-white py-2 rounded-lg font-medium transition-colors whitespace-nowrap disabled:opacity-50"
              >
                Save Note
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
