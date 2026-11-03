import { NextResponse } from 'next/server';
import { evaluateCoupon } from '@/lib/coupons';
import { checkRateLimit, getClientIdentifier } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';

/** Lets the cart preview a coupon. The order API re-checks it, so this is display only. */
export async function POST(request: Request) {
  // Tight limit so codes can't be guessed by brute force.
  const limit = checkRateLimit(`coupon:${getClientIdentifier(request)}`, { maxRequests: 15, windowSeconds: 600 });
  if (!limit.success) {
    return NextResponse.json({ ok: false, error: 'Too many attempts. Please wait a few minutes.' }, { status: 429 });
  }
  const body = await request.json().catch(() => ({}));
  const subtotal = Number(body?.subtotal);
  const result = await evaluateCoupon(body?.code, Number.isFinite(subtotal) && subtotal > 0 ? subtotal : 0);
  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}
