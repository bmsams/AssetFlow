-- Generated: 2026-02-22T16:36:45.840439+00:00
-- Database: assetmgmt
-- Schema: public
-- Kind: FUNCTION
-- Signature: get_asset_descendants(uuid,character varying)

CREATE OR REPLACE FUNCTION public.get_asset_descendants(p_asset_id uuid, p_relation_type character varying DEFAULT 'PARENT_CHILD'::character varying)
 RETURNS TABLE(descendant_id uuid, depth integer)
 LANGUAGE plpgsql
AS $function$
BEGIN
    RETURN QUERY
    WITH RECURSIVE descendants AS (
        -- Base case: direct children
        SELECT 
            r.target_asset_id AS descendant_id,
            1 AS depth
        FROM asset_relationships r
        WHERE r.source_asset_id = p_asset_id
          AND r.relation_type = p_relation_type
        
        UNION ALL
        
        -- Recursive case: children of children
        SELECT 
            r.target_asset_id,
            d.depth + 1
        FROM asset_relationships r
        INNER JOIN descendants d ON r.source_asset_id = d.descendant_id
        WHERE r.relation_type = p_relation_type
          AND d.depth < 100  -- Prevent infinite loops
    )
    SELECT DISTINCT d.descendant_id, MIN(d.depth) AS depth
    FROM descendants d
    GROUP BY d.descendant_id
    ORDER BY depth;
END;
$function$
