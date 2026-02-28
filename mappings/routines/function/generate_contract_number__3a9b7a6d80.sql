-- Generated: 2026-02-22T16:36:45.840439+00:00
-- Database: assetmgmt
-- Schema: public
-- Kind: FUNCTION
-- Signature: generate_contract_number(character varying)

CREATE OR REPLACE FUNCTION public.generate_contract_number(p_contract_type character varying)
 RETURNS character varying
 LANGUAGE plpgsql
AS $function$
DECLARE
    v_prefix VARCHAR(10);
    v_year VARCHAR(4);
    v_sequence INTEGER;
    v_contract_number VARCHAR(100);
BEGIN
    -- Determine prefix based on contract type
    CASE p_contract_type
        WHEN 'PURCHASE' THEN v_prefix := 'PUR';
        WHEN 'LEASE' THEN v_prefix := 'LSE';
        WHEN 'MAINTENANCE' THEN v_prefix := 'MNT';
        WHEN 'SUPPORT' THEN v_prefix := 'SUP';
        WHEN 'LICENSE' THEN v_prefix := 'LIC';
        WHEN 'WARRANTY' THEN v_prefix := 'WRN';
        WHEN 'SERVICE' THEN v_prefix := 'SVC';
        WHEN 'SUBSCRIPTION' THEN v_prefix := 'SUB';
        WHEN 'MASTER' THEN v_prefix := 'MST';
        ELSE v_prefix := 'CON';
    END CASE;
    
    v_year := TO_CHAR(CURRENT_DATE, 'YYYY');
    
    SELECT COALESCE(MAX(
        CASE 
            WHEN contract_number ~ ('^' || v_prefix || '-' || v_year || '-[0-9]+$')
            THEN CAST(SUBSTRING(contract_number FROM '[0-9]+$') AS INTEGER)
            ELSE 0
        END
    ), 0) + 1
    INTO v_sequence
    FROM contracts
    WHERE contract_number LIKE v_prefix || '-' || v_year || '-%';
    
    v_contract_number := v_prefix || '-' || v_year || '-' || LPAD(v_sequence::TEXT, 5, '0');
    
    RETURN v_contract_number;
END;
$function$
