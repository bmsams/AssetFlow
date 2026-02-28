#!/usr/bin/env python3
"""
Asset Management System - CDK Application Entry Point

This is the main entry point for the AWS CDK application that deploys
the Asset Management System infrastructure. The system follows AWS
Well-Architected Framework principles across all six pillars.

Architecture Overview:
- Multi-account AWS strategy (Development, Staging, Production)
- Serverless-first approach with Lambda functions
- Event-driven communication via SQS/SNS
- Aurora PostgreSQL for relational data
- ElastiCache Redis for caching
- CloudFront for frontend delivery
"""

import aws_cdk as cdk

from config.environments import EnvironmentConfig, get_environment_config
from stacks.network_stack import NetworkStack
from stacks.database_stack import DatabaseStack
from stacks.cache_stack import CacheStack
from stacks.messaging_stack import MessagingStack
from stacks.api_stack import ApiStack
from stacks.auth_stack import AuthStack
from stacks.storage_stack import StorageStack
from stacks.monitoring_stack import MonitoringStack
from stacks.frontend_stack import FrontendStack
from stacks.migration_stack import MigrationStack


def create_app() -> cdk.App:
    """
    Create and configure the CDK application with all stacks.
    
    Returns:
        cdk.App: The configured CDK application
    """
    app = cdk.App()
    
    # Get environment from context or default to 'dev'
    env_name = app.node.try_get_context("env") or "dev"
    config = get_environment_config(env_name)
    
    # Create CDK environment from config
    cdk_env = cdk.Environment(
        account=config.aws_account_id,
        region=config.aws_region,
    )
    
    # Common tags for all resources
    common_tags = {
        "Project": "AssetManagementSystem",
        "Environment": config.environment_name,
        "ManagedBy": "CDK",
        "CostCenter": config.cost_center,
    }
    
    # Apply tags to all resources in the app
    for key, value in common_tags.items():
        cdk.Tags.of(app).add(key, value)
    
    # Stack naming convention: {project}-{stack}-{environment}
    stack_prefix = f"ams-{config.environment_name}"
    
    # Network Stack - VPC, Subnets, NAT Gateways, VPC Endpoints
    network_stack = NetworkStack(
        app,
        f"{stack_prefix}-network",
        config=config,
        env=cdk_env,
        description=f"Asset Management System - Network Infrastructure ({config.environment_name})",
    )
    
    # Database Stack - Aurora PostgreSQL Serverless v2
    database_stack = DatabaseStack(
        app,
        f"{stack_prefix}-database",
        config=config,
        vpc=network_stack.vpc,
        env=cdk_env,
        description=f"Asset Management System - Database Infrastructure ({config.environment_name})",
    )
    database_stack.add_dependency(network_stack)
    
    # Cache Stack - ElastiCache Redis
    cache_stack = CacheStack(
        app,
        f"{stack_prefix}-cache",
        config=config,
        vpc=network_stack.vpc,
        env=cdk_env,
        description=f"Asset Management System - Cache Infrastructure ({config.environment_name})",
    )
    cache_stack.add_dependency(network_stack)
    
    # Messaging Stack - SQS queues and SNS topics
    messaging_stack = MessagingStack(
        app,
        f"{stack_prefix}-messaging",
        config=config,
        env=cdk_env,
        description=f"Asset Management System - Messaging Infrastructure ({config.environment_name})",
    )
    
    # Auth Stack - Cognito User Pool
    auth_stack = AuthStack(
        app,
        f"{stack_prefix}-auth",
        config=config,
        env=cdk_env,
        description=f"Asset Management System - Authentication Infrastructure ({config.environment_name})",
    )

    # API Stack - API Gateway with WAF and Cognito Authorizer
    api_stack = ApiStack(
        app,
        f"{stack_prefix}-api",
        config=config,
        user_pool=auth_stack.user_pool,
        env=cdk_env,
        description=f"Asset Management System - API Infrastructure ({config.environment_name})",
    )
    api_stack.add_dependency(network_stack)
    api_stack.add_dependency(database_stack)
    api_stack.add_dependency(cache_stack)
    api_stack.add_dependency(auth_stack)
    
    # Storage Stack - S3 buckets for documents, attachments, and static assets
    storage_stack = StorageStack(
        app,
        f"{stack_prefix}-storage",
        config=config,
        env=cdk_env,
        description=f"Asset Management System - Storage Infrastructure ({config.environment_name})",
    )
    
    # Monitoring Stack - CloudWatch dashboards, alarms, and log groups
    monitoring_stack = MonitoringStack(
        app,
        f"{stack_prefix}-monitoring",
        config=config,
        env=cdk_env,
        description=f"Asset Management System - Monitoring Infrastructure ({config.environment_name})",
    )
    
    # Frontend Stack - CloudFront distribution for static asset delivery
    # FrontendStack creates its own bucket for frontend assets to keep
    # frontend deployment independent from storage stack
    frontend_stack = FrontendStack(
        app,
        f"{stack_prefix}-frontend",
        config=config,
        env=cdk_env,
        description=f"Asset Management System - Frontend Infrastructure ({config.environment_name})",
    )
    # No dependency on storage_stack - frontend has its own bucket
    
    # Wire up API routes with Lambda integrations
    # These methods create Lambda functions in VPC with DB/cache access
    # and register them as API Gateway integrations.
    # Uses two nested stacks to stay under CloudFormation's 500-resource limit.
    # Each nested stack imports the API via from_rest_api_attributes() so that
    # API Gateway Resource/Method constructs stay within the nested stack scope.
    _cache_endpoint = cache_stack.primary_endpoint if hasattr(cache_stack, 'primary_endpoint') else None

    from stacks.api_lambda_stack import ApiLambdaNestedStack, ApiLambdaNestedStack2, ApiLambdaNestedStack3, ApiLambdaNestedStack4

    _common_lambda_kwargs = dict(
        config=config,
        rest_api_id=api_stack.api.rest_api_id,
        root_resource_id=api_stack.api.rest_api_root_resource_id,
        vpc=network_stack.vpc,
        db_secret_arn=database_stack.db_secret.secret_arn,
        db_security_group=database_stack.db_security_group,
        cache_endpoint=_cache_endpoint,
        db_host=database_stack.cluster.cluster_endpoint.hostname,
        db_port=str(database_stack.cluster.cluster_endpoint.port),
        db_name="assetmgmt",
        # Import from messaging stack export to avoid coupling api deploy to the messaging stack
        # (which may be in a drifted/broken state in dev).
        events_topic_arn=cdk.Fn.import_value(f"{config.stack_prefix}-event-topic-arn"),
        authorizer_id=api_stack.authorizer.ref if api_stack.authorizer else None,
        # OpenSearch endpoint — will be populated when an OpenSearch stack is added
        opensearch_endpoint=None,
    )

    # Core services: asset, admin, stockroom
    ApiLambdaNestedStack(
        api_stack,
        "ApiLambdas",
        **_common_lambda_kwargs,
    )

    # Operational services: procurement, report, lifecycle
    ApiLambdaNestedStack2(
        api_stack,
        "ApiLambdas2",
        **_common_lambda_kwargs,
    )

    # Extended services: EAM, SAM, notification, integration
    ApiLambdaNestedStack3(
        api_stack,
        "ApiLambdas3",
        **_common_lambda_kwargs,
    )

    # HAM services: transfers, loaners, disposal, audits, stockroom inventory
    ApiLambdaNestedStack4(
        api_stack,
        "ApiLambdas4",
        **_common_lambda_kwargs,
    )

    # Migration Stack - Lambda function for running database migrations
    # This allows migrations to be run without direct VPC connectivity
    migration_stack = MigrationStack(
        app,
        f"{stack_prefix}-migration",
        config=config,
        vpc=network_stack.vpc,
        db_secret_arn=database_stack.db_secret.secret_arn,
        db_security_group=database_stack.db_security_group,
        env=cdk_env,
        description=f"Asset Management System - Migration Infrastructure ({config.environment_name})",
    )
    migration_stack.add_dependency(database_stack)
    
    return app


# Application entry point
app = create_app()
app.synth()
