"""
Unit tests for DatabaseStack.

These tests verify that the DatabaseStack creates the expected
Aurora PostgreSQL Serverless v2 infrastructure with proper configuration
following AWS Well-Architected Framework principles.

**Validates: Requirements 1.2**
"""

import pytest
import aws_cdk as cdk
from aws_cdk import assertions

from stacks.network_stack import NetworkStack
from stacks.database_stack import DatabaseStack
from config.environments import (
    DevEnvironmentConfig,
    StagingEnvironmentConfig,
    ProductionEnvironmentConfig,
)


@pytest.fixture
def network_stack(app: cdk.App, cdk_env: cdk.Environment) -> NetworkStack:
    """Create a NetworkStack for testing DatabaseStack."""
    return NetworkStack(
        app,
        "TestNetworkStack",
        config=DevEnvironmentConfig,
        env=cdk_env,
    )


@pytest.fixture
def database_stack(
    app: cdk.App, cdk_env: cdk.Environment, network_stack: NetworkStack
) -> DatabaseStack:
    """Create a DatabaseStack for testing."""
    return DatabaseStack(
        app,
        "TestDatabaseStack",
        config=DevEnvironmentConfig,
        vpc=network_stack.vpc,
        env=cdk_env,
    )


class TestDatabaseStackUnitTests:
    """Unit tests for DatabaseStack."""

    def test_aurora_cluster_created(
        self, app: cdk.App, cdk_env: cdk.Environment, network_stack: NetworkStack
    ) -> None:
        """Test that an Aurora cluster is created."""
        stack = DatabaseStack(
            app,
            "TestDatabaseStack",
            config=DevEnvironmentConfig,
            vpc=network_stack.vpc,
            env=cdk_env,
        )

        template = assertions.Template.from_stack(stack)

        # Verify Aurora cluster is created
        template.resource_count_is("AWS::RDS::DBCluster", 1)

    def test_aurora_cluster_engine_postgres(
        self, app: cdk.App, cdk_env: cdk.Environment, network_stack: NetworkStack
    ) -> None:
        """Test that Aurora cluster uses PostgreSQL engine."""
        stack = DatabaseStack(
            app,
            "TestDatabaseStack",
            config=DevEnvironmentConfig,
            vpc=network_stack.vpc,
            env=cdk_env,
        )

        template = assertions.Template.from_stack(stack)

        # Verify PostgreSQL engine
        template.has_resource_properties(
            "AWS::RDS::DBCluster",
            {
                "Engine": "aurora-postgresql",
            },
        )

    def test_aurora_cluster_encryption_enabled(
        self, app: cdk.App, cdk_env: cdk.Environment, network_stack: NetworkStack
    ) -> None:
        """Test that Aurora cluster has encryption at rest enabled."""
        stack = DatabaseStack(
            app,
            "TestDatabaseStack",
            config=DevEnvironmentConfig,
            vpc=network_stack.vpc,
            env=cdk_env,
        )

        template = assertions.Template.from_stack(stack)

        # Verify encryption is enabled
        template.has_resource_properties(
            "AWS::RDS::DBCluster",
            {
                "StorageEncrypted": True,
            },
        )

    def test_kms_key_created(
        self, app: cdk.App, cdk_env: cdk.Environment, network_stack: NetworkStack
    ) -> None:
        """Test that a KMS key is created for encryption."""
        stack = DatabaseStack(
            app,
            "TestDatabaseStack",
            config=DevEnvironmentConfig,
            vpc=network_stack.vpc,
            env=cdk_env,
        )

        template = assertions.Template.from_stack(stack)

        # Verify KMS key is created
        template.resource_count_is("AWS::KMS::Key", 1)

    def test_kms_key_rotation_enabled(
        self, app: cdk.App, cdk_env: cdk.Environment, network_stack: NetworkStack
    ) -> None:
        """Test that KMS key rotation is enabled."""
        stack = DatabaseStack(
            app,
            "TestDatabaseStack",
            config=DevEnvironmentConfig,
            vpc=network_stack.vpc,
            env=cdk_env,
        )

        template = assertions.Template.from_stack(stack)

        # Verify key rotation is enabled
        template.has_resource_properties(
            "AWS::KMS::Key",
            {
                "EnableKeyRotation": True,
            },
        )

    def test_security_group_created(
        self, app: cdk.App, cdk_env: cdk.Environment, network_stack: NetworkStack
    ) -> None:
        """Test that a security group is created for database access."""
        stack = DatabaseStack(
            app,
            "TestDatabaseStack",
            config=DevEnvironmentConfig,
            vpc=network_stack.vpc,
            env=cdk_env,
        )

        template = assertions.Template.from_stack(stack)

        # Verify security group is created (at least one for database)
        security_groups = template.find_resources("AWS::EC2::SecurityGroup")
        assert len(security_groups) >= 1

    def test_subnet_group_created(
        self, app: cdk.App, cdk_env: cdk.Environment, network_stack: NetworkStack
    ) -> None:
        """Test that a DB subnet group is created."""
        stack = DatabaseStack(
            app,
            "TestDatabaseStack",
            config=DevEnvironmentConfig,
            vpc=network_stack.vpc,
            env=cdk_env,
        )

        template = assertions.Template.from_stack(stack)

        # Verify subnet group is created
        template.resource_count_is("AWS::RDS::DBSubnetGroup", 1)

    def test_parameter_group_created(
        self, app: cdk.App, cdk_env: cdk.Environment, network_stack: NetworkStack
    ) -> None:
        """Test that a DB parameter group is created."""
        stack = DatabaseStack(
            app,
            "TestDatabaseStack",
            config=DevEnvironmentConfig,
            vpc=network_stack.vpc,
            env=cdk_env,
        )

        template = assertions.Template.from_stack(stack)

        # Verify parameter group is created
        template.resource_count_is("AWS::RDS::DBClusterParameterGroup", 1)

    def test_secrets_manager_secret_created(
        self, app: cdk.App, cdk_env: cdk.Environment, network_stack: NetworkStack
    ) -> None:
        """Test that a Secrets Manager secret is created for credentials."""
        stack = DatabaseStack(
            app,
            "TestDatabaseStack",
            config=DevEnvironmentConfig,
            vpc=network_stack.vpc,
            env=cdk_env,
        )

        template = assertions.Template.from_stack(stack)

        # Verify secret is created
        template.resource_count_is("AWS::SecretsManager::Secret", 1)

    def test_cloudwatch_logs_export_enabled(
        self, app: cdk.App, cdk_env: cdk.Environment, network_stack: NetworkStack
    ) -> None:
        """Test that CloudWatch logs export is enabled."""
        stack = DatabaseStack(
            app,
            "TestDatabaseStack",
            config=DevEnvironmentConfig,
            vpc=network_stack.vpc,
            env=cdk_env,
        )

        template = assertions.Template.from_stack(stack)

        # Verify CloudWatch logs export
        template.has_resource_properties(
            "AWS::RDS::DBCluster",
            {
                "EnableCloudwatchLogsExports": ["postgresql"],
            },
        )

    def test_iam_authentication_enabled(
        self, app: cdk.App, cdk_env: cdk.Environment, network_stack: NetworkStack
    ) -> None:
        """Test that IAM authentication is enabled."""
        stack = DatabaseStack(
            app,
            "TestDatabaseStack",
            config=DevEnvironmentConfig,
            vpc=network_stack.vpc,
            env=cdk_env,
        )

        template = assertions.Template.from_stack(stack)

        # Verify IAM authentication is enabled
        template.has_resource_properties(
            "AWS::RDS::DBCluster",
            {
                "EnableIAMDatabaseAuthentication": True,
            },
        )

    def test_db_instances_created(
        self, app: cdk.App, cdk_env: cdk.Environment, network_stack: NetworkStack
    ) -> None:
        """Test that DB instances are created (writer only for dev)."""
        stack = DatabaseStack(
            app,
            "TestDatabaseStack",
            config=DevEnvironmentConfig,
            vpc=network_stack.vpc,
            env=cdk_env,
        )

        template = assertions.Template.from_stack(stack)

        # Dev config has enable_multi_az=False, so only writer instance
        template.resource_count_is("AWS::RDS::DBInstance", 1)

    def test_production_has_reader_instance(self, app: cdk.App) -> None:
        """Test that production config creates reader instance."""
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

        stack = DatabaseStack(
            app,
            "TestProdDatabaseStack",
            config=ProductionEnvironmentConfig,
            vpc=network_stack.vpc,
            env=prod_env,
        )

        template = assertions.Template.from_stack(stack)

        # Production should have writer + reader = 2 instances
        template.resource_count_is("AWS::RDS::DBInstance", 2)

    def test_staging_has_reader_instance(self, app: cdk.App) -> None:
        """Test that staging config creates reader instance."""
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

        stack = DatabaseStack(
            app,
            "TestStagingDatabaseStack",
            config=StagingEnvironmentConfig,
            vpc=network_stack.vpc,
            env=staging_env,
        )

        template = assertions.Template.from_stack(stack)

        # Staging should have writer + reader = 2 instances
        template.resource_count_is("AWS::RDS::DBInstance", 2)

    def test_serverless_v2_scaling_configuration(
        self, app: cdk.App, cdk_env: cdk.Environment, network_stack: NetworkStack
    ) -> None:
        """Test that Serverless v2 scaling is configured."""
        stack = DatabaseStack(
            app,
            "TestDatabaseStack",
            config=DevEnvironmentConfig,
            vpc=network_stack.vpc,
            env=cdk_env,
        )

        template = assertions.Template.from_stack(stack)

        # Verify Serverless v2 scaling configuration
        template.has_resource_properties(
            "AWS::RDS::DBCluster",
            {
                "ServerlessV2ScalingConfiguration": {
                    "MinCapacity": DevEnvironmentConfig.database.min_acu_capacity,
                    "MaxCapacity": DevEnvironmentConfig.database.max_acu_capacity,
                },
            },
        )

    def test_backup_retention_configured(
        self, app: cdk.App, cdk_env: cdk.Environment, network_stack: NetworkStack
    ) -> None:
        """Test that backup retention is configured."""
        stack = DatabaseStack(
            app,
            "TestDatabaseStack",
            config=DevEnvironmentConfig,
            vpc=network_stack.vpc,
            env=cdk_env,
        )

        template = assertions.Template.from_stack(stack)

        # Verify backup retention
        template.has_resource_properties(
            "AWS::RDS::DBCluster",
            {
                "BackupRetentionPeriod": DevEnvironmentConfig.database.backup_retention_days,
            },
        )

    def test_deletion_protection_dev(
        self, app: cdk.App, cdk_env: cdk.Environment, network_stack: NetworkStack
    ) -> None:
        """Test that deletion protection is disabled in dev."""
        stack = DatabaseStack(
            app,
            "TestDatabaseStack",
            config=DevEnvironmentConfig,
            vpc=network_stack.vpc,
            env=cdk_env,
        )

        template = assertions.Template.from_stack(stack)

        # Dev should have deletion protection disabled
        template.has_resource_properties(
            "AWS::RDS::DBCluster",
            {
                "DeletionProtection": False,
            },
        )

    def test_deletion_protection_production(self, app: cdk.App) -> None:
        """Test that deletion protection is enabled in production."""
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

        stack = DatabaseStack(
            app,
            "TestProdDatabaseStack",
            config=ProductionEnvironmentConfig,
            vpc=network_stack.vpc,
            env=prod_env,
        )

        template = assertions.Template.from_stack(stack)

        # Production should have deletion protection enabled
        template.has_resource_properties(
            "AWS::RDS::DBCluster",
            {
                "DeletionProtection": True,
            },
        )

    def test_outputs_created(
        self, app: cdk.App, cdk_env: cdk.Environment, network_stack: NetworkStack
    ) -> None:
        """Test that CloudFormation outputs are created."""
        stack = DatabaseStack(
            app,
            "TestDatabaseStack",
            config=DevEnvironmentConfig,
            vpc=network_stack.vpc,
            env=cdk_env,
        )

        template = assertions.Template.from_stack(stack)

        # Verify outputs exist
        outputs = template.find_outputs("*")
        # Should have: ClusterEndpoint, ClusterReaderEndpoint, ClusterPort, 
        # DatabaseName, SecretArn, SecurityGroupId, EncryptionKeyArn
        assert len(outputs) >= 7

    def test_database_name_configured(
        self, app: cdk.App, cdk_env: cdk.Environment, network_stack: NetworkStack
    ) -> None:
        """Test that default database name is configured."""
        stack = DatabaseStack(
            app,
            "TestDatabaseStack",
            config=DevEnvironmentConfig,
            vpc=network_stack.vpc,
            env=cdk_env,
        )

        template = assertions.Template.from_stack(stack)

        # Verify database name
        template.has_resource_properties(
            "AWS::RDS::DBCluster",
            {
                "DatabaseName": "assetmgmt",
            },
        )

    def test_db_instance_serverless_class(
        self, app: cdk.App, cdk_env: cdk.Environment, network_stack: NetworkStack
    ) -> None:
        """Test that DB instances use serverless instance class."""
        stack = DatabaseStack(
            app,
            "TestDatabaseStack",
            config=DevEnvironmentConfig,
            vpc=network_stack.vpc,
            env=cdk_env,
        )

        template = assertions.Template.from_stack(stack)

        # Verify serverless instance class
        template.has_resource_properties(
            "AWS::RDS::DBInstance",
            {
                "DBInstanceClass": "db.serverless",
            },
        )

    def test_performance_insights_enabled(
        self, app: cdk.App, cdk_env: cdk.Environment, network_stack: NetworkStack
    ) -> None:
        """Test that Performance Insights is enabled."""
        stack = DatabaseStack(
            app,
            "TestDatabaseStack",
            config=DevEnvironmentConfig,
            vpc=network_stack.vpc,
            env=cdk_env,
        )

        template = assertions.Template.from_stack(stack)

        # Verify Performance Insights is enabled on instances
        template.has_resource_properties(
            "AWS::RDS::DBInstance",
            {
                "EnablePerformanceInsights": True,
            },
        )

    def test_cluster_properties_exposed(
        self, app: cdk.App, cdk_env: cdk.Environment, network_stack: NetworkStack
    ) -> None:
        """Test that cluster properties are exposed correctly."""
        stack = DatabaseStack(
            app,
            "TestDatabaseStack",
            config=DevEnvironmentConfig,
            vpc=network_stack.vpc,
            env=cdk_env,
        )

        # Verify cluster is accessible
        assert stack.cluster is not None
        assert stack.db_security_group is not None
        assert stack.db_secret is not None

    def test_production_backup_retention(self, app: cdk.App) -> None:
        """Test that production has longer backup retention."""
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

        stack = DatabaseStack(
            app,
            "TestProdDatabaseStack",
            config=ProductionEnvironmentConfig,
            vpc=network_stack.vpc,
            env=prod_env,
        )

        template = assertions.Template.from_stack(stack)

        # Production should have 30 days backup retention
        template.has_resource_properties(
            "AWS::RDS::DBCluster",
            {
                "BackupRetentionPeriod": 30,
            },
        )

    def test_production_max_capacity(self, app: cdk.App) -> None:
        """Test that production has higher max capacity."""
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

        stack = DatabaseStack(
            app,
            "TestProdDatabaseStack",
            config=ProductionEnvironmentConfig,
            vpc=network_stack.vpc,
            env=prod_env,
        )

        template = assertions.Template.from_stack(stack)

        # Production should have max capacity of 16
        template.has_resource_properties(
            "AWS::RDS::DBCluster",
            {
                "ServerlessV2ScalingConfiguration": {
                    "MaxCapacity": 16.0,
                },
            },
        )
