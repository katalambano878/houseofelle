// End of day close (screen key end_of_day).
//
// GET  ?date=YYYY-MM-DD  live figures for the day, the saved close (if any) and recent closes.
// POST { action: 'close', date, openingCash, countedCash, notes, expensesFromDrawer }
//        Recomputes the day on the server and saves a snapshot. A closed day cannot be
//        closed again until the owner reopens it.
// POST { action: 'reopen', date }  owner only.
//
// end_of_day_reports and staff_expenses are not in the REST allowlist; this route is
// the only way the admin reads or writes them.

import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db/pool';
import { clientIp, logActivity, requireScreen } from '@/lib/admin-session';
import { orderSource } from '@/lib/delivery';
import {
  cashCount,
  orderState,
  paymentBucket,
  summarizeDay,
  type DayExpense,
  type DayOrder,
  type DaySnapshot,
  type SavedReport,
} from '@/lib/end-of-day';
import { isIsoDate, todayInAccra } from '@/lib/report-dates';

export const dynamic = 'force-dynamic';

const NO_STORE = { 'Cache-Control': 'no-store' };
const MAX_CASH = 10_000_000;
const round2 = (n: number) => Math.round(n * 100) / 100;

function customerName(row: any): string {
  const a = row.shipping_address || {};
  const m = row.metadata || {};
  const first = String(a.firstName || m.first_name || '').trim();
  const last = String(a.lastName || m.last_name || '').trim();
  const full = `${first} ${last}`.trim() || String(a.full_name || '').trim();
  if (full) return full;
  const email = String(row.email || '');
  if (email && !email.endsWith('@store.local') && !email.endsWith('@pos.local')) return email;
  return row.phone || 'Walk-in customer';
}

/** Loads every order that matters for `date` (Accra): placed that day, or paid that day. */
async function loadDay(date: string) {
  const [orders, expenses, bounds] = await Promise.all([
    query(
      `WITH b AS (
         SELECT ($1::date)::timestamp AT TIME ZONE 'Africa/Accra' AS s,
                ($1::date + 1)::timestamp AT TIME ZONE 'Africa/Accra' AS e
       ),
       o AS (
         SELECT o.*,
                CASE WHEN o.metadata->>'payment_verified_at' ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}T[0-9]{2}:[0-9]{2}'
                     THEN (o.metadata->>'payment_verified_at')::timestamptz END AS verified_at
           FROM orders o, b
          WHERE o.created_at >= b.s - interval '45 days' AND o.created_at < b.e
       )
       SELECT o.id, o.order_number, o.email, o.phone, o.status::text AS status, o.payment_status::text AS payment_status,
              o.payment_method, o.total::float AS total, COALESCE(o.discount_total, 0)::float AS discount_total,
              COALESCE(o.shipping_total, 0)::float AS shipping_total, o.created_at,
              COALESCE(o.verified_at, o.created_at) AS paid_at, o.metadata, o.shipping_address,
              (o.created_at < b.s) AS created_earlier,
              COALESCE((
                SELECT json_agg(json_build_object(
                         'product_id', oi.product_id, 'product_name', oi.product_name, 'variant_name', oi.variant_name,
                         'quantity', oi.quantity, 'total_price', oi.total_price
                       ) ORDER BY oi.created_at)
                  FROM order_items oi WHERE oi.order_id = o.id
              ), '[]'::json) AS items
         FROM o, b
        WHERE o.created_at >= b.s
           OR (o.payment_status = 'paid' AND COALESCE(o.verified_at, o.created_at) >= b.s AND COALESCE(o.verified_at, o.created_at) < b.e)
        ORDER BY COALESCE(o.verified_at, o.created_at) DESC`,
      [date]
    ),
    query<DayExpense>(
      `SELECT id, staff_name, amount::float AS amount, description, category, status
         FROM staff_expenses
        WHERE spent_on = $1::date AND status IN ('approved', 'pending')
        ORDER BY status, created_at`,
      [date]
    ),
    query<{ s: string; e: string }>(
      `SELECT ($1::date)::timestamp AT TIME ZONE 'Africa/Accra' AS s, ($1::date + 1)::timestamp AT TIME ZONE 'Africa/Accra' AS e`,
      [date]
    ),
  ]);

  const { s, e } = bounds.rows[0];
  const dayOrders: DayOrder[] = orders.rows.map((row: any) => {
    const base = {
      status: row.status || 'pending',
      payment_status: row.payment_status || 'pending',
      created_at: row.created_at,
      paid_at: row.payment_status === 'paid' ? row.paid_at : null,
    };
    return {
      id: row.id,
      order_number: row.order_number,
      customer: customerName(row),
      ...base,
      payment_method: row.payment_method,
      bucket: paymentBucket(row.payment_method),
      source: orderSource(row),
      total: Number(row.total) || 0,
      discount_total: Number(row.discount_total) || 0,
      shipping_total: Number(row.shipping_total) || 0,
      created_earlier: Boolean(row.created_earlier),
      state: orderState(base, s, e),
      items: (row.items || []).map((i: any) => ({
        product_id: i.product_id,
        product_name: i.product_name,
        variant_name: i.variant_name,
        quantity: Number(i.quantity) || 0,
        total_price: Number(i.total_price) || 0,
      })),
    };
  });

  const items = expenses.rows;
  const approvedTotal = round2(items.filter((x) => x.status === 'approved').reduce((sum, x) => sum + x.amount, 0));
  const pendingTotal = round2(items.filter((x) => x.status === 'pending').reduce((sum, x) => sum + x.amount, 0));

  return {
    summary: summarizeDay(dayOrders),
    orders: dayOrders,
    expenses: { approvedTotal, pendingTotal, items },
  };
}

const REPORT_COLUMNS = `id, report_date, opening_cash::float AS opening_cash, counted_cash::float AS counted_cash,
  expected_cash::float AS expected_cash, variance::float AS variance, website_collected::float AS website_collected,
  pos_collected::float AS pos_collected, cash_collected::float AS cash_collected, card_collected::float AS card_collected,
  momo_collected::float AS momo_collected, other_collected::float AS other_collected, orders_count, items_sold,
  order_total::float AS order_total, expenses_total::float AS expenses_total, notes, snapshot, closed_by, closed_by_name,
  closed_at, updated_at`;

export async function GET(request: NextRequest) {
  const auth = await requireScreen(request, 'end_of_day');
  if (auth.error) return auth.error;
  const { member } = auth;

  const today = todayInAccra();
  const requested = request.nextUrl.searchParams.get('date');
  const date = isIsoDate(requested) ? requested : today;
  if (date > today) return NextResponse.json({ error: 'That day has not happened yet. Pick today or an earlier day.' }, { status: 400 });

  try {
    const [live, report, history, previous] = await Promise.all([
      loadDay(date),
      query<SavedReport>(`SELECT ${REPORT_COLUMNS} FROM end_of_day_reports WHERE report_date = $1::date`, [date]),
      query(
        `SELECT report_date, (website_collected + pos_collected)::float AS collected, variance::float AS variance,
                expenses_total::float AS expenses_total, closed_at, closed_by_name
           FROM end_of_day_reports
          ORDER BY report_date DESC
          LIMIT 14`
      ),
      query<{ report_date: string; counted_cash: number }>(
        `SELECT report_date, counted_cash::float AS counted_cash
           FROM end_of_day_reports
          WHERE report_date < $1::date AND counted_cash IS NOT NULL
          ORDER BY report_date DESC
          LIMIT 1`,
        [date]
      ),
    ]);

    return NextResponse.json(
      {
        date,
        today,
        live,
        report: report.rows[0] ?? null,
        history: history.rows,
        previous: previous.rows[0] ?? null,
        canReopen: member.role === 'admin',
      },
      { headers: NO_STORE }
    );
  } catch (err) {
    console.error('[end-of-day] load failed', err);
    return NextResponse.json({ error: 'Could not load the day. Try again.' }, { status: 500 });
  }
}

function money(value: unknown): number | null | 'invalid' {
  if (value === null || value === undefined || value === '') return null;
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0 || n > MAX_CASH) return 'invalid';
  return round2(n);
}

export async function POST(request: NextRequest) {
  const auth = await requireScreen(request, 'end_of_day');
  if (auth.error) return auth.error;
  const { member } = auth;

  const body = await request.json().catch(() => ({}));
  const action = body?.action;
  const date = body?.date;
  const today = todayInAccra();
  if (!isIsoDate(date)) return NextResponse.json({ error: 'Pick a day.' }, { status: 400 });
  if (date > today) return NextResponse.json({ error: 'You cannot close a day that has not happened yet.' }, { status: 400 });

  if (action === 'reopen') {
    if (member.role !== 'admin') {
      return NextResponse.json({ error: 'Only the owner can reopen a closed day.' }, { status: 403 });
    }
    try {
      const { rows } = await query<{ id: string }>(
        `UPDATE end_of_day_reports
            SET snapshot = jsonb_set(
                  COALESCE(snapshot, '{}'::jsonb), '{reopened}',
                  COALESCE(snapshot->'reopened', '[]'::jsonb) || jsonb_build_array(jsonb_build_object(
                    'by', $2::text, 'at', now(), 'closed_at', closed_at, 'closed_by_name', closed_by_name
                  ))
                ),
                closed_at = NULL,
                updated_at = now()
          WHERE report_date = $1::date AND closed_at IS NOT NULL
          RETURNING id`,
        [date, member.name]
      );
      if (!rows[0]) return NextResponse.json({ error: 'This day is not closed.' }, { status: 409 });
      await logActivity({
        userId: member.id,
        action: 'reopen',
        entityType: 'end_of_day',
        entityId: rows[0].id,
        details: { label: `End of day ${date}`, date },
        ip: clientIp(request),
      });
      return NextResponse.json({ message: `Reopened ${date}. Update the count and close it again.` });
    } catch (err) {
      console.error('[end-of-day] reopen failed', err);
      return NextResponse.json({ error: 'Could not reopen the day. Try again.' }, { status: 500 });
    }
  }

  if (action !== 'close') return NextResponse.json({ error: 'Unknown action.' }, { status: 400 });

  const opening = money(body.openingCash ?? 0);
  const counted = money(body.countedCash);
  const fields: Record<string, string> = {};
  if (opening === 'invalid' || opening === null) fields.openingCash = 'Enter the cash in the drawer when the day started.';
  if (counted === 'invalid') fields.countedCash = 'Enter the cash you counted, in cedis.';
  else if (counted === null) fields.countedCash = 'Count the cash in the drawer before you close the day.';
  const notes = typeof body.notes === 'string' ? body.notes.trim().slice(0, 1000) : '';
  if (Object.keys(fields).length) {
    return NextResponse.json({ error: Object.values(fields)[0], fields }, { status: 400 });
  }
  const expensesFromDrawer = body.expensesFromDrawer === true;

  try {
    const live = await loadDay(date);
    const cash = cashCount({
      opening: opening as number,
      counted: counted as number,
      cashSales: live.summary.cashSales,
      approvedExpenses: live.expenses.approvedTotal,
      expensesFromDrawer,
    });
    const s = live.summary;
    const snapshot: DaySnapshot = { version: 1, summary: s, orders: live.orders, expenses: live.expenses, cash };
    const orderValue = round2(s.collected + s.awaiting.total);

    const { rows } = await query<{ id: string }>(
      `INSERT INTO end_of_day_reports (
         report_date, opening_cash, counted_cash, expected_cash, variance,
         website_collected, pos_collected, cash_collected, card_collected, momo_collected, other_collected,
         orders_count, items_sold, order_total, expenses_total, notes, snapshot,
         closed_by, closed_by_name, closed_at, updated_at
       ) VALUES ($1::date, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, NULLIF($16, ''), $17::jsonb, $18, $19, now(), now())
       ON CONFLICT (report_date) DO UPDATE SET
         opening_cash = EXCLUDED.opening_cash, counted_cash = EXCLUDED.counted_cash,
         expected_cash = EXCLUDED.expected_cash, variance = EXCLUDED.variance,
         website_collected = EXCLUDED.website_collected, pos_collected = EXCLUDED.pos_collected,
         cash_collected = EXCLUDED.cash_collected, card_collected = EXCLUDED.card_collected,
         momo_collected = EXCLUDED.momo_collected, other_collected = EXCLUDED.other_collected,
         orders_count = EXCLUDED.orders_count, items_sold = EXCLUDED.items_sold, order_total = EXCLUDED.order_total,
         expenses_total = EXCLUDED.expenses_total, notes = EXCLUDED.notes,
         snapshot = EXCLUDED.snapshot || jsonb_build_object('reopened', COALESCE(end_of_day_reports.snapshot->'reopened', '[]'::jsonb)),
         closed_by = EXCLUDED.closed_by, closed_by_name = EXCLUDED.closed_by_name,
         closed_at = now(), updated_at = now()
       WHERE end_of_day_reports.closed_at IS NULL
       RETURNING id`,
      [
        date,
        cash.opening,
        cash.counted,
        cash.expected,
        cash.variance,
        s.web.collected,
        s.pos.collected,
        s.byMethod.cash,
        s.byMethod.card,
        s.byMethod.momo,
        s.byMethod.other,
        s.ordersCount,
        s.itemsSold,
        orderValue,
        live.expenses.approvedTotal,
        notes,
        JSON.stringify(snapshot),
        member.id,
        member.name,
      ]
    );
    if (!rows[0]) {
      return NextResponse.json(
        { error: member.role === 'admin' ? 'This day is already closed. Reopen it first to change it.' : 'This day is already closed. Ask the owner to reopen it.' },
        { status: 409 }
      );
    }

    await logActivity({
      userId: member.id,
      action: 'close',
      entityType: 'end_of_day',
      entityId: rows[0].id,
      details: {
        label: `End of day ${date}`,
        date,
        collected: s.collected,
        expected_cash: cash.expected,
        counted_cash: cash.counted,
        variance: cash.variance,
      },
      ip: clientIp(request),
    });

    const v = cash.variance ?? 0;
    const tail = v === 0 ? 'The drawer balances.' : v > 0 ? `The drawer is over by GH₵ ${v.toFixed(2)}.` : `The drawer is short by GH₵ ${Math.abs(v).toFixed(2)}.`;
    return NextResponse.json({ id: rows[0].id, message: `Day closed. ${tail}` });
  } catch (err) {
    console.error('[end-of-day] close failed', err);
    return NextResponse.json({ error: 'Could not close the day. Try again.' }, { status: 500 });
  }
}
