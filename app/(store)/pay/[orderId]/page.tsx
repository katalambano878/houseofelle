'use client';

import { money } from '@/lib/format-money';
import { useState, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Link from 'next/link';
import { supabase } from '@/lib/supabase';
import { usePageTitle } from '@/hooks/usePageTitle';

export default function PaymentPage() {
  usePageTitle('Complete Payment');
  const params = useParams();
  const router = useRouter();
  const orderId = params.orderId as string;

  const [order, setOrder] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [processing, setProcessing] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    async function fetchOrder() {
      try {
        // The payment link carries the order id, which the lookup API accepts on its own
        const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(orderId);
        const { data: { session } } = await supabase.auth.getSession();
        const headers: Record<string, string> = { 'Content-Type': 'application/json' };
        if (session?.access_token) headers.Authorization = `Bearer ${session.access_token}`;
        const res = await fetch('/api/orders/lookup', {
          method: 'POST',
          headers,
          body: JSON.stringify(isUuid ? { id: orderId } : { order: orderId }),
        });
        const json = await res.json().catch(() => ({}));
        const data = json?.order;

        if (!res.ok || !data) {
          setError('Order not found. Please check your link and try again.');
          setLoading(false);
          return;
        }

        setOrder(data);

        // If already paid, redirect to success page
        if (data.payment_status === 'paid') {
          router.push(`/order-success?order=${data.order_number}&id=${data.id}`);
          return;
        }

      } catch (err) {
        console.error('Error fetching order:', err);
        setError('Failed to load order details.');
      } finally {
        setLoading(false);
      }
    }

    if (orderId) {
      fetchOrder();
    }
  }, [orderId, router]);

  const handlePayNow = async () => {
    if (!order) return;

    setProcessing(true);
    setError(null);

    try {
      const paymentRes = await fetch('/api/payment/moolre', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId: order.id })
      });

      const paymentResult = await paymentRes.json();

      if (!paymentResult.success) {
        throw new Error(paymentResult.message || 'Payment initialization failed');
      }

      // Redirect to Moolre payment page
      window.location.href = paymentResult.url;

    } catch (err: any) {
      console.error('Payment error:', err);
      setError(err.message || 'Failed to initialize payment. Please try again.');
      setProcessing(false);
    }
  };

  if (loading) {
    return (
      <main className="min-h-screen bg-[#F1E8DC] text-[#1F1115] flex items-center justify-center px-5">
        <div className="text-center" role="status">
          <div className="w-12 h-12 border-[3px] border-[#2B0B12]/15 border-t-[#2B0B12] rounded-full animate-spin motion-reduce:animate-none mx-auto mb-4" aria-hidden="true"></div>
          <p className="text-[15px] text-[#6B565B]">Loading order details...</p>
        </div>
      </main>
    );
  }

  if (error && !order) {
    return (
      <main className="min-h-screen bg-[#F1E8DC] text-[#1F1115] flex items-center justify-center px-5 py-20">
        <div className="text-center max-w-md flex flex-col items-center gap-4">
          <span className="w-20 h-20 rounded-full bg-[#FBF6EF] shadow-[inset_0_0_0_1px_rgba(31,17,21,0.12)] inline-flex items-center justify-center">
            <i className="ri-error-warning-line text-3xl text-[#A1271F]" aria-hidden="true"></i>
          </span>
          <h1 className="font-serif text-[36px] md:text-[44px] leading-[0.95] tracking-[-0.02em]">Order not found</h1>
          <p className="text-[15px] leading-relaxed text-[#6B565B]">{error}</p>
          <Link
            href="/"
            className="mt-2 inline-flex items-center justify-center gap-2 min-h-[54px] px-8 rounded-full bg-[#2B0B12] text-[#F6EDE3] font-semibold hover:bg-[#4A1520] transition-colors motion-reduce:transition-none"
          >
            <i className="ri-home-line" aria-hidden="true"></i>
            Go to homepage
          </Link>
        </div>
      </main>
    );
  }

  const shippingAddress = order?.shipping_address || {};
  const customerName = order?.metadata?.first_name || shippingAddress.firstName || 'Customer';

  return (
    <main className="min-h-screen bg-[#F1E8DC] text-[#1F1115]">
      <div className="max-w-[560px] mx-auto px-5 sm:px-8 pt-10 md:pt-16 pb-20 md:pb-28 flex flex-col gap-6">
        <div className="flex flex-col gap-3">
          <h1 className="font-serif text-[40px] md:text-[52px] leading-[0.95] tracking-[-0.02em]">Complete your <em>payment</em></h1>
          <p className="text-[15px] leading-relaxed text-[#6B565B]">Hi {customerName}, your order is waiting for payment.</p>
        </div>

        <section aria-label="Order summary" className="flex flex-col gap-5 p-6 sm:p-8 rounded-[28px] bg-[#FBF6EF] shadow-[inset_0_0_0_1px_rgba(31,17,21,0.1)]">
          <div className="flex items-baseline justify-between gap-4 pb-4 border-b border-[#1F1115]/12">
            <span className="text-sm text-[#6B565B]">Order number</span>
            <span className="font-serif text-[20px] break-all text-right">{order?.order_number}</span>
          </div>

          <dl className="m-0 flex flex-col gap-3 text-[15px]">
            <div className="flex justify-between gap-4">
              <dt className="text-[#4D3A3F]">Subtotal</dt>
              <dd className="m-0 tabular-nums">GH₵ {money(order?.subtotal)}</dd>
            </div>
            <div className="flex justify-between gap-4">
              <dt className="text-[#4D3A3F]">Shipping</dt>
              <dd className="m-0 tabular-nums">GH₵ {money(order?.shipping_total)}</dd>
            </div>
            {order?.discount_total > 0 && (
              <div className="flex justify-between gap-4">
                <dt className="text-[#2F6B3A]">Discount</dt>
                <dd className="m-0 text-[#2F6B3A] tabular-nums">-GH₵ {money(order?.discount_total)}</dd>
              </div>
            )}
            <div className="flex justify-between items-baseline gap-4 pt-3.5 border-t border-[#1F1115]/12">
              <dt className="font-serif text-[20px]">Total</dt>
              <dd className="m-0 text-[22px] font-semibold tabular-nums">GH₵ {money(order?.total)}</dd>
            </div>
          </dl>
        </section>

        {order?.payment_status === 'pending' && (
          <div className="flex items-start gap-3 p-4 rounded-[18px] bg-[#D9A441]/15 shadow-[inset_0_0_0_1px_rgba(217,164,65,0.45)]">
            <i className="ri-time-line text-xl text-[#7A4E0B] leading-none mt-0.5" aria-hidden="true"></i>
            <div>
              <p className="text-sm font-semibold text-[#1F1115]">Payment pending</p>
              <p className="text-sm text-[#4D3A3F] mt-0.5">Complete your payment to confirm your order.</p>
            </div>
          </div>
        )}

        {order?.payment_status === 'failed' && (
          <div className="flex items-start gap-3 p-4 rounded-[18px] bg-[#A1271F]/[0.08] shadow-[inset_0_0_0_1px_rgba(161,39,31,0.3)]">
            <i className="ri-error-warning-line text-xl text-[#A1271F] leading-none mt-0.5" aria-hidden="true"></i>
            <div>
              <p className="text-sm font-semibold text-[#7F1D17]">Payment failed</p>
              <p className="text-sm text-[#4D3A3F] mt-0.5">Your previous payment attempt was unsuccessful. Please try again.</p>
            </div>
          </div>
        )}

        {error && (
          <div role="alert" className="p-4 rounded-[18px] bg-[#A1271F]/[0.08] shadow-[inset_0_0_0_1px_rgba(161,39,31,0.3)]">
            <p className="text-sm text-[#7F1D17]">{error}</p>
          </div>
        )}

        <button
          type="button"
          onClick={handlePayNow}
          disabled={processing}
          className="w-full min-h-[60px] px-6 rounded-full bg-[#2B0B12] text-[#F6EDE3] text-[15px] font-semibold tabular-nums hover:bg-[#4A1520] active:scale-[0.99] transition-[background-color,transform] motion-reduce:transition-none motion-reduce:active:scale-100 disabled:opacity-70 inline-flex items-center justify-center cursor-pointer"
        >
          {processing ? (
            <>
              <svg className="animate-spin motion-reduce:hidden -ml-1 mr-3 h-5 w-5 text-[#F6EDE3]" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
              </svg>
              Processing...
            </>
          ) : (
            <>Pay GH₵ {money(order?.total)} with Mobile Money</>
          )}
        </button>

        <p className="flex items-center justify-center gap-2 text-[13px] text-[#6B565B]">
          <i className="ri-lock-line text-base text-[#2F6B3A]" aria-hidden="true"></i>
          Secure payment powered by Moolre
        </p>

        <p className="text-center text-sm text-[#6B565B]">
          Having issues?{' '}
          <Link href="/contact" className="inline-flex items-center min-h-[44px] font-semibold text-[#7A1F2E] underline underline-offset-4">Contact support</Link>
        </p>
      </div>
    </main>
  );
}
