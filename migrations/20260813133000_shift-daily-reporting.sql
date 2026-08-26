-- IDs in this application are text identifiers. Keep new ownership and relation
-- columns text-compatible with the existing products, investors, and sessions.

ALTER TABLE public.shift_sessions ADD COLUMN IF NOT EXISTS opening_coins bigint NOT NULL DEFAULT 0;
ALTER TABLE public.shift_sessions ADD COLUMN IF NOT EXISTS opening_savings bigint NOT NULL DEFAULT 0;
ALTER TABLE public.shift_sessions ADD COLUMN IF NOT EXISTS closing_coins bigint;
ALTER TABLE public.shift_sessions ADD COLUMN IF NOT EXISTS closing_savings bigint;
ALTER TABLE public.shift_sessions ADD COLUMN IF NOT EXISTS expected_closing bigint;
ALTER TABLE public.shift_sessions ADD COLUMN IF NOT EXISTS variance bigint;
ALTER TABLE public.shift_sessions ADD COLUMN IF NOT EXISTS variance_note text;
ALTER TABLE public.shift_sessions ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'open';
ALTER TABLE public.shift_sessions ADD COLUMN IF NOT EXISTS opened_at timestamptz;
ALTER TABLE public.shift_sessions ADD COLUMN IF NOT EXISTS closed_at timestamptz;
ALTER TABLE public.shift_sessions ADD COLUMN IF NOT EXISTS opened_by_user_id text;
ALTER TABLE public.shift_sessions ADD COLUMN IF NOT EXISTS closed_by_user_id text;

UPDATE public.shift_sessions SET opening_cash = 0 WHERE opening_cash IS NULL;
ALTER TABLE public.shift_sessions ALTER COLUMN opening_cash TYPE bigint;
ALTER TABLE public.shift_sessions ALTER COLUMN closing_cash TYPE bigint;
ALTER TABLE public.shift_sessions ALTER COLUMN opening_cash SET DEFAULT 0;
ALTER TABLE public.shift_sessions ALTER COLUMN opening_cash SET NOT NULL;
UPDATE public.shift_sessions
SET opened_at = started_at,
    closed_at = ended_at,
    status = CASE WHEN ended_at IS NULL THEN 'open' ELSE 'closed' END
WHERE opened_at IS NULL;
UPDATE public.shift_sessions SET expected_closing = expected_cash WHERE expected_closing IS NULL;
UPDATE public.shift_sessions SET variance = difference WHERE variance IS NULL;
ALTER TABLE public.shift_sessions DROP CONSTRAINT IF EXISTS shift_sessions_status_check;
ALTER TABLE public.shift_sessions ADD CONSTRAINT shift_sessions_status_check CHECK (status IN ('open', 'closed'));

CREATE TABLE IF NOT EXISTS public.daily_reports (
  id text PRIMARY KEY NOT NULL,
  user_id text NOT NULL,
  report_date date NOT NULL,
  opening_total bigint NOT NULL DEFAULT 0,
  revenue bigint NOT NULL DEFAULT 0,
  cogs bigint NOT NULL DEFAULT 0,
  expense_total bigint NOT NULL DEFAULT 0,
  gross_profit bigint NOT NULL DEFAULT 0,
  net_profit bigint NOT NULL DEFAULT 0,
  closing_total bigint NOT NULL DEFAULT 0,
  transaction_count integer NOT NULL DEFAULT 0,
  profit_distribution bigint NOT NULL DEFAULT 0,
  status text NOT NULL DEFAULT 'draft',
  locked_at timestamptz,
  locked_by_user_id text,
  created_at timestamptz NOT NULL,
  updated_at timestamptz NOT NULL,
  UNIQUE (user_id, report_date)
);
ALTER TABLE public.daily_reports DROP CONSTRAINT IF EXISTS daily_reports_status_check;
ALTER TABLE public.daily_reports ADD CONSTRAINT daily_reports_status_check CHECK (status IN ('draft', 'locked'));

ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS shift_session_id text;
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS expense_type text NOT NULL DEFAULT 'operasional';
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS investor_id text;
ALTER TABLE public.expenses ADD COLUMN IF NOT EXISTS is_cash_movement boolean NOT NULL DEFAULT false;
ALTER TABLE public.expenses DROP CONSTRAINT IF EXISTS expenses_expense_type_check;
ALTER TABLE public.expenses ADD CONSTRAINT expenses_expense_type_check CHECK (
  expense_type IN ('sales_toko', 'sales_titipan', 'operasional', 'gaji_sosial', 'setoran_tabungan', 'bagi_hasil_investor')
);

ALTER TABLE public.investors ADD COLUMN IF NOT EXISTS partner_type text NOT NULL DEFAULT 'investor_uang';
ALTER TABLE public.investors DROP CONSTRAINT IF EXISTS investors_partner_type_check;
ALTER TABLE public.investors ADD CONSTRAINT investors_partner_type_check CHECK (
  partner_type IN ('investor_uang', 'titipan_bagihasil', 'sales_harian')
);

CREATE TABLE IF NOT EXISTS public.titipan_intakes (
  id text PRIMARY KEY NOT NULL,
  user_id text NOT NULL,
  investor_id text NOT NULL,
  product_id text,
  intake_date date NOT NULL,
  qty_in integer NOT NULL,
  qty_sold integer NOT NULL DEFAULT 0,
  unit_cost bigint NOT NULL DEFAULT 0,
  unit_price bigint NOT NULL DEFAULT 0,
  settled_amount bigint NOT NULL DEFAULT 0,
  shift_session_id text,
  created_at timestamptz NOT NULL
);

CREATE INDEX IF NOT EXISTS daily_reports_user_report_date_idx
  ON public.daily_reports (user_id, report_date);
CREATE INDEX IF NOT EXISTS expenses_user_shift_session_idx
  ON public.expenses (user_id, shift_session_id);
CREATE INDEX IF NOT EXISTS titipan_intakes_user_investor_idx
  ON public.titipan_intakes (user_id, investor_id);
CREATE INDEX IF NOT EXISTS titipan_intakes_user_shift_session_idx
  ON public.titipan_intakes (user_id, shift_session_id);
