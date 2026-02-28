-- Generated: 2026-02-22T16:36:45.840439+00:00
-- Database: assetmgmt
-- Schema: public
-- Kind: FUNCTION
-- Signature: trg_manufacturers_set_defaults()

CREATE OR REPLACE FUNCTION public.trg_manufacturers_set_defaults()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  IF NEW.normalized_name IS NULL OR length(trim(NEW.normalized_name)) = 0 THEN
    NEW.normalized_name := upper(regexp_replace(trim(NEW.name), '\s+', ' ', 'g'));
  END IF;

  IF NEW.code IS NULL OR length(trim(NEW.code)) = 0 THEN
    NEW.code := NEW.normalized_name;
  END IF;

  RETURN NEW;
END;
$function$
