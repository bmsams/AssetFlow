-- Generated: 2026-02-22T16:36:45.840439+00:00
-- Database: assetmgmt
-- Schema: public
-- Kind: FUNCTION
-- Signature: generate_work_order_number()

CREATE OR REPLACE FUNCTION public.generate_work_order_number()
 RETURNS character varying
 LANGUAGE plpgsql
AS $function$
DECLARE
    v_year INTEGER;
    v_sequence INTEGER;
    v_number VARCHAR(50);
BEGIN
    v_year := EXTRACT(YEAR FROM CURRENT_DATE);
    
    -- Get next sequence number for this year
    SELECT COALESCE(MAX(
        CASE 
            WHEN work_order_number ~ ('^WO-' || v_year || '-[0-9]+$')
            THEN CAST(SUBSTRING(work_order_number FROM '[0-9]+$') AS INTEGER)
            ELSE 0
        END
    ), 0) + 1
    INTO v_sequence
    FROM work_orders
    WHERE work_order_number LIKE 'WO-' || v_year || '-%';
    
    -- Generate number with zero-padded sequence
    v_number := 'WO-' || v_year || '-' || LPAD(v_sequence::TEXT, 6, '0');
    
    RETURN v_number;
END;
$function$
