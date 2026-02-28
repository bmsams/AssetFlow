-- Generated: 2026-02-22T16:36:45.840439+00:00
-- Database: assetmgmt
-- Schema: public
-- Kind: FUNCTION
-- Signature: uuid_generate_v1mc()

CREATE OR REPLACE FUNCTION public.uuid_generate_v1mc()
 RETURNS uuid
 LANGUAGE c
 PARALLEL SAFE STRICT
AS '$libdir/uuid-ossp', $function$uuid_generate_v1mc$function$
