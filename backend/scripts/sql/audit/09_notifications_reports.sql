WITH checks AS (
  SELECT
    (
      SELECT COUNT(*)
      FROM renewal_notifications rn
      JOIN saas_subscriptions ss ON ss.subscription_id = rn.subscription_id
      WHERE ss.vendor_portal_id = ('AUD-SUB-' || {{AUDIT_RUN_KEY}}::text)
        AND rn.notification_type = '30_DAY'
    ) AS notification_count,
    (
      SELECT COUNT(*)
      FROM pg_views
      WHERE schemaname = 'public'
        AND viewname IN (
          'v_asset_summary',
          'v_work_order_metrics',
          'v_stockroom_summary',
          'v_license_compliance'
        )
    ) AS required_view_count
)
SELECT
  'notification_and_report_readiness' AS check_name,
  (notification_count = 1 AND required_view_count = 4) AS check_pass,
  format('notifications=%s required_views=%s', notification_count, required_view_count) AS detail
FROM checks;
