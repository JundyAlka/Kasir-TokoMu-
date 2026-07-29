ALTER TABLE public.user_roles
  ADD COLUMN IF NOT EXISTS monthly_salary integer NOT NULL DEFAULT 0;

ALTER TABLE public.investments
  ADD COLUMN IF NOT EXISTS profit_share_per_unit_amount integer;

ALTER TABLE public.investor_payouts
  ADD COLUMN IF NOT EXISTS share_mode text NOT NULL DEFAULT 'percentage',
  ADD COLUMN IF NOT EXISTS per_unit_amount integer;
