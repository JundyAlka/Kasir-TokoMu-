ALTER TABLE public.products
  ADD COLUMN IF NOT EXISTS is_consignment boolean NOT NULL DEFAULT false;

CREATE TABLE IF NOT EXISTS public.product_aliases (
  id text PRIMARY KEY,
  user_id text NOT NULL,
  alias text NOT NULL,
  product_id text NOT NULL,
  created_at timestamptz NOT NULL DEFAULT now()
);

CREATE UNIQUE INDEX IF NOT EXISTS product_aliases_user_alias_lower_uq
  ON public.product_aliases (user_id, lower(alias));

CREATE INDEX IF NOT EXISTS product_aliases_user_product_idx
  ON public.product_aliases (user_id, product_id);
