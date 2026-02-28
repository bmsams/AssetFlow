-- Generated: 2026-02-22T16:36:45.840439+00:00
-- Database: assetmgmt
-- Schema: public
-- Kind: FUNCTION
-- Signature: generate_asset_tag(character varying)

CREATE OR REPLACE FUNCTION public.generate_asset_tag(p_asset_type character varying)
 RETURNS character varying
 LANGUAGE plpgsql
AS $function$
DECLARE
    v_prefix VARCHAR(10);
    v_sequence INTEGER;
    v_tag VARCHAR(50);
BEGIN
    -- Determine prefix based on asset type
    CASE p_asset_type
        WHEN 'HARDWARE' THEN v_prefix := 'HW';
        WHEN 'SOFTWARE' THEN v_prefix := 'SW';
        WHEN 'ENTERPRISE' THEN v_prefix := 'EA';
        ELSE v_prefix := 'AS';
    END CASE;
    
    -- Get next sequence number for this type
    SELECT COALESCE(MAX(
        CASE 
            WHEN asset_tag ~ ('^AMS-' || v_prefix || '-[0-9]+$')
            THEN CAST(SUBSTRING(asset_tag FROM '[0-9]+$') AS INTEGER)
            ELSE 0
        END
    ), 0) + 1
    INTO v_sequence
    FROM assets
    WHERE asset_type = p_asset_type;
    
    -- Generate tag with zero-padded sequence
    v_tag := 'AMS-' || v_prefix || '-' || LPAD(v_sequence::TEXT, 8, '0');
    
    RETURN v_tag;
END;
$function$
