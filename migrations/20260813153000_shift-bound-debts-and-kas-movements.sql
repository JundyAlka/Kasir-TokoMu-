-- The application uses text identifiers, so these relation columns deliberately
-- match the existing IDs instead of introducing an incompatible uuid type.
ALTER TABLE public.debts ADD COLUMN IF NOT EXISTS shift_session_id text;
ALTER TABLE public.debt_payments ADD COLUMN IF NOT EXISTS shift_session_id text;

CREATE INDEX IF NOT EXISTS debts_user_shift_session_idx
  ON public.debts (user_id, shift_session_id);
CREATE INDEX IF NOT EXISTS debt_payments_shift_session_idx
  ON public.debt_payments (shift_session_id);

CREATE TABLE IF NOT EXISTS public.kas_movements (
  id text PRIMARY KEY NOT NULL,
  user_id text NOT NULL,
  shift_session_id text NOT NULL,
  from_bucket text NOT NULL,
  to_bucket text NOT NULL,
  amount bigint NOT NULL,
  note text NOT NULL DEFAULT '',
  created_at timestamptz NOT NULL,
  CONSTRAINT kas_movements_bucket_check CHECK (
    from_bucket IN ('cash', 'coins', 'savings')
    AND to_bucket IN ('cash', 'coins', 'savings')
    AND from_bucket <> to_bucket
  ),
  CONSTRAINT kas_movements_amount_check CHECK (amount > 0)
);

CREATE INDEX IF NOT EXISTS kas_movements_user_shift_session_idx
  ON public.kas_movements (user_id, shift_session_id);
