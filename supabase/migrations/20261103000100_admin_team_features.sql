-- Admin tools ported from HairBudget: staff expenses, end-of-day close, SMS resend log.
-- Staff screens and roles live in site_settings (staff_permissions, staff_screens);
-- the activity log uses audit_logs; profit margins use products.cost_per_item.

CREATE TABLE IF NOT EXISTS public.staff_expenses (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id uuid,
  staff_name text,
  staff_email text,
  amount numeric NOT NULL CHECK (amount >= 0),
  description text NOT NULL,
  category text,
  spent_on date NOT NULL DEFAULT CURRENT_DATE,
  -- pending until the owner reviews it.
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by uuid,
  reviewed_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS staff_expenses_spent_on_idx ON public.staff_expenses (spent_on DESC);

CREATE TABLE IF NOT EXISTS public.end_of_day_reports (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  report_date date NOT NULL UNIQUE,
  opening_cash numeric NOT NULL DEFAULT 0,
  counted_cash numeric,
  expected_cash numeric NOT NULL DEFAULT 0,
  variance numeric,
  website_collected numeric NOT NULL DEFAULT 0,
  pos_collected numeric NOT NULL DEFAULT 0,
  cash_collected numeric NOT NULL DEFAULT 0,
  card_collected numeric NOT NULL DEFAULT 0,
  momo_collected numeric NOT NULL DEFAULT 0,
  other_collected numeric NOT NULL DEFAULT 0,
  orders_count integer NOT NULL DEFAULT 0,
  items_sold integer NOT NULL DEFAULT 0,
  order_total numeric NOT NULL DEFAULT 0,
  expenses_total numeric NOT NULL DEFAULT 0,
  notes text,
  snapshot jsonb NOT NULL DEFAULT '{}'::jsonb,
  closed_by uuid,
  closed_by_name text,
  closed_at timestamptz,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_eod_reports_date ON public.end_of_day_reports (report_date DESC);
CREATE INDEX IF NOT EXISTS idx_orders_created_at ON public.orders (created_at);

CREATE TABLE IF NOT EXISTS public.sms_resend_log (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  batch_id text NOT NULL,
  phase text NOT NULL,
  order_id uuid REFERENCES public.orders(id) ON DELETE SET NULL,
  phone text NOT NULL,
  message text NOT NULL,
  status text NOT NULL DEFAULT 'pending' CHECK (status IN ('pending', 'sent', 'failed', 'insufficient_balance', 'skipped')),
  provider_code text,
  error_message text,
  attempts int NOT NULL DEFAULT 0,
  last_attempted_at timestamptz,
  created_at timestamptz NOT NULL DEFAULT now(),
  updated_at timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS idx_sms_resend_log_unique_orders
  ON public.sms_resend_log (batch_id, phase, order_id) WHERE phase = 'orders';
CREATE UNIQUE INDEX IF NOT EXISTS idx_sms_resend_log_unique_apology
  ON public.sms_resend_log (batch_id, phase, phone) WHERE phase = 'apology';
CREATE INDEX IF NOT EXISTS idx_sms_resend_log_batch_status ON public.sms_resend_log (batch_id, status);

CREATE INDEX IF NOT EXISTS audit_logs_created_idx ON public.audit_logs (created_at DESC);

DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM pg_roles WHERE rolname = 'houseofelle_staging') THEN
    GRANT SELECT, INSERT, UPDATE, DELETE ON public.staff_expenses, public.end_of_day_reports, public.sms_resend_log
      TO houseofelle_staging;
  END IF;
END $$;
