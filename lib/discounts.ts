// Discount campaigns (server only). See supabase/migrations/20261103000000_discount_campaigns.sql.
//
// A live campaign writes its sale prices onto products and variants, so every
// price reader (shop, cart, checkout, POS, /api/orders) charges the sale price
// with no campaign awareness. Ending it puts the regular prices back, unless
// someone changed the price by hand in the meantime, in which case their price wins.

import type { PoolClient } from 'pg';
import { getPool, query } from '@/lib/db/pool';

export type CampaignStatus = 'draft' | 'scheduled' | 'live' | 'ended';

export interface Campaign {
  id: string;
  name: string;
  status: CampaignStatus;
  starts_at: string | null;
  ends_at: string | null;
  banner_enabled: boolean;
  banner_text: string | null;
  popup_enabled: boolean;
  popup_title: string | null;
  popup_message: string | null;
  popup_cta_label: string | null;
  announce: boolean;
  started_at: string | null;
  ended_at: string | null;
  created_at: string;
  updated_at: string;
}

export const MIN_PERCENT = 1;
export const MAX_PERCENT = 90;

const round2 = (n: number) => Math.round(n * 100) / 100;

export function salePrice(price: number, percentOff: number): number {
  return round2(price * (1 - percentOff / 100));
}

export function validPercent(value: unknown): number | null {
  const n = Number(value);
  if (!Number.isFinite(n)) return null;
  const rounded = Math.round(n * 10) / 10;
  return rounded >= MIN_PERCENT && rounded <= MAX_PERCENT ? rounded : null;
}

async function withTx<T>(fn: (c: PoolClient) => Promise<T>): Promise<T> {
  const client = await getPool().connect();
  try {
    await client.query('BEGIN');
    const out = await fn(client);
    await client.query('COMMIT');
    return out;
  } catch (err) {
    await client.query('ROLLBACK').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

type Row = {
  product_id: string;
  percent_off: number;
  applied: boolean;
  original_price: number | null;
  original_compare_at: number | null;
  sale_price: number | null;
  variant_originals: Array<{ id: string; price: number | null; compare_at_price: number | null; sale_price: number | null }>;
};

/** Writes one product's sale price. Returns false when another campaign already discounts it. */
async function applyRow(c: PoolClient, campaignId: string, row: Row): Promise<boolean> {
  const taken = await c.query(
    `SELECT 1 FROM campaign_products WHERE product_id = $1 AND applied AND campaign_id <> $2`,
    [row.product_id, campaignId]
  );
  if (taken.rowCount) return false;

  const prod = await c.query(
    `SELECT price, compare_at_price FROM products WHERE id = $1 FOR UPDATE`,
    [row.product_id]
  );
  if (!prod.rowCount) return false;
  const price = Number(prod.rows[0].price);
  if (!Number.isFinite(price) || price <= 0) return false;
  const sale = salePrice(price, Number(row.percent_off));

  const variants = await c.query(
    `SELECT id, price, compare_at_price FROM product_variants WHERE product_id = $1 FOR UPDATE`,
    [row.product_id]
  );
  const variantOriginals = [];
  for (const v of variants.rows) {
    const vPrice = v.price == null ? null : Number(v.price);
    const vSale = vPrice != null && vPrice > 0 ? salePrice(vPrice, Number(row.percent_off)) : null;
    variantOriginals.push({ id: v.id, price: vPrice, compare_at_price: v.compare_at_price, sale_price: vSale });
    if (vSale != null) {
      await c.query(`UPDATE product_variants SET price = $2, compare_at_price = $3, updated_at = now() WHERE id = $1`, [
        v.id,
        vSale,
        vPrice,
      ]);
    }
  }

  await c.query(`UPDATE products SET price = $2, compare_at_price = $3, updated_at = now() WHERE id = $1`, [
    row.product_id,
    sale,
    price,
  ]);
  await c.query(
    `UPDATE campaign_products
        SET applied = true, original_price = $3, original_compare_at = $4, sale_price = $5,
            variant_originals = $6::jsonb, updated_at = now()
      WHERE campaign_id = $1 AND product_id = $2`,
    [campaignId, row.product_id, price, prod.rows[0].compare_at_price, sale, JSON.stringify(variantOriginals)]
  );
  return true;
}

/** Puts one product's regular price back, keeping any price someone set by hand during the sale. */
async function restoreRow(c: PoolClient, campaignId: string, row: Row): Promise<void> {
  if (!row.applied) return;
  await c.query(
    `UPDATE products
        SET price = CASE WHEN price = $2 THEN $3 ELSE price END,
            -- The sale set compare_at to the regular price; put the old one back
            -- even when the price itself was changed by hand.
            compare_at_price = CASE WHEN compare_at_price = $3 THEN $4 ELSE compare_at_price END,
            updated_at = now()
      WHERE id = $1`,
    [row.product_id, row.sale_price, row.original_price, row.original_compare_at]
  );
  for (const v of row.variant_originals || []) {
    if (v.sale_price == null) continue;
    await c.query(
      `UPDATE product_variants
          SET price = CASE WHEN price = $2 THEN $3 ELSE price END,
              compare_at_price = CASE WHEN compare_at_price = $3 THEN $4 ELSE compare_at_price END,
              updated_at = now()
        WHERE id = $1`,
      [v.id, v.sale_price, v.price, v.compare_at_price]
    );
  }
  await c.query(
    `UPDATE campaign_products
        SET applied = false, original_price = NULL, original_compare_at = NULL, sale_price = NULL,
            variant_originals = '[]'::jsonb, updated_at = now()
      WHERE campaign_id = $1 AND product_id = $2`,
    [campaignId, row.product_id]
  );
}

async function rowsFor(c: PoolClient, campaignId: string, productIds?: string[]): Promise<Row[]> {
  const res = productIds
    ? await c.query(`SELECT * FROM campaign_products WHERE campaign_id = $1 AND product_id = ANY($2::uuid[]) FOR UPDATE`, [
        campaignId,
        productIds,
      ])
    : await c.query(`SELECT * FROM campaign_products WHERE campaign_id = $1 FOR UPDATE`, [campaignId]);
  return res.rows as Row[];
}

async function lockCampaign(c: PoolClient, id: string): Promise<Campaign | null> {
  const res = await c.query(`SELECT * FROM discount_campaigns WHERE id = $1 FOR UPDATE`, [id]);
  return (res.rows[0] as Campaign) || null;
}

export interface StartResult {
  applied: number;
  skipped: string[]; // product names already discounted by another live campaign
}

/** Makes a campaign live now and writes its sale prices. */
export async function startCampaign(id: string): Promise<StartResult> {
  return withTx(async (c) => {
    const campaign = await lockCampaign(c, id);
    if (!campaign) throw new Error('Campaign not found.');
    if (campaign.status === 'live') throw new Error('This campaign is already live.');
    const rows = await rowsFor(c, id);
    let applied = 0;
    const skippedIds: string[] = [];
    for (const row of rows) {
      if (await applyRow(c, id, row)) applied++;
      else skippedIds.push(row.product_id);
    }
    await c.query(
      `UPDATE discount_campaigns
          SET status = 'live', started_at = now(), ended_at = NULL,
              starts_at = CASE WHEN starts_at IS NULL OR starts_at > now() THEN now() ELSE starts_at END,
              ends_at = CASE WHEN ends_at IS NOT NULL AND ends_at <= now() THEN NULL ELSE ends_at END,
              updated_at = now()
        WHERE id = $1`,
      [id]
    );
    const names = skippedIds.length
      ? (await c.query(`SELECT name FROM products WHERE id = ANY($1::uuid[])`, [skippedIds])).rows.map((r) => r.name)
      : [];
    return { applied, skipped: names };
  });
}

/** Ends a campaign and restores regular prices. */
export async function endCampaign(id: string): Promise<{ restored: number }> {
  return withTx(async (c) => {
    const campaign = await lockCampaign(c, id);
    if (!campaign) throw new Error('Campaign not found.');
    const rows = await rowsFor(c, id);
    let restored = 0;
    for (const row of rows) {
      if (row.applied) {
        await restoreRow(c, id, row);
        restored++;
      }
    }
    await c.query(
      `UPDATE discount_campaigns
          SET status = 'ended', ended_at = now(), announce = false,
              ends_at = CASE WHEN ends_at IS NULL OR ends_at > now() THEN now() ELSE ends_at END,
              updated_at = now()
        WHERE id = $1`,
      [id]
    );
    return { restored };
  });
}

export interface ItemInput {
  product_id: string;
  percent_off: number;
}

/**
 * Adds or re-prices products in a campaign. On a live campaign the new
 * percentage is written to the product straight away.
 */
export async function upsertItems(id: string, items: ItemInput[]): Promise<StartResult> {
  return withTx(async (c) => {
    const campaign = await lockCampaign(c, id);
    if (!campaign) throw new Error('Campaign not found.');
    if (campaign.status === 'ended') throw new Error('This campaign has ended. Duplicate it to run it again.');
    const ids = items.map((i) => i.product_id);
    const existing = new Map((await rowsFor(c, id, ids)).map((r) => [r.product_id, r]));
    let applied = 0;
    const skippedIds: string[] = [];

    for (const item of items) {
      const prev = existing.get(item.product_id);
      if (prev && Number(prev.percent_off) === item.percent_off && (prev.applied || campaign.status !== 'live')) {
        continue;
      }
      if (prev?.applied) await restoreRow(c, id, prev);
      await c.query(
        `INSERT INTO campaign_products (campaign_id, product_id, percent_off)
         VALUES ($1, $2, $3)
         ON CONFLICT (campaign_id, product_id) DO UPDATE SET percent_off = EXCLUDED.percent_off, updated_at = now()`,
        [id, item.product_id, item.percent_off]
      );
      if (campaign.status === 'live') {
        const [row] = await rowsFor(c, id, [item.product_id]);
        if (await applyRow(c, id, row)) applied++;
        else skippedIds.push(item.product_id);
      }
    }
    await c.query(`UPDATE discount_campaigns SET updated_at = now() WHERE id = $1`, [id]);
    const names = skippedIds.length
      ? (await c.query(`SELECT name FROM products WHERE id = ANY($1::uuid[])`, [skippedIds])).rows.map((r) => r.name)
      : [];
    return { applied, skipped: names };
  });
}

/** Removes products from a campaign, restoring their prices if it is live. */
export async function removeItems(id: string, productIds: string[]): Promise<number> {
  return withTx(async (c) => {
    const campaign = await lockCampaign(c, id);
    if (!campaign) throw new Error('Campaign not found.');
    const rows = await rowsFor(c, id, productIds);
    for (const row of rows) await restoreRow(c, id, row);
    const res = await c.query(`DELETE FROM campaign_products WHERE campaign_id = $1 AND product_id = ANY($2::uuid[])`, [
      id,
      productIds,
    ]);
    return res.rowCount ?? 0;
  });
}

/** Deletes a campaign that is not live. */
export async function deleteCampaign(id: string): Promise<void> {
  await withTx(async (c) => {
    const campaign = await lockCampaign(c, id);
    if (!campaign) throw new Error('Campaign not found.');
    if (campaign.status === 'live') throw new Error('End the campaign before deleting it.');
    await c.query(`DELETE FROM discount_campaigns WHERE id = $1`, [id]);
  });
}

let lastSync = 0;

/**
 * Starts scheduled campaigns whose start time has passed and ends live ones
 * whose end time has passed. Called from the storefront promo endpoint, the
 * order API and the admin, so schedules run without a separate cron job.
 * Throttled per process; `force` skips the throttle.
 */
export async function syncCampaigns(force = false): Promise<void> {
  const now = Date.now();
  if (!force && now - lastSync < 30_000) return;
  lastSync = now;
  try {
    const due = await query<{ id: string; status: CampaignStatus }>(
      `SELECT id, status FROM discount_campaigns
        WHERE (status = 'scheduled' AND starts_at IS NOT NULL AND starts_at <= now())
           OR (status = 'live' AND ends_at IS NOT NULL AND ends_at <= now())`
    );
    for (const row of due.rows) {
      try {
        if (row.status === 'live') await endCampaign(row.id);
        else {
          const ended = await query(`SELECT 1 FROM discount_campaigns WHERE id = $1 AND ends_at IS NOT NULL AND ends_at <= now()`, [row.id]);
          if (ended.rowCount) {
            await query(`UPDATE discount_campaigns SET status = 'ended', ended_at = now(), announce = false, updated_at = now() WHERE id = $1`, [row.id]);
          } else {
            await startCampaign(row.id);
          }
        }
      } catch (err) {
        console.error('[discounts] sync failed for campaign', row.id, err);
      }
    }
  } catch (err) {
    // Missing tables (migration not applied yet) must never break checkout.
    lastSync = now;
    console.warn('[discounts] sync skipped:', err instanceof Error ? err.message : err);
  }
}

export interface Promo {
  id: string;
  name: string;
  live: boolean;
  banner_text: string | null;
  popup: { title: string | null; message: string | null; cta_label: string | null } | null;
  starts_at: string | null;
  ends_at: string | null;
  product_count: number;
  max_percent: number;
  min_percent: number;
  updated_at: string;
}

/** The campaign the storefront should announce: the live one first, otherwise an announced one. */
export async function currentPromo(): Promise<Promo | null> {
  await syncCampaigns();
  const res = await query(
    `SELECT dc.*,
            (SELECT count(*) FROM campaign_products cp WHERE cp.campaign_id = dc.id)::int AS product_count,
            (SELECT max(percent_off) FROM campaign_products cp WHERE cp.campaign_id = dc.id) AS max_percent,
            (SELECT min(percent_off) FROM campaign_products cp WHERE cp.campaign_id = dc.id) AS min_percent
       FROM discount_campaigns dc
      WHERE dc.status = 'live'
         OR (dc.announce AND dc.status IN ('draft', 'scheduled') AND (dc.ends_at IS NULL OR dc.ends_at > now()))
      ORDER BY (dc.status = 'live') DESC, dc.updated_at DESC
      LIMIT 1`
  );
  const c = res.rows[0];
  if (!c) return null;
  return {
    id: c.id,
    name: c.name,
    live: c.status === 'live',
    banner_text: c.banner_enabled ? c.banner_text || c.name : null,
    popup: c.popup_enabled
      ? { title: c.popup_title || c.name, message: c.popup_message, cta_label: c.popup_cta_label || 'Shop the sale' }
      : null,
    starts_at: c.status === 'live' ? null : c.starts_at,
    ends_at: c.ends_at,
    product_count: c.product_count,
    max_percent: Number(c.max_percent) || 0,
    min_percent: Number(c.min_percent) || 0,
    updated_at: c.updated_at,
  };
}
