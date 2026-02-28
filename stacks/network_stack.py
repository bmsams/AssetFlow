"""
Network Stack for Asset Management System.

This stack provisions the VPC infrastructure with proper network segmentation
following AWS Well-Architected Framework principles:

- Multi-AZ deployment for high availability
- Public, private, and isolated subnets for security
- NAT Gateways for private subnet egress
- VPC Endpoints for AWS service access without internet

Requirements: 1.1, 1.4
"""

from aws_cdk import (
    Stack,
    aws_ec2 as ec2,
    CfnOutput,
)
from constructs import Construct

from config.environments import EnvironmentConfig


class NetworkStack(Stack):
    """
    Network infrastructure stack for Asset Management System.
    
    Creates a VPC with:
    - Public subnets: For load balancers and NAT gateways
    - Private subnets: For Lambda functions and ECS tasks
    - Isolated subnets: For databases and caches (no internet access)
    
    Attributes:
        vpc: The VPC construct
        public_subnets: List of public subnet constructs
        private_subnets: List of private subnet constructs
        isolated_subnets: List of isolated subnet constructs
    """
    
    def __init__(
        self,
        scope: Construct,
        construct_id: str,
        config: EnvironmentConfig,
        **kwargs,
    ) -> None:
        """
        Initialize the Network Stack.
        
        Args:
            scope: The parent construct
            construct_id: The construct ID
            config: Environment configuration
            **kwargs: Additional stack properties
        """
        super().__init__(scope, construct_id, **kwargs)
        
        self._config = config
        
        # Create VPC with multi-AZ subnets
        self.vpc = self._create_vpc()
        
        # Create VPC Endpoints for AWS services
        self._create_vpc_endpoints()
        
        # Export VPC outputs
        self._create_outputs()
    
    def _create_vpc(self) -> ec2.Vpc:
        """
        Create the VPC with public, private, and isolated subnets.
        
        Returns:
            ec2.Vpc: The created VPC
        """
        vpc = ec2.Vpc(
            self,
            "AssetMgmtVpc",
            ip_addresses=ec2.IpAddresses.cidr(self._config.vpc.cidr),
            max_azs=self._config.vpc.max_azs,
            nat_gateways=self._config.vpc.nat_gateways,
            enable_dns_hostnames=self._config.vpc.enable_dns_hostnames,
            enable_dns_support=self._config.vpc.enable_dns_support,
            subnet_configuration=[
                # Public subnets for load balancers and NAT gateways
                ec2.SubnetConfiguration(
                    name="Public",
                    subnet_type=ec2.SubnetType.PUBLIC,
                    cidr_mask=24,
                    map_public_ip_on_launch=False,
                ),
                # Private subnets for Lambda functions and compute
                ec2.SubnetConfiguration(
                    name="Private",
                    subnet_type=ec2.SubnetType.PRIVATE_WITH_EGRESS,
                    cidr_mask=24,
                ),
                # Isolated subnets for databases and caches
                ec2.SubnetConfiguration(
                    name="Isolated",
                    subnet_type=ec2.SubnetType.PRIVATE_ISOLATED,
                    cidr_mask=24,
                ),
            ],
            # Enable VPC flow logs for security monitoring
            flow_logs={
                "FlowLog": ec2.FlowLogOptions(
                    destination=ec2.FlowLogDestination.to_cloud_watch_logs(),
                    traffic_type=ec2.FlowLogTrafficType.ALL,
                )
            },
        )
        
        return vpc
    
    def _create_vpc_endpoints(self) -> None:
        """
        Create VPC Endpoints for AWS services.
        
        VPC Endpoints allow private connectivity to AWS services without
        requiring internet access, improving security and reducing costs.
        """
        # Gateway endpoints (free)
        self.vpc.add_gateway_endpoint(
            "S3Endpoint",
            service=ec2.GatewayVpcEndpointAwsService.S3,
        )
        
        self.vpc.add_gateway_endpoint(
            "DynamoDBEndpoint",
            service=ec2.GatewayVpcEndpointAwsService.DYNAMODB,
        )
        
        # Interface endpoints (cost per hour + data transfer)
        # Only create in production or staging to manage costs
        if self._config.environment_name in ("staging", "prod"):
            interface_endpoints = [
                ("SQSEndpoint", ec2.InterfaceVpcEndpointAwsService.SQS),
                ("SNSEndpoint", ec2.InterfaceVpcEndpointAwsService.SNS),
                ("SecretsManagerEndpoint", ec2.InterfaceVpcEndpointAwsService.SECRETS_MANAGER),
                ("CloudWatchLogsEndpoint", ec2.InterfaceVpcEndpointAwsService.CLOUDWATCH_LOGS),
                ("CloudWatchEndpoint", ec2.InterfaceVpcEndpointAwsService.CLOUDWATCH),
            ]
            
            for endpoint_id, service in interface_endpoints:
                self.vpc.add_interface_endpoint(
                    endpoint_id,
                    service=service,
                    subnets=ec2.SubnetSelection(
                        subnet_type=ec2.SubnetType.PRIVATE_WITH_EGRESS
                    ),
                )
    
    def _create_outputs(self) -> None:
        """Create CloudFormation outputs for cross-stack references."""
        CfnOutput(
            self,
            "VpcId",
            value=self.vpc.vpc_id,
            description="VPC ID",
            export_name=f"{self._config.stack_prefix}-vpc-id",
        )
        
        CfnOutput(
            self,
            "VpcCidr",
            value=self.vpc.vpc_cidr_block,
            description="VPC CIDR block",
            export_name=f"{self._config.stack_prefix}-vpc-cidr",
        )
        
        # Export subnet IDs
        CfnOutput(
            self,
            "PublicSubnetIds",
            value=",".join([subnet.subnet_id for subnet in self.vpc.public_subnets]),
            description="Public subnet IDs",
            export_name=f"{self._config.stack_prefix}-public-subnet-ids",
        )
        
        CfnOutput(
            self,
            "PrivateSubnetIds",
            value=",".join([subnet.subnet_id for subnet in self.vpc.private_subnets]),
            description="Private subnet IDs",
            export_name=f"{self._config.stack_prefix}-private-subnet-ids",
        )
        
        CfnOutput(
            self,
            "IsolatedSubnetIds",
            value=",".join([subnet.subnet_id for subnet in self.vpc.isolated_subnets]),
            description="Isolated subnet IDs",
            export_name=f"{self._config.stack_prefix}-isolated-subnet-ids",
        )
    
    @property
    def public_subnets(self) -> list[ec2.ISubnet]:
        """Get the public subnets."""
        return self.vpc.public_subnets
    
    @property
    def private_subnets(self) -> list[ec2.ISubnet]:
        """Get the private subnets."""
        return self.vpc.private_subnets
    
    @property
    def isolated_subnets(self) -> list[ec2.ISubnet]:
        """Get the isolated subnets."""
        return self.vpc.isolated_subnets
