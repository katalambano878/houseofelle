'use client';
import { money } from '@/lib/format-money';

import Link from 'next/link';
import Image from 'next/image';
import { useEffect, useState } from 'react';
import AdvancedCouponSystem, { checkCoupon, type AppliedCoupon } from '@/components/AdvancedCouponSystem';
import { useCart } from '@/context/CartContext';
import { usePageTitle } from '@/hooks/usePageTitle';

export default function CartPage() {
  usePageTitle('Shopping Cart');
  const { cart: cartItems, removeFromCart, updateQuantity, subtotal, addToCart } = useCart();
  const [appliedCoupon, setAppliedCoupon] = useState<AppliedCoupon | null>(null);
  const [savedItems, setSavedItemsState] = useState<any[]>([]);

  // "Saved for later" survives reloads; items leave the cart, so losing them would lose the shopper's picks.
  useEffect(() => {
    try {
      const raw = localStorage.getItem('savedForLater');
      if (raw) setSavedItemsState(JSON.parse(raw));
    } catch {}
  }, []);
  const setSavedItems = (items: any[]) => {
    setSavedItemsState(items);
    try { localStorage.setItem('savedForLater', JSON.stringify(items)); } catch {}
  };

  const sameLine = (a: { id: string; variant?: string }, id: string, variant?: string) =>
    a.id === id && (a.variant || '') === (variant || '');

  const saveForLater = (id: string, variant?: string) => {
    const item = cartItems.find(i => sameLine(i, id, variant));
    if (item) {
      setSavedItems([...savedItems.filter(i => !sameLine(i, id, variant)), item]);
      removeFromCart(item.id, item.variant);
    }
  };

  const moveToCart = (id: string, variant?: string) => {
    const item = savedItems.find(i => sameLine(i, id, variant));
    if (item) {
      addToCart(item);
      setSavedItems(savedItems.filter(i => !sameLine(i, id, variant)));
    }
  };

  // Restore a coupon applied earlier and re-check it whenever the subtotal changes.
  useEffect(() => {
    let code = '';
    try { code = localStorage.getItem('appliedCoupon') || ''; } catch {}
    if (!code || subtotal <= 0) {
      setAppliedCoupon(null);
      return;
    }
    let cancelled = false;
    checkCoupon(code, subtotal)
      .then((coupon) => { if (!cancelled) setAppliedCoupon(coupon); })
      .catch(() => {
        if (cancelled) return;
        setAppliedCoupon(null);
        try { localStorage.removeItem('appliedCoupon'); } catch {}
      });
    return () => { cancelled = true; };
  }, [subtotal]);

  const applyCoupon = (coupon: AppliedCoupon) => {
    setAppliedCoupon(coupon);
    try { localStorage.setItem('appliedCoupon', coupon.code); } catch {}
  };

  const removeCoupon = () => {
    setAppliedCoupon(null);
    try { localStorage.removeItem('appliedCoupon'); } catch {}
  };

  const couponDiscount = appliedCoupon ? Math.min(appliedCoupon.discount, subtotal) : 0;
  // Delivery is arranged after the order, so no fee is added here (matches checkout).
  const shipping = 0;
  const total = subtotal - couponDiscount + shipping;

  const thumbClass = 'relative flex items-center justify-center aspect-[4/5] rounded-[18px] bg-[#FBF6EF] shadow-[inset_0_0_0_1px_rgba(31,17,21,0.1)] overflow-hidden';
  const textLink = 'inline-flex items-center min-h-[44px] text-sm text-[#6B565B] underline underline-offset-4 decoration-[#6B565B]/40 hover:text-[#7A1F2E] hover:decoration-[#7A1F2E] transition-colors motion-reduce:transition-none';

  return (
    <main className="min-h-screen bg-[#F1E8DC] text-[#1F1115]">
      <section className="max-w-[1360px] mx-auto px-5 sm:px-8 lg:px-12 pt-8 md:pt-16 pb-20 md:pb-32 flex flex-col gap-8 md:gap-12">
        <div className="flex items-baseline gap-4 sm:gap-5">
          <h1 className="font-serif text-[40px] md:text-[56px] leading-[0.95] tracking-[-0.02em]">Your <em>bag</em></h1>
          {cartItems.length > 0 && (
            <span className="text-[15px] text-[#6B565B] tabular-nums">
              {cartItems.length} {cartItems.length === 1 ? 'item' : 'items'}
            </span>
          )}
        </div>

        {cartItems.length === 0 && savedItems.length === 0 ? (
          <div className="flex flex-col items-center text-center gap-5 py-12 md:py-20">
            <span className="w-20 h-20 rounded-full bg-[#FBF6EF] shadow-[inset_0_0_0_1px_rgba(31,17,21,0.12)] inline-flex items-center justify-center">
              <i className="ri-shopping-bag-line text-3xl text-[#7A1F2E]" aria-hidden="true"></i>
            </span>
            <h2 className="font-serif text-[28px] md:text-[32px] leading-none">Your bag is empty</h2>
            <p className="text-[15px] leading-relaxed text-[#6B565B] max-w-[420px]">Looks like you haven&#39;t added anything to your bag yet.</p>
            <Link
              href="/shop"
              className="mt-2 inline-flex items-center justify-center min-h-[54px] px-8 rounded-full bg-[#2B0B12] text-[#F6EDE3] font-semibold whitespace-nowrap hover:bg-[#4A1520] active:scale-[0.98] transition-[background-color,transform] motion-reduce:transition-none motion-reduce:active:scale-100"
            >
              Continue shopping
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)] gap-10 lg:gap-16 items-start">
            <div className="flex flex-col gap-12 min-w-0">
              <div>
                {cartItems.length > 0 ? (
                  <ul className="list-none m-0 p-0 border-t border-[#1F1115]/14" aria-label="Items in your bag">
                    {cartItems.map((item) => {
                      const minQty = item.moq || 1;
                      const atMin = item.quantity <= minQty;
                      return (
                        <li
                          key={`${item.id}-${item.variant || ''}`}
                          className="grid grid-cols-[96px_minmax(0,1fr)] sm:grid-cols-[150px_minmax(0,1fr)_auto] gap-4 sm:gap-7 items-center py-6 sm:py-7 border-b border-[#1F1115]/14"
                        >
                          <Link href={`/product/${item.slug || item.id}`} className={thumbClass} aria-label={item.name}>
                            <span aria-hidden="true" className="absolute inset-[6px] sm:inset-[7px] rounded-[12px] shadow-[inset_0_0_0_1px_rgba(74,21,32,0.22)] pointer-events-none z-10"></span>
                            <Image src={item.image} alt="" fill className="object-contain p-[13%] mix-blend-multiply" sizes="(max-width: 640px) 96px, 150px" quality={70} />
                          </Link>

                          <div className="flex flex-col gap-1.5 sm:gap-2 min-w-0">
                            <div className="flex items-start justify-between gap-3">
                              <Link href={`/product/${item.slug || item.id}`} className="font-serif text-[19px] sm:text-[24px] leading-[1.1] line-clamp-2 hover:text-[#7A1F2E] transition-colors motion-reduce:transition-none">
                                {item.name}
                              </Link>
                              <span className="sm:hidden font-semibold tabular-nums whitespace-nowrap">GH₵{money(item.price * item.quantity)}</span>
                            </div>

                            <div className="text-[13px] sm:text-sm text-[#6B565B] flex flex-col gap-0.5">
                              {item.variant && <span>{item.variant}</span>}
                              <span className="tabular-nums">GH₵{money(item.price)} each</span>
                              {minQty > 1 && <span className="text-[#7A1F2E]">Minimum order: {minQty} units</span>}
                            </div>

                            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2">
                              <div role="group" aria-label={`Quantity for ${item.name}`} className="inline-flex items-center h-[46px] rounded-full shadow-[inset_0_0_0_1px_rgba(31,17,21,0.22)]">
                                <button
                                  type="button"
                                  onClick={() => updateQuantity(item.id, item.quantity - 1, item.variant)}
                                  className="w-11 h-[46px] inline-flex items-center justify-center rounded-l-full text-[#1F1115] hover:bg-[#1F1115]/5 transition-colors motion-reduce:transition-none cursor-pointer"
                                  title={atMin ? 'Remove item' : 'Decrease quantity'}
                                  aria-label={atMin ? 'Remove item' : 'Decrease quantity'}
                                >
                                  {atMin ? (
                                    <i className="ri-delete-bin-line text-[#7A1F2E]" aria-hidden="true"></i>
                                  ) : (
                                    <i className="ri-subtract-line" aria-hidden="true"></i>
                                  )}
                                </button>
                                <input
                                  type="number"
                                  aria-label="Quantity"
                                  value={item.quantity}
                                  onChange={(e) => updateQuantity(item.id, parseInt(e.target.value) || (item.moq || 1), item.variant)}
                                  className="w-10 h-[46px] bg-transparent text-center text-[16px] font-semibold tabular-nums outline-none focus-visible:underline [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
                                  min={item.moq || 1}
                                  max={item.maxStock > 0 ? item.maxStock : undefined}
                                />
                                <button
                                  type="button"
                                  onClick={() => updateQuantity(item.id, item.quantity + 1, item.variant)}
                                  aria-label="Increase quantity"
                                  className="w-11 h-[46px] inline-flex items-center justify-center rounded-r-full text-[#1F1115] hover:bg-[#1F1115]/5 transition-colors motion-reduce:transition-none cursor-pointer"
                                >
                                  <i className="ri-add-line" aria-hidden="true"></i>
                                </button>
                              </div>
                              <button
                                type="button"
                                onClick={() => removeFromCart(item.id, item.variant)}
                                className={textLink}
                                aria-label={`Remove ${item.name}`}
                              >
                                Remove
                              </button>
                              <button
                                type="button"
                                onClick={() => saveForLater(item.id, item.variant)}
                                className={`${textLink} whitespace-nowrap`}
                              >
                                Save for later
                              </button>
                            </div>
                          </div>

                          <span className="hidden sm:block self-start pt-1 text-[18px] font-semibold tabular-nums whitespace-nowrap">GH₵{money(item.price * item.quantity)}</span>
                        </li>
                      );
                    })}
                  </ul>
                ) : (
                  <p className="m-0 py-6 border-y border-[#1F1115]/14 text-[15px] text-[#6B565B]">Your bag is empty. Items you saved for later are below.</p>
                )}

                <Link href="/shop" className="inline-flex items-center gap-2.5 min-h-[44px] mt-5 text-[15px] font-semibold hover:text-[#7A1F2E] transition-colors motion-reduce:transition-none">
                  <i className="ri-arrow-left-line text-lg" aria-hidden="true"></i>
                  Keep shopping
                </Link>
              </div>

              {savedItems.length > 0 && (
                <section aria-labelledby="saved-heading" className="flex flex-col gap-5">
                  <h2 id="saved-heading" className="font-serif text-[26px] md:text-[28px] leading-none">
                    Saved for later <span className="font-sans text-[15px] text-[#6B565B] tabular-nums">({savedItems.length})</span>
                  </h2>
                  <ul className="list-none m-0 p-0 grid grid-cols-1 sm:grid-cols-2 gap-3">
                    {savedItems.map((item) => (
                      <li key={`${item.id}-${item.variant || ''}`} className="grid grid-cols-[72px_minmax(0,1fr)] gap-4 items-center p-3 pr-4 rounded-[20px] bg-[#FBF6EF] shadow-[inset_0_0_0_1px_rgba(31,17,21,0.1)]">
                        <span className="relative flex items-center justify-center w-[72px] h-[88px] rounded-[14px] bg-white overflow-hidden">
                          <Image src={item.image} alt={item.name} fill className="object-contain p-[12%]" sizes="72px" quality={60} />
                        </span>
                        <span className="flex flex-col gap-0.5 min-w-0">
                          <span className="font-serif text-[18px] leading-tight line-clamp-2">{item.name}</span>
                          {item.variant && <span className="text-[13px] text-[#6B565B]">{item.variant}</span>}
                          <span className="font-semibold tabular-nums">GH₵{money(item.price)}</span>
                          <button
                            type="button"
                            onClick={() => moveToCart(item.id, item.variant)}
                            className="self-start inline-flex items-center min-h-[44px] text-sm font-semibold text-[#7A1F2E] underline underline-offset-4 decoration-[#7A1F2E]/40 hover:decoration-[#7A1F2E] transition-colors motion-reduce:transition-none"
                          >
                            Move to bag
                          </button>
                        </span>
                      </li>
                    ))}
                  </ul>
                </section>
              )}
            </div>

            <aside aria-label="Order summary" className="lg:sticky lg:top-[112px] flex flex-col gap-6 p-6 sm:p-9 rounded-[28px] bg-[#2B0B12] text-[#F6EDE3]">
              <h2 className="font-serif text-[28px] md:text-[29px] leading-none">Summary</h2>

              {/* The coupon form keeps its own light styling, so it sits on a cream panel. */}
              <div className="rounded-[18px] bg-[#F6EDE3] text-[#1F1115] p-4">
                <AdvancedCouponSystem
                  subtotal={subtotal}
                  onApply={applyCoupon}
                  onRemove={removeCoupon}
                  appliedCoupon={appliedCoupon}
                />
              </div>

              <dl className="m-0 flex flex-col gap-3 text-[15px]">
                <div className="flex justify-between gap-4">
                  <dt className="text-[#E3CFC7]">Subtotal</dt>
                  <dd className="m-0 tabular-nums">GH₵{money(subtotal)}</dd>
                </div>
                {appliedCoupon && (
                  <div className="flex justify-between gap-4">
                    <dt className="text-[#E5B65A]">Coupon ({appliedCoupon.code})</dt>
                    <dd className="m-0 text-[#E5B65A] tabular-nums">-GH₵{money(couponDiscount)}</dd>
                  </div>
                )}
                <div className="flex justify-between gap-4">
                  <dt className="text-[#E3CFC7]">Delivery</dt>
                  <dd className="m-0 text-right text-[#E3CFC7]">Arranged after your order</dd>
                </div>
                <div className="flex justify-between items-baseline gap-4 pt-3.5 border-t border-[#F6EDE3]/14">
                  <dt className="font-serif text-[20px]">Total</dt>
                  <dd className="m-0 text-[22px] font-semibold tabular-nums">GH₵{money(total)}</dd>
                </div>
              </dl>

              <div className="flex flex-col gap-2">
                <Link
                  href="/checkout"
                  className="flex items-center justify-center min-h-[58px] rounded-full bg-[#D9A441] text-[#2B0B12] text-[15px] font-bold whitespace-nowrap hover:bg-[#E5B65A] active:scale-[0.99] transition-[background-color,transform] motion-reduce:transition-none motion-reduce:active:scale-100"
                >
                  Check out
                </Link>
                <Link
                  href="/shop"
                  className="flex items-center justify-center min-h-[48px] text-sm font-semibold text-[#F6EDE3] underline underline-offset-4 decoration-[#F6EDE3]/40 hover:decoration-[#F6EDE3] whitespace-nowrap"
                >
                  Continue shopping
                </Link>
              </div>

              <ul className="list-none m-0 p-0 pt-5 border-t border-[#F6EDE3]/14 flex flex-col gap-2.5 text-[13px] text-[#CDB5AD]">
                <li className="flex items-center gap-2.5"><i className="ri-shield-check-line text-base text-[#E5B65A]" aria-hidden="true"></i>Secure checkout</li>
                <li className="flex items-center gap-2.5"><i className="ri-smartphone-line text-base text-[#E5B65A]" aria-hidden="true"></i>Pay with Mobile Money</li>
                <li className="flex items-center gap-2.5"><i className="ri-customer-service-line text-base text-[#E5B65A]" aria-hidden="true"></i>Help from our Accra team</li>
              </ul>
            </aside>
          </div>
        )}
      </section>
    </main>
  );
}
