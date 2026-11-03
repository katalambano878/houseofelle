// Profit margins (owner only). Cost prices live in products.cost_per_item and
// product_variants.cost_per_item, which rest-policy hides from customers.
//
// While a discount campaign is live, products.price is the sale price and
// campaign_products.original_price holds the regular price (rows with applied = true).

import { NextRequest, NextResponse } from 'next/server';
import { query } from '@/lib/db/pool';
import { clientIp, logActivity, requireScreen } from '@/lib/admin-session';
import { syncCampaigns } from '@/lib/discounts';

export const dynamic = 'force-dynamic';

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const MAX_COST = 1_000_000;

const num = (v: unknown): number | null => (v == null || v === '' || !Number.isFinite(Number(v)) ? null : Number(v));

type VariantOriginal = { id: string; price: number | null; sale_price: number | null };

export async function GET(request: NextRequest) {
  const auth = await requireScreen(request, 'profit');
  if (auth.error) return auth.error;

  // Start or end any campaign whose schedule has passed, so sale prices are current.
  await syncCampaigns();

  try {
    const { rows } = await query(
      `SELECT p.id, p.name, p.slug, p.sku, p.status::text AS status, p.price, p.compare_at_price, p.cost_per_item,
              p.quantity, p.track_quantity, c.name AS category,
              (SELECT url FROM product_images pi WHERE pi.product_id = p.id ORDER BY pi.position NULLS LAST, pi.created_at LIMIT 1) AS image,
              COALESCE((
                SELECT json_agg(json_build_object(
                         'id', v.id, 'name', v.name, 'sku', v.sku, 'price', v.price,
                         'cost', v.cost_per_item, 'quantity', v.quantity
                       ) ORDER BY v.created_at, v.name)
                  FROM product_variants v WHERE v.product_id = p.id
              ), '[]'::json) AS variants,
              sale.campaign_id, sale.campaign_name, sale.percent_off, sale.original_price, sale.variant_originals, sale.ends_at,
              COALESCE(sold.units, 0)::int AS units_30d, COALESCE(sold.revenue, 0)::float AS revenue_30d
         FROM products p
         LEFT JOIN categories c ON c.id = p.category_id
         LEFT JOIN LATERAL (
           SELECT cp.campaign_id, dc.name AS campaign_name, cp.percent_off, cp.original_price, cp.variant_originals, dc.ends_at
             FROM campaign_products cp
             JOIN discount_campaigns dc ON dc.id = cp.campaign_id
            WHERE cp.product_id = p.id AND cp.applied
            ORDER BY cp.updated_at DESC
            LIMIT 1
         ) sale ON true
         LEFT JOIN (
           SELECT oi.product_id, SUM(oi.quantity) AS units, SUM(oi.total_price) AS revenue
             FROM order_items oi
             JOIN orders o ON o.id = oi.order_id
            WHERE o.payment_status = 'paid' AND o.created_at > now() - interval '30 days'
            GROUP BY oi.product_id
         ) sold ON sold.product_id = p.id
        WHERE p.status <> 'archived'
        ORDER BY p.name`
    );

    const products = rows.map((p: any) => {
      const price = num(p.price) ?? 0;
      const original = num(p.original_price);
      const onSale = Boolean(p.campaign_id) && original != null && original > price + 0.004;
      const originals = new Map<string, VariantOriginal>(
        (Array.isArray(p.variant_originals) ? p.variant_originals : []).map((v: VariantOriginal) => [v.id, v])
      );
      const productCost = num(p.cost_per_item);
      const variants = (Array.isArray(p.variants) ? p.variants : []).map((v: any) => {
        const vPrice = num(v.price) ?? 0;
        const orig = originals.get(v.id);
        const vRegular = onSale && orig && orig.sale_price != null && num(orig.price) != null ? Number(orig.price) : vPrice;
        const ownCost = num(v.cost);
        return {
          id: v.id as string,
          name: v.name as string,
          sku: (v.sku as string) || null,
          stock: num(v.quantity),
          currentPrice: vPrice,
          regularPrice: vRegular,
          onSale: vRegular > vPrice + 0.004,
          cost: ownCost,
          effectiveCost: ownCost ?? productCost,
          costInherited: ownCost == null && productCost != null,
        };
      });

      return {
        id: p.id as string,
        name: p.name as string,
        slug: p.slug as string,
        sku: (p.sku as string) || null,
        status: p.status as string,
        category: (p.category as string) || null,
        image: (p.image as string) || null,
        stock: p.track_quantity === false ? null : num(p.quantity),
        currentPrice: price,
        regularPrice: onSale ? (original as number) : price,
        onSale,
        campaign: onSale
          ? { id: p.campaign_id as string, name: p.campaign_name as string, percentOff: num(p.percent_off), endsAt: p.ends_at as string | null }
          : null,
        cost: productCost,
        variants,
        units30d: Number(p.units_30d) || 0,
        revenue30d: Number(p.revenue_30d) || 0,
      };
    });

    return NextResponse.json({ products }, { headers: { 'Cache-Control': 'no-store' } });
  } catch (err) {
    console.error('[profit] list failed', err);
    return NextResponse.json({ error: 'Could not load products. Try again.' }, { status: 500 });
  }
}

/** Saves (or clears) the cost price of one product or one variant. */
export async function PUT(request: NextRequest) {
  const auth = await requireScreen(request, 'profit');
  if (auth.error) return auth.error;
  const { member } = auth;
  if (member.role !== 'admin') {
    return NextResponse.json({ error: 'Only the owner can change cost prices.' }, { status: 403 });
  }

  const body = await request.json().catch(() => ({}));
  const productId = typeof body.productId === 'string' ? body.productId : '';
  const variantId = typeof body.variantId === 'string' && body.variantId ? body.variantId : null;
  if (!UUID.test(productId)) return NextResponse.json({ error: 'Pick a product.' }, { status: 400 });
  if (variantId && !UUID.test(variantId)) return NextResponse.json({ error: 'Pick a variant.' }, { status: 400 });

  let cost: number | null = null;
  if (!(body.cost === null || body.cost === '' || body.cost === undefined)) {
    const n = Number(body.cost);
    if (!Number.isFinite(n) || n < 0) {
      return NextResponse.json({ error: 'Enter what one unit costs you, in cedis.', field: 'cost' }, { status: 400 });
    }
    if (n > MAX_COST) return NextResponse.json({ error: 'That cost is too high. Check the amount.', field: 'cost' }, { status: 400 });
    cost = Math.round(n * 100) / 100;
  }

  try {
    let label = '';
    let previous: number | null = null;
    if (variantId) {
      const { rows } = await query<{ product_name: string; variant_name: string; previous: number | null }>(
        `WITH old AS (SELECT id, cost_per_item FROM product_variants WHERE id = $1 AND product_id = $2)
         UPDATE product_variants v SET cost_per_item = $3
           FROM old, products p
          WHERE v.id = old.id AND p.id = v.product_id
         RETURNING p.name AS product_name, v.name AS variant_name, old.cost_per_item AS previous`,
        [variantId, productId, cost]
      );
      if (!rows[0]) return NextResponse.json({ error: 'That variant no longer exists.' }, { status: 404 });
      label = `${rows[0].product_name} (${rows[0].variant_name})`;
      previous = num(rows[0].previous);
    } else {
      const { rows } = await query<{ name: string; previous: number | null }>(
        `WITH old AS (SELECT id, cost_per_item FROM products WHERE id = $1)
         UPDATE products p SET cost_per_item = $2
           FROM old
          WHERE p.id = old.id
         RETURNING p.name, old.cost_per_item AS previous`,
        [productId, cost]
      );
      if (!rows[0]) return NextResponse.json({ error: 'That product no longer exists.' }, { status: 404 });
      label = rows[0].name;
      previous = num(rows[0].previous);
    }

    await logActivity({
      userId: member.id,
      action: 'update',
      entityType: variantId ? 'product_variant_cost' : 'product_cost',
      entityId: variantId || productId,
      details: { label, product_id: productId, cost_before: previous, cost_after: cost },
      ip: clientIp(request),
    });

    return NextResponse.json({
      productId,
      variantId,
      cost,
      message: cost == null ? `Cleared the cost for ${label}.` : `Saved cost for ${label}.`,
    });
  } catch (err) {
    console.error('[profit] save failed', err);
    return NextResponse.json({ error: 'Could not save the cost. Try again.' }, { status: 500 });
  }
}
