ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS sku text NOT NULL DEFAULT '';

ALTER TABLE public.user_roles
  ADD COLUMN IF NOT EXISTS is_active integer NOT NULL DEFAULT 1;

ALTER TABLE public.transactions
  ADD COLUMN IF NOT EXISTS recorded_by_user_id text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS recorded_by_name text NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS shift_session_id text;

ALTER TABLE public.debts
  ADD COLUMN IF NOT EXISTS paid_amount integer NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS status text NOT NULL DEFAULT 'aktif';

ALTER TABLE public.investments
  ADD COLUMN IF NOT EXISTS akad_type text NOT NULL DEFAULT 'murabahah_bil_wakalah',
  ADD COLUMN IF NOT EXISTS monthly_return_rate_pct numeric NOT NULL DEFAULT 2.5;

ALTER TABLE public.investments
  ALTER COLUMN profit_share_pct TYPE numeric USING profit_share_pct::numeric,
  ALTER COLUMN profit_share_per_unit_pct TYPE numeric USING profit_share_per_unit_pct::numeric;

ALTER TABLE public.investor_payouts
  ALTER COLUMN share_pct TYPE numeric USING share_pct::numeric;

ALTER TABLE public.investments DROP CONSTRAINT IF EXISTS investments_type_check;
ALTER TABLE public.investments
  ADD CONSTRAINT investments_type_check
  CHECK (type IN ('uang', 'barang_titip_jual'));

ALTER TABLE public.investments DROP CONSTRAINT IF EXISTS investments_akad_type_check;
ALTER TABLE public.investments
  ADD CONSTRAINT investments_akad_type_check
  CHECK (akad_type IN ('murabahah_bil_wakalah', 'mudharabah', 'musyarakah', 'barang_titip_jual', 'sales_titipan', 'pinjaman_qardh'));

ALTER TABLE public.debts DROP CONSTRAINT IF EXISTS debts_status_check;
ALTER TABLE public.debts
  ADD CONSTRAINT debts_status_check
  CHECK (status IN ('aktif', 'lunas', 'lewat_tempo'));

CREATE TABLE IF NOT EXISTS public.invitations (
  id text PRIMARY KEY NOT NULL,
  workspace_owner_id text NOT NULL,
  email text NOT NULL,
  role text NOT NULL,
  token text NOT NULL,
  status text NOT NULL,
  invited_by_user_id text NOT NULL,
  expires_at timestamp with time zone NOT NULL,
  created_at timestamp with time zone NOT NULL,
  accepted_at timestamp with time zone,
  CONSTRAINT invitations_role_check CHECK (role IN ('pengelola_keuangan', 'kasir')),
  CONSTRAINT invitations_status_check CHECK (status IN ('pending', 'accepted', 'expired'))
);

CREATE TABLE IF NOT EXISTS public.shifts (
  id text PRIMARY KEY NOT NULL,
  workspace_owner_id text NOT NULL,
  name text NOT NULL,
  start_time text NOT NULL,
  end_time text NOT NULL,
  assigned_user_id text,
  is_active integer NOT NULL DEFAULT 1,
  created_at timestamp with time zone NOT NULL
);

CREATE TABLE IF NOT EXISTS public.shift_sessions (
  id text PRIMARY KEY NOT NULL,
  workspace_owner_id text NOT NULL,
  shift_id text NOT NULL,
  cashier_user_id text NOT NULL,
  started_at timestamp with time zone NOT NULL,
  ended_at timestamp with time zone,
  opening_cash integer,
  closing_cash integer,
  expected_cash integer,
  difference integer
);

CREATE TABLE IF NOT EXISTS public.debt_items (
  id text PRIMARY KEY NOT NULL,
  debt_id text NOT NULL,
  product_id text,
  name text NOT NULL,
  quantity integer NOT NULL,
  unit_price integer NOT NULL,
  line_total integer NOT NULL
);

CREATE TABLE IF NOT EXISTS public.debt_payments (
  id text PRIMARY KEY NOT NULL,
  debt_id text NOT NULL,
  amount integer NOT NULL,
  paid_at timestamp with time zone NOT NULL,
  note text NOT NULL,
  recorded_by_user_id text NOT NULL
);

CREATE TABLE IF NOT EXISTS public.audit_logs (
  id text PRIMARY KEY NOT NULL,
  workspace_owner_id text NOT NULL,
  actor_user_id text NOT NULL,
  event_type text NOT NULL,
  entity_type text NOT NULL,
  entity_id text,
  category text NOT NULL DEFAULT 'system',
  payload jsonb NOT NULL,
  before jsonb,
  after jsonb,
  created_at timestamp with time zone NOT NULL
);

CREATE INDEX IF NOT EXISTS user_roles_workspace_active_idx
  ON public.user_roles USING btree (workspace_owner_id, is_active);

CREATE INDEX IF NOT EXISTS invitations_workspace_email_idx
  ON public.invitations USING btree (workspace_owner_id, email);
CREATE UNIQUE INDEX IF NOT EXISTS invitations_token_idx
  ON public.invitations USING btree (token);

CREATE INDEX IF NOT EXISTS shifts_workspace_idx
  ON public.shifts USING btree (workspace_owner_id);
CREATE INDEX IF NOT EXISTS shifts_workspace_active_idx
  ON public.shifts USING btree (workspace_owner_id, is_active);

CREATE INDEX IF NOT EXISTS shift_sessions_workspace_idx
  ON public.shift_sessions USING btree (workspace_owner_id);
CREATE INDEX IF NOT EXISTS shift_sessions_shift_idx
  ON public.shift_sessions USING btree (shift_id);
CREATE INDEX IF NOT EXISTS shift_sessions_cashier_idx
  ON public.shift_sessions USING btree (cashier_user_id);
CREATE INDEX IF NOT EXISTS shift_sessions_open_idx
  ON public.shift_sessions USING btree (workspace_owner_id, ended_at);

CREATE INDEX IF NOT EXISTS debts_user_status_idx
  ON public.debts USING btree (user_id, status);
CREATE INDEX IF NOT EXISTS debt_items_debt_idx
  ON public.debt_items USING btree (debt_id);
CREATE INDEX IF NOT EXISTS debt_items_product_idx
  ON public.debt_items USING btree (product_id);
CREATE INDEX IF NOT EXISTS debt_payments_debt_idx
  ON public.debt_payments USING btree (debt_id);

CREATE INDEX IF NOT EXISTS audit_logs_workspace_created_idx
  ON public.audit_logs USING btree (workspace_owner_id, created_at);
CREATE INDEX IF NOT EXISTS audit_logs_event_idx
  ON public.audit_logs USING btree (workspace_owner_id, event_type);
CREATE INDEX IF NOT EXISTS audit_logs_actor_idx
  ON public.audit_logs USING btree (workspace_owner_id, actor_user_id);
CREATE INDEX IF NOT EXISTS audit_logs_category_idx
  ON public.audit_logs USING btree (workspace_owner_id, category);
