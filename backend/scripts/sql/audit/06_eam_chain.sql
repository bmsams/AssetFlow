WITH wo AS (
  SELECT wo.work_order_id, wo.asset_id, wo.status
  FROM work_orders wo
  WHERE wo.work_order_number = ('AUDWO-' || {{AUDIT_RUN_KEY}}::text)
  LIMIT 1
),
counts AS (
  SELECT
    (SELECT COUNT(*) FROM wo) AS wo_count,
    (
      SELECT COUNT(*)
      FROM wo
      JOIN assets a ON a.asset_id = wo.asset_id
    ) AS linked_asset_count,
    (
      SELECT COUNT(*)
      FROM wo
      WHERE status IN ('ASSIGNED', 'IN_PROGRESS', 'COMPLETED')
    ) AS valid_status_count
)
SELECT
  'eam_work_order_chain' AS check_name,
  (wo_count = 1 AND linked_asset_count = 1 AND valid_status_count = 1) AS check_pass,
  format('work_orders=%s linked_assets=%s valid_status=%s', wo_count, linked_asset_count, valid_status_count) AS detail
FROM counts;
