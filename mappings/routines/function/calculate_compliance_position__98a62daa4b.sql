-- Generated: 2026-02-22T16:36:45.840439+00:00
-- Database: assetmgmt
-- Schema: public
-- Kind: FUNCTION
-- Signature: calculate_compliance_position(uuid)

CREATE OR REPLACE FUNCTION public.calculate_compliance_position(p_product_id uuid)
 RETURNS TABLE(entitlements_owned integer, installations_found integer, compliance_position character varying, over_under_count integer)
 LANGUAGE plpgsql
AS $function$
DECLARE
    v_entitlements INTEGER;
    v_installations INTEGER;
BEGIN
    -- Get total entitlements
    SELECT COALESCE(SUM(quantity_purchased), 0)
    INTO v_entitlements
    FROM entitlements
    WHERE software_product_id = p_product_id
      AND is_active = TRUE;
    
    -- Get active installations
    SELECT COUNT(*)
    INTO v_installations
    FROM software_installations
    WHERE software_product_id = p_product_id
      AND status = 'ACTIVE';
    
    -- Return results
    RETURN QUERY SELECT 
        v_entitlements,
        v_installations,
        CASE 
            WHEN v_entitlements >= v_installations THEN 
                CASE WHEN v_entitlements > v_installations THEN 'OVER_LICENSED'::VARCHAR(20)
                     ELSE 'COMPLIANT'::VARCHAR(20)
                END
            ELSE 'UNDER_LICENSED'::VARCHAR(20)
        END,
        v_entitlements - v_installations;
END;
$function$
