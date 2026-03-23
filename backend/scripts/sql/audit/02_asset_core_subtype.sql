WITH target AS (
  SELECT dr.matched_asset_id AS asset_id
  FROM discovery_records dr
  WHERE dr.source_type = 'SCCM'
    AND dr.source_id = ('AUD-DISC-' || {{AUDIT_RUN_KEY}}::text)
  LIMIT 1
),
counts AS (
  SELECT
    (SELECT COUNT(*) FROM target t JOIN assets a ON a.asset_id = t.asset_id) AS asset_count,
    (SELECT COUNT(*) FROM target t JOIN hardware_assets ha ON ha.asset_id = t.asset_id) AS hardware_count
)
SELECT
  'asset_core_and_subtype' AS check_name,
  (asset_count = 1 AND hardware_count = 1) AS check_pass,
  format('asset=%s hardware_subtype=%s', asset_count, hardware_count) AS detail
FROM counts;
