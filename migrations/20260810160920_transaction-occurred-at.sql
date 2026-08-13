ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS occurred_at timestamptz;
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS entry_source text NOT NULL DEFAULT 'pos';
ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS external_ref text NULL;
UPDATE public.transactions SET occurred_at = created_at WHERE occurred_at IS NULL;
ALTER TABLE public.transactions ALTER COLUMN occurred_at SET NOT NULL;
CREATE UNIQUE INDEX IF NOT EXISTS transactions_external_ref_uq
  ON public.transactions (external_ref) WHERE external_ref IS NOT NULL;
CREATE INDEX IF NOT EXISTS transactions_occurred_at_idx
  ON public.transactions (occurred_at);
