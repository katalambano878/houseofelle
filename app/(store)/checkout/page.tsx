'use client';

import PaymentChoice, { paymentEndpoint, usePaymentGateways, type PaymentGateway } from '@/components/PaymentChoice';
import Link from 'next/link';
import { money } from '@/lib/format-money';
import { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import CheckoutSteps from '@/components/CheckoutSteps';
import OrderSummary from '@/components/OrderSummary';
import { checkCoupon, type AppliedCoupon } from '@/components/AdvancedCouponSystem';
import { DELIVERY_OPTIONS } from '@/lib/delivery';
import { useCart } from '@/context/CartContext';
import { supabase } from '@/lib/supabase';
import { usePageTitle } from '@/hooks/usePageTitle';
import { useRecaptcha } from '@/hooks/useRecaptcha';

export default function CheckoutPage() {
  usePageTitle('Checkout');
  const router = useRouter();
  const { cart, subtotal: cartSubtotal, clearCart } = useCart();

  const [currentStep, setCurrentStep] = useState(1);
  const [isLoading, setIsLoading] = useState(false);
  const [checkoutType, setCheckoutType] = useState<'guest' | 'account'>('guest');
  const [saveAddress, setSaveAddress] = useState(false);
  const [savePayment, setSavePayment] = useState(false);
  const [user, setUser] = useState<any>(null);
  const { getRawToken, verifying } = useRecaptcha();

  const [shippingData, setShippingData] = useState({
    firstName: '',
    lastName: '',
    email: '',
    phone: '',
    address: '',
    city: '',
    region: ''
  });

  // Ghana Regions for dropdown
  const ghanaRegions = [
    'Greater Accra',
    'Ashanti',
    'Western',
    'Central',
    'Eastern',
    'Northern',
    'Volta',
    'Upper East',
    'Upper West',
    'Brong-Ahafo',
    'Ahafo',
    'Bono',
    'Bono East',
    'North East',
    'Savannah',
    'Oti',
    'Western North'
  ];

  const [deliveryMethod, setDeliveryMethod] = useState('pickup');
  const [paymentMethod, setPaymentMethod] = useState<PaymentGateway>('moolre');
  const gateways = usePaymentGateways();
  useEffect(() => {
    if (!gateways.includes(paymentMethod)) setPaymentMethod(gateways[0]);
  }, [gateways, paymentMethod]);
  const [errors, setErrors] = useState<any>({});



  // Check auth and cart
  useEffect(() => {
    async function checkUser() {
      const { data: { session } } = await supabase.auth.getSession();
      if (session?.user) {
        setUser(session.user);
        setCheckoutType('account'); // Auto-select account checkout if logged in
        // Pre-fill email if available
        setShippingData(prev => ({ ...prev, email: session.user.email || '' }));
        const { data: saved } = await supabase
          .from('addresses')
          .select('full_name, phone, address_line1, city, state, is_default')
          .order('is_default', { ascending: false })
          .limit(1);
        const addr = saved?.[0];
        if (addr) {
          const [firstName, ...rest] = String(addr.full_name || '').split(' ');
          setShippingData(prev => ({
            ...prev,
            firstName: prev.firstName || firstName || '',
            lastName: prev.lastName || rest.join(' '),
            phone: prev.phone || addr.phone || '',
            address: prev.address || addr.address_line1 || '',
            city: prev.city || addr.city || '',
            region: prev.region || addr.state || '',
          }));
        }
      }
    }
    checkUser();

    // Small delay to ensure cart load
    const timer = setTimeout(() => {
      if (cart.length === 0 && !isLoading) {
        // router.push('/cart'); // Optional: redirect if empty
      }
    }, 500);
    return () => clearTimeout(timer);
  }, [cart, router, isLoading]);

  // Scroll to top when step changes
  useEffect(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
  }, [currentStep]);

  // Calculate Totals
  const subtotal = cartSubtotal;
  const shippingCost = 0; // Delivery options temporarily disabled
  const tax = 0; // No Tax
  // Coupon applied in the cart; re-checked here and again by the order API.
  const [coupon, setCoupon] = useState<AppliedCoupon | null>(null);
  useEffect(() => {
    let code = '';
    try { code = localStorage.getItem('appliedCoupon') || ''; } catch {}
    if (!code || subtotal <= 0) { setCoupon(null); return; }
    let cancelled = false;
    checkCoupon(code, subtotal)
      .then((c) => { if (!cancelled) setCoupon(c); })
      .catch(() => {
        if (cancelled) return;
        setCoupon(null);
        try { localStorage.removeItem('appliedCoupon'); } catch {}
      });
    return () => { cancelled = true; };
  }, [subtotal]);
  const discount = coupon ? Math.min(coupon.discount, subtotal) : 0;
  const total = subtotal - discount + shippingCost + tax;

  const validateShipping = () => {
    const newErrors: any = {};
    if (!shippingData.firstName) newErrors.firstName = 'First name is required';
    if (!shippingData.lastName) newErrors.lastName = 'Last name is required';
    if (!shippingData.email) newErrors.email = 'Email is required';
    else if (!/\S+@\S+\.\S+/.test(shippingData.email)) newErrors.email = 'Invalid email';
    if (!shippingData.phone) newErrors.phone = 'Phone is required';
    if (!shippingData.address) newErrors.address = 'Address is required';
    if (!shippingData.city) newErrors.city = 'City is required';
    if (!shippingData.region) newErrors.region = 'Region is required';

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const handleContinueToDelivery = () => {
    if (validateShipping()) {
      setCurrentStep(2);
    }
  };

  const handleContinueToPayment = async () => {
    // Skip step 3 and directly initiate payment with default method (Moolre/Mobile Money)
    await handlePlaceOrder();
  };



  const handlePlaceOrder = async () => {
    if (cart.length === 0) {
      alert('Your cart is empty');
      return;
    }

    setIsLoading(true);

    // reCAPTCHA token is verified by the order API
    const recaptchaToken = await getRawToken('checkout');
    if (recaptchaToken === null) {
      alert('Security verification failed. Please try again.');
      setIsLoading(false);
      return;
    }

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const headers: Record<string, string> = { 'Content-Type': 'application/json' };
      if (session?.access_token) headers.Authorization = `Bearer ${session.access_token}`;

      // 1. Create the order. The server prices it from the catalogue, not from the cart.
      const orderRes = await fetch('/api/orders', {
        method: 'POST',
        headers,
        body: JSON.stringify({
          recaptchaToken,
          shipping: shippingData,
          shippingMethod: deliveryMethod,
          paymentMethod,
          couponCode: coupon?.code,
          items: cart.map(item => ({
            id: item.id,
            variantId: item.variantId,
            variant: item.variant,
            quantity: item.quantity,
          })),
        }),
      });
      const created = await orderRes.json().catch(() => ({}));
      if (!orderRes.ok) {
        throw new Error(created.error || 'Could not place your order');
      }

      // Save the address to the shopper's address book if they asked to (best effort).
      if (user && saveAddress) {
        await supabase.from('addresses').insert({
          full_name: `${shippingData.firstName} ${shippingData.lastName}`.trim(),
          phone: shippingData.phone,
          address_line1: shippingData.address,
          city: shippingData.city,
          state: shippingData.region,
          postal_code: '',
          country: 'Ghana',
          type: 'shipping',
        });
      }

      // 2. Start the payment with the chosen gateway (amount is read from the saved order)
      const paymentRes = await fetch(paymentEndpoint(paymentMethod), {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ orderId: created.id })
      });
      const paymentResult = await paymentRes.json().catch(() => ({}));

      if (!paymentResult.success) {
        // The order exists, so send the shopper to its payment page to retry.
        alert('We saved your order but could not open the payment page: ' + (paymentResult.message || 'please try again.'));
        clearCart();
        router.push(`/pay/${created.id}`);
        return;
      }

      // Clear cart before redirecting to the payment page
      clearCart();
      window.location.href = paymentResult.url;
      return;
    } catch (err: any) {
      console.error('Checkout error:', err);
      alert('Failed to place order: ' + err.message);
    } finally {
      setIsLoading(false);
    }
  };


  // Shared form styling (Oud & Saffron)
  const fieldClass = (hasError: boolean, extra = '') =>
    `w-full h-14 px-[18px] rounded-2xl bg-[#FBF6EF] text-[16px] text-[#1F1115] placeholder:text-[#8A7479] outline-none transition-shadow motion-reduce:transition-none ${
      hasError
        ? 'shadow-[inset_0_0_0_1.5px_#A1271F]'
        : 'shadow-[inset_0_0_0_1px_rgba(31,17,21,0.18)] focus:shadow-[inset_0_0_0_1.5px_#2B0B12]'
    } ${extra}`;
  const labelClass = 'text-sm font-semibold text-[#1F1115]';
  const errorClass = 'text-[13px] text-[#A1271F]';
  const legendClass = 'flex items-center gap-3.5 mb-5 p-0';
  const stepNumClass = 'flex-none w-9 h-9 rounded-full bg-[#2B0B12] text-[#F6EDE3] inline-flex items-center justify-center text-[15px] font-semibold tabular-nums';
  const itemCount = cart.reduce((n, item) => n + item.quantity, 0);

  if (cart.length === 0 && !isLoading) {
    return (
      <main className="min-h-screen bg-[#F1E8DC] text-[#1F1115]">
        <div className="max-w-[560px] mx-auto px-5 pt-20 pb-28 md:pt-28 md:pb-36 flex flex-col items-center text-center gap-5">
          <span className="w-20 h-20 rounded-full bg-[#FBF6EF] shadow-[inset_0_0_0_1px_rgba(31,17,21,0.12)] inline-flex items-center justify-center">
            <i className="ri-shopping-bag-line text-3xl text-[#7A1F2E]" aria-hidden="true"></i>
          </span>
          <h1 className="font-serif text-[36px] md:text-[44px] leading-[0.95] tracking-[-0.02em]">Your bag is <em>empty</em></h1>
          <p className="text-[15px] leading-relaxed text-[#6B565B]">Add some items to start the checkout process.</p>
          <Link
            href="/shop"
            className="mt-2 inline-flex items-center justify-center min-h-[54px] px-8 rounded-full bg-[#2B0B12] text-[#F6EDE3] font-semibold hover:bg-[#4A1520] active:scale-[0.98] transition-[background-color,transform] motion-reduce:transition-none motion-reduce:active:scale-100"
          >
            Return to shop
          </Link>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-[#F1E8DC] text-[#1F1115]">
      <div className="max-w-[1280px] mx-auto px-5 sm:px-8 lg:px-12 pt-6 md:pt-12 pb-20 md:pb-32 flex flex-col gap-8 md:gap-10">
        <div className="flex flex-col gap-5">
          <Link href="/cart" className="self-start inline-flex items-center gap-2 min-h-[44px] text-sm font-semibold text-[#1F1115] hover:text-[#7A1F2E] transition-colors motion-reduce:transition-none">
            <i className="ri-arrow-left-line text-lg" aria-hidden="true"></i>
            Back to bag
          </Link>
          <div className="flex flex-wrap items-end justify-between gap-5">
            <h1 className="font-serif text-[40px] md:text-[52px] leading-[0.95] tracking-[-0.02em]">Check<em>out</em></h1>
            <CheckoutSteps currentStep={currentStep} />
          </div>
        </div>

        {/* On phones the order sits behind a toggle at the top; on desktop it is the sticky side card. */}
        <details className="lg:hidden group rounded-[22px] bg-[#FBF6EF] shadow-[inset_0_0_0_1px_rgba(31,17,21,0.1)]">
          <summary className="flex items-center justify-between gap-4 min-h-[58px] px-5 cursor-pointer list-none [&::-webkit-details-marker]:hidden text-sm">
            <span className="inline-flex items-center gap-2">
              <span className="group-open:hidden">Show order</span>
              <span className="hidden group-open:inline">Hide order</span>
              <span className="text-[#6B565B]">· {itemCount} {itemCount === 1 ? 'item' : 'items'}</span>
              <i className="ri-arrow-down-s-line text-lg transition-transform group-open:rotate-180 motion-reduce:transition-none" aria-hidden="true"></i>
            </span>
            <span className="font-semibold tabular-nums">GH₵ {money(total)}</span>
          </summary>
          <div className="px-2 pb-2">
            <OrderSummary
              items={cart}
              subtotal={subtotal}
              shipping={shippingCost}
              tax={tax}
              total={total}
              discount={discount}
              couponCode={coupon?.code}
              deliveryMethod={deliveryMethod}
            />
          </div>
        </details>

        <div className="grid grid-cols-1 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)] gap-10 lg:gap-16 items-start">
          <div className="flex flex-col gap-10 md:gap-12 min-w-0">
            {currentStep === 1 && (
              <>
                <section aria-labelledby="checkout-as" className="flex flex-col gap-3">
                  <h2 id="checkout-as" className="text-[15px] font-semibold">Check out as</h2>
                  <div className="grid sm:grid-cols-2 gap-3">
                    <button
                      type="button"
                      onClick={() => !user && setCheckoutType('guest')}
                      aria-pressed={checkoutType === 'guest'}
                      className={`flex items-start gap-3.5 p-5 rounded-[18px] bg-[#FBF6EF] text-left transition-shadow motion-reduce:transition-none ${checkoutType === 'guest'
                        ? 'shadow-[inset_0_0_0_2px_#2B0B12]'
                        : 'shadow-[inset_0_0_0_1px_rgba(31,17,21,0.16)] hover:shadow-[inset_0_0_0_1px_rgba(31,17,21,0.4)]'
                        } ${user ? 'opacity-60 cursor-not-allowed' : 'cursor-pointer'}`}
                      disabled={!!user}
                    >
                      <span aria-hidden="true" className={`flex-none mt-0.5 w-[18px] h-[18px] rounded-full inline-flex items-center justify-center ${checkoutType === 'guest' ? 'bg-[#2B0B12]' : 'shadow-[inset_0_0_0_1.5px_rgba(31,17,21,0.35)]'}`}>
                        {checkoutType === 'guest' && <span className="w-1.5 h-1.5 rounded-full bg-[#F6EDE3]"></span>}
                      </span>
                      <span className="flex flex-col gap-1">
                        <span className="font-semibold">Guest checkout</span>
                        <span className="text-sm text-[#6B565B]">Quick checkout without creating an account</span>
                        {user && <span className="text-[13px] text-[#7A1F2E]">You are logged in</span>}
                      </span>
                    </button>

                    <button
                      type="button"
                      onClick={() => {
                        // Guests sign up first; the cart is kept and they come straight back here.
                        if (!user) {
                          router.push('/auth/signup?redirect=/checkout');
                          return;
                        }
                        setCheckoutType('account');
                      }}
                      aria-pressed={checkoutType === 'account'}
                      className={`flex items-start gap-3.5 p-5 rounded-[18px] bg-[#FBF6EF] text-left cursor-pointer transition-shadow motion-reduce:transition-none ${checkoutType === 'account'
                        ? 'shadow-[inset_0_0_0_2px_#2B0B12]'
                        : 'shadow-[inset_0_0_0_1px_rgba(31,17,21,0.16)] hover:shadow-[inset_0_0_0_1px_rgba(31,17,21,0.4)]'
                        }`}
                    >
                      <span aria-hidden="true" className={`flex-none mt-0.5 w-[18px] h-[18px] rounded-full inline-flex items-center justify-center ${checkoutType === 'account' ? 'bg-[#2B0B12]' : 'shadow-[inset_0_0_0_1.5px_rgba(31,17,21,0.35)]'}`}>
                        {checkoutType === 'account' && <span className="w-1.5 h-1.5 rounded-full bg-[#F6EDE3]"></span>}
                      </span>
                      <span className="flex flex-col gap-1 min-w-0">
                        <span className="font-semibold">{user ? 'My account' : 'Create an account'}</span>
                        <span className="text-sm text-[#6B565B] break-words">
                          {user ? `Logged in as ${user.email}` : 'Save your details and see all your orders in one place'}
                        </span>
                      </span>
                    </button>
                  </div>
                </section>

                <fieldset className="border-0 m-0 p-0 min-w-0 flex flex-col gap-4">
                  <legend className={legendClass}>
                    <span className={stepNumClass}>1</span>
                    <span className="font-serif text-[24px] md:text-[26px] leading-none">Your details</span>
                  </legend>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="flex flex-col gap-2">
                      <label htmlFor="co-first" className={labelClass}>First name</label>
                      <input
                        id="co-first"
                        type="text"
                        autoComplete="given-name"
                        value={shippingData.firstName}
                        onChange={(e) => setShippingData({ ...shippingData, firstName: e.target.value })}
                        aria-invalid={!!errors.firstName}
                        aria-describedby={errors.firstName ? 'co-first-err' : undefined}
                        className={fieldClass(!!errors.firstName)}
                        placeholder="Ama"
                      />
                      {errors.firstName && <p id="co-first-err" className={errorClass}>{errors.firstName}</p>}
                    </div>
                    <div className="flex flex-col gap-2">
                      <label htmlFor="co-last" className={labelClass}>Last name</label>
                      <input
                        id="co-last"
                        type="text"
                        autoComplete="family-name"
                        value={shippingData.lastName}
                        onChange={(e) => setShippingData({ ...shippingData, lastName: e.target.value })}
                        aria-invalid={!!errors.lastName}
                        aria-describedby={errors.lastName ? 'co-last-err' : undefined}
                        className={fieldClass(!!errors.lastName)}
                        placeholder="Mensah"
                      />
                      {errors.lastName && <p id="co-last-err" className={errorClass}>{errors.lastName}</p>}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="flex flex-col gap-2">
                      <label htmlFor="co-email" className={labelClass}>Email address</label>
                      <input
                        id="co-email"
                        type="email"
                        autoComplete="email"
                        value={shippingData.email}
                        readOnly={!!user} // Make read-only if logged in (optional, but safer)
                        onChange={(e) => setShippingData({ ...shippingData, email: e.target.value })}
                        aria-invalid={!!errors.email}
                        aria-describedby={errors.email ? 'co-email-err' : undefined}
                        className={fieldClass(!!errors.email, user ? '!bg-[#F1E8DC] text-[#4D3A3F] cursor-not-allowed' : '')}
                        placeholder="you@example.com"
                      />
                      {errors.email && <p id="co-email-err" className={errorClass}>{errors.email}</p>}
                    </div>
                    <div className="flex flex-col gap-2">
                      <label htmlFor="co-phone" className={labelClass}>Phone number</label>
                      <input
                        id="co-phone"
                        type="tel"
                        autoComplete="tel"
                        value={shippingData.phone}
                        onChange={(e) => setShippingData({ ...shippingData, phone: e.target.value })}
                        aria-invalid={!!errors.phone}
                        aria-describedby={errors.phone ? 'co-phone-err' : undefined}
                        className={fieldClass(!!errors.phone)}
                        placeholder="+233 XX XXX XXXX"
                      />
                      {errors.phone && <p id="co-phone-err" className={errorClass}>{errors.phone}</p>}
                    </div>
                  </div>

                  <div className="flex flex-col gap-2">
                    <label htmlFor="co-address" className={labelClass}>Street address</label>
                    <input
                      id="co-address"
                      type="text"
                      autoComplete="street-address"
                      value={shippingData.address}
                      onChange={(e) => setShippingData({ ...shippingData, address: e.target.value })}
                      aria-invalid={!!errors.address}
                      aria-describedby={errors.address ? 'co-address-err' : undefined}
                      className={fieldClass(!!errors.address)}
                      placeholder="House number and street name"
                    />
                    {errors.address && <p id="co-address-err" className={errorClass}>{errors.address}</p>}
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="flex flex-col gap-2">
                      <label htmlFor="co-city" className={labelClass}>City</label>
                      <input
                        id="co-city"
                        type="text"
                        autoComplete="address-level2"
                        value={shippingData.city}
                        onChange={(e) => setShippingData({ ...shippingData, city: e.target.value })}
                        aria-invalid={!!errors.city}
                        aria-describedby={errors.city ? 'co-city-err' : undefined}
                        className={fieldClass(!!errors.city)}
                        placeholder="Accra"
                      />
                      {errors.city && <p id="co-city-err" className={errorClass}>{errors.city}</p>}
                    </div>
                    <div className="flex flex-col gap-2">
                      <label htmlFor="co-region" className={labelClass}>Region</label>
                      <div className="relative">
                        <select
                          id="co-region"
                          autoComplete="address-level1"
                          value={shippingData.region}
                          onChange={(e) => setShippingData({ ...shippingData, region: e.target.value })}
                          aria-invalid={!!errors.region}
                          aria-describedby={errors.region ? 'co-region-err' : undefined}
                          className={fieldClass(!!errors.region, 'appearance-none pr-11 cursor-pointer')}
                        >
                          <option value="">Select region</option>
                          {ghanaRegions.map((region) => (
                            <option key={region} value={region}>{region}</option>
                          ))}
                        </select>
                        <i className="ri-arrow-down-s-line absolute right-4 top-1/2 -translate-y-1/2 text-lg text-[#6B565B] pointer-events-none" aria-hidden="true"></i>
                      </div>
                      {errors.region && <p id="co-region-err" className={errorClass}>{errors.region}</p>}
                    </div>
                  </div>

                  {user && checkoutType === 'account' && (
                    <label className="flex items-center gap-3 min-h-[44px] cursor-pointer">
                      <input
                        type="checkbox"
                        checked={saveAddress}
                        onChange={(e) => setSaveAddress(e.target.checked)}
                        className="w-5 h-5 rounded accent-[#2B0B12]"
                      />
                      <span className="text-sm text-[#4D3A3F]">Save this address for future orders</span>
                    </label>
                  )}

                  <button
                    type="button"
                    onClick={handleContinueToDelivery}
                    className="mt-2 w-full min-h-[58px] rounded-full bg-[#2B0B12] text-[#F6EDE3] text-[15px] font-semibold hover:bg-[#4A1520] active:scale-[0.99] transition-[background-color,transform] motion-reduce:transition-none motion-reduce:active:scale-100 cursor-pointer"
                  >
                    Continue to delivery
                  </button>
                </fieldset>
              </>
            )}

            {currentStep === 2 && (
              <>
                <fieldset className="border-0 m-0 p-0 min-w-0 flex flex-col gap-3">
                  <legend className={legendClass}>
                    <span className={stepNumClass}>2</span>
                    <span className="font-serif text-[24px] md:text-[26px] leading-none">Delivery</span>
                  </legend>
                  {DELIVERY_OPTIONS.map((option) => {
                    const selected = deliveryMethod === option.id;
                    return (
                      <label
                        key={option.id}
                        className={`flex items-start gap-3.5 p-5 rounded-[18px] bg-[#FBF6EF] cursor-pointer transition-shadow motion-reduce:transition-none focus-within:outline focus-within:outline-2 focus-within:outline-offset-2 focus-within:outline-[#7A1F2E] ${selected ? 'shadow-[inset_0_0_0_2px_#2B0B12]' : 'shadow-[inset_0_0_0_1px_rgba(31,17,21,0.16)] hover:shadow-[inset_0_0_0_1px_rgba(31,17,21,0.4)]'}`}
                      >
                        <input
                          type="radio"
                          name="delivery"
                          value={option.id}
                          checked={selected}
                          onChange={(e) => setDeliveryMethod(e.target.value)}
                          className="flex-none mt-0.5 w-[18px] h-[18px] accent-[#2B0B12] focus:outline-none"
                        />
                        <span className="flex-1 min-w-0 flex flex-col gap-1">
                          <span className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                            <span className="inline-flex items-center gap-2 font-semibold">
                              <i className={`${option.icon} text-lg text-[#7A1F2E]`} aria-hidden="true"></i>
                              {option.label}
                            </span>
                            <span className={`text-[13px] font-semibold ${option.id === 'pickup' ? 'text-[#2F6B3A]' : 'text-[#7A1F2E]'}`}>{option.feeLabel}</span>
                          </span>
                          <span className="text-sm leading-relaxed text-[#6B565B]">{option.description}</span>
                        </span>
                      </label>
                    );
                  })}
                </fieldset>

                <section aria-labelledby="checkout-payment" className="flex flex-col gap-4">
                  <h2 id="checkout-payment" className="flex items-center gap-3.5 m-0">
                    <span className={stepNumClass}>3</span>
                    <span className="font-serif text-[24px] md:text-[26px] leading-none">Payment</span>
                  </h2>
                  <PaymentChoice available={gateways} value={paymentMethod} onChange={setPaymentMethod} />

                  <div className="flex flex-col-reverse md:flex-row gap-3 mt-2">
                    <button
                      type="button"
                      onClick={() => setCurrentStep(1)}
                      disabled={isLoading}
                      className="md:flex-none md:px-8 min-h-[58px] rounded-full text-[15px] font-semibold text-[#1F1115] shadow-[inset_0_0_0_1px_rgba(31,17,21,0.25)] hover:shadow-[inset_0_0_0_1px_rgba(31,17,21,0.5)] transition-shadow motion-reduce:transition-none cursor-pointer disabled:opacity-50"
                    >
                      Back
                    </button>
                    <button
                      type="button"
                      onClick={handleContinueToPayment}
                      disabled={isLoading}
                      className="flex-1 min-h-[58px] px-6 rounded-full bg-[#2B0B12] text-[#F6EDE3] text-[15px] font-semibold hover:bg-[#4A1520] active:scale-[0.99] transition-[background-color,transform] motion-reduce:transition-none motion-reduce:active:scale-100 cursor-pointer disabled:opacity-70 inline-flex items-center justify-center"
                    >
                      {isLoading ? (
                        <>
                          <svg className="animate-spin motion-reduce:hidden -ml-1 mr-3 h-5 w-5 text-[#F6EDE3]" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" aria-hidden="true">
                            <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                            <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                          </svg>
                          Processing...
                        </>
                      ) : (
                        paymentMethod === 'zoepay' ? 'Pay by card or Mobile Money' : 'Pay with Mobile Money'
                      )}
                    </button>
                  </div>
                </section>
              </>
            )}

            {/* Step 3 removed - payment now initiates directly from step 2 */}
          </div>

          <div className="hidden lg:block">
            <OrderSummary
              items={cart}
              subtotal={subtotal}
              shipping={shippingCost}
              tax={tax}
              total={total}
              discount={discount}
              couponCode={coupon?.code}
              deliveryMethod={deliveryMethod}
            />
          </div>
        </div>
      </div>
    </main>
  );
}
