"""
Reusable CDK Constructs for Asset Management System.

This module contains reusable construct patterns that can be shared
across multiple stacks. Constructs encapsulate common infrastructure
patterns following AWS best practices.

Planned constructs:
- SecureDatabase: Aurora PostgreSQL with encryption and security groups
- SecureCache: ElastiCache Redis with encryption and failover
- SecureApi: API Gateway with WAF and throttling
- SecureBucket: S3 bucket with encryption and lifecycle policies
- MonitoredLambda: Lambda function with alarms and tracing
"""

from ams_constructs.secure_bucket import SecureBucket

__all__ = [
    "SecureBucket",
]
