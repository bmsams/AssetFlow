#!/usr/bin/env python3
"""
Scan all backend TypeScript service source files and map them to database objects.
Also maps frontend routes through page components → API services → backend services → DB tables.
Generates an interactive HTML report showing full-stack traceability.
"""
import os
import re
import json
from collections import defaultdict
from pathlib import Path

# ── Known database objects (from live DB extraction) ──
DB_TABLES = {
    'approval_delegations', 'approval_records', 'approval_thresholds',
    'asset_relationships', 'assets', 'audit_log', 'audit_records', 'audit_scans',
    'bin_locations', 'buildings', 'contracts', 'cost_centers', 'departments',
    'depreciation_schedules', 'discovery_records', 'discovery_source_configs',
    'enterprise_assets', 'entitlements', 'facilities', 'floors',
    'hardware_assets', 'inspection_records', 'lease_payments',
    'linear_asset_segments', 'linear_assets', 'loaner_checkouts',
    'maintenance_plans', 'manufacturers', 'models', 'permissions',
    'po_lines', 'purchase_order_lines', 'purchase_orders', 'racks',
    'receiving_lines', 'receiving_records', 'reclamation_candidates',
    'reclamation_rules', 'reconciliation_results', 'role_permissions',
    'roles', 'rooms', 'saas_subscriptions', 'software_assets',
    'software_installations', 'software_products', 'spare_parts',
    'stockroom_inventory', 'stockroom_rules', 'stockrooms',
    'transfer_order_lines', 'transfer_orders', 'user_roles', 'users',
    'vendor_model_prices', 'vendors', 'work_order_parts', 'work_orders',
}

DB_VIEWS = {
    'v_active_contracts', 'v_active_transfers', 'v_asset_depreciation_summary',
    'v_asset_relationships', 'v_asset_summary', 'v_audit_discrepancies',
    'v_calibration_due', 'v_contract_value_by_vendor', 'v_contracts_expiring',
    'v_cost_center_budget', 'v_discovery_asset_mapping', 'v_discovery_summary',
    'v_discovery_unmatched', 'v_enterprise_assets',
    'v_enterprise_summary_by_facility', 'v_entitlements',
    'v_entitlements_expiring', 'v_hardware_assets',
    'v_hardware_summary_by_category', 'v_lease_expiring',
    'v_lease_payment_schedule', 'v_license_compliance', 'v_linear_assets',
    'v_maintenance_due', 'v_open_work_orders', 'v_overdue_lease_payments',
    'v_overdue_loaners', 'v_parts_reorder_needed',
    'v_pending_purchase_orders', 'v_pending_receiving',
    'v_purchase_order_summary', 'v_reclamation_candidates',
    'v_relationship_summary', 'v_saas_utilization',
    'v_software_installations', 'v_software_products',
    'v_stockroom_summary', 'v_unauthorized_software',
    'v_upcoming_lease_payments', 'v_user_permissions',
    'v_warranty_expiring', 'v_work_order_metrics',
    'v_work_order_parts_summary',
}

DB_FUNCTIONS = [
    'audit_asset_changes', 'audit_contract_changes', 'audit_enterprise_asset_changes',
    'audit_entitlement_changes', 'audit_hardware_asset_changes',
    'audit_lease_payment_changes', 'audit_loaner_checkout_changes',
    'audit_maintenance_plan_changes', 'audit_purchase_order_changes',
    'audit_reclamation_candidate_changes', 'audit_relationship_changes',
    'audit_software_installation_changes', 'audit_software_product_changes',
    'audit_transfer_order_changes', 'audit_work_order_changes',
    'audit_audit_record_changes', 'get_asset_ancestors', 'get_asset_descendants',
    'log_bin_location_changes', 'log_building_changes', 'log_floor_changes',
    'log_manufacturer_changes', 'log_rack_changes', 'log_room_changes',
    'update_updated_at_column', 'update_parent_asset_timestamp',
    'update_linear_asset_segment_count', 'update_spare_parts_reserved',
    'would_create_cycle', 'update_discovery_record_timestamp',
    'trg_manufacturers_set_defaults', 'trg_models_set_defaults',
    'update_inspection_records_updated_at', 'update_po_lines_updated_at',
    'update_purchase_orders_updated_at',
]

# ── Domain grouping for tables ──
TABLE_DOMAINS = {
    'Core': ['assets', 'asset_relationships', 'audit_log'],
    'HAM': ['hardware_assets', 'stockrooms', 'stockroom_inventory', 'stockroom_rules',
            'bin_locations', 'racks', 'loaner_checkouts', 'audit_records', 'audit_scans'],
    'SAM': ['software_assets', 'software_products', 'software_installations',
            'entitlements', 'saas_subscriptions', 'reclamation_rules',
            'reclamation_candidates', 'reconciliation_results'],
    'EAM': ['enterprise_assets', 'maintenance_plans', 'work_orders',
            'work_order_parts', 'spare_parts', 'linear_assets',
            'linear_asset_segments', 'inspection_records'],
    'Procurement': ['purchase_orders', 'purchase_order_lines', 'po_lines',
                    'receiving_records', 'receiving_lines', 'transfer_orders',
                    'transfer_order_lines', 'approval_records',
                    'approval_thresholds', 'approval_delegations'],
    'Financial': ['contracts', 'depreciation_schedules', 'lease_payments',
                  'cost_centers', 'vendor_model_prices'],
    'Location': ['buildings', 'floors', 'rooms', 'facilities'],
    'Organization': ['users', 'roles', 'permissions', 'role_permissions',
                     'user_roles', 'departments', 'manufacturers', 'models', 'vendors'],
    'Discovery': ['discovery_records', 'discovery_source_configs'],
}

def get_table_domain(table):
    for domain, tables in TABLE_DOMAINS.items():
        if table in tables:
            return domain
    return 'Unknown'

# ── Scan functions ──
def find_table_refs(content, filename):
    """Find database table/view references in TypeScript source."""
    tables_found = set()
    views_found = set()
    operations = set()

    sql_patterns = [
        r'FROM\s+([a-z_]+)', r'JOIN\s+([a-z_]+)', r'INTO\s+([a-z_]+)',
        r'UPDATE\s+([a-z_]+)', r'DELETE\s+FROM\s+([a-z_]+)',
    ]
    for pat in sql_patterns:
        for m in re.finditer(pat, content, re.IGNORECASE):
            name = m.group(1).lower()
            if name in DB_TABLES:
                tables_found.add(name)
            elif name in DB_VIEWS:
                views_found.add(name)

    for quote in ["'", '"', '`']:
        for m in re.finditer(rf'{quote}([a-z_]+){quote}', content):
            name = m.group(1)
            if name in DB_TABLES:
                tables_found.add(name)
            elif name in DB_VIEWS:
                views_found.add(name)

    if re.search(r'\bSELECT\b', content, re.IGNORECASE): operations.add('SELECT')
    if re.search(r'\bINSERT\b', content, re.IGNORECASE): operations.add('INSERT')
    if re.search(r'\bUPDATE\b', content, re.IGNORECASE): operations.add('UPDATE')
    if re.search(r'\bDELETE\b', content, re.IGNORECASE): operations.add('DELETE')

    return tables_found, views_found, operations

def scan_service(service_path):
    """Scan all .ts files in a service directory."""
    results = {'files': [], 'all_tables': set(), 'all_views': set(), 'all_operations': set()}
    src_path = os.path.join(service_path, 'src')
    if not os.path.exists(src_path):
        return results
    for root, dirs, files in os.walk(src_path):
        dirs[:] = [d for d in dirs if d not in ('__tests__', 'dist', 'node_modules')]
        for f in files:
            if not f.endswith('.ts'): continue
            filepath = os.path.join(root, f)
            try:
                with open(filepath, 'r', encoding='utf-8', errors='ignore') as fh:
                    content = fh.read()
            except Exception: continue
            tables, views, ops = find_table_refs(content, f)
            rel_path = os.path.relpath(filepath, service_path).replace('\\', '/')
            if tables or views:
                results['files'].append({'file': rel_path, 'tables': sorted(tables), 'views': sorted(views), 'operations': sorted(ops)})
                results['all_tables'].update(tables)
                results['all_views'].update(views)
                results['all_operations'].update(ops)
    return results

# ── Main scanning logic ──
BACKEND_BASE = 'backend/packages'
SERVICES_BASE = os.path.join(BACKEND_BASE, 'services')

services = {}
for svc_name in sorted(os.listdir(SERVICES_BASE)):
    svc_path = os.path.join(SERVICES_BASE, svc_name)
    if os.path.isdir(svc_path):
        services[svc_name] = scan_service(svc_path)

shared_packages = {}
for pkg_name in ['database', 'cache', 'events', 'search', 'types', 'seed-data', 'validation', 'utils', 'auth', 'pagination']:
    pkg_path = os.path.join(BACKEND_BASE, pkg_name)
    if os.path.isdir(pkg_path):
        shared_packages[pkg_name] = scan_service(pkg_path)

# ── Build cross-reference matrices ──
table_to_services = defaultdict(set)
for svc, data in services.items():
    for t in data['all_tables']: table_to_services[t].add(svc)
for pkg, data in shared_packages.items():
    for t in data['all_tables']: table_to_services[t].add(f'@ams/{pkg}')

view_to_services = defaultdict(set)
for svc, data in services.items():
    for v in data['all_views']: view_to_services[v].add(svc)

all_referenced_tables = set()
for data in services.values(): all_referenced_tables.update(data['all_tables'])
for data in shared_packages.values(): all_referenced_tables.update(data['all_tables'])
orphan_tables = DB_TABLES - all_referenced_tables

all_referenced_views = set()
for data in services.values(): all_referenced_views.update(data['all_views'])
orphan_views = DB_VIEWS - all_referenced_views

# ── Service descriptions ──
SVC_DESCRIPTIONS = {
    'admin-service': 'Administrative operations: users, roles, departments, manufacturers, models, vendors, cost centers, locations',
    'asset-service': 'Core asset CRUD, lifecycle state machine, asset relationships (CMDB), audit log',
    'eam-service': 'Enterprise Asset Management: facilities, maintenance, work orders, spare parts, linear assets',
    'ham-service': 'Hardware Asset Management: stockrooms, transfers, loaners, audits, racks',
    'integration-service': 'ERP integration (SAP/Oracle/Workday), discovery (SCCM/Jamf/Tanium), vendor ASN',
    'lifecycle-service': 'Service catalog, procurement lifecycle, deployment, retirement',
    'notification-service': 'Notification preferences, triggers, escalation, batching',
    'procurement-service': 'Purchase orders, receiving, approvals, PO line management',
    'report-service': 'Reporting & analytics: asset, financial, operational, custom reports, dashboards',
    'sam-service': 'Software Asset Management: licenses, installations, reclamation, reconciliation, shadow IT, SaaS',
}

DOMAIN_COLORS = {
    'Core': '#3498db', 'HAM': '#e67e22', 'SAM': '#9b59b6', 'EAM': '#27ae60',
    'Procurement': '#e74c3c', 'Financial': '#f39c12', 'Location': '#1abc9c',
    'Organization': '#34495e', 'Discovery': '#8e44ad', 'Unknown': '#95a5a6',
}

SVC_COLORS = {
    'admin-service': '#34495e', 'asset-service': '#3498db', 'eam-service': '#27ae60',
    'ham-service': '#e67e22', 'integration-service': '#8e44ad', 'lifecycle-service': '#16a085',
    'notification-service': '#7f8c8d', 'procurement-service': '#e74c3c',
    'report-service': '#f39c12', 'sam-service': '#9b59b6',
}

print(f"Scanned {len(services)} services, {len(shared_packages)} shared packages")
print(f"Tables referenced: {len(all_referenced_tables)}/{len(DB_TABLES)}")
print(f"Views referenced: {len(all_referenced_views)}/{len(DB_VIEWS)}")
print(f"Orphan tables: {len(orphan_tables)}")
print(f"Orphan views: {len(orphan_views)}")

# ══════════════════════════════════════════════════════════════════
# FRONTEND ROUTE MAPPING
# ══════════════════════════════════════════════════════════════════

# API service file → which API endpoints it calls → which backend service handles them
# Derived from reading all frontend/src/services/*-api.ts files

API_SERVICE_TO_BACKEND = {
    'admin-api': {
        'backend_services': ['admin-service'],
        'api_prefixes': ['/admin/'],
        'description': 'Buildings, floors, rooms, racks, stockrooms, departments, cost centers, vendors, manufacturers, models, users',
    },
    'asset-api': {
        'backend_services': ['asset-service'],
        'api_prefixes': ['/assets'],
        'description': 'Asset CRUD, state transitions, relationships, audit history, search',
    },
    'catalog-api': {
        'backend_services': ['lifecycle-service'],
        'api_prefixes': ['/lifecycle/catalog/'],
        'description': 'Service catalog items, search',
    },
    'contracts-api': {
        'backend_services': ['lifecycle-service'],
        'api_prefixes': ['/lifecycle/contracts'],
        'description': 'Contract CRUD operations',
    },
    'dashboard-api': {
        'backend_services': ['report-service', 'asset-service'],
        'api_prefixes': ['/dashboard/'],
        'description': 'Dashboard summary, lease expirations, compliance indicators',
    },
    'lifecycle-api': {
        'backend_services': ['lifecycle-service'],
        'api_prefixes': ['/lifecycle/'],
        'description': 'Deploy, retire, dispose assets',
    },
    'procurement-api': {
        'backend_services': ['procurement-service'],
        'api_prefixes': ['/procurement/'],
        'description': 'Purchase orders, approval workflows, PO lines',
    },
    'receiving-api': {
        'backend_services': ['lifecycle-service'],
        'api_prefixes': ['/lifecycle/receiving/', '/lifecycle/inspection/'],
        'description': 'Receiving from PO, asset scanning, inspections',
    },
    'report-api': {
        'backend_services': ['report-service'],
        'api_prefixes': ['/reports/'],
        'description': 'All report types: asset, financial, operational + export',
    },
    'sam-api': {
        'backend_services': ['sam-service'],
        'api_prefixes': ['/reconciliation/', '/reclamation/', '/sam/'],
        'description': 'Compliance positions, reclamation, reconciliation, license workbench',
    },
    'stockroom-api': {
        'backend_services': ['ham-service'],
        'api_prefixes': ['/ham/stockrooms/'],
        'description': 'Stockroom inventory retrieval and updates',
    },
}

# Page component → which API services it imports (derived from grep of imports)
PAGE_TO_API_SERVICES = {
    'DashboardPage': ['dashboard-api'],
    'AssetsPage': ['asset-api'],
    'AssetCreatePage': ['asset-api'],
    'AssetDetailPageWrapper': ['asset-api'],
    'AssetEditPage': ['asset-api'],
    'HardwareAssetsPage': ['asset-api'],
    'SoftwareAssetsPage': ['asset-api'],
    'EnterpriseAssetsPage': ['asset-api'],
    'AssetLifecyclePage': ['asset-api'],
    'StockroomPage': ['admin-api'],
    'ProcurementPage': ['procurement-api'],
    'LicenseWorkbenchPage': ['sam-api'],
    'ServiceCatalogPage': ['catalog-api'],
    'ContractsPage': ['contracts-api'],
    'ReportsPage': [],
    'AssetSummaryReport': ['report-api'],
    'AssetAgingReport': ['report-api'],
    'AssetByLocationReport': ['report-api'],
    'AssetByDepartmentReport': ['report-api'],
    'CostCenterUtilizationReport': ['report-api'],
    'ProcurementSpendingReport': ['report-api'],
    'WorkOrderSummaryReport': ['report-api'],
    'MaintenanceComplianceReport': ['report-api'],
    'SettingsPage': [],
    'LocationsPage': ['admin-api'],
    'StoragePage': ['admin-api'],
    'DepartmentsPage': ['admin-api'],
    'DepartmentForm': ['admin-api'],
    'CostCentersPage': ['admin-api'],
    'CostCenterForm': ['admin-api'],
    'VendorsPage': ['admin-api'],
    'VendorForm': ['admin-api'],
    'ManufacturersPage': ['admin-api'],
    'ManufacturerForm': ['admin-api'],
    'ModelsPage': ['admin-api'],
    'ModelForm': ['admin-api'],
    'UsersPage': ['admin-api'],
    'UserEditPage': ['admin-api'],
    'PurchaseOrdersPage': ['procurement-api'],
    'PurchaseOrderForm': ['procurement-api', 'admin-api'],
    'PurchaseOrderDetailPage': ['procurement-api'],
    'ReceivingForm': ['procurement-api', 'receiving-api'],
    'InspectionForm': ['receiving-api'],
    'LoginPage': [],
    'NotFoundPage': [],
}

# Route definitions (from routes.tsx)
FRONTEND_ROUTES = [
    {'path': '/', 'component': 'DashboardPage', 'roles': ['viewer', 'admin', 'asset_manager'], 'group': 'Overview'},
    {'path': '/login', 'component': 'LoginPage', 'roles': [], 'group': 'Auth'},
    {'path': '/assets', 'component': 'AssetsPage', 'roles': ['viewer', 'admin', 'asset_manager'], 'group': 'Asset Management'},
    {'path': '/assets/new', 'component': 'AssetCreatePage', 'roles': ['admin', 'asset_manager'], 'group': 'Asset Management'},
    {'path': '/assets/:assetId', 'component': 'AssetDetailPageWrapper', 'roles': ['viewer', 'admin', 'asset_manager'], 'group': 'Asset Management'},
    {'path': '/assets/:assetId/edit', 'component': 'AssetEditPage', 'roles': ['admin', 'asset_manager'], 'group': 'Asset Management'},
    {'path': '/assets/hardware', 'component': 'HardwareAssetsPage', 'roles': ['viewer', 'admin', 'asset_manager'], 'group': 'Asset Management'},
    {'path': '/assets/software', 'component': 'SoftwareAssetsPage', 'roles': ['viewer', 'admin', 'asset_manager', 'license_analyst'], 'group': 'Asset Management'},
    {'path': '/assets/enterprise', 'component': 'EnterpriseAssetsPage', 'roles': ['viewer', 'admin', 'asset_manager', 'facilities_manager'], 'group': 'Asset Management'},
    {'path': '/assets/:assetId/lifecycle', 'component': 'AssetLifecyclePage', 'roles': ['asset_manager', 'admin'], 'group': 'Asset Management'},
    {'path': '/stockrooms', 'component': 'StockroomPage', 'roles': ['viewer', 'admin', 'inventory_manager', 'asset_manager'], 'group': 'Inventory'},
    {'path': '/procurement', 'component': 'ProcurementPage', 'roles': ['procurement_manager', 'admin'], 'group': 'Procurement'},
    {'path': '/licenses', 'component': 'LicenseWorkbenchPage', 'roles': ['viewer', 'admin', 'license_analyst'], 'group': 'Inventory'},
    {'path': '/service-catalog', 'component': 'ServiceCatalogPage', 'roles': ['viewer', 'admin', 'asset_manager'], 'group': 'Inventory'},
    {'path': '/contracts', 'component': 'ContractsPage', 'roles': ['auditor', 'procurement_manager', 'admin'], 'group': 'Inventory'},
    {'path': '/reports', 'component': 'ReportsPage', 'roles': ['auditor', 'viewer', 'admin'], 'group': 'Analytics'},
    {'path': '/reports/asset-summary', 'component': 'AssetSummaryReport', 'roles': ['auditor', 'viewer', 'admin'], 'group': 'Analytics'},
    {'path': '/reports/asset-aging', 'component': 'AssetAgingReport', 'roles': ['auditor', 'viewer', 'admin'], 'group': 'Analytics'},
    {'path': '/reports/assets-by-location', 'component': 'AssetByLocationReport', 'roles': ['auditor', 'viewer', 'admin'], 'group': 'Analytics'},
    {'path': '/reports/assets-by-department', 'component': 'AssetByDepartmentReport', 'roles': ['auditor', 'viewer', 'admin'], 'group': 'Analytics'},
    {'path': '/reports/cost-center-utilization', 'component': 'CostCenterUtilizationReport', 'roles': ['auditor', 'admin'], 'group': 'Analytics'},
    {'path': '/reports/procurement-spending', 'component': 'ProcurementSpendingReport', 'roles': ['auditor', 'procurement_manager', 'admin'], 'group': 'Analytics'},
    {'path': '/reports/work-order-summary', 'component': 'WorkOrderSummaryReport', 'roles': ['auditor', 'facilities_manager', 'admin'], 'group': 'Analytics'},
    {'path': '/reports/maintenance-compliance', 'component': 'MaintenanceComplianceReport', 'roles': ['auditor', 'facilities_manager', 'admin'], 'group': 'Analytics'},
    {'path': '/settings', 'component': 'SettingsPage', 'roles': ['admin'], 'group': 'Administration'},
    {'path': '/admin/locations', 'component': 'LocationsPage', 'roles': ['admin'], 'group': 'Administration'},
    {'path': '/admin/storage', 'component': 'StoragePage', 'roles': ['admin'], 'group': 'Administration'},
    {'path': '/admin/departments', 'component': 'DepartmentsPage', 'roles': ['admin'], 'group': 'Administration'},
    {'path': '/admin/departments/new', 'component': 'DepartmentForm', 'roles': ['admin'], 'group': 'Administration'},
    {'path': '/admin/departments/:departmentId', 'component': 'DepartmentForm', 'roles': ['admin'], 'group': 'Administration'},
    {'path': '/admin/cost-centers', 'component': 'CostCentersPage', 'roles': ['admin'], 'group': 'Administration'},
    {'path': '/admin/cost-centers/new', 'component': 'CostCenterForm', 'roles': ['admin'], 'group': 'Administration'},
    {'path': '/admin/cost-centers/:costCenterId', 'component': 'CostCenterForm', 'roles': ['admin'], 'group': 'Administration'},
    {'path': '/admin/cost-centers/:costCenterId/edit', 'component': 'CostCenterForm', 'roles': ['admin'], 'group': 'Administration'},
    {'path': '/admin/vendors', 'component': 'VendorsPage', 'roles': ['admin', 'procurement_manager'], 'group': 'Administration'},
    {'path': '/admin/vendors/new', 'component': 'VendorForm', 'roles': ['admin', 'procurement_manager'], 'group': 'Administration'},
    {'path': '/admin/vendors/:vendorId', 'component': 'VendorForm', 'roles': ['admin', 'procurement_manager'], 'group': 'Administration'},
    {'path': '/admin/manufacturers', 'component': 'ManufacturersPage', 'roles': ['admin'], 'group': 'Administration'},
    {'path': '/admin/manufacturers/new', 'component': 'ManufacturerForm', 'roles': ['admin'], 'group': 'Administration'},
    {'path': '/admin/manufacturers/:manufacturerId', 'component': 'ManufacturerForm', 'roles': ['admin'], 'group': 'Administration'},
    {'path': '/admin/products', 'component': 'ModelsPage', 'roles': ['admin'], 'group': 'Administration'},
    {'path': '/admin/products/new', 'component': 'ModelForm', 'roles': ['admin'], 'group': 'Administration'},
    {'path': '/admin/products/:modelId', 'component': 'ModelForm', 'roles': ['admin'], 'group': 'Administration'},
    {'path': '/admin/users', 'component': 'UsersPage', 'roles': ['admin'], 'group': 'Administration'},
    {'path': '/admin/users/:userId/edit', 'component': 'UserEditPage', 'roles': ['admin'], 'group': 'Administration'},
    {'path': '/procurement/purchase-orders', 'component': 'PurchaseOrdersPage', 'roles': ['procurement_manager', 'admin'], 'group': 'Procurement'},
    {'path': '/procurement/purchase-orders/new', 'component': 'PurchaseOrderForm', 'roles': ['procurement_manager', 'admin'], 'group': 'Procurement'},
    {'path': '/procurement/purchase-orders/:poId', 'component': 'PurchaseOrderDetailPage', 'roles': ['procurement_manager', 'admin'], 'group': 'Procurement'},
    {'path': '/procurement/purchase-orders/:poId/edit', 'component': 'PurchaseOrderForm', 'roles': ['procurement_manager', 'admin'], 'group': 'Procurement'},
    {'path': '/procurement/receiving', 'component': 'ReceivingForm', 'roles': ['procurement_manager', 'inventory_manager', 'admin'], 'group': 'Procurement'},
    {'path': '/procurement/inspections/:inspectionId', 'component': 'InspectionForm', 'roles': ['procurement_manager', 'inventory_manager', 'admin'], 'group': 'Procurement'},
]

# Enrich each route with the full chain
for route in FRONTEND_ROUTES:
    comp = route['component']
    api_svcs = PAGE_TO_API_SERVICES.get(comp, [])
    route['api_services'] = api_svcs

    backend_svcs = set()
    for api_svc in api_svcs:
        info = API_SERVICE_TO_BACKEND.get(api_svc, {})
        for bs in info.get('backend_services', []):
            backend_svcs.add(bs)
    route['backend_services'] = sorted(backend_svcs)

    db_tables = set()
    for bs in route['backend_services']:
        if bs in services:
            db_tables.update(services[bs]['all_tables'])
    route['db_tables'] = sorted(db_tables)

# Group colors for route groups
ROUTE_GROUP_COLORS = {
    'Overview': '#3498db', 'Auth': '#7f8c8d', 'Asset Management': '#2ecc71',
    'Inventory': '#e67e22', 'Procurement': '#e74c3c', 'Analytics': '#f39c12',
    'Administration': '#34495e',
}

print(f"\nFrontend routes mapped: {len(FRONTEND_ROUTES)}")
print(f"Routes with DB traceability: {sum(1 for r in FRONTEND_ROUTES if r['db_tables'])}")


# ══════════════════════════════════════════════════════════════════
# Generate Interactive HTML Report
# ══════════════════════════════════════════════════════════════════

html_parts = []
html_parts.append('''<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>AMS Full-Stack Traceability Report</title>
<style>
  :root { --bg: #0d1117; --surface: #161b22; --border: #30363d; --text: #c9d1d9; --text-muted: #8b949e; --accent: #58a6ff; --green: #3fb950; --red: #f85149; --orange: #d29922; --purple: #bc8cff; }
  * { margin: 0; padding: 0; box-sizing: border-box; }
  body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Helvetica, Arial, sans-serif; background: var(--bg); color: var(--text); line-height: 1.6; }
  .container { max-width: 1400px; margin: 0 auto; padding: 24px; }
  h1 { font-size: 28px; margin-bottom: 8px; color: #fff; }
  h2 { font-size: 22px; margin: 32px 0 16px; color: #fff; border-bottom: 1px solid var(--border); padding-bottom: 8px; }
  h3 { font-size: 18px; margin: 24px 0 12px; color: var(--accent); }
  .subtitle { color: var(--text-muted); margin-bottom: 24px; }
  .stats { display: grid; grid-template-columns: repeat(auto-fit, minmax(160px, 1fr)); gap: 16px; margin: 24px 0; }
  .stat-card { background: var(--surface); border: 1px solid var(--border); border-radius: 8px; padding: 16px; text-align: center; }
  .stat-value { font-size: 32px; font-weight: 700; color: var(--accent); }
  .stat-label { font-size: 13px; color: var(--text-muted); margin-top: 4px; }
  .badge { display: inline-block; padding: 2px 8px; border-radius: 12px; font-size: 12px; font-weight: 600; margin: 2px; }
  .badge-table { background: #1f3a5f; color: #58a6ff; }
  .badge-view { background: #2d1f3f; color: #bc8cff; }
  .badge-orphan { background: #3d1f1f; color: #f85149; }
  .badge-op { background: #1f3f2d; color: #3fb950; }
  .badge-domain { padding: 2px 10px; font-size: 11px; }
  .badge-role { background: #1f2d3f; color: #79c0ff; font-size: 11px; }
  .badge-api { background: #2d3f1f; color: #7ee787; font-size: 11px; }
  .badge-route-group { padding: 3px 10px; font-size: 11px; font-weight: 700; border-radius: 4px; }
  table { width: 100%; border-collapse: collapse; margin: 16px 0; }
  th, td { padding: 10px 14px; text-align: left; border-bottom: 1px solid var(--border); font-size: 14px; }
  th { background: var(--surface); color: var(--text-muted); font-weight: 600; position: sticky; top: 0; z-index: 1; }
  tr:hover { background: rgba(88,166,255,0.04); }
  .svc-card { background: var(--surface); border: 1px solid var(--border); border-radius: 8px; margin: 16px 0; overflow: hidden; }
  .svc-header { padding: 16px 20px; cursor: pointer; display: flex; justify-content: space-between; align-items: center; }
  .svc-header:hover { background: rgba(88,166,255,0.06); }
  .svc-body { padding: 0 20px 20px; display: none; }
  .svc-body.open { display: block; }
  .svc-name { font-size: 18px; font-weight: 700; }
  .svc-desc { font-size: 13px; color: var(--text-muted); margin-top: 4px; }
  .svc-stats { display: flex; gap: 16px; font-size: 13px; color: var(--text-muted); }
  .svc-stats span { display: flex; align-items: center; gap: 4px; }
  .dot { width: 8px; height: 8px; border-radius: 50%; display: inline-block; }
  .file-path { font-family: 'SFMono-Regular', Consolas, monospace; color: var(--text-muted); }
  .route-path { font-family: 'SFMono-Regular', Consolas, monospace; color: var(--accent); font-weight: 600; }
  .matrix-cell { text-align: center !important; font-size: 18px; padding: 6px !important; min-width: 36px; }
  .matrix-cell.active { color: var(--green); }
  .matrix-cell.inactive { color: var(--border); }
  .matrix-header { font-size: 12px; writing-mode: vertical-rl; text-orientation: mixed; transform: rotate(180deg); max-width: 36px; padding: 8px 4px !important; }
  .tab-container { display: flex; gap: 0; margin: 24px 0 0; border-bottom: 2px solid var(--border); flex-wrap: wrap; }
  .tab { padding: 10px 20px; cursor: pointer; color: var(--text-muted); font-size: 14px; font-weight: 600; border-bottom: 2px solid transparent; margin-bottom: -2px; transition: all 0.15s; }
  .tab:hover { color: var(--text); }
  .tab.active { color: var(--accent); border-bottom-color: var(--accent); }
  .tab-content { display: none; }
  .tab-content.active { display: block; }
  .warning { background: #3d2f1f; border: 1px solid #d29922; border-radius: 8px; padding: 12px 16px; margin: 16px 0; color: #d29922; font-size: 14px; }
  .success { background: #1f3d2f; border: 1px solid #3fb950; border-radius: 8px; padding: 12px 16px; margin: 16px 0; color: #3fb950; font-size: 14px; }
  .arrow { transition: transform 0.2s; display: inline-block; }
  .arrow.open { transform: rotate(90deg); }
  .chain-arrow { color: var(--text-muted); margin: 0 6px; font-size: 16px; }
  .chain-box { display: inline-flex; align-items: center; gap: 4px; padding: 3px 8px; border-radius: 6px; font-size: 12px; font-weight: 600; }
  .chain-route { background: #1a3a5c; color: #58a6ff; }
  .chain-page { background: #1a3c2a; color: #3fb950; }
  .chain-api { background: #3c2a1a; color: #d29922; }
  .chain-backend { background: #2a1a3c; color: #bc8cff; }
  .chain-db { background: #3c1a1a; color: #f85149; }
  .group-header { background: var(--surface); padding: 12px 16px; margin: 24px 0 8px; border-radius: 8px; border-left: 4px solid var(--accent); font-size: 16px; font-weight: 700; }
  .filter-bar { display: flex; gap: 8px; margin: 16px 0; flex-wrap: wrap; }
  .filter-btn { padding: 6px 14px; border-radius: 20px; border: 1px solid var(--border); background: transparent; color: var(--text-muted); cursor: pointer; font-size: 13px; transition: all 0.15s; }
  .filter-btn:hover { border-color: var(--accent); color: var(--text); }
  .filter-btn.active { background: var(--accent); color: #fff; border-color: var(--accent); }
  .search-box { padding: 8px 14px; border-radius: 8px; border: 1px solid var(--border); background: var(--surface); color: var(--text); font-size: 14px; width: 300px; }
  .search-box:focus { outline: none; border-color: var(--accent); }
  .no-data { color: var(--text-muted); font-style: italic; font-size: 13px; }
  .table-count { font-size: 12px; color: var(--text-muted); font-weight: normal; }
  td code { background: rgba(88,166,255,0.1); padding: 1px 6px; border-radius: 4px; font-size: 13px; }
</style>
</head>
<body>
<div class="container">
''')

# ── Header ──
routes_with_db = sum(1 for r in FRONTEND_ROUTES if r['db_tables'])
html_parts.append(f'''
<h1>🗄️ AMS Full-Stack Traceability Report</h1>
<p class="subtitle">Frontend Routes → Page Components → API Services → Backend Services → Database Tables<br>
Generated from Aurora PostgreSQL <code>assetmgmt</code>, backend TypeScript, and React frontend source code</p>

<div class="stats">
  <div class="stat-card"><div class="stat-value">{len(FRONTEND_ROUTES)}</div><div class="stat-label">Frontend Routes</div></div>
  <div class="stat-card"><div class="stat-value">{len(services)}</div><div class="stat-label">Backend Services</div></div>
  <div class="stat-card"><div class="stat-value">{len(DB_TABLES)}</div><div class="stat-label">Database Tables</div></div>
  <div class="stat-card"><div class="stat-value">{len(DB_VIEWS)}</div><div class="stat-label">Database Views</div></div>
  <div class="stat-card"><div class="stat-value">{len(all_referenced_tables)}</div><div class="stat-label">Tables Referenced</div></div>
  <div class="stat-card"><div class="stat-value">{len(orphan_tables)}</div><div class="stat-label">Orphan Tables</div></div>
  <div class="stat-card"><div class="stat-value">{len(orphan_views)}</div><div class="stat-label">Orphan Views</div></div>
  <div class="stat-card"><div class="stat-value">{routes_with_db}</div><div class="stat-label">Routes → DB</div></div>
</div>
''')

# ── Tabs ──
html_parts.append('''
<div class="tab-container">
  <div class="tab active" onclick="switchTab('routes')">🗺️ Frontend Routes</div>
  <div class="tab" onclick="switchTab('services')">⚙️ Services</div>
  <div class="tab" onclick="switchTab('matrix')">📊 Cross-Reference</div>
  <div class="tab" onclick="switchTab('tables')">📋 Table Ownership</div>
  <div class="tab" onclick="switchTab('orphans')">⚠️ Orphan Analysis</div>
  <div class="tab" onclick="switchTab('views')">👁️ View Usage</div>
</div>
''')

# ══════════════════════════════════════════════════════════════════
# Tab 1: Frontend Routes (NEW)
# ══════════════════════════════════════════════════════════════════
html_parts.append('<div id="tab-routes" class="tab-content active">')
html_parts.append('<h2>Frontend Route → Database Traceability</h2>')
html_parts.append('<p class="subtitle">Full chain: Route Path → Page Component → API Service → Backend Service → Database Tables</p>')

# Search bar
html_parts.append('''
<div class="filter-bar">
  <input type="text" class="search-box" id="routeSearch" placeholder="Search routes, components, tables..." oninput="filterRoutes()">
</div>
''')

# Group filter buttons
groups = sorted(set(r['group'] for r in FRONTEND_ROUTES))
html_parts.append('<div class="filter-bar" id="routeGroupFilters">')
html_parts.append('<button class="filter-btn active" onclick="filterRouteGroup(this, \'all\')">All</button>')
for g in groups:
    gc = ROUTE_GROUP_COLORS.get(g, '#58a6ff')
    html_parts.append(f'<button class="filter-btn" onclick="filterRouteGroup(this, \'{g}\')" style="border-color:{gc}40">{g}</button>')
html_parts.append('</div>')

# Routes table
html_parts.append('<table id="routesTable">')
html_parts.append('<tr><th>Route Path</th><th>Component</th><th>API Services</th><th>Backend Services</th><th>DB Tables</th><th>Roles</th></tr>')

current_group = None
for route in FRONTEND_ROUTES:
    if route['component'] in ('LoginPage', 'NotFoundPage'):
        continue

    group = route['group']
    gc = ROUTE_GROUP_COLORS.get(group, '#58a6ff')

    # API services badges
    api_html = ''
    if route['api_services']:
        api_html = ' '.join(f'<span class="badge badge-api">{a}</span>' for a in route['api_services'])
    else:
        api_html = '<span class="no-data">—</span>'

    # Backend services badges
    backend_html = ''
    if route['backend_services']:
        backend_html = ' '.join(
            f'<span class="badge" style="background:{SVC_COLORS.get(bs,"#58a6ff")}33;color:{SVC_COLORS.get(bs,"#58a6ff")}">{bs.replace("-service","")}</span>'
            for bs in route['backend_services']
        )
    else:
        backend_html = '<span class="no-data">—</span>'

    # DB tables badges (show count + expandable)
    tables_html = ''
    if route['db_tables']:
        n = len(route['db_tables'])
        # Show first 5 + count
        shown = route['db_tables'][:5]
        tables_html = ' '.join(f'<span class="badge badge-table">{t}</span>' for t in shown)
        if n > 5:
            tables_html += f' <span class="table-count">+{n-5} more</span>'
    else:
        tables_html = '<span class="no-data">—</span>'

    # Roles badges
    roles_html = ' '.join(f'<span class="badge badge-role">{r}</span>' for r in route['roles']) if route['roles'] else '<span class="no-data">public</span>'

    # Data attributes for filtering
    search_text = f"{route['path']} {route['component']} {' '.join(route['api_services'])} {' '.join(route['backend_services'])} {' '.join(route['db_tables'])} {' '.join(route['roles'])}".lower()

    html_parts.append(f'<tr class="route-row" data-group="{group}" data-search="{search_text}">')
    html_parts.append(f'<td><span class="route-path">{route["path"]}</span><br><span class="badge badge-route-group" style="background:{gc}22;color:{gc}">{group}</span></td>')
    html_parts.append(f'<td>{route["component"]}</td>')
    html_parts.append(f'<td>{api_html}</td>')
    html_parts.append(f'<td>{backend_html}</td>')
    html_parts.append(f'<td>{tables_html}</td>')
    html_parts.append(f'<td>{roles_html}</td>')
    html_parts.append('</tr>')

html_parts.append('</table>')

# Chain visualization section
html_parts.append('<h2>Data Flow Chains</h2>')
html_parts.append('<p class="subtitle">Visual representation of how each route group flows through the stack</p>')

# Build chain summaries per group
for group in groups:
    if group == 'Auth':
        continue
    gc = ROUTE_GROUP_COLORS.get(group, '#58a6ff')
    group_routes = [r for r in FRONTEND_ROUTES if r['group'] == group and r['component'] not in ('LoginPage', 'NotFoundPage')]

    # Aggregate unique values for the group
    all_apis = sorted(set(a for r in group_routes for a in r['api_services']))
    all_backends = sorted(set(b for r in group_routes for b in r['backend_services']))
    all_tables = sorted(set(t for r in group_routes for t in r['db_tables']))

    html_parts.append(f'<div class="svc-card">')
    html_parts.append(f'<div class="svc-header" onclick="toggleService(this)">')
    html_parts.append(f'<div>')
    html_parts.append(f'<div class="svc-name"><span class="dot" style="background:{gc}"></span> {group}</div>')
    html_parts.append(f'<div class="svc-desc">{len(group_routes)} routes → {len(all_apis)} API services → {len(all_backends)} backend services → {len(all_tables)} tables</div>')
    html_parts.append(f'</div>')
    html_parts.append(f'<span class="arrow">▶</span>')
    html_parts.append(f'</div>')
    html_parts.append(f'<div class="svc-body">')

    # Chain visualization
    html_parts.append('<div style="margin:12px 0;padding:16px;background:var(--bg);border-radius:8px;overflow-x:auto;">')

    # Routes
    html_parts.append('<div style="margin-bottom:12px;"><strong style="color:var(--text-muted);font-size:12px;">ROUTES:</strong><br>')
    for r in group_routes:
        html_parts.append(f'<span class="chain-box chain-route">{r["path"]}</span> ')
    html_parts.append('</div>')

    # API Services
    if all_apis:
        html_parts.append('<div style="margin-bottom:12px;"><span class="chain-arrow">↓</span><br><strong style="color:var(--text-muted);font-size:12px;">API SERVICES:</strong><br>')
        for a in all_apis:
            html_parts.append(f'<span class="chain-box chain-api">{a}</span> ')
        html_parts.append('</div>')

    # Backend Services
    if all_backends:
        html_parts.append('<div style="margin-bottom:12px;"><span class="chain-arrow">↓</span><br><strong style="color:var(--text-muted);font-size:12px;">BACKEND SERVICES:</strong><br>')
        for b in all_backends:
            html_parts.append(f'<span class="chain-box chain-backend">{b}</span> ')
        html_parts.append('</div>')

    # DB Tables
    if all_tables:
        html_parts.append('<div><span class="chain-arrow">↓</span><br><strong style="color:var(--text-muted);font-size:12px;">DATABASE TABLES ({}):</strong><br>'.format(len(all_tables)))
        for t in all_tables:
            domain = get_table_domain(t)
            dc = DOMAIN_COLORS.get(domain, '#95a5a6')
            html_parts.append(f'<span class="badge badge-domain" style="background:{dc}33;color:{dc}">{t}</span>')
        html_parts.append('</div>')

    html_parts.append('</div>')  # chain viz container
    html_parts.append('</div></div>')  # svc-body, svc-card

html_parts.append('</div>')  # tab-routes

# ══════════════════════════════════════════════════════════════════
# Tab 2: Services
# ══════════════════════════════════════════════════════════════════
html_parts.append('<div id="tab-services" class="tab-content">')
html_parts.append('<h2>Service Details</h2>')

for svc_name, data in services.items():
    color = SVC_COLORS.get(svc_name, '#58a6ff')
    desc = SVC_DESCRIPTIONS.get(svc_name, '')
    n_tables = len(data['all_tables'])
    n_views = len(data['all_views'])
    n_files = len(data['files'])

    html_parts.append(f'''
    <div class="svc-card">
      <div class="svc-header" onclick="toggleService(this)">
        <div>
          <div class="svc-name"><span class="dot" style="background:{color}"></span> {svc_name}</div>
          <div class="svc-desc">{desc}</div>
        </div>
        <div style="display:flex;align-items:center;gap:20px;">
          <div class="svc-stats">
            <span><strong>{n_tables}</strong> tables</span>
            <span><strong>{n_views}</strong> views</span>
            <span><strong>{n_files}</strong> files</span>
          </div>
          <span class="arrow">▶</span>
        </div>
      </div>
      <div class="svc-body">
    ''')

    if data['all_tables']:
        html_parts.append('<h3>Tables Referenced</h3><div>')
        by_domain = defaultdict(list)
        for t in sorted(data['all_tables']):
            by_domain[get_table_domain(t)].append(t)
        for domain in ['Core', 'HAM', 'SAM', 'EAM', 'Procurement', 'Financial', 'Location', 'Organization', 'Discovery', 'Unknown']:
            if domain in by_domain:
                dc = DOMAIN_COLORS.get(domain, '#95a5a6')
                for t in by_domain[domain]:
                    html_parts.append(f'<span class="badge badge-table badge-domain" style="background:{dc}33;color:{dc}">{t}</span>')
        html_parts.append('</div>')

    if data['all_views']:
        html_parts.append('<h3>Views Referenced</h3><div>')
        for v in sorted(data['all_views']):
            html_parts.append(f'<span class="badge badge-view">{v}</span>')
        html_parts.append('</div>')

    if data['files']:
        html_parts.append('<h3>Source Files with DB References</h3>')
        html_parts.append('<table><tr><th>File</th><th>Tables</th><th>Views</th><th>Operations</th></tr>')
        for fd in sorted(data['files'], key=lambda x: x['file']):
            tables_html = ' '.join(f'<span class="badge badge-table">{t}</span>' for t in fd['tables'])
            views_html = ' '.join(f'<span class="badge badge-view">{v}</span>' for v in fd['views'])
            ops_html = ' '.join(f'<span class="badge badge-op">{o}</span>' for o in fd['operations'])
            html_parts.append(f'<tr><td class="file-path">{fd["file"]}</td><td>{tables_html}</td><td>{views_html}</td><td>{ops_html}</td></tr>')
        html_parts.append('</table>')

    html_parts.append('</div></div>')

html_parts.append('</div>')

# ══════════════════════════════════════════════════════════════════
# Tab 3: Cross-Reference Matrix
# ══════════════════════════════════════════════════════════════════
html_parts.append('<div id="tab-matrix" class="tab-content">')
html_parts.append('<h2>Service × Table Cross-Reference Matrix</h2>')
html_parts.append('<p class="subtitle">✓ = service references this table</p>')
html_parts.append('<div style="overflow-x:auto;">')
html_parts.append('<table>')

svc_names = sorted(services.keys())
html_parts.append('<tr><th>Table</th><th>Domain</th>')
for svc in svc_names:
    short = svc.replace('-service', '')
    html_parts.append(f'<th class="matrix-header">{short}</th>')
html_parts.append('<th>Services</th></tr>')

for table in sorted(DB_TABLES):
    domain = get_table_domain(table)
    dc = DOMAIN_COLORS.get(domain, '#95a5a6')
    html_parts.append(f'<tr><td><code>{table}</code></td>')
    html_parts.append(f'<td><span class="badge badge-domain" style="background:{dc}33;color:{dc}">{domain}</span></td>')
    count = 0
    for svc in svc_names:
        if table in services[svc]['all_tables']:
            html_parts.append('<td class="matrix-cell active">✓</td>')
            count += 1
        else:
            html_parts.append('<td class="matrix-cell inactive">·</td>')
    html_parts.append(f'<td style="text-align:center">{count}</td></tr>')

html_parts.append('</table></div></div>')

# ══════════════════════════════════════════════════════════════════
# Tab 4: Table Ownership
# ══════════════════════════════════════════════════════════════════
html_parts.append('<div id="tab-tables" class="tab-content">')
html_parts.append('<h2>Table Ownership & Access Patterns</h2>')
html_parts.append('<table><tr><th>Table</th><th>Domain</th><th>Services</th><th>Access Count</th></tr>')

for table in sorted(DB_TABLES):
    domain = get_table_domain(table)
    dc = DOMAIN_COLORS.get(domain, '#95a5a6')
    svcs = table_to_services.get(table, set())
    svcs_html = ' '.join(f'<span class="badge" style="background:{SVC_COLORS.get(s,"#58a6ff")}33;color:{SVC_COLORS.get(s,"#58a6ff")}">{s}</span>' for s in sorted(svcs))
    if not svcs:
        svcs_html = '<span class="badge badge-orphan">ORPHAN</span>'
    html_parts.append(f'<tr><td><code>{table}</code></td>')
    html_parts.append(f'<td><span class="badge badge-domain" style="background:{dc}33;color:{dc}">{domain}</span></td>')
    html_parts.append(f'<td>{svcs_html}</td>')
    html_parts.append(f'<td style="text-align:center">{len(svcs)}</td></tr>')

html_parts.append('</table></div>')

# ══════════════════════════════════════════════════════════════════
# Tab 5: Orphan Analysis
# ══════════════════════════════════════════════════════════════════
html_parts.append('<div id="tab-orphans" class="tab-content">')
html_parts.append('<h2>Orphan Analysis</h2>')

if orphan_tables:
    html_parts.append(f'<div class="warning">⚠️ {len(orphan_tables)} tables exist in the database but are not referenced by any backend service source code.</div>')
    html_parts.append('<h3>Orphan Tables</h3><table><tr><th>Table</th><th>Domain</th><th>Possible Reason</th></tr>')
    for t in sorted(orphan_tables):
        domain = get_table_domain(t)
        dc = DOMAIN_COLORS.get(domain, '#95a5a6')
        reason = 'Managed by DB triggers/functions only' if t in ('audit_log',) else 'May need service integration'
        html_parts.append(f'<tr><td><code>{t}</code></td><td><span class="badge badge-domain" style="background:{dc}33;color:{dc}">{domain}</span></td><td>{reason}</td></tr>')
    html_parts.append('</table>')
else:
    html_parts.append('<div class="success">✅ All tables are referenced by at least one service.</div>')

if orphan_views:
    html_parts.append(f'<div class="warning">⚠️ {len(orphan_views)} views exist in the database but are not used by any backend service.</div>')
    html_parts.append('<h3>Orphan Views</h3><table><tr><th>View</th><th>Suggested Service</th></tr>')
    view_suggestions = {
        'v_active_contracts': 'lifecycle-service / report-service',
        'v_active_transfers': 'ham-service',
        'v_asset_depreciation_summary': 'report-service',
        'v_asset_relationships': 'asset-service',
        'v_asset_summary': 'report-service / asset-service',
        'v_audit_discrepancies': 'ham-service',
        'v_calibration_due': 'eam-service',
        'v_contract_value_by_vendor': 'report-service',
        'v_contracts_expiring': 'notification-service / lifecycle-service',
        'v_cost_center_budget': 'report-service / admin-service',
        'v_discovery_asset_mapping': 'integration-service',
        'v_discovery_summary': 'integration-service',
        'v_discovery_unmatched': 'integration-service',
        'v_enterprise_assets': 'eam-service',
        'v_enterprise_summary_by_facility': 'eam-service / report-service',
        'v_entitlements': 'sam-service',
        'v_entitlements_expiring': 'sam-service / notification-service',
        'v_hardware_assets': 'ham-service',
        'v_hardware_summary_by_category': 'ham-service / report-service',
        'v_lease_expiring': 'lifecycle-service / notification-service',
        'v_lease_payment_schedule': 'lifecycle-service',
        'v_license_compliance': 'sam-service / report-service',
        'v_linear_assets': 'eam-service',
        'v_maintenance_due': 'eam-service / notification-service',
        'v_open_work_orders': 'eam-service',
        'v_overdue_lease_payments': 'lifecycle-service / notification-service',
        'v_overdue_loaners': 'ham-service / notification-service',
        'v_parts_reorder_needed': 'eam-service / notification-service',
        'v_pending_purchase_orders': 'procurement-service',
        'v_pending_receiving': 'procurement-service',
        'v_purchase_order_summary': 'procurement-service / report-service',
        'v_reclamation_candidates': 'sam-service',
        'v_relationship_summary': 'asset-service',
        'v_saas_utilization': 'sam-service',
        'v_software_installations': 'sam-service',
        'v_software_products': 'sam-service',
        'v_stockroom_summary': 'ham-service / report-service',
        'v_unauthorized_software': 'sam-service',
        'v_upcoming_lease_payments': 'lifecycle-service',
        'v_user_permissions': 'admin-service / auth',
        'v_warranty_expiring': 'ham-service / notification-service',
        'v_work_order_metrics': 'eam-service / report-service',
        'v_work_order_parts_summary': 'eam-service',
    }
    for v in sorted(orphan_views):
        suggestion = view_suggestions.get(v, 'TBD')
        html_parts.append(f'<tr><td><code>{v}</code></td><td>{suggestion}</td></tr>')
    html_parts.append('</table>')
else:
    html_parts.append('<div class="success">✅ All views are used by at least one service.</div>')

html_parts.append('</div>')

# ══════════════════════════════════════════════════════════════════
# Tab 6: View Usage
# ══════════════════════════════════════════════════════════════════
html_parts.append('<div id="tab-views" class="tab-content">')
html_parts.append('<h2>Database View Usage</h2>')
html_parts.append('<table><tr><th>View</th><th>Used By</th><th>Status</th></tr>')

for v in sorted(DB_VIEWS):
    svcs = view_to_services.get(v, set())
    if svcs:
        svcs_html = ' '.join(f'<span class="badge" style="background:#1f3a5f;color:#58a6ff">{s}</span>' for s in sorted(svcs))
        status = '<span class="badge badge-op">IN USE</span>'
    else:
        svcs_html = '—'
        status = '<span class="badge badge-orphan">UNUSED</span>'
    html_parts.append(f'<tr><td><code>{v}</code></td><td>{svcs_html}</td><td>{status}</td></tr>')

html_parts.append('</table></div>')

# ══════════════════════════════════════════════════════════════════
# JavaScript
# ══════════════════════════════════════════════════════════════════
html_parts.append('''
<script>
function switchTab(tabId) {
  document.querySelectorAll('.tab-content').forEach(el => el.classList.remove('active'));
  document.querySelectorAll('.tab').forEach(el => el.classList.remove('active'));
  document.getElementById('tab-' + tabId).classList.add('active');
  event.target.classList.add('active');
}
function toggleService(header) {
  const body = header.nextElementSibling;
  const arrow = header.querySelector('.arrow');
  body.classList.toggle('open');
  arrow.classList.toggle('open');
}
function filterRoutes() {
  const query = document.getElementById('routeSearch').value.toLowerCase();
  document.querySelectorAll('.route-row').forEach(row => {
    const text = row.getAttribute('data-search');
    row.style.display = text.includes(query) ? '' : 'none';
  });
}
function filterRouteGroup(btn, group) {
  // Toggle active state
  document.querySelectorAll('#routeGroupFilters .filter-btn').forEach(b => b.classList.remove('active'));
  btn.classList.add('active');
  document.querySelectorAll('.route-row').forEach(row => {
    if (group === 'all') {
      row.style.display = '';
    } else {
      row.style.display = row.getAttribute('data-group') === group ? '' : 'none';
    }
  });
}
// Auto-expand first chain
document.addEventListener('DOMContentLoaded', () => {
  const first = document.querySelector('#tab-routes .svc-header');
  if (first) toggleService(first);
});
</script>
''')

html_parts.append('</div></body></html>')

# ── Write HTML ──
with open('AMS_SERVICE_DB_MAP.html', 'w', encoding='utf-8') as f:
    f.write('\n'.join(html_parts))

print(f"\nHTML report generated: AMS_SERVICE_DB_MAP.html")

# ── Also write JSON summary ──
summary = {
    'services': {},
    'orphan_tables': sorted(orphan_tables),
    'orphan_views': sorted(orphan_views),
    'table_coverage': f"{len(all_referenced_tables)}/{len(DB_TABLES)}",
    'view_coverage': f"{len(all_referenced_views)}/{len(DB_VIEWS)}",
    'frontend_routes': [],
}
for svc, data in services.items():
    summary['services'][svc] = {
        'tables': sorted(data['all_tables']),
        'views': sorted(data['all_views']),
        'file_count': len(data['files']),
    }
for route in FRONTEND_ROUTES:
    summary['frontend_routes'].append({
        'path': route['path'],
        'component': route['component'],
        'group': route['group'],
        'api_services': route['api_services'],
        'backend_services': route['backend_services'],
        'db_tables': route['db_tables'],
        'roles': route['roles'],
    })

with open('service_db_mapping_summary.json', 'w') as f:
    json.dump(summary, f, indent=2)

print(f"JSON summary: service_db_mapping_summary.json")
