import { supabaseAdmin } from '@/lib/supabase-admin';

export interface CouponResult {
  ok: boolean;
  error?: string;
  code?: string;
  type?: string;
  discount: number;
  description?: string;
}

const CODE_RE = /^[A-Z0-9_-]{2,40}$/;

/** Checks a coupon against the coupons table and works out the discount for this subtotal. */
export async function evaluateCoupon(rawCode: unknown, subtotal: number): Promise<CouponResult> {
  const code = typeof rawCode === 'string' ? rawCode.trim().toUpperCase() : '';
  if (!CODE_RE.test(code)) return { ok: false, error: 'Enter a valid coupon code.', discount: 0 };

  const { data: coupon } = await supabaseAdmin
    .from('coupons')
    .select('id, code, type, value, minimum_purchase, maximum_discount, usage_limit, usage_count, start_date, end_date, is_active, description')
    .eq('code', code)
    .maybeSingle();

  if (!coupon || !coupon.is_active) return { ok: false, error: 'This coupon code is not valid.', discount: 0 };
  const now = Date.now();
  if (coupon.start_date && new Date(coupon.start_date).getTime() > now) {
    return { ok: false, error: 'This coupon is not active yet.', discount: 0 };
  }
  if (coupon.end_date && new Date(coupon.end_date).getTime() < now) {
    return { ok: false, error: 'This coupon has expired.', discount: 0 };
  }
  if (coupon.usage_limit != null && Number(coupon.usage_count || 0) >= Number(coupon.usage_limit)) {
    return { ok: false, error: 'This coupon has been fully used.', discount: 0 };
  }
  const minimum = Number(coupon.minimum_purchase || 0);
  if (subtotal < minimum) {
    return { ok: false, error: `Spend at least GH₵${minimum.toFixed(2)} to use this coupon.`, discount: 0 };
  }

  const value = Number(coupon.value) || 0;
  let discount = 0;
  if (coupon.type === 'percentage') {
    discount = (subtotal * Math.min(Math.max(value, 0), 100)) / 100;
    if (coupon.maximum_discount != null) discount = Math.min(discount, Number(coupon.maximum_discount));
  } else if (coupon.type === 'fixed_amount') {
    discount = value;
  }
  discount = Math.round(Math.min(Math.max(discount, 0), subtotal) * 100) / 100;

  const description =
    coupon.description ||
    (coupon.type === 'percentage'
      ? `${value}% off`
      : coupon.type === 'fixed_amount'
        ? `GH₵${value.toFixed(2)} off`
        : 'Free delivery');

  return { ok: true, code: coupon.code, type: coupon.type, discount, description };
}

/** Counts one use of a coupon after an order is placed. */
export async function recordCouponUse(code: string): Promise<void> {
  const { data } = await supabaseAdmin.from('coupons').select('id, usage_count').eq('code', code).maybeSingle();
  if (!data) return;
  await supabaseAdmin
    .from('coupons')
    .update({ usage_count: Number(data.usage_count || 0) + 1, updated_at: new Date().toISOString() })
    .eq('id', data.id);
}
