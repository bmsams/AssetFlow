"""
Database Stack for Asset Management System.

This stack provisions Aurora PostgreSQL Serverless v2 cluster following AWS
Well-Architected Framework principles:

- Aurora Serverless v2 provides instant scalability for variable workloads
- Multi-AZ deployment with 6 copies of data across 3 AZs for durability
- Minimum ACU of 0.5 maintains buffer pool for consistent performance
- Maximum ACU allows scaling for peak loads (environment-specific)
- Storage encryption using AWS KMS for data at rest protection
- Performance Insights enabled for query analysis
- CloudWatch logs export for monitoring and troubleshooting

Requirements: 1.2
"""

from aws_cdk import (
    Stack,
    Duration,
    RemovalPolicy,
    aws_ec2 as ec2,
    aws_rds as rds,
    aws_kms as kms,
    aws_secretsmanager as secretsmanager,
    aws_logs as logs,
    CfnOutput,
)
from constructs import Construct

from config.environments import EnvironmentConfig


class DatabaseStack(Stack):
    """
    Database infrastructure stack for Asset Management System.
    
    Creates an Aurora PostgreSQL Serverless v2 cluster with:
    - Writer instance for primary workloads
    - Reader instance for read scaling
    - Encryption at rest using KMS
    - Security group for controlled access
    - Secrets Manager for credential management
    - Performance Insights for query analysis
    - CloudWatch logs for monitoring
    
    Attributes:
        cluster: The Aurora database cluster
        db_security_group: Security group for database access
        db_secret: Secrets Manager secret containing credentials
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
        Initialize the Database Stack.
        
        Args:
            scope: The parent construct
            construct_id: The construct ID
            config: Environment configuration
            vpc: The VPC to deploy the database into
            **kwargs: Additional stack properties
        """
        super().__init__(scope, construct_id, **kwargs)
        
        self._config = config
        self._vpc = vpc
        
        # Create KMS key for encryption
        self._encryption_key = self._create_encryption_key()
        
        # Create security group for database access
        self.db_security_group = self._create_security_group()
        
        # Create parameter group for PostgreSQL configuration
        self._parameter_group = self._create_parameter_group()
        
        # Create subnet group for database placement
        self._subnet_group = self._create_subnet_group()
        
        # Create the Aurora cluster with credentials in Secrets Manager
        self.cluster = self._create_aurora_cluster()
        
        # Export outputs for cross-stack references
        self._create_outputs()
    
    def _create_encryption_key(self) -> kms.Key:
        """
        Create KMS key for database encryption.
        
        Returns:
            kms.Key: The KMS encryption key
        """
        key = kms.Key(
            self,
            "DatabaseEncryptionKey",
            alias=f"alias/{self._config.stack_prefix}-database-key",
            description=f"KMS key for Asset Management System database encryption ({self._config.environment_name})",
            enable_key_rotation=True,
            removal_policy=RemovalPolicy.RETAIN if self._config.is_production else RemovalPolicy.DESTROY,
        )
        
        return key
    
    def _create_security_group(self) -> ec2.SecurityGroup:
        """
        Create security group for database access.
        
        The security group allows PostgreSQL access (port 5432) only from
        private subnets, following the principle of least privilege.
        
        Returns:
            ec2.SecurityGroup: The database security group
        """
        security_group = ec2.SecurityGroup(
            self,
            "DatabaseSecurityGroup",
            vpc=self._vpc,
            description=f"Security group for Aurora PostgreSQL ({self._config.environment_name})",
            allow_all_outbound=False,  # Restrict outbound traffic
        )
        
        # Allow PostgreSQL access from private subnets
        for subnet in self._vpc.private_subnets:
            security_group.add_ingress_rule(
                peer=ec2.Peer.ipv4(subnet.ipv4_cidr_block),
                connection=ec2.Port.tcp(5432),
                description=f"Allow PostgreSQL from private subnet {subnet.subnet_id}",
            )
        
        return security_group
    
    def _create_parameter_group(self) -> rds.ParameterGroup:
        """
        Create parameter group for PostgreSQL configuration.
        
        Returns:
            rds.ParameterGroup: The database parameter group
        """
        parameter_group = rds.ParameterGroup(
            self,
            "DatabaseParameterGroup",
            engine=rds.DatabaseClusterEngine.aurora_postgres(
                version=rds.AuroraPostgresEngineVersion.VER_15_8
            ),
            description=f"Parameter group for Asset Management System ({self._config.environment_name})",
            parameters={
                # Enable logical replication for future CDC needs
                "rds.logical_replication": "1",
                # Set timezone to UTC for consistency
                "timezone": "UTC",
                # Enable pg_stat_statements for query analysis
                "shared_preload_libraries": "pg_stat_statements",
                # Log slow queries (queries taking more than 1 second)
                "log_min_duration_statement": "1000",
                # Log all DDL statements
                "log_statement": "ddl",
            },
        )
        
        return parameter_group
    
    def _create_subnet_group(self) -> rds.SubnetGroup:
        """
        Create subnet group for database placement in isolated subnets.
        
        Returns:
            rds.SubnetGroup: The database subnet group
        """
        subnet_group = rds.SubnetGroup(
            self,
            "DatabaseSubnetGroup",
            vpc=self._vpc,
            description=f"Subnet group for Asset Management System database ({self._config.environment_name})",
            vpc_subnets=ec2.SubnetSelection(
                subnet_type=ec2.SubnetType.PRIVATE_ISOLATED
            ),
            removal_policy=RemovalPolicy.DESTROY,
        )
        
        return subnet_group
    
    def _create_aurora_cluster(self) -> rds.DatabaseCluster:
        """
        Create Aurora PostgreSQL Serverless v2 cluster.
        
        The cluster is configured with:
        - Serverless v2 scaling based on environment config
        - Encryption at rest using KMS
        - Backup retention based on environment
        - Performance Insights enabled
        - CloudWatch logs export
        
        Returns:
            rds.DatabaseCluster: The Aurora database cluster
        """
        db_config = self._config.database
        
        # Build readers list based on multi-AZ configuration
        readers = []
        if self._config.enable_multi_az:
            readers.append(
                rds.ClusterInstance.serverless_v2(
                    "Reader",
                    enable_performance_insights=db_config.enable_performance_insights,
                    performance_insight_retention=rds.PerformanceInsightRetention.DEFAULT,
                )
            )
        
        cluster = rds.DatabaseCluster(
            self,
            "AssetDatabase",
            engine=rds.DatabaseClusterEngine.aurora_postgres(
                version=rds.AuroraPostgresEngineVersion.VER_15_8
            ),
            # Serverless v2 configuration
            serverless_v2_min_capacity=db_config.min_acu_capacity,
            serverless_v2_max_capacity=db_config.max_acu_capacity,
            # Writer instance configuration
            writer=rds.ClusterInstance.serverless_v2(
                "Writer",
                enable_performance_insights=db_config.enable_performance_insights,
                performance_insight_retention=rds.PerformanceInsightRetention.DEFAULT,
            ),
            # Reader instances for read scaling (only in multi-AZ environments)
            readers=readers if readers else None,
            # Network configuration
            vpc=self._vpc,
            subnet_group=self._subnet_group,
            security_groups=[self.db_security_group],
            # Database configuration
            default_database_name="assetmgmt",
            parameter_group=self._parameter_group,
            # Credentials stored in Secrets Manager
            credentials=rds.Credentials.from_generated_secret(
                username="assetadmin",
                secret_name=f"{self._config.stack_prefix}/database/credentials",
            ),
            # Encryption configuration
            storage_encrypted=True,
            storage_encryption_key=self._encryption_key,
            # Backup configuration
            backup=rds.BackupProps(
                retention=Duration.days(db_config.backup_retention_days),
                preferred_window=db_config.preferred_backup_window,
            ),
            # Maintenance configuration
            preferred_maintenance_window=db_config.preferred_maintenance_window,
            # Protection settings
            deletion_protection=db_config.deletion_protection,
            removal_policy=RemovalPolicy.SNAPSHOT if self._config.is_production else RemovalPolicy.DESTROY,
            # Monitoring configuration
            cloudwatch_logs_exports=["postgresql"],
            cloudwatch_logs_retention=logs.RetentionDays.ONE_MONTH,
            monitoring_interval=Duration.seconds(60) if db_config.enable_performance_insights else Duration.seconds(0),
            # IAM authentication (optional, can be enabled for Lambda access)
            iam_authentication=True,
            # Enable Data API for serverless query access
            enable_data_api=True,
        )
        
        return cluster
    
    def _create_outputs(self) -> None:
        """Create CloudFormation outputs for cross-stack references."""
        CfnOutput(
            self,
            "ClusterEndpoint",
            value=self.cluster.cluster_endpoint.hostname,
            description="Aurora cluster writer endpoint",
            export_name=f"{self._config.stack_prefix}-db-cluster-endpoint",
        )
        
        CfnOutput(
            self,
            "ClusterReaderEndpoint",
            value=self.cluster.cluster_read_endpoint.hostname,
            description="Aurora cluster reader endpoint",
            export_name=f"{self._config.stack_prefix}-db-reader-endpoint",
        )
        
        CfnOutput(
            self,
            "ClusterPort",
            value=str(self.cluster.cluster_endpoint.port),
            description="Aurora cluster port",
            export_name=f"{self._config.stack_prefix}-db-port",
        )
        
        CfnOutput(
            self,
            "DatabaseName",
            value="assetmgmt",
            description="Default database name",
            export_name=f"{self._config.stack_prefix}-db-name",
        )
        
        CfnOutput(
            self,
            "SecretArn",
            value=self.cluster.secret.secret_arn if self.cluster.secret else "",
            description="ARN of the Secrets Manager secret containing database credentials",
            export_name=f"{self._config.stack_prefix}-db-secret-arn",
        )
        
        CfnOutput(
            self,
            "SecurityGroupId",
            value=self.db_security_group.security_group_id,
            description="Database security group ID",
            export_name=f"{self._config.stack_prefix}-db-security-group-id",
        )
        
        CfnOutput(
            self,
            "EncryptionKeyArn",
            value=self._encryption_key.key_arn,
            description="KMS key ARN for database encryption",
            export_name=f"{self._config.stack_prefix}-db-encryption-key-arn",
        )
    
    @property
    def db_secret(self) -> secretsmanager.ISecret:
        """Get the Secrets Manager secret containing database credentials."""
        return self.cluster.secret
    
    def allow_connections_from(self, security_group: ec2.ISecurityGroup) -> None:
        """
        Allow database connections from a security group.
        
        This method is used to grant access to the database from other
        resources like Lambda functions or ECS tasks.
        
        Args:
            security_group: The security group to allow connections from
        """
        self.db_security_group.add_ingress_rule(
            peer=security_group,
            connection=ec2.Port.tcp(5432),
            description=f"Allow PostgreSQL from {security_group.security_group_id}",
        )
