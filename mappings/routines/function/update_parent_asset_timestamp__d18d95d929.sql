-- Generated: 2026-02-22T16:36:45.840439+00:00
-- Database: assetmgmt
-- Schema: public
-- Kind: FUNCTION
-- Signature: update_parent_asset_timestamp()

CREATE OR REPLACE FUNCTION public.update_parent_asset_timestamp()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
    UPDATE assets 
    SET updated_at = NOW()
    WHERE asset_id = NEW.asset_id;
    RETURN NEW;
END;
$function$
