CREATE INDEX IF NOT EXISTS transactions_user_occurred_idx
  ON public.transactions (user_id, occurred_at DESC);

CREATE INDEX IF NOT EXISTS transactions_user_payment_occurred_idx
  ON public.transactions (user_id, payment_method, occurred_at DESC);

CREATE INDEX IF NOT EXISTS transactions_user_shift_idx
  ON public.transactions (user_id, shift_session_id);

CREATE INDEX IF NOT EXISTS transaction_items_transaction_id_idx
  ON public.transaction_items (transaction_id);

