-- Generated: 2026-02-22T16:36:45.840439+00:00
-- Database: assetmgmt
-- Schema: public
-- Kind: FUNCTION
-- Signature: get_reorder_alerts(uuid)

CREATE OR REPLACE FUNCTION public.get_reorder_alerts(p_stockroom_id uuid DEFAULT NULL::uuid)
 RETURNS TABLE(stockroom_id uuid, stockroom_name character varying, product_id uuid, product_type character varying, product_description character varying, quantity_on_hand integer, quantity_available integer, reorder_point integer, reorder_quantity integer, shortage integer)
 LANGUAGE plpgsql
AS $function$
BEGIN
    RETURN QUERY
    SELECT 
        si.stockroom_id,
        s.name AS stockroom_name,
        si.product_id,
        si.product_type,
        si.product_description,
        si.quantity_on_hand,
        si.quantity_available,
        si.reorder_point,
        si.reorder_quantity,
        (si.reorder_point - si.quantity_available) AS shortage
    FROM stockroom_inventory si
    JOIN stockrooms s ON si.stockroom_id = s.stockroom_id
    WHERE si.is_active = TRUE
      AND si.reorder_point IS NOT NULL
      AND si.quantity_available <= si.reorder_point
      AND (p_stockroom_id IS NULL OR si.stockroom_id = p_stockroom_id)
    ORDER BY shortage DESC, s.name, si.product_description;
END;
$function$
