// Staff expenses: staff log money they spent; the owner reviews it.
//
// GET     list + totals. Staff see only their own entries; the owner sees everyone's.
// POST    log a new expense (anyone with the Expenses screen).
// PATCH   approve / reject / return to pending (owner only). Accepts one id or many.
// DELETE  owner deletes any entry; staff may withdraw their own entry while it is pending.

import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db/pool';
import { clientIp, logActivity, requireScreen } from '@/lib/admin-session';
import {
  EXPENSE_CATEGORIES,
  MAX_EXPENSE_AGE_DAYS,
  MAX_EXPENSE_AMOUNT,
  isExpenseCategory,
  isExpenseStatus,
} from '@/lib/expenses';
import { addDays, isIsoDate, todayInAccra } from '@/lib/report-dates';

export const dynamic = 'force-dynamic';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const LIST_LIMIT = 1000;
const NO_STORE = { 'Cache-Control': 'no-store' };

const round2 = (n: number) => Math.round(n * 100) / 100;

export async function GET(request: NextRequest) {
  const auth = await requireScreen(request, 'expenses');
  if (auth.error) return auth.error;
  const { member } = auth;
  const isOwner = member.role === 'admin';

  const sp = request.nextUrl.searchParams;
  const where: string[] = [];
  const params: unknown[] = [];
  const add = (sql: string, value: unknown) => {
    params.push(value);
    where.push(sql.replace('?', `$${params.length}`));
  };

  if (!isOwner) add('e.user_id = ?', member.id);
  else if (UUID.test(sp.get('staff') || '')) add('e.user_id = ?', sp.get('staff'));

  const from = sp.get('from');
  const to = sp.get('to');
  if (isIsoDate(from)) add('e.spent_on >= ?::date', from);
  if (isIsoDate(to)) add('e.spent_on <= ?::date', to);

  const status = sp.get('status');
  if (isExpenseStatus(status)) add('e.status = ?', status);

  const category = sp.get('category');
  if (isExpenseCategory(category)) {
    // Rows saved without a known category count as Other.
    if (category === 'Other') {
      add('(e.category IS NULL OR NOT (e.category = ANY(?::text[])))', EXPENSE_CATEGORIES.filter((c) => c !== 'Other'));
    } else {
      add('e.category = ?', category);
    }
  }

  const q = (sp.get('q') || '').trim().slice(0, 80);
  if (q) {
    params.push(`%${q.replace(/[%_\\]/g, (c) => `\\${c}`)}%`);
    where.push(`(e.description ILIKE $${params.length} OR e.staff_name ILIKE $${params.length})`);
  }

  const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';

  try {
    const [list, totals, series, staff] = await Promise.all([
      query(
        `SELECT e.id, e.user_id, e.staff_name, e.staff_email, e.amount::float AS amount, e.description,
                e.category, e.spent_on, e.status, e.reviewed_by, e.reviewed_at, e.created_at,
                COALESCE(NULLIF(trim(r.full_name), ''), r.email) AS reviewed_by_name
           FROM staff_expenses e
           LEFT JOIN profiles r ON r.id = e.reviewed_by
           ${whereSql}
          ORDER BY e.spent_on DESC, e.created_at DESC
          LIMIT ${LIST_LIMIT + 1}`,
        params
      ),
      query<{ status: string; category: string | null; amount: number; count: number }>(
        `SELECT e.status, e.category, SUM(e.amount)::float AS amount, COUNT(*)::int AS count
           FROM staff_expenses e ${whereSql}
          GROUP BY e.status, e.category`,
        params
      ),
      query<{ day: string; amount: number }>(
        `SELECT e.spent_on AS day, SUM(e.amount)::float AS amount
           FROM staff_expenses e ${whereSql ? `${whereSql} AND` : 'WHERE'} e.status <> 'rejected'
          GROUP BY e.spent_on
          ORDER BY e.spent_on`,
        params
      ),
      isOwner
        ? query<{ user_id: string; name: string; count: number }>(
            `SELECT e.user_id, MAX(COALESCE(NULLIF(trim(p.full_name), ''), e.staff_name, e.staff_email, 'Staff')) AS name,
                    COUNT(*)::int AS count
               FROM staff_expenses e
               LEFT JOIN profiles p ON p.id = e.user_id
              WHERE e.user_id IS NOT NULL
              GROUP BY e.user_id
              ORDER BY name`
          )
        : Promise.resolve({ rows: [] as { user_id: string; name: string; count: number }[] }),
    ]);

    const truncated = list.rows.length > LIST_LIMIT;
    const byStatus = { pending: { amount: 0, count: 0 }, approved: { amount: 0, count: 0 }, rejected: { amount: 0, count: 0 } };
    const byCategory: Record<string, { approved: number; pending: number; rejected: number; count: number }> = {};
    for (const cat of EXPENSE_CATEGORIES) byCategory[cat] = { approved: 0, pending: 0, rejected: 0, count: 0 };
    for (const row of totals.rows) {
      const s = isExpenseStatus(row.status) ? row.status : 'pending';
      const c = isExpenseCategory(row.category) ? row.category : 'Other';
      byStatus[s].amount = round2(byStatus[s].amount + row.amount);
      byStatus[s].count += row.count;
      byCategory[c][s] = round2(byCategory[c][s] + row.amount);
      byCategory[c].count += row.count;
    }

    return NextResponse.json(
      {
        expenses: truncated ? list.rows.slice(0, LIST_LIMIT) : list.rows,
        truncated,
        totals: { byStatus, byCategory },
        series: series.rows,
        staff: staff.rows,
        canReview: isOwner,
        me: { id: member.id, name: member.name },
        today: todayInAccra(),
      },
      { headers: NO_STORE }
    );
  } catch (err) {
    console.error('[expenses] list failed', err);
    return NextResponse.json({ error: 'Could not load expenses. Try again.' }, { status: 500 });
  }
}

export async function POST(request: NextRequest) {
  const auth = await requireScreen(request, 'expenses');
  if (auth.error) return auth.error;
  const { member } = auth;

  const body = await request.json().catch(() => ({}));
  const description = typeof body.description === 'string' ? body.description.trim().replace(/\s+/g, ' ').slice(0, 400) : '';
  const amount = Number(body.amount);
  const category = isExpenseCategory(body.category) ? body.category : null;
  const today = todayInAccra();
  const spentOn = body.spentOn === undefined || body.spentOn === '' ? today : body.spentOn;

  const errors: Record<string, string> = {};
  if (!Number.isFinite(amount) || amount <= 0) errors.amount = 'Enter the amount you spent, in cedis.';
  else if (amount > MAX_EXPENSE_AMOUNT) errors.amount = `That is more than GH₵ ${MAX_EXPENSE_AMOUNT.toLocaleString('en-GH')}. Check the amount.`;
  if (description.length < 3) errors.description = 'Say what the money was used for.';
  if (!category) errors.category = 'Pick a category.';
  if (!isIsoDate(spentOn)) errors.spentOn = 'Pick the date you spent it.';
  else if (spentOn > today) errors.spentOn = 'The date cannot be in the future.';
  else if (spentOn < addDays(today, -MAX_EXPENSE_AGE_DAYS)) errors.spentOn = 'That date is more than a year ago.';

  if (Object.keys(errors).length) {
    return NextResponse.json({ error: Object.values(errors)[0], fields: errors }, { status: 400 });
  }

  try {
    const { rows } = await query(
      `INSERT INTO staff_expenses (user_id, staff_name, staff_email, amount, description, category, spent_on)
       VALUES ($1, $2, $3, $4, $5, $6, $7::date)
       RETURNING id, user_id, staff_name, staff_email, amount::float AS amount, description, category, spent_on,
                 status, reviewed_by, reviewed_at, created_at`,
      [member.id, member.name, member.email || null, round2(amount), description, category, spentOn]
    );
    const expense = rows[0];
    await logActivity({
      userId: member.id,
      action: 'create',
      entityType: 'staff_expense',
      entityId: expense.id,
      details: { label: description, amount: round2(amount), category, spent_on: spentOn },
      ip: clientIp(request),
    });
    return NextResponse.json(
      { expense, message: member.role === 'admin' ? 'Expense logged.' : 'Expense logged. The owner will review it.' },
      { status: 201 }
    );
  } catch (err) {
    console.error('[expenses] create failed', err);
    return NextResponse.json({ error: 'Could not save the expense. Try again.' }, { status: 500 });
  }
}

function idsFrom(body: any): string[] {
  const raw: unknown[] = Array.isArray(body?.ids) ? body.ids : body?.id ? [body.id] : [];
  return [...new Set(raw.filter((v): v is string => typeof v === 'string' && UUID.test(v)))].slice(0, 200);
}

export async function PATCH(request: NextRequest) {
  const auth = await requireScreen(request, 'expenses');
  if (auth.error) return auth.error;
  const { member } = auth;
  if (member.role !== 'admin') {
    return NextResponse.json({ error: 'Only the owner can approve or reject expenses.' }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const ids = idsFrom(body);
  const status = body?.status;
  if (!ids.length) return NextResponse.json({ error: 'Pick at least one expense.' }, { status: 400 });
  if (!isExpenseStatus(status)) return NextResponse.json({ error: 'Choose approve or reject.' }, { status: 400 });

  try {
    const { rows } = await query<{ id: string; description: string; amount: number; staff_name: string | null }>(
      `UPDATE staff_expenses
          SET status = $2,
              reviewed_by = CASE WHEN $2 = 'pending' THEN NULL ELSE $3::uuid END,
              reviewed_at = CASE WHEN $2 = 'pending' THEN NULL ELSE now() END
        WHERE id = ANY($1::uuid[])
        RETURNING id, description, amount::float AS amount, staff_name`,
      [ids, status, member.id]
    );
    if (!rows.length) return NextResponse.json({ error: 'Those expenses no longer exist.' }, { status: 404 });

    const action = status === 'approved' ? 'approve' : status === 'rejected' ? 'reject' : 'reopen';
    await Promise.all(
      rows.map((r) =>
        logActivity({
          userId: member.id,
          action,
          entityType: 'staff_expense',
          entityId: r.id,
          details: { label: r.description, amount: r.amount, staff: r.staff_name, status },
          ip: clientIp(request),
        })
      )
    );

    const verb = status === 'approved' ? 'Approved' : status === 'rejected' ? 'Rejected' : 'Moved back to pending:';
    const message = rows.length === 1 ? `${verb} ${rows[0].description}.` : `${verb} ${rows.length} expenses.`;
    return NextResponse.json({ updated: rows.map((r) => r.id), message });
  } catch (err) {
    console.error('[expenses] review failed', err);
    return NextResponse.json({ error: 'Could not update the expense. Try again.' }, { status: 500 });
  }
}

export async function DELETE(request: NextRequest) {
  const auth = await requireScreen(request, 'expenses');
  if (auth.error) return auth.error;
  const { member } = auth;
  const isOwner = member.role === 'admin';

  const body = await request.json().catch(() => ({}));
  const id = idsFrom({ id: body?.id || request.nextUrl.searchParams.get('id') })[0];
  if (!id) return NextResponse.json({ error: 'Pick an expense.' }, { status: 400 });

  try {
    const found = await query<{ id: string; user_id: string | null; status: string; description: string; amount: number; staff_name: string | null }>(
      `SELECT id, user_id, status, description, amount::float AS amount, staff_name FROM staff_expenses WHERE id = $1`,
      [id]
    );
    const row = found.rows[0];
    if (!row) return NextResponse.json({ error: 'That expense no longer exists.' }, { status: 404 });

    if (!isOwner) {
      if (row.user_id !== member.id) {
        return NextResponse.json({ error: 'You can only remove your own expenses.' }, { status: 403 });
      }
      if (row.status !== 'pending') {
        return NextResponse.json({ error: 'This expense has been reviewed. Ask the owner to change it.' }, { status: 403 });
      }
    }

    const del = await query(
      `DELETE FROM staff_expenses WHERE id = $1 ${isOwner ? '' : `AND user_id = $2 AND status = 'pending'`}`,
      isOwner ? [id] : [id, member.id]
    );
    if (!del.rowCount) return NextResponse.json({ error: 'This expense changed. Refresh and try again.' }, { status: 409 });

    await logActivity({
      userId: member.id,
      action: 'delete',
      entityType: 'staff_expense',
      entityId: id,
      details: { label: row.description, amount: row.amount, staff: row.staff_name, status: row.status },
      ip: clientIp(request),
    });
    return NextResponse.json({ deleted: id, message: isOwner ? 'Expense deleted.' : 'Expense withdrawn.' });
  } catch (err) {
    console.error('[expenses] delete failed', err);
    return NextResponse.json({ error: 'Could not delete the expense. Try again.' }, { status: 500 });
  }
}
