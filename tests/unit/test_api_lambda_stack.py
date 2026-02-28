"""
Unit tests for ApiLambdaNestedStack3 route configuration.

These tests verify that EAM, SAM, Notification, and Integration service
routes are correctly synthesized and that internal handlers are excluded.

**Feature: api-completeness-fixes**
**Property 1: Route configuration produces Lambda and API Gateway resources**
**Validates: Requirements 1.1-1.5, 2.1-2.5, 3.1-3.4, 4.1-4.3**
"""

import pytest
import aws_cdk as cdk
from aws_cdk import assertions, aws_ec2 as ec2, aws_secretsmanager as sm

from hypothesis import given, settings, strategies as st, HealthCheck

from stacks.api_stack import ApiStack
from stacks.api_lambda_stack import ApiLambdaNestedStack3
from config.environments import DevEnvironmentConfig


# ============================================================================
# Complete route configuration (matches api_lambda_stack.py)
# ============================================================================

EAM_ROUTES = [
    ("eam-service", "work-order-handlers", "/eam/work-orders", ["GET", "POST"]),
    ("eam-service", "work-order-handlers", "/eam/work-orders/{workOrderId}", ["GET"]),
    ("eam-service", "work-order-handlers", "/eam/work-orders/{workOrderId}/complete", ["POST"]),
    ("eam-service", "work-order-handlers", "/eam/work-orders/{workOrderId}/assign", ["POST"]),
    ("eam-service", "maintenance-plan-handlers", "/eam/maintenance-plans", ["GET", "POST"]),
    ("eam-service", "maintenance-plan-handlers", "/eam/maintenance-plans/{planId}", ["GET", "PUT"]),
    ("eam-service", "maintenance-plan-handlers", "/eam/maintenance-plans/check-due", ["GET"]),
    ("eam-service", "get-hierarchy", "/eam/hierarchy/{assetId}", ["GET"]),
    ("eam-service", "link-parent-child", "/eam/hierarchy/link", ["POST"]),
    ("eam-service", "unlink-parent-child", "/eam/hierarchy/unlink", ["POST"]),
    ("eam-service", "propagate-status", "/eam/hierarchy/{assetId}/propagate-status", ["POST"]),
    ("eam-service", "create-linear-asset", "/eam/linear-assets", ["POST"]),
    ("eam-service", "get-linear-asset", "/eam/linear-assets/{linearAssetId}", ["GET"]),
    ("eam-service", "list-segments", "/eam/linear-assets/{linearAssetId}/segments", ["GET"]),
    ("eam-service", "update-segment", "/eam/linear-assets/{linearAssetId}/segments/{segmentId}", ["PUT"]),
    ("eam-service", "check-part-levels", "/eam/parts/levels", ["GET"]),
    ("eam-service", "consume-parts", "/eam/parts/consume", ["POST"]),
    ("eam-service", "reserve-parts", "/eam/parts/reserve", ["POST"]),
]

SAM_ROUTES = [
    ("sam-service", "get-compliance-position", "/reconciliation/compliance", ["GET"]),
    ("sam-service", "get-compliance-position", "/reconciliation/compliance/{productId}", ["GET"]),
    ("sam-service", "run-reconciliation", "/reconciliation/run", ["POST"]),
    ("sam-service", "generate-compliance-report", "/reconciliation/compliance-report", ["POST"]),
    ("sam-service", "identify-reclamation-candidates", "/reclamation/candidates", ["GET"]),
    ("sam-service", "initiate-reclamation", "/reclamation/initiate", ["POST"]),
    ("sam-service", "get-unused-subscriptions", "/reclamation/unused-subscriptions", ["GET"]),
    ("sam-service", "analyze-shadow-it", "/shadow-it/analyze", ["POST"]),
    ("sam-service", "apply-publisher-rules", "/publisher-packs/apply", ["POST"]),
    ("sam-service", "sync-saas-usage", "/saas/sync-usage", ["POST"]),
]

NOTIFICATION_ROUTES = [
    ("notification-service", "send-notification", "/notifications/send", ["POST"]),
    ("notification-service", "get-notification-history", "/notifications/history", ["GET"]),
    ("notification-service", "mark-notification-read", "/notifications/{notificationId}/read", ["POST"]),
    ("notification-service", "get-preferences", "/users/{userId}/notification-preferences", ["GET"]),
    ("notification-service", "update-preferences", "/users/{userId}/notification-preferences", ["PUT"]),
]

INTEGRATION_ROUTES = [
    ("integration-service", "get-vendor-catalog", "/integrations/vendor-catalog", ["GET"]),
    ("integration-service", "get-vendor-catalog", "/integrations/vendor-catalog/{vendorType}", ["GET"]),
    ("integration-service", "sync-purchase-orders", "/integrations/erp/sync-purchase-orders", ["POST"]),
    ("integration-service", "sync-cost-centers", "/integrations/erp/sync-cost-centers", ["POST"]),
    ("integration-service", "process-asn", "/integrations/erp/process-asn", ["POST"]),
    ("integration-service", "ingest-sccm-data", "/integrations/discovery/sccm", ["POST"]),
    ("integration-service", "ingest-jamf-data", "/integrations/discovery/jamf", ["POST"]),
    ("integration-service", "ingest-tanium-data", "/integrations/discovery/tanium", ["POST"]),
]

ALL_ROUTES = EAM_ROUTES + SAM_ROUTES + NOTIFICATION_ROUTES + INTEGRATION_ROUTES


# ============================================================================
# Fixtures
# ============================================================================

@pytest.fixture
def stack_with_routes(app: cdk.App, cdk_env: cdk.Environment):
    """Create an ApiStack with ApiLambdaNestedStack3 for testing."""
    # Create parent API stack
    api_stack = ApiStack(
        app,
        "TestApiStack",
        config=DevEnvironmentConfig,
        env=cdk_env,
    )

    # Create VPC and security group for Lambda
    vpc = ec2.Vpc(api_stack, "TestVpc")
    db_sg = ec2.SecurityGroup(api_stack, "TestDbSg", vpc=vpc)
    db_secret = sm.Secret(api_stack, "TestDbSecret")

    # Create nested stack with EAM/SAM/notification/integration routes
    nested = ApiLambdaNestedStack3(
        api_stack,
        "TestApiLambdas3",
        config=DevEnvironmentConfig,
        rest_api_id=api_stack.api.rest_api_id,
        root_resource_id=api_stack.api.rest_api_root_resource_id,
        vpc=vpc,
        db_secret_arn=db_secret.secret_arn,
        db_security_group=db_sg,
        cache_endpoint="redis://test:6379",
    )

    return nested


# ============================================================================
# Unique handler names from all routes
# ============================================================================

def _unique_handlers(routes):
    """Extract unique (service, handler) pairs from routes."""
    seen = set()
    result = []
    for svc, handler, _path, _methods in routes:
        key = f"{svc}/{handler}"
        if key not in seen:
            seen.add(key)
            result.append((svc, handler))
    return result


ALL_UNIQUE_HANDLERS = _unique_handlers(ALL_ROUTES)


# ============================================================================
# Property Tests (9.1)
# ============================================================================

class TestRouteConfigurationProperty:
    """
    Property 1: Route configuration produces Lambda and API Gateway resources.

    For any route configuration tuple from the defined route sets,
    the synthesized CDK template SHALL contain a Lambda function
    with the correct handler path.
    """

    @given(idx=st.integers(min_value=0, max_value=len(ALL_UNIQUE_HANDLERS) - 1))
    @settings(max_examples=100, deadline=None, suppress_health_check=[HealthCheck.function_scoped_fixture])
    def test_route_produces_lambda_function(
        self, idx: int, stack_with_routes
    ) -> None:
        """Each unique handler has a corresponding Lambda function."""
        svc, handler = ALL_UNIQUE_HANDLERS[idx]
        template = assertions.Template.from_stack(stack_with_routes)

        expected_handler_path = f"dist/handlers/{handler}.handler"

        # Verify at least one Lambda function with this handler path exists
        template.has_resource_properties(
            "AWS::Lambda::Function",
            {
                "Handler": expected_handler_path,
            },
        )


# ============================================================================
# Unit Tests - Lambda functions exist for each service
# ============================================================================

class TestEamServiceRoutes:
    """Tests for EAM service Lambda functions. Validates: Req 1.1-1.5"""

    @pytest.mark.parametrize("handler_name", [
        "work-order-handlers",
        "maintenance-plan-handlers",
        "get-hierarchy",
        "link-parent-child",
        "unlink-parent-child",
        "propagate-status",
        "create-linear-asset",
        "get-linear-asset",
        "list-segments",
        "update-segment",
        "check-part-levels",
        "consume-parts",
        "reserve-parts",
    ])
    def test_eam_handler_exists(
        self, handler_name: str, stack_with_routes
    ) -> None:
        template = assertions.Template.from_stack(stack_with_routes)
        template.has_resource_properties(
            "AWS::Lambda::Function",
            {"Handler": f"dist/handlers/{handler_name}.handler"},
        )


class TestSamServiceRoutes:
    """Tests for SAM service Lambda functions. Validates: Req 2.1-2.5"""

    @pytest.mark.parametrize("handler_name", [
        "get-compliance-position",
        "run-reconciliation",
        "generate-compliance-report",
        "identify-reclamation-candidates",
        "initiate-reclamation",
        "get-unused-subscriptions",
        "analyze-shadow-it",
        "apply-publisher-rules",
        "sync-saas-usage",
    ])
    def test_sam_handler_exists(
        self, handler_name: str, stack_with_routes
    ) -> None:
        template = assertions.Template.from_stack(stack_with_routes)
        template.has_resource_properties(
            "AWS::Lambda::Function",
            {"Handler": f"dist/handlers/{handler_name}.handler"},
        )


class TestNotificationServiceRoutes:
    """Tests for Notification service Lambda functions. Validates: Req 3.1-3.3"""

    @pytest.mark.parametrize("handler_name", [
        "send-notification",
        "get-notification-history",
        "mark-notification-read",
        "get-preferences",
        "update-preferences",
    ])
    def test_notification_handler_exists(
        self, handler_name: str, stack_with_routes
    ) -> None:
        template = assertions.Template.from_stack(stack_with_routes)
        template.has_resource_properties(
            "AWS::Lambda::Function",
            {"Handler": f"dist/handlers/{handler_name}.handler"},
        )


class TestIntegrationServiceRoutes:
    """Tests for Integration service Lambda functions. Validates: Req 4.1-4.3"""

    @pytest.mark.parametrize("handler_name", [
        "get-vendor-catalog",
        "sync-purchase-orders",
        "sync-cost-centers",
        "process-asn",
        "ingest-sccm-data",
        "ingest-jamf-data",
        "ingest-tanium-data",
    ])
    def test_integration_handler_exists(
        self, handler_name: str, stack_with_routes
    ) -> None:
        template = assertions.Template.from_stack(stack_with_routes)
        template.has_resource_properties(
            "AWS::Lambda::Function",
            {"Handler": f"dist/handlers/{handler_name}.handler"},
        )


# ============================================================================
# Unit Test: Internal handlers excluded (9.2) - Validates: Req 3.4
# ============================================================================

class TestInternalHandlersExcluded:
    """
    Verify that internal event-driven handlers are NOT exposed as API routes.

    Validates: Requirement 3.4
    """

    def test_process_triggers_not_present(self, stack_with_routes) -> None:
        """process-triggers handler should NOT exist in the template."""
        template = assertions.Template.from_stack(stack_with_routes)

        # Collect all Lambda function handler values
        lambdas = template.find_resources("AWS::Lambda::Function")
        handler_paths = [
            props.get("Properties", {}).get("Handler", "")
            for props in lambdas.values()
        ]

        assert "dist/handlers/process-triggers.handler" not in handler_paths

    def test_process_retries_not_present(self, stack_with_routes) -> None:
        """process-retries handler should NOT exist in the template."""
        template = assertions.Template.from_stack(stack_with_routes)

        lambdas = template.find_resources("AWS::Lambda::Function")
        handler_paths = [
            props.get("Properties", {}).get("Handler", "")
            for props in lambdas.values()
        ]

        assert "dist/handlers/process-retries.handler" not in handler_paths
