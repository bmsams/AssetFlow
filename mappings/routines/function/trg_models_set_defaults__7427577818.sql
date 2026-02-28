-- Generated: 2026-02-22T16:36:45.840439+00:00
-- Database: assetmgmt
-- Schema: public
-- Kind: FUNCTION
-- Signature: trg_models_set_defaults()

CREATE OR REPLACE FUNCTION public.trg_models_set_defaults()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  IF NEW.normalized_name IS NULL OR length(trim(NEW.normalized_name)) = 0 THEN
    NEW.normalized_name := upper(regexp_replace(trim(NEW.model_name), '\s+', ' ', 'g'));
  END IF;

  IF NEW.status IS NULL OR length(trim(NEW.status)) = 0 THEN
    NEW.status := 'ACTIVE';
  END IF;

  IF NEW.category IS NULL AND NEW.model_category IS NOT NULL THEN
    NEW.category := NEW.model_category;
  END IF;
  IF NEW.model_category IS NULL AND NEW.category IS NOT NULL THEN
    NEW.model_category := NEW.category;
  END IF;

  IF NEW.sku IS NULL AND NEW.model_number IS NOT NULL THEN
    NEW.sku := NEW.model_number;
  END IF;

  RETURN NEW;
END;
$function$
