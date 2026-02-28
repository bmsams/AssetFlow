"""
Unit tests and Property-based tests for StorageStack.

These tests verify that the StorageStack creates the expected
S3 bucket infrastructure with proper configuration following AWS
Well-Architected Framework principles.

**Validates: Requirements 1.7**
"""

import pytest
import aws_cdk as cdk
from aws_cdk import assertions
from hypothesis import given, settings, strategies as st
from dataclasses import replace

from stacks.storage_stack import StorageStack
from config.environments import (
    DevEnvironmentConfig,
    StagingEnvironmentConfig,
    ProductionEnvironmentConfig,
    EnvironmentConfig,
    StorageConfig,
)


class TestStorageStackUnitTests:
    """Unit tests for StorageStack."""

    def test_documents_bucket_created(self, app: cdk.App, cdk_env: cdk.Environment) -> None:
        """Test that a documents bucket is created."""
        stack = StorageStack(
            app,
            "TestStorageStack",
            config=DevEnvironmentConfig,
            env=cdk_env,
        )

        template = assertions.Template.from_stack(stack)

        # Verify 2 S3 buckets are created (documents, attachments)
        # Note: Frontend static assets are managed by FrontendStack
        template.resource_count_is("AWS::S3::Bucket", 2)

    def test_buckets_have_encryption(self, app: cdk.App, cdk_env: cdk.Environment) -> None:
        """Test that all buckets have encryption enabled."""
        stack = StorageStack(
            app,
            "TestStorageStack",
            config=DevEnvironmentConfig,
            env=cdk_env,
        )

        template = assertions.Template.from_stack(stack)

        # All buckets should have encryption configuration
        # Dev uses S3-managed encryption (SSE-S3)
        buckets = template.find_resources("AWS::S3::Bucket")
        for bucket_id, bucket_props in buckets.items():
            props = bucket_props.get("Properties", {})
            encryption_config = props.get("BucketEncryption", {})
            assert encryption_config, f"Bucket {bucket_id} should have encryption"

    def test_documents_bucket_versioned(self, app: cdk.App, cdk_env: cdk.Environment) -> None:
        """Test that documents bucket has versioning enabled."""
        stack = StorageStack(
            app,
            "TestStorageStack",
            config=DevEnvironmentConfig,
            env=cdk_env,
        )

        template = assertions.Template.from_stack(stack)

        # Find buckets with versioning enabled
        template.has_resource_properties(
            "AWS::S3::Bucket",
            {
                "VersioningConfiguration": {
                    "Status": "Enabled"
                }
            }
        )

    def test_buckets_block_public_access(self, app: cdk.App, cdk_env: cdk.Environment) -> None:
        """Test that all buckets block public access."""
        stack = StorageStack(
            app,
            "TestStorageStack",
            config=DevEnvironmentConfig,
            env=cdk_env,
        )

        template = assertions.Template.from_stack(stack)

        # All buckets should block public access
        template.has_resource_properties(
            "AWS::S3::Bucket",
            {
                "PublicAccessBlockConfiguration": {
                    "BlockPublicAcls": True,
                    "BlockPublicPolicy": True,
                    "IgnorePublicAcls": True,
                    "RestrictPublicBuckets": True,
                }
            }
        )

    def test_buckets_enforce_ssl(self, app: cdk.App, cdk_env: cdk.Environment) -> None:
        """Test that buckets enforce SSL for data in transit."""
        stack = StorageStack(
            app,
            "TestStorageStack",
            config=DevEnvironmentConfig,
            env=cdk_env,
        )

        template = assertions.Template.from_stack(stack)

        # Buckets should have bucket policies that enforce SSL
        # The SecureBucket construct sets enforce_ssl=True
        policies = template.find_resources("AWS::S3::BucketPolicy")
        assert len(policies) >= 2, "All buckets should have policies"

    def test_lifecycle_rules_configured(self, app: cdk.App, cdk_env: cdk.Environment) -> None:
        """Test that lifecycle rules are configured on buckets."""
        stack = StorageStack(
            app,
            "TestStorageStack",
            config=DevEnvironmentConfig,
            env=cdk_env,
        )

        template = assertions.Template.from_stack(stack)

        # Buckets should have lifecycle configuration
        template.has_resource_properties(
            "AWS::S3::Bucket",
            {
                "LifecycleConfiguration": {
                    "Rules": assertions.Match.any_value()
                }
            }
        )

    def test_cors_configured_when_enabled(self, app: cdk.App, cdk_env: cdk.Environment) -> None:
        """Test that CORS is configured when enabled."""
        stack = StorageStack(
            app,
            "TestStorageStack",
            config=DevEnvironmentConfig,
            env=cdk_env,
        )

        template = assertions.Template.from_stack(stack)

        # Buckets should have CORS configuration
        template.has_resource_properties(
            "AWS::S3::Bucket",
            {
                "CorsConfiguration": {
                    "CorsRules": assertions.Match.any_value()
                }
            }
        )

    def test_outputs_created(self, app: cdk.App, cdk_env: cdk.Environment) -> None:
        """Test that CloudFormation outputs are created."""
        stack = StorageStack(
            app,
            "TestStorageStack",
            config=DevEnvironmentConfig,
            env=cdk_env,
        )

        template = assertions.Template.from_stack(stack)

        # Verify outputs exist for bucket names and ARNs
        outputs = template.find_outputs("*")
        # Should have at least 4 outputs (name + ARN for each of 2 buckets)
        assert len(outputs) >= 4

    def test_production_uses_kms_encryption(self, app: cdk.App) -> None:
        """Test that production environment uses KMS encryption."""
        prod_env = cdk.Environment(
            account=ProductionEnvironmentConfig.aws_account_id,
            region=ProductionEnvironmentConfig.aws_region,
        )

        stack = StorageStack(
            app,
            "TestProdStorageStack",
            config=ProductionEnvironmentConfig,
            env=prod_env,
        )

        template = assertions.Template.from_stack(stack)

        # Production should create a KMS key
        template.resource_count_is("AWS::KMS::Key", 1)

        # Verify KMS key has rotation enabled
        template.has_resource_properties(
            "AWS::KMS::Key",
            {
                "EnableKeyRotation": True
            }
        )

    def test_dev_uses_s3_managed_encryption(self, app: cdk.App, cdk_env: cdk.Environment) -> None:
        """Test that dev environment uses S3-managed encryption."""
        stack = StorageStack(
            app,
            "TestStorageStack",
            config=DevEnvironmentConfig,
            env=cdk_env,
        )

        template = assertions.Template.from_stack(stack)

        # Dev should not create a KMS key (uses S3-managed encryption)
        template.resource_count_is("AWS::KMS::Key", 0)

    def test_production_retains_buckets(self, app: cdk.App) -> None:
        """Test that production buckets have RETAIN removal policy."""
        prod_env = cdk.Environment(
            account=ProductionEnvironmentConfig.aws_account_id,
            region=ProductionEnvironmentConfig.aws_region,
        )

        stack = StorageStack(
            app,
            "TestProdStorageStack",
            config=ProductionEnvironmentConfig,
            env=prod_env,
        )

        template = assertions.Template.from_stack(stack)

        # Production buckets should have Retain deletion policy
        buckets = template.find_resources("AWS::S3::Bucket")
        for bucket_id, bucket_props in buckets.items():
            deletion_policy = bucket_props.get("DeletionPolicy")
            assert deletion_policy == "Retain", f"Bucket {bucket_id} should have Retain policy"

    def test_dev_allows_bucket_deletion(self, app: cdk.App, cdk_env: cdk.Environment) -> None:
        """Test that dev buckets can be deleted."""
        stack = StorageStack(
            app,
            "TestStorageStack",
            config=DevEnvironmentConfig,
            env=cdk_env,
        )

        template = assertions.Template.from_stack(stack)

        # Dev buckets should have Delete deletion policy
        buckets = template.find_resources("AWS::S3::Bucket")
        for bucket_id, bucket_props in buckets.items():
            deletion_policy = bucket_props.get("DeletionPolicy")
            assert deletion_policy == "Delete", f"Bucket {bucket_id} should have Delete policy"

    def test_bucket_properties_exposed(self, app: cdk.App, cdk_env: cdk.Environment) -> None:
        """Test that bucket properties are exposed correctly."""
        stack = StorageStack(
            app,
            "TestStorageStack",
            config=DevEnvironmentConfig,
            env=cdk_env,
        )

        # Verify buckets are accessible
        assert stack.documents_bucket is not None
        assert stack.attachments_bucket is not None

    def test_staging_uses_kms_encryption(self, app: cdk.App) -> None:
        """Test that staging environment uses KMS encryption."""
        staging_env = cdk.Environment(
            account=StagingEnvironmentConfig.aws_account_id,
            region=StagingEnvironmentConfig.aws_region,
        )

        stack = StorageStack(
            app,
            "TestStagingStorageStack",
            config=StagingEnvironmentConfig,
            env=staging_env,
        )

        template = assertions.Template.from_stack(stack)

        # Staging should create a KMS key
        template.resource_count_is("AWS::KMS::Key", 1)

    def test_cors_allowed_methods(self, app: cdk.App, cdk_env: cdk.Environment) -> None:
        """Test that CORS allows required HTTP methods."""
        stack = StorageStack(
            app,
            "TestStorageStack",
            config=DevEnvironmentConfig,
            env=cdk_env,
        )

        template = assertions.Template.from_stack(stack)

        # Verify CORS allows GET, PUT, POST, DELETE, HEAD
        template.has_resource_properties(
            "AWS::S3::Bucket",
            {
                "CorsConfiguration": {
                    "CorsRules": [
                        {
                            "AllowedMethods": assertions.Match.array_with([
                                "GET", "PUT", "POST", "DELETE", "HEAD"
                            ])
                        }
                    ]
                }
            }
        )


# Hypothesis strategies for generating valid storage configurations
@st.composite
def valid_storage_config(draw: st.DrawFn) -> StorageConfig:
    """Generate valid storage configurations for property-based testing."""
    return StorageConfig(
        enable_versioning_documents=draw(st.booleans()),
        enable_versioning_attachments=draw(st.booleans()),
        enable_versioning_static_assets=draw(st.booleans()),
        transition_to_ia_days=draw(st.integers(min_value=1, max_value=365)),
        transition_to_glacier_days=draw(st.integers(min_value=30, max_value=730)),
        noncurrent_version_expiration_days=draw(st.integers(min_value=1, max_value=365)),
        abort_incomplete_multipart_days=draw(st.integers(min_value=1, max_value=30)),
        enable_cors=draw(st.booleans()),
        cors_max_age_seconds=draw(st.integers(min_value=0, max_value=86400)),
        use_kms_encryption=draw(st.booleans()),
    )


@st.composite
def valid_environment_config(draw: st.DrawFn) -> EnvironmentConfig:
    """Generate valid environment configurations for property-based testing."""
    env_name = draw(st.sampled_from(["dev", "staging", "prod"]))
    storage_config = draw(valid_storage_config())

    return EnvironmentConfig(
        environment_name=env_name,
        aws_account_id="123456789012",
        aws_region="us-east-1",
        storage=storage_config,
    )


@pytest.mark.property
class TestStorageStackPropertyTests:
    """
    Property-based tests for StorageStack.

    **Validates: Requirements 1.7**

    These tests verify that the StorageStack produces valid CDK infrastructure
    across a wide range of configuration inputs.
    """

    @given(config=valid_environment_config())
    @settings(max_examples=5, deadline=None)
    def test_stack_synthesizes_for_any_valid_config(self, config: EnvironmentConfig) -> None:
        """
        Property: Any valid environment configuration produces a synthesizable stack.

        **Validates: Requirements 1.7**

        This property ensures that the StorageStack can be synthesized without
        errors for any valid combination of environment settings.
        """
        app = cdk.App()
        env = cdk.Environment(
            account=config.aws_account_id,
            region=config.aws_region,
        )

        # Should not raise any exceptions
        stack = StorageStack(
            app,
            f"TestStorageStack-{config.environment_name}",
            config=config,
            env=env,
        )

        # Verify stack can be synthesized
        template = assertions.Template.from_stack(stack)
        assert template is not None

    @given(config=valid_environment_config())
    @settings(max_examples=5, deadline=None)
    def test_two_buckets_always_created(self, config: EnvironmentConfig) -> None:
        """
        Property: Two S3 buckets are always created regardless of configuration.

        **Validates: Requirements 1.7**

        This property ensures that exactly two buckets (documents, attachments)
        are created for any valid environment configuration.
        Note: Frontend static assets are managed by FrontendStack.
        """
        app = cdk.App()
        env = cdk.Environment(
            account=config.aws_account_id,
            region=config.aws_region,
        )

        stack = StorageStack(
            app,
            f"TestStorageStack-{config.environment_name}",
            config=config,
            env=env,
        )

        template = assertions.Template.from_stack(stack)
        template.resource_count_is("AWS::S3::Bucket", 2)

    @given(config=valid_environment_config())
    @settings(max_examples=5, deadline=None)
    def test_all_buckets_block_public_access(self, config: EnvironmentConfig) -> None:
        """
        Property: All buckets block public access regardless of configuration.

        **Validates: Requirements 1.7**

        This property ensures that public access is always blocked for all
        buckets, following AWS security best practices.
        """
        app = cdk.App()
        env = cdk.Environment(
            account=config.aws_account_id,
            region=config.aws_region,
        )

        stack = StorageStack(
            app,
            f"TestStorageStack-{config.environment_name}",
            config=config,
            env=env,
        )

        template = assertions.Template.from_stack(stack)
        buckets = template.find_resources("AWS::S3::Bucket")

        for bucket_id, bucket_props in buckets.items():
            props = bucket_props.get("Properties", {})
            public_access_config = props.get("PublicAccessBlockConfiguration", {})
            assert public_access_config.get("BlockPublicAcls") is True
            assert public_access_config.get("BlockPublicPolicy") is True
            assert public_access_config.get("IgnorePublicAcls") is True
            assert public_access_config.get("RestrictPublicBuckets") is True

    @given(config=valid_environment_config())
    @settings(max_examples=5, deadline=None)
    def test_all_buckets_have_encryption(self, config: EnvironmentConfig) -> None:
        """
        Property: All buckets have encryption enabled regardless of configuration.

        **Validates: Requirements 1.7**

        This property ensures that encryption is always enabled for all
        buckets, either using S3-managed keys or KMS.
        """
        app = cdk.App()
        env = cdk.Environment(
            account=config.aws_account_id,
            region=config.aws_region,
        )

        stack = StorageStack(
            app,
            f"TestStorageStack-{config.environment_name}",
            config=config,
            env=env,
        )

        template = assertions.Template.from_stack(stack)
        buckets = template.find_resources("AWS::S3::Bucket")

        for bucket_id, bucket_props in buckets.items():
            props = bucket_props.get("Properties", {})
            encryption_config = props.get("BucketEncryption", {})
            assert encryption_config, f"Bucket {bucket_id} should have encryption"

    @given(config=valid_environment_config())
    @settings(max_examples=5, deadline=None)
    def test_kms_key_created_when_enabled(self, config: EnvironmentConfig) -> None:
        """
        Property: KMS key is created if and only if KMS encryption is enabled.

        **Validates: Requirements 1.7**

        This property ensures that KMS keys are created only when the
        configuration specifies KMS encryption.
        """
        app = cdk.App()
        env = cdk.Environment(
            account=config.aws_account_id,
            region=config.aws_region,
        )

        stack = StorageStack(
            app,
            f"TestStorageStack-{config.environment_name}",
            config=config,
            env=env,
        )

        template = assertions.Template.from_stack(stack)

        if config.storage.use_kms_encryption:
            template.resource_count_is("AWS::KMS::Key", 1)
        else:
            template.resource_count_is("AWS::KMS::Key", 0)

    @given(config=valid_environment_config())
    @settings(max_examples=5, deadline=None)
    def test_lifecycle_rules_always_present(self, config: EnvironmentConfig) -> None:
        """
        Property: Lifecycle rules are always configured on buckets.

        **Validates: Requirements 1.7**

        This property ensures that lifecycle rules are always present
        for cost optimization, regardless of configuration.
        """
        app = cdk.App()
        env = cdk.Environment(
            account=config.aws_account_id,
            region=config.aws_region,
        )

        stack = StorageStack(
            app,
            f"TestStorageStack-{config.environment_name}",
            config=config,
            env=env,
        )

        template = assertions.Template.from_stack(stack)
        buckets = template.find_resources("AWS::S3::Bucket")

        for bucket_id, bucket_props in buckets.items():
            props = bucket_props.get("Properties", {})
            lifecycle_config = props.get("LifecycleConfiguration", {})
            rules = lifecycle_config.get("Rules", [])
            assert len(rules) > 0, f"Bucket {bucket_id} should have lifecycle rules"

    @given(config=valid_environment_config())
    @settings(max_examples=5, deadline=None)
    def test_outputs_always_created(self, config: EnvironmentConfig) -> None:
        """
        Property: CloudFormation outputs are always created for cross-stack references.

        **Validates: Requirements 1.7**

        This property ensures that essential outputs (bucket names and ARNs)
        are always created for cross-stack references.
        """
        app = cdk.App()
        env = cdk.Environment(
            account=config.aws_account_id,
            region=config.aws_region,
        )

        stack = StorageStack(
            app,
            f"TestStorageStack-{config.environment_name}",
            config=config,
            env=env,
        )

        template = assertions.Template.from_stack(stack)
        outputs = template.find_outputs("*")

        # Should have at least 4 outputs (name + ARN for each of 2 buckets)
        # Plus 1 more if KMS encryption is enabled
        min_outputs = 5 if config.storage.use_kms_encryption else 4
        assert len(outputs) >= min_outputs

    @given(config=valid_environment_config())
    @settings(max_examples=5, deadline=None)
    def test_bucket_policies_always_created(self, config: EnvironmentConfig) -> None:
        """
        Property: Bucket policies are always created for SSL enforcement.

        **Validates: Requirements 1.7**

        This property ensures that bucket policies are created for all
        buckets to enforce SSL for data in transit.
        """
        app = cdk.App()
        env = cdk.Environment(
            account=config.aws_account_id,
            region=config.aws_region,
        )

        stack = StorageStack(
            app,
            f"TestStorageStack-{config.environment_name}",
            config=config,
            env=env,
        )

        template = assertions.Template.from_stack(stack)
        policies = template.find_resources("AWS::S3::BucketPolicy")

        # All 2 buckets should have policies
        assert len(policies) >= 2

    @given(config=valid_environment_config())
    @settings(max_examples=5, deadline=None)
    def test_cors_configured_when_enabled(self, config: EnvironmentConfig) -> None:
        """
        Property: CORS is configured if and only if enabled in configuration.

        **Validates: Requirements 1.7**

        This property ensures that CORS configuration is present only
        when explicitly enabled.
        """
        app = cdk.App()
        env = cdk.Environment(
            account=config.aws_account_id,
            region=config.aws_region,
        )

        stack = StorageStack(
            app,
            f"TestStorageStack-{config.environment_name}",
            config=config,
            env=env,
        )

        template = assertions.Template.from_stack(stack)
        buckets = template.find_resources("AWS::S3::Bucket")

        for bucket_id, bucket_props in buckets.items():
            props = bucket_props.get("Properties", {})
            cors_config = props.get("CorsConfiguration")

            if config.storage.enable_cors:
                assert cors_config is not None, f"Bucket {bucket_id} should have CORS when enabled"
            else:
                assert cors_config is None, f"Bucket {bucket_id} should not have CORS when disabled"

    @given(config=valid_environment_config())
    @settings(max_examples=5, deadline=None)
    def test_bucket_properties_exposed_correctly(self, config: EnvironmentConfig) -> None:
        """
        Property: Bucket properties are exposed correctly on the stack.

        **Validates: Requirements 1.7**

        This property ensures that the stack exposes all bucket constructs
        through its properties for use by other stacks.
        """
        app = cdk.App()
        env = cdk.Environment(
            account=config.aws_account_id,
            region=config.aws_region,
        )

        stack = StorageStack(
            app,
            f"TestStorageStack-{config.environment_name}",
            config=config,
            env=env,
        )

        # Verify all buckets are accessible
        assert stack.documents_bucket is not None
        assert stack.attachments_bucket is not None

        # Verify encryption key is present only when KMS is enabled
        if config.storage.use_kms_encryption:
            assert stack.encryption_key is not None
        else:
            assert stack.encryption_key is None
