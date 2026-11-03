import { NextRequest, NextResponse } from 'next/server';
import { clientIp, logActivity, requireScreen } from '@/lib/admin-session';
import { query } from '@/lib/db/pool';
import { MAX_PERCENT, MIN_PERCENT, removeItems, upsertItems, validPercent } from '@/lib/discounts';

export const dynamic = 'force-dynamic';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_ITEMS = 1000;
type Ctx = { params: Promise<{ id: string }> };

/**
 * Adds products or changes their percentage.
 * Body: { items: [{ product_id, percent_off }] } or { all: true, percent_off } for the whole catalogue.
 */
export async function PUT(request: NextRequest, ctx: Ctx) {
  const auth = await requireScreen(request, 'discounts');
  if (auth.error) return auth.error;
  const { id } = await ctx.params;
  if (!UUID.test(id)) return NextResponse.json({ error: 'Campaign not found.' }, { status: 404 });
  const body = await request.json().catch(() => ({}));

  let items: { product_id: string; percent_off: number }[] = [];
  if (body.all === true) {
    const pct = validPercent(body.percent_off);
    if (pct == null) return NextResponse.json({ error: `Use a discount between ${MIN_PERCENT}% and ${MAX_PERCENT}%.` }, { status: 400 });
    const { rows } = await query<{ id: string }>(`SELECT id FROM products WHERE status = 'active' AND price > 0`);
    items = rows.map((r) => ({ product_id: r.id, percent_off: pct }));
  } else {
    if (!Array.isArray(body.items) || body.items.length === 0) {
      return NextResponse.json({ error: 'Choose at least one product.' }, { status: 400 });
    }
    if (body.items.length > MAX_ITEMS) return NextResponse.json({ error: 'Too many products at once.' }, { status: 400 });
    for (const raw of body.items) {
      const pct = validPercent(raw?.percent_off);
      if (!UUID.test(String(raw?.product_id)) || pct == null) {
        return NextResponse.json({ error: `Each discount must be between ${MIN_PERCENT}% and ${MAX_PERCENT}%.` }, { status: 400 });
      }
      items.push({ product_id: raw.product_id, percent_off: pct });
    }
    const known = await query<{ id: string }>(`SELECT id FROM products WHERE id = ANY($1::uuid[])`, [items.map((i) => i.product_id)]);
    const ok = new Set(known.rows.map((r) => r.id));
    items = items.filter((i) => ok.has(i.product_id));
  }

  try {
    const result = await upsertItems(id, items);
    await logActivity({
      userId: auth.member.id,
      action: 'discount_products_set',
      entityType: 'discount_campaign',
      entityId: id,
      details: { count: items.length, ...result },
      ip: clientIp(request),
    });
    return NextResponse.json({ ok: true, count: items.length, ...result });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Could not save.' }, { status: 409 });
  }
}

/** Body: { product_ids: [...] } */
export async function DELETE(request: NextRequest, ctx: Ctx) {
  const auth = await requireScreen(request, 'discounts');
  if (auth.error) return auth.error;
  const { id } = await ctx.params;
  if (!UUID.test(id)) return NextResponse.json({ error: 'Campaign not found.' }, { status: 404 });
  const body = await request.json().catch(() => ({}));
  const ids: string[] = Array.isArray(body.product_ids) ? body.product_ids.filter((x: unknown) => UUID.test(String(x))) : [];
  if (!ids.length) return NextResponse.json({ error: 'Choose at least one product.' }, { status: 400 });
  try {
    const removed = await removeItems(id, ids);
    await logActivity({
      userId: auth.member.id,
      action: 'discount_products_remove',
      entityType: 'discount_campaign',
      entityId: id,
      details: { count: removed },
      ip: clientIp(request),
    });
    return NextResponse.json({ ok: true, removed });
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Could not remove.' }, { status: 409 });
  }
}
