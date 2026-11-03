import { NextResponse } from 'next/server';
import { currentPromo } from '@/lib/discounts';
import { query } from '@/lib/db/pool';

export const dynamic = 'force-dynamic';

/**
 * The sale the storefront should announce (banner + popup), and with ?products=1
 * the products on sale in it. Also runs due campaign starts and ends.
 */
export async function GET(request: Request) {
  try {
    const promo = await currentPromo();
    const wantProducts = new URL(request.url).searchParams.get('products') === '1';
    let products: unknown[] = [];
    if (promo?.live && wantProducts) {
      const { rows } = await query(
        `SELECT p.id, p.name, p.slug, p.price, p.compare_at_price, p.quantity, p.moq, p.rating_avg, p.review_count,
                cp.percent_off, c.name AS category, c.slug AS category_slug,
                COALESCE((SELECT json_agg(json_build_object('url', pi.url, 'position', pi.position) ORDER BY pi.position)
                            FROM product_images pi WHERE pi.product_id = p.id), '[]') AS product_images,
                COALESCE((SELECT json_agg(json_build_object('price', pv.price, 'quantity', pv.quantity))
                            FROM product_variants pv WHERE pv.product_id = p.id), '[]') AS product_variants
           FROM campaign_products cp
           JOIN products p ON p.id = cp.product_id AND p.status = 'active'
           LEFT JOIN categories c ON c.id = p.category_id
          WHERE cp.campaign_id = $1 AND cp.applied
          ORDER BY cp.percent_off DESC, p.name`,
        [promo.id]
      );
      products = rows;
    }
    return NextResponse.json(
      { promo, products },
      { headers: { 'Cache-Control': 'public, max-age=30, stale-while-revalidate=60' } }
    );
  } catch {
    return NextResponse.json({ promo: null, products: [] });
  }
}
