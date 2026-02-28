-- Generated: 2026-02-22T16:36:45.840439+00:00
-- Database: assetmgmt
-- Schema: public
-- Kind: FUNCTION
-- Signature: match_discovery_to_asset(character varying,character varying)

CREATE OR REPLACE FUNCTION public.match_discovery_to_asset(p_serial_number character varying, p_mac_address character varying)
 RETURNS TABLE(asset_id uuid, match_type character varying, confidence integer)
 LANGUAGE plpgsql
AS $function$
BEGIN
    -- Try serial number match first (highest confidence)
    IF p_serial_number IS NOT NULL AND TRIM(p_serial_number) != '' THEN
        RETURN QUERY
        SELECT 
            ha.asset_id,
            'SERIAL_NUMBER'::VARCHAR(20) AS match_type,
            100 AS confidence
        FROM hardware_assets ha
        WHERE UPPER(TRIM(ha.serial_number)) = UPPER(TRIM(p_serial_number))
        LIMIT 1;
        
        IF FOUND THEN
            RETURN;
        END IF;
    END IF;
    
    -- Try MAC address match (slightly lower confidence)
    IF p_mac_address IS NOT NULL AND TRIM(p_mac_address) != '' THEN
        RETURN QUERY
        SELECT 
            ha.asset_id,
            'MAC_ADDRESS'::VARCHAR(20) AS match_type,
            95 AS confidence
        FROM hardware_assets ha
        WHERE UPPER(REPLACE(REPLACE(REPLACE(ha.mac_address::TEXT, ':', ''), '-', ''), '.', '')) = 
              UPPER(REPLACE(REPLACE(REPLACE(p_mac_address, ':', ''), '-', ''), '.', ''))
        LIMIT 1;
        
        IF FOUND THEN
            RETURN;
        END IF;
    END IF;
    
    -- No match found
    RETURN;
END;
$function$
