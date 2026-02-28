-- Generated: 2026-02-22T16:36:45.840439+00:00
-- Database: assetmgmt
-- Schema: public
-- Kind: FUNCTION
-- Signature: get_stale_assets(integer)

CREATE OR REPLACE FUNCTION public.get_stale_assets(p_days_threshold integer DEFAULT 30)
 RETURNS TABLE(asset_id uuid, asset_tag character varying, display_name character varying, serial_number character varying, mac_address macaddr, last_discovered_at timestamp with time zone, days_since_discovery integer)
 LANGUAGE plpgsql
AS $function$
BEGIN
    RETURN QUERY
    SELECT 
        a.asset_id,
        a.asset_tag,
        a.display_name,
        ha.serial_number,
        ha.mac_address,
        ha.last_discovered_at,
        EXTRACT(DAY FROM NOW() - ha.last_discovered_at)::INTEGER AS days_since_discovery
    FROM assets a
    JOIN hardware_assets ha ON a.asset_id = ha.asset_id
    WHERE a.asset_type = 'HARDWARE'
      AND a.status IN ('DEPLOYED', 'IN_STOCK')
      AND (
          ha.last_discovered_at IS NULL 
          OR ha.last_discovered_at < NOW() - (p_days_threshold || ' days')::INTERVAL
      )
    ORDER BY ha.last_discovered_at ASC NULLS FIRST;
END;
$function$
