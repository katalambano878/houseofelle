import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db/pool';
import { requireScreen } from '@/lib/admin-session';

export const dynamic = 'force-dynamic';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const DAY = /^\d{4}-\d{2}-\d{2}$/;
const ACTION = /^[a-z_]{1,40}$/;
const PAGE_SIZE = 30;
const SALES_PAGE_SIZE = 25;
// Orders rung up on the POS. Older sales only carry pos_sale.
const POS_ORDER = `(o.metadata->>'source' = 'pos' OR o.metadata->>'pos_sale' = 'true')`;
// Accra is UTC+0 all year, but say so explicitly so the day boundaries never drift.
const ACCRA_DAY = (col: string) => `(${col} AT TIME ZONE 'Africa/Accra')::date`;

function day(value: string | null): string | null {
  if (!value || !DAY.test(value)) return null;
  const d = new Date(`${value}T00:00:00Z`);
  return Number.isNaN(d.getTime()) || d.toISOString().slice(0, 10) !== value ? null : value;
}

function accraToday(offsetDays = 0): string {
  const d = new Date(Date.now() + offsetDays * 86_400_000);
  return d.toLocaleDateString('en-CA', { timeZone: 'Africa/Accra' });
}

export async function GET(request: NextRequest) {
  const auth = await requireScreen(request, 'activity');
  if (auth.error) return auth.error;

  const params = request.nextUrl.searchParams;
  const view = params.get('view') === 'sales' ? 'sales' : 'activity';
  const userParam = params.get('user') || '';
  const user = UUID.test(userParam) ? userParam : null;
  const page = Math.min(10_000, Math.max(1, Math.floor(Number(params.get('page')) || 1)));
  let from = day(params.get('from'));
  let to = day(params.get('to'));
  if ((params.get('from') && !from) || (params.get('to') && !to)) {
    return NextResponse.json({ error: 'Dates must look like 2026-11-03.' }, { status: 400 });
  }
  if (from && to && from > to) [from, to] = [to, from];

  const team = await query<{ id: string; name: string; role: string }>(
    `SELECT DISTINCT ON (p.id) p.id, COALESCE(NULLIF(p.full_name, ''), p.email, 'Unnamed') AS name, p.role::text AS role
       FROM profiles p
      WHERE p.role IN ('admin', 'staff')
         OR p.id IN (SELECT DISTINCT user_id FROM audit_logs WHERE user_id IS NOT NULL)`
  );
  const teamRows = team.rows.sort((a, b) => a.name.localeCompare(b.name));

  if (view === 'sales') {
    // The sales view always covers a period; default to the last 7 days.
    const start = from || accraToday(-6);
    const end = to || accraToday();
    const unassigned = userParam === 'unassigned';

    const summary = await query(
      `WITH pos AS (
         SELECT o.id, o.total, o.status::text AS status, o.payment_status::text AS payment_status,
                COALESCE(o.payment_method, '') AS payment_method, o.created_at,
                NULLIF(o.metadata->>'sold_by_id', '') AS sold_by_id,
                NULLIF(o.metadata->>'sold_by_name', '') AS sold_by_name,
                (SELECT COALESCE(SUM(oi.quantity), 0) FROM order_items oi WHERE oi.order_id = o.id) AS items
           FROM orders o
          WHERE ${POS_ORDER}
            AND ${ACCRA_DAY('o.created_at')} BETWEEN $1::date AND $2::date
       ), counted AS (
         SELECT *, (payment_status = 'paid' AND status NOT IN ('cancelled', 'refunded')) AS completed,
                   (payment_status = 'pending' AND status NOT IN ('cancelled', 'refunded')) AS awaiting
           FROM pos
       )
       SELECT c.sold_by_id,
              COALESCE(NULLIF(p.full_name, ''), MAX(c.sold_by_name), p.email) AS name,
              p.role::text AS role,
              COUNT(*) FILTER (WHERE c.completed)::int AS sales,
              COALESCE(SUM(c.total) FILTER (WHERE c.completed), 0)::float AS revenue,
              COALESCE(SUM(c.items) FILTER (WHERE c.completed), 0)::int AS items,
              COUNT(*) FILTER (WHERE c.awaiting)::int AS pending,
              COALESCE(SUM(c.total) FILTER (WHERE c.awaiting), 0)::float AS pending_total,
              COUNT(*) FILTER (WHERE c.status IN ('cancelled', 'refunded'))::int AS cancelled,
              COALESCE(SUM(c.total) FILTER (WHERE c.completed AND c.payment_method = 'cash'), 0)::float AS cash,
              COALESCE(SUM(c.total) FILTER (WHERE c.completed AND c.payment_method = 'card'), 0)::float AS card,
              COALESCE(SUM(c.total) FILTER (WHERE c.completed AND c.payment_method IN ('moolre', 'momo')), 0)::float AS momo,
              MAX(c.created_at) AS last_sale_at
         FROM counted c
         LEFT JOIN profiles p ON p.id::text = c.sold_by_id
        GROUP BY c.sold_by_id, p.full_name, p.email, p.role
        ORDER BY revenue DESC, sales DESC`,
      [start, end]
    );

    const list = await query(
      `SELECT o.id, o.order_number, o.created_at, o.total::float AS total,
              o.status::text AS status, o.payment_status::text AS payment_status, o.payment_method,
              NULLIF(o.metadata->>'sold_by_id', '') AS sold_by_id,
              COALESCE(NULLIF(p.full_name, ''), NULLIF(o.metadata->>'sold_by_name', '')) AS sold_by,
              COALESCE((
                SELECT json_agg(json_build_object('name', oi.product_name, 'variant', oi.variant_name, 'qty', oi.quantity)
                                ORDER BY oi.created_at)
                  FROM order_items oi WHERE oi.order_id = o.id
              ), '[]'::json) AS items,
              COUNT(*) OVER()::int AS total_count
         FROM orders o
         LEFT JOIN profiles p ON p.id::text = o.metadata->>'sold_by_id'
        WHERE ${POS_ORDER}
          AND ${ACCRA_DAY('o.created_at')} BETWEEN $1::date AND $2::date
          AND ($3::text IS NULL OR o.metadata->>'sold_by_id' = $3::text)
          AND (NOT $4::boolean OR NULLIF(o.metadata->>'sold_by_id', '') IS NULL)
        ORDER BY o.created_at DESC
        LIMIT $5 OFFSET $6`,
      [start, end, user, unassigned, SALES_PAGE_SIZE, (page - 1) * SALES_PAGE_SIZE]
    );

    return NextResponse.json(
      {
        team: teamRows,
        from: start,
        to: end,
        groups: summary.rows,
        sales: list.rows.map(({ total_count: _t, ...row }: any) => row),
        total: list.rows[0]?.total_count ?? 0,
        page,
        pageSize: SALES_PAGE_SIZE,
      },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  }

  const actionParam = params.get('action') || '';
  const action = ACTION.test(actionParam) ? actionParam : null;

  const where = `($1::uuid IS NULL OR a.user_id = $1::uuid)
     AND ($2::text IS NULL OR a.action = $2::text)
     AND ($3::date IS NULL OR ${ACCRA_DAY('a.created_at')} >= $3::date)
     AND ($4::date IS NULL OR ${ACCRA_DAY('a.created_at')} <= $4::date)`;

  const [entries, actions] = await Promise.all([
    query(
      `SELECT a.id, a.user_id, a.action, a.entity_type, a.entity_id, a.details, a.ip_address, a.created_at,
              COALESCE(NULLIF(p.full_name, ''), a.details->>'actor_name', p.email, 'Unknown person') AS who,
              p.role::text AS role,
              COUNT(*) OVER()::int AS total_count
         FROM audit_logs a
         LEFT JOIN profiles p ON p.id = a.user_id
        WHERE ${where}
        ORDER BY a.created_at DESC
        LIMIT $5 OFFSET $6`,
      [user, action, from, to, PAGE_SIZE, (page - 1) * PAGE_SIZE]
    ),
    query<{ action: string; count: number }>(
      `SELECT action, COUNT(*)::int AS count FROM audit_logs GROUP BY action ORDER BY count DESC`
    ),
  ]);

  return NextResponse.json(
    {
      team: teamRows,
      actions: actions.rows,
      entries: entries.rows.map(({ total_count: _t, ...row }: any) => row),
      total: entries.rows[0]?.total_count ?? 0,
      page,
      pageSize: PAGE_SIZE,
    },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}
