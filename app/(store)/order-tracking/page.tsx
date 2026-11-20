'use client';
import { money } from '@/lib/format-money';

import Link from 'next/link';
import { useState, useEffect, useCallback, Suspense } from 'react';
import { useSearchParams } from 'next/navigation';
import { deliveryLabel } from '@/lib/delivery';

function OrderTrackingContent() {
  const searchParams = useSearchParams();
  const urlOrderNumber = searchParams.get('order') || '';
  
  const [orderNumber, setOrderNumber] = useState(urlOrderNumber);
  const [email, setEmail] = useState('');
  const [isTracking, setIsTracking] = useState(false);
  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  // Auto-track if order number AND email are in the URL
  const urlEmail = searchParams.get('email') || '';

  const fetchOrder = useCallback(async (orderNum: string, verifyEmail?: string) => {
    const emailToVerify = verifyEmail || email;
    
    // SECURITY: Email is required for order tracking to prevent unauthorized access
    if (!emailToVerify) {
      setError('Please enter your email address to verify your identity.');
      return;
    }

    setLoading(true);
    setError('');

    try {
      // The lookup API only returns the order when the email matches it
      const res = await fetch('/api/orders/lookup', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ order: orderNum.trim(), email: emailToVerify.trim() }),
      });
      const json = await res.json().catch(() => ({}));
      const data = json?.order;

      if (!res.ok || !data) {
        setError(
          res.status === 429
            ? 'Too many attempts. Please wait a few minutes and try again.'
            : 'No order matches that order number and email. Check both and try again.'
        );
        setIsTracking(false);
        return;
      }

      setOrder(data);
      setIsTracking(true);
    } catch (err) {
      console.error('Error fetching order:', err);
      setError('Something went wrong. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [email]);

  useEffect(() => {
    if (urlOrderNumber && urlEmail) {
      setEmail(urlEmail);
      fetchOrder(urlOrderNumber, urlEmail);
    }
  }, [urlOrderNumber, urlEmail, fetchOrder]);

  const handleTrack = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');

    if (!orderNumber) {
      setError('Please enter your order number');
      return;
    }

    if (!email) {
      setError('Please enter your email address for verification');
      return;
    }

    fetchOrder(orderNumber, email);
  };

  // Build tracking timeline from real order data
  const getTrackingSteps = () => {
    if (!order) return [];

    const status = order.status || 'pending';
    const paymentStatus = order.payment_status || 'pending';

    const statusOrder = ['pending', 'processing', 'shipped', 'delivered'];
    const currentIndex = statusOrder.indexOf(status);

    const steps = [
      {
        key: 'placed',
        title: 'Order Placed',
        description: 'Your order has been confirmed',
        date: new Date(order.created_at).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' }),
        icon: 'ri-checkbox-circle-line',
        status: 'completed' as const
      },
      {
        key: 'payment',
        title: 'Payment',
        description: paymentStatus === 'paid' ? 'Payment confirmed' : 'Awaiting payment',
        date: paymentStatus === 'paid' 
          ? (order.metadata?.payment_verified_at 
            ? new Date(order.metadata.payment_verified_at).toLocaleString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', hour: '2-digit', minute: '2-digit' })
            : 'Confirmed')
          : 'Pending',
        icon: 'ri-bank-card-line',
        status: paymentStatus === 'paid' ? 'completed' as const : 'pending' as const
      },
      {
        key: 'processing',
        title: 'Processing',
        description: 'Your order is being prepared',
        date: currentIndex >= 1 ? 'In progress' : 'Pending',
        icon: 'ri-box-3-line',
        status: currentIndex >= 1 ? 'completed' as const : currentIndex === 0 && paymentStatus === 'paid' ? 'active' as const : 'pending' as const
      },
      {
        key: 'shipped',
        title: 'Packaged',
        description: 'Your order has been packaged',
        date: currentIndex >= 2 ? 'Packaged' : 'Pending',
        icon: 'ri-truck-line',
        status: currentIndex >= 2 ? 'completed' as const : currentIndex === 1 ? 'active' as const : 'pending' as const
      },
      {
        key: 'delivered',
        title: 'Delivered',
        description: 'Your order has been delivered',
        date: currentIndex >= 3 ? 'Delivered' : 'Pending',
        icon: 'ri-home-smile-line',
        status: currentIndex >= 3 ? 'completed' as const : currentIndex === 2 ? 'active' as const : 'pending' as const
      }
    ];

    return steps;
  };

  const getStatusBadge = () => {
    if (!order) return { label: 'Unknown', color: 'bg-[#F6EDE3]/15 text-[#F6EDE3]' };
    
    const statusMap: Record<string, { label: string; color: string }> = {
      'pending': { label: 'Pending', color: 'bg-[#E8C5BE] text-[#2B0B12]' },
      'processing': { label: 'Processing', color: 'bg-[#E8C5BE] text-[#2B0B12]' },
      'shipped': { label: 'Packaged', color: 'bg-[#D9A441] text-[#2B0B12]' },
      'delivered': { label: 'Delivered', color: 'bg-[#DDE7D6] text-[#244A2C]' },
      'cancelled': { label: 'Cancelled', color: 'bg-[#F6DCD7] text-[#7A1F2E]' }
    };

    return statusMap[order.status] || { label: order.status, color: 'bg-[#F6EDE3]/15 text-[#F6EDE3]' };
  };

  const field =
    'w-full h-[54px] px-[18px] rounded-[16px] bg-white text-[16px] text-[#1F1115] placeholder:text-[#8A7479] outline-none shadow-[inset_0_0_0_1px_rgba(31,17,21,0.16)] focus:shadow-[inset_0_0_0_1.5px_#2B0B12] transition-shadow motion-reduce:transition-none';

  // Search form
  if (!isTracking || !order) {
    return (
      <main className="min-h-screen bg-[#F1E8DC] text-[#1F1115]">
        <section className="max-w-[1280px] mx-auto px-5 sm:px-8 lg:px-12 pt-10 md:pt-16 pb-7 md:pb-10 flex flex-col gap-2.5">
          <h1 className="font-serif text-[40px] md:text-[56px] leading-[0.95] tracking-[-0.02em]">Track your <em>order</em></h1>
          <p className="text-[15px] leading-relaxed text-[#6B565B] max-w-[520px]">Enter your order number and the email you used at checkout. No account needed.</p>
        </section>

        <section className="max-w-[1280px] mx-auto px-5 sm:px-8 lg:px-12 pb-16 md:pb-24 grid md:grid-cols-[1.3fr_1fr] gap-4 items-start">
          <form onSubmit={handleTrack} noValidate className="flex flex-col gap-5 p-6 md:p-8 rounded-[24px] bg-[#FBF6EF] shadow-[inset_0_0_0_1px_rgba(31,17,21,0.1)]">
            <div className="flex flex-col gap-2">
              <label htmlFor="ot-order" className="text-[14px] font-semibold">Order number or tracking number</label>
              <input
                id="ot-order"
                type="text"
                autoComplete="off"
                value={orderNumber}
                onChange={(e) => setOrderNumber(e.target.value)}
                className={field}
                placeholder="e.g. ORD-1770328211911-915 or HOE-ABC123"
              />
            </div>

            <div className="flex flex-col gap-2">
              <label htmlFor="ot-email" className="text-[14px] font-semibold">Email</label>
              <input
                id="ot-email"
                type="email"
                autoComplete="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className={field}
                placeholder="you@example.com"
              />
            </div>

            {error && (
              <p role="alert" className="rounded-2xl bg-[#F6DCD7] text-[#7A1F2E] px-4 py-3 text-sm">{error}</p>
            )}

            <button
              type="submit"
              disabled={loading}
              className="min-h-[56px] rounded-full bg-[#2B0B12] text-[#F6EDE3] text-[16px] font-bold hover:bg-[#4A1520] transition-colors motion-reduce:transition-none disabled:opacity-50"
            >
              {loading ? (
                <span className="flex items-center justify-center gap-2">
                  <i className="ri-loader-4-line animate-spin motion-reduce:animate-none" aria-hidden="true"></i>
                  Searching…
                </span>
              ) : 'Track order'}
            </button>
          </form>

          <aside className="flex flex-col gap-3 p-6 md:p-8 rounded-[24px] bg-[#2B0B12] text-[#F6EDE3]">
            <span className="w-12 h-12 rounded-full bg-[#D9A441] text-[#2B0B12] inline-flex items-center justify-center">
              <i className="ri-message-3-line text-xl" aria-hidden="true"></i>
            </span>
            <h2 className="font-serif text-[26px] md:text-[28px] leading-none mt-2">Where is my number?</h2>
            <p className="text-[15px] leading-relaxed text-[#E3CFC7]">
              You can find your order number and tracking number in the SMS or email we sent you after your order was confirmed.
            </p>
            <Link href="/contact" className="self-start inline-flex items-center gap-2 min-h-[44px] mt-1 text-[14px] font-bold text-[#F6EDE3]">
              <span className="shadow-[inset_0_-1px_0_currentColor] pb-0.5">Can&apos;t find it? Contact us</span>
            </Link>
          </aside>
        </section>
      </main>
    );
  }

  // Order tracking results
  const trackingSteps = getTrackingSteps();
  const progressSteps = trackingSteps.filter((step) => step.key !== 'placed');
  const placedStep = trackingSteps.find((step) => step.key === 'placed');
  const statusBadge = getStatusBadge();
  const trackingNumber = order.metadata?.tracking_number || '';
  const shippingAddress = order.shipping_address || {};
  const itemCount = order.order_items?.length || 0;
  const thumbs: string[] = (order.order_items || [])
    .map((item: any) => item.products?.product_images?.[0]?.url || item.metadata?.image)
    .filter(Boolean)
    .slice(0, 3);

  return (
    <main className="min-h-screen bg-[#F1E8DC] text-[#1F1115]">
      <section className="max-w-[1280px] mx-auto px-5 sm:px-8 lg:px-12 pt-8 md:pt-12 pb-16 md:pb-24 flex flex-col gap-6 md:gap-8">
        <button
          type="button"
          onClick={() => { setIsTracking(false); setOrder(null); setOrderNumber(''); setEmail(''); }}
          className="self-start inline-flex items-center gap-2 min-h-[44px] text-[14px] font-semibold text-[#4D3A3F] hover:text-[#1F1115]"
        >
          <i className="ri-arrow-left-line" aria-hidden="true"></i>
          Track another order
        </button>

        <article className="flex flex-col gap-7 p-6 md:p-8 rounded-[24px] bg-[#2B0B12] text-[#F6EDE3]">
          <div className="flex flex-wrap items-start justify-between gap-5">
            <div className="flex flex-col gap-2 min-w-0">
              <span className={`self-start inline-flex items-center h-7 px-3 rounded-full text-[13px] font-semibold ${statusBadge.color}`}>
                {statusBadge.label}
              </span>
              <h1 className="font-serif text-[28px] md:text-[32px] leading-none break-all">{order.order_number}</h1>
              <span className="text-[14px] text-[#E3CFC7] tabular-nums">
                Placed {placedStep?.date} · {itemCount} item{itemCount !== 1 ? 's' : ''} · GH₵{money(order.total)}
              </span>
            </div>
            {thumbs.length > 0 && (
              <div className="flex gap-2" aria-hidden="true">
                {thumbs.map((src, i) => (
                  <span key={`${src}-${i}`} className="flex items-center justify-center w-[54px] h-16 rounded-[12px] bg-[#F6EDE3]">
                    <img src={src} alt="" className="w-[78%] h-[78%] object-contain mix-blend-multiply" />
                  </span>
                ))}
              </div>
            )}
          </div>

          <ol aria-label="Order progress" className="grid grid-cols-2 md:grid-cols-4 gap-y-5">
            {progressSteps.map((step, index) => {
              const done = step.status === 'completed';
              const active = step.status === 'active';
              const isLast = index === progressSteps.length - 1;
              return (
                <li key={step.key} className="flex flex-col gap-2.5" aria-current={active ? 'step' : undefined}>
                  <span className="flex items-center" aria-hidden="true">
                    <span
                      className={`w-3.5 h-3.5 flex-none rounded-full ${
                        done
                          ? 'bg-[#D9A441] shadow-[0_0_0_4px_rgba(217,164,65,0.25)]'
                          : active
                          ? 'bg-[#2B0B12] shadow-[inset_0_0_0_2px_#D9A441,0_0_0_4px_rgba(217,164,65,0.25)]'
                          : 'bg-[#F6EDE3]/30'
                      }`}
                    />
                    <span className={`flex-1 h-0.5 ml-2.5 ${isLast ? 'bg-transparent' : done ? 'bg-[#D9A441]' : 'bg-[#F6EDE3]/[0.18]'}`} />
                  </span>
                  <span className="flex flex-col gap-0.5 pr-3">
                    <span className={`text-[15px] font-bold ${step.status === 'pending' ? 'text-[#CDB5AD]' : ''}`}>
                      {step.title}
                      <span className="sr-only">: {done ? 'done' : active ? 'in progress' : 'not yet'}</span>
                    </span>
                    <span className="text-[13px] text-[#CDB5AD]">{step.description}</span>
                    <span className="text-[13px] text-[#E3CFC7] tabular-nums">{step.date}</span>
                  </span>
                </li>
              );
            })}
          </ol>

          <div className="flex flex-wrap gap-2.5">
            <Link
              href={`/contact?order=${encodeURIComponent(order.order_number || '')}`}
              className="inline-flex items-center min-h-[48px] px-[22px] rounded-full bg-[#D9A441] text-[#2B0B12] text-[14px] font-bold hover:bg-[#E5B65A] transition-colors motion-reduce:transition-none"
            >
              Ask about this order
            </Link>
            <Link
              href="/returns"
              className="inline-flex items-center min-h-[48px] px-[22px] rounded-full shadow-[inset_0_0_0_1px_rgba(246,237,227,0.35)] text-[14px] font-semibold hover:bg-[#F6EDE3]/10 transition-colors motion-reduce:transition-none"
            >
              Returns policy
            </Link>
          </div>
        </article>

        <dl className="grid grid-cols-2 md:grid-cols-4 gap-3">
          <div className="flex flex-col gap-1 p-5 rounded-[20px] bg-[#FBF6EF] shadow-[inset_0_0_0_1px_rgba(31,17,21,0.1)]">
            <dt className="text-[13px] text-[#6B565B]">Delivery method</dt>
            <dd className="text-[15px] font-semibold">{deliveryLabel(order.shipping_method)}</dd>
          </div>
          <div className="flex flex-col gap-1 p-5 rounded-[20px] bg-[#FBF6EF] shadow-[inset_0_0_0_1px_rgba(31,17,21,0.1)]">
            <dt className="text-[13px] text-[#6B565B]">Shipping to</dt>
            <dd className="text-[15px] font-semibold">{shippingAddress.city || shippingAddress.region || 'Ghana'}</dd>
          </div>
          <div className="flex flex-col gap-1 p-5 rounded-[20px] bg-[#FBF6EF] shadow-[inset_0_0_0_1px_rgba(31,17,21,0.1)]">
            <dt className="text-[13px] text-[#6B565B]">Total</dt>
            <dd className="text-[15px] font-semibold tabular-nums">GH₵{money(order.total)}</dd>
          </div>
          <div className="flex flex-col gap-1 p-5 rounded-[20px] bg-[#FBF6EF] shadow-[inset_0_0_0_1px_rgba(31,17,21,0.1)] min-w-0">
            <dt className="text-[13px] text-[#6B565B]">{trackingNumber ? 'Tracking number' : 'Items'}</dt>
            <dd className={`text-[15px] font-semibold ${trackingNumber ? 'font-mono break-all' : ''}`}>
              {trackingNumber || `${itemCount} product${itemCount !== 1 ? 's' : ''}`}
            </dd>
          </div>
        </dl>

        <section className="flex flex-col gap-4">
          <h2 className="font-serif text-[28px] md:text-[30px] leading-none">In this order</h2>
          <ul className="border-t border-[#1F1115]/[0.12]">
            {order.order_items?.map((item: any) => {
              const img = item.products?.product_images?.[0]?.url || item.metadata?.image;
              return (
                <li key={item.id} className="flex items-center gap-4 py-4 border-b border-[#1F1115]/[0.12]">
                  <span className="flex-none flex items-center justify-center w-16 h-20 rounded-[14px] bg-[#FBF6EF] shadow-[inset_0_0_0_1px_rgba(31,17,21,0.1)] overflow-hidden">
                    {img ? (
                      <img src={img} alt={item.product_name} className="w-[84%] h-[84%] object-contain mix-blend-multiply" />
                    ) : (
                      <i className="ri-image-line text-2xl text-[#CDB5AD]" aria-hidden="true"></i>
                    )}
                  </span>
                  <span className="flex-1 min-w-0 flex flex-col gap-0.5">
                    <span className="font-serif text-[18px] leading-tight">{item.product_name}</span>
                    {item.variant_name && <span className="text-[13px] text-[#6B565B]">{item.variant_name}</span>}
                    <span className="text-[13px] text-[#6B565B]">Quantity: {item.quantity}</span>
                  </span>
                  <span className="text-[15px] font-semibold tabular-nums">GH₵{money(item.unit_price)}</span>
                </li>
              );
            })}
          </ul>
        </section>
      </section>
    </main>
  );
}

export default function OrderTrackingPage() {
  return (
    <Suspense fallback={
      <main className="min-h-screen bg-[#F1E8DC] flex items-center justify-center" aria-busy="true">
        <div className="w-10 h-10 border-[3px] border-[#2B0B12] border-t-transparent rounded-full animate-spin motion-reduce:animate-none" aria-label="Loading"></div>
      </main>
    }>
      <OrderTrackingContent />
    </Suspense>
  );
}
