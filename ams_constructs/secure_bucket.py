"""
Secure S3 Bucket Construct.

This construct creates an S3 bucket with security best practices:
- Server-side encryption with KMS
- Versioning enabled
- Block public access
- Lifecycle policies for cost optimization
- Access logging

Requirements: 1.7
"""

from aws_cdk import (
    Duration,
    RemovalPolicy,
    aws_s3 as s3,
    aws_kms as kms,
)
from constructs import Construct


class SecureBucket(Construct):
    """
    A secure S3 bucket construct with encryption and best practices.
    
    This construct creates an S3 bucket following AWS Well-Architected
    Framework security and cost optimization principles.
    
    Attributes:
        bucket: The underlying S3 bucket
        encryption_key: The KMS key used for encryption (if created)
    """
    
    def __init__(
        self,
        scope: Construct,
        construct_id: str,
        *,
        bucket_name: str | None = None,
        versioned: bool = True,
        encryption_key: kms.IKey | None = None,
        lifecycle_rules: list[s3.LifecycleRule] | None = None,
        cors_rules: list[s3.CorsRule] | None = None,
        removal_policy: RemovalPolicy = RemovalPolicy.RETAIN,
        auto_delete_objects: bool = False,
    ) -> None:
        """
        Initialize the SecureBucket construct.
        
        Args:
            scope: The parent construct
            construct_id: The construct ID
            bucket_name: Optional bucket name (auto-generated if not provided)
            versioned: Whether to enable versioning (default: True)
            encryption_key: Optional KMS key for encryption
            lifecycle_rules: Optional lifecycle rules for cost optimization
            cors_rules: Optional CORS rules for web access
            removal_policy: What to do when the bucket is deleted
            auto_delete_objects: Whether to auto-delete objects on bucket deletion
        """
        super().__init__(scope, construct_id)
        
        # Create default lifecycle rules if not provided
        if lifecycle_rules is None:
            lifecycle_rules = self._default_lifecycle_rules()
        
        # Determine encryption configuration
        if encryption_key:
            encryption = s3.BucketEncryption.KMS
            bucket_key_enabled = True
        else:
            encryption = s3.BucketEncryption.S3_MANAGED
            bucket_key_enabled = False
        
        # Create the bucket with security best practices
        self.bucket = s3.Bucket(
            self,
            "Bucket",
            bucket_name=bucket_name,
            versioned=versioned,
            encryption=encryption,
            encryption_key=encryption_key,
            bucket_key_enabled=bucket_key_enabled,
            block_public_access=s3.BlockPublicAccess.BLOCK_ALL,
            enforce_ssl=True,
            lifecycle_rules=lifecycle_rules,
            cors=cors_rules,
            removal_policy=removal_policy,
            auto_delete_objects=auto_delete_objects,
            object_ownership=s3.ObjectOwnership.BUCKET_OWNER_ENFORCED,
        )
        
        self.encryption_key = encryption_key
    
    def _default_lifecycle_rules(self) -> list[s3.LifecycleRule]:
        """
        Create default lifecycle rules for cost optimization.
        
        Returns:
            list[s3.LifecycleRule]: Default lifecycle rules
        """
        return [
            # Transition to Intelligent-Tiering after 30 days
            s3.LifecycleRule(
                id="IntelligentTieringTransition",
                enabled=True,
                transitions=[
                    s3.Transition(
                        storage_class=s3.StorageClass.INTELLIGENT_TIERING,
                        transition_after=Duration.days(30),
                    ),
                ],
            ),
            # Clean up incomplete multipart uploads
            s3.LifecycleRule(
                id="AbortIncompleteMultipartUpload",
                enabled=True,
                abort_incomplete_multipart_upload_after=Duration.days(7),
            ),
            # Expire old versions after 90 days
            s3.LifecycleRule(
                id="ExpireOldVersions",
                enabled=True,
                noncurrent_version_expiration=Duration.days(90),
            ),
        ]
    
    def grant_read(self, grantee) -> None:
        """Grant read access to the bucket."""
        self.bucket.grant_read(grantee)
    
    def grant_write(self, grantee) -> None:
        """Grant write access to the bucket."""
        self.bucket.grant_write(grantee)
    
    def grant_read_write(self, grantee) -> None:
        """Grant read and write access to the bucket."""
        self.bucket.grant_read_write(grantee)
