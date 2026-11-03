-- Discount campaigns: a named sale (e.g. Black Friday) with its own dates, storefront
-- banner and popup, and a per-product percentage off.
--
-- While a campaign is live its prices are written onto products and variants
-- (price = discounted, compare_at_price = the regular price), so the shop, cart,
-- checkout, POS and server-side order pricing all charge the sale price without
-- knowing about campaigns. The originals are kept on campaign_products and put
-- back when the campaign ends.

CREATE TABLE IF NOT EXISTS public.discount_campaigns (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  -- draft: being set up; live: prices applied; ended: prices restored.
  status text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft', 'scheduled', 'live', 'ended')),
  starts_at timestamptz,
  ends_at timestamptz,
  banner_enabled boolean NOT NULL DEFAULT true,
  banner_text text,
  popup_enabled boolean NOT NULL DEFAULT true,
  popup_title text,
  popup_message text,
  popup_cta_label text,
  -- Shown on the storefront while the campaign is announced, even before
  -- products are added (the banner can go up ahead of the prices).
  announce boolean NOT NULL DEFAULT false,
  created_by uuid,
  started_at timestamptz,
  ended_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  CHECK (ends_at IS NULL OR starts_at IS NULL OR ends_at > starts_at)
);

CREATE TABLE IF NOT EXISTS public.campaign_products (
  campaign_id uuid NOT NULL REFERENCES public.discount_campaigns(id) ON DELETE CASCADE,
  product_id uuid NOT NULL REFERENCES public.products(id) ON DELETE CASCADE,
  percent_off numeric NOT NULL CHECK (percent_off > 0 AND percent_off <= 90),
  -- Set while the discount is applied to the product.
  applied boolean NOT NULL DEFAULT false,
  original_price numeric,
  original_compare_at numeric,
  sale_price numeric,
  -- [{id, price, compare_at_price, sale_price}] for each variant at apply time.
  variant_originals jsonb NOT NULL DEFAULT '[]'::jsonb,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY (campaign_id, product_id)
);

-- A product can carry only one applied discount at a time.
CREATE UNIQUE INDEX IF NOT EXISTS campaign_products_one_applied
  ON public.campaign_products (product_id) WHERE applied;
CREATE INDEX IF NOT EXISTS campaign_products_product_idx ON public.campaign_products (product_id);
CREATE INDEX IF NOT EXISTS discount_campaigns_status_idx ON public.discount_campaigns (status);

-- Seed the Black Friday campaign so the banner and popup show straight away;
-- the owner adds products and percentages from Admin > Discounts.
INSERT INTO public.discount_campaigns
  (name, status, banner_enabled, banner_text, popup_enabled, popup_title, popup_message, popup_cta_label, announce)
SELECT
  'Black Friday', 'draft', true,
  'Black Friday sales!!! Enjoy massive discounts, 10 to 40% off',
  true,
  'Black Friday is here',
  'Enjoy massive discounts of 10 to 40% off selected perfumes, body mists and candles.',
  'Shop the sale',
  true
WHERE NOT EXISTS (SELECT 1 FROM public.discount_campaigns WHERE name = 'Black Friday');

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'houseofelle_staging') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON public.discount_campaigns, public.campaign_products TO houseofelle_staging;
  END IF;
END $$;
