-- Generated: 2026-02-22T16:36:45.840439+00:00
-- Database: assetmgmt
-- Schema: public
-- Kind: FUNCTION
-- Signature: update_spare_parts_reserved()

CREATE OR REPLACE FUNCTION public.update_spare_parts_reserved()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
    IF TG_OP = 'INSERT' OR TG_OP = 'UPDATE' THEN
        -- Update the spare parts reserved quantity
        UPDATE spare_parts
        SET quantity_reserved = (
            SELECT COALESCE(SUM(quantity_reserved), 0)
            FROM work_order_parts
            WHERE part_id = NEW.part_id
            AND reservation_status IN ('RESERVED', 'PARTIALLY_RESERVED')
        ),
        updated_at = NOW()
        WHERE part_id = NEW.part_id;
        RETURN NEW;
    ELSIF TG_OP = 'DELETE' THEN
        UPDATE spare_parts
        SET quantity_reserved = (
            SELECT COALESCE(SUM(quantity_reserved), 0)
            FROM work_order_parts
            WHERE part_id = OLD.part_id
            AND reservation_status IN ('RESERVED', 'PARTIALLY_RESERVED')
        ),
        updated_at = NOW()
        WHERE part_id = OLD.part_id;
        RETURN OLD;
    END IF;
    RETURN NULL;
END;
$function$
