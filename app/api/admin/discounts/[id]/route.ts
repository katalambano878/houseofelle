import { NextRequest, NextResponse } from 'next/server';
import { clientIp, logActivity, requireScreen } from '@/lib/admin-session';
import { query } from '@/lib/db/pool';
import { deleteCampaign, endCampaign, startCampaign, syncCampaigns } from '@/lib/discounts';
import { campaignFields } from '../fields';

export const dynamic = 'force-dynamic';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
type Ctx = { params: Promise<{ id: string }> };

async function loadCampaign(id: string) {
  const { rows } = await query(`SELECT * FROM discount_campaigns WHERE id = $1`, [id]);
  if (!rows[0]) return null;
  const items = await query(
    `SELECT cp.product_id, cp.percent_off, cp.applied, cp.original_price, cp.sale_price,
            p.name, p.slug, p.sku, p.price, p.compare_at_price, p.quantity, p.status::text AS status,
            c.name AS category,
            (SELECT url FROM product_images pi WHERE pi.product_id = p.id ORDER BY position NULLS LAST LIMIT 1) AS image,
            (SELECT count(*) FROM product_variants pv WHERE pv.product_id = p.id)::int AS variant_count,
            other.name AS conflict_campaign
       FROM campaign_products cp
       JOIN products p ON p.id = cp.product_id
       LEFT JOIN categories c ON c.id = p.category_id
       LEFT JOIN LATERAL (
         SELECT dc.name FROM campaign_products o JOIN discount_campaigns dc ON dc.id = o.campaign_id
          WHERE o.product_id = cp.product_id AND o.campaign_id <> cp.campaign_id AND o.applied LIMIT 1
       ) other ON true
      WHERE cp.campaign_id = $1
      ORDER BY p.name`,
    [id]
  );
  // Products another campaign is discounting right now cannot take this one's price.
  const busy = await query(
    `SELECT o.product_id, dc.name AS campaign
       FROM campaign_products o JOIN discount_campaigns dc ON dc.id = o.campaign_id
      WHERE o.applied AND o.campaign_id <> $1`,
    [id]
  );
  return { campaign: rows[0], items: items.rows, busy: busy.rows };
}

export async function GET(request: NextRequest, ctx: Ctx) {
  const auth = await requireScreen(request, 'discounts');
  if (auth.error) return auth.error;
  const { id } = await ctx.params;
  if (!UUID.test(id)) return NextResponse.json({ error: 'Campaign not found.' }, { status: 404 });
  await syncCampaigns(true);
  const data = await loadCampaign(id);
  if (!data) return NextResponse.json({ error: 'Campaign not found.' }, { status: 404 });
  return NextResponse.json(data);
}

/** Saves names, dates, banner and popup settings. */
export async function PATCH(request: NextRequest, ctx: Ctx) {
  const auth = await requireScreen(request, 'discounts');
  if (auth.error) return auth.error;
  const { id } = await ctx.params;
  if (!UUID.test(id)) return NextResponse.json({ error: 'Campaign not found.' }, { status: 404 });
  const body = await request.json().catch(() => ({}));
  const parsed = campaignFields(body, false);
  if ('error' in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const entries = Object.entries(parsed.fields);
  if (entries.length) {
    const current = await query(`SELECT starts_at, ends_at, status FROM discount_campaigns WHERE id = $1`, [id]);
    const row = current.rows[0];
    if (!row) return NextResponse.json({ error: 'Campaign not found.' }, { status: 404 });
    const starts = parsed.fields.starts_at !== undefined ? parsed.fields.starts_at : row.starts_at;
    const ends = parsed.fields.ends_at !== undefined ? parsed.fields.ends_at : row.ends_at;
    if (starts && ends && new Date(ends) <= new Date(starts)) {
      return NextResponse.json({ error: 'The end must be after the start.' }, { status: 400 });
    }
    if (row.status === 'scheduled' && !starts) {
      return NextResponse.json({ error: 'A scheduled campaign needs a start time.' }, { status: 400 });
    }
    const sets = entries.map(([k], i) => `${k} = $${i + 2}`);
    await query(
      `UPDATE discount_campaigns SET ${sets.join(', ')}, updated_at = now() WHERE id = $1`,
      [id, ...entries.map(([, v]) => v)]
    );
    await logActivity({
      userId: auth.member.id,
      action: 'discount_campaign_update',
      entityType: 'discount_campaign',
      entityId: id,
      details: { fields: entries.map(([k]) => k) },
      ip: clientIp(request),
    });
  }
  await syncCampaigns(true);
  return NextResponse.json(await loadCampaign(id));
}

/** start | end | schedule | unschedule */
export async function POST(request: NextRequest, ctx: Ctx) {
  const auth = await requireScreen(request, 'discounts');
  if (auth.error) return auth.error;
  const { id } = await ctx.params;
  if (!UUID.test(id)) return NextResponse.json({ error: 'Campaign not found.' }, { status: 404 });
  const { action } = await request.json().catch(() => ({}));
  const { rows } = await query(`SELECT * FROM discount_campaigns WHERE id = $1`, [id]);
  const campaign = rows[0];
  if (!campaign) return NextResponse.json({ error: 'Campaign not found.' }, { status: 404 });

  let result: Record<string, unknown> = {};
  try {
    if (action === 'start') {
      const count = await query(`SELECT count(*)::int AS n FROM campaign_products WHERE campaign_id = $1`, [id]);
      if (!count.rows[0].n) return NextResponse.json({ error: 'Add at least one product before starting.' }, { status: 400 });
      result = { ...(await startCampaign(id)) };
    } else if (action === 'end') {
      if (campaign.status !== 'live') return NextResponse.json({ error: 'Only a live campaign can be ended.' }, { status: 400 });
      result = { ...(await endCampaign(id)) };
    } else if (action === 'schedule') {
      if (!campaign.starts_at || new Date(campaign.starts_at) <= new Date()) {
        return NextResponse.json({ error: 'Set a start time in the future to schedule.' }, { status: 400 });
      }
      if (campaign.status !== 'draft') return NextResponse.json({ error: 'Only a draft can be scheduled.' }, { status: 400 });
      await query(`UPDATE discount_campaigns SET status = 'scheduled', updated_at = now() WHERE id = $1`, [id]);
    } else if (action === 'unschedule') {
      if (campaign.status !== 'scheduled') return NextResponse.json({ error: 'This campaign is not scheduled.' }, { status: 400 });
      await query(`UPDATE discount_campaigns SET status = 'draft', updated_at = now() WHERE id = $1`, [id]);
    } else {
      return NextResponse.json({ error: 'Unknown action.' }, { status: 400 });
    }
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Could not update the campaign.' }, { status: 409 });
  }

  await logActivity({
    userId: auth.member.id,
    action: `discount_campaign_${action}`,
    entityType: 'discount_campaign',
    entityId: id,
    details: { name: campaign.name, ...result },
    ip: clientIp(request),
  });
  return NextResponse.json({ ...result, ...(await loadCampaign(id)) });
}

export async function DELETE(request: NextRequest, ctx: Ctx) {
  const auth = await requireScreen(request, 'discounts');
  if (auth.error) return auth.error;
  const { id } = await ctx.params;
  if (!UUID.test(id)) return NextResponse.json({ error: 'Campaign not found.' }, { status: 404 });
  try {
    await deleteCampaign(id);
  } catch (err) {
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Could not delete.' }, { status: 409 });
  }
  await logActivity({
    userId: auth.member.id,
    action: 'discount_campaign_delete',
    entityType: 'discount_campaign',
    entityId: id,
    ip: clientIp(request),
  });
  return NextResponse.json({ ok: true });
}
