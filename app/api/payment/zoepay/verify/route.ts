import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { checkRateLimit, getClientIdentifier, RATE_LIMITS } from '@/lib/rate-limit';
import { checkZoePayment, zoeEnabled } from '@/lib/zoepay';
import { settlePaidOrder } from '@/lib/settle-order';

/**
 * Asks Zoe Pay whether an order was paid, and marks it paid if so. Called from the order-success
 * page after the shopper returns from Zoe Pay, and from the admin order page.
 */
export async function POST(req: Request) {
  try {
    const rate = checkRateLimit(`verify:${getClientIdentifier(req)}`, RATE_LIMITS.payment);
    if (!rate.success) return NextResponse.json({ success: false, message: 'Too many requests' }, { status: 429 });

    const { orderNumber } = await req.json().catch(() => ({}));
    if (typeof orderNumber !== 'string' || !/^ORD-\d+-\d+$/.test(orderNumber)) {
      return NextResponse.json({ success: false, message: 'Invalid order number format' }, { status: 400 });
    }

    const { data: order } = await supabaseAdmin
      .from('orders')
      .select('id, order_number, payment_status, status, total, metadata')
      .eq('order_number', orderNumber)
      .maybeSingle();
    if (!order) return NextResponse.json({ success: false, message: 'Order not found' }, { status: 404 });

    if (order.payment_status === 'paid') {
      return NextResponse.json({ success: true, status: order.status, payment_status: 'paid', message: 'Order already paid' });
    }
    const clientRef = order.metadata?.zoepay_client_ref;
    if (!clientRef) {
      return NextResponse.json({ success: false, message: 'This order has no Zoe Pay payment' }, { status: 400 });
    }
    if (!zoeEnabled()) {
      return NextResponse.json({ success: false, message: 'Payment verification unavailable' }, { status: 503 });
    }

    const check = await checkZoePayment(clientRef, Number(order.total));
    if (!check.paid) {
      return NextResponse.json({
        success: false,
        status: order.status,
        payment_status: order.payment_status,
        message: 'Payment not yet confirmed by Zoe Pay',
      });
    }

    await settlePaidOrder(orderNumber, check.payment?.reference || clientRef);
    return NextResponse.json({ success: true, status: 'processing', payment_status: 'paid', message: 'Payment verified and order updated' });
  } catch (err: any) {
    console.error('[ZoePay verify] Error:', err?.message);
    return NextResponse.json({ success: false, message: 'Internal error' }, { status: 500 });
  }
}
