import { NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase-admin';
import { checkRateLimit, getClientIdentifier, RATE_LIMITS } from '@/lib/rate-limit';
import { checkZoePayment, verifyZoeSignature, zoeConfig } from '@/lib/zoepay';
import { settlePaidOrder } from '@/lib/settle-order';

export const dynamic = 'force-dynamic';

/**
 * Zoe Pay calls this when a payment changes. The signature is checked, then the payment is
 * re-read from Zoe Pay itself before anything is marked paid: the body is never trusted alone.
 */
export async function POST(req: Request) {
  const rate = checkRateLimit(`callback:${getClientIdentifier(req)}`, RATE_LIMITS.callback);
  if (!rate.success) return NextResponse.json({ ok: false, error: 'rate limited' }, { status: 429 });

  const cfg = zoeConfig();
  if (!cfg?.webhookSecret) return NextResponse.json({ ok: false, error: 'not configured' }, { status: 503 });

  const raw = await req.text();
  if (!verifyZoeSignature(raw, req.headers.get('x-zoe-signature'), cfg.webhookSecret)) {
    console.warn('[ZoePay webhook] Bad or missing signature');
    return NextResponse.json({ ok: false, error: 'bad signature' }, { status: 401 });
  }

  let body: { clientReference?: string; event?: string; data?: { clientReference?: string } };
  try {
    body = JSON.parse(raw);
  } catch {
    return NextResponse.json({ ok: false, error: 'bad body' }, { status: 400 });
  }
  const clientRef = body.clientReference || body.data?.clientReference;
  if (!clientRef) return NextResponse.json({ ok: true, ignored: true });

  // "ORD-123-456-Z1764000000000" -> "ORD-123-456"
  const orderNumber = clientRef.replace(/-Z\d+$/, '');
  const { data: order } = await supabaseAdmin
    .from('orders')
    .select('id, order_number, payment_status, total, metadata')
    .eq('order_number', orderNumber)
    .maybeSingle();
  if (!order) return NextResponse.json({ ok: true, result: 'not_found' });
  if (order.payment_status === 'paid') return NextResponse.json({ ok: true, result: 'already_paid' });

  const check = await checkZoePayment(clientRef, Number(order.total));
  console.log('[ZoePay webhook]', body.event, orderNumber, '| Zoe status:', check.status, '| paid:', check.paid);

  if (check.paid) {
    try {
      await settlePaidOrder(orderNumber, check.payment?.reference || clientRef);
    } catch (err: any) {
      console.error('[ZoePay webhook] Could not mark paid:', err?.message);
      return NextResponse.json({ ok: false, error: 'update failed' }, { status: 500 });
    }
    return NextResponse.json({ ok: true, result: 'paid' });
  }

  // Only the latest attempt can fail an order: an older abandoned attempt must not.
  if ((check.status === 'failed' || check.status === 'expired') && order.metadata?.zoepay_client_ref === clientRef) {
    await supabaseAdmin
      .from('orders')
      .update({ payment_status: 'failed', metadata: { ...(order.metadata || {}), failure_reason: `Zoe Pay: ${check.status}` } })
      .eq('id', order.id)
      .neq('payment_status', 'paid');
  }
  return NextResponse.json({ ok: true, result: check.status });
}

export async function GET() {
  return NextResponse.json({ message: 'Zoe Pay webhook endpoint ready' });
}
