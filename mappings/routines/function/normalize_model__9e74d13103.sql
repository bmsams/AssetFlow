-- Generated: 2026-02-22T16:36:45.840439+00:00
-- Database: assetmgmt
-- Schema: public
-- Kind: FUNCTION
-- Signature: normalize_model(uuid,character varying,character varying)

CREATE OR REPLACE FUNCTION public.normalize_model(p_manufacturer_id uuid, p_raw_model_name character varying, p_model_category character varying DEFAULT NULL::character varying)
 RETURNS uuid
 LANGUAGE plpgsql
AS $function$
DECLARE
    v_normalized VARCHAR(255);
    v_model_id UUID;
BEGIN
    -- Normalize the input: uppercase, trim whitespace
    v_normalized := UPPER(TRIM(p_raw_model_name));
    
    -- First, try to find by manufacturer and normalized name
    SELECT model_id INTO v_model_id
    FROM models
    WHERE manufacturer_id = p_manufacturer_id
      AND normalized_name = v_normalized;
    
    IF v_model_id IS NOT NULL THEN
        RETURN v_model_id;
    END IF;
    
    -- Try to find by alias match
    SELECT model_id INTO v_model_id
    FROM models
    WHERE manufacturer_id = p_manufacturer_id
      AND v_normalized = ANY(
          SELECT UPPER(TRIM(unnest(aliases)))
      );
    
    IF v_model_id IS NOT NULL THEN
        RETURN v_model_id;
    END IF;
    
    -- If not found, create a new model entry
    INSERT INTO models (manufacturer_id, model_name, normalized_name, model_category)
    VALUES (p_manufacturer_id, p_raw_model_name, v_normalized, p_model_category)
    ON CONFLICT (manufacturer_id, normalized_name) DO UPDATE 
        SET model_name = EXCLUDED.model_name,
            model_category = COALESCE(EXCLUDED.model_category, models.model_category)
    RETURNING model_id INTO v_model_id;
    
    RETURN v_model_id;
END;
$function$
