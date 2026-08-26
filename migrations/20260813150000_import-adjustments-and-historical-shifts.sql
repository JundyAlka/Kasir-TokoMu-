ALTER TABLE public.transaction_items ADD COLUMN IF NOT EXISTS is_adjustment boolean NOT NULL DEFAULT false;
ALTER TABLE public.transaction_items ADD COLUMN IF NOT EXISTS note text NOT NULL DEFAULT '';
ALTER TABLE public.transaction_items ALTER COLUMN product_id DROP NOT NULL;
ALTER TABLE public.transaction_items DROP CONSTRAINT IF EXISTS transaction_items_adjustment_product_check;
ALTER TABLE public.transaction_items ADD CONSTRAINT transaction_items_adjustment_product_check CHECK (
  (is_adjustment = true AND product_id IS NULL) OR (is_adjustment = false AND product_id IS NOT NULL)
);
ALTER TABLE public.transaction_items DROP CONSTRAINT IF EXISTS transaction_items_non_adjustment_value_check;
ALTER TABLE public.transaction_items ADD CONSTRAINT transaction_items_non_adjustment_value_check CHECK (
  is_adjustment = true OR (quantity > 0 AND unit_price >= 0 AND cost_price >= 0)
);

ALTER TABLE public.shift_sessions ADD COLUMN IF NOT EXISTS needs_review boolean NOT NULL DEFAULT false;
ALTER TABLE public.shift_sessions ALTER COLUMN opening_cash DROP NOT NULL;
ALTER TABLE public.shift_sessions ALTER COLUMN opening_cash DROP DEFAULT;
ALTER TABLE public.shift_sessions ALTER COLUMN opening_coins DROP NOT NULL;
ALTER TABLE public.shift_sessions ALTER COLUMN opening_coins DROP DEFAULT;
ALTER TABLE public.shift_sessions ALTER COLUMN opening_savings DROP NOT NULL;
ALTER TABLE public.shift_sessions ALTER COLUMN opening_savings DROP DEFAULT;
