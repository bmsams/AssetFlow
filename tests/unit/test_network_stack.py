"""
Unit tests and Property-based tests for NetworkStack.

These tests verify that the NetworkStack creates the expected
VPC infrastructure with proper configuration following AWS
Well-Architected Framework principles.

**Validates: Requirements 1.1**
"""

import pytest
import aws_cdk as cdk
from aws_cdk import assertions
from hypothesis import given, settings, strategies as st
from dataclasses import replace

from stacks.network_stack import NetworkStack
from config.environments import (
    DevEnvironmentConfig,
    StagingEnvironmentConfig,
    ProductionEnvironmentConfig,
    EnvironmentConfig,
    VpcConfig,
)


class TestNetworkStackUnitTests:
    """Unit tests for NetworkStack."""

    def test_vpc_created(self, app: cdk.App, cdk_env: cdk.Environment) -> None:
        """Test that a VPC is created."""
        stack = NetworkStack(
            app,
            "TestNetworkStack",
            config=DevEnvironmentConfig,
            env=cdk_env,
        )

        template = assertions.Template.from_stack(stack)

        # Verify VPC is created
        template.resource_count_is("AWS::EC2::VPC", 1)

    def test_subnets_created(self, app: cdk.App, cdk_env: cdk.Environment) -> None:
        """Test that subnets are created in multiple AZs."""
        stack = NetworkStack(
            app,
            "TestNetworkStack",
            config=DevEnvironmentConfig,
            env=cdk_env,
        )

        template = assertions.Template.from_stack(stack)

        # Dev config has max_azs=2, so we expect:
        # 2 public + 2 private + 2 isolated = 6 subnets
        template.resource_count_is("AWS::EC2::Subnet", 6)

    def test_nat_gateway_created(self, app: cdk.App, cdk_env: cdk.Environment) -> None:
        """Test that NAT gateways are created."""
        stack = NetworkStack(
            app,
            "TestNetworkStack",
            config=DevEnvironmentConfig,
            env=cdk_env,
        )

        template = assertions.Template.from_stack(stack)

        # Dev config has nat_gateways=1
        template.resource_count_is("AWS::EC2::NatGateway", 1)

    def test_vpc_flow_logs_enabled(self, app: cdk.App, cdk_env: cdk.Environment) -> None:
        """Test that VPC flow logs are enabled."""
        stack = NetworkStack(
            app,
            "TestNetworkStack",
            config=DevEnvironmentConfig,
            env=cdk_env,
        )

        template = assertions.Template.from_stack(stack)

        # Verify flow log is created
        template.resource_count_is("AWS::EC2::FlowLog", 1)

    def test_gateway_endpoints_created(self, app: cdk.App, cdk_env: cdk.Environment) -> None:
        """Test that S3 and DynamoDB gateway endpoints are created."""
        stack = NetworkStack(
            app,
            "TestNetworkStack",
            config=DevEnvironmentConfig,
            env=cdk_env,
        )

        template = assertions.Template.from_stack(stack)

        # Verify gateway endpoints (S3 and DynamoDB)
        template.resource_count_is("AWS::EC2::VPCEndpoint", 2)

    def test_production_has_more_nat_gateways(self, app: cdk.App) -> None:
        """Test that production config creates more NAT gateways."""
        prod_env = cdk.Environment(
            account=ProductionEnvironmentConfig.aws_account_id,
            region=ProductionEnvironmentConfig.aws_region,
        )

        stack = NetworkStack(
            app,
            "TestProdNetworkStack",
            config=ProductionEnvironmentConfig,
            env=prod_env,
        )

        template = assertions.Template.from_stack(stack)

        # Production config has nat_gateways=3
        template.resource_count_is("AWS::EC2::NatGateway", 3)

    def test_vpc_cidr_configured(self, app: cdk.App, cdk_env: cdk.Environment) -> None:
        """Test that VPC CIDR is configured correctly."""
        stack = NetworkStack(
            app,
            "TestNetworkStack",
            config=DevEnvironmentConfig,
            env=cdk_env,
        )

        template = assertions.Template.from_stack(stack)

        # Verify VPC CIDR
        template.has_resource_properties(
            "AWS::EC2::VPC",
            {
                "CidrBlock": DevEnvironmentConfig.vpc.cidr,
                "EnableDnsHostnames": True,
                "EnableDnsSupport": True,
            },
        )

    def test_outputs_created(self, app: cdk.App, cdk_env: cdk.Environment) -> None:
        """Test that CloudFormation outputs are created."""
        stack = NetworkStack(
            app,
            "TestNetworkStack",
            config=DevEnvironmentConfig,
            env=cdk_env,
        )

        template = assertions.Template.from_stack(stack)

        # Verify outputs exist
        outputs = template.find_outputs("*")
        assert len(outputs) >= 4  # VpcId, VpcCidr, and subnet IDs

    def test_s3_gateway_endpoint_properties(
        self, app: cdk.App, cdk_env: cdk.Environment
    ) -> None:
        """Test that S3 gateway endpoint has correct properties."""
        stack = NetworkStack(
            app,
            "TestNetworkStack",
            config=DevEnvironmentConfig,
            env=cdk_env,
        )

        template = assertions.Template.from_stack(stack)

        # Verify S3 endpoint exists with Gateway type
        template.has_resource_properties(
            "AWS::EC2::VPCEndpoint",
            {
                "ServiceName": {"Fn::Join": ["", ["com.amazonaws.", {"Ref": "AWS::Region"}, ".s3"]]},
                "VpcEndpointType": "Gateway",
            },
        )

    def test_dynamodb_gateway_endpoint_properties(
        self, app: cdk.App, cdk_env: cdk.Environment
    ) -> None:
        """Test that DynamoDB gateway endpoint has correct properties."""
        stack = NetworkStack(
            app,
            "TestNetworkStack",
            config=DevEnvironmentConfig,
            env=cdk_env,
        )

        template = assertions.Template.from_stack(stack)

        # Verify DynamoDB endpoint exists with Gateway type
        template.has_resource_properties(
            "AWS::EC2::VPCEndpoint",
            {
                "ServiceName": {
                    "Fn::Join": ["", ["com.amazonaws.", {"Ref": "AWS::Region"}, ".dynamodb"]]
                },
                "VpcEndpointType": "Gateway",
            },
        )

    def test_flow_log_destination_cloudwatch(
        self, app: cdk.App, cdk_env: cdk.Environment
    ) -> None:
        """Test that VPC flow logs are sent to CloudWatch."""
        stack = NetworkStack(
            app,
            "TestNetworkStack",
            config=DevEnvironmentConfig,
            env=cdk_env,
        )

        template = assertions.Template.from_stack(stack)

        # Verify flow log destination type
        template.has_resource_properties(
            "AWS::EC2::FlowLog",
            {
                "LogDestinationType": "cloud-watch-logs",
                "TrafficType": "ALL",
            },
        )

    def test_staging_has_interface_endpoints(self, app: cdk.App) -> None:
        """Test that staging environment creates interface endpoints."""
        staging_env = cdk.Environment(
            account=StagingEnvironmentConfig.aws_account_id,
            region=StagingEnvironmentConfig.aws_region,
        )

        stack = NetworkStack(
            app,
            "TestStagingNetworkStack",
            config=StagingEnvironmentConfig,
            env=staging_env,
        )

        template = assertions.Template.from_stack(stack)

        # Staging should have 2 gateway + 5 interface endpoints = 7 total
        template.resource_count_is("AWS::EC2::VPCEndpoint", 7)

    def test_production_has_interface_endpoints(self, app: cdk.App) -> None:
        """Test that production environment creates interface endpoints."""
        prod_env = cdk.Environment(
            account=ProductionEnvironmentConfig.aws_account_id,
            region=ProductionEnvironmentConfig.aws_region,
        )

        stack = NetworkStack(
            app,
            "TestProdNetworkStack",
            config=ProductionEnvironmentConfig,
            env=prod_env,
        )

        template = assertions.Template.from_stack(stack)

        # Production should have 2 gateway + 5 interface endpoints = 7 total
        template.resource_count_is("AWS::EC2::VPCEndpoint", 7)

    def test_vpc_properties_exposed(self, app: cdk.App, cdk_env: cdk.Environment) -> None:
        """Test that VPC properties are exposed correctly."""
        stack = NetworkStack(
            app,
            "TestNetworkStack",
            config=DevEnvironmentConfig,
            env=cdk_env,
        )

        # Verify VPC is accessible
        assert stack.vpc is not None
        assert len(stack.public_subnets) == DevEnvironmentConfig.vpc.max_azs
        assert len(stack.private_subnets) == DevEnvironmentConfig.vpc.max_azs
        assert len(stack.isolated_subnets) == DevEnvironmentConfig.vpc.max_azs

    def test_production_subnets_count(self, app: cdk.App) -> None:
        """Test that production has correct number of subnets."""
        prod_env = cdk.Environment(
            account=ProductionEnvironmentConfig.aws_account_id,
            region=ProductionEnvironmentConfig.aws_region,
        )

        stack = NetworkStack(
            app,
            "TestProdNetworkStack",
            config=ProductionEnvironmentConfig,
            env=prod_env,
        )

        template = assertions.Template.from_stack(stack)

        # Production config has max_azs=3, so we expect:
        # 3 public + 3 private + 3 isolated = 9 subnets
        template.resource_count_is("AWS::EC2::Subnet", 9)

    def test_log_group_created_for_flow_logs(
        self, app: cdk.App, cdk_env: cdk.Environment
    ) -> None:
        """Test that a CloudWatch log group is created for flow logs."""
        stack = NetworkStack(
            app,
            "TestNetworkStack",
            config=DevEnvironmentConfig,
            env=cdk_env,
        )

        template = assertions.Template.from_stack(stack)

        # Verify log group is created for flow logs
        template.resource_count_is("AWS::Logs::LogGroup", 1)


# Hypothesis strategies for generating valid environment configurations
@st.composite
def valid_vpc_config(draw: st.DrawFn) -> VpcConfig:
    """Generate valid VPC configurations for property-based testing."""
    max_azs = draw(st.integers(min_value=1, max_value=3))
    nat_gateways = draw(st.integers(min_value=0, max_value=max_azs))

    return VpcConfig(
        cidr="10.0.0.0/16",
        max_azs=max_azs,
        nat_gateways=nat_gateways,
        enable_dns_hostnames=True,
        enable_dns_support=True,
    )


@st.composite
def valid_environment_config(draw: st.DrawFn) -> EnvironmentConfig:
    """Generate valid environment configurations for property-based testing."""
    env_name = draw(st.sampled_from(["dev", "staging", "prod"]))
    vpc_config = draw(valid_vpc_config())

    return EnvironmentConfig(
        environment_name=env_name,
        aws_account_id="123456789012",
        aws_region="us-east-1",
        vpc=vpc_config,
    )


@pytest.mark.property
class TestNetworkStackPropertyTests:
    """
    Property-based tests for NetworkStack.

    **Property 1: CDK Infrastructure Validation**
    **Validates: Requirements 1.1**

    These tests verify that the NetworkStack produces valid CDK infrastructure
    across a wide range of configuration inputs.
    """

    @given(config=valid_environment_config())
    @settings(max_examples=5, deadline=None)
    def test_stack_synthesizes_for_any_valid_config(self, config: EnvironmentConfig) -> None:
        """
        Property: Any valid environment configuration produces a synthesizable stack.

        **Validates: Requirements 1.1**

        This property ensures that the NetworkStack can be synthesized without
        errors for any valid combination of environment settings.
        """
        app = cdk.App()
        env = cdk.Environment(
            account=config.aws_account_id,
            region=config.aws_region,
        )

        # Should not raise any exceptions
        stack = NetworkStack(
            app,
            f"TestNetworkStack-{config.environment_name}",
            config=config,
            env=env,
        )

        # Verify stack can be synthesized
        template = assertions.Template.from_stack(stack)
        assert template is not None

    @given(config=valid_environment_config())
    @settings(max_examples=5, deadline=None)
    def test_vpc_always_created(self, config: EnvironmentConfig) -> None:
        """
        Property: A VPC is always created regardless of configuration.

        **Validates: Requirements 1.1**

        This property ensures that exactly one VPC is created for any
        valid environment configuration.
        """
        app = cdk.App()
        env = cdk.Environment(
            account=config.aws_account_id,
            region=config.aws_region,
        )

        stack = NetworkStack(
            app,
            f"TestNetworkStack-{config.environment_name}",
            config=config,
            env=env,
        )

        template = assertions.Template.from_stack(stack)
        template.resource_count_is("AWS::EC2::VPC", 1)

    @given(config=valid_environment_config())
    @settings(max_examples=5, deadline=None)
    def test_subnet_count_matches_config(self, config: EnvironmentConfig) -> None:
        """
        Property: Subnet count equals 3 * max_azs (public + private + isolated).

        **Validates: Requirements 1.1**

        This property ensures that the correct number of subnets are created
        based on the max_azs configuration: one public, one private, and one
        isolated subnet per availability zone.
        """
        app = cdk.App()
        env = cdk.Environment(
            account=config.aws_account_id,
            region=config.aws_region,
        )

        stack = NetworkStack(
            app,
            f"TestNetworkStack-{config.environment_name}",
            config=config,
            env=env,
        )

        template = assertions.Template.from_stack(stack)
        expected_subnets = config.vpc.max_azs * 3  # public + private + isolated
        template.resource_count_is("AWS::EC2::Subnet", expected_subnets)

    @given(config=valid_environment_config())
    @settings(max_examples=5, deadline=None)
    def test_nat_gateway_count_matches_config(self, config: EnvironmentConfig) -> None:
        """
        Property: NAT gateway count matches configuration.

        **Validates: Requirements 1.1**

        This property ensures that the number of NAT gateways created
        matches the nat_gateways setting in the VPC configuration.
        """
        app = cdk.App()
        env = cdk.Environment(
            account=config.aws_account_id,
            region=config.aws_region,
        )

        stack = NetworkStack(
            app,
            f"TestNetworkStack-{config.environment_name}",
            config=config,
            env=env,
        )

        template = assertions.Template.from_stack(stack)
        template.resource_count_is("AWS::EC2::NatGateway", config.vpc.nat_gateways)

    @given(config=valid_environment_config())
    @settings(max_examples=5, deadline=None)
    def test_flow_logs_always_enabled(self, config: EnvironmentConfig) -> None:
        """
        Property: VPC flow logs are always enabled for security monitoring.

        **Validates: Requirements 1.1**

        This property ensures that VPC flow logs are always created
        regardless of environment configuration, as they are essential
        for security monitoring per AWS Well-Architected Framework.
        """
        app = cdk.App()
        env = cdk.Environment(
            account=config.aws_account_id,
            region=config.aws_region,
        )

        stack = NetworkStack(
            app,
            f"TestNetworkStack-{config.environment_name}",
            config=config,
            env=env,
        )

        template = assertions.Template.from_stack(stack)
        template.resource_count_is("AWS::EC2::FlowLog", 1)

    @given(config=valid_environment_config())
    @settings(max_examples=5, deadline=None)
    def test_gateway_endpoints_always_created(self, config: EnvironmentConfig) -> None:
        """
        Property: S3 and DynamoDB gateway endpoints are always created.

        **Validates: Requirements 1.1**

        This property ensures that gateway endpoints for S3 and DynamoDB
        are always created (at minimum) for any environment configuration.
        These are free and essential for secure AWS service access.
        """
        app = cdk.App()
        env = cdk.Environment(
            account=config.aws_account_id,
            region=config.aws_region,
        )

        stack = NetworkStack(
            app,
            f"TestNetworkStack-{config.environment_name}",
            config=config,
            env=env,
        )

        template = assertions.Template.from_stack(stack)

        # At minimum, S3 and DynamoDB gateway endpoints should exist
        # Staging/prod may have additional interface endpoints
        endpoints = template.find_resources("AWS::EC2::VPCEndpoint")
        assert len(endpoints) >= 2

    @given(config=valid_environment_config())
    @settings(max_examples=5, deadline=None)
    def test_vpc_cidr_matches_config(self, config: EnvironmentConfig) -> None:
        """
        Property: VPC CIDR block matches configuration.

        **Validates: Requirements 1.1**

        This property ensures that the VPC is created with the exact
        CIDR block specified in the configuration.
        """
        app = cdk.App()
        env = cdk.Environment(
            account=config.aws_account_id,
            region=config.aws_region,
        )

        stack = NetworkStack(
            app,
            f"TestNetworkStack-{config.environment_name}",
            config=config,
            env=env,
        )

        template = assertions.Template.from_stack(stack)
        template.has_resource_properties(
            "AWS::EC2::VPC",
            {"CidrBlock": config.vpc.cidr},
        )

    @given(config=valid_environment_config())
    @settings(max_examples=5, deadline=None)
    def test_dns_settings_always_enabled(self, config: EnvironmentConfig) -> None:
        """
        Property: DNS hostnames and support are always enabled.

        **Validates: Requirements 1.1**

        This property ensures that DNS settings are always enabled
        for the VPC, which is required for proper AWS service resolution.
        """
        app = cdk.App()
        env = cdk.Environment(
            account=config.aws_account_id,
            region=config.aws_region,
        )

        stack = NetworkStack(
            app,
            f"TestNetworkStack-{config.environment_name}",
            config=config,
            env=env,
        )

        template = assertions.Template.from_stack(stack)
        template.has_resource_properties(
            "AWS::EC2::VPC",
            {
                "EnableDnsHostnames": True,
                "EnableDnsSupport": True,
            },
        )

    @given(config=valid_environment_config())
    @settings(max_examples=5, deadline=None)
    def test_outputs_always_created(self, config: EnvironmentConfig) -> None:
        """
        Property: CloudFormation outputs are always created for cross-stack references.

        **Validates: Requirements 1.1**

        This property ensures that essential outputs (VpcId, VpcCidr, subnet IDs)
        are always created for cross-stack references.
        """
        app = cdk.App()
        env = cdk.Environment(
            account=config.aws_account_id,
            region=config.aws_region,
        )

        stack = NetworkStack(
            app,
            f"TestNetworkStack-{config.environment_name}",
            config=config,
            env=env,
        )

        template = assertions.Template.from_stack(stack)
        outputs = template.find_outputs("*")

        # Should have at least VpcId, VpcCidr, PublicSubnetIds, PrivateSubnetIds, IsolatedSubnetIds
        assert len(outputs) >= 5

    @given(config=valid_environment_config())
    @settings(max_examples=5, deadline=None)
    def test_interface_endpoints_only_in_staging_and_prod(
        self, config: EnvironmentConfig
    ) -> None:
        """
        Property: Interface endpoints are only created in staging and production.

        **Validates: Requirements 1.1**

        This property ensures that costly interface endpoints are only created
        in staging and production environments, not in development.
        """
        app = cdk.App()
        env = cdk.Environment(
            account=config.aws_account_id,
            region=config.aws_region,
        )

        stack = NetworkStack(
            app,
            f"TestNetworkStack-{config.environment_name}",
            config=config,
            env=env,
        )

        template = assertions.Template.from_stack(stack)
        endpoints = template.find_resources("AWS::EC2::VPCEndpoint")

        if config.environment_name == "dev":
            # Dev should only have 2 gateway endpoints (S3, DynamoDB)
            assert len(endpoints) == 2
        else:
            # Staging/prod should have 2 gateway + 5 interface endpoints = 7
            assert len(endpoints) == 7

    @given(config=valid_environment_config())
    @settings(max_examples=5, deadline=None)
    def test_subnet_properties_exposed_correctly(self, config: EnvironmentConfig) -> None:
        """
        Property: Subnet properties are exposed correctly on the stack.

        **Validates: Requirements 1.1**

        This property ensures that the stack exposes the correct number of
        subnets through its properties for use by other stacks.
        """
        app = cdk.App()
        env = cdk.Environment(
            account=config.aws_account_id,
            region=config.aws_region,
        )

        stack = NetworkStack(
            app,
            f"TestNetworkStack-{config.environment_name}",
            config=config,
            env=env,
        )

        # Verify subnet counts match configuration
        assert len(stack.public_subnets) == config.vpc.max_azs
        assert len(stack.private_subnets) == config.vpc.max_azs
        assert len(stack.isolated_subnets) == config.vpc.max_azs
