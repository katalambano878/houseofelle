'use client';

import { useState } from 'react';

export interface AppliedCoupon {
  code: string;
  discount: number;
  description: string;
}

interface AdvancedCouponSystemProps {
  subtotal: number;
  onApply: (coupon: AppliedCoupon) => void;
  onRemove: () => void;
  appliedCoupon: AppliedCoupon | null;
}

/** Fetches a coupon preview from the server. Checkout re-checks it when the order is placed. */
export async function checkCoupon(code: string, subtotal: number): Promise<AppliedCoupon> {
  const res = await fetch('/api/coupons/validate', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ code, subtotal }),
  });
  const result = await res.json().catch(() => ({}));
  if (!res.ok || !result.ok) throw new Error(result.error || 'This coupon code is not valid.');
  return { code: result.code, discount: Number(result.discount) || 0, description: result.description || '' };
}

export default function AdvancedCouponSystem({
  subtotal,
  onApply,
  onRemove,
  appliedCoupon,
}: AdvancedCouponSystemProps) {
  const [couponCode, setCouponCode] = useState('');
  const [error, setError] = useState('');
  const [checking, setChecking] = useState(false);

  const handleApply = async () => {
    const code = couponCode.trim();
    if (!code) {
      setError('Enter a coupon code.');
      return;
    }
    setError('');
    setChecking(true);
    try {
      onApply(await checkCoupon(code, subtotal));
      setCouponCode('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'This coupon code is not valid.');
    } finally {
      setChecking(false);
    }
  };

  if (appliedCoupon) {
    return (
      <div className="bg-blue-50 border-2 border-blue-200 rounded-lg p-4">
        <div className="flex items-center justify-between">
          <div>
            <div className="flex items-center space-x-2 mb-1">
              <i className="ri-price-tag-3-fill text-blue-700" aria-hidden="true"></i>
              <span className="font-bold text-blue-800">{appliedCoupon.code}</span>
            </div>
            <p className="text-sm text-blue-700">{appliedCoupon.description}</p>
          </div>
          <button
            type="button"
            onClick={onRemove}
            aria-label="Remove coupon"
            className="w-8 h-8 flex items-center justify-center text-blue-700 hover:text-blue-900 transition-colors"
          >
            <i className="ri-close-line text-xl" aria-hidden="true"></i>
          </button>
        </div>
      </div>
    );
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        handleApply();
      }}
    >
      <label htmlFor="coupon-code" className="block text-sm font-semibold text-gray-900 mb-2">
        Have a coupon code?
      </label>
      <div className="flex space-x-2">
        <input
          id="coupon-code"
          type="text"
          value={couponCode}
          onChange={(e) => {
            setCouponCode(e.target.value.toUpperCase());
            setError('');
          }}
          placeholder="Enter code"
          autoComplete="off"
          className="flex-1 min-w-0 px-4 py-3 border-2 border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 text-sm"
        />
        <button
          type="submit"
          disabled={checking}
          className="bg-gray-900 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-semibold transition-colors whitespace-nowrap disabled:opacity-60"
        >
          {checking ? 'Checking…' : 'Apply'}
        </button>
      </div>
      {error && (
        <p className="text-sm text-red-600 mt-2 flex items-center" role="alert">
          <i className="ri-error-warning-line mr-1" aria-hidden="true"></i>
          {error}
        </p>
      )}
    </form>
  );
}
