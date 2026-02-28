-- Generated: 2026-02-22T16:36:45.840439+00:00
-- Database: assetmgmt
-- Schema: public
-- Kind: FUNCTION
-- Signature: normalize_manufacturer(character varying)

CREATE OR REPLACE FUNCTION public.normalize_manufacturer(p_raw_name character varying)
 RETURNS uuid
 LANGUAGE plpgsql
AS $function$
DECLARE
    v_normalized VARCHAR(255);
    v_manufacturer_id UUID;
BEGIN
    -- Normalize the input: uppercase, trim whitespace
    v_normalized := UPPER(TRIM(p_raw_name));
    
    -- First, try to find by normalized name
    SELECT manufacturer_id INTO v_manufacturer_id
    FROM manufacturers
    WHERE normalized_name = v_normalized;
    
    IF v_manufacturer_id IS NOT NULL THEN
        RETURN v_manufacturer_id;
    END IF;
    
    -- Try to find by alias match
    SELECT manufacturer_id INTO v_manufacturer_id
    FROM manufacturers
    WHERE v_normalized = ANY(
        SELECT UPPER(TRIM(unnest(aliases)))
    );
    
    IF v_manufacturer_id IS NOT NULL THEN
        RETURN v_manufacturer_id;
    END IF;
    
    -- If not found, create a new manufacturer entry
    INSERT INTO manufacturers (name, normalized_name)
    VALUES (p_raw_name, v_normalized)
    ON CONFLICT (normalized_name) DO UPDATE SET name = EXCLUDED.name
    RETURNING manufacturer_id INTO v_manufacturer_id;
    
    RETURN v_manufacturer_id;
END;
$function$
