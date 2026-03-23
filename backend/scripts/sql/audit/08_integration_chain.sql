WITH discovery AS (
  SELECT dr.discovery_record_id, dr.matched_asset_id, dr.status
  FROM discovery_records dr
  WHERE dr.source_type = 'SCCM'
    AND dr.source_id = ('AUD-DISC-' || {{AUDIT_RUN_KEY}}::text)
  LIMIT 1
),
counts AS (
  SELECT
    (SELECT COUNT(*) FROM discovery) AS discovery_count,
    (
      SELECT COUNT(*)
      FROM discovery d
      JOIN assets a ON a.asset_id = d.matched_asset_id
    ) AS matched_asset_count,
    (
      SELECT COUNT(*)
      FROM discovery
      WHERE status IN ('MATCHED', 'CREATED')
    ) AS valid_status_count
)
SELECT
  'integration_discovery_chain' AS check_name,
  (discovery_count = 1 AND matched_asset_count = 1 AND valid_status_count = 1) AS check_pass,
  format('discovery=%s matched_asset=%s valid_status=%s', discovery_count, matched_asset_count, valid_status_count) AS detail
FROM counts;
