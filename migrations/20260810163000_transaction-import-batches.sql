ALTER TABLE public.transactions ADD COLUMN IF NOT EXISTS import_batch_id text;

CREATE TABLE IF NOT EXISTS public.transaction_import_batches (
  id text PRIMARY KEY NOT NULL,
  workspace_owner_id text NOT NULL,
  file_name text NOT NULL,
  invoice_count integer NOT NULL,
  item_count integer NOT NULL,
  total_amount integer NOT NULL,
  imported_by_user_id text NOT NULL,
  created_at timestamptz NOT NULL,
  rolled_back_at timestamptz NULL,
  rolled_back_by_user_id text NULL
);

CREATE INDEX IF NOT EXISTS transactions_import_batch_idx
  ON public.transactions (user_id, import_batch_id);
CREATE INDEX IF NOT EXISTS transaction_import_batches_workspace_idx
  ON public.transaction_import_batches (workspace_owner_id, created_at);
