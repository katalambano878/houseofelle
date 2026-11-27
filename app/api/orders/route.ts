import { NextResponse } from 'next/server';
import { randomInt } from 'crypto';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { verifyAuth } from '@/lib/auth';
import { verifyRecaptcha } from '@/lib/recaptcha';
import { checkRateLimit, getClientIdentifier, RATE_LIMITS } from '@/lib/rate-limit';
import { evaluateCoupon, recordCouponUse } from '@/lib/coupons';
import { DELIVERY_METHOD_IDS } from '@/lib/delivery';
import { syncCampaigns } from '@/lib/discounts';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
const MAX_ITEMS = 50;
const MAX_QTY = 1000;
const PAYMENT_METHODS = new Set(['moolre', 'zoepay']);

type CartLine = { id?: unknown; variantId?: unknown; variant?: unknown; quantity?: unknown };

function text(v: unknown, max = 200): string {
  return typeof v === 'string' ? v.trim().slice(0, max) : '';
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

/** Picks the variant a cart line refers to. Labels look like "Name" or "Colour / Name". */
function matchVariant(variants: any[], line: CartLine): any | null {
  const variantId = text(line.variantId, 64);
  if (variantId) return variants.find((v) => v.id === variantId) || null;
  const label = text(line.variant);
  if (!label) return null;
  const exact = variants.find((v) => v.name === label);
  if (exact) return exact;
  const [colour, name] = label.includes(' / ') ? label.split(' / ') : ['', label];
  return (
    variants.find((v) => v.name === name && (!colour || (v.option2 || '') === colour)) ||
    variants.find((v) => (v.option2 || '') === label) ||
    null
  );
}

/**
 * Creates an order from the cart. Prices, totals and stock come from the
 * database; the browser only says which products and how many.
 */
export async function POST(request: Request) {
  const limit = checkRateLimit(`order:${getClientIdentifier(request)}`, RATE_LIMITS.orderCreate);
  if (!limit.success) {
    return NextResponse.json({ error: 'Too many orders from this network. Please wait a few minutes.' }, { status: 429 });
  }

  const body = await request.json().catch(() => null);
  if (!body || typeof body !== 'object') {
    return NextResponse.json({ error: 'Invalid request' }, { status: 400 });
  }

  const captcha = await verifyRecaptcha(text(body.recaptchaToken, 4000), 'checkout');
  if (!captcha.success) {
    return NextResponse.json({ error: 'Security check failed. Please try again.' }, { status: 403 });
  }

  // Signed-in shoppers get the order on their account; guests stay anonymous.
  let userId: string | null = null;
  if (request.headers.get('authorization')) {
    const auth = await verifyAuth(request);
    if (auth.authenticated && auth.user?.id) userId = auth.user.id;
  }

  const s = body.shipping || {};
  const shipping = {
    firstName: text(s.firstName, 80),
    lastName: text(s.lastName, 80),
    email: text(s.email, 254).toLowerCase(),
    phone: text(s.phone, 30),
    address: text(s.address, 300),
    city: text(s.city, 100),
    region: text(s.region, 100),
  };
  const missing = Object.entries(shipping).filter(([, v]) => !v).map(([k]) => k);
  if (missing.length) {
    return NextResponse.json({ error: `Please fill in: ${missing.join(', ')}` }, { status: 400 });
  }
  if (!EMAIL_RE.test(shipping.email)) {
    return NextResponse.json({ error: 'Enter a valid email address.' }, { status: 400 });
  }
  if (shipping.phone.replace(/\D/g, '').length < 9) {
    return NextResponse.json({ error: 'Enter a valid phone number.' }, { status: 400 });
  }

  const shippingMethod = DELIVERY_METHOD_IDS.has(body.shippingMethod) ? body.shippingMethod : 'pickup';
  const paymentMethod = PAYMENT_METHODS.has(body.paymentMethod) ? body.paymentMethod : 'moolre';

  const lines: CartLine[] = Array.isArray(body.items) ? body.items : [];
  if (lines.length === 0) {
    return NextResponse.json({ error: 'Your cart is empty.' }, { status: 400 });
  }
  if (lines.length > MAX_ITEMS) {
    return NextResponse.json({ error: 'Too many different items in one order.' }, { status: 400 });
  }

  const productIds = Array.from(new Set(lines.map((l) => text(l.id, 64)).filter((id) => UUID_RE.test(id))));
  if (productIds.length !== new Set(lines.map((l) => text(l.id, 64))).size) {
    return NextResponse.json(
      { error: 'Some items in your cart are out of date. Please remove them and add them again.' },
      { status: 400 }
    );
  }

  // Start or end any sale that is due, so the price charged matches the sale on now.
  await syncCampaigns();

  const { data: products, error: productError } = await supabaseAdmin
    .from('products')
    .select('id, name, slug, price, quantity, track_quantity, continue_selling, status, moq, metadata, product_images(url, position), product_variants(id, name, price, quantity, option2)')
    .in('id', productIds);
  if (productError) {
    console.error('[Orders] Product lookup failed:', productError.message);
    return NextResponse.json({ error: 'Could not check your cart. Please try again.' }, { status: 500 });
  }
  const byId = new Map<string, any>((products || []).map((p: any) => [p.id, p]));

  const items: any[] = [];
  for (const line of lines) {
    const product = byId.get(text(line.id, 64));
    if (!product || product.status !== 'active') {
      return NextResponse.json(
        { error: 'An item in your cart is no longer available. Please remove it and try again.' },
        { status: 409 }
      );
    }
    const quantity = Math.floor(Number(line.quantity));
    if (!Number.isFinite(quantity) || quantity < 1 || quantity > MAX_QTY) {
      return NextResponse.json({ error: `Check the quantity for ${product.name}.` }, { status: 400 });
    }
    const moq = Math.max(1, Number(product.moq) || 1);
    if (quantity < moq) {
      return NextResponse.json({ error: `${product.name} has a minimum order of ${moq}.` }, { status: 400 });
    }

    const variants = product.product_variants || [];
    const variant = variants.length ? matchVariant(variants, line) : null;
    if (variants.length && (text(line.variant) || text(line.variantId, 64)) && !variant) {
      return NextResponse.json(
        { error: `The option you picked for ${product.name} has changed. Please choose it again.` },
        { status: 409 }
      );
    }

    const unitPrice = Number(variant ? variant.price : product.price);
    if (!Number.isFinite(unitPrice) || unitPrice < 0) {
      return NextResponse.json({ error: `${product.name} has no valid price.` }, { status: 409 });
    }

    const stock = Number(variant ? variant.quantity : product.quantity) || 0;
    const tracksStock = product.track_quantity !== false && !product.continue_selling;
    if (tracksStock && quantity > stock) {
      return NextResponse.json(
        { error: stock > 0 ? `Only ${stock} of ${product.name} left in stock.` : `${product.name} is out of stock.` },
        { status: 409 }
      );
    }

    const images = [...(product.product_images || [])].sort((a: any, b: any) => (a.position ?? 0) - (b.position ?? 0));
    items.push({
      product_id: product.id,
      variant_id: variant?.id || null,
      product_name: product.name,
      variant_name: text(line.variant) || variant?.name || null,
      quantity,
      unit_price: round2(unitPrice),
      total_price: round2(unitPrice * quantity),
      metadata: {
        image: images[0]?.url || null,
        slug: product.slug,
        preorder_shipping: product.metadata?.preorder_shipping || null,
      },
    });
  }

  const subtotal = round2(items.reduce((sum, i) => sum + i.total_price, 0));
  const shippingTotal = 0; // Doorstep / outside-Accra fees are quoted by phone and paid separately.

  let discountTotal = 0;
  let couponCode: string | null = null;
  if (body.couponCode) {
    const coupon = await evaluateCoupon(body.couponCode, subtotal);
    if (!coupon.ok) {
      return NextResponse.json({ error: coupon.error || 'This coupon code is not valid.' }, { status: 400 });
    }
    discountTotal = coupon.discount;
    couponCode = coupon.code || null;
  }
  const total = round2(subtotal - discountTotal + shippingTotal);
  if (total <= 0) {
    return NextResponse.json({ error: 'Your order total must be above zero.' }, { status: 400 });
  }

  const orderNumber = `ORD-${Date.now()}-${randomInt(100000, 1000000)}`;
  const alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  const trackingNumber = `HOE-${Array.from({ length: 6 }, () => alphabet[randomInt(alphabet.length)]).join('')}`;

  const { data: order, error: orderError } = await supabaseAdmin
    .from('orders')
    .insert({
      order_number: orderNumber,
      user_id: userId,
      email: shipping.email,
      phone: shipping.phone,
      status: 'pending',
      payment_status: 'pending',
      currency: 'GHS',
      subtotal,
      tax_total: 0,
      shipping_total: shippingTotal,
      discount_total: discountTotal,
      total,
      shipping_method: shippingMethod,
      payment_method: paymentMethod,
      shipping_address: shipping,
      billing_address: shipping,
      metadata: {
        source: 'web',
        guest_checkout: !userId,
        first_name: shipping.firstName,
        last_name: shipping.lastName,
        tracking_number: trackingNumber,
        ...(couponCode ? { coupon_code: couponCode } : {}),
      },
    })
    .select('id, order_number, total')
    .single();
  if (orderError || !order) {
    console.error('[Orders] Insert failed:', orderError?.message);
    return NextResponse.json({ error: 'Could not place your order. Please try again.' }, { status: 500 });
  }

  const { error: itemsError } = await supabaseAdmin
    .from('order_items')
    .insert(items.map((i) => ({ ...i, order_id: order.id })));
  if (itemsError) {
    console.error('[Orders] Items insert failed:', itemsError.message);
    await supabaseAdmin.from('orders').delete().eq('id', order.id);
    return NextResponse.json({ error: 'Could not place your order. Please try again.' }, { status: 500 });
  }

  if (couponCode) {
    await recordCouponUse(couponCode).catch((err) => console.error('[Orders] Coupon count failed:', err?.message));
  }

  const { error: customerError } = await supabaseAdmin.rpc('upsert_customer_from_order', {
    p_email: shipping.email,
    p_phone: shipping.phone,
    p_full_name: `${shipping.firstName} ${shipping.lastName}`.trim(),
    p_first_name: shipping.firstName,
    p_last_name: shipping.lastName,
    p_user_id: userId,
    p_address: shipping,
  });
  if (customerError) console.error('[Orders] Customer upsert failed:', customerError.message);

  return NextResponse.json({ id: order.id, orderNumber: order.order_number, total: order.total });
}
