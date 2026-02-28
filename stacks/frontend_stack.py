"""
Frontend Stack for Asset Management System.

This stack provisions CloudFront distribution for frontend static asset delivery
following AWS Well-Architected Framework principles:

- CloudFront distribution for global content delivery
- S3 origin with Origin Access Control (OAC) for secure access
- Custom error pages for SPA routing (403/404 -> /index.html)
- Cache behaviors optimized for static assets
- HTTPS only with TLS 1.2 minimum
- Response headers policy for security headers
- Geo-restriction support for compliance

Requirements: 1.12
"""

from typing import Optional

from aws_cdk import (
    Stack,
    Duration,
    RemovalPolicy,
    aws_cloudfront as cloudfront,
    aws_cloudfront_origins as origins,
    aws_s3 as s3,
    CfnOutput,
)
from constructs import Construct

from config.environments import EnvironmentConfig


class FrontendStack(Stack):
    """
    Frontend infrastructure stack for Asset Management System.

    Creates CloudFront distribution for:
    - Static asset delivery (JavaScript, CSS, images)
    - SPA routing with custom error pages
    - Secure access to S3 origin via OAC
    - Security headers for browser protection

    Attributes:
        distribution: CloudFront distribution for frontend delivery
        origin_access_identity: OAI for secure S3 access
        static_assets_bucket: S3 bucket for static assets (created if not provided)
    """

    def __init__(
        self,
        scope: Construct,
        construct_id: str,
        config: EnvironmentConfig,
        static_assets_bucket: Optional[s3.IBucket] = None,
        **kwargs,
    ) -> None:
        """
        Initialize the Frontend Stack.

        Args:
            scope: The parent construct
            construct_id: The construct ID
            config: Environment configuration
            static_assets_bucket: Optional S3 bucket for static assets. If not provided,
                                  a new bucket will be created within this stack.
            **kwargs: Additional stack properties
        """
        super().__init__(scope, construct_id, **kwargs)

        self._config = config
        self._frontend_config = config.frontend

        # Create or use provided static assets bucket
        if static_assets_bucket is not None:
            self.static_assets_bucket = static_assets_bucket
        else:
            self.static_assets_bucket = self._create_static_assets_bucket()

        # Create Origin Access Identity for secure S3 access
        self.origin_access_identity = self._create_origin_access_identity()

        # Create response headers policy for security
        self._response_headers_policy = self._create_response_headers_policy()

        # Create CloudFront distribution
        self.distribution = self._create_distribution()

        # Export outputs for cross-stack references
        self._create_outputs()

    def _create_origin_access_identity(self) -> cloudfront.OriginAccessIdentity:
        """
        Create Origin Access Identity for secure S3 access.

        OAI allows CloudFront to access S3 bucket content without making
        the bucket public. This follows the principle of least privilege.

        Returns:
            cloudfront.OriginAccessIdentity: The OAI for S3 access
        """
        oai = cloudfront.OriginAccessIdentity(
            self,
            "OriginAccessIdentity",
            comment=f"OAI for {self._config.stack_prefix} static assets",
        )
        return oai

    def _create_static_assets_bucket(self) -> s3.Bucket:
        """
        Create S3 bucket for static assets when not provided externally.

        Returns:
            s3.Bucket: The static assets bucket
        """
        bucket = s3.Bucket(
            self,
            "StaticAssetsBucket",
            encryption=s3.BucketEncryption.S3_MANAGED,
            block_public_access=s3.BlockPublicAccess.BLOCK_ALL,
            removal_policy=RemovalPolicy.RETAIN if self._config.is_production else RemovalPolicy.DESTROY,
            auto_delete_objects=not self._config.is_production,
            versioned=False,
            enforce_ssl=True,
        )
        return bucket

    def _create_response_headers_policy(self) -> cloudfront.ResponseHeadersPolicy:
        """
        Create response headers policy for security.

        Adds security headers to all responses:
        - Content-Security-Policy: Prevents XSS attacks
        - X-Content-Type-Options: Prevents MIME sniffing
        - X-Frame-Options: Prevents clickjacking
        - X-XSS-Protection: Additional XSS protection
        - Referrer-Policy: Controls referrer information
        - Strict-Transport-Security: Enforces HTTPS

        Returns:
            cloudfront.ResponseHeadersPolicy: The security headers policy
        """
        policy = cloudfront.ResponseHeadersPolicy(
            self,
            "SecurityHeadersPolicy",
            response_headers_policy_name=f"{self._config.stack_prefix}-security-headers",
            comment=f"Security headers for {self._config.stack_prefix} frontend",
            security_headers_behavior=cloudfront.ResponseSecurityHeadersBehavior(
                content_type_options=cloudfront.ResponseHeadersContentTypeOptions(
                    override=True
                ),
                frame_options=cloudfront.ResponseHeadersFrameOptions(
                    frame_option=cloudfront.HeadersFrameOption.DENY,
                    override=True,
                ),
                xss_protection=cloudfront.ResponseHeadersXSSProtection(
                    protection=True,
                    mode_block=True,
                    override=True,
                ),
                referrer_policy=cloudfront.ResponseHeadersReferrerPolicy(
                    referrer_policy=cloudfront.HeadersReferrerPolicy.STRICT_ORIGIN_WHEN_CROSS_ORIGIN,
                    override=True,
                ),
                strict_transport_security=cloudfront.ResponseHeadersStrictTransportSecurity(
                    access_control_max_age=Duration.days(365),
                    include_subdomains=True,
                    preload=True,
                    override=True,
                ),
            ),
        )
        return policy

    def _get_price_class(self) -> cloudfront.PriceClass:
        """
        Get CloudFront price class based on configuration.

        Returns:
            cloudfront.PriceClass: The price class for the distribution
        """
        price_class_mapping = {
            "PriceClass_100": cloudfront.PriceClass.PRICE_CLASS_100,
            "PriceClass_200": cloudfront.PriceClass.PRICE_CLASS_200,
            "PriceClass_All": cloudfront.PriceClass.PRICE_CLASS_ALL,
        }
        return price_class_mapping.get(
            self._frontend_config.price_class,
            cloudfront.PriceClass.PRICE_CLASS_100,
        )

    def _get_minimum_protocol_version(self) -> cloudfront.SecurityPolicyProtocol:
        """
        Get minimum TLS protocol version based on configuration.

        Returns:
            cloudfront.SecurityPolicyProtocol: The minimum TLS version
        """
        protocol_mapping = {
            "TLSv1.2_2018": cloudfront.SecurityPolicyProtocol.TLS_V1_2_2018,
            "TLSv1.2_2019": cloudfront.SecurityPolicyProtocol.TLS_V1_2_2019,
            "TLSv1.2_2021": cloudfront.SecurityPolicyProtocol.TLS_V1_2_2021,
        }
        return protocol_mapping.get(
            self._frontend_config.minimum_protocol_version,
            cloudfront.SecurityPolicyProtocol.TLS_V1_2_2021,
        )

    def _create_geo_restriction(self) -> cloudfront.GeoRestriction | None:
        """
        Create geo-restriction based on configuration.

        Returns:
            cloudfront.GeoRestriction | None: Geo-restriction or None if disabled
        """
        if self._frontend_config.geo_restriction_type == "none":
            return None

        locations = list(self._frontend_config.geo_restriction_locations)
        if not locations:
            return None

        if self._frontend_config.geo_restriction_type == "whitelist":
            return cloudfront.GeoRestriction.allowlist(*locations)
        elif self._frontend_config.geo_restriction_type == "blacklist":
            return cloudfront.GeoRestriction.denylist(*locations)

        return None

    def _create_error_responses(self) -> list[cloudfront.ErrorResponse]:
        """
        Create custom error responses for SPA routing.

        For single-page applications, 403 and 404 errors should return
        the index.html page so client-side routing can handle the request.

        Returns:
            list[cloudfront.ErrorResponse]: Custom error response configurations
        """
        error_page_path = self._frontend_config.custom_error_response_page_path
        error_caching_ttl = Duration.seconds(
            self._frontend_config.error_caching_min_ttl_seconds
        )

        return [
            # Handle 403 Forbidden (e.g., accessing non-existent S3 object)
            cloudfront.ErrorResponse(
                http_status=403,
                response_http_status=200,
                response_page_path=error_page_path,
                ttl=error_caching_ttl,
            ),
            # Handle 404 Not Found
            cloudfront.ErrorResponse(
                http_status=404,
                response_http_status=200,
                response_page_path=error_page_path,
                ttl=error_caching_ttl,
            ),
        ]

    def _create_distribution(self) -> cloudfront.Distribution:
        """
        Create CloudFront distribution for frontend delivery.

        Returns:
            cloudfront.Distribution: The CloudFront distribution
        """
        # Create S3 origin with OAI
        s3_origin = origins.S3Origin(
            self.static_assets_bucket,
            origin_access_identity=self.origin_access_identity,
        )

        # Create cache policy for static assets
        cache_policy = cloudfront.CachePolicy(
            self,
            "StaticAssetsCachePolicy",
            cache_policy_name=f"{self._config.stack_prefix}-static-assets-cache",
            comment=f"Cache policy for {self._config.stack_prefix} static assets",
            default_ttl=Duration.seconds(self._frontend_config.default_ttl_seconds),
            max_ttl=Duration.seconds(self._frontend_config.max_ttl_seconds),
            min_ttl=Duration.seconds(self._frontend_config.min_ttl_seconds),
            enable_accept_encoding_gzip=True,
            enable_accept_encoding_brotli=True,
        )

        # Build distribution properties
        distribution_props = {
            "default_behavior": cloudfront.BehaviorOptions(
                origin=s3_origin,
                viewer_protocol_policy=cloudfront.ViewerProtocolPolicy.REDIRECT_TO_HTTPS,
                allowed_methods=cloudfront.AllowedMethods.ALLOW_GET_HEAD_OPTIONS,
                cached_methods=cloudfront.CachedMethods.CACHE_GET_HEAD_OPTIONS,
                cache_policy=cache_policy,
                response_headers_policy=self._response_headers_policy,
                compress=True,
            ),
            "default_root_object": "index.html",
            "error_responses": self._create_error_responses(),
            "price_class": self._get_price_class(),
            "minimum_protocol_version": self._get_minimum_protocol_version(),
            "enable_ipv6": self._frontend_config.enable_ipv6,
            "comment": f"Asset Management System Frontend ({self._config.environment_name})",
        }

        # Add geo-restriction if configured
        geo_restriction = self._create_geo_restriction()
        if geo_restriction:
            distribution_props["geo_restriction"] = geo_restriction

        # Add access logging if enabled
        if self._frontend_config.enable_access_logging:
            # Create logging bucket
            logging_bucket = s3.Bucket(
                self,
                "AccessLogsBucket",
                bucket_name=None,  # Auto-generate name
                encryption=s3.BucketEncryption.S3_MANAGED,
                block_public_access=s3.BlockPublicAccess.BLOCK_ALL,
                removal_policy=RemovalPolicy.RETAIN if self._config.is_production else RemovalPolicy.DESTROY,
                auto_delete_objects=not self._config.is_production,
                object_ownership=s3.ObjectOwnership.OBJECT_WRITER,
            )
            distribution_props["log_bucket"] = logging_bucket
            distribution_props["log_file_prefix"] = "cloudfront-logs/"
            distribution_props["log_includes_cookies"] = False

        distribution = cloudfront.Distribution(
            self,
            "Distribution",
            **distribution_props,
        )

        return distribution

    def _create_outputs(self) -> None:
        """Create CloudFormation outputs for cross-stack references."""
        CfnOutput(
            self,
            "DistributionId",
            value=self.distribution.distribution_id,
            description="CloudFront distribution ID",
            export_name=f"{self._config.stack_prefix}-distribution-id",
        )

        CfnOutput(
            self,
            "DistributionDomainName",
            value=self.distribution.distribution_domain_name,
            description="CloudFront distribution domain name",
            export_name=f"{self._config.stack_prefix}-distribution-domain",
        )

        CfnOutput(
            self,
            "DistributionUrl",
            value=f"https://{self.distribution.distribution_domain_name}",
            description="CloudFront distribution URL",
            export_name=f"{self._config.stack_prefix}-distribution-url",
        )

        CfnOutput(
            self,
            "OriginAccessIdentityId",
            value=self.origin_access_identity.origin_access_identity_id,
            description="Origin Access Identity ID",
            export_name=f"{self._config.stack_prefix}-oai-id",
        )

        # Output the bucket name for frontend deployments
        CfnOutput(
            self,
            "FrontendBucketName",
            value=self.static_assets_bucket.bucket_name,
            description="S3 bucket name for frontend deployments",
            export_name=f"{self._config.stack_prefix}-frontend-bucket-name",
        )
