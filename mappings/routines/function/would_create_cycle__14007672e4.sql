-- Generated: 2026-02-22T16:36:45.840439+00:00
-- Database: assetmgmt
-- Schema: public
-- Kind: FUNCTION
-- Signature: would_create_cycle(uuid,uuid,character varying)

CREATE OR REPLACE FUNCTION public.would_create_cycle(p_source_asset_id uuid, p_target_asset_id uuid, p_relation_type character varying)
 RETURNS boolean
 LANGUAGE plpgsql
AS $function$
DECLARE
    v_has_cycle BOOLEAN;
BEGIN
    -- Only check for hierarchical relationship types
    IF p_relation_type NOT IN ('PARENT_CHILD', 'DEPENDENCY') THEN
        RETURN FALSE;
    END IF;
    
    -- Check if target is already an ancestor of source
    SELECT EXISTS(
        SELECT 1 
        FROM get_asset_ancestors(p_source_asset_id, p_relation_type) a
        WHERE a.ancestor_id = p_target_asset_id
    ) INTO v_has_cycle;
    
    RETURN v_has_cycle;
END;
$function$
