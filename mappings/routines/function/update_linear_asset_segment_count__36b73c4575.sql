-- Generated: 2026-02-22T16:36:45.840439+00:00
-- Database: assetmgmt
-- Schema: public
-- Kind: FUNCTION
-- Signature: update_linear_asset_segment_count()

CREATE OR REPLACE FUNCTION public.update_linear_asset_segment_count()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
    IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
        UPDATE linear_assets
        SET segment_count = (
            SELECT COUNT(*) FROM linear_asset_segments 
            WHERE linear_asset_id = NEW.linear_asset_id
        ),
        updated_at = NOW()
        WHERE linear_asset_id = NEW.linear_asset_id;
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE linear_assets
        SET segment_count = (
            SELECT COUNT(*) FROM linear_asset_segments 
            WHERE linear_asset_id = OLD.linear_asset_id
        ),
        updated_at = NOW()
        WHERE linear_asset_id = OLD.linear_asset_id;
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$function$
