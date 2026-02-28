"""
CDK Stacks for Asset Management System.

This module contains all CDK stack definitions for the Asset Management System.
Stacks are organized by infrastructure domain:

- NetworkStack: VPC, subnets, NAT gateways, VPC endpoints
- DatabaseStack: Aurora PostgreSQL Serverless v2
- CacheStack: ElastiCache Redis
- MessagingStack: SQS queues and SNS topics
- ApiStack: API Gateway with WAF
- AuthStack: Cognito User Pool
- StorageStack: S3 buckets
- MonitoringStack: CloudWatch dashboards and alarms
- FrontendStack: CloudFront distribution
- MigrationStack: Lambda function for database migrations
"""

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

__all__ = [
    "NetworkStack",
    "DatabaseStack",
    "CacheStack",
    "MessagingStack",
    "ApiStack",
    "AuthStack",
    "StorageStack",
    "MonitoringStack",
    "FrontendStack",
    "MigrationStack",
]
