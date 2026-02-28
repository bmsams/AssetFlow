"""
Property-based tests for Data Model Round-Trip Consistency.

**Property 2: Data Model Round-Trip Consistency**
**Validates: Requirements 2.1, 2A-2E**

These tests verify that data model objects can be serialized and deserialized
without data loss (round-trip consistency). All required fields are preserved
through serialization/deserialization, relationships between entities are
maintained correctly, and enum values and constraints are properly validated.

Requirements from design.md:
- Requirement 2.1: Asset storage with unique identifiers, classification, status
- Requirement 2A: Hardware Asset Data Model
- Requirement 2B: Software Asset Data Model
- Requirement 2C: Enterprise Asset Data Model
- Requirement 2D: Contract and Financial Data Model
- Requirement 2E: Stockroom and Inventory Data Model
"""

import json
import uuid
from dataclasses import dataclass, field, asdict
from datetime import date, datetime, timezone
from decimal import Decimal
from enum import Enum
from typing import Optional, List, Dict, Any
from ipaddress import IPv4Address

import pytest
from hypothesis import given, settings, strategies as st, assume


# ============================================================================
# ENUMS - Matching database constraints from migrations
# ============================================================================

class AssetType(Enum):
    """Valid asset types (Requirement 2.1)."""
    HARDWARE = "HARDWARE"
    SOFTWARE = "SOFTWARE"
    ENTERPRISE = "ENTERPRISE"


class AssetStatus(Enum):
    """Valid asset lifecycle states (Requirement 2.4)."""
    ORDERED = "ORDERED"
    RECEIVED = "RECEIVED"
    IN_STOCK = "IN_STOCK"
    RESERVED = "RESERVED"
    DEPLOYED = "DEPLOYED"
    IN_MAINTENANCE = "IN_MAINTENANCE"
    RETIRED = "RETIRED"
    DISPOSED = "DISPOSED"


class ModelCategory(Enum):
    """Valid hardware model categories (Requirement 2A.1)."""
    LAPTOP = "LAPTOP"
    DESKTOP = "DESKTOP"
    SERVER = "SERVER"
    NETWORK = "NETWORK"
    MOBILE = "MOBILE"
    PERIPHERAL = "PERIPHERAL"
    STORAGE = "STORAGE"
    PRINTER = "PRINTER"
    MONITOR = "MONITOR"
    OTHER = "OTHER"


class DepreciationMethod(Enum):
    """Valid depreciation methods (Requirement 2A.4)."""
    STRAIGHT_LINE = "STRAIGHT_LINE"
    DECLINING_BALANCE = "DECLINING_BALANCE"
    SUM_OF_YEARS = "SUM_OF_YEARS"
    UNITS_OF_PRODUCTION = "UNITS_OF_PRODUCTION"
    NONE = "NONE"


class LicenseType(Enum):
    """Valid license types (Requirement 2B.2)."""
    PERPETUAL = "PERPETUAL"
    SUBSCRIPTION = "SUBSCRIPTION"
    TERM = "TERM"
    MAINTENANCE = "MAINTENANCE"
    UPGRADE = "UPGRADE"
    ACADEMIC = "ACADEMIC"
    VOLUME = "VOLUME"
    OEM = "OEM"
    TRIAL = "TRIAL"
    FREEWARE = "FREEWARE"
    OPEN_SOURCE = "OPEN_SOURCE"


class MetricType(Enum):
    """Valid license metric types (Requirement 2B.4)."""
    PER_USER = "PER_USER"
    PER_DEVICE = "PER_DEVICE"
    PER_CORE = "PER_CORE"
    PER_PROCESSOR = "PER_PROCESSOR"
    SUBSCRIPTION = "SUBSCRIPTION"
    SITE = "SITE"
    ENTERPRISE = "ENTERPRISE"
    CONCURRENT = "CONCURRENT"


class CriticalityLevel(Enum):
    """Valid criticality levels (Requirement 2C.1)."""
    CRITICAL = "CRITICAL"
    HIGH = "HIGH"
    MEDIUM = "MEDIUM"
    LOW = "LOW"


class ContractType(Enum):
    """Valid contract types (Requirement 2D.3)."""
    PURCHASE = "PURCHASE"
    LEASE = "LEASE"
    MAINTENANCE = "MAINTENANCE"
    SUPPORT = "SUPPORT"
    LICENSE = "LICENSE"
    WARRANTY = "WARRANTY"
    SERVICE = "SERVICE"
    SUBSCRIPTION = "SUBSCRIPTION"
    MASTER = "MASTER"
    NDA = "NDA"
    OTHER = "OTHER"


class StockroomType(Enum):
    """Valid stockroom types (Requirement 2E.1)."""
    MAIN = "MAIN"
    SATELLITE = "SATELLITE"
    VIRTUAL = "VIRTUAL"
    REPAIR = "REPAIR"
    QUARANTINE = "QUARANTINE"
    DISPOSAL = "DISPOSAL"
    RECEIVING = "RECEIVING"
    LOANER = "LOANER"
    SPARE_PARTS = "SPARE_PARTS"
    OTHER = "OTHER"


# ============================================================================
# DATA MODELS - Python dataclasses representing database entities
# ============================================================================

@dataclass
class Asset:
    """
    Core Asset model (Requirement 2.1).
    
    Base entity for all asset types with unique identifiers, classification,
    status, and audit fields.
    """
    asset_id: uuid.UUID
    asset_tag: str
    asset_type: AssetType
    display_name: str
    status: AssetStatus
    description: Optional[str] = None
    substatus: Optional[str] = None
    created_at: Optional[datetime] = None
    updated_at: Optional[datetime] = None
    created_by: Optional[uuid.UUID] = None
    updated_by: Optional[uuid.UUID] = None


@dataclass
class HardwareAsset:
    """
    Hardware Asset model (Requirement 2A).
    
    Hardware-specific attributes extending the base Asset.
    """
    asset_id: uuid.UUID
    serial_number: Optional[str] = None
    manufacturer_id: Optional[uuid.UUID] = None
    model_id: Optional[uuid.UUID] = None
    model_category: Optional[ModelCategory] = None
    
    # Location attributes (2A.2)
    stockroom_id: Optional[uuid.UUID] = None
    building: Optional[str] = None
    floor: Optional[str] = None
    room: Optional[str] = None
    rack: Optional[str] = None
    rack_unit: Optional[int] = None
    
    # Ownership attributes (2A.3)
    assigned_to: Optional[uuid.UUID] = None
    department_id: Optional[uuid.UUID] = None
    cost_center_id: Optional[uuid.UUID] = None
    managed_by: Optional[uuid.UUID] = None
    
    # Financial attributes (2A.4)
    purchase_price: Optional[Decimal] = None
    residual_value: Optional[Decimal] = None
    depreciation_method: Optional[DepreciationMethod] = None
    depreciation_start_date: Optional[date] = None
    useful_life_months: Optional[int] = None
    
    # Technical attributes (2A.6)
    cpu: Optional[str] = None
    memory_gb: Optional[int] = None
    storage_gb: Optional[int] = None
    operating_system: Optional[str] = None
    ip_address: Optional[str] = None
    mac_address: Optional[str] = None
    last_discovered_at: Optional[datetime] = None
    
    # Lifecycle attributes (2A.7)
    install_date: Optional[date] = None
    retirement_date: Optional[date] = None
    disposal_date: Optional[date] = None
    disposal_method: Optional[str] = None
    
    # Lease information (2A.9)
    lease_contract_id: Optional[uuid.UUID] = None
    lease_start_date: Optional[date] = None
    lease_end_date: Optional[date] = None
    monthly_lease_cost: Optional[Decimal] = None


@dataclass
class SoftwareProduct:
    """
    Software Product model (Requirement 2B.1).
    
    Catalog of known software products for license management.
    """
    product_id: uuid.UUID
    publisher: str
    product_name: str
    version: Optional[str] = None
    edition: Optional[str] = None
    product_category: Optional[str] = None
    is_saas: bool = False
    normalization_key: Optional[str] = None
    description: Optional[str] = None
    end_of_life_date: Optional[date] = None
    end_of_support_date: Optional[date] = None
    is_active: bool = True


@dataclass
class Entitlement:
    """
    Entitlement model (Requirements 2B.2, 2B.3, 2B.4).
    
    Software licenses owned by the organization.
    """
    entitlement_id: uuid.UUID
    software_product_id: uuid.UUID
    license_type: LicenseType
    quantity_purchased: int
    quantity_available: int
    metric_type: MetricType
    
    # Financial
    unit_cost: Optional[Decimal] = None
    total_cost: Optional[Decimal] = None
    
    # Contract attributes (2B.3)
    contract_id: Optional[uuid.UUID] = None
    purchase_order_id: Optional[uuid.UUID] = None
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    renewal_date: Optional[date] = None
    maintenance_included: bool = False
    
    # License metrics (2B.4)
    metric_value: Optional[int] = None
    
    # Additional
    license_key: Optional[str] = None
    notes: Optional[str] = None
    is_active: bool = True


@dataclass
class SoftwareInstallation:
    """
    Software Installation model (Requirements 2B.5, 2B.6).
    
    Discovered/deployed software instances on hardware assets.
    """
    installation_id: uuid.UUID
    software_product_id: uuid.UUID
    hardware_asset_id: uuid.UUID
    
    # Usage tracking (2B.5)
    installed_date: Optional[date] = None
    last_used_date: Optional[date] = None
    usage_minutes_30day: int = 0
    usage_minutes_90day: int = 0
    
    # Discovery attributes (2B.6)
    discovery_source: Optional[str] = None
    discovery_date: Optional[datetime] = None
    install_path: Optional[str] = None
    version_detected: Optional[str] = None
    
    # Authorization
    is_authorized: bool = True
    entitlement_id: Optional[uuid.UUID] = None
    status: str = "ACTIVE"


@dataclass
class EnterpriseAsset:
    """
    Enterprise Asset model (Requirements 2C.1, 2C.2, 2C.3).
    
    Enterprise-specific asset attributes for non-IT equipment.
    """
    asset_id: uuid.UUID
    serial_number: Optional[str] = None
    manufacturer: Optional[str] = None
    model: Optional[str] = None
    asset_class: Optional[str] = None
    criticality_level: Optional[CriticalityLevel] = None
    
    # Location attributes (2C.2)
    facility_id: Optional[uuid.UUID] = None
    building: Optional[str] = None
    floor: Optional[str] = None
    zone: Optional[str] = None
    gps_latitude: Optional[Decimal] = None
    gps_longitude: Optional[Decimal] = None
    
    # Operational attributes (2C.3)
    operating_hours: int = 0
    meter_reading: Optional[Decimal] = None
    meter_unit: Optional[str] = None
    last_calibration_date: Optional[date] = None
    next_calibration_due: Optional[date] = None
    calibration_interval_days: Optional[int] = None
    
    # Hierarchy
    parent_asset_id: Optional[uuid.UUID] = None
    
    # Metadata
    specifications: Optional[Dict[str, Any]] = None


@dataclass
class Contract:
    """
    Contract model (Requirements 2D.1, 2D.2, 2D.3).
    
    Legal agreements with vendors.
    """
    contract_id: uuid.UUID
    contract_number: str
    vendor_id: Optional[uuid.UUID] = None
    contract_type: Optional[ContractType] = None
    contract_name: Optional[str] = None
    
    # Dates
    start_date: Optional[date] = None
    end_date: Optional[date] = None
    signed_date: Optional[date] = None
    
    # Financial
    total_value: Optional[Decimal] = None
    annual_value: Optional[Decimal] = None
    currency: str = "USD"
    
    # Terms (2D.2)
    payment_terms: Optional[str] = None
    renewal_type: Optional[str] = None
    auto_renewal: bool = False
    cancellation_notice_days: Optional[int] = None
    sla_terms: Optional[str] = None
    
    # Status
    status: str = "DRAFT"
    notes: Optional[str] = None


@dataclass
class Vendor:
    """
    Vendor model (Requirement 2D.4).
    
    Vendor/supplier information.
    """
    vendor_id: uuid.UUID
    vendor_name: str
    vendor_code: Optional[str] = None
    vendor_type: Optional[str] = None
    contact_name: Optional[str] = None
    contact_email: Optional[str] = None
    contact_phone: Optional[str] = None
    address: Optional[str] = None
    city: Optional[str] = None
    country: str = "USA"
    payment_terms: Optional[str] = None
    credit_limit: Optional[Decimal] = None
    rating: Optional[str] = None
    is_active: bool = True


@dataclass
class PurchaseOrder:
    """
    Purchase Order model (Requirement 2D.5).
    
    Procurement documents.
    """
    po_id: uuid.UUID
    po_number: str
    vendor_id: Optional[uuid.UUID] = None
    requester_id: Optional[uuid.UUID] = None
    approver_id: Optional[uuid.UUID] = None
    status: str = "DRAFT"
    order_date: Optional[date] = None
    expected_delivery_date: Optional[date] = None
    total_amount: Optional[Decimal] = None
    subtotal_amount: Optional[Decimal] = None
    tax_amount: Optional[Decimal] = None
    shipping_amount: Optional[Decimal] = None
    currency: str = "USD"
    notes: Optional[str] = None


@dataclass
class PurchaseOrderLine:
    """
    Purchase Order Line model (Requirement 2D.6).
    
    Line items for purchase orders.
    """
    line_id: uuid.UUID
    po_id: uuid.UUID
    line_number: int
    product_description: str
    quantity: int
    unit_price: Decimal
    total_price: Decimal
    product_id: Optional[uuid.UUID] = None
    product_type: Optional[str] = None
    product_sku: Optional[str] = None
    received_quantity: int = 0
    asset_ids_created: Optional[List[uuid.UUID]] = None
    status: str = "PENDING"


@dataclass
class Stockroom:
    """
    Stockroom model (Requirement 2E.1).
    
    Physical or logical inventory locations.
    """
    stockroom_id: uuid.UUID
    name: str
    stockroom_code: Optional[str] = None
    location: Optional[str] = None
    stockroom_type: Optional[StockroomType] = None
    manager_id: Optional[uuid.UUID] = None
    building: Optional[str] = None
    floor: Optional[str] = None
    room: Optional[str] = None
    city: Optional[str] = None
    country: str = "USA"
    capacity_units: Optional[int] = None
    current_utilization: int = 0
    is_active: bool = True


@dataclass
class StockroomInventory:
    """
    Stockroom Inventory model (Requirement 2E.2).
    
    Inventory tracking per stockroom and product.
    """
    inventory_id: uuid.UUID
    stockroom_id: uuid.UUID
    product_type: str
    quantity_on_hand: int = 0
    quantity_reserved: int = 0
    product_id: Optional[uuid.UUID] = None
    product_sku: Optional[str] = None
    product_description: Optional[str] = None
    reorder_point: Optional[int] = None
    reorder_quantity: Optional[int] = None
    max_quantity: Optional[int] = None
    unit_cost: Optional[Decimal] = None
    bin_location: Optional[str] = None
    is_active: bool = True

    @property
    def quantity_available(self) -> int:
        """Computed: on_hand - reserved."""
        return self.quantity_on_hand - self.quantity_reserved


@dataclass
class TransferOrder:
    """
    Transfer Order model (Requirement 2E.3).
    
    Asset/inventory transfer requests between stockrooms.
    """
    transfer_id: uuid.UUID
    transfer_number: str
    from_stockroom_id: uuid.UUID
    to_stockroom_id: uuid.UUID
    requested_by: uuid.UUID
    status: str = "DRAFT"
    priority: str = "NORMAL"
    requested_date: Optional[datetime] = None
    approved_by: Optional[uuid.UUID] = None
    approved_date: Optional[datetime] = None
    reason: Optional[str] = None
    total_quantity: int = 0


@dataclass
class LoanerCheckout:
    """
    Loaner Checkout model (Requirement 2E.8).
    
    Loaner asset tracking.
    """
    checkout_id: uuid.UUID
    asset_id: uuid.UUID
    checked_out_to: uuid.UUID
    checked_out_by: uuid.UUID
    checkout_date: datetime
    due_date: date
    return_date: Optional[datetime] = None
    condition_out: Optional[str] = None
    condition_in: Optional[str] = None
    notes: Optional[str] = None


# ============================================================================
# SERIALIZATION UTILITIES
# ============================================================================

def serialize_model(obj: Any) -> str:
    """
    Serialize a dataclass model to JSON string.
    
    Handles special types: UUID, Decimal, date, datetime, Enum.
    """
    def convert_value(v: Any) -> Any:
        if isinstance(v, uuid.UUID):
            return str(v)
        elif isinstance(v, Decimal):
            return str(v)
        elif isinstance(v, datetime):
            return v.isoformat()
        elif isinstance(v, date):
            return v.isoformat()
        elif isinstance(v, Enum):
            return v.value
        elif isinstance(v, list):
            return [convert_value(item) for item in v]
        elif isinstance(v, dict):
            return {k: convert_value(val) for k, val in v.items()}
        return v
    
    data = asdict(obj)
    converted = {k: convert_value(v) for k, v in data.items()}
    return json.dumps(converted, sort_keys=True)


def deserialize_asset(json_str: str) -> Asset:
    """Deserialize JSON string to Asset model."""
    data = json.loads(json_str)
    return Asset(
        asset_id=uuid.UUID(data["asset_id"]),
        asset_tag=data["asset_tag"],
        asset_type=AssetType(data["asset_type"]),
        display_name=data["display_name"],
        status=AssetStatus(data["status"]),
        description=data.get("description"),
        substatus=data.get("substatus"),
        created_at=datetime.fromisoformat(data["created_at"]) if data.get("created_at") else None,
        updated_at=datetime.fromisoformat(data["updated_at"]) if data.get("updated_at") else None,
        created_by=uuid.UUID(data["created_by"]) if data.get("created_by") else None,
        updated_by=uuid.UUID(data["updated_by"]) if data.get("updated_by") else None,
    )


def deserialize_hardware_asset(json_str: str) -> HardwareAsset:
    """Deserialize JSON string to HardwareAsset model."""
    data = json.loads(json_str)
    return HardwareAsset(
        asset_id=uuid.UUID(data["asset_id"]),
        serial_number=data.get("serial_number"),
        manufacturer_id=uuid.UUID(data["manufacturer_id"]) if data.get("manufacturer_id") else None,
        model_id=uuid.UUID(data["model_id"]) if data.get("model_id") else None,
        model_category=ModelCategory(data["model_category"]) if data.get("model_category") else None,
        stockroom_id=uuid.UUID(data["stockroom_id"]) if data.get("stockroom_id") else None,
        building=data.get("building"),
        floor=data.get("floor"),
        room=data.get("room"),
        rack=data.get("rack"),
        rack_unit=data.get("rack_unit"),
        assigned_to=uuid.UUID(data["assigned_to"]) if data.get("assigned_to") else None,
        department_id=uuid.UUID(data["department_id"]) if data.get("department_id") else None,
        cost_center_id=uuid.UUID(data["cost_center_id"]) if data.get("cost_center_id") else None,
        managed_by=uuid.UUID(data["managed_by"]) if data.get("managed_by") else None,
        purchase_price=Decimal(data["purchase_price"]) if data.get("purchase_price") else None,
        residual_value=Decimal(data["residual_value"]) if data.get("residual_value") else None,
        depreciation_method=DepreciationMethod(data["depreciation_method"]) if data.get("depreciation_method") else None,
        depreciation_start_date=date.fromisoformat(data["depreciation_start_date"]) if data.get("depreciation_start_date") else None,
        useful_life_months=data.get("useful_life_months"),
        cpu=data.get("cpu"),
        memory_gb=data.get("memory_gb"),
        storage_gb=data.get("storage_gb"),
        operating_system=data.get("operating_system"),
        ip_address=data.get("ip_address"),
        mac_address=data.get("mac_address"),
        last_discovered_at=datetime.fromisoformat(data["last_discovered_at"]) if data.get("last_discovered_at") else None,
        install_date=date.fromisoformat(data["install_date"]) if data.get("install_date") else None,
        retirement_date=date.fromisoformat(data["retirement_date"]) if data.get("retirement_date") else None,
        disposal_date=date.fromisoformat(data["disposal_date"]) if data.get("disposal_date") else None,
        disposal_method=data.get("disposal_method"),
        lease_contract_id=uuid.UUID(data["lease_contract_id"]) if data.get("lease_contract_id") else None,
        lease_start_date=date.fromisoformat(data["lease_start_date"]) if data.get("lease_start_date") else None,
        lease_end_date=date.fromisoformat(data["lease_end_date"]) if data.get("lease_end_date") else None,
        monthly_lease_cost=Decimal(data["monthly_lease_cost"]) if data.get("monthly_lease_cost") else None,
    )


def deserialize_software_product(json_str: str) -> SoftwareProduct:
    """Deserialize JSON string to SoftwareProduct model."""
    data = json.loads(json_str)
    return SoftwareProduct(
        product_id=uuid.UUID(data["product_id"]),
        publisher=data["publisher"],
        product_name=data["product_name"],
        version=data.get("version"),
        edition=data.get("edition"),
        product_category=data.get("product_category"),
        is_saas=data.get("is_saas", False),
        normalization_key=data.get("normalization_key"),
        description=data.get("description"),
        end_of_life_date=date.fromisoformat(data["end_of_life_date"]) if data.get("end_of_life_date") else None,
        end_of_support_date=date.fromisoformat(data["end_of_support_date"]) if data.get("end_of_support_date") else None,
        is_active=data.get("is_active", True),
    )


def deserialize_entitlement(json_str: str) -> Entitlement:
    """Deserialize JSON string to Entitlement model."""
    data = json.loads(json_str)
    return Entitlement(
        entitlement_id=uuid.UUID(data["entitlement_id"]),
        software_product_id=uuid.UUID(data["software_product_id"]),
        license_type=LicenseType(data["license_type"]),
        quantity_purchased=data["quantity_purchased"],
        quantity_available=data["quantity_available"],
        metric_type=MetricType(data["metric_type"]),
        unit_cost=Decimal(data["unit_cost"]) if data.get("unit_cost") else None,
        total_cost=Decimal(data["total_cost"]) if data.get("total_cost") else None,
        contract_id=uuid.UUID(data["contract_id"]) if data.get("contract_id") else None,
        purchase_order_id=uuid.UUID(data["purchase_order_id"]) if data.get("purchase_order_id") else None,
        start_date=date.fromisoformat(data["start_date"]) if data.get("start_date") else None,
        end_date=date.fromisoformat(data["end_date"]) if data.get("end_date") else None,
        renewal_date=date.fromisoformat(data["renewal_date"]) if data.get("renewal_date") else None,
        maintenance_included=data.get("maintenance_included", False),
        metric_value=data.get("metric_value"),
        license_key=data.get("license_key"),
        notes=data.get("notes"),
        is_active=data.get("is_active", True),
    )


def deserialize_contract(json_str: str) -> Contract:
    """Deserialize JSON string to Contract model."""
    data = json.loads(json_str)
    return Contract(
        contract_id=uuid.UUID(data["contract_id"]),
        contract_number=data["contract_number"],
        vendor_id=uuid.UUID(data["vendor_id"]) if data.get("vendor_id") else None,
        contract_type=ContractType(data["contract_type"]) if data.get("contract_type") else None,
        contract_name=data.get("contract_name"),
        start_date=date.fromisoformat(data["start_date"]) if data.get("start_date") else None,
        end_date=date.fromisoformat(data["end_date"]) if data.get("end_date") else None,
        signed_date=date.fromisoformat(data["signed_date"]) if data.get("signed_date") else None,
        total_value=Decimal(data["total_value"]) if data.get("total_value") else None,
        annual_value=Decimal(data["annual_value"]) if data.get("annual_value") else None,
        currency=data.get("currency", "USD"),
        payment_terms=data.get("payment_terms"),
        renewal_type=data.get("renewal_type"),
        auto_renewal=data.get("auto_renewal", False),
        cancellation_notice_days=data.get("cancellation_notice_days"),
        sla_terms=data.get("sla_terms"),
        status=data.get("status", "DRAFT"),
        notes=data.get("notes"),
    )


def deserialize_stockroom(json_str: str) -> Stockroom:
    """Deserialize JSON string to Stockroom model."""
    data = json.loads(json_str)
    return Stockroom(
        stockroom_id=uuid.UUID(data["stockroom_id"]),
        name=data["name"],
        stockroom_code=data.get("stockroom_code"),
        location=data.get("location"),
        stockroom_type=StockroomType(data["stockroom_type"]) if data.get("stockroom_type") else None,
        manager_id=uuid.UUID(data["manager_id"]) if data.get("manager_id") else None,
        building=data.get("building"),
        floor=data.get("floor"),
        room=data.get("room"),
        city=data.get("city"),
        country=data.get("country", "USA"),
        capacity_units=data.get("capacity_units"),
        current_utilization=data.get("current_utilization", 0),
        is_active=data.get("is_active", True),
    )


# ============================================================================
# HYPOTHESIS STRATEGIES
# ============================================================================

# Basic type strategies
uuid_strategy = st.uuids()
safe_text_strategy = st.text(
    alphabet=st.characters(whitelist_categories=('L', 'N', 'P', 'S'), 
                           whitelist_characters=' -_'),
    min_size=1, max_size=100
).filter(lambda x: x.strip() != '')

# Decimal strategy for financial values (2 decimal places, positive)
decimal_strategy = st.decimals(
    min_value=Decimal("0.01"),
    max_value=Decimal("9999999.99"),
    places=2,
    allow_nan=False,
    allow_infinity=False
)

# Date strategy (reasonable range)
date_strategy = st.dates(
    min_value=date(2000, 1, 1),
    max_value=date(2100, 12, 31)
)

# Datetime strategy with timezone
datetime_strategy = st.datetimes(
    min_value=datetime(2000, 1, 1),
    max_value=datetime(2100, 12, 31),
    timezones=st.just(timezone.utc)
)

# Positive integer strategy
positive_int_strategy = st.integers(min_value=1, max_value=10000)


@st.composite
def asset_strategy(draw: st.DrawFn) -> Asset:
    """Generate a random Asset instance."""
    return Asset(
        asset_id=draw(uuid_strategy),
        asset_tag=f"AMS-{draw(st.sampled_from(['HW', 'SW', 'EA']))}-{draw(st.integers(1, 99999999)):08d}",
        asset_type=draw(st.sampled_from(list(AssetType))),
        display_name=draw(safe_text_strategy),
        status=draw(st.sampled_from(list(AssetStatus))),
        description=draw(st.one_of(st.none(), safe_text_strategy)),
        substatus=draw(st.one_of(st.none(), safe_text_strategy)),
        created_at=draw(st.one_of(st.none(), datetime_strategy)),
        updated_at=draw(st.one_of(st.none(), datetime_strategy)),
        created_by=draw(st.one_of(st.none(), uuid_strategy)),
        updated_by=draw(st.one_of(st.none(), uuid_strategy)),
    )


@st.composite
def hardware_asset_strategy(draw: st.DrawFn) -> HardwareAsset:
    """Generate a random HardwareAsset instance."""
    return HardwareAsset(
        asset_id=draw(uuid_strategy),
        serial_number=draw(st.one_of(st.none(), safe_text_strategy)),
        manufacturer_id=draw(st.one_of(st.none(), uuid_strategy)),
        model_id=draw(st.one_of(st.none(), uuid_strategy)),
        model_category=draw(st.one_of(st.none(), st.sampled_from(list(ModelCategory)))),
        stockroom_id=draw(st.one_of(st.none(), uuid_strategy)),
        building=draw(st.one_of(st.none(), safe_text_strategy)),
        floor=draw(st.one_of(st.none(), st.text(min_size=1, max_size=10))),
        room=draw(st.one_of(st.none(), safe_text_strategy)),
        rack=draw(st.one_of(st.none(), safe_text_strategy)),
        rack_unit=draw(st.one_of(st.none(), positive_int_strategy)),
        assigned_to=draw(st.one_of(st.none(), uuid_strategy)),
        department_id=draw(st.one_of(st.none(), uuid_strategy)),
        cost_center_id=draw(st.one_of(st.none(), uuid_strategy)),
        managed_by=draw(st.one_of(st.none(), uuid_strategy)),
        purchase_price=draw(st.one_of(st.none(), decimal_strategy)),
        residual_value=draw(st.one_of(st.none(), decimal_strategy)),
        depreciation_method=draw(st.one_of(st.none(), st.sampled_from(list(DepreciationMethod)))),
        depreciation_start_date=draw(st.one_of(st.none(), date_strategy)),
        useful_life_months=draw(st.one_of(st.none(), st.integers(1, 120))),
        cpu=draw(st.one_of(st.none(), safe_text_strategy)),
        memory_gb=draw(st.one_of(st.none(), st.integers(1, 1024))),
        storage_gb=draw(st.one_of(st.none(), st.integers(1, 100000))),
        operating_system=draw(st.one_of(st.none(), safe_text_strategy)),
        ip_address=draw(st.one_of(st.none(), st.ip_addresses(v=4).map(str))),
        mac_address=draw(st.one_of(st.none(), st.from_regex(r'[0-9A-F]{2}(:[0-9A-F]{2}){5}', fullmatch=True))),
        last_discovered_at=draw(st.one_of(st.none(), datetime_strategy)),
        install_date=draw(st.one_of(st.none(), date_strategy)),
        retirement_date=draw(st.one_of(st.none(), date_strategy)),
        disposal_date=draw(st.one_of(st.none(), date_strategy)),
        disposal_method=draw(st.one_of(st.none(), st.sampled_from(['RECYCLED', 'DONATED', 'SOLD', 'DESTROYED']))),
        lease_contract_id=draw(st.one_of(st.none(), uuid_strategy)),
        lease_start_date=draw(st.one_of(st.none(), date_strategy)),
        lease_end_date=draw(st.one_of(st.none(), date_strategy)),
        monthly_lease_cost=draw(st.one_of(st.none(), decimal_strategy)),
    )


@st.composite
def software_product_strategy(draw: st.DrawFn) -> SoftwareProduct:
    """Generate a random SoftwareProduct instance."""
    return SoftwareProduct(
        product_id=draw(uuid_strategy),
        publisher=draw(safe_text_strategy),
        product_name=draw(safe_text_strategy),
        version=draw(st.one_of(st.none(), st.from_regex(r'\d+\.\d+(\.\d+)?', fullmatch=True))),
        edition=draw(st.one_of(st.none(), st.sampled_from(['Standard', 'Professional', 'Enterprise', 'Ultimate']))),
        product_category=draw(st.one_of(st.none(), st.sampled_from(['OPERATING_SYSTEM', 'DATABASE', 'OFFICE_PRODUCTIVITY']))),
        is_saas=draw(st.booleans()),
        normalization_key=draw(st.one_of(st.none(), safe_text_strategy)),
        description=draw(st.one_of(st.none(), safe_text_strategy)),
        end_of_life_date=draw(st.one_of(st.none(), date_strategy)),
        end_of_support_date=draw(st.one_of(st.none(), date_strategy)),
        is_active=draw(st.booleans()),
    )


@st.composite
def entitlement_strategy(draw: st.DrawFn) -> Entitlement:
    """Generate a random Entitlement instance."""
    qty_purchased = draw(st.integers(min_value=1, max_value=10000))
    qty_available = draw(st.integers(min_value=0, max_value=qty_purchased))
    
    return Entitlement(
        entitlement_id=draw(uuid_strategy),
        software_product_id=draw(uuid_strategy),
        license_type=draw(st.sampled_from(list(LicenseType))),
        quantity_purchased=qty_purchased,
        quantity_available=qty_available,
        metric_type=draw(st.sampled_from(list(MetricType))),
        unit_cost=draw(st.one_of(st.none(), decimal_strategy)),
        total_cost=draw(st.one_of(st.none(), decimal_strategy)),
        contract_id=draw(st.one_of(st.none(), uuid_strategy)),
        purchase_order_id=draw(st.one_of(st.none(), uuid_strategy)),
        start_date=draw(st.one_of(st.none(), date_strategy)),
        end_date=draw(st.one_of(st.none(), date_strategy)),
        renewal_date=draw(st.one_of(st.none(), date_strategy)),
        maintenance_included=draw(st.booleans()),
        metric_value=draw(st.one_of(st.none(), positive_int_strategy)),
        license_key=draw(st.one_of(st.none(), safe_text_strategy)),
        notes=draw(st.one_of(st.none(), safe_text_strategy)),
        is_active=draw(st.booleans()),
    )


@st.composite
def contract_strategy(draw: st.DrawFn) -> Contract:
    """Generate a random Contract instance."""
    return Contract(
        contract_id=draw(uuid_strategy),
        contract_number=f"CTR-{draw(st.integers(1, 999999)):06d}",
        vendor_id=draw(st.one_of(st.none(), uuid_strategy)),
        contract_type=draw(st.one_of(st.none(), st.sampled_from(list(ContractType)))),
        contract_name=draw(st.one_of(st.none(), safe_text_strategy)),
        start_date=draw(st.one_of(st.none(), date_strategy)),
        end_date=draw(st.one_of(st.none(), date_strategy)),
        signed_date=draw(st.one_of(st.none(), date_strategy)),
        total_value=draw(st.one_of(st.none(), decimal_strategy)),
        annual_value=draw(st.one_of(st.none(), decimal_strategy)),
        currency=draw(st.sampled_from(['USD', 'EUR', 'GBP', 'CAD'])),
        payment_terms=draw(st.one_of(st.none(), st.sampled_from(['NET30', 'NET60', 'NET90', 'MONTHLY']))),
        renewal_type=draw(st.one_of(st.none(), st.sampled_from(['NONE', 'MANUAL', 'AUTO_RENEW', 'EVERGREEN']))),
        auto_renewal=draw(st.booleans()),
        cancellation_notice_days=draw(st.one_of(st.none(), st.integers(0, 365))),
        sla_terms=draw(st.one_of(st.none(), safe_text_strategy)),
        status=draw(st.sampled_from(['DRAFT', 'ACTIVE', 'EXPIRED', 'TERMINATED'])),
        notes=draw(st.one_of(st.none(), safe_text_strategy)),
    )


@st.composite
def stockroom_strategy(draw: st.DrawFn) -> Stockroom:
    """Generate a random Stockroom instance."""
    return Stockroom(
        stockroom_id=draw(uuid_strategy),
        name=draw(safe_text_strategy),
        stockroom_code=draw(st.one_of(st.none(), st.from_regex(r'[A-Z]{2,4}-[A-Z]{2,4}', fullmatch=True))),
        location=draw(st.one_of(st.none(), safe_text_strategy)),
        stockroom_type=draw(st.one_of(st.none(), st.sampled_from(list(StockroomType)))),
        manager_id=draw(st.one_of(st.none(), uuid_strategy)),
        building=draw(st.one_of(st.none(), safe_text_strategy)),
        floor=draw(st.one_of(st.none(), st.text(min_size=1, max_size=10))),
        room=draw(st.one_of(st.none(), safe_text_strategy)),
        city=draw(st.one_of(st.none(), safe_text_strategy)),
        country=draw(st.sampled_from(['USA', 'Canada', 'UK', 'Germany'])),
        capacity_units=draw(st.one_of(st.none(), positive_int_strategy)),
        current_utilization=draw(st.integers(0, 10000)),
        is_active=draw(st.booleans()),
    )


# ============================================================================
# UNIT TESTS
# ============================================================================

class TestDataModelSerializationUnitTests:
    """Unit tests for data model serialization."""

    def test_asset_serialization_basic(self) -> None:
        """Test basic Asset serialization and deserialization."""
        asset = Asset(
            asset_id=uuid.UUID("12345678-1234-5678-1234-567812345678"),
            asset_tag="AMS-HW-00000001",
            asset_type=AssetType.HARDWARE,
            display_name="Test Laptop",
            status=AssetStatus.DEPLOYED,
            description="A test laptop",
        )
        
        serialized = serialize_model(asset)
        deserialized = deserialize_asset(serialized)
        
        assert deserialized.asset_id == asset.asset_id
        assert deserialized.asset_tag == asset.asset_tag
        assert deserialized.asset_type == asset.asset_type
        assert deserialized.display_name == asset.display_name
        assert deserialized.status == asset.status
        assert deserialized.description == asset.description

    def test_hardware_asset_with_financial_data(self) -> None:
        """Test HardwareAsset with financial attributes preserves precision."""
        hw_asset = HardwareAsset(
            asset_id=uuid.UUID("12345678-1234-5678-1234-567812345678"),
            serial_number="SN123456",
            purchase_price=Decimal("1234.56"),
            residual_value=Decimal("123.45"),
            monthly_lease_cost=Decimal("99.99"),
        )
        
        serialized = serialize_model(hw_asset)
        deserialized = deserialize_hardware_asset(serialized)
        
        assert deserialized.purchase_price == hw_asset.purchase_price
        assert deserialized.residual_value == hw_asset.residual_value
        assert deserialized.monthly_lease_cost == hw_asset.monthly_lease_cost

    def test_software_product_with_dates(self) -> None:
        """Test SoftwareProduct with date fields."""
        product = SoftwareProduct(
            product_id=uuid.UUID("12345678-1234-5678-1234-567812345678"),
            publisher="Microsoft",
            product_name="Office 365",
            version="2023",
            edition="Enterprise",
            is_saas=True,
            end_of_life_date=date(2025, 12, 31),
            end_of_support_date=date(2026, 12, 31),
        )
        
        serialized = serialize_model(product)
        deserialized = deserialize_software_product(serialized)
        
        assert deserialized.product_id == product.product_id
        assert deserialized.publisher == product.publisher
        assert deserialized.product_name == product.product_name
        assert deserialized.end_of_life_date == product.end_of_life_date
        assert deserialized.end_of_support_date == product.end_of_support_date

    def test_entitlement_with_quantities(self) -> None:
        """Test Entitlement quantity constraints are preserved."""
        entitlement = Entitlement(
            entitlement_id=uuid.UUID("12345678-1234-5678-1234-567812345678"),
            software_product_id=uuid.UUID("87654321-4321-8765-4321-876543218765"),
            license_type=LicenseType.SUBSCRIPTION,
            quantity_purchased=100,
            quantity_available=75,
            metric_type=MetricType.PER_USER,
            unit_cost=Decimal("12.99"),
        )
        
        serialized = serialize_model(entitlement)
        deserialized = deserialize_entitlement(serialized)
        
        assert deserialized.quantity_purchased == entitlement.quantity_purchased
        assert deserialized.quantity_available == entitlement.quantity_available
        assert deserialized.quantity_available <= deserialized.quantity_purchased

    def test_contract_with_all_types(self) -> None:
        """Test Contract with various contract types."""
        for contract_type in ContractType:
            contract = Contract(
                contract_id=uuid.uuid4(),
                contract_number=f"CTR-{contract_type.value[:3]}-001",
                contract_type=contract_type,
                total_value=Decimal("50000.00"),
            )
            
            serialized = serialize_model(contract)
            deserialized = deserialize_contract(serialized)
            
            assert deserialized.contract_type == contract_type

    def test_stockroom_with_all_types(self) -> None:
        """Test Stockroom with various stockroom types."""
        for stockroom_type in StockroomType:
            stockroom = Stockroom(
                stockroom_id=uuid.uuid4(),
                name=f"Test {stockroom_type.value} Stockroom",
                stockroom_type=stockroom_type,
            )
            
            serialized = serialize_model(stockroom)
            deserialized = deserialize_stockroom(serialized)
            
            assert deserialized.stockroom_type == stockroom_type


# ============================================================================
# PROPERTY-BASED TESTS
# ============================================================================

@pytest.mark.property
class TestDataModelRoundTripPropertyTests:
    """
    Property-based tests for Data Model Round-Trip Consistency.

    **Property 2: Data Model Round-Trip Consistency**
    **Validates: Requirements 2.1, 2A-2E**

    These tests verify that for any valid data model instance, serialization
    followed by deserialization produces an equivalent object with all fields
    preserved.
    """

    @given(asset=asset_strategy())
    @settings(max_examples=100, deadline=None)
    def test_asset_roundtrip_consistency(self, asset: Asset) -> None:
        """
        Property: Asset objects maintain all attributes through serialization.

        **Validates: Requirements 2.1**

        For any Asset instance, serializing to JSON and deserializing back
        must produce an equivalent object with all fields preserved.
        """
        serialized = serialize_model(asset)
        deserialized = deserialize_asset(serialized)
        
        # Verify all fields are preserved
        assert deserialized.asset_id == asset.asset_id, "asset_id not preserved"
        assert deserialized.asset_tag == asset.asset_tag, "asset_tag not preserved"
        assert deserialized.asset_type == asset.asset_type, "asset_type not preserved"
        assert deserialized.display_name == asset.display_name, "display_name not preserved"
        assert deserialized.status == asset.status, "status not preserved"
        assert deserialized.description == asset.description, "description not preserved"
        assert deserialized.substatus == asset.substatus, "substatus not preserved"
        assert deserialized.created_at == asset.created_at, "created_at not preserved"
        assert deserialized.updated_at == asset.updated_at, "updated_at not preserved"
        assert deserialized.created_by == asset.created_by, "created_by not preserved"
        assert deserialized.updated_by == asset.updated_by, "updated_by not preserved"

    @given(hw_asset=hardware_asset_strategy())
    @settings(max_examples=100, deadline=None)
    def test_hardware_asset_roundtrip_consistency(self, hw_asset: HardwareAsset) -> None:
        """
        Property: Hardware asset subtypes preserve their specific attributes.

        **Validates: Requirements 2A**

        For any HardwareAsset instance, all hardware-specific attributes
        including location, ownership, financial, technical, and lifecycle
        attributes must be preserved through serialization.
        """
        serialized = serialize_model(hw_asset)
        deserialized = deserialize_hardware_asset(serialized)
        
        # Core attributes
        assert deserialized.asset_id == hw_asset.asset_id
        assert deserialized.serial_number == hw_asset.serial_number
        assert deserialized.model_category == hw_asset.model_category
        
        # Location attributes (2A.2)
        assert deserialized.stockroom_id == hw_asset.stockroom_id
        assert deserialized.building == hw_asset.building
        assert deserialized.floor == hw_asset.floor
        assert deserialized.room == hw_asset.room
        assert deserialized.rack == hw_asset.rack
        assert deserialized.rack_unit == hw_asset.rack_unit
        
        # Ownership attributes (2A.3)
        assert deserialized.assigned_to == hw_asset.assigned_to
        assert deserialized.department_id == hw_asset.department_id
        assert deserialized.cost_center_id == hw_asset.cost_center_id
        
        # Financial attributes (2A.4) - verify precision
        assert deserialized.purchase_price == hw_asset.purchase_price
        assert deserialized.residual_value == hw_asset.residual_value
        assert deserialized.depreciation_method == hw_asset.depreciation_method
        assert deserialized.monthly_lease_cost == hw_asset.monthly_lease_cost
        
        # Technical attributes (2A.6)
        assert deserialized.cpu == hw_asset.cpu
        assert deserialized.memory_gb == hw_asset.memory_gb
        assert deserialized.storage_gb == hw_asset.storage_gb
        assert deserialized.ip_address == hw_asset.ip_address
        assert deserialized.mac_address == hw_asset.mac_address

    @given(product=software_product_strategy())
    @settings(max_examples=100, deadline=None)
    def test_software_product_roundtrip_consistency(self, product: SoftwareProduct) -> None:
        """
        Property: Software product attributes are preserved through serialization.

        **Validates: Requirements 2B.1**

        For any SoftwareProduct instance, all attributes including publisher,
        product name, version, edition, and dates must be preserved.
        """
        serialized = serialize_model(product)
        deserialized = deserialize_software_product(serialized)
        
        assert deserialized.product_id == product.product_id
        assert deserialized.publisher == product.publisher
        assert deserialized.product_name == product.product_name
        assert deserialized.version == product.version
        assert deserialized.edition == product.edition
        assert deserialized.product_category == product.product_category
        assert deserialized.is_saas == product.is_saas
        assert deserialized.normalization_key == product.normalization_key
        assert deserialized.end_of_life_date == product.end_of_life_date
        assert deserialized.end_of_support_date == product.end_of_support_date
        assert deserialized.is_active == product.is_active


    @given(entitlement=entitlement_strategy())
    @settings(max_examples=100, deadline=None)
    def test_entitlement_roundtrip_consistency(self, entitlement: Entitlement) -> None:
        """
        Property: Entitlement attributes including quantities are preserved.

        **Validates: Requirements 2B.2, 2B.3, 2B.4**

        For any Entitlement instance, license type, quantities, metric type,
        and financial data must be preserved with correct precision.
        """
        serialized = serialize_model(entitlement)
        deserialized = deserialize_entitlement(serialized)
        
        # Core attributes
        assert deserialized.entitlement_id == entitlement.entitlement_id
        assert deserialized.software_product_id == entitlement.software_product_id
        assert deserialized.license_type == entitlement.license_type
        
        # Quantities (must maintain constraint: available <= purchased)
        assert deserialized.quantity_purchased == entitlement.quantity_purchased
        assert deserialized.quantity_available == entitlement.quantity_available
        assert deserialized.quantity_available <= deserialized.quantity_purchased
        
        # Metric attributes (2B.4)
        assert deserialized.metric_type == entitlement.metric_type
        assert deserialized.metric_value == entitlement.metric_value
        
        # Financial data with precision
        assert deserialized.unit_cost == entitlement.unit_cost
        assert deserialized.total_cost == entitlement.total_cost
        
        # Contract attributes (2B.3)
        assert deserialized.contract_id == entitlement.contract_id
        assert deserialized.start_date == entitlement.start_date
        assert deserialized.end_date == entitlement.end_date
        assert deserialized.maintenance_included == entitlement.maintenance_included

    @given(contract=contract_strategy())
    @settings(max_examples=100, deadline=None)
    def test_contract_roundtrip_consistency(self, contract: Contract) -> None:
        """
        Property: Contract attributes including financial data are preserved.

        **Validates: Requirements 2D.1, 2D.2, 2D.3**

        For any Contract instance, all attributes including contract type,
        dates, financial values, and terms must be preserved.
        """
        serialized = serialize_model(contract)
        deserialized = deserialize_contract(serialized)
        
        # Core attributes (2D.1)
        assert deserialized.contract_id == contract.contract_id
        assert deserialized.contract_number == contract.contract_number
        assert deserialized.vendor_id == contract.vendor_id
        assert deserialized.contract_type == contract.contract_type
        
        # Dates
        assert deserialized.start_date == contract.start_date
        assert deserialized.end_date == contract.end_date
        assert deserialized.signed_date == contract.signed_date
        
        # Financial data with precision
        assert deserialized.total_value == contract.total_value
        assert deserialized.annual_value == contract.annual_value
        assert deserialized.currency == contract.currency
        
        # Terms (2D.2)
        assert deserialized.payment_terms == contract.payment_terms
        assert deserialized.renewal_type == contract.renewal_type
        assert deserialized.auto_renewal == contract.auto_renewal
        assert deserialized.cancellation_notice_days == contract.cancellation_notice_days
        assert deserialized.sla_terms == contract.sla_terms

    @given(stockroom=stockroom_strategy())
    @settings(max_examples=100, deadline=None)
    def test_stockroom_roundtrip_consistency(self, stockroom: Stockroom) -> None:
        """
        Property: Stockroom attributes are preserved through serialization.

        **Validates: Requirements 2E.1**

        For any Stockroom instance, all attributes including type, location,
        and capacity must be preserved.
        """
        serialized = serialize_model(stockroom)
        deserialized = deserialize_stockroom(serialized)
        
        # Core attributes (2E.1)
        assert deserialized.stockroom_id == stockroom.stockroom_id
        assert deserialized.name == stockroom.name
        assert deserialized.stockroom_code == stockroom.stockroom_code
        assert deserialized.location == stockroom.location
        assert deserialized.stockroom_type == stockroom.stockroom_type
        assert deserialized.manager_id == stockroom.manager_id
        
        # Location details
        assert deserialized.building == stockroom.building
        assert deserialized.floor == stockroom.floor
        assert deserialized.room == stockroom.room
        assert deserialized.city == stockroom.city
        assert deserialized.country == stockroom.country
        
        # Capacity
        assert deserialized.capacity_units == stockroom.capacity_units
        assert deserialized.current_utilization == stockroom.current_utilization
        assert deserialized.is_active == stockroom.is_active


    @given(asset=asset_strategy())
    @settings(max_examples=50, deadline=None)
    def test_enum_values_are_validated(self, asset: Asset) -> None:
        """
        Property: Enum values are properly validated during deserialization.

        **Validates: Requirements 2.1**

        All enum fields (asset_type, status) must be valid enum values
        after deserialization.
        """
        serialized = serialize_model(asset)
        deserialized = deserialize_asset(serialized)
        
        # Verify enum values are valid
        assert isinstance(deserialized.asset_type, AssetType)
        assert isinstance(deserialized.status, AssetStatus)
        assert deserialized.asset_type.value in [e.value for e in AssetType]
        assert deserialized.status.value in [e.value for e in AssetStatus]

    @given(hw_asset=hardware_asset_strategy())
    @settings(max_examples=50, deadline=None)
    def test_uuid_fields_preserved(self, hw_asset: HardwareAsset) -> None:
        """
        Property: UUID fields are properly serialized/deserialized.

        **Validates: Requirements 2.1, 2A**

        All UUID fields must be preserved exactly through serialization,
        maintaining their format and value.
        """
        serialized = serialize_model(hw_asset)
        deserialized = deserialize_hardware_asset(serialized)
        
        # All UUID fields must be preserved
        assert deserialized.asset_id == hw_asset.asset_id
        assert deserialized.manufacturer_id == hw_asset.manufacturer_id
        assert deserialized.model_id == hw_asset.model_id
        assert deserialized.stockroom_id == hw_asset.stockroom_id
        assert deserialized.assigned_to == hw_asset.assigned_to
        assert deserialized.department_id == hw_asset.department_id
        assert deserialized.cost_center_id == hw_asset.cost_center_id
        assert deserialized.lease_contract_id == hw_asset.lease_contract_id

    @given(hw_asset=hardware_asset_strategy())
    @settings(max_examples=50, deadline=None)
    def test_date_time_fields_preserved(self, hw_asset: HardwareAsset) -> None:
        """
        Property: Date/time fields are handled correctly.

        **Validates: Requirements 2A**

        All date and datetime fields must be preserved exactly through
        serialization, including timezone information.
        """
        serialized = serialize_model(hw_asset)
        deserialized = deserialize_hardware_asset(serialized)
        
        # Date fields
        assert deserialized.depreciation_start_date == hw_asset.depreciation_start_date
        assert deserialized.install_date == hw_asset.install_date
        assert deserialized.retirement_date == hw_asset.retirement_date
        assert deserialized.disposal_date == hw_asset.disposal_date
        assert deserialized.lease_start_date == hw_asset.lease_start_date
        assert deserialized.lease_end_date == hw_asset.lease_end_date
        
        # Datetime fields
        assert deserialized.last_discovered_at == hw_asset.last_discovered_at

    @given(entitlement=entitlement_strategy())
    @settings(max_examples=50, deadline=None)
    def test_financial_precision_maintained(self, entitlement: Entitlement) -> None:
        """
        Property: Financial data (prices, costs) maintain precision.

        **Validates: Requirements 2B.2, 2D**

        Decimal financial values must maintain their exact precision
        through serialization (no floating point errors).
        """
        serialized = serialize_model(entitlement)
        deserialized = deserialize_entitlement(serialized)
        
        # Financial fields must maintain exact precision
        if entitlement.unit_cost is not None:
            assert deserialized.unit_cost == entitlement.unit_cost
            # Verify it's still a Decimal, not a float
            assert isinstance(deserialized.unit_cost, Decimal)
        
        if entitlement.total_cost is not None:
            assert deserialized.total_cost == entitlement.total_cost
            assert isinstance(deserialized.total_cost, Decimal)

    @given(asset=asset_strategy())
    @settings(max_examples=50, deadline=None)
    def test_double_roundtrip_consistency(self, asset: Asset) -> None:
        """
        Property: Double round-trip produces identical results.

        **Validates: Requirements 2.1**

        Serializing and deserializing twice must produce the same result
        as doing it once (idempotent operation).
        """
        # First round-trip
        serialized1 = serialize_model(asset)
        deserialized1 = deserialize_asset(serialized1)
        
        # Second round-trip
        serialized2 = serialize_model(deserialized1)
        deserialized2 = deserialize_asset(serialized2)
        
        # Results must be identical
        assert serialized1 == serialized2
        assert deserialized1.asset_id == deserialized2.asset_id
        assert deserialized1.asset_tag == deserialized2.asset_tag
        assert deserialized1.asset_type == deserialized2.asset_type
        assert deserialized1.display_name == deserialized2.display_name
        assert deserialized1.status == deserialized2.status


class TestDataModelConstraintsPropertyTests:
    """
    Property-based tests for data model constraints.

    **Property 2: Data Model Round-Trip Consistency**
    **Validates: Requirements 2.1, 2A-2E**

    These tests verify that data model constraints are maintained
    through serialization/deserialization.
    """

    @given(entitlement=entitlement_strategy())
    @settings(max_examples=50, deadline=None)
    def test_quantity_constraint_preserved(self, entitlement: Entitlement) -> None:
        """
        Property: Quantity constraints are preserved.

        **Validates: Requirements 2B.2**

        The constraint quantity_available <= quantity_purchased must
        be maintained through serialization.
        """
        serialized = serialize_model(entitlement)
        deserialized = deserialize_entitlement(serialized)
        
        # Constraint must be preserved
        assert deserialized.quantity_available <= deserialized.quantity_purchased, (
            f"Constraint violated: available ({deserialized.quantity_available}) > "
            f"purchased ({deserialized.quantity_purchased})"
        )

    @given(asset=asset_strategy())
    @settings(max_examples=50, deadline=None)
    def test_asset_tag_format_preserved(self, asset: Asset) -> None:
        """
        Property: Asset tag format is preserved.

        **Validates: Requirements 2.6**

        Asset tags must maintain their format (AMS-{TYPE}-{SEQUENCE})
        through serialization.
        """
        serialized = serialize_model(asset)
        deserialized = deserialize_asset(serialized)
        
        # Asset tag must be preserved exactly
        assert deserialized.asset_tag == asset.asset_tag
        
        # Verify format is maintained
        assert deserialized.asset_tag.startswith("AMS-")
        parts = deserialized.asset_tag.split("-")
        assert len(parts) == 3
        assert parts[1] in ["HW", "SW", "EA"]

    @given(stockroom=stockroom_strategy())
    @settings(max_examples=50, deadline=None)
    def test_stockroom_utilization_non_negative(self, stockroom: Stockroom) -> None:
        """
        Property: Stockroom utilization remains non-negative.

        **Validates: Requirements 2E.1**

        Current utilization must be non-negative after deserialization.
        """
        serialized = serialize_model(stockroom)
        deserialized = deserialize_stockroom(serialized)
        
        assert deserialized.current_utilization >= 0, (
            f"Utilization must be non-negative, got {deserialized.current_utilization}"
        )


class TestDataModelEdgeCases:
    """
    Edge case tests for data model serialization.

    **Property 2: Data Model Round-Trip Consistency**
    **Validates: Requirements 2.1, 2A-2E**
    """

    def test_asset_with_all_none_optional_fields(self) -> None:
        """Test Asset with all optional fields set to None."""
        asset = Asset(
            asset_id=uuid.uuid4(),
            asset_tag="AMS-HW-00000001",
            asset_type=AssetType.HARDWARE,
            display_name="Minimal Asset",
            status=AssetStatus.ORDERED,
        )
        
        serialized = serialize_model(asset)
        deserialized = deserialize_asset(serialized)
        
        assert deserialized.description is None
        assert deserialized.substatus is None
        assert deserialized.created_at is None
        assert deserialized.updated_at is None
        assert deserialized.created_by is None
        assert deserialized.updated_by is None

    def test_hardware_asset_with_all_fields_populated(self) -> None:
        """Test HardwareAsset with all fields populated."""
        hw_asset = HardwareAsset(
            asset_id=uuid.uuid4(),
            serial_number="SN-FULL-TEST",
            manufacturer_id=uuid.uuid4(),
            model_id=uuid.uuid4(),
            model_category=ModelCategory.LAPTOP,
            stockroom_id=uuid.uuid4(),
            building="Building A",
            floor="3",
            room="301",
            rack="R1",
            rack_unit=5,
            assigned_to=uuid.uuid4(),
            department_id=uuid.uuid4(),
            cost_center_id=uuid.uuid4(),
            managed_by=uuid.uuid4(),
            purchase_price=Decimal("1500.00"),
            residual_value=Decimal("150.00"),
            depreciation_method=DepreciationMethod.STRAIGHT_LINE,
            depreciation_start_date=date(2024, 1, 1),
            useful_life_months=36,
            cpu="Intel Core i7",
            memory_gb=16,
            storage_gb=512,
            operating_system="Windows 11",
            ip_address="192.168.1.100",
            mac_address="AA:BB:CC:DD:EE:FF",
            last_discovered_at=datetime(2024, 6, 15, 10, 30, 0, tzinfo=timezone.utc),
            install_date=date(2024, 1, 15),
            lease_contract_id=uuid.uuid4(),
            lease_start_date=date(2024, 1, 1),
            lease_end_date=date(2027, 1, 1),
            monthly_lease_cost=Decimal("50.00"),
        )
        
        serialized = serialize_model(hw_asset)
        deserialized = deserialize_hardware_asset(serialized)
        
        # Verify all fields are preserved
        assert deserialized.serial_number == hw_asset.serial_number
        assert deserialized.model_category == hw_asset.model_category
        assert deserialized.building == hw_asset.building
        assert deserialized.purchase_price == hw_asset.purchase_price
        assert deserialized.cpu == hw_asset.cpu
        assert deserialized.memory_gb == hw_asset.memory_gb
        assert deserialized.ip_address == hw_asset.ip_address
        assert deserialized.mac_address == hw_asset.mac_address

    def test_decimal_precision_edge_cases(self) -> None:
        """Test Decimal precision with edge case values."""
        test_values = [
            Decimal("0.01"),
            Decimal("0.99"),
            Decimal("999999.99"),
            Decimal("1234567.89"),
        ]
        
        for value in test_values:
            entitlement = Entitlement(
                entitlement_id=uuid.uuid4(),
                software_product_id=uuid.uuid4(),
                license_type=LicenseType.PERPETUAL,
                quantity_purchased=1,
                quantity_available=1,
                metric_type=MetricType.PER_USER,
                unit_cost=value,
            )
            
            serialized = serialize_model(entitlement)
            deserialized = deserialize_entitlement(serialized)
            
            assert deserialized.unit_cost == value, (
                f"Decimal precision lost: expected {value}, got {deserialized.unit_cost}"
            )

    def test_special_characters_in_text_fields(self) -> None:
        """Test text fields with special characters."""
        asset = Asset(
            asset_id=uuid.uuid4(),
            asset_tag="AMS-HW-00000001",
            asset_type=AssetType.HARDWARE,
            display_name="Test Asset with 'quotes' and \"double quotes\"",
            status=AssetStatus.DEPLOYED,
            description="Description with special chars: <>&",
        )
        
        serialized = serialize_model(asset)
        deserialized = deserialize_asset(serialized)
        
        assert deserialized.display_name == asset.display_name
        assert deserialized.description == asset.description
