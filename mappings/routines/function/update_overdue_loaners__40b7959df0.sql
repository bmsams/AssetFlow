-- Generated: 2026-02-22T16:36:45.840439+00:00
-- Database: assetmgmt
-- Schema: public
-- Kind: FUNCTION
-- Signature: update_overdue_loaners()

CREATE OR REPLACE FUNCTION public.update_overdue_loaners()
 RETURNS integer
 LANGUAGE plpgsql
AS $function$
DECLARE
    v_count INTEGER;
BEGIN
    UPDATE loaner_checkouts
    SET is_overdue = TRUE,
        status = 'OVERDUE',
        updated_at = NOW()
    WHERE status = 'CHECKED_OUT'
      AND due_date < CURRENT_DATE
      AND is_overdue = FALSE;
    
    GET DIAGNOSTICS v_count = ROW_COUNT;
    RETURN v_count;
END;
$function$
