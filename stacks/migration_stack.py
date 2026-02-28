"""
Migration Stack for Asset Management System.

This stack provisions a Lambda function that can run database migrations
and seed data against Aurora PostgreSQL. The Lambda runs in the VPC with
access to the database, allowing migrations to be executed without direct
VPC connectivity from a developer's machine.

Usage:
    # Deploy the stack
    cdk deploy ams-dev-migration -c env=dev
    
    # Run migrations
    aws lambda invoke --function-name ams-dev-migration-runner \
        --payload '{"action": "migrate"}' response.json
    
    # Run seed
    aws lambda invoke --function-name ams-dev-migration-runner \
        --payload '{"action": "seed"}' response.json
    
    # Run both
    aws lambda invoke --function-name ams-dev-migration-runner \
        --payload '{"action": "migrate-and-seed"}' response.json
"""

import os
from aws_cdk import (
    Stack,
    Duration,
    RemovalPolicy,
    BundlingOptions,
    BundlingOutput,
    DockerVolume,
    aws_ec2 as ec2,
    aws_lambda as lambda_,
    aws_logs as logs,
    aws_iam as iam,
    CfnOutput,
)
from constructs import Construct

from config.environments import EnvironmentConfig


class MigrationStack(Stack):
    """
    Migration infrastructure stack for Asset Management System.
    
    Creates a Lambda function that can:
    - Run database migrations (V001-V008)
    - Seed the database with test data
    - Check migration status
    
    The Lambda is deployed in the VPC private subnets with access to
    Aurora PostgreSQL and Secrets Manager.
    
    Attributes:
        migration_function: The Lambda function for running migrations
    """
    
    def __init__(
        self,
        scope: Construct,
        construct_id: str,
        config: EnvironmentConfig,
        vpc: ec2.IVpc,
        db_secret_arn: str,
        db_security_group: ec2.ISecurityGroup,
        **kwargs,
    ) -> None:
        """
        Initialize the Migration Stack.
        
        Args:
            scope: The parent construct
            construct_id: The construct ID
            config: Environment configuration
            vpc: The VPC to deploy the Lambda into
            db_secret_arn: ARN of the Secrets Manager secret with DB credentials
            db_security_group: Security group for database access
            **kwargs: Additional stack properties
        """
        super().__init__(scope, construct_id, **kwargs)
        
        self._config = config
        self._vpc = vpc
        self._db_secret_arn = db_secret_arn
        self._db_security_group = db_security_group
        
        # Create security group for Lambda
        self._lambda_sg = self._create_security_group()
        
        # Allow Lambda to connect to database
        self._allow_database_access()
        
        # Create Lambda function
        self.migration_function = self._create_migration_function()
        
        # Export outputs
        self._create_outputs()
    
    def _create_security_group(self) -> ec2.SecurityGroup:
        """
        Create security group for the migration Lambda.
        
        Returns:
            ec2.SecurityGroup: The Lambda security group
        """
        security_group = ec2.SecurityGroup(
            self,
            "MigrationLambdaSG",
            vpc=self._vpc,
            description=f"Security group for migration Lambda ({self._config.environment_name})",
            allow_all_outbound=True,
        )
        
        return security_group
    
    def _allow_database_access(self) -> None:
        """Allow the Lambda security group to access the database.
        
        Note: We add the ingress rule to the Lambda security group as an egress rule
        and rely on the database security group already allowing connections from
        the VPC CIDR or we add the rule to the Lambda SG to avoid cyclic dependencies.
        """
        # Add egress rule to Lambda SG to allow outbound to PostgreSQL
        self._lambda_sg.add_egress_rule(
            peer=ec2.Peer.any_ipv4(),
            connection=ec2.Port.tcp(5432),
            description="Allow Lambda to connect to Aurora PostgreSQL",
        )
        
        # Add ingress rule to database SG from Lambda SG
        # This creates a cross-stack reference but avoids cyclic dependency
        # by using connections instead of direct security group modification
        self._lambda_sg.connections.allow_to(
            self._db_security_group,
            ec2.Port.tcp(5432),
            description="Allow migration Lambda to connect to Aurora",
        )
    
    def _create_migration_function(self) -> lambda_.Function:
        """
        Create the migration Lambda function.
        
        The function is configured with:
        - VPC access for database connectivity
        - Secrets Manager permissions for credentials
        - Extended timeout for long-running migrations
        - Bundled migration SQL files
        
        Returns:
            lambda_.Function: The migration Lambda function
        """
        # Create log group
        log_group = logs.LogGroup(
            self,
            "MigrationLogGroup",
            log_group_name=f"/aws/lambda/{self._config.stack_prefix}-migration-runner",
            retention=logs.RetentionDays.ONE_WEEK,
            removal_policy=RemovalPolicy.DESTROY,
        )
        
        # Get the path to the Lambda code (relative to project root)
        project_root = os.path.dirname(os.path.dirname(__file__))
        lambda_path = os.path.join(project_root, "backend", "lambda", "migration-runner")
        migrations_path = os.path.join(project_root, "migrations")
        
        # Check if we should use local bundling (no Docker) or Docker bundling
        # Local bundling requires pre-built dist folder
        dist_path = os.path.join(lambda_path, "dist")
        node_modules_path = os.path.join(lambda_path, "node_modules")
        use_local_bundling = os.path.exists(dist_path) and os.path.exists(node_modules_path)
        
        if use_local_bundling:
            # Use pre-built code (no Docker required)
            # This requires running `npm ci && npm run build` in the lambda directory first
            import shutil
            import tempfile
            
            # Create a temporary directory with the bundled code
            bundle_dir = os.path.join(project_root, "cdk.out", "migration-bundle")
            if os.path.exists(bundle_dir):
                shutil.rmtree(bundle_dir)
            os.makedirs(bundle_dir, exist_ok=True)
            
            # Copy dist, node_modules, and migrations
            shutil.copytree(dist_path, os.path.join(bundle_dir, "dist"))
            shutil.copytree(node_modules_path, os.path.join(bundle_dir, "node_modules"))
            if os.path.exists(migrations_path):
                shutil.copytree(migrations_path, os.path.join(bundle_dir, "migrations"))
            
            code = lambda_.Code.from_asset(bundle_dir)
        else:
            # Use Docker bundling (requires Docker to be running)
            code = lambda_.Code.from_asset(
                lambda_path,
                bundling=BundlingOptions(
                    image=lambda_.Runtime.NODEJS_18_X.bundling_image,
                    command=[
                        "bash", "-c",
                        " && ".join([
                            "npm ci --omit=dev",
                            "npm run build",
                            "cp -r dist /asset-output/",
                            "cp -r node_modules /asset-output/",
                            "cp -r /migrations-input /asset-output/migrations 2>/dev/null || mkdir -p /asset-output/migrations",
                        ])
                    ],
                    user="root",
                    output_type=BundlingOutput.NOT_ARCHIVED,
                    volumes=[
                        # Mount migrations directory into the Docker container
                        DockerVolume(
                            host_path=migrations_path,
                            container_path="/migrations-input",
                        ),
                    ],
                ),
            )
        
        # Create Lambda function
        migration_function = lambda_.Function(
            self,
            "MigrationRunner",
            function_name=f"{self._config.stack_prefix}-migration-runner",
            description="Runs database migrations and seeds for Asset Management System",
            runtime=lambda_.Runtime.NODEJS_18_X,
            handler="dist/index.handler",
            code=code,
            environment={
                "DB_SECRET_ARN": self._db_secret_arn,
                "AWS_NODEJS_CONNECTION_REUSE_ENABLED": "1",
            },
            vpc=self._vpc,
            vpc_subnets=ec2.SubnetSelection(
                subnet_type=ec2.SubnetType.PRIVATE_WITH_EGRESS
            ),
            security_groups=[self._lambda_sg],
            timeout=Duration.minutes(10),  # Extended timeout for migrations
            memory_size=512,
            log_group=log_group,
        )
        
        # Grant Secrets Manager read access
        migration_function.add_to_role_policy(
            iam.PolicyStatement(
                effect=iam.Effect.ALLOW,
                actions=[
                    "secretsmanager:GetSecretValue",
                ],
                resources=[self._db_secret_arn],
            )
        )
        
        return migration_function
    
    def _create_outputs(self) -> None:
        """Create CloudFormation outputs."""
        CfnOutput(
            self,
            "MigrationFunctionName",
            value=self.migration_function.function_name,
            description="Migration Lambda function name",
            export_name=f"{self._config.stack_prefix}-migration-function-name",
        )
        
        CfnOutput(
            self,
            "MigrationFunctionArn",
            value=self.migration_function.function_arn,
            description="Migration Lambda function ARN",
            export_name=f"{self._config.stack_prefix}-migration-function-arn",
        )
        
        # Output example invocation commands
        CfnOutput(
            self,
            "MigrateCommand",
            value=f"aws lambda invoke --function-name {self.migration_function.function_name} --payload '{{\"action\": \"migrate\"}}' --cli-binary-format raw-in-base64-out response.json && cat response.json",
            description="Command to run migrations",
        )
        
        CfnOutput(
            self,
            "SeedCommand",
            value=f"aws lambda invoke --function-name {self.migration_function.function_name} --payload '{{\"action\": \"seed\"}}' --cli-binary-format raw-in-base64-out response.json && cat response.json",
            description="Command to seed database",
        )
        
        CfnOutput(
            self,
            "MigrateAndSeedCommand",
            value=f"aws lambda invoke --function-name {self.migration_function.function_name} --payload '{{\"action\": \"migrate-and-seed\"}}' --cli-binary-format raw-in-base64-out response.json && cat response.json",
            description="Command to run migrations and seed",
        )
