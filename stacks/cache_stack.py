"""
Cache Stack for Asset Management System.

This stack provisions ElastiCache Redis cluster following AWS
Well-Architected Framework principles:

- Multi-AZ deployment with automatic failover for high availability
- Encryption at rest and in transit for security
- Redis cluster mode for horizontal scaling capability
- Subnet group placement in isolated subnets for network isolation
- Security group allowing access only from private subnets
- Snapshot retention for backup and recovery
- Environment-specific node types and cluster sizes

Requirements: 1.5
"""

from aws_cdk import (
    Stack,
    RemovalPolicy,
    aws_ec2 as ec2,
    aws_elasticache as elasticache,
    CfnOutput,
)
from constructs import Construct

from config.environments import EnvironmentConfig


class CacheStack(Stack):
    """
    Cache infrastructure stack for Asset Management System.
    
    Creates an ElastiCache Redis replication group with:
    - Primary node and replica nodes for high availability
    - Encryption at rest and in transit
    - Automatic failover (for staging/prod)
    - Security group for controlled access
    - Subnet group for isolated subnet placement
    - Snapshot retention for backup
    
    Attributes:
        replication_group: The ElastiCache Redis replication group
        cache_security_group: Security group for cache access
        primary_endpoint: The primary endpoint for write operations
        reader_endpoint: The reader endpoint for read operations
    """
    
    def __init__(
        self,
        scope: Construct,
        construct_id: str,
        config: EnvironmentConfig,
        vpc: ec2.IVpc,
        **kwargs,
    ) -> None:
        """
        Initialize the Cache Stack.
        
        Args:
            scope: The parent construct
            construct_id: The construct ID
            config: Environment configuration
            vpc: The VPC to deploy the cache into
            **kwargs: Additional stack properties
        """
        super().__init__(scope, construct_id, **kwargs)
        
        self._config = config
        self._vpc = vpc
        
        # Create security group for cache access
        self.cache_security_group = self._create_security_group()
        
        # Create subnet group for cache placement in isolated subnets
        self._subnet_group = self._create_subnet_group()
        
        # Create the ElastiCache Redis replication group
        self.replication_group = self._create_replication_group()
        
        # Export outputs for cross-stack references
        self._create_outputs()
    
    def _create_security_group(self) -> ec2.SecurityGroup:
        """
        Create security group for cache access.
        
        The security group allows Redis access (port 6379) only from
        private subnets, following the principle of least privilege.
        
        Returns:
            ec2.SecurityGroup: The cache security group
        """
        security_group = ec2.SecurityGroup(
            self,
            "CacheSecurityGroup",
            vpc=self._vpc,
            description=f"Security group for ElastiCache Redis ({self._config.environment_name})",
            allow_all_outbound=False,  # Restrict outbound traffic
        )
        
        # Allow Redis access from private subnets
        for subnet in self._vpc.private_subnets:
            security_group.add_ingress_rule(
                peer=ec2.Peer.ipv4(subnet.ipv4_cidr_block),
                connection=ec2.Port.tcp(6379),
                description=f"Allow Redis from private subnet {subnet.subnet_id}",
            )
        
        return security_group
    
    def _create_subnet_group(self) -> elasticache.CfnSubnetGroup:
        """
        Create subnet group for cache placement in isolated subnets.
        
        Returns:
            elasticache.CfnSubnetGroup: The cache subnet group
        """
        subnet_group = elasticache.CfnSubnetGroup(
            self,
            "CacheSubnetGroup",
            description=f"Subnet group for Asset Management cache ({self._config.environment_name})",
            subnet_ids=[subnet.subnet_id for subnet in self._vpc.isolated_subnets],
            cache_subnet_group_name=f"{self._config.stack_prefix}-cache-subnet-group",
        )
        
        return subnet_group
    
    def _create_replication_group(self) -> elasticache.CfnReplicationGroup:
        """
        Create ElastiCache Redis replication group.
        
        The replication group is configured with:
        - Environment-specific node type and cluster size
        - Encryption at rest and in transit
        - Automatic failover (for staging/prod)
        - Multi-AZ deployment (for staging/prod)
        - Snapshot retention for backup
        
        Returns:
            elasticache.CfnReplicationGroup: The Redis replication group
        """
        cache_config = self._config.cache
        
        replication_group = elasticache.CfnReplicationGroup(
            self,
            "AssetCache",
            replication_group_description=f"Asset Management Cache ({self._config.environment_name})",
            # Engine configuration
            engine="redis",
            engine_version="7.1",
            # Node configuration
            cache_node_type=cache_config.node_type,
            num_cache_clusters=cache_config.num_cache_clusters,
            # High availability configuration
            automatic_failover_enabled=cache_config.automatic_failover_enabled,
            multi_az_enabled=cache_config.multi_az_enabled,
            # Security configuration
            at_rest_encryption_enabled=True,
            transit_encryption_enabled=True,
            # Network configuration
            cache_subnet_group_name=self._subnet_group.cache_subnet_group_name,
            security_group_ids=[self.cache_security_group.security_group_id],
            # Backup configuration
            snapshot_retention_limit=cache_config.snapshot_retention_limit,
            snapshot_window=cache_config.snapshot_window,
            # Maintenance configuration
            preferred_maintenance_window=cache_config.maintenance_window,
            # Port configuration
            port=6379,
        )
        
        # Ensure subnet group is created before replication group
        replication_group.add_dependency(self._subnet_group)
        
        return replication_group
    
    def _create_outputs(self) -> None:
        """Create CloudFormation outputs for cross-stack references."""
        CfnOutput(
            self,
            "PrimaryEndpoint",
            value=self.replication_group.attr_primary_end_point_address,
            description="Redis primary endpoint address",
            export_name=f"{self._config.stack_prefix}-cache-primary-endpoint",
        )
        
        CfnOutput(
            self,
            "PrimaryPort",
            value=self.replication_group.attr_primary_end_point_port,
            description="Redis primary endpoint port",
            export_name=f"{self._config.stack_prefix}-cache-primary-port",
        )
        
        CfnOutput(
            self,
            "ReaderEndpoint",
            value=self.replication_group.attr_reader_end_point_address,
            description="Redis reader endpoint address",
            export_name=f"{self._config.stack_prefix}-cache-reader-endpoint",
        )
        
        CfnOutput(
            self,
            "ReaderPort",
            value=self.replication_group.attr_reader_end_point_port,
            description="Redis reader endpoint port",
            export_name=f"{self._config.stack_prefix}-cache-reader-port",
        )
        
        CfnOutput(
            self,
            "SecurityGroupId",
            value=self.cache_security_group.security_group_id,
            description="Cache security group ID",
            export_name=f"{self._config.stack_prefix}-cache-security-group-id",
        )
    
    @property
    def primary_endpoint(self) -> str:
        """Get the primary endpoint address for write operations."""
        return self.replication_group.attr_primary_end_point_address
    
    @property
    def reader_endpoint(self) -> str:
        """Get the reader endpoint address for read operations."""
        return self.replication_group.attr_reader_end_point_address
    
    def allow_connections_from(self, security_group: ec2.ISecurityGroup) -> None:
        """
        Allow cache connections from a security group.
        
        This method is used to grant access to the cache from other
        resources like Lambda functions or ECS tasks.
        
        Args:
            security_group: The security group to allow connections from
        """
        self.cache_security_group.add_ingress_rule(
            peer=security_group,
            connection=ec2.Port.tcp(6379),
            description=f"Allow Redis from {security_group.security_group_id}",
        )
