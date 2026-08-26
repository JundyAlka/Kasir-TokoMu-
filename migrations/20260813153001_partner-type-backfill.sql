-- Classify only legacy default partners. Existing manual classifications are
-- preserved, while a second run makes no further changes.
ALTER TABLE public.investors ADD COLUMN IF NOT EXISTS partner_type text NOT NULL DEFAULT 'investor_uang';

UPDATE public.investors
SET partner_type = 'titipan_bagihasil'
WHERE partner_type = 'investor_uang'
  AND (
    lower(coalesce(notes, '')) like '%titip%'
    OR lower(coalesce(notes, '')) like '%nitip%'
    OR lower(coalesce(notes, '')) like '%konsinyasi%'
    OR lower(coalesce(notes, '')) like '%barang%'
  );

UPDATE public.investors
SET partner_type = 'titipan_bagihasil'
WHERE partner_type = 'investor_uang'
  AND id IN (
    SELECT investment.investor_id
    FROM public.investments AS investment
    WHERE investment.is_active = 1
      AND (
        investment.type = 'barang_titip_jual'
        OR investment.akad_type IN ('barang_titip_jual', 'sales_titipan')
      )
  );
