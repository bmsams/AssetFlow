-- Generated: 2026-02-22T16:36:45.840439+00:00
-- Database: assetmgmt
-- Schema: public
-- Kind: FUNCTION
-- Signature: identify_reclamation_candidates(uuid)

CREATE OR REPLACE FUNCTION public.identify_reclamation_candidates(p_rule_id uuid DEFAULT NULL::uuid)
 RETURNS integer
 LANGUAGE plpgsql
AS $function$
DECLARE
    v_rule RECORD;
    v_count INTEGER := 0;
    v_total INTEGER := 0;
BEGIN
    -- Process each active rule (or specific rule if provided)
    FOR v_rule IN 
        SELECT * FROM reclamation_rules 
        WHERE is_active = TRUE 
          AND auto_create_candidates = TRUE
          AND (p_rule_id IS NULL OR rule_id = p_rule_id)
        ORDER BY priority
    LOOP
        -- Insert candidates matching this rule
        INSERT INTO reclamation_candidates (
            installation_id,
            days_since_last_use,
            reclamation_rule_id,
            usage_at_identification,
            status
        )
        SELECT 
            si.installation_id,
            CURRENT_DATE - si.last_used_date,
            v_rule.rule_id,
            si.usage_minutes_30day,
            'IDENTIFIED'
        FROM software_installations si
        JOIN software_products sp ON si.software_product_id = sp.product_id
        WHERE si.status = 'ACTIVE'
          AND si.last_used_date IS NOT NULL
          AND (CURRENT_DATE - si.last_used_date) >= v_rule.days_since_last_use
          AND si.usage_minutes_30day <= v_rule.min_usage_minutes_30day
          -- Apply product filter if specified
          AND (v_rule.software_product_id IS NULL OR si.software_product_id = v_rule.software_product_id)
          -- Apply category filter if specified
          AND (v_rule.product_category IS NULL OR sp.product_category = v_rule.product_category)
          -- Apply publisher filter if specified
          AND (v_rule.publisher IS NULL OR sp.publisher = v_rule.publisher)
          -- Don't create duplicate candidates
          AND NOT EXISTS (
              SELECT 1 FROM reclamation_candidates rc
              WHERE rc.installation_id = si.installation_id
                AND rc.status NOT IN ('COMPLETED', 'CANCELLED', 'REJECTED')
          );
        
        GET DIAGNOSTICS v_count = ROW_COUNT;
        v_total := v_total + v_count;
    END LOOP;
    
    RETURN v_total;
END;
$function$
