-- Generated: 2026-02-22T16:36:45.840439+00:00
-- Database: assetmgmt
-- Schema: public
-- Kind: FUNCTION
-- Signature: get_asset_ancestors(uuid,character varying)

CREATE OR REPLACE FUNCTION public.get_asset_ancestors(p_asset_id uuid, p_relation_type character varying DEFAULT 'PARENT_CHILD'::character varying)
 RETURNS TABLE(ancestor_id uuid, depth integer)
 LANGUAGE plpgsql
AS $function$
BEGIN
    RETURN QUERY
    WITH RECURSIVE ancestors AS (
        -- Base case: direct parents
        SELECT 
            r.source_asset_id AS ancestor_id,
            1 AS depth
        FROM asset_relationships r
        WHERE r.target_asset_id = p_asset_id
          AND r.relation_type = p_relation_type
        
        UNION ALL
        
        -- Recursive case: parents of parents
        SELECT 
            r.source_asset_id,
            a.depth + 1
        FROM asset_relationships r
        INNER JOIN ancestors a ON r.target_asset_id = a.ancestor_id
        WHERE r.relation_type = p_relation_type
          AND a.depth < 100  -- Prevent infinite loops
    )
    SELECT DISTINCT a.ancestor_id, MIN(a.depth) AS depth
    FROM ancestors a
    GROUP BY a.ancestor_id
    ORDER BY depth;
END;
$function$
