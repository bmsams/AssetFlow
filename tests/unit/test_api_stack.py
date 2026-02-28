"""
Unit tests for ApiStack.

These tests verify that the ApiStack creates the expected
API Gateway, WAF Web ACL, usage plans, and logging configuration
following AWS Well-Architected Framework principles.

**Validates: Requirements 1.3, 1.10**
"""

import pytest
import aws_cdk as cdk
from aws_cdk import assertions, aws_cognito as cognito

from stacks.api_stack import ApiStack
from config.environments import (
    DevEnvironmentConfig,
    StagingEnvironmentConfig,
    ProductionEnvironmentConfig,
)


class TestApiStackUnitTests:
    """Unit tests for ApiStack."""

    def test_rest_api_created(
        self, app: cdk.App, cdk_env: cdk.Environment
    ) -> None:
        """Test that a REST API is created."""
        stack = ApiStack(
            app,
            "TestApiStack",
            config=DevEnvironmentConfig,
            env=cdk_env,
        )

        template = assertions.Template.from_stack(stack)

        # Verify REST API is created
        template.resource_count_is("AWS::ApiGateway::RestApi", 1)

    def test_rest_api_name(
        self, app: cdk.App, cdk_env: cdk.Environment
    ) -> None:
        """Test that REST API has correct name."""
        stack = ApiStack(
            app,
            "TestApiStack",
            config=DevEnvironmentConfig,
            env=cdk_env,
        )

        template = assertions.Template.from_stack(stack)

        # Verify REST API name follows convention
        template.has_resource_properties(
            "AWS::ApiGateway::RestApi",
            {
                "Name": "ams-dev-asset-api",
            },
        )

    def test_rest_api_endpoint_type(
        self, app: cdk.App, cdk_env: cdk.Environment
    ) -> None:
        """Test that REST API uses REGIONAL endpoint type."""
        stack = ApiStack(
            app,
            "TestApiStack",
            config=DevEnvironmentConfig,
            env=cdk_env,
        )

        template = assertions.Template.from_stack(stack)

        # Verify endpoint type is REGIONAL
        template.has_resource_properties(
            "AWS::ApiGateway::RestApi",
            {
                "EndpointConfiguration": {
                    "Types": ["REGIONAL"],
                },
            },
        )

    def test_api_stage_created(
        self, app: cdk.App, cdk_env: cdk.Environment
    ) -> None:
        """Test that API stage is created."""
        stack = ApiStack(
            app,
            "TestApiStack",
            config=DevEnvironmentConfig,
            env=cdk_env,
        )

        template = assertions.Template.from_stack(stack)

        # Verify stage is created
        template.resource_count_is("AWS::ApiGateway::Stage", 1)

    def test_api_stage_name(
        self, app: cdk.App, cdk_env: cdk.Environment
    ) -> None:
        """Test that API stage has correct name."""
        stack = ApiStack(
            app,
            "TestApiStack",
            config=DevEnvironmentConfig,
            env=cdk_env,
        )

        template = assertions.Template.from_stack(stack)

        # Verify stage name is v1
        template.has_resource_properties(
            "AWS::ApiGateway::Stage",
            {
                "StageName": "v1",
            },
        )

    def test_api_throttling_configured(
        self, app: cdk.App, cdk_env: cdk.Environment
    ) -> None:
        """Test that API throttling is configured based on environment."""
        stack = ApiStack(
            app,
            "TestApiStack",
            config=DevEnvironmentConfig,
            env=cdk_env,
        )

        template = assertions.Template.from_stack(stack)

        # Verify throttling settings for dev environment
        template.has_resource_properties(
            "AWS::ApiGateway::Stage",
            {
                "MethodSettings": assertions.Match.array_with([
                    assertions.Match.object_like({
                        "ThrottlingRateLimit": DevEnvironmentConfig.api.throttling_rate_limit,
                        "ThrottlingBurstLimit": DevEnvironmentConfig.api.throttling_burst_limit,
                    }),
                ]),
            },
        )

    def test_xray_tracing_enabled(
        self, app: cdk.App, cdk_env: cdk.Environment
    ) -> None:
        """Test that X-Ray tracing is enabled."""
        stack = ApiStack(
            app,
            "TestApiStack",
            config=DevEnvironmentConfig,
            env=cdk_env,
        )

        template = assertions.Template.from_stack(stack)

        # Verify X-Ray tracing is enabled
        template.has_resource_properties(
            "AWS::ApiGateway::Stage",
            {
                "TracingEnabled": True,
            },
        )

    def test_access_logging_configured(
        self, app: cdk.App, cdk_env: cdk.Environment
    ) -> None:
        """Test that access logging is configured."""
        stack = ApiStack(
            app,
            "TestApiStack",
            config=DevEnvironmentConfig,
            env=cdk_env,
        )

        template = assertions.Template.from_stack(stack)

        # Verify access log destination is configured
        template.has_resource_properties(
            "AWS::ApiGateway::Stage",
            {
                "AccessLogSetting": assertions.Match.object_like({
                    "DestinationArn": assertions.Match.any_value(),
                }),
            },
        )

    def test_cloudwatch_log_group_created(
        self, app: cdk.App, cdk_env: cdk.Environment
    ) -> None:
        """Test that CloudWatch log group is created for access logs."""
        stack = ApiStack(
            app,
            "TestApiStack",
            config=DevEnvironmentConfig,
            env=cdk_env,
        )

        template = assertions.Template.from_stack(stack)

        # Verify log group is created
        template.resource_count_is("AWS::Logs::LogGroup", 1)

    def test_log_group_retention(
        self, app: cdk.App, cdk_env: cdk.Environment
    ) -> None:
        """Test that log group has appropriate retention period."""
        stack = ApiStack(
            app,
            "TestApiStack",
            config=DevEnvironmentConfig,
            env=cdk_env,
        )

        template = assertions.Template.from_stack(stack)

        # Verify log retention is 7 days for dev
        template.has_resource_properties(
            "AWS::Logs::LogGroup",
            {
                "RetentionInDays": 7,
            },
        )

    def test_waf_web_acl_created(
        self, app: cdk.App, cdk_env: cdk.Environment
    ) -> None:
        """Test that WAF Web ACL is created when enabled."""
        stack = ApiStack(
            app,
            "TestApiStack",
            config=DevEnvironmentConfig,
            env=cdk_env,
        )

        template = assertions.Template.from_stack(stack)

        # Verify WAF Web ACL is created
        template.resource_count_is("AWS::WAFv2::WebACL", 1)

    def test_waf_web_acl_scope(
        self, app: cdk.App, cdk_env: cdk.Environment
    ) -> None:
        """Test that WAF Web ACL has REGIONAL scope."""
        stack = ApiStack(
            app,
            "TestApiStack",
            config=DevEnvironmentConfig,
            env=cdk_env,
        )

        template = assertions.Template.from_stack(stack)

        # Verify WAF scope is REGIONAL
        template.has_resource_properties(
            "AWS::WAFv2::WebACL",
            {
                "Scope": "REGIONAL",
            },
        )

    def test_waf_default_action_allow(
        self, app: cdk.App, cdk_env: cdk.Environment
    ) -> None:
        """Test that WAF default action is allow."""
        stack = ApiStack(
            app,
            "TestApiStack",
            config=DevEnvironmentConfig,
            env=cdk_env,
        )

        template = assertions.Template.from_stack(stack)

        # Verify default action is allow
        template.has_resource_properties(
            "AWS::WAFv2::WebACL",
            {
                "DefaultAction": {"Allow": {}},
            },
        )

    def test_waf_common_rule_set(
        self, app: cdk.App, cdk_env: cdk.Environment
    ) -> None:
        """Test that WAF includes AWS Managed Rules Common Rule Set."""
        stack = ApiStack(
            app,
            "TestApiStack",
            config=DevEnvironmentConfig,
            env=cdk_env,
        )

        template = assertions.Template.from_stack(stack)

        # Verify Common Rule Set is included
        template.has_resource_properties(
            "AWS::WAFv2::WebACL",
            {
                "Rules": assertions.Match.array_with([
                    assertions.Match.object_like({
                        "Name": "AWSManagedRulesCommonRuleSet",
                        "Statement": {
                            "ManagedRuleGroupStatement": {
                                "VendorName": "AWS",
                                "Name": "AWSManagedRulesCommonRuleSet",
                            },
                        },
                    }),
                ]),
            },
        )

    def test_waf_sqli_rule_set(
        self, app: cdk.App, cdk_env: cdk.Environment
    ) -> None:
        """Test that WAF includes AWS Managed Rules SQL Injection Rule Set."""
        stack = ApiStack(
            app,
            "TestApiStack",
            config=DevEnvironmentConfig,
            env=cdk_env,
        )

        template = assertions.Template.from_stack(stack)

        # Verify SQLi Rule Set is included
        template.has_resource_properties(
            "AWS::WAFv2::WebACL",
            {
                "Rules": assertions.Match.array_with([
                    assertions.Match.object_like({
                        "Name": "AWSManagedRulesSQLiRuleSet",
                        "Statement": {
                            "ManagedRuleGroupStatement": {
                                "VendorName": "AWS",
                                "Name": "AWSManagedRulesSQLiRuleSet",
                            },
                        },
                    }),
                ]),
            },
        )

    def test_waf_rate_limit_rule(
        self, app: cdk.App, cdk_env: cdk.Environment
    ) -> None:
        """Test that WAF includes rate limiting rule."""
        stack = ApiStack(
            app,
            "TestApiStack",
            config=DevEnvironmentConfig,
            env=cdk_env,
        )

        template = assertions.Template.from_stack(stack)

        # Verify rate limit rule is included
        template.has_resource_properties(
            "AWS::WAFv2::WebACL",
            {
                "Rules": assertions.Match.array_with([
                    assertions.Match.object_like({
                        "Name": "RateLimitRule",
                        "Statement": {
                            "RateBasedStatement": {
                                "Limit": DevEnvironmentConfig.api.waf_rate_limit,
                                "AggregateKeyType": "IP",
                            },
                        },
                        "Action": {"Block": {}},
                    }),
                ]),
            },
        )

    def test_waf_cloudwatch_metrics_enabled(
        self, app: cdk.App, cdk_env: cdk.Environment
    ) -> None:
        """Test that WAF CloudWatch metrics are enabled."""
        stack = ApiStack(
            app,
            "TestApiStack",
            config=DevEnvironmentConfig,
            env=cdk_env,
        )

        template = assertions.Template.from_stack(stack)

        # Verify CloudWatch metrics are enabled
        template.has_resource_properties(
            "AWS::WAFv2::WebACL",
            {
                "VisibilityConfig": {
                    "CloudWatchMetricsEnabled": True,
                    "SampledRequestsEnabled": True,
                },
            },
        )

    def test_waf_association_created(
        self, app: cdk.App, cdk_env: cdk.Environment
    ) -> None:
        """Test that WAF is associated with API Gateway."""
        stack = ApiStack(
            app,
            "TestApiStack",
            config=DevEnvironmentConfig,
            env=cdk_env,
        )

        template = assertions.Template.from_stack(stack)

        # Verify WAF association is created
        template.resource_count_is("AWS::WAFv2::WebACLAssociation", 1)

    def test_usage_plan_created(
        self, app: cdk.App, cdk_env: cdk.Environment
    ) -> None:
        """Test that usage plan is created."""
        stack = ApiStack(
            app,
            "TestApiStack",
            config=DevEnvironmentConfig,
            env=cdk_env,
        )

        template = assertions.Template.from_stack(stack)

        # Verify usage plan is created
        template.resource_count_is("AWS::ApiGateway::UsagePlan", 1)

    def test_usage_plan_throttling(
        self, app: cdk.App, cdk_env: cdk.Environment
    ) -> None:
        """Test that usage plan has throttling configured."""
        stack = ApiStack(
            app,
            "TestApiStack",
            config=DevEnvironmentConfig,
            env=cdk_env,
        )

        template = assertions.Template.from_stack(stack)

        # Verify usage plan throttling
        template.has_resource_properties(
            "AWS::ApiGateway::UsagePlan",
            {
                "Throttle": {
                    "RateLimit": DevEnvironmentConfig.api.throttling_rate_limit,
                    "BurstLimit": DevEnvironmentConfig.api.throttling_burst_limit,
                },
            },
        )

    def test_usage_plan_quota(
        self, app: cdk.App, cdk_env: cdk.Environment
    ) -> None:
        """Test that usage plan has quota configured."""
        stack = ApiStack(
            app,
            "TestApiStack",
            config=DevEnvironmentConfig,
            env=cdk_env,
        )

        template = assertions.Template.from_stack(stack)

        # Verify usage plan quota
        template.has_resource_properties(
            "AWS::ApiGateway::UsagePlan",
            {
                "Quota": {
                    "Limit": 10000,
                    "Period": "DAY",
                },
            },
        )

    def test_api_key_created(
        self, app: cdk.App, cdk_env: cdk.Environment
    ) -> None:
        """Test that API key is created."""
        stack = ApiStack(
            app,
            "TestApiStack",
            config=DevEnvironmentConfig,
            env=cdk_env,
        )

        template = assertions.Template.from_stack(stack)

        # Verify API key is created
        template.resource_count_is("AWS::ApiGateway::ApiKey", 1)

    def test_api_key_enabled(
        self, app: cdk.App, cdk_env: cdk.Environment
    ) -> None:
        """Test that API key is enabled."""
        stack = ApiStack(
            app,
            "TestApiStack",
            config=DevEnvironmentConfig,
            env=cdk_env,
        )

        template = assertions.Template.from_stack(stack)

        # Verify API key is enabled
        template.has_resource_properties(
            "AWS::ApiGateway::ApiKey",
            {
                "Enabled": True,
            },
        )

    def test_api_key_usage_plan_association(
        self, app: cdk.App, cdk_env: cdk.Environment
    ) -> None:
        """Test that API key is associated with usage plan."""
        stack = ApiStack(
            app,
            "TestApiStack",
            config=DevEnvironmentConfig,
            env=cdk_env,
        )

        template = assertions.Template.from_stack(stack)

        # Verify usage plan key is created
        template.resource_count_is("AWS::ApiGateway::UsagePlanKey", 1)

    def test_health_endpoint_created(
        self, app: cdk.App, cdk_env: cdk.Environment
    ) -> None:
        """Test that health check endpoint is created."""
        stack = ApiStack(
            app,
            "TestApiStack",
            config=DevEnvironmentConfig,
            env=cdk_env,
        )

        template = assertions.Template.from_stack(stack)

        # Verify health resource is created
        template.has_resource_properties(
            "AWS::ApiGateway::Resource",
            {
                "PathPart": "health",
            },
        )

    def test_health_endpoint_method(
        self, app: cdk.App, cdk_env: cdk.Environment
    ) -> None:
        """Test that health endpoint has GET method."""
        stack = ApiStack(
            app,
            "TestApiStack",
            config=DevEnvironmentConfig,
            env=cdk_env,
        )

        template = assertions.Template.from_stack(stack)

        # Verify GET method exists
        template.has_resource_properties(
            "AWS::ApiGateway::Method",
            {
                "HttpMethod": "GET",
            },
        )

    def test_outputs_created(
        self, app: cdk.App, cdk_env: cdk.Environment
    ) -> None:
        """Test that CloudFormation outputs are created."""
        stack = ApiStack(
            app,
            "TestApiStack",
            config=DevEnvironmentConfig,
            env=cdk_env,
        )

        template = assertions.Template.from_stack(stack)

        # Verify outputs exist
        outputs = template.find_outputs("*")
        # Should have: ApiEndpoint, ApiId, ApiStageArn, WebAclArn,
        # UsagePlanId, ApiKeyId, AccessLogGroupArn
        assert len(outputs) >= 7

    def test_stack_properties_exposed(
        self, app: cdk.App, cdk_env: cdk.Environment
    ) -> None:
        """Test that stack properties are exposed correctly."""
        stack = ApiStack(
            app,
            "TestApiStack",
            config=DevEnvironmentConfig,
            env=cdk_env,
        )

        # Verify all properties are accessible
        assert stack.api is not None
        assert stack.web_acl is not None
        assert stack.usage_plan is not None
        assert stack.api_key is not None

    def test_staging_environment(self, app: cdk.App) -> None:
        """Test that staging environment creates same resources."""
        staging_env = cdk.Environment(
            account=StagingEnvironmentConfig.aws_account_id,
            region=StagingEnvironmentConfig.aws_region,
        )

        stack = ApiStack(
            app,
            "TestStagingApiStack",
            config=StagingEnvironmentConfig,
            env=staging_env,
        )

        template = assertions.Template.from_stack(stack)

        # Verify same resources are created
        template.resource_count_is("AWS::ApiGateway::RestApi", 1)
        template.resource_count_is("AWS::WAFv2::WebACL", 1)
        template.resource_count_is("AWS::ApiGateway::UsagePlan", 1)

    def test_staging_throttling_limits(self, app: cdk.App) -> None:
        """Test that staging has different throttling limits."""
        staging_env = cdk.Environment(
            account=StagingEnvironmentConfig.aws_account_id,
            region=StagingEnvironmentConfig.aws_region,
        )

        stack = ApiStack(
            app,
            "TestStagingApiStack",
            config=StagingEnvironmentConfig,
            env=staging_env,
        )

        template = assertions.Template.from_stack(stack)

        # Verify staging throttling settings
        template.has_resource_properties(
            "AWS::ApiGateway::UsagePlan",
            {
                "Throttle": {
                    "RateLimit": StagingEnvironmentConfig.api.throttling_rate_limit,
                    "BurstLimit": StagingEnvironmentConfig.api.throttling_burst_limit,
                },
            },
        )

    def test_production_environment(self, app: cdk.App) -> None:
        """Test that production environment creates same resources."""
        prod_env = cdk.Environment(
            account=ProductionEnvironmentConfig.aws_account_id,
            region=ProductionEnvironmentConfig.aws_region,
        )

        stack = ApiStack(
            app,
            "TestProdApiStack",
            config=ProductionEnvironmentConfig,
            env=prod_env,
        )

        template = assertions.Template.from_stack(stack)

        # Verify same resources are created
        template.resource_count_is("AWS::ApiGateway::RestApi", 1)
        template.resource_count_is("AWS::WAFv2::WebACL", 1)
        template.resource_count_is("AWS::ApiGateway::UsagePlan", 1)

    def test_production_log_retention(self, app: cdk.App) -> None:
        """Test that production has longer log retention."""
        prod_env = cdk.Environment(
            account=ProductionEnvironmentConfig.aws_account_id,
            region=ProductionEnvironmentConfig.aws_region,
        )

        stack = ApiStack(
            app,
            "TestProdApiStack",
            config=ProductionEnvironmentConfig,
            env=prod_env,
        )

        template = assertions.Template.from_stack(stack)

        # Verify log retention is 30 days for production
        template.has_resource_properties(
            "AWS::Logs::LogGroup",
            {
                "RetentionInDays": 30,
            },
        )

    def test_production_throttling_limits(self, app: cdk.App) -> None:
        """Test that production has higher throttling limits."""
        prod_env = cdk.Environment(
            account=ProductionEnvironmentConfig.aws_account_id,
            region=ProductionEnvironmentConfig.aws_region,
        )

        stack = ApiStack(
            app,
            "TestProdApiStack",
            config=ProductionEnvironmentConfig,
            env=prod_env,
        )

        template = assertions.Template.from_stack(stack)

        # Verify production throttling settings
        template.has_resource_properties(
            "AWS::ApiGateway::UsagePlan",
            {
                "Throttle": {
                    "RateLimit": ProductionEnvironmentConfig.api.throttling_rate_limit,
                    "BurstLimit": ProductionEnvironmentConfig.api.throttling_burst_limit,
                },
            },
        )

    def test_api_naming_convention(
        self, app: cdk.App, cdk_env: cdk.Environment
    ) -> None:
        """Test that API follows naming convention."""
        stack = ApiStack(
            app,
            "TestApiStack",
            config=DevEnvironmentConfig,
            env=cdk_env,
        )

        template = assertions.Template.from_stack(stack)

        # Verify API name follows convention
        template.has_resource_properties(
            "AWS::ApiGateway::RestApi",
            {
                "Name": assertions.Match.string_like_regexp(r"ams-dev-.*"),
            },
        )

    def test_waf_naming_convention(
        self, app: cdk.App, cdk_env: cdk.Environment
    ) -> None:
        """Test that WAF follows naming convention."""
        stack = ApiStack(
            app,
            "TestApiStack",
            config=DevEnvironmentConfig,
            env=cdk_env,
        )

        template = assertions.Template.from_stack(stack)

        # Verify WAF name follows convention
        template.has_resource_properties(
            "AWS::WAFv2::WebACL",
            {
                "Name": assertions.Match.string_like_regexp(r"ams-dev-.*"),
            },
        )


class TestCognitoAuthorizer:
    """Unit tests for Cognito authorizer on API Gateway.

    **Validates: Requirements 6.1, 6.2**
    """

    @staticmethod
    def _create_stack_with_authorizer(app, cdk_env):
        """Helper: create ApiStack with user pool."""
        auth_stack = cdk.Stack(app, "TestAuthStack", env=cdk_env)
        user_pool = cognito.UserPool(
            auth_stack, "TestUserPool", user_pool_name="test-pool"
        )

        stack = ApiStack(
            app,
            "TestApiStack",
            config=DevEnvironmentConfig,
            user_pool=user_pool,
            env=cdk_env,
        )

        return stack

    def test_cognito_authorizer_created_when_user_pool_provided(
        self, app: cdk.App, cdk_env: cdk.Environment
    ) -> None:
        """Test that a Cognito authorizer is created when user_pool is passed."""
        stack = self._create_stack_with_authorizer(app, cdk_env)
        template = assertions.Template.from_stack(stack)

        template.resource_count_is("AWS::ApiGateway::Authorizer", 1)
        template.has_resource_properties(
            "AWS::ApiGateway::Authorizer",
            {
                "Type": "COGNITO_USER_POOLS",
                "IdentitySource": "method.request.header.Authorization",
            },
        )

    def test_cognito_authorizer_references_user_pool(
        self, app: cdk.App, cdk_env: cdk.Environment
    ) -> None:
        """Test that the authorizer references the correct user pool."""
        stack = self._create_stack_with_authorizer(app, cdk_env)
        template = assertions.Template.from_stack(stack)

        # The authorizer should have ProviderARNs referencing the user pool
        template.has_resource_properties(
            "AWS::ApiGateway::Authorizer",
            {
                "Type": "COGNITO_USER_POOLS",
                "ProviderARNs": assertions.Match.any_value(),
            },
        )

    def test_no_authorizer_when_user_pool_not_provided(
        self, app: cdk.App, cdk_env: cdk.Environment
    ) -> None:
        """Test that no authorizer is created when user_pool is not passed."""
        stack = ApiStack(
            app,
            "TestApiStack",
            config=DevEnvironmentConfig,
            env=cdk_env,
        )

        template = assertions.Template.from_stack(stack)

        template.resource_count_is("AWS::ApiGateway::Authorizer", 0)

    def test_authorizer_attribute_exposed(
        self, app: cdk.App, cdk_env: cdk.Environment
    ) -> None:
        """Test that self.authorizer is exposed on the stack."""
        auth_stack = cdk.Stack(app, "TestAuthStack", env=cdk_env)
        user_pool = cognito.UserPool(
            auth_stack, "TestUserPool", user_pool_name="test-pool"
        )

        stack = ApiStack(
            app,
            "TestApiStack",
            config=DevEnvironmentConfig,
            user_pool=user_pool,
            env=cdk_env,
        )

        assert stack.authorizer is not None

    def test_authorizer_none_when_no_user_pool(
        self, app: cdk.App, cdk_env: cdk.Environment
    ) -> None:
        """Test that self.authorizer is None when no user_pool provided."""
        stack = ApiStack(
            app,
            "TestApiStack",
            config=DevEnvironmentConfig,
            env=cdk_env,
        )

        assert stack.authorizer is None
