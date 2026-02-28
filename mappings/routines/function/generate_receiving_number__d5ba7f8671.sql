-- Generated: 2026-02-22T16:36:45.840439+00:00
-- Database: assetmgmt
-- Schema: public
-- Kind: FUNCTION
-- Signature: generate_receiving_number()

CREATE OR REPLACE FUNCTION public.generate_receiving_number()
 RETURNS character varying
 LANGUAGE plpgsql
AS $function$
DECLARE
    v_sequence INTEGER;
    v_number VARCHAR(50);
BEGIN
    SELECT COALESCE(MAX(
        CASE 
            WHEN receiving_number ~ '^RCV-[0-9]+$'
            THEN CAST(SUBSTRING(receiving_number FROM 5) AS INTEGER)
            ELSE 0
        END
    ), 0) + 1
    INTO v_sequence
    FROM receiving_records;
    
    v_number := 'RCV-' || LPAD(v_sequence::TEXT, 8, '0');
    RETURN v_number;
END;
$function$
