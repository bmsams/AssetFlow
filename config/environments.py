"""
Environment configuration for Asset Management System.

This module defines environment-specific configurations following AWS
Well-Architected Framework principles for multi-account deployment strategy.

Environments:
- Development (dev): Lower costs, relaxed security for rapid iteration
- Staging (staging): Production-like for validation testing
- Production (prod): Full security, high availability, disaster recovery
"""

from dataclasses import dataclass, field
from typing import Literal

EnvironmentName = Literal["dev", "staging", "prod"]


@dataclass(frozen=True)
class VpcConfig:
    """VPC configuration settings."""
    
    cidr: str = "10.0.0.0/16"
    max_azs: int = 3
    nat_gateways: int = 2
    enable_dns_hostnames: bool = True
    enable_dns_support: bool = True


@dataclass(frozen=True)
class DatabaseConfig:
    """Aurora PostgreSQL database configuration."""
    
    min_acu_capacity: float = 0.5
    max_acu_capacity: float = 16.0
    backup_retention_days: int = 30
    deletion_protection: bool = True
    enable_performance_insights: bool = True
    preferred_backup_window: str = "03:00-04:00"
    preferred_maintenance_window: str = "sun:04:00-sun:05:00"


@dataclass(frozen=True)
class CacheConfig:
    """ElastiCache Redis configuration."""
    
    node_type: str = "cache.r6g.large"
    num_cache_clusters: int = 2
    automatic_failover_enabled: bool = True
    multi_az_enabled: bool = True
    snapshot_retention_limit: int = 7
    snapshot_window: str = "05:00-06:00"
    maintenance_window: str = "sun:06:00-sun:07:00"


@dataclass(frozen=True)
class ApiConfig:
    """API Gateway configuration."""
    
    throttling_rate_limit: int = 1000
    throttling_burst_limit: int = 2000
    waf_rate_limit: int = 2000
    enable_xray_tracing: bool = True
    enable_access_logging: bool = True


@dataclass(frozen=True)
class MonitoringConfig:
    """CloudWatch monitoring configuration."""
    
    log_retention_days: int = 30
    enable_detailed_monitoring: bool = True
    alarm_evaluation_periods: int = 3
    alarm_datapoints_to_alarm: int = 2


@dataclass(frozen=True)
class StorageConfig:
    """S3 storage configuration."""
    
    # Versioning settings
    enable_versioning_documents: bool = True
    enable_versioning_attachments: bool = True
    enable_versioning_static_assets: bool = False
    
    # Lifecycle settings (days)
    transition_to_ia_days: int = 30
    transition_to_glacier_days: int = 90
    noncurrent_version_expiration_days: int = 90
    abort_incomplete_multipart_days: int = 7
    
    # CORS settings
    enable_cors: bool = True
    cors_allowed_origins: tuple[str, ...] = ("*",)  # Override in prod
    cors_max_age_seconds: int = 3600
    
    # Encryption settings
    use_kms_encryption: bool = True


@dataclass(frozen=True)
class FrontendConfig:
    """CloudFront frontend configuration."""
    
    # Cache TTL settings (seconds)
    default_ttl_seconds: int = 86400  # 1 day
    max_ttl_seconds: int = 31536000  # 1 year
    min_ttl_seconds: int = 0
    
    # Static assets cache TTL (longer for versioned assets)
    static_assets_ttl_seconds: int = 31536000  # 1 year
    
    # Security settings
    minimum_protocol_version: str = "TLSv1.2_2021"
    enable_ipv6: bool = True
    
    # Geo-restriction (empty tuple means no restriction)
    geo_restriction_locations: tuple[str, ...] = ()  # e.g., ("US", "CA", "GB")
    geo_restriction_type: str = "none"  # "whitelist", "blacklist", or "none"
    
    # Price class
    price_class: str = "PriceClass_100"  # US, Canada, Europe
    
    # Error page settings
    custom_error_response_page_path: str = "/index.html"
    error_caching_min_ttl_seconds: int = 300  # 5 minutes
    
    # Logging
    enable_access_logging: bool = True


@dataclass(frozen=True)
class AuthConfig:
    """Cognito authentication configuration."""
    
    # MFA configuration
    mfa_required: bool = False  # Optional for dev, required for prod
    mfa_second_factor: str = "TOTP"  # TOTP or SMS
    
    # Password policy
    password_min_length: int = 12
    require_lowercase: bool = True
    require_uppercase: bool = True
    require_digits: bool = True
    require_symbols: bool = True
    temp_password_validity_days: int = 7
    
    # Token validity
    access_token_validity_minutes: int = 60
    id_token_validity_minutes: int = 60
    refresh_token_validity_days: int = 30
    
    # Self-service configuration
    self_sign_up_enabled: bool = True
    auto_verify_email: bool = True
    
    # Account recovery
    account_recovery_email: bool = True


@dataclass(frozen=True)
class EnvironmentConfig:
    """
    Complete environment configuration for Asset Management System.
    
    This configuration class encapsulates all environment-specific settings
    needed to deploy the infrastructure. It follows the principle of
    immutable configuration to prevent runtime modifications.
    """
    
    # Environment identification
    environment_name: EnvironmentName
    aws_account_id: str
    aws_region: str
    
    # Cost allocation
    cost_center: str = "asset-management"
    
    # Component configurations
    vpc: VpcConfig = field(default_factory=VpcConfig)
    database: DatabaseConfig = field(default_factory=DatabaseConfig)
    cache: CacheConfig = field(default_factory=CacheConfig)
    api: ApiConfig = field(default_factory=ApiConfig)
    monitoring: MonitoringConfig = field(default_factory=MonitoringConfig)
    auth: AuthConfig = field(default_factory=AuthConfig)
    storage: StorageConfig = field(default_factory=StorageConfig)
    frontend: FrontendConfig = field(default_factory=FrontendConfig)
    
    # Feature flags
    enable_waf: bool = True
    enable_deletion_protection: bool = True
    enable_multi_az: bool = True
    
    @property
    def is_production(self) -> bool:
        """Check if this is a production environment."""
        return self.environment_name == "prod"
    
    @property
    def stack_prefix(self) -> str:
        """Get the prefix for stack names."""
        return f"ams-{self.environment_name}"


# Development environment configuration
DevEnvironmentConfig = EnvironmentConfig(
    environment_name="dev",
    aws_account_id="764184373468",  # Actual dev account ID
    aws_region="us-east-1",
    cost_center="asset-management-dev",
    vpc=VpcConfig(
        max_azs=2,  # Reduced for cost savings
        nat_gateways=1,  # Single NAT for dev
    ),
    database=DatabaseConfig(
        min_acu_capacity=0.5,
        max_acu_capacity=4.0,  # Lower max for dev
        backup_retention_days=7,
        deletion_protection=False,  # Allow deletion in dev
    ),
    cache=CacheConfig(
        node_type="cache.t3.medium",  # Smaller instance for dev
        num_cache_clusters=1,  # Single node for dev
        automatic_failover_enabled=False,
        multi_az_enabled=False,
        snapshot_retention_limit=1,
    ),
    api=ApiConfig(
        throttling_rate_limit=100,  # Lower limits for dev
        throttling_burst_limit=200,
        waf_rate_limit=500,
    ),
    monitoring=MonitoringConfig(
        log_retention_days=7,  # Shorter retention for dev
        enable_detailed_monitoring=False,
    ),
    auth=AuthConfig(
        mfa_required=False,  # Optional MFA for dev
        password_min_length=8,  # Relaxed for dev
        temp_password_validity_days=7,
        self_sign_up_enabled=True,
    ),
    storage=StorageConfig(
        enable_versioning_documents=True,
        enable_versioning_attachments=True,
        enable_versioning_static_assets=False,
        transition_to_ia_days=30,
        noncurrent_version_expiration_days=30,  # Shorter for dev
        use_kms_encryption=False,  # Use S3-managed encryption for dev
    ),
    frontend=FrontendConfig(
        default_ttl_seconds=3600,  # 1 hour for dev (faster iteration)
        max_ttl_seconds=86400,  # 1 day max for dev
        min_ttl_seconds=0,
        static_assets_ttl_seconds=3600,  # 1 hour for dev
        price_class="PriceClass_100",  # US, Canada, Europe only
        enable_access_logging=False,  # Disable logging for dev
    ),
    enable_waf=True,
    enable_deletion_protection=False,
    enable_multi_az=False,
)


# Staging environment configuration
StagingEnvironmentConfig = EnvironmentConfig(
    environment_name="staging",
    aws_account_id="234567890123",  # Replace with actual staging account ID
    aws_region="us-east-1",
    cost_center="asset-management-staging",
    vpc=VpcConfig(
        max_azs=3,
        nat_gateways=2,
    ),
    database=DatabaseConfig(
        min_acu_capacity=0.5,
        max_acu_capacity=8.0,  # Medium capacity for staging
        backup_retention_days=14,
        deletion_protection=True,
    ),
    cache=CacheConfig(
        node_type="cache.r6g.medium",  # Medium instance for staging
        num_cache_clusters=2,
        automatic_failover_enabled=True,
        multi_az_enabled=True,
        snapshot_retention_limit=3,
    ),
    api=ApiConfig(
        throttling_rate_limit=500,
        throttling_burst_limit=1000,
        waf_rate_limit=1000,
    ),
    monitoring=MonitoringConfig(
        log_retention_days=14,
        enable_detailed_monitoring=True,
    ),
    auth=AuthConfig(
        mfa_required=False,  # Optional MFA for staging
        password_min_length=12,
        temp_password_validity_days=7,
        self_sign_up_enabled=True,
    ),
    storage=StorageConfig(
        enable_versioning_documents=True,
        enable_versioning_attachments=True,
        enable_versioning_static_assets=False,
        transition_to_ia_days=30,
        transition_to_glacier_days=90,
        noncurrent_version_expiration_days=60,
        use_kms_encryption=True,
    ),
    frontend=FrontendConfig(
        default_ttl_seconds=86400,  # 1 day for staging
        max_ttl_seconds=604800,  # 1 week max for staging
        min_ttl_seconds=0,
        static_assets_ttl_seconds=604800,  # 1 week for staging
        price_class="PriceClass_100",  # US, Canada, Europe only
        enable_access_logging=True,
    ),
    enable_waf=True,
    enable_deletion_protection=True,
    enable_multi_az=True,
)


# Production environment configuration
ProductionEnvironmentConfig = EnvironmentConfig(
    environment_name="prod",
    aws_account_id="345678901234",  # Replace with actual prod account ID
    aws_region="us-east-1",
    cost_center="asset-management-prod",
    vpc=VpcConfig(
        max_azs=3,
        nat_gateways=3,  # NAT per AZ for high availability
    ),
    database=DatabaseConfig(
        min_acu_capacity=0.5,
        max_acu_capacity=16.0,  # Full capacity for production
        backup_retention_days=30,
        deletion_protection=True,
        enable_performance_insights=True,
    ),
    cache=CacheConfig(
        node_type="cache.r6g.large",
        num_cache_clusters=3,  # Primary + 2 replicas
        automatic_failover_enabled=True,
        multi_az_enabled=True,
        snapshot_retention_limit=7,
    ),
    api=ApiConfig(
        throttling_rate_limit=1000,
        throttling_burst_limit=2000,
        waf_rate_limit=2000,
        enable_xray_tracing=True,
        enable_access_logging=True,
    ),
    monitoring=MonitoringConfig(
        log_retention_days=90,  # Longer retention for compliance
        enable_detailed_monitoring=True,
        alarm_evaluation_periods=3,
        alarm_datapoints_to_alarm=2,
    ),
    auth=AuthConfig(
        mfa_required=True,  # Required MFA for production
        password_min_length=14,  # Stronger password policy
        require_lowercase=True,
        require_uppercase=True,
        require_digits=True,
        require_symbols=True,
        temp_password_validity_days=3,  # Shorter temp password validity
        access_token_validity_minutes=30,  # Shorter token validity
        id_token_validity_minutes=30,
        refresh_token_validity_days=7,
        self_sign_up_enabled=False,  # Disable self-signup in prod
    ),
    storage=StorageConfig(
        enable_versioning_documents=True,
        enable_versioning_attachments=True,
        enable_versioning_static_assets=False,
        transition_to_ia_days=30,
        transition_to_glacier_days=90,
        noncurrent_version_expiration_days=90,
        use_kms_encryption=True,
        cors_allowed_origins=("https://assets.example.com",),  # Restrict in prod
    ),
    frontend=FrontendConfig(
        default_ttl_seconds=86400,  # 1 day for production
        max_ttl_seconds=31536000,  # 1 year max for production
        min_ttl_seconds=0,
        static_assets_ttl_seconds=31536000,  # 1 year for versioned assets
        price_class="PriceClass_All",  # All edge locations for production
        enable_access_logging=True,
        geo_restriction_type="none",  # Can be configured for compliance
    ),
    enable_waf=True,
    enable_deletion_protection=True,
    enable_multi_az=True,
)


# Environment configuration registry
_ENVIRONMENT_CONFIGS: dict[EnvironmentName, EnvironmentConfig] = {
    "dev": DevEnvironmentConfig,
    "staging": StagingEnvironmentConfig,
    "prod": ProductionEnvironmentConfig,
}


def get_environment_config(env_name: str) -> EnvironmentConfig:
    """
    Get the configuration for a specific environment.
    
    Args:
        env_name: The environment name ('dev', 'staging', or 'prod')
        
    Returns:
        EnvironmentConfig: The configuration for the specified environment
        
    Raises:
        ValueError: If the environment name is not recognized
    """
    if env_name not in _ENVIRONMENT_CONFIGS:
        valid_envs = ", ".join(_ENVIRONMENT_CONFIGS.keys())
        raise ValueError(
            f"Unknown environment: '{env_name}'. Valid environments are: {valid_envs}"
        )
    
    return _ENVIRONMENT_CONFIGS[env_name]
