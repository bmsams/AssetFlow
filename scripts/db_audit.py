#!/usr/bin/env python3
"""
Database Schema Audit Script
Parses RDS Data API JSON output and compares live DB schema against TypeScript types.
"""
import json
import sys
from collections import defaultdict

def parse_rds_records(filepath):
    with open(filepath, encoding="utf-16") as f:
        data = json.load(f)
    rows = []
    for record in data.get("records", []):
        row = []
        for field in record:
            if "stringValue" in field:
                row.append(field["stringValue"])
            elif "longValue" in field:
                row.append(field["longValue"])
            elif "booleanValue" in field:
                row.append(field["booleanValue"])
            elif "isNull" in field and field["isNull"]:
                row.append(None)
            elif "doubleValue" in field:
                row.append(field["doubleValue"])
            else:
                row.append(str(field))
        rows.append(row)
    return rows

def build_schema(columns_file):
    rows = parse_rds_records(columns_file)
    schema = defaultdict(list)
    for row in rows:
        table, col, dtype, nullable, default = row[0], row[1], row[2], row[3], row[4]
        schema[table].append({
            "column": col,
            "type": dtype,
            "nullable": nullable == "YES",
            "default": default
        })
    return dict(schema)


def build_constraints(constraints_file):
    rows = parse_rds_records(constraints_file)
    constraints = defaultdict(list)
    for row in rows:
        table, name, ctype, definition = row[0], row[1], row[2], row[3]
        constraints[table].append({
            "name": name,
            "type": ctype,
            "definition": definition
        })
    return dict(constraints)

# TypeScript interface -> DB table mapping with expected columns
# Format: { "ts_interface": { "table": "db_table", "columns": { "tsField": "db_column" } } }
TS_TO_DB_MAP = {
    "Asset": {
        "table": "assets",
        "columns": {
            "assetId": "asset_id",
            "assetTag": "asset_tag",
            "assetType": "asset_type",
            "displayName": "display_name",
            "description": "description",
            "status": "status",
            "substatus": "substatus",
            "createdAt": "created_at",
            "updatedAt": "updated_at",
            "createdBy": "created_by",
            "updatedBy": "updated_by",
        }
    },
    "HardwareAsset": {
        "table": "hardware_assets",
        "columns": {
            "serialNumber": "serial_number",
            "manufacturerId": "manufacturer_id",
            "modelId": "model_id",
            "modelCategory": "model_category",
            "stockroomId": "stockroom_id",
            "building": "building",
            "floor": "floor",
            "room": "room",
            "rack": "rack",
            "rackUnit": "rack_unit",
            "assignedTo": "assigned_to",
            "departmentId": "department_id",
            "costCenterId": "cost_center_id",
            "managedBy": "managed_by",
            "purchasePrice": "purchase_price",
            "residualValue": "residual_value",
            "depreciationMethod": "depreciation_method",
            "depreciationStartDate": "depreciation_start_date",
            "usefulLifeMonths": "useful_life_months",
            "purchaseOrderId": "purchase_order_id",
            "vendorId": "vendor_id",
            "receivedDate": "received_date",
            "warrantyExpiration": "warranty_expiration",
            "cpu": "cpu",
            "memoryGb": "memory_gb",
            "storageGb": "storage_gb",
            "operatingSystem": "operating_system",
            "ipAddress": "ip_address",
            "macAddress": "mac_address",
            "lastDiscoveredAt": "last_discovered_at",
            "installDate": "install_date",
            "retirementDate": "retirement_date",
            "disposalDate": "disposal_date",
            "disposalMethod": "disposal_method",
            "destructionCertificateId": "destruction_certificate_id",
            "leaseContractId": "lease_contract_id",
            "leaseStartDate": "lease_start_date",
            "leaseEndDate": "lease_end_date",
            "monthlyLeaseCost": "monthly_lease_cost",
        }
    },
    "EnterpriseAsset": {
        "table": "enterprise_assets",
        "columns": {
            "serialNumber": "serial_number",
            "manufacturer": "manufacturer",
            "model": "model",
            "assetClass": "asset_class",
            "criticalityLevel": "criticality_level",
            "facilityId": "facility_id",
            "building": "building",
            "floor": "floor",
            "zone": "zone",
            "gpsLatitude": "gps_latitude",
            "gpsLongitude": "gps_longitude",
            "operatingHours": "operating_hours",
            "meterReading": "meter_reading",
            "lastCalibrationDate": "last_calibration_date",
            "nextCalibrationDue": "next_calibration_due",
        }
    },
    "User": {
        "table": "users",
        "columns": {
            "userId": "user_id",
            "cognitoSub": "cognito_sub",
            "email": "email",
            "firstName": "first_name",
            "lastName": "last_name",
            "departmentId": "department_id",
            "managerId": "manager_id",
            "isActive": "is_active",
            "createdAt": "created_at",
            "updatedAt": "updated_at",
        }
    },
    "Department": {
        "table": "departments",
        "columns": {
            "departmentId": "department_id",
            "name": "name",
            "code": "code",
            "parentDepartmentId": "parent_department_id",
            "isActive": "is_active",
            "createdAt": "created_at",
            "updatedAt": "updated_at",
        }
    },
    "Vendor": {
        "table": "vendors",
        "columns": {
            "vendorId": "vendor_id",
            "vendorName": "vendor_name",
            "vendorType": "vendor_type",
            "contactName": "contact_name",
            "contactEmail": "contact_email",
            "contactPhone": "contact_phone",
            "address": "address",
            "paymentTerms": "payment_terms",
            "isActive": "is_active",
            "createdAt": "created_at",
            "updatedAt": "updated_at",
        }
    },
    "Contract": {
        "table": "contracts",
        "columns": {
            "contractId": "contract_id",
            "contractNumber": "contract_number",
            "vendorId": "vendor_id",
            "contractType": "contract_type",
            "startDate": "start_date",
            "endDate": "end_date",
            "totalValue": "total_value",
            "status": "status",
            "paymentTerms": "payment_terms",
            "renewalType": "renewal_type",
            "autoRenewal": "auto_renewal",
            "cancellationNoticeDays": "cancellation_notice_days",
            "slaTerms": "sla_terms",
            "createdAt": "created_at",
            "updatedAt": "updated_at",
        }
    },
    "PurchaseOrder": {
        "table": "purchase_orders",
        "columns": {
            "poId": "po_id",
            "poNumber": "po_number",
            "vendorId": "vendor_id",
            "costCenterId": "cost_center_id",
            "status": "status",
            "requestedBy": "requested_by",
            "requestedDate": "requested_date",
            "approvedBy": "approved_by",
            "approvedDate": "approved_date",
            "rejectedBy": "rejected_by",
            "rejectedDate": "rejected_date",
            "rejectionReason": "rejection_reason",
            "sentDate": "sent_date",
            "expectedDeliveryDate": "expected_delivery_date",
            "subtotal": "subtotal",
            "taxAmount": "tax_amount",
            "shippingAmount": "shipping_amount",
            "totalAmount": "total_amount",
            "notes": "notes",
            "createdAt": "created_at",
            "updatedAt": "updated_at",
        }
    },
    "POLine": {
        "table": "po_lines",
        "columns": {
            "lineId": "line_id",
            "poId": "po_id",
            "lineNumber": "line_number",
            "productType": "product_type",
            "productId": "product_id",
            "productDescription": "product_description",
            "sku": "sku",
            "quantity": "quantity",
            "unitPrice": "unit_price",
            "lineTotal": "line_total",
            "quantityReceived": "quantity_received",
            "notes": "notes",
            "createdAt": "created_at",
            "updatedAt": "updated_at",
        }
    },
    "Building": {
        "table": "buildings",
        "columns": {
            "buildingId": "building_id",
            "buildingCode": "building_code",
            "name": "name",
            "addressLine1": "address_line1",
            "addressLine2": "address_line2",
            "city": "city",
            "stateProvince": "state_province",
            "postalCode": "postal_code",
            "country": "country",
            "contactName": "contact_name",
            "contactEmail": "contact_email",
            "contactPhone": "contact_phone",
            "isActive": "is_active",
            "createdAt": "created_at",
            "updatedAt": "updated_at",
        }
    },
    "Floor": {
        "table": "floors",
        "columns": {
            "floorId": "floor_id",
            "buildingId": "building_id",
            "floorNumber": "floor_number",
            "name": "name",
            "description": "description",
            "isActive": "is_active",
            "createdAt": "created_at",
            "updatedAt": "updated_at",
        }
    },
    "Room": {
        "table": "rooms",
        "columns": {
            "roomId": "room_id",
            "floorId": "floor_id",
            "roomNumber": "room_number",
            "name": "name",
            "roomType": "room_type",
            "capacity": "capacity",
            "description": "description",
            "isActive": "is_active",
            "createdAt": "created_at",
            "updatedAt": "updated_at",
        }
    },
    "Rack": {
        "table": "racks",
        "columns": {
            "rackId": "rack_id",
            "roomId": "room_id",
            "rackName": "rack_name",
            "totalUnits": "total_units",
            "usedUnits": "used_units",
            "description": "description",
            "isActive": "is_active",
            "createdAt": "created_at",
            "updatedAt": "updated_at",
        }
    },
    "BinLocation": {
        "table": "bin_locations",
        "columns": {
            "binId": "bin_id",
            "stockroomId": "stockroom_id",
            "binCode": "bin_code",
            "shelfLocation": "shelf_location",
            "capacity": "capacity",
            "currentCount": "current_count",
            "isActive": "is_active",
            "createdAt": "created_at",
            "updatedAt": "updated_at",
        }
    },
    "Stockroom": {
        "table": "stockrooms",
        "columns": {
            "stockroomId": "stockroom_id",
            "name": "name",
            "location": "location",
            "stockroomType": "stockroom_type",
            "managerId": "manager_id",
            "isActive": "is_active",
            "createdAt": "created_at",
            "updatedAt": "updated_at",
        }
    },
    "SoftwareProduct": {
        "table": "software_products",
        "columns": {
            "productId": "product_id",
            "publisher": "publisher",
            "productName": "product_name",
            "version": "version",
            "edition": "edition",
            "productCategory": "product_category",
            "isSaas": "is_saas",
            "normalizationKey": "normalization_key",
            "createdAt": "created_at",
            "updatedAt": "updated_at",
        }
    },
    "Entitlement": {
        "table": "entitlements",
        "columns": {
            "entitlementId": "entitlement_id",
            "softwareProductId": "software_product_id",
            "licenseType": "license_type",
            "quantityPurchased": "quantity_purchased",
            "quantityAvailable": "quantity_available",
            "unitCost": "unit_cost",
            "contractId": "contract_id",
            "purchaseOrderId": "purchase_order_id",
            "startDate": "start_date",
            "endDate": "end_date",
            "renewalDate": "renewal_date",
            "maintenanceIncluded": "maintenance_included",
            "metricType": "metric_type",
            "metricValue": "metric_value",
            "createdAt": "created_at",
            "updatedAt": "updated_at",
        }
    },
    "WorkOrder": {
        "table": "work_orders",
        "columns": {
            "workOrderId": "work_order_id",
            "workOrderNumber": "work_order_number",
            "assetId": "asset_id",
            "maintenancePlanId": "maintenance_plan_id",
            "workType": "work_type",
            "priority": "priority",
            "status": "status",
            "assignedTo": "assigned_to",
            "scheduledDate": "scheduled_date",
            "completedDate": "completed_date",
            "description": "description",
            "createdAt": "created_at",
            "updatedAt": "updated_at",
        }
    },
    "MaintenancePlan": {
        "table": "maintenance_plans",
        "columns": {
            "planId": "plan_id",
            "assetId": "asset_id",
            "planName": "plan_name",
            "maintenanceType": "maintenance_type",
            "frequencyDays": "frequency_days",
            "frequencyHours": "frequency_hours",
            "lastPerformedDate": "last_performed_date",
            "nextDueDate": "next_due_date",
            "isActive": "is_active",
            "createdAt": "created_at",
            "updatedAt": "updated_at",
        }
    },
    "CostCenter": {
        "table": "cost_centers",
        "columns": {
            "costCenterId": "cost_center_id",
            "code": "code",
            "name": "name",
            "departmentId": "department_id",
            "budgetAmount": "budget_amount",
            "spentAmount": "spent_amount",
            "fiscalYear": "fiscal_year",
            "isActive": "is_active",
            "createdAt": "created_at",
            "updatedAt": "updated_at",
        }
    },
    "AuditLogEntry": {
        "table": "audit_log",
        "columns": {
            "logId": "log_id",
            "userId": "user_id",
            "actionType": "action_type",
            "resourceType": "resource_type",
            "resourceId": "resource_id",
            "oldValues": "old_values",
            "newValues": "new_values",
            "ipAddress": "ip_address",
            "userAgent": "user_agent",
            "timestamp": "timestamp",
        }
    },
    "VendorModelPrice": {
        "table": "vendor_model_prices",
        "columns": {
            "vendorId": "vendor_id",
            "modelId": "model_id",
            "unitPrice": "unit_price",
            "currency": "currency",
            "vendorSku": "vendor_sku",
            "isActive": "is_active",
            "createdAt": "created_at",
            "updatedAt": "updated_at",
        }
    },
    "InspectionRecord": {
        "table": "inspection_records",
        "columns": {
            "inspectionId": "inspection_id",
            "receivingLineId": "receiving_line_id",
            "assetId": "asset_id",
            "serialNumber": "serial_number",
            "inspectionStatus": "inspection_status",
            "inspectedBy": "inspected_by",
            "inspectedDate": "inspected_date",
            "result": "result",
            "notes": "notes",
            "failureReason": "failure_reason",
            "createdAt": "created_at",
            "updatedAt": "updated_at",
        }
    },
}

def run_audit():
    schema = build_schema("db_schema_full.json")
    constraints = build_constraints("db_constraints.json")

    report = []
    report.append("# AMS Database Schema Audit Report\n")
    report.append(f"**Tables in live DB:** {len(schema)}\n")
    report.append(f"**Tables expected from migrations:** ~57\n")
    report.append("")

    # 1. List all tables
    report.append("## 1. Live Database Tables\n")
    for t in sorted(schema.keys()):
        col_count = len(schema[t])
        report.append(f"- `{t}` ({col_count} columns)")
    report.append("")

    # 2. TypeScript ↔ DB Column Comparison
    report.append("## 2. TypeScript Interface ↔ DB Column Alignment\n")
    issues_found = 0
    for ts_name, mapping in sorted(TS_TO_DB_MAP.items()):
        table = mapping["table"]
        ts_cols = mapping["columns"]

        if table not in schema:
            report.append(f"### ❌ {ts_name} → `{table}` — TABLE NOT FOUND IN DB\n")
            issues_found += 1
            continue

        db_col_names = {c["column"] for c in schema[table]}
        missing_in_db = []
        missing_in_ts = []

        for ts_field, db_col in ts_cols.items():
            if db_col not in db_col_names:
                missing_in_db.append(f"{ts_field} → {db_col}")

        # Check for DB columns not mapped in TS (informational)
        mapped_db_cols = set(ts_cols.values())
        extra_db_cols = db_col_names - mapped_db_cols
        # Filter out common unmapped cols that are OK
        ignore_cols = {"asset_id"}  # PK inherited from parent
        extra_db_cols -= ignore_cols

        if missing_in_db:
            report.append(f"### ⚠️ {ts_name} → `{table}`")
            report.append(f"**TS fields with NO matching DB column:**")
            for m in missing_in_db:
                report.append(f"  - {m}")
            issues_found += len(missing_in_db)
        
        if extra_db_cols and len(extra_db_cols) > 3:
            if not missing_in_db:
                report.append(f"### ℹ️ {ts_name} → `{table}`")
            report.append(f"**DB columns not mapped in TS type** ({len(extra_db_cols)}):")
            for c in sorted(extra_db_cols):
                report.append(f"  - `{c}`")
        
        if not missing_in_db and len(extra_db_cols) <= 3:
            report.append(f"### ✅ {ts_name} → `{table}` — All mapped columns exist")
        
        report.append("")

    # 3. Foreign Key Analysis
    report.append("## 3. Foreign Key Integrity\n")
    fk_count = 0
    fk_issues = []
    for table, cons in sorted(constraints.items()):
        for c in cons:
            if c["type"] == "f":
                fk_count += 1
                defn = c["definition"]
                # Check if referenced table exists
                if "REFERENCES" in defn.upper():
                    import re
                    match = re.search(r'REFERENCES\s+(\w+)', defn, re.IGNORECASE)
                    if match:
                        ref_table = match.group(1)
                        if ref_table not in schema:
                            fk_issues.append(f"`{table}`.`{c['name']}` references non-existent table `{ref_table}`")
    
    report.append(f"**Total foreign keys:** {fk_count}")
    if fk_issues:
        report.append(f"**Broken FK references:** {len(fk_issues)}")
        for issue in fk_issues:
            report.append(f"  - ❌ {issue}")
    else:
        report.append("**Broken FK references:** 0 ✅")
    report.append("")

    # 4. Check constraint analysis
    report.append("## 4. Check Constraints Summary\n")
    check_count = 0
    for table, cons in sorted(constraints.items()):
        checks = [c for c in cons if c["type"] == "c"]
        if checks:
            check_count += len(checks)
            report.append(f"**`{table}`** ({len(checks)} check constraints)")
            for c in checks:
                report.append(f"  - `{c['name']}`")
    report.append(f"\n**Total check constraints:** {check_count}")
    report.append("")

    # 5. Tables with no TypeScript mapping
    report.append("## 5. DB Tables Without TypeScript Type Mapping\n")
    mapped_tables = {m["table"] for m in TS_TO_DB_MAP.values()}
    unmapped = sorted(set(schema.keys()) - mapped_tables)
    # Filter out schema_migrations
    unmapped = [t for t in unmapped if t != "schema_migrations"]
    if unmapped:
        for t in unmapped:
            col_count = len(schema[t])
            report.append(f"- `{t}` ({col_count} columns)")
    else:
        report.append("All tables have TypeScript mappings ✅")
    report.append("")

    # 6. Duplicate/overlapping tables
    report.append("## 6. Potential Duplicate Tables\n")
    # Check for both po_lines and purchase_order_lines
    if "po_lines" in schema and "purchase_order_lines" in schema:
        report.append("⚠️ Both `po_lines` AND `purchase_order_lines` exist — potential duplication")
        report.append("  - `po_lines`: V010 migration (procurement workflow)")
        report.append("  - `purchase_order_lines`: V005 migration (contract/financial)")
        report.append("  - These serve similar purposes and may cause confusion")
    report.append("")

    # 7. Summary
    report.append("## 7. Summary\n")
    report.append(f"- **Total tables:** {len(schema)}")
    report.append(f"- **TypeScript interfaces mapped:** {len(TS_TO_DB_MAP)}")
    report.append(f"- **Column alignment issues:** {issues_found}")
    report.append(f"- **Foreign key count:** {fk_count}")
    report.append(f"- **Broken FK references:** {len(fk_issues)}")
    report.append(f"- **Check constraints:** {check_count}")
    report.append(f"- **Unmapped tables:** {len(unmapped)}")

    return "\n".join(report)

if __name__ == "__main__":
    report = run_audit()
    output_file = "DB_AUDIT_REPORT.md"
    if len(sys.argv) > 1 and sys.argv[1] == "--stdout":
        print(report)
    else:
        with open(output_file, "w", encoding="utf-8") as f:
            f.write(report)
        print(f"Report written to {output_file}")
