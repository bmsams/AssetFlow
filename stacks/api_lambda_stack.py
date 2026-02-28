"""
API Lambda Nested Stacks for Asset Management System.

Creates all Lambda functions for API Gateway integrations as NestedStacks
inside the API stack. Routes are split across three nested stacks to stay
under CloudFormation's 500-resource limit per stack.

Each nested stack imports the API Gateway using from_rest_api_attributes()
so that API Gateway Resource and Method constructs are created within the
nested stack's scope rather than the parent stack.
"""

from aws_cdk import (
    Duration,
    NestedStack,
    RemovalPolicy,
    aws_apigateway as apigateway,
    aws_ec2 as ec2,
    aws_iam as iam,
    aws_lambda as lambda_,
    aws_logs as logs,
)
from constructs import Construct

from config.environments import EnvironmentConfig


class _ApiLambdaNestedBase(NestedStack):
    """Base nested stack with shared Lambda creation and route wiring logic."""

    def __init__(
        self,
        scope: Construct,
        construct_id: str,
        config: EnvironmentConfig,
        rest_api_id: str,
        root_resource_id: str,
        vpc: ec2.IVpc,
        db_secret_arn: str,
        db_security_group: ec2.ISecurityGroup,
        cache_endpoint: str = None,
        events_topic_arn: str = None,
        authorizer_id: str = None,
        db_host: str = None,
        db_port: str = None,
        db_name: str = None,
        opensearch_endpoint: str = None,
        **kwargs,
    ) -> None:
        super().__init__(scope, construct_id, **kwargs)

        self._config = config
        self._vpc = vpc
        self._db_secret_arn = db_secret_arn
        self._db_security_group = db_security_group
        self._cache_endpoint = cache_endpoint
        self._events_topic_arn = events_topic_arn
        self._authorizer_id = authorizer_id
        self._db_host = db_host
        self._db_port = db_port
        self._db_name = db_name
        self._opensearch_endpoint = opensearch_endpoint
        self._resource_cache: dict[str, apigateway.IResource] = {}
        self._service_sg_cache: dict[str, ec2.SecurityGroup] = {}
        # Cache Lambdas across multiple _add_routes calls within the same nested stack.
        # Without this, re-adding routes for an existing (service, handler) pair creates
        # duplicate Constructs (e.g. log groups) and synthesis fails.
        self._lambda_cache: dict[str, lambda_.Function] = {}

        # Import the API inside this nested stack so resources stay here
        self._api = apigateway.RestApi.from_rest_api_attributes(
            self,
            "ImportedApi",
            rest_api_id=rest_api_id,
            root_resource_id=root_resource_id,
        )

    # ------------------------------------------------------------------
    # Lambda creation
    # ------------------------------------------------------------------

    def _create_lambda(
        self,
        service_name: str,
        handler_name: str,
        description: str = None,
    ) -> lambda_.Function:
        function_name = f"{self._config.stack_prefix}-{service_name}-{handler_name}"

        log_group = logs.LogGroup(
            self,
            f"{service_name}-{handler_name}-logs",
            log_group_name=f"/aws/lambda/{function_name}",
            retention=logs.RetentionDays.ONE_MONTH
            if self._config.is_production
            else logs.RetentionDays.ONE_WEEK,
            removal_policy=RemovalPolicy.DESTROY,
        )

        # Share one SG per service to avoid exceeding DB SG ingress rule limits
        if service_name in self._service_sg_cache:
            lambda_sg = self._service_sg_cache[service_name]
        else:
            lambda_sg = ec2.SecurityGroup(
                self,
                f"{service_name}-sg",
                vpc=self._vpc,
                description=f"SG for {service_name} lambdas",
                allow_all_outbound=True,
            )
            lambda_sg.connections.allow_to(
                self._db_security_group,
                ec2.Port.tcp(5432),
                description=f"Allow {service_name} to Aurora",
            )
            self._service_sg_cache[service_name] = lambda_sg

        env_vars = {
            "DB_SECRET_ARN": self._db_secret_arn,
            "AWS_NODEJS_CONNECTION_REUSE_ENABLED": "1",
            "NODE_ENV": self._config.environment_name,
        }
        if self._db_host:
            env_vars["DB_HOST"] = self._db_host
        if self._db_port:
            env_vars["DB_PORT"] = self._db_port
        if self._db_name:
            env_vars["DB_NAME"] = self._db_name
        if self._cache_endpoint:
            # App code expects REDIS_HOST (and optionally REDIS_PORT). Keep the old
            # REDIS_ENDPOINT for backwards compatibility with any services that read it.
            env_vars["REDIS_HOST"] = self._cache_endpoint
            env_vars["REDIS_PORT"] = "6379"
            env_vars["REDIS_ENDPOINT"] = self._cache_endpoint

        if self._events_topic_arn:
            env_vars["EVENTS_TOPIC_ARN"] = self._events_topic_arn

        # Add SERVICE_NAME for all Lambdas (Req 7.2)
        env_vars["SERVICE_NAME"] = f"{service_name}-{handler_name}"

        # Add OPENSEARCH_ENDPOINT for Lambdas that use OpenSearch (Req 7.1)
        if self._opensearch_endpoint:
            env_vars["OPENSEARCH_ENDPOINT"] = self._opensearch_endpoint

        fn = lambda_.Function(
            self,
            f"{service_name}-{handler_name}",
            function_name=function_name,
            description=description or f"{service_name} {handler_name}",
            runtime=lambda_.Runtime.NODEJS_18_X,
            handler=f"dist/handlers/{handler_name}.handler",
            code=lambda_.Code.from_asset(f"backend/packages/services/{service_name}"),
            environment=env_vars,
            vpc=self._vpc,
            vpc_subnets=ec2.SubnetSelection(subnet_type=ec2.SubnetType.PRIVATE_WITH_EGRESS),
            security_groups=[lambda_sg],
            timeout=Duration.seconds(30),
            memory_size=256,
            log_group=log_group,
            tracing=lambda_.Tracing.ACTIVE
            if self._config.api.enable_xray_tracing
            else lambda_.Tracing.DISABLED,
        )
        fn.add_to_role_policy(
            iam.PolicyStatement(
                effect=iam.Effect.ALLOW,
                actions=["secretsmanager:GetSecretValue"],
                resources=[self._db_secret_arn],
            )
        )
        if self._events_topic_arn:
            fn.add_to_role_policy(
                iam.PolicyStatement(
                    effect=iam.Effect.ALLOW,
                    actions=["sns:Publish"],
                    resources=[self._events_topic_arn],
                )
            )
        return fn

    # ------------------------------------------------------------------
    # Route wiring helpers
    # ------------------------------------------------------------------

    def _get_or_create_resource(self, path: str) -> apigateway.IResource:
        parts = path.strip("/").split("/")
        current = self._api.root
        built = ""
        for part in parts:
            if not part:
                continue
            built = f"{built}/{part}"
            if built in self._resource_cache:
                current = self._resource_cache[built]
            else:
                current = current.add_resource(part)
                # Add CORS preflight (OPTIONS) since imported APIs don't
                # inherit default_cors_preflight_options from the parent stack.
                current.add_cors_preflight(
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
                )
                self._resource_cache[built] = current
        return current

    def _add_routes(self, configs: list[tuple[str, str, str, list[str]]]) -> None:
        for svc, handler, path, methods in configs:
            key = f"{svc}/{handler}"
            if key not in self._lambda_cache:
                self._lambda_cache[key] = self._create_lambda(svc, handler)
            resource = self._get_or_create_resource(path)
            for method in methods:
                method_obj = resource.add_method(
                    method,
                    apigateway.LambdaIntegration(self._lambda_cache[key], proxy=True),
                )
                if self._authorizer_id:
                    cfn_method = method_obj.node.default_child
                    if isinstance(cfn_method, apigateway.CfnMethod):
                        cfn_method.authorization_type = "COGNITO_USER_POOLS"
                        cfn_method.authorizer_id = self._authorizer_id



class ApiLambdaNestedStack(_ApiLambdaNestedBase):
    """Nested stack for asset and admin service routes."""

    def __init__(self, scope, construct_id, *, config, rest_api_id, root_resource_id, vpc, db_secret_arn, db_security_group, cache_endpoint=None, opensearch_endpoint=None, **kwargs):
        super().__init__(scope, construct_id, config=config, rest_api_id=rest_api_id, root_resource_id=root_resource_id, vpc=vpc, db_secret_arn=db_secret_arn, db_security_group=db_security_group, cache_endpoint=cache_endpoint, opensearch_endpoint=opensearch_endpoint, **kwargs)
        self._setup_asset_routes()
        self._setup_admin_routes()
        self._setup_stockroom_admin_routes()

    def _setup_asset_routes(self) -> None:
        self._add_routes([
            ("asset-service", "create-asset", "/assets", ["POST"]),
            ("asset-service", "list-assets", "/assets", ["GET"]),
            ("asset-service", "search-assets", "/assets/search", ["GET"]),
            ("asset-service", "get-asset", "/assets/{assetId}", ["GET"]),
            ("asset-service", "update-asset", "/assets/{assetId}", ["PUT"]),
            ("asset-service", "delete-asset", "/assets/{assetId}", ["DELETE"]),
            ("asset-service", "transition-state", "/assets/{assetId}/transition", ["POST"]),
            ("asset-service", "get-audit-log", "/assets/{assetId}/audit", ["GET"]),
            ("asset-service", "link-assets", "/assets/relationships", ["POST"]),
            ("asset-service", "unlink-assets", "/assets/relationships", ["DELETE"]),
            ("asset-service", "get-related-assets", "/assets/{assetId}/relationships", ["GET"]),
        ])

    def _setup_admin_routes(self) -> None:
        self._add_routes([
            ("admin-service", "building-handlers", "/admin/buildings", ["GET", "POST"]),
            ("admin-service", "building-handlers", "/admin/buildings/{buildingId}", ["GET", "PUT"]),
            ("admin-service", "building-handlers", "/admin/buildings/{buildingId}/deactivate", ["POST"]),
            ("admin-service", "floor-handlers", "/admin/floors", ["GET", "POST"]),
            ("admin-service", "floor-handlers", "/admin/floors/{floorId}", ["GET", "PUT"]),
            ("admin-service", "floor-handlers", "/admin/floors/{floorId}/deactivate", ["POST"]),
            ("admin-service", "room-handlers", "/admin/rooms", ["GET", "POST"]),
            ("admin-service", "room-handlers", "/admin/rooms/{roomId}", ["GET", "PUT"]),
            ("admin-service", "room-handlers", "/admin/rooms/{roomId}/deactivate", ["POST"]),
            ("admin-service", "rack-handlers", "/admin/racks", ["GET", "POST"]),
            ("admin-service", "rack-handlers", "/admin/racks/{rackId}", ["GET", "PUT"]),
            ("admin-service", "rack-handlers", "/admin/racks/{rackId}/deactivate", ["POST"]),
            ("admin-service", "department-handlers", "/admin/departments", ["GET", "POST"]),
            ("admin-service", "department-handlers", "/admin/departments/{departmentId}", ["GET", "PUT"]),
            ("admin-service", "department-handlers", "/admin/departments/{departmentId}/deactivate", ["POST"]),
            ("admin-service", "cost-center-handlers", "/admin/cost-centers", ["GET", "POST"]),
            ("admin-service", "cost-center-handlers", "/admin/cost-centers/{costCenterId}", ["GET", "PUT"]),
            ("admin-service", "cost-center-handlers", "/admin/cost-centers/{costCenterId}/deactivate", ["POST"]),
            ("admin-service", "vendor-handlers", "/admin/vendors", ["GET", "POST"]),
            ("admin-service", "vendor-handlers", "/admin/vendors/{vendorId}", ["GET", "PUT"]),
            ("admin-service", "vendor-handlers", "/admin/vendors/{vendorId}/model-prices", ["GET"]),
            ("admin-service", "vendor-handlers", "/admin/vendors/{vendorId}/model-prices/{modelId}", ["PUT", "DELETE"]),
            ("admin-service", "vendor-handlers", "/admin/vendors/{vendorId}/deactivate", ["POST"]),
            ("admin-service", "manufacturer-handlers", "/admin/manufacturers", ["GET", "POST"]),
            ("admin-service", "manufacturer-handlers", "/admin/manufacturers/{manufacturerId}", ["GET", "PUT"]),
            ("admin-service", "manufacturer-handlers", "/admin/manufacturers/{manufacturerId}/deactivate", ["POST"]),
            ("admin-service", "model-handlers", "/admin/models", ["GET", "POST"]),
            ("admin-service", "model-handlers", "/admin/models/{modelId}", ["GET", "PUT"]),
            ("admin-service", "model-handlers", "/admin/models/{modelId}/deactivate", ["POST"]),
            ("admin-service", "user-admin-handlers", "/admin/users", ["GET"]),
            ("admin-service", "user-admin-handlers", "/admin/users/{userId}", ["GET", "PUT"]),
            ("admin-service", "user-admin-handlers", "/admin/users/{userId}/deactivate", ["POST"]),
            ("admin-service", "user-admin-handlers", "/admin/users/{userId}/reactivate", ["POST"]),
            ("admin-service", "user-admin-handlers", "/admin/users/{userId}/roles", ["GET", "POST"]),
            ("admin-service", "user-admin-handlers", "/admin/users/{userId}/roles/{roleId}", ["DELETE"]),
        ])

    def _setup_stockroom_admin_routes(self) -> None:
        self._add_routes([
            ("admin-service", "stockroom-handlers", "/admin/stockrooms", ["GET", "POST"]),
            ("admin-service", "stockroom-handlers", "/admin/stockrooms/{stockroomId}", ["GET", "PUT"]),
            ("admin-service", "stockroom-handlers", "/admin/stockrooms/{stockroomId}/deactivate", ["POST"]),
            ("admin-service", "bin-location-handlers", "/admin/bin-locations", ["GET", "POST"]),
            ("admin-service", "bin-location-handlers", "/admin/bin-locations/{binId}", ["GET", "PUT"]),
            ("admin-service", "bin-location-handlers", "/admin/bin-locations/{binId}/deactivate", ["POST"]),
        ])


class ApiLambdaNestedStack2(_ApiLambdaNestedBase):
    """Nested stack for procurement, report, and lifecycle service routes."""

    def __init__(self, scope, construct_id, *, config, rest_api_id, root_resource_id, vpc, db_secret_arn, db_security_group, cache_endpoint=None, opensearch_endpoint=None, **kwargs):
        super().__init__(scope, construct_id, config=config, rest_api_id=rest_api_id, root_resource_id=root_resource_id, vpc=vpc, db_secret_arn=db_secret_arn, db_security_group=db_security_group, cache_endpoint=cache_endpoint, opensearch_endpoint=opensearch_endpoint, **kwargs)
        self._setup_procurement_routes()
        self._setup_report_routes()
        self._setup_dashboard_routes()
        self._setup_lifecycle_routes()

    def _setup_procurement_routes(self) -> None:
        self._add_routes([
            ("procurement-service", "po-handlers", "/procurement/purchase-orders", ["GET", "POST"]),
            ("procurement-service", "po-handlers", "/procurement/purchase-orders/{poId}", ["GET", "PUT", "DELETE"]),
            ("procurement-service", "po-handlers", "/procurement/purchase-orders/{poId}/lines", ["GET", "POST"]),
            ("procurement-service", "po-handlers", "/procurement/purchase-orders/{poId}/lines/{lineId}", ["PUT", "DELETE"]),
            ("procurement-service", "po-handlers", "/procurement/purchase-orders/{poId}/submit", ["POST"]),
            ("procurement-service", "po-handlers", "/procurement/purchase-orders/{poId}/send", ["POST"]),
            ("procurement-service", "po-handlers", "/procurement/purchase-orders/{poId}/cancel", ["POST"]),
            ("procurement-service", "po-handlers", "/procurement/purchase-orders/{poId}/approve", ["POST"]),
            ("procurement-service", "po-handlers", "/procurement/purchase-orders/{poId}/reject", ["POST"]),
            ("procurement-service", "po-handlers", "/procurement/purchase-orders/{poId}/receipt-accounting", ["POST"]),
            ("procurement-service", "po-handlers", "/procurement/purchase-orders/{poId}/invoice-accounting", ["POST"]),
            ("procurement-service", "po-handlers", "/procurement/purchase-orders/{poId}/close-guard", ["GET"]),
            ("procurement-service", "po-handlers", "/procurement/purchase-orders/{poId}/close", ["POST"]),
            ("procurement-service", "approval-handlers", "/procurement/pending-approvals", ["GET"]),
            ("procurement-service", "requisition-handlers", "/procurement/requisitions", ["GET", "POST"]),
            ("procurement-service", "requisition-handlers", "/procurement/requisitions/{requisitionId}", ["GET"]),
            ("procurement-service", "requisition-handlers", "/procurement/requisitions/{requisitionId}/submit", ["POST"]),
            ("procurement-service", "requisition-handlers", "/procurement/requisitions/{requisitionId}/approve", ["POST"]),
            ("procurement-service", "requisition-handlers", "/procurement/requisitions/{requisitionId}/reject", ["POST"]),
            ("procurement-service", "requisition-handlers", "/procurement/requisitions/{requisitionId}/convert", ["POST"]),
            ("procurement-service", "requisition-handlers", "/procurement/requisitions/{requisitionId}/links", ["GET"]),
        ])

    def _setup_report_routes(self) -> None:
        paths = [
            "/reports/asset-summary", "/reports/asset-aging",
            "/reports/assets-by-location", "/reports/assets-by-department",
            "/reports/cost-center-utilization", "/reports/procurement-spending",
            "/reports/work-order-summary", "/reports/maintenance-compliance",
        ]
        self._add_routes([
            ("report-service", "report-handlers", p, ["GET"]) for p in paths
        ])
        self._add_routes([
            ("report-service", "report-handlers", "/reports/{reportType}/export", ["GET"]),
        ])


    def _setup_dashboard_routes(self) -> None:
        self._add_routes([
            ("report-service", "dashboard-handlers", "/dashboard/summary", ["GET"]),
            ("report-service", "dashboard-handlers", "/dashboard/compliance", ["GET"]),
            ("report-service", "dashboard-handlers", "/dashboard/lease-expirations", ["GET"]),
        ])

    def _setup_lifecycle_routes(self) -> None:
        self._add_routes([
            ("lifecycle-service", "record-receiving", "/lifecycle/receiving/from-po", ["POST"]),
            ("lifecycle-service", "get-receiving", "/lifecycle/receiving/{receivingId}", ["GET"]),
            ("lifecycle-service", "scan-asset", "/lifecycle/receiving/{receivingId}/scan", ["POST"]),
            ("lifecycle-service", "complete-receiving", "/lifecycle/receiving/{receivingId}/complete", ["POST"]),
            ("lifecycle-service", "cancel-receiving", "/lifecycle/receiving/{receivingId}/cancel", ["POST"]),
            ("lifecycle-service", "mark-for-inspection", "/lifecycle/inspection", ["POST"]),
            ("lifecycle-service", "get-inspection", "/lifecycle/inspection/{inspectionId}", ["GET"]),
            ("lifecycle-service", "record-inspection-result", "/lifecycle/inspection/{inspectionId}/result", ["POST"]),
            # Catalog
            ("lifecycle-service", "get-catalog-items", "/lifecycle/catalog/items", ["GET"]),
            ("lifecycle-service", "search-catalog", "/lifecycle/catalog/search", ["GET"]),
            # Contracts
            ("lifecycle-service", "get-contracts-by-vendor", "/lifecycle/contracts", ["GET"]),
            ("lifecycle-service", "create-contract", "/lifecycle/contracts", ["POST"]),
            ("lifecycle-service", "update-contract", "/lifecycle/contracts/{contractId}", ["PUT"]),
            # Deployment & Retirement
            ("lifecycle-service", "deploy-asset", "/lifecycle/deploy", ["POST"]),
            ("lifecycle-service", "initiate-retirement", "/lifecycle/retirement", ["POST"]),
            ("lifecycle-service", "complete-disposal", "/lifecycle/disposal/{assetId}/complete", ["POST"]),
            # Request/Approval Workflow
            ("lifecycle-service", "submit-request", "/lifecycle/requests", ["POST"]),
            ("lifecycle-service", "get-request-status", "/lifecycle/requests/{requestId}", ["GET"]),
            ("lifecycle-service", "route-for-approval", "/lifecycle/requests/{requestId}/route", ["POST"]),
            ("lifecycle-service", "approve-request", "/lifecycle/requests/{requestId}/approve", ["POST"]),
            ("lifecycle-service", "reject-request", "/lifecycle/requests/{requestId}/reject", ["POST"]),
            # Inventory Management
            ("lifecycle-service", "check-stock", "/lifecycle/inventory/check", ["GET"]),
            ("lifecycle-service", "reserve-inventory", "/lifecycle/inventory/reserve", ["POST"]),
            ("lifecycle-service", "assign-to-user", "/lifecycle/assets/{assetId}/assign", ["POST"]),
            # Purchase Orders (lifecycle-initiated)
            ("lifecycle-service", "create-purchase-order", "/lifecycle/purchase-orders", ["POST"]),
            # Inspection History
            ("lifecycle-service", "get-inspection-history", "/lifecycle/inspection/history", ["GET"]),
        ])


class ApiLambdaNestedStack3(_ApiLambdaNestedBase):
    """Nested stack for EAM, SAM, notification, and integration service routes."""

    def __init__(self, scope, construct_id, *, config, rest_api_id, root_resource_id, vpc, db_secret_arn, db_security_group, cache_endpoint=None, opensearch_endpoint=None, **kwargs):
        super().__init__(scope, construct_id, config=config, rest_api_id=rest_api_id, root_resource_id=root_resource_id, vpc=vpc, db_secret_arn=db_secret_arn, db_security_group=db_security_group, cache_endpoint=cache_endpoint, opensearch_endpoint=opensearch_endpoint, **kwargs)
        self._setup_eam_routes()
        self._setup_sam_routes()
        self._setup_notification_routes()
        self._setup_integration_routes()

    def _setup_eam_routes(self) -> None:
        self._add_routes([
            # Work Orders
            ("eam-service", "work-order-handlers", "/eam/work-orders", ["GET", "POST"]),
            ("eam-service", "work-order-handlers", "/eam/work-orders/{workOrderId}", ["GET"]),
            ("eam-service", "work-order-handlers", "/eam/work-orders/{workOrderId}/complete", ["POST"]),
            ("eam-service", "work-order-handlers", "/eam/work-orders/{workOrderId}/assign", ["POST"]),
            # Maintenance Plans
            ("eam-service", "maintenance-plan-handlers", "/eam/maintenance-plans", ["GET", "POST"]),
            ("eam-service", "maintenance-plan-handlers", "/eam/maintenance-plans/{planId}", ["GET", "PUT"]),
            ("eam-service", "maintenance-plan-handlers", "/eam/maintenance-plans/check-due", ["GET"]),
            # Asset Hierarchy
            ("eam-service", "get-hierarchy", "/eam/hierarchy/{assetId}", ["GET"]),
            ("eam-service", "link-parent-child", "/eam/hierarchy/link", ["POST"]),
            ("eam-service", "unlink-parent-child", "/eam/hierarchy/unlink", ["POST"]),
            ("eam-service", "propagate-status", "/eam/hierarchy/{assetId}/propagate-status", ["POST"]),
            # Linear Assets
            ("eam-service", "list-linear-assets", "/eam/linear-assets", ["GET"]),
            ("eam-service", "create-linear-asset", "/eam/linear-assets", ["POST"]),
            ("eam-service", "get-linear-asset", "/eam/linear-assets/{linearAssetId}", ["GET"]),
            ("eam-service", "list-segments", "/eam/linear-assets/{linearAssetId}/segments", ["GET"]),
            ("eam-service", "update-segment", "/eam/linear-assets/{linearAssetId}/segments/{segmentId}", ["PUT"]),
            # Spare Parts
            ("eam-service", "check-part-levels", "/eam/parts/levels", ["GET"]),
            ("eam-service", "consume-parts", "/eam/parts/consume", ["POST"]),
            ("eam-service", "reserve-parts", "/eam/parts/reserve", ["POST"]),
        ])

    def _setup_sam_routes(self) -> None:
        self._add_routes([
            # Reconciliation
            ("sam-service", "get-compliance-position", "/reconciliation/compliance", ["GET"]),
            ("sam-service", "get-compliance-position", "/reconciliation/compliance/{productId}", ["GET"]),
            ("sam-service", "run-reconciliation", "/reconciliation/run", ["POST"]),
            ("sam-service", "generate-compliance-report", "/reconciliation/compliance-report", ["POST"]),
            ("sam-service", "get-reconciliation-summary", "/reconciliation/summary", ["GET"]),
            # Reclamation
            ("sam-service", "identify-reclamation-candidates", "/reclamation/candidates", ["GET"]),
            ("sam-service", "initiate-reclamation", "/reclamation/initiate", ["POST"]),
            ("sam-service", "get-unused-subscriptions", "/reclamation/unused-subscriptions", ["GET"]),
            # Shadow IT
            ("sam-service", "analyze-shadow-it", "/shadow-it/analyze", ["POST"]),
            # Publisher Packs
            ("sam-service", "apply-publisher-rules", "/publisher-packs/apply", ["POST"]),
            # SaaS
            ("sam-service", "sync-saas-usage", "/saas/sync-usage", ["POST"]),
            # Workbench
            ("sam-service", "get-workbench-summary", "/sam/workbench/summary", ["GET"]),
        ])

    def _setup_notification_routes(self) -> None:
        self._add_routes([
            ("notification-service", "send-notification", "/notifications/send", ["POST"]),
            ("notification-service", "get-notification-history", "/notifications/history", ["GET"]),
            ("notification-service", "mark-notification-read", "/notifications/{notificationId}/read", ["POST"]),
            ("notification-service", "get-preferences", "/users/{userId}/notification-preferences", ["GET"]),
            ("notification-service", "update-preferences", "/users/{userId}/notification-preferences", ["PUT"]),
        ])

    def _setup_integration_routes(self) -> None:
        self._add_routes([
            # Vendor Catalog
            ("integration-service", "get-vendor-catalog", "/integrations/vendor-catalog", ["GET"]),
            ("integration-service", "get-vendor-catalog", "/integrations/vendor-catalog/{vendorType}", ["GET"]),
            # ERP Sync
            ("integration-service", "sync-purchase-orders", "/integrations/erp/sync-purchase-orders", ["POST"]),
            ("integration-service", "sync-cost-centers", "/integrations/erp/sync-cost-centers", ["POST"]),
            ("integration-service", "process-asn", "/integrations/erp/process-asn", ["POST"]),
            # Discovery Ingestion
            ("integration-service", "ingest-sccm-data", "/integrations/discovery/sccm", ["POST"]),
            ("integration-service", "ingest-jamf-data", "/integrations/discovery/jamf", ["POST"]),
            ("integration-service", "ingest-tanium-data", "/integrations/discovery/tanium", ["POST"]),
        ])


class ApiLambdaNestedStack4(_ApiLambdaNestedBase):
    """Nested stack for HAM (Hardware Asset Management) service routes."""

    def __init__(self, scope, construct_id, *, config, rest_api_id, root_resource_id, vpc, db_secret_arn, db_security_group, cache_endpoint=None, opensearch_endpoint=None, **kwargs):
        super().__init__(scope, construct_id, config=config, rest_api_id=rest_api_id, root_resource_id=root_resource_id, vpc=vpc, db_secret_arn=db_secret_arn, db_security_group=db_security_group, cache_endpoint=cache_endpoint, opensearch_endpoint=opensearch_endpoint, **kwargs)
        self._setup_ham_routes()

    def _setup_ham_routes(self) -> None:
        self._add_routes([
            # Transfers
            ("ham-service", "list-transfers", "/ham/transfers", ["GET"]),
            ("ham-service", "create-transfer", "/ham/transfers", ["POST"]),
            ("ham-service", "approve-transfer", "/ham/transfers/{transferId}/approve", ["POST"]),
            ("ham-service", "complete-transfer", "/ham/transfers/{transferId}/complete", ["POST"]),
            # Loaners
            ("ham-service", "list-loaners", "/ham/loaners", ["GET"]),
            ("ham-service", "checkout-loaner", "/ham/loaners/checkout", ["POST"]),
            ("ham-service", "return-loaner", "/ham/loaners/{loanerId}/return", ["POST"]),
            ("ham-service", "get-overdue-loans", "/ham/loaners/overdue", ["GET"]),
            # Disposal
            ("ham-service", "list-disposals", "/ham/disposal", ["GET"]),
            ("ham-service", "initiate-disposal", "/ham/disposal", ["POST"]),
            ("ham-service", "record-destruction", "/ham/disposal/{disposalId}/destruction", ["POST"]),
            # Audits
            ("ham-service", "record-audit-scan", "/ham/audits/scan", ["POST"]),
            ("ham-service", "get-audit-discrepancies", "/ham/audits/discrepancies", ["GET"]),
            # Stockroom Inventory
            ("ham-service", "get-stockroom-inventory", "/ham/stockrooms/{stockroomId}/inventory", ["GET"]),
            ("ham-service", "update-inventory", "/ham/stockrooms/{stockroomId}/inventory", ["PUT"]),
            # Bin Locations (router handler)
            ("ham-service", "bin-location-handlers", "/ham/bin-locations", ["GET", "POST"]),
            ("ham-service", "bin-location-handlers", "/ham/bin-locations/{binId}", ["GET", "PUT"]),
            # Stockroom Admin (router handler)
            ("ham-service", "stockroom-admin-handlers", "/ham/stockroom-admin", ["GET", "POST"]),
            ("ham-service", "stockroom-admin-handlers", "/ham/stockroom-admin/{stockroomId}", ["GET", "PUT"]),
        ])

