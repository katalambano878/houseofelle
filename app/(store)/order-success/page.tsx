'use client';
import { money } from '@/lib/format-money';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { Suspense, useState, useEffect } from 'react';
import { supabase } from '@/lib/supabase';
import { deliveryLabel } from '@/lib/delivery';

function OrderSuccessContent() {
  const searchParams = useSearchParams();
  const orderNumber = searchParams.get('order');
  const orderId = searchParams.get('id');
  const paymentSuccess = searchParams.get('payment_success');
  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [showConfetti, setShowConfetti] = useState(true);
  // Confetti layout is fixed once so re-renders don't reshuffle it.
  const [confetti] = useState(() =>
    Array.from({ length: 40 }, (_, i) => ({
      left: Math.random() * 100,
      top: Math.random() * 20,
      delay: Math.random() * 3,
      duration: 3 + Math.random() * 2,
      icon: ['ri-heart-fill text-[#E8C5BE]', 'ri-star-fill text-[#D9A441]', 'ri-gift-fill text-[#E5B65A]'][i % 3],
    }))
  );
  const [verifying, setVerifying] = useState(false);

  // Orders are loaded through the lookup API, which checks the order id from the payment redirect.
  const loadOrder = async (): Promise<any | null> => {
    const { data: { session } } = await supabase.auth.getSession();
    const headers: Record<string, string> = { 'Content-Type': 'application/json' };
    if (session?.access_token) headers.Authorization = `Bearer ${session.access_token}`;
    const res = await fetch('/api/orders/lookup', {
      method: 'POST',
      headers,
      body: JSON.stringify({ id: orderId, order: orderNumber }),
    });
    if (!res.ok) return null;
    const json = await res.json().catch(() => null);
    return json?.order ?? null;
  };

  useEffect(() => {
    async function fetchOrder() {
      if (!orderNumber && !orderId) {
        setLoading(false);
        return;
      }

      try {
        const orderData = await loadOrder();
        setOrder(orderData);

        // If redirected from payment and order is still pending, try to verify
        if (paymentSuccess === 'true' && orderData && orderData.payment_status !== 'paid') {
          verifyPayment(orderData.order_number, orderData.payment_method);
        }
      } catch (err) {
        console.error('Error fetching order:', err);
      } finally {
        setLoading(false);
      }
    }
    fetchOrder();
    // eslint-disable-next-line react-hooks/exhaustive-deps -- load once per order in the URL
  }, [orderNumber, orderId, paymentSuccess]);

  // Payment verification - called when the shopper returns from Moolre or Zoe Pay with payment_success=true
  const verifyPayment = async (orderNum: string, gateway?: string) => {
    setVerifying(true);

    // Wait 3 seconds to give the callback a chance to process first
    await new Promise(resolve => setTimeout(resolve, 3000));

    // Re-fetch order to check if callback already updated it
    const refreshed = await loadOrder();
    if (refreshed?.payment_status === 'paid') {
      setOrder(refreshed);
      setVerifying(false);
      return;
    }

    // Callback hasn't fired - verify via our endpoint (it asks the gateway directly)
    try {
      const res = await fetch(gateway === 'zoepay' ? '/api/payment/zoepay/verify' : '/api/payment/moolre/verify', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderNumber: orderNum })
      });

      const result = await res.json();

      if (result.success && result.payment_status === 'paid') {
        const updated = await loadOrder();
        if (updated) setOrder(updated);
      }
    } catch (err) {
      console.error('Payment verification failed:', err);
    } finally {
      setVerifying(false);
    }
  };

  if (loading) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-[#2B0B12] text-[#F6EDE3] px-5">
        <div className="text-center" role="status">
          <i className="ri-loader-4-line text-4xl text-[#D9A441] animate-spin motion-reduce:animate-none mb-4 block" aria-hidden="true"></i>
          <p className="text-[15px] text-[#E3CFC7]">Loading order details...</p>
        </div>
      </main>
    );
  }

  // Use a fallback or nice error if order not found
  if (!order) {
    return (
      <main className="min-h-screen flex items-center justify-center bg-[#F1E8DC] text-[#1F1115] px-5 py-20">
        <div className="text-center max-w-md flex flex-col items-center gap-4">
          <span className="w-20 h-20 rounded-full bg-[#FBF6EF] shadow-[inset_0_0_0_1px_rgba(31,17,21,0.12)] inline-flex items-center justify-center">
            <i className="ri-error-warning-line text-3xl text-[#A1271F]" aria-hidden="true"></i>
          </span>
          <h1 className="font-serif text-[36px] md:text-[44px] leading-[0.95] tracking-[-0.02em]">Order not found</h1>
          <p className="text-[15px] text-[#6B565B]">We couldn&apos;t locate the order details.</p>
          <Link href="/shop" className="mt-2 inline-flex items-center justify-center min-h-[54px] px-8 rounded-full bg-[#2B0B12] text-[#F6EDE3] font-semibold hover:bg-[#4A1520] transition-colors motion-reduce:transition-none">
            Return to shop
          </Link>
        </div>
      </main>
    );
  }

  const orderDate = new Date(order.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
  const isPaid = order.payment_status === 'paid';
  const trackHref = `/order-tracking?order=${encodeURIComponent(order.order_number)}&email=${encodeURIComponent(order.email || '')}`;
  const firstName = order.shipping_address?.firstName || order.metadata?.first_name || '';

  // Progress shown from the order's real payment and fulfilment status.
  const status = String(order.status || '');
  const reached = {
    processing: isPaid && ['processing', 'shipped', 'delivered', 'completed'].includes(status),
    packed: ['shipped', 'delivered', 'completed'].includes(status),
    delivered: ['delivered', 'completed'].includes(status),
  };
  const progress = [
    { title: 'Paid', detail: isPaid ? 'Payment received' : 'Waiting for payment', done: isPaid },
    { title: 'Processing', detail: 'We prepare your order', done: reached.processing },
    { title: 'Packed', detail: 'Wrapped and on its way', done: reached.packed },
    { title: 'Delivered', detail: 'With you, or collected', done: reached.delivered },
  ];

  const ghostBtn = 'inline-flex items-center justify-center gap-2 min-h-[56px] px-7 rounded-full text-[15px] font-semibold text-[#F6EDE3] shadow-[inset_0_0_0_1px_rgba(246,237,227,0.35)] hover:shadow-[inset_0_0_0_1px_rgba(246,237,227,0.7)] transition-shadow motion-reduce:transition-none whitespace-nowrap';
  const saffronBtn = 'inline-flex items-center justify-center gap-2 min-h-[56px] px-7 rounded-full bg-[#D9A441] text-[#2B0B12] text-[15px] font-bold hover:bg-[#E5B65A] active:scale-[0.98] transition-[background-color,transform] motion-reduce:transition-none motion-reduce:active:scale-100 whitespace-nowrap';

  return (
    <main className="min-h-screen bg-[#2B0B12] text-[#F6EDE3]">
      {showConfetti && isPaid && (
        <div className="fixed inset-0 pointer-events-none z-50 overflow-hidden motion-reduce:hidden" aria-hidden="true">
          {confetti.map((piece, i) => (
            <div
              key={i}
              className="absolute animate-fall"
              style={{
                left: `${piece.left}%`,
                top: `-${piece.top}%`,
                animationDelay: `${piece.delay}s`,
                animationDuration: `${piece.duration}s`
              }}
            >
              <i className={`${piece.icon} text-xl opacity-70`} aria-hidden="true"></i>
            </div>
          ))}
        </div>
      )}

      <section className="max-w-[1280px] mx-auto px-5 sm:px-8 lg:px-12 pt-12 md:pt-24 pb-20 md:pb-24 flex flex-col gap-12 md:gap-14">
        <div className="flex flex-col gap-5 md:gap-6 max-w-[900px]">
          <span className="w-16 h-16 md:w-[72px] md:h-[72px] rounded-full bg-[#D9A441] text-[#2B0B12] inline-flex items-center justify-center" aria-hidden="true">
            <i className={`text-[30px] md:text-[32px] ${isPaid ? 'ri-check-line' : verifying ? 'ri-loader-4-line animate-spin motion-reduce:animate-none' : 'ri-time-line'}`}></i>
          </span>
          <h1 className="font-serif text-[40px] md:text-[56px] leading-[0.95] tracking-[-0.02em]">
            {isPaid ? (
              <>Thank you{firstName ? ', ' : ''}<em className="text-[#E5B65A]">{firstName ? `${firstName}.` : '.'}</em></>
            ) : verifying ? (
              <>Confirming your <em className="text-[#E5B65A]">payment</em></>
            ) : (
              <>Order received, <em className="text-[#E5B65A]">payment pending</em></>
            )}
          </h1>
          <p className="text-[15px] md:text-[17px] leading-relaxed text-[#E3CFC7] max-w-[620px]" aria-live="polite">
            {isPaid
              ? "Your payment went through and we're processing your order now."
              : verifying
                ? 'This takes a few seconds. Please keep this page open.'
                : "We haven't received your payment yet. If you paid, it can take a minute to show; otherwise you can pay now."}
          </p>
          {!isPaid && !verifying && (
            <Link href={`/pay/${order.id}`} className={`${saffronBtn} self-start`}>
              <i className="ri-bank-card-line" aria-hidden="true"></i>
              Pay now
            </Link>
          )}
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)] gap-10 lg:gap-16 items-start">
          <div className="flex flex-col gap-7 min-w-0">
            <div className="flex flex-wrap justify-between items-baseline gap-x-4 gap-y-1 pb-5 border-b border-[#F6EDE3]/16">
              <span className="font-serif text-[24px] md:text-[26px] break-all">Order {order.order_number}</span>
              <span className="text-sm text-[#CDB5AD]">{orderDate}</span>
            </div>

            <ol aria-label="Order progress" className="list-none m-0 p-0 grid grid-cols-2 md:grid-cols-4 gap-3">
              {progress.map((step) => (
                <li
                  key={step.title}
                  className={`flex flex-col gap-3 p-5 rounded-[20px] ${step.done ? 'bg-[#F6EDE3] text-[#2B0B12]' : 'bg-[#F6EDE3]/[0.06] text-[#E3CFC7]'}`}
                >
                  <span
                    aria-hidden="true"
                    className={`w-7 h-7 rounded-full inline-flex items-center justify-center ${step.done ? 'bg-[#2B0B12] text-[#E5B65A]' : 'shadow-[inset_0_0_0_1px_rgba(246,237,227,0.3)]'}`}
                  >
                    {step.done && <i className="ri-check-line text-sm"></i>}
                  </span>
                  <span className="flex flex-col gap-0.5">
                    <span className="font-bold text-[15px]">
                      {step.title}
                      <span className="sr-only">{step.done ? ', done' : ', not yet'}</span>
                    </span>
                    <span className="text-[13px]">{step.detail}</span>
                  </span>
                </li>
              ))}
            </ol>

            <div className="flex flex-col sm:flex-row sm:flex-wrap gap-3">
              <Link href={trackHref} className={saffronBtn}>
                Track this order
              </Link>
              <Link href="/shop" className={ghostBtn}>
                Continue shopping
              </Link>
            </div>

            <section aria-labelledby="delivery-heading" className="flex flex-col gap-5 p-6 sm:p-8 rounded-[24px] bg-[#F6EDE3]/[0.06] shadow-[inset_0_0_0_1px_rgba(246,237,227,0.12)]">
              <h2 id="delivery-heading" className="font-serif text-[24px] leading-none">Delivery details</h2>
              <dl className="m-0 grid sm:grid-cols-2 gap-x-8 gap-y-4 text-[15px]">
                <div className="flex flex-col gap-1">
                  <dt className="text-[13px] text-[#CDB5AD]">Delivery method</dt>
                  <dd className="m-0 font-semibold">{deliveryLabel(order.shipping_method)}</dd>
                  {order.shipping_method && order.shipping_method !== 'pickup' && Number(order.shipping_total) === 0 && (
                    <dd className="m-0 text-sm text-[#E5B65A]">We&apos;ll call you to confirm the delivery fee.</dd>
                  )}
                </div>
                {order.shipping_address && (
                  <>
                    <div className="flex flex-col gap-1">
                      <dt className="text-[13px] text-[#CDB5AD]">Recipient</dt>
                      <dd className="m-0 font-semibold">{order.shipping_address.firstName} {order.shipping_address.lastName}</dd>
                    </div>
                    <div className="flex flex-col gap-1">
                      <dt className="text-[13px] text-[#CDB5AD]">Address</dt>
                      <dd className="m-0">
                        {order.shipping_address.address}
                        <br />
                        {order.shipping_address.city}, {order.shipping_address.region}
                      </dd>
                    </div>
                    <div className="flex flex-col gap-1">
                      <dt className="text-[13px] text-[#CDB5AD]">Phone</dt>
                      <dd className="m-0 tabular-nums">{order.phone}</dd>
                    </div>
                    <div className="flex flex-col gap-1 sm:col-span-2">
                      <dt className="text-[13px] text-[#CDB5AD]">Email</dt>
                      <dd className="m-0 break-all">{order.email}</dd>
                    </div>
                  </>
                )}
              </dl>
              <ul className="list-none m-0 p-0 pt-5 border-t border-[#F6EDE3]/12 flex flex-col gap-3 text-sm text-[#E3CFC7]">
                <li className="flex items-start gap-3">
                  <i className="ri-mail-line text-base text-[#E5B65A] leading-none mt-0.5" aria-hidden="true"></i>
                  <span>Email confirmation sent to <span className="text-[#F6EDE3] break-all">{order.email}</span></span>
                </li>
                <li className="flex items-start gap-3">
                  <i className="ri-truck-line text-base text-[#E5B65A] leading-none mt-0.5" aria-hidden="true"></i>
                  <span>Shipping updates by email and SMS</span>
                </li>
              </ul>
            </section>
          </div>

          <aside aria-label="What you ordered" className="flex flex-col gap-5 p-6 sm:p-8 rounded-[28px] bg-[#F6EDE3] text-[#1F1115]">
            <h2 className="font-serif text-[24px] leading-none">What you ordered</h2>
            <ul className="list-none m-0 p-0 flex flex-col gap-4">
              {order.order_items.map((item: any) => (
                <li key={item.id} className="grid grid-cols-[64px_minmax(0,1fr)_auto] gap-4 items-center">
                  <span className="flex items-center justify-center w-16 h-[78px] rounded-[12px] bg-white overflow-hidden">
                    <img
                      src={item.metadata?.image || '/placeholder-product.svg'}
                      alt={item.product_name}
                      className="w-[76%] h-[76%] object-contain"
                    />
                  </span>
                  <span className="flex flex-col gap-0.5 min-w-0">
                    <span className="font-serif text-[18px] leading-tight line-clamp-2">{item.product_name}</span>
                    <span className="text-[13px] text-[#6B565B]">
                      Qty {item.quantity}{item.variant_name ? ` · ${item.variant_name}` : ''}
                    </span>
                    {item.metadata?.preorder_shipping && (
                      <span className="self-start inline-flex items-center gap-1 mt-1 px-2 py-0.5 rounded-full text-xs text-[#7A1F2E] bg-[#E8C5BE]/50">
                        <i className="ri-time-line" aria-hidden="true"></i> {item.metadata.preorder_shipping}
                      </span>
                    )}
                  </span>
                  <span className="font-semibold tabular-nums whitespace-nowrap">GH₵{money(item.unit_price)}</span>
                </li>
              ))}
            </ul>
            <dl className="m-0 flex flex-col gap-2.5 pt-5 border-t border-[#1F1115]/12 text-[15px]">
              <div className="flex justify-between gap-4">
                <dt className="text-[#4D3A3F]">Subtotal</dt>
                <dd className="m-0 tabular-nums">GH₵{money(order.subtotal)}</dd>
              </div>
              <div className="flex justify-between gap-4">
                <dt className="text-[#4D3A3F]">Shipping</dt>
                <dd className="m-0 tabular-nums">GH₵{money(order.shipping_total)}</dd>
              </div>
              {Number(order.discount_total) > 0 && (
                <div className="flex justify-between gap-4">
                  <dt className="text-[#2F6B3A]">Discount</dt>
                  <dd className="m-0 text-[#2F6B3A] tabular-nums">-GH₵{money(order.discount_total)}</dd>
                </div>
              )}
              <div className="flex justify-between items-baseline gap-4 pt-3 border-t border-[#1F1115]/12">
                <dt className="font-serif text-[20px]">{isPaid ? 'Total paid' : 'Total'}</dt>
                <dd className="m-0 text-[19px] font-semibold tabular-nums">GH₵{money(order.total)}</dd>
              </div>
            </dl>
          </aside>
        </div>

        <div className="flex flex-col items-center gap-2 pt-4 text-center">
          <p className="text-[15px] text-[#E3CFC7]">Need help with your order?</p>
          <div className="flex flex-wrap justify-center gap-x-6">
            <Link href="/contact" className="inline-flex items-center gap-1.5 min-h-[44px] text-sm font-semibold text-[#F6EDE3] underline underline-offset-4 decoration-[#F6EDE3]/40 hover:decoration-[#F6EDE3] whitespace-nowrap">
              <i className="ri-customer-service-line" aria-hidden="true"></i>
              Contact support
            </Link>
            <Link href={trackHref} className="inline-flex items-center gap-1.5 min-h-[44px] text-sm font-semibold text-[#F6EDE3] underline underline-offset-4 decoration-[#F6EDE3]/40 hover:decoration-[#F6EDE3] whitespace-nowrap">
              <i className="ri-question-line" aria-hidden="true"></i>
              Order help
            </Link>
            <Link href="/returns" className="inline-flex items-center gap-1.5 min-h-[44px] text-sm font-semibold text-[#F6EDE3] underline underline-offset-4 decoration-[#F6EDE3]/40 hover:decoration-[#F6EDE3] whitespace-nowrap">
              <i className="ri-arrow-left-right-line" aria-hidden="true"></i>
              Returns policy
            </Link>
          </div>
        </div>
      </section>

      <style jsx>{`
        @keyframes fall {
          to {
            transform: translateY(100vh) rotate(360deg);
            opacity: 0;
          }
        }
        .animate-fall {
          animation: fall linear forwards;
        }
        @media (prefers-reduced-motion: reduce) {
          .animate-fall {
            animation: none;
            display: none;
          }
        }
      `}</style>
    </main>
  );
}

export default function OrderSuccessPage() {
  return (
    <Suspense fallback={
      <div className="min-h-screen flex items-center justify-center bg-[#2B0B12]">
        <div className="w-12 h-12 border-[3px] border-[#D9A441] border-t-transparent rounded-full animate-spin motion-reduce:animate-none" aria-hidden="true"></div>
      </div>
    }>
      <OrderSuccessContent />
    </Suspense>
  );
}
