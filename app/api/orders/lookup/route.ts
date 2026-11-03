import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { verifyAuth } from '@/lib/auth';
import { checkRateLimit, getClientIdentifier, RATE_LIMITS } from '@/lib/rate-limit';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const ORDER_NUMBER_RE = /^ORD-\d+-\d+$/;
const TRACKING_RE = /^[A-Z]{2,4}-[A-Z0-9]{6}$/;

const ORDER_SELECT = `id, order_number, user_id, email, phone, status, payment_status, currency,
  subtotal, tax_total, shipping_total, discount_total, total, shipping_method, payment_method,
  shipping_address, billing_address, metadata, created_at, updated_at,
  order_items(id, product_id, product_name, variant_name, quantity, unit_price, total_price, metadata,
    products(slug, product_images(url, position)))`;

/**
 * Returns one order to someone entitled to see it:
 *   - anyone holding the order's id (it is in the payment link and success redirect),
 *   - the signed-in owner, or store staff,
 *   - anyone who knows the order (or tracking) number AND the email on the order.
 * Order numbers alone are guessable, so they never unlock an order by themselves.
 */
export async function POST(request: Request) {
  const limit = checkRateLimit(`order-lookup:${getClientIdentifier(request)}`, RATE_LIMITS.orderLookup);
  if (!limit.success) {
    return NextResponse.json({ error: 'Too many lookups. Please wait a few minutes.' }, { status: 429 });
  }

  const body = await request.json().catch(() => ({}));
  const id = typeof body?.id === 'string' ? body.id.trim() : '';
  const ref = typeof body?.order === 'string' ? body.order.trim().toUpperCase() : '';
  const email = typeof body?.email === 'string' ? body.email.trim().toLowerCase() : '';

  let query = supabaseAdmin.from('orders').select(ORDER_SELECT);
  if (UUID_RE.test(id)) {
    query = query.eq('id', id);
  } else if (ORDER_NUMBER_RE.test(ref)) {
    query = query.eq('order_number', ref);
  } else if (TRACKING_RE.test(ref)) {
    query = query.eq('metadata->>tracking_number', ref);
  } else {
    return NextResponse.json({ error: 'Enter a valid order number.' }, { status: 400 });
  }

  const { data: order, error } = await query.maybeSingle();
  if (error) {
    // Plain-Postgres compat cannot filter on JSON paths; fall back to a direct lookup.
    if (TRACKING_RE.test(ref) && !UUID_RE.test(id)) {
      const found = await findByTrackingNumber(ref);
      if (found) return authorizeAndRespond(request, found, { email, byId: false });
    }
    return NextResponse.json({ error: 'Order not found.' }, { status: 404 });
  }
  if (!order) return NextResponse.json({ error: 'Order not found.' }, { status: 404 });

  return authorizeAndRespond(request, order, { email, byId: UUID_RE.test(id) });
}

async function findByTrackingNumber(ref: string) {
  try {
    const { query } = await import('@/lib/db/pool');
    const { rows } = await query<{ id: string }>(
      `SELECT id FROM orders WHERE metadata->>'tracking_number' = $1 LIMIT 1`,
      [ref]
    );
    if (!rows[0]) return null;
    const { data } = await supabaseAdmin.from('orders').select(ORDER_SELECT).eq('id', rows[0].id).maybeSingle();
    return data;
  } catch {
    return null;
  }
}

async function authorizeAndRespond(
  request: Request,
  order: any,
  { email, byId }: { email: string; byId: boolean }
) {
  let allowed = byId || (!!email && String(order.email || '').toLowerCase() === email);

  if (!allowed && request.headers.get('authorization')) {
    const auth = await verifyAuth(request);
    if (auth.authenticated && auth.user?.id) {
      allowed = order.user_id === auth.user.id;
      if (!allowed) {
        const staff = await verifyAuth(request, { requireAdmin: true });
        allowed = staff.authenticated;
      }
    }
  }

  if (!allowed) {
    // Same answer as "not found" so the endpoint can't confirm which order numbers exist.
    return NextResponse.json(
      { error: email ? 'No order matches that number and email.' : 'Enter the email you used for this order.' },
      { status: 404 }
    );
  }

  const { user_id: _userId, ...safe } = order;
  return NextResponse.json({ order: safe });
}
