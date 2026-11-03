import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db/pool';
import { clientIp, logActivity, requireScreen } from '@/lib/admin-session';
import { orderSource } from '@/lib/delivery';
import { sendSMS } from '@/lib/notifications';
import { getSmsBilling, taysendConfigured } from '@/lib/taysend-billing';
import {
  DEFAULT_NOTICE,
  KIND_LABELS,
  NOTICE_MAX_LENGTH,
  SKIP_LABELS,
  buildOrderMessage,
  customerName,
  normalisePhone,
  orderPhone,
  smsParts,
  type MessageKind,
  type ResendOrder,
  type SkipReason,
} from '@/lib/sms-resend';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';
export const maxDuration = 300;

const MAX_WINDOW_DAYS = 31;
const MAX_ORDERS = 5000;
const MAX_RUN_LIMIT = 25;
const SEND_GAP_MS = 200;
/** A message picked up by a sender is left alone by any other sender for this long. */
const CLAIM_SECONDS = 120;


type Phase = 'orders' | 'apology';
type Source = 'all' | 'web' | 'pos';
const PHASES: Phase[] = ['orders', 'apology'];
const SOURCES: Source[] = ['all', 'web', 'pos'];
const STATUSES = ['pending', 'sent', 'failed', 'insufficient_balance', 'skipped'] as const;

function bad(error: string, status = 400) {
  return NextResponse.json({ ok: false, error }, { status });
}

function parseDay(value: unknown): string | null {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const d = new Date(`${value}T00:00:00.000Z`);
  return Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== value ? null : value;
}

/** Ghana is on UTC all year, so a calendar day in the store is a UTC day. */
function windowFor(from: string, to: string): { fromIso: string; toIso: string } | { error: string } {
  const start = new Date(`${from}T00:00:00.000Z`);
  const end = new Date(`${to}T00:00:00.000Z`);
  end.setUTCDate(end.getUTCDate() + 1);
  const days = (end.getTime() - start.getTime()) / 86_400_000;
  if (days <= 0) return { error: 'The start date must be on or before the end date.' };
  if (days > MAX_WINDOW_DAYS) return { error: `Choose a range of ${MAX_WINDOW_DAYS} days or less.` };
  return { fromIso: start.toISOString(), toIso: end.toISOString() };
}

function batchIdFor(from: string, to: string, source: Source): string {
  return `resend-${from}-to-${to}${source === 'all' ? '' : `-${source}`}`;
}

function smsConfigured(): boolean {
  const taysend = Boolean(
    process.env.TAYSEND_API_KEY?.trim() && (process.env.TAYSEND_SENDER_ID || process.env.MOOLRE_SMS_SENDER_ID || '').trim()
  );
  const moolre = Boolean(process.env.MOOLRE_SMS_API_KEY || process.env.MOOLRE_API_KEY);
  return taysend || moolre;
}

type Balance = { known: boolean; smsLeft: number | null; costPerSms: number | null; currency: string; error?: string };

async function readBalance(): Promise<Balance> {
  if (!taysendConfigured()) return { known: false, smsLeft: null, costPerSms: null, currency: 'GHS' };
  try {
    const billing = await getSmsBilling();
    const rates = billing.packages
      .filter((p) => p.sms > 0 && Number(p.amount) > 0)
      .map((p) => Number(p.amount) / p.sms);
    return {
      known: true,
      smsLeft: billing.sms_left,
      // The dearest package rate, so the estimate never comes in under the real cost.
      costPerSms: rates.length ? Math.max(...rates) : null,
      currency: billing.currency || 'GHS',
    };
  } catch (err) {
    return {
      known: false,
      smsLeft: null,
      costPerSms: null,
      currency: 'GHS',
      error: err instanceof Error ? err.message : 'Could not read the SMS balance.',
    };
  }
}

async function loadOrders(fromIso: string, toIso: string, source: Source) {
  const { rows } = await query<ResendOrder & { created_at: string }>(
    `SELECT id, order_number, status::text AS status, payment_status::text AS payment_status, total, phone,
            shipping_address, metadata, created_at
       FROM orders
      WHERE created_at >= $1 AND created_at < $2
      ORDER BY created_at ASC
      LIMIT $3`,
    [fromIso, toIso, MAX_ORDERS + 1]
  );
  const truncated = rows.length > MAX_ORDERS;
  const orders = rows.slice(0, MAX_ORDERS).filter((o) => source === 'all' || orderSource(o) === source);
  return { orders, truncated };
}

type Plan = {
  orderRows: Array<{ order_id: string; phone: string; message: string; kind: MessageKind; name: string; ref: string }>;
  phones: string[];
  skipped: Partial<Record<SkipReason, number>>;
  considered: number;
};

function planMessages(orders: ResendOrder[]): Plan {
  const orderRows: Plan['orderRows'] = [];
  const skipped: Plan['skipped'] = {};
  const phones = new Set<string>();
  for (const order of orders) {
    const phone = normalisePhone(orderPhone(order));
    if (phone) phones.add(phone);
    const built = buildOrderMessage(order);
    if ('skip' in built) {
      skipped[built.skip] = (skipped[built.skip] || 0) + 1;
      continue;
    }
    orderRows.push({
      order_id: order.id,
      phone: phone!,
      message: built.message,
      kind: built.kind,
      name: customerName(order),
      ref: order.order_number || order.id.slice(0, 8),
    });
  }
  return { orderRows, phones: Array.from(phones), skipped, considered: orders.length };
}

async function batchCounts(batchId: string) {
  const { rows } = await query<{ phase: Phase; status: string; n: number; last: string | null }>(
    `SELECT phase, status, count(*)::int AS n, max(last_attempted_at) AS last
       FROM sms_resend_log WHERE batch_id = $1 GROUP BY phase, status`,
    [batchId]
  );
  const counts: Record<Phase, Record<string, number>> = { orders: {}, apology: {} };
  let lastAttemptAt: string | null = null;
  for (const row of rows) {
    if (!counts[row.phase]) continue;
    counts[row.phase][row.status] = row.n;
    if (row.last && (!lastAttemptAt || row.last > lastAttemptAt)) lastAttemptAt = row.last;
  }
  return { counts, lastAttemptAt, exists: rows.length > 0 };
}

function readNotice(body: any): string {
  const text = typeof body?.notice === 'string' ? body.notice.replace(/\r\n/g, '\n').trim() : '';
  return text || DEFAULT_NOTICE;
}

// ---------------------------------------------------------------------------------------------- actions

async function handleOverview(from: string, to: string, source: Source, notice: string) {
  const win = windowFor(from, to);
  if ('error' in win) return bad(win.error);
  const batchId = batchIdFor(from, to, source);

  const [{ orders, truncated }, batch, balance] = await Promise.all([
    loadOrders(win.fromIso, win.toIso, source),
    batchCounts(batchId),
    readBalance(),
  ]);
  const plan = planMessages(orders);

  const kinds: Partial<Record<MessageKind, { count: number; example: string }>> = {};
  let orderParts = 0;
  for (const row of plan.orderRows) {
    orderParts += smsParts(row.message);
    const entry = kinds[row.kind];
    if (entry) entry.count += 1;
    else kinds[row.kind] = { count: 1, example: row.message };
  }

  return NextResponse.json({
    ok: true,
    batchId,
    configured: smsConfigured(),
    balance,
    truncated,
    orders: {
      considered: plan.considered,
      toSend: plan.orderRows.length,
      parts: orderParts,
      kinds: Object.entries(kinds).map(([kind, v]) => ({
        kind,
        label: KIND_LABELS[kind as MessageKind],
        count: v!.count,
        example: v!.example,
      })),
      skipped: Object.entries(plan.skipped).map(([reason, count]) => ({
        reason,
        label: SKIP_LABELS[reason as SkipReason],
        count,
      })),
    },
    notice: {
      customers: plan.phones.length,
      partsEach: smsParts(notice),
      parts: smsParts(notice) * plan.phones.length,
    },
    batch,
  });
}

async function handleSeed(from: string, to: string, source: Source, phase: Phase, notice: string, memberId: string, ip: string | null) {
  const win = windowFor(from, to);
  if ('error' in win) return bad(win.error);
  const batchId = batchIdFor(from, to, source);
  const { orders } = await loadOrders(win.fromIso, win.toIso, source);
  const plan = planMessages(orders);

  let inserted = 0;
  if (phase === 'orders' && plan.orderRows.length > 0) {
    // One statement for the whole range. Messages already sent are never touched; waiting ones pick up
    // the latest order status so the text matches where the order is now.
    const res = await query(
      `INSERT INTO sms_resend_log (batch_id, phase, order_id, phone, message, status)
       SELECT $1, 'orders', t.order_id, t.phone, t.message, 'pending'
         FROM unnest($2::uuid[], $3::text[], $4::text[]) AS t(order_id, phone, message)
       ON CONFLICT (batch_id, phase, order_id) WHERE phase = 'orders'
       DO UPDATE SET message = EXCLUDED.message, phone = EXCLUDED.phone, updated_at = now()
         WHERE sms_resend_log.status <> 'sent'`,
      [
        batchId,
        plan.orderRows.map((r) => r.order_id),
        plan.orderRows.map((r) => r.phone),
        plan.orderRows.map((r) => r.message),
      ]
    );
    inserted = res.rowCount || 0;
  }
  if (phase === 'apology' && plan.phones.length > 0) {
    if (notice.length > NOTICE_MAX_LENGTH) return bad(`Keep the notice under ${NOTICE_MAX_LENGTH} characters.`);
    const res = await query(
      `INSERT INTO sms_resend_log (batch_id, phase, phone, message, status)
       SELECT $1, 'apology', p.phone, $3, 'pending' FROM unnest($2::text[]) AS p(phone)
       ON CONFLICT (batch_id, phase, phone) WHERE phase = 'apology'
       DO UPDATE SET message = EXCLUDED.message, updated_at = now()
         WHERE sms_resend_log.status <> 'sent'`,
      [batchId, plan.phones, notice]
    );
    inserted = res.rowCount || 0;
  }

  await logActivity({
    userId: memberId,
    action: 'create',
    entityType: 'sms_resend',
    details: {
      label: phase === 'orders' ? 'Queued order texts to resend' : 'Queued a notice to customers',
      batchId,
      from,
      to,
      source,
      messages: phase === 'orders' ? plan.orderRows.length : plan.phones.length,
    },
    ip,
  });

  return NextResponse.json({ ok: true, batchId, queued: inserted, batch: await batchCounts(batchId) });
}

async function handleMessages(batchId: string, phase: Phase, status: string | null, offset: number, limit: number) {
  const filter = status && (STATUSES as readonly string[]).includes(status) ? status : null;
  const [{ rows }, total] = await Promise.all([
    query<{
      id: string;
      phone: string;
      message: string;
      status: string;
      error_message: string | null;
      attempts: number;
      last_attempted_at: string | null;
      order_number: string | null;
    }>(
      `SELECT l.id, l.phone, l.message, l.status, l.error_message, l.attempts, l.last_attempted_at, o.order_number
         FROM sms_resend_log l LEFT JOIN orders o ON o.id = l.order_id
        WHERE l.batch_id = $1 AND l.phase = $2 AND ($3::text IS NULL OR l.status = $3)
        ORDER BY CASE l.status WHEN 'failed' THEN 0 WHEN 'insufficient_balance' THEN 1 WHEN 'pending' THEN 2 ELSE 3 END,
                 l.last_attempted_at DESC NULLS LAST, l.created_at ASC
        OFFSET $4 LIMIT $5`,
      [batchId, phase, filter, offset, limit]
    ),
    query<{ n: number }>(
      `SELECT count(*)::int AS n FROM sms_resend_log WHERE batch_id = $1 AND phase = $2 AND ($3::text IS NULL OR status = $3)`,
      [batchId, phase, filter]
    ),
  ]);
  return NextResponse.json({ ok: true, messages: rows, total: total.rows[0]?.n ?? 0 });
}

function describeFailure(result: any): { status: 'failed' | 'insufficient_balance'; error: string; code: string | null } {
  if (!result) return { status: 'failed', error: 'The SMS service did not accept this text.', code: null };
  const text = JSON.stringify(result).slice(0, 500);
  const code = result.code !== undefined && result.code !== null ? String(result.code) : null;
  if (/balance|insufficient|funds|credit/i.test(text)) {
    return { status: 'insufficient_balance', error: 'Not enough SMS credit.', code };
  }
  return { status: 'failed', error: result.message || result.error || text, code };
}

/**
 * Which messages a send pass may pick up: waiting ones nobody else is sending right now, plus (on a retry
 * pass) ones that failed before the pass began, so a message that fails again is not retried in a loop.
 * $1 batch, $2 phase, $3 include failed, $4 retry pass start.
 */
const ELIGIBLE = `batch_id = $1 AND phase = $2 AND (
    (status = 'pending' AND (last_attempted_at IS NULL OR last_attempted_at < now() - interval '${CLAIM_SECONDS} seconds'))
    OR ($3::boolean AND status IN ('failed', 'insufficient_balance') AND (last_attempted_at IS NULL OR last_attempted_at < $4::timestamptz))
  )`;

async function handleRun(batchId: string, phase: Phase, limit: number, includeFailed: boolean, since: string) {
  if (!smsConfigured()) {
    return NextResponse.json({
      ok: false,
      stopped: 'not_configured',
      error: 'SMS sending is not set up on this server, so nothing was sent.',
      sent: 0,
      failed: 0,
      processed: 0,
      done: false,
      items: [],
      batch: await batchCounts(batchId),
    });
  }

  const params = [batchId, phase, includeFailed, since];

  // Stop before sending anything we cannot pay for.
  const balance = await readBalance();
  let allowed = limit;
  if (balance.known && balance.smsLeft !== null) {
    const { rows: next } = await query<{ message: string }>(
      `SELECT message FROM sms_resend_log WHERE ${ELIGIBLE} ORDER BY created_at ASC LIMIT $5`,
      [...params, limit]
    );
    let left = balance.smsLeft;
    allowed = 0;
    for (const row of next) {
      const parts = smsParts(row.message);
      if (parts > left) break;
      left -= parts;
      allowed += 1;
    }
    if (next.length > 0 && allowed === 0) {
      return NextResponse.json({
        ok: false,
        stopped: 'insufficient_balance',
        error: 'The SMS balance is too low to send the next message. Buy more SMS, then continue.',
        smsLeft: balance.smsLeft,
        sent: 0,
        failed: 0,
        processed: 0,
        done: false,
        items: [],
        batch: await batchCounts(batchId),
      });
    }
  }

  // Claim the next messages in one statement so two open tabs can never send the same text twice.
  const { rows: claimed } = await query<{ id: string; phone: string; message: string }>(
    `WITH next AS (
       SELECT id FROM sms_resend_log WHERE ${ELIGIBLE}
        ORDER BY created_at ASC
        LIMIT $5
        FOR UPDATE SKIP LOCKED
     )
     UPDATE sms_resend_log l
        SET status = 'pending', last_attempted_at = now(), attempts = l.attempts + 1, updated_at = now()
       FROM next WHERE l.id = next.id
     RETURNING l.id, l.phone, l.message`,
    [...params, Math.max(1, allowed)]
  );

  let sent = 0;
  let failed = 0;
  let stopped: string | null = null;
  const items: Array<{ id: string; status: string; error?: string }> = [];

  for (let i = 0; i < claimed.length; i++) {
    const row = claimed[i];
    let result: any = null;
    try {
      result = await sendSMS({ to: row.phone, message: row.message });
    } catch (err) {
      result = { status: 0, error: err instanceof Error ? err.message : 'Send failed' };
    }

    if (result && result.status === 1) {
      sent += 1;
      await query(
        `UPDATE sms_resend_log SET status = 'sent', provider_code = $2, error_message = NULL, updated_at = now() WHERE id = $1`,
        [row.id, result.messageid ? `${result.provider || 'sms'}:${result.messageid}` : result.code ? String(result.code) : null]
      );
      items.push({ id: row.id, status: 'sent' });
    } else {
      const failure = describeFailure(result);
      failed += 1;
      await query(
        `UPDATE sms_resend_log SET status = $2, provider_code = $3, error_message = $4, updated_at = now() WHERE id = $1`,
        [row.id, failure.status, failure.code, failure.error.slice(0, 500)]
      );
      items.push({ id: row.id, status: failure.status, error: failure.error });
      if (failure.status === 'insufficient_balance') {
        stopped = 'insufficient_balance';
        // Hand the rest back untouched so they go out once credit is added.
        const rest = claimed.slice(i + 1).map((r) => r.id);
        if (rest.length) {
          await query(
            `UPDATE sms_resend_log SET last_attempted_at = NULL, attempts = GREATEST(attempts - 1, 0), updated_at = now()
              WHERE id = ANY($1::uuid[])`,
            [rest]
          );
        }
        break;
      }
    }
    if (i < claimed.length - 1) await new Promise((r) => setTimeout(r, SEND_GAP_MS));
  }

  const { rows: left } = await query<{ n: number }>(
    `SELECT count(*)::int AS n FROM sms_resend_log WHERE ${ELIGIBLE}`,
    params
  );
  const remaining = left[0]?.n ?? 0;

  return NextResponse.json({
    ok: !stopped,
    stopped,
    error: stopped === 'insufficient_balance' ? 'The SMS balance ran out. Buy more SMS, then continue.' : undefined,
    sent,
    failed,
    processed: claimed.length,
    remaining,
    done: !stopped && (claimed.length === 0 || remaining === 0),
    items,
    batch: await batchCounts(batchId),
  });
}

async function handleTest(body: any, memberId: string, ip: string | null) {
  const phone = normalisePhone(body?.phone);
  if (!phone) return bad('Type a valid phone number, e.g. 024 123 4567.');

  let message = '';
  if (body?.kind === 'notice') {
    message = readNotice(body);
    if (message.length > NOTICE_MAX_LENGTH) return bad(`Keep the notice under ${NOTICE_MAX_LENGTH} characters.`);
  } else {
    const from = parseDay(body?.from);
    const to = parseDay(body?.to);
    const source: Source = SOURCES.includes(body?.source) ? body.source : 'all';
    if (!from || !to) return bad('Choose a start and end date first.');
    const win = windowFor(from, to);
    if ('error' in win) return bad(win.error);
    const { orders } = await loadOrders(win.fromIso, win.toIso, source);
    const first = planMessages(orders).orderRows[0];
    if (!first) return bad('There is no order text in this range to test with.');
    message = first.message;
  }

  if (!smsConfigured()) {
    return NextResponse.json({ ok: false, error: 'SMS sending is not set up on this server, so the test was not sent.' });
  }

  let result: any = null;
  try {
    result = await sendSMS({ to: phone, message });
  } catch (err) {
    result = { status: 0, error: err instanceof Error ? err.message : 'Send failed' };
  }
  const ok = Boolean(result && result.status === 1);

  await logActivity({
    userId: memberId,
    action: 'create',
    entityType: 'sms_resend',
    details: { label: 'Sent a test text', kind: body?.kind === 'notice' ? 'notice' : 'order', ok },
    ip,
  });

  return NextResponse.json(
    ok
      ? { ok: true, message: `Test sent to +${phone}. Check the phone in a minute.` }
      : { ok: false, error: `The test did not go out: ${describeFailure(result).error}` }
  );
}

export async function POST(request: NextRequest) {
  const auth = await requireScreen(request, 'sms_resend');
  if (auth.error) return auth.error;

  const body = await request.json().catch(() => ({}));
  const action = typeof body?.action === 'string' ? body.action : '';
  const ip = clientIp(request);

  try {
    if (action === 'test') return await handleTest(body, auth.member.id, ip);

    const from = parseDay(body?.from);
    const to = parseDay(body?.to);
    if (!from || !to) return bad('Choose a start and end date.');
    const source: Source = SOURCES.includes(body?.source) ? body.source : 'all';
    const phase: Phase = PHASES.includes(body?.phase) ? body.phase : 'orders';
    const batchId = batchIdFor(from, to, source);

    if (action === 'overview') return await handleOverview(from, to, source, readNotice(body));
    if (action === 'seed') return await handleSeed(from, to, source, phase, readNotice(body), auth.member.id, ip);
    if (action === 'messages') {
      const offset = Math.max(0, parseInt(body?.offset, 10) || 0);
      const limit = Math.min(Math.max(parseInt(body?.limit, 10) || 50, 1), 200);
      return await handleMessages(batchId, phase, typeof body?.status === 'string' ? body.status : null, offset, limit);
    }
    if (action === 'run') {
      const limit = Math.min(Math.max(parseInt(body?.limit, 10) || 10, 1), MAX_RUN_LIMIT);
      const sinceDate = typeof body?.since === 'string' ? new Date(body.since) : new Date();
      const since = Number.isNaN(sinceDate.getTime()) ? new Date().toISOString() : sinceDate.toISOString();
      return await handleRun(batchId, phase, limit, body?.includeFailed === true, since);
    }
    return bad('Unknown action.');
  } catch (err) {
    console.error('[sms-resend]', action, err);
    return bad('Something went wrong on the server. Nothing more was sent. Try again.', 500);
  }
}
