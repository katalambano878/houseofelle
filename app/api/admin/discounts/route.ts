import { NextRequest, NextResponse } from 'next/server';
import { clientIp, logActivity, requireScreen } from '@/lib/admin-session';
import { query } from '@/lib/db/pool';
import { syncCampaigns } from '@/lib/discounts';
import { campaignFields } from './fields';

export const dynamic = 'force-dynamic';

/** All campaigns with their product counts and discount range. */
export async function GET(request: NextRequest) {
  const auth = await requireScreen(request, 'discounts');
  if (auth.error) return auth.error;
  await syncCampaigns(true);

  // ?product=<id>: the live sale this product is in, for the product editor.
  const productId = request.nextUrl.searchParams.get('product');
  if (productId) {
    if (!/^[0-9a-f-]{36}$/i.test(productId)) return NextResponse.json({ sale: null });
    const sale = await query(
      `SELECT dc.id, dc.name, cp.percent_off, cp.original_price
         FROM campaign_products cp JOIN discount_campaigns dc ON dc.id = cp.campaign_id
        WHERE cp.product_id = $1 AND cp.applied LIMIT 1`,
      [productId]
    );
    return NextResponse.json({ sale: sale.rows[0] ?? null });
  }

  const { rows } = await query(
    `SELECT dc.*,
            count(cp.product_id)::int AS product_count,
            count(cp.product_id) FILTER (WHERE cp.applied)::int AS applied_count,
            min(cp.percent_off) AS min_percent,
            max(cp.percent_off) AS max_percent,
            COALESCE(sum(cp.original_price - cp.sale_price) FILTER (WHERE cp.applied), 0) AS unit_savings
       FROM discount_campaigns dc
       LEFT JOIN campaign_products cp ON cp.campaign_id = dc.id
      GROUP BY dc.id
      ORDER BY (dc.status = 'live') DESC, (dc.status = 'scheduled') DESC, dc.updated_at DESC`
  );
  return NextResponse.json({ campaigns: rows });
}

/** Creates a draft campaign, optionally copying another campaign's products. */
export async function POST(request: NextRequest) {
  const auth = await requireScreen(request, 'discounts');
  if (auth.error) return auth.error;
  const body = await request.json().catch(() => ({}));
  const parsed = campaignFields(body, true);
  if ('error' in parsed) return NextResponse.json({ error: parsed.error }, { status: 400 });

  const f = parsed.fields;
  const { rows } = await query(
    `INSERT INTO discount_campaigns
       (name, starts_at, ends_at, banner_enabled, banner_text, popup_enabled, popup_title, popup_message,
        popup_cta_label, announce, created_by)
     VALUES ($1, $2, $3, COALESCE($4, true), $5, COALESCE($6, true), $7, $8, $9, COALESCE($10, false), $11)
     RETURNING *`,
    [
      f.name, f.starts_at ?? null, f.ends_at ?? null, f.banner_enabled, f.banner_text ?? null, f.popup_enabled,
      f.popup_title ?? null, f.popup_message ?? null, f.popup_cta_label ?? null, f.announce, auth.member.id,
    ]
  );
  const campaign = rows[0];

  const copyFrom = typeof body.copy_from === 'string' ? body.copy_from : null;
  if (copyFrom && /^[0-9a-f-]{36}$/i.test(copyFrom)) {
    await query(
      `INSERT INTO campaign_products (campaign_id, product_id, percent_off)
       SELECT $1, product_id, percent_off FROM campaign_products WHERE campaign_id = $2`,
      [campaign.id, copyFrom]
    );
  }

  await logActivity({
    userId: auth.member.id,
    action: 'discount_campaign_create',
    entityType: 'discount_campaign',
    entityId: campaign.id,
    details: { name: campaign.name },
    ip: clientIp(request),
  });
  return NextResponse.json({ campaign }, { status: 201 });
}
