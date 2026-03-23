WITH recon AS (
  SELECT
    rr.result_id,
    rr.software_product_id,
    rr.entitlements_owned,
    rr.installations_found
  FROM reconciliation_results rr
  WHERE rr.notes ILIKE ('%' || {{AUDIT_RUN_KEY}}::text || '%seeded reconciliation%')
  LIMIT 1
),
counts AS (
  SELECT
    (SELECT COUNT(*) FROM recon) AS recon_count,
    (
      SELECT COUNT(*)
      FROM recon
      JOIN software_products sp ON sp.product_id = recon.software_product_id
    ) AS product_link_count,
    (
      SELECT COUNT(*)
      FROM recon
      WHERE entitlements_owned >= installations_found
    ) AS license_balance_valid
)
SELECT
  'sam_reconciliation_chain' AS check_name,
  (recon_count = 1 AND product_link_count = 1 AND license_balance_valid = 1) AS check_pass,
  format('reconciliation=%s product_link=%s balance_valid=%s', recon_count, product_link_count, license_balance_valid) AS detail
FROM counts;
