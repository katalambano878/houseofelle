'use client';
import { money, asNumber } from '@/lib/format-money';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useRecaptcha } from '@/hooks/useRecaptcha';

interface LookupItem {
  id: string;
  product_name: string;
  variant_name: string | null;
  quantity: number;
  unit_price: number | string;
  metadata?: { image?: string } | null;
  products?: { slug?: string; product_images?: { url: string; position?: number }[] } | null;
}

interface LookupOrder {
  id: string;
  order_number: string;
  email: string | null;
  created_at: string;
  shipping_address?: { full_name?: string; name?: string } | null;
  order_items: LookupItem[];
}

const reasons = [
  'Damaged or leaking on arrival',
  'Wrong item received',
  'Item missing from my order',
  'Not as described',
  'Other',
];

const inputClass =
  'w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500';

const itemImage = (item: LookupItem) => {
  const images = item.products?.product_images || [];
  const sorted = [...images].sort((a, b) => (a.position ?? 0) - (b.position ?? 0));
  return sorted[0]?.url || item.metadata?.image || '/placeholder-product.svg';
};

const itemLabel = (item: LookupItem) =>
  item.variant_name ? `${item.product_name} (${item.variant_name})` : item.product_name;

export default function ReturnsPortalPage() {
  const router = useRouter();
  const { getRawToken } = useRecaptcha();
  const [step, setStep] = useState(1);
  const [orderNumber, setOrderNumber] = useState('');
  const [email, setEmail] = useState('');
  const [selected, setSelected] = useState<Record<string, number>>({});
  const [reason, setReason] = useState('');
  const [details, setDetails] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [foundOrder, setFoundOrder] = useState<LookupOrder | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user?.email) setEmail((prev) => prev || session.user.email || '');
    });
    const params = new URLSearchParams(window.location.search);
    const order = params.get('order');
    if (order) setOrderNumber(order);
  }, []);

  const handleFindOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch('/api/orders/lookup', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify({ order: orderNumber.trim(), email: email.trim() }),
      });
      const body = await res.json().catch(() => null);
      if (!res.ok || !body?.order) {
        setError(body?.error || 'No order matches that number and email.');
        return;
      }
      const order = body.order as LookupOrder;
      setFoundOrder({ ...order, order_items: order.order_items || [] });
      setSelected({});
      setReason('');
      setDetails('');
      setStep(2);
    } catch {
      setError('We could not look up your order. Please try again.');
    } finally {
      setIsLoading(false);
    }
  };

  const toggleItem = (item: LookupItem) => {
    setSelected((prev) => {
      const next = { ...prev };
      if (next[item.id]) delete next[item.id];
      else next[item.id] = item.quantity;
      return next;
    });
  };

  const setQuantity = (itemId: string, qty: number, max: number) => {
    setSelected((prev) => ({ ...prev, [itemId]: Math.min(Math.max(1, qty), max) }));
  };

  const selectedItems = (foundOrder?.order_items || []).filter((item) => selected[item.id]);
  const canContinue = selectedItems.length > 0 && !!reason && (reason !== 'Other' || details.trim().length > 0);

  const handleSubmitReturn = async () => {
    if (!foundOrder) return;
    setError('');
    setIsLoading(true);
    try {
      const recaptchaToken = await getRawToken('contact');
      if (recaptchaToken === null) {
        setError('Security check failed. Please refresh the page and try again.');
        return;
      }
      const contactEmail = (foundOrder.email || email).trim();
      const name =
        foundOrder.shipping_address?.full_name ||
        foundOrder.shipping_address?.name ||
        contactEmail;
      const message = [
        `Return request for order ${foundOrder.order_number}`,
        `Order date: ${new Date(foundOrder.created_at).toLocaleDateString('en-GB')}`,
        `Customer email: ${contactEmail}`,
        '',
        'Items:',
        ...selectedItems.map(
          (item) => `- ${itemLabel(item)} × ${selected[item.id]} (ordered ${item.quantity}, GH₵${money(asNumber(item.unit_price))} each)`
        ),
        '',
        `Reason: ${reason}`,
        `Details: ${details.trim() || '(none)'}`,
      ].join('\n');

      const res = await fetch('/api/notifications', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'contact',
          recaptchaToken,
          payload: {
            name: String(name).slice(0, 100),
            email: contactEmail,
            subject: `Return request ${foundOrder.order_number}`,
            message: message.slice(0, 5000),
          },
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        setError(body?.error === 'Too many messages. Please try again later.'
          ? body.error
          : 'We could not send your return request. Please try again or contact us directly.');
        return;
      }
      router.push(`/returns/confirmation?order=${encodeURIComponent(foundOrder.order_number)}`);
    } catch {
      setError('We could not send your return request. Please try again or contact us directly.');
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <main className="min-h-screen bg-gray-50 py-12">
      <div className="max-w-4xl mx-auto px-4">
        <h1 className="text-3xl font-bold text-gray-900 mb-2">Returns</h1>
        <p className="text-gray-600 mb-8">Report a problem with an item from your order</p>

        <div className="mb-8">
          <div className="flex items-center justify-between">
            {[1, 2, 3].map((i) => (
              <div key={i} className={`flex items-center ${i < 3 ? 'flex-1' : ''}`}>
                <div className={`w-10 h-10 flex items-center justify-center rounded-full font-bold ${
                  i <= step ? 'bg-blue-700 text-white' : 'bg-gray-200 text-gray-500'
                }`}>
                  {i < step ? <i className="ri-check-line"></i> : i}
                </div>
                {i < 3 && (
                  <div className={`flex-1 h-1 mx-4 ${i < step ? 'bg-blue-700' : 'bg-gray-200'}`}></div>
                )}
              </div>
            ))}
          </div>
          <div className="flex justify-between mt-2">
            <span className="text-sm font-semibold text-gray-900">Find Order</span>
            <span className="text-sm font-semibold text-gray-900">Select Items</span>
            <span className="text-sm font-semibold text-gray-900">Submit</span>
          </div>
        </div>

        {error && (
          <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700 flex items-start gap-2">
            <i className="ri-error-warning-line mt-0.5"></i>
            <span>{error}</span>
          </div>
        )}

        {step === 1 && (
          <div className="bg-white rounded-xl shadow-sm p-6 sm:p-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Find Your Order</h2>
            <form onSubmit={handleFindOrder} className="space-y-6">
              <div>
                <label htmlFor="return-order" className="block text-sm font-semibold text-gray-900 mb-2">
                  Order Number *
                </label>
                <input
                  id="return-order"
                  type="text"
                  value={orderNumber}
                  onChange={(e) => setOrderNumber(e.target.value)}
                  className={inputClass}
                  placeholder="ORD-…"
                  required
                />
              </div>

              <div>
                <label htmlFor="return-email" className="block text-sm font-semibold text-gray-900 mb-2">
                  Email Address *
                </label>
                <input
                  id="return-email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  className={inputClass}
                  placeholder="The email you used for the order"
                  required
                />
              </div>

              <button
                type="submit"
                disabled={isLoading}
                className="w-full bg-blue-700 hover:bg-blue-800 text-white py-4 rounded-lg font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
              >
                {isLoading ? 'Finding Order...' : 'Find Order'}
              </button>
            </form>

            <div className="mt-8 p-4 bg-blue-50 border border-blue-200 rounded-lg">
              <div className="flex items-start space-x-3">
                <i className="ri-information-line text-xl text-blue-700 mt-0.5"></i>
                <div className="text-sm text-blue-700">
                  <p className="font-semibold mb-1">Before you start</p>
                  <ul className="space-y-1">
                    <li>• Contact us as soon as possible if something is wrong with your order</li>
                    <li>• Keep the item and its packaging until we get back to you</li>
                    <li>
                      • Questions? <Link href="/contact" className="underline hover:text-blue-900">Contact us</Link>
                    </li>
                  </ul>
                </div>
              </div>
            </div>
          </div>
        )}

        {step === 2 && foundOrder && (
          <div className="bg-white rounded-xl shadow-sm p-6 sm:p-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Select Items</h2>

            <div className="mb-6 p-4 bg-gray-50 rounded-lg">
              <p className="text-sm text-gray-600">
                Order {foundOrder.order_number} • Placed on{' '}
                {new Date(foundOrder.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}
              </p>
            </div>

            {foundOrder.order_items.length === 0 ? (
              <p className="text-gray-600 mb-8">This order has no items.</p>
            ) : (
              <div className="space-y-4 mb-8">
                {foundOrder.order_items.map((item) => {
                  const checked = !!selected[item.id];
                  return (
                    <div key={item.id} className={`border-2 rounded-lg p-4 ${checked ? 'border-blue-700' : 'border-gray-200'}`}>
                      <label className="flex items-start space-x-4 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={checked}
                          onChange={() => toggleItem(item)}
                          className="mt-1 w-5 h-5 text-blue-700 rounded border-gray-300 focus:ring-blue-500"
                        />
                        <div className="w-20 h-20 flex-shrink-0 bg-gray-100 rounded-lg overflow-hidden">
                          <img src={itemImage(item)} alt={item.product_name} className="w-full h-full object-cover object-center" />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-gray-900 mb-1">{itemLabel(item)}</p>
                          <p className="text-sm text-gray-600">Ordered: {item.quantity}</p>
                          <p className="text-lg font-bold text-gray-900">GH₵{money(asNumber(item.unit_price))}</p>
                        </div>
                      </label>
                      {checked && item.quantity > 1 && (
                        <div className="mt-4 ml-9 flex items-center gap-3">
                          <label htmlFor={`qty-${item.id}`} className="text-sm font-semibold text-gray-900">
                            Quantity affected
                          </label>
                          <select
                            id={`qty-${item.id}`}
                            value={selected[item.id]}
                            onChange={(e) => setQuantity(item.id, Number(e.target.value), item.quantity)}
                            className="px-3 py-2 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 pr-8"
                          >
                            {Array.from({ length: item.quantity }, (_, i) => i + 1).map((n) => (
                              <option key={n} value={n}>{n}</option>
                            ))}
                          </select>
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}

            <div className="mb-6">
              <label htmlFor="return-reason" className="block text-sm font-semibold text-gray-900 mb-2">
                What went wrong? *
              </label>
              <select
                id="return-reason"
                value={reason}
                onChange={(e) => setReason(e.target.value)}
                className="w-full px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 pr-8"
              >
                <option value="">Select a reason</option>
                {reasons.map((r) => (
                  <option key={r} value={r}>{r}</option>
                ))}
              </select>
            </div>

            <div className="mb-8">
              <label htmlFor="return-details" className="block text-sm font-semibold text-gray-900 mb-2">
                Details {reason === 'Other' ? '*' : '(optional)'}
              </label>
              <textarea
                id="return-details"
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                maxLength={1500}
                className={`${inputClass} h-28 resize-none`}
                placeholder="Tell us what happened, e.g. the bottle arrived cracked or the cap was leaking"
              />
            </div>

            <div className="flex space-x-4">
              <button
                onClick={() => setStep(1)}
                className="flex-1 py-4 border-2 border-gray-300 text-gray-700 rounded-lg font-semibold hover:bg-gray-50 transition-colors whitespace-nowrap"
              >
                Back
              </button>
              <button
                onClick={() => setStep(3)}
                disabled={!canContinue}
                className="flex-1 py-4 bg-blue-700 hover:bg-blue-800 text-white rounded-lg font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
              >
                Continue
              </button>
            </div>
          </div>
        )}

        {step === 3 && foundOrder && (
          <div className="bg-white rounded-xl shadow-sm p-6 sm:p-8">
            <h2 className="text-2xl font-bold text-gray-900 mb-6">Review &amp; Submit</h2>

            <div className="mb-6">
              <h3 className="font-semibold text-gray-900 mb-4">Items</h3>
              <div className="space-y-3">
                {selectedItems.map((item) => (
                  <div key={item.id} className="flex items-center justify-between gap-4 p-4 bg-gray-50 rounded-lg">
                    <div className="min-w-0">
                      <p className="font-semibold text-gray-900">{itemLabel(item)}</p>
                      <p className="text-sm text-gray-600">Quantity: {selected[item.id]}</p>
                    </div>
                    <p className="font-bold text-gray-900 whitespace-nowrap">GH₵{money(asNumber(item.unit_price))}</p>
                  </div>
                ))}
              </div>
            </div>

            <div className="mb-8 p-4 bg-gray-50 rounded-lg text-sm text-gray-700 space-y-1">
              <p><span className="font-semibold">Reason:</span> {reason}</p>
              {details.trim() && <p className="whitespace-pre-line"><span className="font-semibold">Details:</span> {details.trim()}</p>}
            </div>

            <div className="mb-8 p-6 border-2 border-blue-200 bg-blue-50 rounded-lg">
              <h3 className="font-semibold text-gray-900 mb-2">What happens next</h3>
              <p className="text-sm text-gray-700">
                We&apos;ll review your request and contact you at {foundOrder.email || email} to arrange the next steps.
                Please keep the item and its packaging until then.
              </p>
            </div>

            <div className="flex space-x-4">
              <button
                onClick={() => setStep(2)}
                disabled={isLoading}
                className="flex-1 py-4 border-2 border-gray-300 text-gray-700 rounded-lg font-semibold hover:bg-gray-50 transition-colors whitespace-nowrap"
              >
                Back
              </button>
              <button
                onClick={handleSubmitReturn}
                disabled={isLoading}
                className="flex-1 py-4 bg-blue-700 hover:bg-blue-800 text-white rounded-lg font-semibold transition-colors disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap"
              >
                {isLoading ? 'Submitting...' : 'Submit Return Request'}
              </button>
            </div>
          </div>
        )}
      </div>
    </main>
  );
}
