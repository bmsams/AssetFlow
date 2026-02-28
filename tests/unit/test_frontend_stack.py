"""
Unit tests and Property-based tests for FrontendStack.

These tests verify that the FrontendStack creates the expected
CloudFront infrastructure with proper configuration following AWS
Well-Architected Framework principles.

**Validates: Requirements 1.12**
"""

import pytest
import aws_cdk as cdk
from aws_cdk import assertions
from hypothesis import given, settings, strategies as st

from stacks.frontend_stack import FrontendStack
from config.environments import (
    DevEnvironmentConfig,
    StagingEnvironmentConfig,
    ProductionEnvironmentConfig,
    EnvironmentConfig,
    FrontendConfig,
)


class TestFrontendStackUnitTests:
    """Unit tests for FrontendStack."""

    def _create_stack(self, config: EnvironmentConfig = DevEnvironmentConfig):
        """Create fresh app with frontend stack."""
        app = cdk.App()
        env = cdk.Environment(
            account=config.aws_account_id,
            region=config.aws_region,
        )
        stack = FrontendStack(
            app,
            "TestFrontendStack",
            config=config,
            env=env,
        )
        return app, stack

    def test_cloudfront_distribution_created(self) -> None:
        """Test that a CloudFront distribution is created."""
        _, stack = self._create_stack()

        template = assertions.Template.from_stack(stack)

        # Verify CloudFront distribution is created
        template.resource_count_is("AWS::CloudFront::Distribution", 1)

    def test_origin_access_identity_created(self) -> None:
        """Test that an Origin Access Identity is created."""
        _, stack = self._create_stack()

        template = assertions.Template.from_stack(stack)

        # Verify OAI is created
        template.resource_count_is("AWS::CloudFront::CloudFrontOriginAccessIdentity", 1)

    def test_oai_has_comment(self) -> None:
        """Test that the OAI has a descriptive comment."""
        _, stack = self._create_stack()

        template = assertions.Template.from_stack(stack)

        # Verify OAI has comment
        template.has_resource_properties(
            "AWS::CloudFront::CloudFrontOriginAccessIdentity",
            {
                "CloudFrontOriginAccessIdentityConfig": {
                    "Comment": assertions.Match.string_like_regexp(".*static assets.*")
                }
            }
        )

    def test_distribution_has_s3_origin(self) -> None:
        """Test that the distribution has an S3 origin configured."""
        _, stack = self._create_stack()

        template = assertions.Template.from_stack(stack)

        # Verify distribution has S3 origin
        template.has_resource_properties(
            "AWS::CloudFront::Distribution",
            {
                "DistributionConfig": {
                    "Origins": assertions.Match.array_with([
                        assertions.Match.object_like({
                            "S3OriginConfig": assertions.Match.any_value()
                        })
                    ])
                }
            }
        )

    def test_distribution_uses_https_only(self) -> None:
        """Test that the distribution redirects HTTP to HTTPS."""
        _, stack = self._create_stack()

        template = assertions.Template.from_stack(stack)

        # Verify HTTPS redirect
        template.has_resource_properties(
            "AWS::CloudFront::Distribution",
            {
                "DistributionConfig": {
                    "DefaultCacheBehavior": {
                        "ViewerProtocolPolicy": "redirect-to-https"
                    }
                }
            }
        )

    def test_distribution_has_default_root_object(self) -> None:
        """Test that the distribution has index.html as default root object."""
        _, stack = self._create_stack()

        template = assertions.Template.from_stack(stack)

        # Verify default root object
        template.has_resource_properties(
            "AWS::CloudFront::Distribution",
            {
                "DistributionConfig": {
                    "DefaultRootObject": "index.html"
                }
            }
        )

    def test_distribution_has_custom_error_responses(self) -> None:
        """Test that the distribution has custom error responses for SPA routing."""
        _, stack = self._create_stack()

        template = assertions.Template.from_stack(stack)

        # Verify custom error responses for 403 and 404
        template.has_resource_properties(
            "AWS::CloudFront::Distribution",
            {
                "DistributionConfig": {
                    "CustomErrorResponses": assertions.Match.array_with([
                        assertions.Match.object_like({
                            "ErrorCode": 403,
                            "ResponseCode": 200,
                            "ResponsePagePath": "/index.html"
                        }),
                        assertions.Match.object_like({
                            "ErrorCode": 404,
                            "ResponseCode": 200,
                            "ResponsePagePath": "/index.html"
                        })
                    ])
                }
            }
        )

    def test_distribution_has_compression_enabled(self) -> None:
        """Test that the distribution has compression enabled."""
        _, stack = self._create_stack()

        template = assertions.Template.from_stack(stack)

        # Verify compression is enabled
        template.has_resource_properties(
            "AWS::CloudFront::Distribution",
            {
                "DistributionConfig": {
                    "DefaultCacheBehavior": {
                        "Compress": True
                    }
                }
            }
        )

    def test_response_headers_policy_created(self) -> None:
        """Test that a response headers policy is created."""
        _, stack = self._create_stack()

        template = assertions.Template.from_stack(stack)

        # Verify response headers policy is created
        template.resource_count_is("AWS::CloudFront::ResponseHeadersPolicy", 1)

    def test_response_headers_policy_has_security_headers(self) -> None:
        """Test that the response headers policy includes security headers."""
        _, stack = self._create_stack()

        template = assertions.Template.from_stack(stack)

        # Verify security headers are configured
        template.has_resource_properties(
            "AWS::CloudFront::ResponseHeadersPolicy",
            {
                "ResponseHeadersPolicyConfig": {
                    "SecurityHeadersConfig": {
                        "ContentTypeOptions": {"Override": True},
                        "FrameOptions": {"FrameOption": "DENY", "Override": True},
                        "XSSProtection": {"Protection": True, "ModeBlock": True, "Override": True},
                        "ReferrerPolicy": {"ReferrerPolicy": "strict-origin-when-cross-origin", "Override": True},
                        "StrictTransportSecurity": assertions.Match.object_like({
                            "IncludeSubdomains": True,
                            "Preload": True,
                            "Override": True
                        })
                    }
                }
            }
        )

    def test_cache_policy_created(self) -> None:
        """Test that a cache policy is created."""
        _, stack = self._create_stack()

        template = assertions.Template.from_stack(stack)

        # Verify cache policy is created
        template.resource_count_is("AWS::CloudFront::CachePolicy", 1)

    def test_cache_policy_has_compression_support(self) -> None:
        """Test that the cache policy supports gzip and brotli compression."""
        _, stack = self._create_stack()

        template = assertions.Template.from_stack(stack)

        # Verify compression support in cache policy
        template.has_resource_properties(
            "AWS::CloudFront::CachePolicy",
            {
                "CachePolicyConfig": {
                    "ParametersInCacheKeyAndForwardedToOrigin": {
                        "EnableAcceptEncodingGzip": True,
                        "EnableAcceptEncodingBrotli": True
                    }
                }
            }
        )

    def test_outputs_created(self) -> None:
        """Test that CloudFormation outputs are created."""
        _, stack = self._create_stack()

        template = assertions.Template.from_stack(stack)

        # Verify outputs exist
        outputs = template.find_outputs("*")
        # Should have outputs for: distribution ID, domain name, URL, OAI ID
        assert len(outputs) >= 4

    def test_stack_properties_exposed(self) -> None:
        """Test that stack properties are exposed correctly."""
        _, stack = self._create_stack()

        # Verify properties are accessible
        assert stack.distribution is not None
        assert stack.origin_access_identity is not None

    def test_dev_has_shorter_cache_ttl(self) -> None:
        """Test that dev environment has shorter cache TTL for faster iteration."""
        _, stack = self._create_stack()

        template = assertions.Template.from_stack(stack)

        # Dev should have 1 hour (3600 seconds) default TTL
        template.has_resource_properties(
            "AWS::CloudFront::CachePolicy",
            {
                "CachePolicyConfig": {
                    "DefaultTTL": 3600
                }
            }
        )

    def test_production_has_longer_cache_ttl(self) -> None:
        """Test that production environment has longer cache TTL."""
        _, stack = self._create_stack(ProductionEnvironmentConfig)

        template = assertions.Template.from_stack(stack)

        # Production should have 1 day (86400 seconds) default TTL
        template.has_resource_properties(
            "AWS::CloudFront::CachePolicy",
            {
                "CachePolicyConfig": {
                    "DefaultTTL": 86400
                }
            }
        )

    def test_production_uses_all_edge_locations(self) -> None:
        """Test that production uses all CloudFront edge locations."""
        _, stack = self._create_stack(ProductionEnvironmentConfig)

        template = assertions.Template.from_stack(stack)

        # Production should use PriceClass_All
        template.has_resource_properties(
            "AWS::CloudFront::Distribution",
            {
                "DistributionConfig": {
                    "PriceClass": "PriceClass_All"
                }
            }
        )

    def test_dev_uses_limited_edge_locations(self) -> None:
        """Test that dev uses limited CloudFront edge locations for cost savings."""
        _, stack = self._create_stack()

        template = assertions.Template.from_stack(stack)

        # Dev should use PriceClass_100 (US, Canada, Europe)
        template.has_resource_properties(
            "AWS::CloudFront::Distribution",
            {
                "DistributionConfig": {
                    "PriceClass": "PriceClass_100"
                }
            }
        )

    def test_production_has_access_logging(self) -> None:
        """Test that production has access logging enabled."""
        _, stack = self._create_stack(ProductionEnvironmentConfig)

        template = assertions.Template.from_stack(stack)

        # Production should have logging configured
        template.has_resource_properties(
            "AWS::CloudFront::Distribution",
            {
                "DistributionConfig": {
                    "Logging": assertions.Match.object_like({
                        "Bucket": assertions.Match.any_value(),
                        "Prefix": "cloudfront-logs/"
                    })
                }
            }
        )

    def test_ipv6_enabled(self) -> None:
        """Test that IPv6 is enabled on the distribution."""
        _, stack = self._create_stack()

        template = assertions.Template.from_stack(stack)

        # Verify IPv6 is enabled
        template.has_resource_properties(
            "AWS::CloudFront::Distribution",
            {
                "DistributionConfig": {
                    "IPV6Enabled": True
                }
            }
        )


# Hypothesis strategies for generating valid frontend configurations
@st.composite
def valid_frontend_config(draw: st.DrawFn) -> FrontendConfig:
    """Generate valid frontend configurations for property-based testing."""
    return FrontendConfig(
        default_ttl_seconds=draw(st.sampled_from([3600, 86400, 604800])),
        max_ttl_seconds=draw(st.sampled_from([86400, 604800, 31536000])),
        min_ttl_seconds=0,
        static_assets_ttl_seconds=draw(st.sampled_from([3600, 604800, 31536000])),
        minimum_protocol_version=draw(st.sampled_from(["TLSv1.2_2018", "TLSv1.2_2019", "TLSv1.2_2021"])),
        enable_ipv6=draw(st.booleans()),
        geo_restriction_type="none",
        price_class=draw(st.sampled_from(["PriceClass_100", "PriceClass_200", "PriceClass_All"])),
        enable_access_logging=draw(st.booleans()),
    )


@st.composite
def valid_environment_config(draw: st.DrawFn) -> EnvironmentConfig:
    """Generate valid environment configurations for property-based testing."""
    env_name = draw(st.sampled_from(["dev", "staging", "prod"]))
    frontend_config = draw(valid_frontend_config())

    return EnvironmentConfig(
        environment_name=env_name,
        aws_account_id="123456789012",
        aws_region="us-east-1",
        frontend=frontend_config,
    )


@pytest.mark.property
class TestFrontendStackPropertyTests:
    """
    Property-based tests for FrontendStack.

    **Validates: Requirements 1.12**

    These tests verify that the FrontendStack produces valid CDK infrastructure
    across a wide range of configuration inputs.
    """

    @given(config=valid_environment_config())
    @settings(max_examples=5, deadline=None)
    def test_stack_synthesizes_for_any_valid_config(self, config: EnvironmentConfig) -> None:
        """
        Property: Any valid environment configuration produces a synthesizable stack.

        **Validates: Requirements 1.12**

        This property ensures that the FrontendStack can be synthesized without
        errors for any valid combination of environment settings.
        """
        app = cdk.App()
        env = cdk.Environment(
            account=config.aws_account_id,
            region=config.aws_region,
        )

        # Should not raise any exceptions
        stack = FrontendStack(
            app,
            f"TestFrontendStack-{config.environment_name}",
            config=config,
            env=env,
        )

        # Verify stack can be synthesized
        template = assertions.Template.from_stack(stack)
        assert template is not None

    @given(config=valid_environment_config())
    @settings(max_examples=5, deadline=None)
    def test_cloudfront_distribution_always_created(self, config: EnvironmentConfig) -> None:
        """
        Property: A CloudFront distribution is always created regardless of configuration.

        **Validates: Requirements 1.12**

        This property ensures that frontend delivery is always available.
        """
        app = cdk.App()
        env = cdk.Environment(
            account=config.aws_account_id,
            region=config.aws_region,
        )

        stack = FrontendStack(
            app,
            f"TestFrontendStack-{config.environment_name}",
            config=config,
            env=env,
        )

        template = assertions.Template.from_stack(stack)
        template.resource_count_is("AWS::CloudFront::Distribution", 1)

    @given(config=valid_environment_config())
    @settings(max_examples=5, deadline=None)
    def test_oai_always_created(self, config: EnvironmentConfig) -> None:
        """
        Property: An Origin Access Identity is always created regardless of configuration.

        **Validates: Requirements 1.12**

        This property ensures that secure S3 access is always configured.
        """
        app = cdk.App()
        env = cdk.Environment(
            account=config.aws_account_id,
            region=config.aws_region,
        )

        stack = FrontendStack(
            app,
            f"TestFrontendStack-{config.environment_name}",
            config=config,
            env=env,
        )

        template = assertions.Template.from_stack(stack)
        template.resource_count_is("AWS::CloudFront::CloudFrontOriginAccessIdentity", 1)

    @given(config=valid_environment_config())
    @settings(max_examples=5, deadline=None)
    def test_https_always_enforced(self, config: EnvironmentConfig) -> None:
        """
        Property: HTTPS is always enforced regardless of configuration.

        **Validates: Requirements 1.12**

        This property ensures that all traffic is encrypted.
        """
        app = cdk.App()
        env = cdk.Environment(
            account=config.aws_account_id,
            region=config.aws_region,
        )

        stack = FrontendStack(
            app,
            f"TestFrontendStack-{config.environment_name}",
            config=config,
            env=env,
        )

        template = assertions.Template.from_stack(stack)
        template.has_resource_properties(
            "AWS::CloudFront::Distribution",
            {
                "DistributionConfig": {
                    "DefaultCacheBehavior": {
                        "ViewerProtocolPolicy": "redirect-to-https"
                    }
                }
            }
        )

    @given(config=valid_environment_config())
    @settings(max_examples=5, deadline=None)
    def test_custom_error_responses_always_configured(self, config: EnvironmentConfig) -> None:
        """
        Property: Custom error responses for SPA routing are always configured.

        **Validates: Requirements 1.12**

        This property ensures that SPA routing works correctly.
        """
        app = cdk.App()
        env = cdk.Environment(
            account=config.aws_account_id,
            region=config.aws_region,
        )

        stack = FrontendStack(
            app,
            f"TestFrontendStack-{config.environment_name}",
            config=config,
            env=env,
        )

        template = assertions.Template.from_stack(stack)
        template.has_resource_properties(
            "AWS::CloudFront::Distribution",
            {
                "DistributionConfig": {
                    "CustomErrorResponses": assertions.Match.array_with([
                        assertions.Match.object_like({"ErrorCode": 403}),
                        assertions.Match.object_like({"ErrorCode": 404})
                    ])
                }
            }
        )

    @given(config=valid_environment_config())
    @settings(max_examples=5, deadline=None)
    def test_security_headers_always_configured(self, config: EnvironmentConfig) -> None:
        """
        Property: Security headers are always configured regardless of configuration.

        **Validates: Requirements 1.12**

        This property ensures that browser security protections are always in place.
        """
        app = cdk.App()
        env = cdk.Environment(
            account=config.aws_account_id,
            region=config.aws_region,
        )

        stack = FrontendStack(
            app,
            f"TestFrontendStack-{config.environment_name}",
            config=config,
            env=env,
        )

        template = assertions.Template.from_stack(stack)
        template.resource_count_is("AWS::CloudFront::ResponseHeadersPolicy", 1)

    @given(config=valid_environment_config())
    @settings(max_examples=5, deadline=None)
    def test_cache_policy_always_created(self, config: EnvironmentConfig) -> None:
        """
        Property: A cache policy is always created regardless of configuration.

        **Validates: Requirements 1.12**

        This property ensures that caching is properly configured.
        """
        app = cdk.App()
        env = cdk.Environment(
            account=config.aws_account_id,
            region=config.aws_region,
        )

        stack = FrontendStack(
            app,
            f"TestFrontendStack-{config.environment_name}",
            config=config,
            env=env,
        )

        template = assertions.Template.from_stack(stack)
        template.resource_count_is("AWS::CloudFront::CachePolicy", 1)

    @given(config=valid_environment_config())
    @settings(max_examples=5, deadline=None)
    def test_outputs_always_created(self, config: EnvironmentConfig) -> None:
        """
        Property: CloudFormation outputs are always created for cross-stack references.

        **Validates: Requirements 1.12**

        This property ensures that essential outputs are always created.
        """
        app = cdk.App()
        env = cdk.Environment(
            account=config.aws_account_id,
            region=config.aws_region,
        )

        stack = FrontendStack(
            app,
            f"TestFrontendStack-{config.environment_name}",
            config=config,
            env=env,
        )

        template = assertions.Template.from_stack(stack)
        outputs = template.find_outputs("*")

        # Should have at least 4 outputs
        assert len(outputs) >= 4

    @given(config=valid_environment_config())
    @settings(max_examples=5, deadline=None)
    def test_stack_properties_exposed_correctly(self, config: EnvironmentConfig) -> None:
        """
        Property: Stack properties are exposed correctly for all configurations.

        **Validates: Requirements 1.12**

        This property ensures that the stack exposes all necessary constructs
        through its properties for use by other stacks.
        """
        app = cdk.App()
        env = cdk.Environment(
            account=config.aws_account_id,
            region=config.aws_region,
        )

        stack = FrontendStack(
            app,
            f"TestFrontendStack-{config.environment_name}",
            config=config,
            env=env,
        )

        # Verify all properties are accessible
        assert stack.distribution is not None
        assert stack.origin_access_identity is not None
