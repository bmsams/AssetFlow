"""
Unit tests for CacheStack.

These tests verify that the CacheStack creates the expected
ElastiCache Redis infrastructure with proper configuration
following AWS Well-Architected Framework principles.

**Validates: Requirements 1.5**
"""

import pytest
import aws_cdk as cdk
from aws_cdk import assertions

from stacks.network_stack import NetworkStack
from stacks.cache_stack import CacheStack
from config.environments import (
    DevEnvironmentConfig,
    StagingEnvironmentConfig,
    ProductionEnvironmentConfig,
)


@pytest.fixture
def network_stack(app: cdk.App, cdk_env: cdk.Environment) -> NetworkStack:
    """Create a NetworkStack for testing CacheStack."""
    return NetworkStack(
        app,
        "TestNetworkStack",
        config=DevEnvironmentConfig,
        env=cdk_env,
    )


@pytest.fixture
def cache_stack(
    app: cdk.App, cdk_env: cdk.Environment, network_stack: NetworkStack
) -> CacheStack:
    """Create a CacheStack for testing."""
    return CacheStack(
        app,
        "TestCacheStack",
        config=DevEnvironmentConfig,
        vpc=network_stack.vpc,
        env=cdk_env,
    )


class TestCacheStackUnitTests:
    """Unit tests for CacheStack."""

    def test_replication_group_created(
        self, app: cdk.App, cdk_env: cdk.Environment, network_stack: NetworkStack
    ) -> None:
        """Test that a Redis replication group is created."""
        stack = CacheStack(
            app,
            "TestCacheStack",
            config=DevEnvironmentConfig,
            vpc=network_stack.vpc,
            env=cdk_env,
        )

        template = assertions.Template.from_stack(stack)

        # Verify replication group is created
        template.resource_count_is("AWS::ElastiCache::ReplicationGroup", 1)

    def test_replication_group_engine_redis(
        self, app: cdk.App, cdk_env: cdk.Environment, network_stack: NetworkStack
    ) -> None:
        """Test that replication group uses Redis engine."""
        stack = CacheStack(
            app,
            "TestCacheStack",
            config=DevEnvironmentConfig,
            vpc=network_stack.vpc,
            env=cdk_env,
        )

        template = assertions.Template.from_stack(stack)

        # Verify Redis engine
        template.has_resource_properties(
            "AWS::ElastiCache::ReplicationGroup",
            {
                "Engine": "redis",
            },
        )

    def test_replication_group_engine_version(
        self, app: cdk.App, cdk_env: cdk.Environment, network_stack: NetworkStack
    ) -> None:
        """Test that replication group uses Redis 7.1."""
        stack = CacheStack(
            app,
            "TestCacheStack",
            config=DevEnvironmentConfig,
            vpc=network_stack.vpc,
            env=cdk_env,
        )

        template = assertions.Template.from_stack(stack)

        # Verify Redis version
        template.has_resource_properties(
            "AWS::ElastiCache::ReplicationGroup",
            {
                "EngineVersion": "7.1",
            },
        )

    def test_encryption_at_rest_enabled(
        self, app: cdk.App, cdk_env: cdk.Environment, network_stack: NetworkStack
    ) -> None:
        """Test that encryption at rest is enabled."""
        stack = CacheStack(
            app,
            "TestCacheStack",
            config=DevEnvironmentConfig,
            vpc=network_stack.vpc,
            env=cdk_env,
        )

        template = assertions.Template.from_stack(stack)

        # Verify encryption at rest
        template.has_resource_properties(
            "AWS::ElastiCache::ReplicationGroup",
            {
                "AtRestEncryptionEnabled": True,
            },
        )

    def test_encryption_in_transit_enabled(
        self, app: cdk.App, cdk_env: cdk.Environment, network_stack: NetworkStack
    ) -> None:
        """Test that encryption in transit is enabled."""
        stack = CacheStack(
            app,
            "TestCacheStack",
            config=DevEnvironmentConfig,
            vpc=network_stack.vpc,
            env=cdk_env,
        )

        template = assertions.Template.from_stack(stack)

        # Verify encryption in transit
        template.has_resource_properties(
            "AWS::ElastiCache::ReplicationGroup",
            {
                "TransitEncryptionEnabled": True,
            },
        )

    def test_security_group_created(
        self, app: cdk.App, cdk_env: cdk.Environment, network_stack: NetworkStack
    ) -> None:
        """Test that a security group is created for cache access."""
        stack = CacheStack(
            app,
            "TestCacheStack",
            config=DevEnvironmentConfig,
            vpc=network_stack.vpc,
            env=cdk_env,
        )

        template = assertions.Template.from_stack(stack)

        # Verify security group is created
        security_groups = template.find_resources("AWS::EC2::SecurityGroup")
        assert len(security_groups) >= 1

    def test_subnet_group_created(
        self, app: cdk.App, cdk_env: cdk.Environment, network_stack: NetworkStack
    ) -> None:
        """Test that a cache subnet group is created."""
        stack = CacheStack(
            app,
            "TestCacheStack",
            config=DevEnvironmentConfig,
            vpc=network_stack.vpc,
            env=cdk_env,
        )

        template = assertions.Template.from_stack(stack)

        # Verify subnet group is created
        template.resource_count_is("AWS::ElastiCache::SubnetGroup", 1)

    def test_dev_node_type(
        self, app: cdk.App, cdk_env: cdk.Environment, network_stack: NetworkStack
    ) -> None:
        """Test that dev environment uses smaller node type."""
        stack = CacheStack(
            app,
            "TestCacheStack",
            config=DevEnvironmentConfig,
            vpc=network_stack.vpc,
            env=cdk_env,
        )

        template = assertions.Template.from_stack(stack)

        # Dev should use cache.t3.medium
        template.has_resource_properties(
            "AWS::ElastiCache::ReplicationGroup",
            {
                "CacheNodeType": "cache.t3.medium",
            },
        )

    def test_dev_single_node(
        self, app: cdk.App, cdk_env: cdk.Environment, network_stack: NetworkStack
    ) -> None:
        """Test that dev environment uses single node."""
        stack = CacheStack(
            app,
            "TestCacheStack",
            config=DevEnvironmentConfig,
            vpc=network_stack.vpc,
            env=cdk_env,
        )

        template = assertions.Template.from_stack(stack)

        # Dev should have 1 cache cluster
        template.has_resource_properties(
            "AWS::ElastiCache::ReplicationGroup",
            {
                "NumCacheClusters": 1,
            },
        )

    def test_dev_automatic_failover_disabled(
        self, app: cdk.App, cdk_env: cdk.Environment, network_stack: NetworkStack
    ) -> None:
        """Test that dev environment has automatic failover disabled."""
        stack = CacheStack(
            app,
            "TestCacheStack",
            config=DevEnvironmentConfig,
            vpc=network_stack.vpc,
            env=cdk_env,
        )

        template = assertions.Template.from_stack(stack)

        # Dev should have automatic failover disabled
        template.has_resource_properties(
            "AWS::ElastiCache::ReplicationGroup",
            {
                "AutomaticFailoverEnabled": False,
            },
        )

    def test_dev_multi_az_disabled(
        self, app: cdk.App, cdk_env: cdk.Environment, network_stack: NetworkStack
    ) -> None:
        """Test that dev environment has Multi-AZ disabled."""
        stack = CacheStack(
            app,
            "TestCacheStack",
            config=DevEnvironmentConfig,
            vpc=network_stack.vpc,
            env=cdk_env,
        )

        template = assertions.Template.from_stack(stack)

        # Dev should have Multi-AZ disabled
        template.has_resource_properties(
            "AWS::ElastiCache::ReplicationGroup",
            {
                "MultiAZEnabled": False,
            },
        )

    def test_staging_automatic_failover_enabled(self, app: cdk.App) -> None:
        """Test that staging environment has automatic failover enabled."""
        staging_env = cdk.Environment(
            account=StagingEnvironmentConfig.aws_account_id,
            region=StagingEnvironmentConfig.aws_region,
        )

        network_stack = NetworkStack(
            app,
            "TestStagingNetworkStack",
            config=StagingEnvironmentConfig,
            env=staging_env,
        )

        stack = CacheStack(
            app,
            "TestStagingCacheStack",
            config=StagingEnvironmentConfig,
            vpc=network_stack.vpc,
            env=staging_env,
        )

        template = assertions.Template.from_stack(stack)

        # Staging should have automatic failover enabled
        template.has_resource_properties(
            "AWS::ElastiCache::ReplicationGroup",
            {
                "AutomaticFailoverEnabled": True,
            },
        )

    def test_staging_multi_az_enabled(self, app: cdk.App) -> None:
        """Test that staging environment has Multi-AZ enabled."""
        staging_env = cdk.Environment(
            account=StagingEnvironmentConfig.aws_account_id,
            region=StagingEnvironmentConfig.aws_region,
        )

        network_stack = NetworkStack(
            app,
            "TestStagingNetworkStack",
            config=StagingEnvironmentConfig,
            env=staging_env,
        )

        stack = CacheStack(
            app,
            "TestStagingCacheStack",
            config=StagingEnvironmentConfig,
            vpc=network_stack.vpc,
            env=staging_env,
        )

        template = assertions.Template.from_stack(stack)

        # Staging should have Multi-AZ enabled
        template.has_resource_properties(
            "AWS::ElastiCache::ReplicationGroup",
            {
                "MultiAZEnabled": True,
            },
        )

    def test_staging_num_cache_clusters(self, app: cdk.App) -> None:
        """Test that staging environment has 2 cache clusters."""
        staging_env = cdk.Environment(
            account=StagingEnvironmentConfig.aws_account_id,
            region=StagingEnvironmentConfig.aws_region,
        )

        network_stack = NetworkStack(
            app,
            "TestStagingNetworkStack",
            config=StagingEnvironmentConfig,
            env=staging_env,
        )

        stack = CacheStack(
            app,
            "TestStagingCacheStack",
            config=StagingEnvironmentConfig,
            vpc=network_stack.vpc,
            env=staging_env,
        )

        template = assertions.Template.from_stack(stack)

        # Staging should have 2 cache clusters
        template.has_resource_properties(
            "AWS::ElastiCache::ReplicationGroup",
            {
                "NumCacheClusters": 2,
            },
        )

    def test_production_automatic_failover_enabled(self, app: cdk.App) -> None:
        """Test that production environment has automatic failover enabled."""
        prod_env = cdk.Environment(
            account=ProductionEnvironmentConfig.aws_account_id,
            region=ProductionEnvironmentConfig.aws_region,
        )

        network_stack = NetworkStack(
            app,
            "TestProdNetworkStack",
            config=ProductionEnvironmentConfig,
            env=prod_env,
        )

        stack = CacheStack(
            app,
            "TestProdCacheStack",
            config=ProductionEnvironmentConfig,
            vpc=network_stack.vpc,
            env=prod_env,
        )

        template = assertions.Template.from_stack(stack)

        # Production should have automatic failover enabled
        template.has_resource_properties(
            "AWS::ElastiCache::ReplicationGroup",
            {
                "AutomaticFailoverEnabled": True,
            },
        )

    def test_production_multi_az_enabled(self, app: cdk.App) -> None:
        """Test that production environment has Multi-AZ enabled."""
        prod_env = cdk.Environment(
            account=ProductionEnvironmentConfig.aws_account_id,
            region=ProductionEnvironmentConfig.aws_region,
        )

        network_stack = NetworkStack(
            app,
            "TestProdNetworkStack",
            config=ProductionEnvironmentConfig,
            env=prod_env,
        )

        stack = CacheStack(
            app,
            "TestProdCacheStack",
            config=ProductionEnvironmentConfig,
            vpc=network_stack.vpc,
            env=prod_env,
        )

        template = assertions.Template.from_stack(stack)

        # Production should have Multi-AZ enabled
        template.has_resource_properties(
            "AWS::ElastiCache::ReplicationGroup",
            {
                "MultiAZEnabled": True,
            },
        )

    def test_production_num_cache_clusters(self, app: cdk.App) -> None:
        """Test that production environment has 3 cache clusters."""
        prod_env = cdk.Environment(
            account=ProductionEnvironmentConfig.aws_account_id,
            region=ProductionEnvironmentConfig.aws_region,
        )

        network_stack = NetworkStack(
            app,
            "TestProdNetworkStack",
            config=ProductionEnvironmentConfig,
            env=prod_env,
        )

        stack = CacheStack(
            app,
            "TestProdCacheStack",
            config=ProductionEnvironmentConfig,
            vpc=network_stack.vpc,
            env=prod_env,
        )

        template = assertions.Template.from_stack(stack)

        # Production should have 3 cache clusters (primary + 2 replicas)
        template.has_resource_properties(
            "AWS::ElastiCache::ReplicationGroup",
            {
                "NumCacheClusters": 3,
            },
        )

    def test_production_node_type(self, app: cdk.App) -> None:
        """Test that production environment uses larger node type."""
        prod_env = cdk.Environment(
            account=ProductionEnvironmentConfig.aws_account_id,
            region=ProductionEnvironmentConfig.aws_region,
        )

        network_stack = NetworkStack(
            app,
            "TestProdNetworkStack",
            config=ProductionEnvironmentConfig,
            env=prod_env,
        )

        stack = CacheStack(
            app,
            "TestProdCacheStack",
            config=ProductionEnvironmentConfig,
            vpc=network_stack.vpc,
            env=prod_env,
        )

        template = assertions.Template.from_stack(stack)

        # Production should use cache.r6g.large
        template.has_resource_properties(
            "AWS::ElastiCache::ReplicationGroup",
            {
                "CacheNodeType": "cache.r6g.large",
            },
        )

    def test_snapshot_retention_configured(
        self, app: cdk.App, cdk_env: cdk.Environment, network_stack: NetworkStack
    ) -> None:
        """Test that snapshot retention is configured."""
        stack = CacheStack(
            app,
            "TestCacheStack",
            config=DevEnvironmentConfig,
            vpc=network_stack.vpc,
            env=cdk_env,
        )

        template = assertions.Template.from_stack(stack)

        # Verify snapshot retention
        template.has_resource_properties(
            "AWS::ElastiCache::ReplicationGroup",
            {
                "SnapshotRetentionLimit": DevEnvironmentConfig.cache.snapshot_retention_limit,
            },
        )

    def test_snapshot_window_configured(
        self, app: cdk.App, cdk_env: cdk.Environment, network_stack: NetworkStack
    ) -> None:
        """Test that snapshot window is configured."""
        stack = CacheStack(
            app,
            "TestCacheStack",
            config=DevEnvironmentConfig,
            vpc=network_stack.vpc,
            env=cdk_env,
        )

        template = assertions.Template.from_stack(stack)

        # Verify snapshot window
        template.has_resource_properties(
            "AWS::ElastiCache::ReplicationGroup",
            {
                "SnapshotWindow": DevEnvironmentConfig.cache.snapshot_window,
            },
        )

    def test_maintenance_window_configured(
        self, app: cdk.App, cdk_env: cdk.Environment, network_stack: NetworkStack
    ) -> None:
        """Test that maintenance window is configured."""
        stack = CacheStack(
            app,
            "TestCacheStack",
            config=DevEnvironmentConfig,
            vpc=network_stack.vpc,
            env=cdk_env,
        )

        template = assertions.Template.from_stack(stack)

        # Verify maintenance window
        template.has_resource_properties(
            "AWS::ElastiCache::ReplicationGroup",
            {
                "PreferredMaintenanceWindow": DevEnvironmentConfig.cache.maintenance_window,
            },
        )

    def test_port_configured(
        self, app: cdk.App, cdk_env: cdk.Environment, network_stack: NetworkStack
    ) -> None:
        """Test that Redis port is configured."""
        stack = CacheStack(
            app,
            "TestCacheStack",
            config=DevEnvironmentConfig,
            vpc=network_stack.vpc,
            env=cdk_env,
        )

        template = assertions.Template.from_stack(stack)

        # Verify port
        template.has_resource_properties(
            "AWS::ElastiCache::ReplicationGroup",
            {
                "Port": 6379,
            },
        )

    def test_outputs_created(
        self, app: cdk.App, cdk_env: cdk.Environment, network_stack: NetworkStack
    ) -> None:
        """Test that CloudFormation outputs are created."""
        stack = CacheStack(
            app,
            "TestCacheStack",
            config=DevEnvironmentConfig,
            vpc=network_stack.vpc,
            env=cdk_env,
        )

        template = assertions.Template.from_stack(stack)

        # Verify outputs exist
        outputs = template.find_outputs("*")
        # Should have: PrimaryEndpoint, PrimaryPort, ReaderEndpoint, 
        # ReaderPort, SecurityGroupId
        assert len(outputs) >= 5

    def test_cache_properties_exposed(
        self, app: cdk.App, cdk_env: cdk.Environment, network_stack: NetworkStack
    ) -> None:
        """Test that cache properties are exposed correctly."""
        stack = CacheStack(
            app,
            "TestCacheStack",
            config=DevEnvironmentConfig,
            vpc=network_stack.vpc,
            env=cdk_env,
        )

        # Verify replication group and security group are accessible
        assert stack.replication_group is not None
        assert stack.cache_security_group is not None

    def test_production_snapshot_retention(self, app: cdk.App) -> None:
        """Test that production has longer snapshot retention."""
        prod_env = cdk.Environment(
            account=ProductionEnvironmentConfig.aws_account_id,
            region=ProductionEnvironmentConfig.aws_region,
        )

        network_stack = NetworkStack(
            app,
            "TestProdNetworkStack",
            config=ProductionEnvironmentConfig,
            env=prod_env,
        )

        stack = CacheStack(
            app,
            "TestProdCacheStack",
            config=ProductionEnvironmentConfig,
            vpc=network_stack.vpc,
            env=prod_env,
        )

        template = assertions.Template.from_stack(stack)

        # Production should have 7 days snapshot retention
        template.has_resource_properties(
            "AWS::ElastiCache::ReplicationGroup",
            {
                "SnapshotRetentionLimit": 7,
            },
        )

    def test_security_group_ingress_rules(
        self, app: cdk.App, cdk_env: cdk.Environment, network_stack: NetworkStack
    ) -> None:
        """Test that security group has proper ingress rules for Redis port."""
        stack = CacheStack(
            app,
            "TestCacheStack",
            config=DevEnvironmentConfig,
            vpc=network_stack.vpc,
            env=cdk_env,
        )

        template = assertions.Template.from_stack(stack)

        # Verify security group has ingress rules for port 6379
        # The ingress rules are embedded in the security group resource
        template.has_resource_properties(
            "AWS::EC2::SecurityGroup",
            {
                "SecurityGroupIngress": assertions.Match.array_with([
                    assertions.Match.object_like({
                        "IpProtocol": "tcp",
                        "FromPort": 6379,
                        "ToPort": 6379,
                    })
                ])
            },
        )
