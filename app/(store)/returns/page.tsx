'use client';
import { money, asNumber } from '@/lib/format-money';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import PageHero from '@/components/PageHero';
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
  'w-full h-[50px] px-4 rounded-[14px] bg-white shadow-[inset_0_0_0_1px_rgba(31,17,21,0.16)] text-[15px] text-[#1F1115] placeholder:text-[#6B565B] outline-none focus:shadow-[inset_0_0_0_1.5px_#2B0B12]';

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

  const card = 'rounded-[24px] bg-[#FBF6EF] shadow-[inset_0_0_0_1px_rgba(31,17,21,0.1)] p-5 sm:p-8';
  const h2 = 'font-serif text-[26px] md:text-[30px] leading-none mb-6';
  const labelClass = 'block text-[13px] font-semibold mb-1.5';
  const primary = 'flex-1 inline-flex items-center justify-center min-h-[54px] px-6 rounded-full bg-[#2B0B12] text-[#F6EDE3] font-semibold hover:bg-[#4A1520] transition-colors motion-reduce:transition-none disabled:opacity-50 disabled:cursor-not-allowed whitespace-nowrap';
  const secondary = 'flex-1 inline-flex items-center justify-center min-h-[54px] px-6 rounded-full shadow-[inset_0_0_0_1.5px_rgba(31,17,21,0.3)] font-semibold hover:bg-white transition-colors motion-reduce:transition-none disabled:opacity-50 whitespace-nowrap';
  const stepNames = ['Find order', 'Select items', 'Submit'];

  return (
    <main className="min-h-screen bg-[#F1E8DC] text-[#1F1115]">
      <PageHero title="Returns" subtitle="Report a problem with an item from your order." />

      <div className="max-w-[1360px] mx-auto px-5 sm:px-8 lg:px-12 py-10 md:py-16">
        <div className="max-w-[720px] mx-auto">
          <ol className="grid grid-cols-3 gap-2 mb-8" aria-label="Progress">
            {stepNames.map((name, idx) => {
              const i = idx + 1;
              const done = i < step;
              const current = i === step;
              return (
                <li key={name} aria-current={current ? 'step' : undefined} className="flex flex-col gap-2">
                  <span className={`h-1 rounded-full ${i <= step ? 'bg-[#2B0B12]' : 'bg-[#1F1115]/12'}`} aria-hidden="true" />
                  <span className={`inline-flex items-center gap-1.5 text-[13px] font-semibold ${i <= step ? 'text-[#1F1115]' : 'text-[#6B565B]'}`}>
                    {done && <i className="ri-check-line text-[#7A1F2E]" aria-hidden="true" />}
                    {name}
                  </span>
                </li>
              );
            })}
          </ol>

          {error && (
            <div role="alert" className="mb-6 rounded-2xl bg-[#F6DCD7] text-[#7A1F2E] px-4 py-3 text-sm flex items-start gap-2">
              <i className="ri-error-warning-line mt-0.5" aria-hidden="true" />
              <span>{error}</span>
            </div>
          )}

          {step === 1 && (
            <div className={card}>
              <h2 className={h2}>Find your <em>order</em></h2>
              <form onSubmit={handleFindOrder} className="flex flex-col gap-5">
                <div>
                  <label htmlFor="return-order" className={labelClass}>
                    Order number
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
                  <label htmlFor="return-email" className={labelClass}>
                    Email address
                  </label>
                  <input
                    id="return-email"
                    type="email"
                    autoComplete="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    className={inputClass}
                    placeholder="The email you used for the order"
                    required
                  />
                </div>

                <button type="submit" disabled={isLoading} className={`${primary} w-full`}>
                  {isLoading ? 'Finding order…' : 'Find order'}
                </button>
              </form>

              <div className="mt-8 pt-6 border-t border-[#1F1115]/14">
                <p className="text-[15px] font-semibold mb-2">Before you start</p>
                <ul className="flex flex-col gap-1.5 list-disc pl-5 marker:text-[#7A1F2E] text-[15px] leading-relaxed text-[#4D3A3F]">
                  <li>Contact us as soon as possible if something is wrong with your order</li>
                  <li>Keep the item and its packaging until we get back to you</li>
                  <li>
                    Questions? <Link href="/contact" className="font-semibold text-[#7A1F2E] underline underline-offset-4">Contact us</Link>
                  </li>
                </ul>
              </div>
            </div>
          )}

          {step === 2 && foundOrder && (
            <div className={card}>
              <h2 className={h2}>Select <em>items</em></h2>

              <p className="mb-6 inline-flex flex-wrap items-center gap-x-2 rounded-full bg-[#F1E8DC] px-4 py-2 text-sm text-[#4D3A3F]">
                <span>Order <span className="font-semibold text-[#1F1115] tabular-nums">{foundOrder.order_number}</span></span>
                <span aria-hidden="true">·</span>
                <span>Placed on {new Date(foundOrder.created_at).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' })}</span>
              </p>

              {foundOrder.order_items.length === 0 ? (
                <p className="text-[15px] text-[#6B565B] mb-8">This order has no items.</p>
              ) : (
                <div className="flex flex-col gap-3 mb-8">
                  {foundOrder.order_items.map((item) => {
                    const checked = !!selected[item.id];
                    return (
                      <div
                        key={item.id}
                        className={`rounded-[18px] bg-white p-4 transition-shadow motion-reduce:transition-none ${checked ? 'shadow-[inset_0_0_0_1.5px_#2B0B12]' : 'shadow-[inset_0_0_0_1px_rgba(31,17,21,0.12)]'}`}
                      >
                        <label className="flex items-start gap-4 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleItem(item)}
                            className="mt-1 w-5 h-5 rounded border-[#1F1115]/30 text-[#2B0B12] focus:ring-[#2B0B12]"
                          />
                          <span className="w-16 h-16 sm:w-20 sm:h-20 flex-shrink-0 rounded-[14px] bg-[#F1E8DC] overflow-hidden">
                            {/* eslint-disable-next-line @next/next/no-img-element */}
                            <img src={itemImage(item)} alt={item.product_name} className="w-full h-full object-contain mix-blend-multiply" />
                          </span>
                          <span className="flex-1 min-w-0 flex flex-col gap-0.5">
                            <span className="font-serif text-[18px] leading-tight">{itemLabel(item)}</span>
                            <span className="text-sm text-[#6B565B]">Ordered: {item.quantity}</span>
                            <span className="text-[15px] font-semibold tabular-nums">GH₵{money(asNumber(item.unit_price))}</span>
                          </span>
                        </label>
                        {checked && item.quantity > 1 && (
                          <div className="mt-4 ml-9 flex flex-wrap items-center gap-3">
                            <label htmlFor={`qty-${item.id}`} className="text-[13px] font-semibold">
                              Quantity affected
                            </label>
                            <select
                              id={`qty-${item.id}`}
                              value={selected[item.id]}
                              onChange={(e) => setQuantity(item.id, Number(e.target.value), item.quantity)}
                              className="h-11 pl-4 pr-9 rounded-full bg-[#FBF6EF] shadow-[inset_0_0_0_1px_rgba(31,17,21,0.18)] outline-none focus:shadow-[inset_0_0_0_1.5px_#2B0B12]"
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

              <div className="mb-5">
                <label htmlFor="return-reason" className={labelClass}>
                  What went wrong?
                </label>
                <select
                  id="return-reason"
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  required
                  className={`${inputClass} pr-9`}
                >
                  <option value="">Select a reason</option>
                  {reasons.map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </div>

              <div className="mb-8">
                <label htmlFor="return-details" className={labelClass}>
                  Details {reason === 'Other' ? '' : <span className="font-normal text-[#6B565B]">(optional)</span>}
                </label>
                <textarea
                  id="return-details"
                  value={details}
                  onChange={(e) => setDetails(e.target.value)}
                  maxLength={1500}
                  required={reason === 'Other'}
                  className={`${inputClass} !h-28 py-3.5 resize-none`}
                  placeholder="Tell us what happened, e.g. the bottle arrived cracked or the cap was leaking"
                />
              </div>

              <div className="flex flex-col-reverse sm:flex-row gap-3">
                <button type="button" onClick={() => setStep(1)} className={secondary}>
                  Back
                </button>
                <button type="button" onClick={() => setStep(3)} disabled={!canContinue} className={primary}>
                  Continue
                </button>
              </div>
            </div>
          )}

          {step === 3 && foundOrder && (
            <div className={card}>
              <h2 className={h2}>Review and <em>submit</em></h2>

              <div className="mb-6">
                <h3 className="text-[15px] font-semibold mb-3">Items</h3>
                <ul className="border-t border-[#1F1115]/14">
                  {selectedItems.map((item) => (
                    <li key={item.id} className="flex items-center justify-between gap-4 py-4 border-b border-[#1F1115]/14">
                      <span className="min-w-0 flex flex-col gap-0.5">
                        <span className="font-serif text-[18px] leading-tight">{itemLabel(item)}</span>
                        <span className="text-sm text-[#6B565B]">Quantity: {selected[item.id]}</span>
                      </span>
                      <span className="font-semibold whitespace-nowrap tabular-nums">GH₵{money(asNumber(item.unit_price))}</span>
                    </li>
                  ))}
                </ul>
              </div>

              <div className="mb-6 rounded-[18px] bg-[#F1E8DC] p-4 text-[15px] text-[#4D3A3F] flex flex-col gap-1">
                <p><span className="font-semibold text-[#1F1115]">Reason:</span> {reason}</p>
                {details.trim() && <p className="whitespace-pre-line"><span className="font-semibold text-[#1F1115]">Details:</span> {details.trim()}</p>}
              </div>

              <div className="mb-8 rounded-[18px] bg-[#2B0B12] text-[#F6EDE3] p-5">
                <h3 className="font-serif text-[20px] leading-tight mb-2">What happens next</h3>
                <p className="text-[15px] leading-relaxed text-[#E3CFC7]">
                  We&apos;ll review your request and contact you at {foundOrder.email || email} to arrange the next steps.
                  Please keep the item and its packaging until then.
                </p>
              </div>

              <div className="flex flex-col-reverse sm:flex-row gap-3">
                <button type="button" onClick={() => setStep(2)} disabled={isLoading} className={secondary}>
                  Back
                </button>
                <button type="button" onClick={handleSubmitReturn} disabled={isLoading} className={primary}>
                  {isLoading ? 'Submitting…' : 'Submit return request'}
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </main>
  );
}
