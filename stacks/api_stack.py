"""
API Stack for Asset Management System.

This stack provisions API Gateway with WAF protection, throttling, and
Lambda functions following AWS Well-Architected Framework principles:

- WAF protects against common web exploits (OWASP Top 10)
- Throttling prevents resource exhaustion (REL05-BP02)
- Lambda in VPC for secure database access
- Usage plans for API key management
- X-Ray tracing for distributed request tracking
- CloudWatch logging for monitoring and troubleshooting

Requirements: 1.3, 1.10
"""

from aws_cdk import (
    Stack,
    Duration,
    RemovalPolicy,
    aws_apigateway as apigateway,
    aws_cognito as cognito,
    aws_wafv2 as wafv2,
    aws_logs as logs,
    CfnOutput,
)
from constructs import Construct

from config.environments import EnvironmentConfig


class ApiStack(Stack):
    """
    API infrastructure stack for Asset Management System.

    Creates API Gateway with:
    - REST API with throttling and usage plans
    - WAF Web ACL with AWS managed rules and rate limiting
    - CloudWatch logging for API access logs
    - X-Ray tracing for distributed request tracking
    - CORS configuration for frontend access
    - Usage plans for API key management

    Attributes:
        api: The REST API construct
        web_acl: The WAF Web ACL construct
        usage_plan: The API usage plan
        api_key: The API key for usage plan
    """

    def __init__(
        self,
        scope: Construct,
        construct_id: str,
        config: EnvironmentConfig,
        user_pool: cognito.IUserPool = None,
        **kwargs,
    ) -> None:
        """
        Initialize the API Stack.

        Args:
            scope: The parent construct
            construct_id: The construct ID
            config: Environment configuration
            user_pool: Optional Cognito User Pool for creating an authorizer
            **kwargs: Additional stack properties
        """
        super().__init__(scope, construct_id, **kwargs)

        self._config = config

        # Create CloudWatch log group for API access logs
        self._access_log_group = self._create_access_log_group()

        # Create REST API with throttling
        self.api = self._create_rest_api()

        # Create Cognito authorizer if user pool is provided
        self.authorizer = None
        if user_pool:
            self.authorizer = apigateway.CfnAuthorizer(
                self,
                "CognitoAuthorizer",
                rest_api_id=self.api.rest_api_id,
                type="COGNITO_USER_POOLS",
                name=f"{config.stack_prefix}-cognito-authorizer",
                identity_source="method.request.header.Authorization",
                provider_arns=[user_pool.user_pool_arn],
            )

        # Create WAF Web ACL if enabled
        self.web_acl = None
        if config.enable_waf:
            self.web_acl = self._create_waf_web_acl()
            self._associate_waf_with_api()

        # Create usage plan and API key
        self.usage_plan = self._create_usage_plan()
        self.api_key = self._create_api_key()

        # Export outputs for cross-stack references
        self._create_outputs()

    def _create_access_log_group(self) -> logs.LogGroup:
        """
        Create CloudWatch log group for API access logs.

        Returns:
            logs.LogGroup: The CloudWatch log group
        """
        log_group = logs.LogGroup(
            self,
            "ApiAccessLogs",
            log_group_name=f"/aws/apigateway/{self._config.stack_prefix}-api-access-logs",
            retention=logs.RetentionDays.ONE_MONTH
            if self._config.is_production
            else logs.RetentionDays.ONE_WEEK,
            removal_policy=RemovalPolicy.DESTROY,
        )

        return log_group

    def _create_rest_api(self) -> apigateway.RestApi:
        """
        Create REST API with throttling and logging.

        The API is configured with:
        - Throttling based on environment configuration
        - CloudWatch logging for access logs
        - X-Ray tracing for distributed request tracking
        - CORS configuration for frontend access

        Returns:
            apigateway.RestApi: The REST API
        """
        api_config = self._config.api

        # Create REST API with deployment options
        api = apigateway.RestApi(
            self,
            "AssetApi",
            rest_api_name=f"{self._config.stack_prefix}-asset-api",
            description=f"Asset Management API ({self._config.environment_name})",
            deploy_options=apigateway.StageOptions(
                stage_name="v1",
                # Throttling configuration
                throttling_rate_limit=api_config.throttling_rate_limit,
                throttling_burst_limit=api_config.throttling_burst_limit,
                # Logging configuration
                logging_level=apigateway.MethodLoggingLevel.INFO
                if api_config.enable_access_logging
                else apigateway.MethodLoggingLevel.OFF,
                data_trace_enabled=api_config.enable_access_logging,
                metrics_enabled=True,
                # X-Ray tracing
                tracing_enabled=api_config.enable_xray_tracing,
                # Access logging
                access_log_destination=apigateway.LogGroupLogDestination(
                    self._access_log_group
                ),
                access_log_format=apigateway.AccessLogFormat.json_with_standard_fields(
                    caller=True,
                    http_method=True,
                    ip=True,
                    protocol=True,
                    request_time=True,
                    resource_path=True,
                    response_length=True,
                    status=True,
                    user=True,
                ),
            ),
            # Default CORS configuration
            default_cors_preflight_options=apigateway.CorsOptions(
                allow_origins=apigateway.Cors.ALL_ORIGINS,
                allow_methods=apigateway.Cors.ALL_METHODS,
                allow_headers=[
                    "Content-Type",
                    "X-Amz-Date",
                    "Authorization",
                    "X-Api-Key",
                    "X-Amz-Security-Token",
                    "X-Amz-User-Agent",
                ],
                max_age=Duration.hours(1),
            ),
            # Endpoint configuration
            endpoint_types=[apigateway.EndpointType.REGIONAL],
            # Cloud Watch role for logging
            cloud_watch_role=True,
        )

        # Add Gateway Responses with CORS headers for 4xx/5xx errors
        # This ensures that when API Gateway itself returns errors (e.g. 401
        # from the Cognito authorizer), CORS headers are still present so the
        # browser doesn't block the response.
        apigateway.GatewayResponse(
            self,
            "GatewayResponse4XX",
            rest_api=api,
            type=apigateway.ResponseType.DEFAULT_4_XX,
            response_headers={
                "Access-Control-Allow-Origin": "'*'",
                "Access-Control-Allow-Headers": "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token,X-Amz-User-Agent'",
                "Access-Control-Allow-Methods": "'GET,POST,PUT,PATCH,DELETE,OPTIONS'",
            },
        )
        apigateway.GatewayResponse(
            self,
            "GatewayResponse5XX",
            rest_api=api,
            type=apigateway.ResponseType.DEFAULT_5_XX,
            response_headers={
                "Access-Control-Allow-Origin": "'*'",
                "Access-Control-Allow-Headers": "'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token,X-Amz-User-Agent'",
                "Access-Control-Allow-Methods": "'GET,POST,PUT,PATCH,DELETE,OPTIONS'",
            },
        )

        # Add a health check endpoint
        health_resource = api.root.add_resource("health")
        health_resource.add_method(
            "GET",
            apigateway.MockIntegration(
                integration_responses=[
                    apigateway.IntegrationResponse(
                        status_code="200",
                        response_templates={
                            "application/json": '{"status": "healthy", "version": "1.0.0"}'
                        },
                    )
                ],
                passthrough_behavior=apigateway.PassthroughBehavior.NEVER,
                request_templates={"application/json": '{"statusCode": 200}'},
            ),
            method_responses=[
                apigateway.MethodResponse(
                    status_code="200",
                    response_models={
                        "application/json": apigateway.Model.EMPTY_MODEL
                    },
                )
            ],
        )

        return api

    def _create_waf_web_acl(self) -> wafv2.CfnWebACL:
        """
        Create WAF Web ACL with AWS managed rules and rate limiting.

        The Web ACL includes:
        - AWS Managed Rules Common Rule Set (OWASP Top 10)
        - Rate limiting rule to prevent abuse
        - CloudWatch metrics for monitoring

        Returns:
            wafv2.CfnWebACL: The WAF Web ACL
        """
        api_config = self._config.api

        web_acl = wafv2.CfnWebACL(
            self,
            "ApiWebAcl",
            name=f"{self._config.stack_prefix}-api-waf",
            description=f"WAF-Web-ACL-for-Asset-Management-API-{self._config.environment_name}",
            scope="REGIONAL",
            default_action=wafv2.CfnWebACL.DefaultActionProperty(allow={}),
            visibility_config=wafv2.CfnWebACL.VisibilityConfigProperty(
                cloud_watch_metrics_enabled=True,
                metric_name=f"{self._config.stack_prefix}-api-waf",
                sampled_requests_enabled=True,
            ),
            rules=[
                # AWS Managed Rules - Common Rule Set (OWASP Top 10)
                wafv2.CfnWebACL.RuleProperty(
                    name="AWSManagedRulesCommonRuleSet",
                    priority=1,
                    override_action=wafv2.CfnWebACL.OverrideActionProperty(none={}),
                    statement=wafv2.CfnWebACL.StatementProperty(
                        managed_rule_group_statement=wafv2.CfnWebACL.ManagedRuleGroupStatementProperty(
                            vendor_name="AWS",
                            name="AWSManagedRulesCommonRuleSet",
                        )
                    ),
                    visibility_config=wafv2.CfnWebACL.VisibilityConfigProperty(
                        cloud_watch_metrics_enabled=True,
                        metric_name="AWSManagedRulesCommonRuleSet",
                        sampled_requests_enabled=True,
                    ),
                ),
                # AWS Managed Rules - Known Bad Inputs
                wafv2.CfnWebACL.RuleProperty(
                    name="AWSManagedRulesKnownBadInputsRuleSet",
                    priority=2,
                    override_action=wafv2.CfnWebACL.OverrideActionProperty(none={}),
                    statement=wafv2.CfnWebACL.StatementProperty(
                        managed_rule_group_statement=wafv2.CfnWebACL.ManagedRuleGroupStatementProperty(
                            vendor_name="AWS",
                            name="AWSManagedRulesKnownBadInputsRuleSet",
                        )
                    ),
                    visibility_config=wafv2.CfnWebACL.VisibilityConfigProperty(
                        cloud_watch_metrics_enabled=True,
                        metric_name="AWSManagedRulesKnownBadInputsRuleSet",
                        sampled_requests_enabled=True,
                    ),
                ),
                # AWS Managed Rules - SQL Injection
                wafv2.CfnWebACL.RuleProperty(
                    name="AWSManagedRulesSQLiRuleSet",
                    priority=3,
                    override_action=wafv2.CfnWebACL.OverrideActionProperty(none={}),
                    statement=wafv2.CfnWebACL.StatementProperty(
                        managed_rule_group_statement=wafv2.CfnWebACL.ManagedRuleGroupStatementProperty(
                            vendor_name="AWS",
                            name="AWSManagedRulesSQLiRuleSet",
                        )
                    ),
                    visibility_config=wafv2.CfnWebACL.VisibilityConfigProperty(
                        cloud_watch_metrics_enabled=True,
                        metric_name="AWSManagedRulesSQLiRuleSet",
                        sampled_requests_enabled=True,
                    ),
                ),
                # Rate limiting rule
                wafv2.CfnWebACL.RuleProperty(
                    name="RateLimitRule",
                    priority=4,
                    action=wafv2.CfnWebACL.RuleActionProperty(block={}),
                    statement=wafv2.CfnWebACL.StatementProperty(
                        rate_based_statement=wafv2.CfnWebACL.RateBasedStatementProperty(
                            limit=api_config.waf_rate_limit,
                            aggregate_key_type="IP",
                        )
                    ),
                    visibility_config=wafv2.CfnWebACL.VisibilityConfigProperty(
                        cloud_watch_metrics_enabled=True,
                        metric_name="RateLimitRule",
                        sampled_requests_enabled=True,
                    ),
                ),
            ],
        )

        return web_acl

    def _associate_waf_with_api(self) -> None:
        """Associate WAF Web ACL with API Gateway stage."""
        if self.web_acl is None:
            return

        wafv2.CfnWebACLAssociation(
            self,
            "ApiWafAssociation",
            resource_arn=self.api.deployment_stage.stage_arn,
            web_acl_arn=self.web_acl.attr_arn,
        )

    def _create_usage_plan(self) -> apigateway.UsagePlan:
        """
        Create usage plan for API key management.

        Returns:
            apigateway.UsagePlan: The usage plan
        """
        api_config = self._config.api

        usage_plan = apigateway.UsagePlan(
            self,
            "ApiUsagePlan",
            name=f"{self._config.stack_prefix}-usage-plan",
            description=f"Usage plan for Asset Management API ({self._config.environment_name})",
            throttle=apigateway.ThrottleSettings(
                rate_limit=api_config.throttling_rate_limit,
                burst_limit=api_config.throttling_burst_limit,
            ),
            quota=apigateway.QuotaSettings(
                limit=10000,  # 10,000 requests per day
                period=apigateway.Period.DAY,
            ),
            api_stages=[
                apigateway.UsagePlanPerApiStage(
                    api=self.api,
                    stage=self.api.deployment_stage,
                )
            ],
        )

        return usage_plan

    def _create_api_key(self) -> apigateway.ApiKey:
        """
        Create API key for usage plan.

        Returns:
            apigateway.ApiKey: The API key
        """
        api_key = apigateway.ApiKey(
            self,
            "ApiKey",
            api_key_name=f"{self._config.stack_prefix}-api-key",
            description=f"API key for Asset Management API ({self._config.environment_name})",
            enabled=True,
        )

        # Associate API key with usage plan
        self.usage_plan.add_api_key(api_key)

        return api_key

    def _create_outputs(self) -> None:
        """Create CloudFormation outputs for cross-stack references."""
        CfnOutput(
            self,
            "ApiEndpoint",
            value=self.api.url,
            description="API Gateway endpoint URL",
            export_name=f"{self._config.stack_prefix}-api-endpoint",
        )

        CfnOutput(
            self,
            "ApiId",
            value=self.api.rest_api_id,
            description="API Gateway REST API ID",
            export_name=f"{self._config.stack_prefix}-api-id",
        )

        CfnOutput(
            self,
            "ApiStageArn",
            value=self.api.deployment_stage.stage_arn,
            description="API Gateway stage ARN",
            export_name=f"{self._config.stack_prefix}-api-stage-arn",
        )

        if self.web_acl:
            CfnOutput(
                self,
                "WebAclArn",
                value=self.web_acl.attr_arn,
                description="WAF Web ACL ARN",
                export_name=f"{self._config.stack_prefix}-waf-arn",
            )

        CfnOutput(
            self,
            "UsagePlanId",
            value=self.usage_plan.usage_plan_id,
            description="API usage plan ID",
            export_name=f"{self._config.stack_prefix}-usage-plan-id",
        )

        CfnOutput(
            self,
            "ApiKeyId",
            value=self.api_key.key_id,
            description="API key ID",
            export_name=f"{self._config.stack_prefix}-api-key-id",
        )

        CfnOutput(
            self,
            "AccessLogGroupArn",
            value=self._access_log_group.log_group_arn,
            description="API access log group ARN",
            export_name=f"{self._config.stack_prefix}-api-access-log-arn",
        )

    def add_lambda_integration(
        self,
        resource_path: str,
        http_method: str,
        lambda_function,
        api_key_required: bool = False,
    ) -> apigateway.Method:
        """
        Add a Lambda integration to the API.

        This method is used to add Lambda function integrations to the API
        for handling specific resource paths and HTTP methods.

        Args:
            resource_path: The resource path (e.g., "/assets")
            http_method: The HTTP method (e.g., "GET", "POST")
            lambda_function: The Lambda function to integrate
            api_key_required: Whether an API key is required

        Returns:
            apigateway.Method: The created API method
        """
        # Create or get the resource
        resource = self._get_or_create_resource(resource_path)

        # Create Lambda integration
        integration = apigateway.LambdaIntegration(
            lambda_function,
            proxy=True,
            allow_test_invoke=True,
        )

        # Add method to resource
        method = resource.add_method(
            http_method,
            integration,
            api_key_required=api_key_required,
        )

        return method

    def _get_or_create_resource(self, resource_path: str) -> apigateway.IResource:
        """
        Get or create a resource at the specified path.

        Uses an internal cache to track created resources and avoid duplicates.

        Args:
            resource_path: The resource path (e.g., "/assets/{assetId}")

        Returns:
            apigateway.IResource: The resource at the specified path
        """
        # Initialize resource cache on first call
        if not hasattr(self, "_resource_cache"):
            self._resource_cache: dict[str, apigateway.IResource] = {}

        # Remove leading slash and split path
        path_parts = resource_path.strip("/").split("/")

        # Build path incrementally
        current_resource = self.api.root
        current_path = ""

        for part in path_parts:
            if not part:
                continue

            current_path = f"{current_path}/{part}"

            if current_path in self._resource_cache:
                current_resource = self._resource_cache[current_path]
            else:
                current_resource = current_resource.add_resource(part)
                self._resource_cache[current_path] = current_resource

        return current_resource
