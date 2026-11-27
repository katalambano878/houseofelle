import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { checkRateLimit, getClientIdentifier, RATE_LIMITS } from '@/lib/rate-limit';
import { createZoePayment, toMsisdn, zoeEnabled } from '@/lib/zoepay';

/** Opens a Zoe Pay checkout (card or Mobile Money) for an order. The amount always comes from the saved order. */
export async function POST(req: Request) {
  try {
    const rate = checkRateLimit(`payment:${getClientIdentifier(req)}`, RATE_LIMITS.payment);
    if (!rate.success) {
      return NextResponse.json({ success: false, message: 'Too many requests. Please try again later.' }, { status: 429 });
    }

    if (!zoeEnabled()) {
      return NextResponse.json({ success: false, message: 'Card payments are not available right now.' }, { status: 503 });
    }

    const body = await req.json().catch(() => ({}));
    const orderId = typeof body?.orderId === 'string' ? body.orderId.trim() : '';
    const isUuid = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(orderId);
    if (!isUuid && !/^ORD-\d+-\d+$/.test(orderId)) {
      return NextResponse.json({ success: false, message: 'Missing or invalid orderId' }, { status: 400 });
    }

    const { data: order, error } = await supabaseAdmin
      .from('orders')
      .select('id, order_number, total, email, phone, payment_status, status, metadata, shipping_address')
      .eq(isUuid ? 'id' : 'order_number', orderId)
      .single();
    if (error || !order) {
      return NextResponse.json({ success: false, message: 'Order not found' }, { status: 404 });
    }
    if (order.payment_status === 'paid') {
      return NextResponse.json({ success: false, message: 'Order is already paid' }, { status: 400 });
    }
    if (order.status === 'cancelled' || order.status === 'refunded') {
      return NextResponse.json({ success: false, message: 'This order was cancelled. Please place a new order.' }, { status: 400 });
    }

    const amount = Number(order.total);
    if (!amount || amount <= 0) {
      return NextResponse.json({ success: false, message: 'Invalid order amount' }, { status: 400 });
    }

    const phone = toMsisdn(order.phone || order.shipping_address?.phone);
    if (!phone) {
      return NextResponse.json({ success: false, message: 'This order needs a valid Ghana phone number before we can take payment.' }, { status: 400 });
    }

    const orderRef = order.order_number;
    const baseUrl = (process.env.NEXT_PUBLIC_APP_URL || new URL(req.url).origin).replace(/\/+$/, '');
    const clientRef = `${orderRef}-Z${Date.now()}`;
    const meta = order.metadata || {};
    const name = [meta.first_name, meta.last_name].filter(Boolean).join(' ') || 'House of Elle customer';

    const res = await createZoePayment({
      clientReference: clientRef,
      amount,
      description: `House of Elle order ${orderRef}`,
      customer: { name: name.slice(0, 120), email: order.email || `${phone}@customers.houseofelle.store`, phone },
      returnUrl: `${baseUrl}/order-success?order=${encodeURIComponent(orderRef)}&id=${order.id}&payment_success=true`,
      cancellationUrl: `${baseUrl}/pay/${order.id}`,
      callbackUrl: `${baseUrl}/api/payment/zoepay/webhook`,
      metadata: { order_number: orderRef },
    });

    if (!res.ok) {
      console.error('[ZoePay] Could not open checkout for', orderRef, '-', res.message);
      return NextResponse.json({ success: false, message: res.message || 'Failed to open the payment page' }, { status: 400 });
    }

    // Remember the attempt so verify and the webhook can ask Zoe Pay about it.
    await supabaseAdmin
      .from('orders')
      .update({ payment_method: 'zoepay', metadata: { ...meta, payment_method: 'zoepay', zoepay_client_ref: clientRef } })
      .eq('id', order.id);

    return NextResponse.json({ success: true, url: res.data.checkoutUrl, reference: res.data.reference });
  } catch (err: any) {
    console.error('[ZoePay] Payment API error:', err?.message);
    return NextResponse.json({ success: false, message: 'Internal Server Error' }, { status: 500 });
  }
}
