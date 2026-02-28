-- Generated: 2026-02-22T16:36:45.840439+00:00
-- Database: assetmgmt
-- Schema: public
-- Kind: FUNCTION
-- Signature: generate_checkout_number()

CREATE OR REPLACE FUNCTION public.generate_checkout_number()
 RETURNS character varying
 LANGUAGE plpgsql
AS $function$
DECLARE
    v_sequence INTEGER;
    v_number VARCHAR(50);
BEGIN
    SELECT COALESCE(MAX(
        CASE 
            WHEN checkout_number ~ '^LNR-[0-9]+$'
            THEN CAST(SUBSTRING(checkout_number FROM 5) AS INTEGER)
            ELSE 0
        END
    ), 0) + 1
    INTO v_sequence
    FROM loaner_checkouts;
    
    v_number := 'LNR-' || LPAD(v_sequence::TEXT, 8, '0');
    RETURN v_number;
END;
$function$
