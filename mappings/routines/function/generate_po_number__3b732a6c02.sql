-- Generated: 2026-02-22T16:36:45.840439+00:00
-- Database: assetmgmt
-- Schema: public
-- Kind: FUNCTION
-- Signature: generate_po_number()

CREATE OR REPLACE FUNCTION public.generate_po_number()
 RETURNS character varying
 LANGUAGE plpgsql
AS $function$
DECLARE
    v_year VARCHAR(4);
    v_sequence INTEGER;
    v_po_number VARCHAR(100);
BEGIN
    v_year := TO_CHAR(CURRENT_DATE, 'YYYY');
    
    SELECT COALESCE(MAX(
        CASE 
            WHEN po_number ~ ('^PO-' || v_year || '-[0-9]+$')
            THEN CAST(SUBSTRING(po_number FROM '[0-9]+$') AS INTEGER)
            ELSE 0
        END
    ), 0) + 1
    INTO v_sequence
    FROM purchase_orders
    WHERE po_number LIKE 'PO-' || v_year || '-%';
    
    v_po_number := 'PO-' || v_year || '-' || LPAD(v_sequence::TEXT, 6, '0');
    
    RETURN v_po_number;
END;
$function$
