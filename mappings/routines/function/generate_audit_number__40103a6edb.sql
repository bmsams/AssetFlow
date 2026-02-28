-- Generated: 2026-02-22T16:36:45.840439+00:00
-- Database: assetmgmt
-- Schema: public
-- Kind: FUNCTION
-- Signature: generate_audit_number()

CREATE OR REPLACE FUNCTION public.generate_audit_number()
 RETURNS character varying
 LANGUAGE plpgsql
AS $function$
DECLARE
    v_sequence INTEGER;
    v_number VARCHAR(50);
BEGIN
    SELECT COALESCE(MAX(
        CASE 
            WHEN audit_number ~ '^AUD-[0-9]+$'
            THEN CAST(SUBSTRING(audit_number FROM 5) AS INTEGER)
            ELSE 0
        END
    ), 0) + 1
    INTO v_sequence
    FROM audit_records;
    
    v_number := 'AUD-' || LPAD(v_sequence::TEXT, 8, '0');
    RETURN v_number;
END;
$function$
