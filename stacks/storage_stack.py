"""
Storage Stack for Asset Management System.

This stack provisions S3 buckets for document storage following AWS
Well-Architected Framework principles:

- Server-side encryption (SSE-S3 or SSE-KMS) for data at rest protection
- Versioning enabled for documents and attachments for data durability
- Lifecycle policies for cost optimization
- CORS configuration for frontend access
- Bucket policies for secure access
- Block public access for security

Note: Frontend static assets are managed by FrontendStack, not this stack.

Requirements: 1.7
"""

from aws_cdk import (
    Stack,
    Duration,
    RemovalPolicy,
    aws_s3 as s3,
    aws_kms as kms,
    CfnOutput,
)
from constructs import Construct

from config.environments import EnvironmentConfig
from ams_constructs.secure_bucket import SecureBucket


class StorageStack(Stack):
    """
    Storage infrastructure stack for Asset Management System.
    
    Creates S3 buckets for:
    - Documents: Asset documents, contracts, certificates (versioned)
    - Attachments: Images and files attached to assets (versioned)
    
    Note: Frontend static assets are managed by FrontendStack to keep
    frontend deployment independent and avoid cross-stack dependencies.
    
    Attributes:
        documents_bucket: S3 bucket for asset documents
        attachments_bucket: S3 bucket for asset attachments
        encryption_key: KMS key for bucket encryption (if KMS encryption enabled)
    """
    
    def __init__(
        self,
        scope: Construct,
        construct_id: str,
        config: EnvironmentConfig,
        **kwargs,
    ) -> None:
        """
        Initialize the Storage Stack.
        
        Args:
            scope: The parent construct
            construct_id: The construct ID
            config: Environment configuration
            **kwargs: Additional stack properties
        """
        super().__init__(scope, construct_id, **kwargs)
        
        self._config = config
        self._storage_config = config.storage
        
        # Create KMS key for encryption if enabled
        self.encryption_key: kms.Key | None = None
        if self._storage_config.use_kms_encryption:
            self.encryption_key = self._create_encryption_key()
        
        # Create CORS rules for frontend access
        cors_rules = self._create_cors_rules() if self._storage_config.enable_cors else None
        
        # Create S3 buckets
        self.documents_bucket = self._create_documents_bucket(cors_rules)
        self.attachments_bucket = self._create_attachments_bucket(cors_rules)
        
        # Export outputs for cross-stack references
        self._create_outputs()
    
    def _create_encryption_key(self) -> kms.Key:
        """
        Create KMS key for S3 bucket encryption.
        
        Returns:
            kms.Key: The KMS encryption key
        """
        key = kms.Key(
            self,
            "StorageEncryptionKey",
            alias=f"alias/{self._config.stack_prefix}-storage-key",
            description=f"KMS key for Asset Management System storage encryption ({self._config.environment_name})",
            enable_key_rotation=True,
            removal_policy=RemovalPolicy.RETAIN if self._config.is_production else RemovalPolicy.DESTROY,
        )
        
        return key
    
    def _create_cors_rules(self) -> list[s3.CorsRule]:
        """
        Create CORS rules for frontend access.
        
        Returns:
            list[s3.CorsRule]: CORS configuration rules
        """
        return [
            s3.CorsRule(
                allowed_methods=[
                    s3.HttpMethods.GET,
                    s3.HttpMethods.PUT,
                    s3.HttpMethods.POST,
                    s3.HttpMethods.DELETE,
                    s3.HttpMethods.HEAD,
                ],
                allowed_origins=list(self._storage_config.cors_allowed_origins),
                allowed_headers=["*"],
                exposed_headers=[
                    "ETag",
                    "x-amz-meta-custom-header",
                    "x-amz-server-side-encryption",
                ],
                max_age=self._storage_config.cors_max_age_seconds,
            )
        ]
    
    def _create_documents_lifecycle_rules(self) -> list[s3.LifecycleRule]:
        """
        Create lifecycle rules for documents bucket.
        
        Documents are important and need longer retention with
        transitions to cheaper storage classes.
        
        Returns:
            list[s3.LifecycleRule]: Lifecycle rules for documents
        """
        rules = [
            # Transition current versions to Infrequent Access
            s3.LifecycleRule(
                id="TransitionToIA",
                enabled=True,
                transitions=[
                    s3.Transition(
                        storage_class=s3.StorageClass.INFREQUENT_ACCESS,
                        transition_after=Duration.days(self._storage_config.transition_to_ia_days),
                    ),
                ],
            ),
            # Transition to Glacier for long-term archival
            s3.LifecycleRule(
                id="TransitionToGlacier",
                enabled=True,
                transitions=[
                    s3.Transition(
                        storage_class=s3.StorageClass.GLACIER,
                        transition_after=Duration.days(self._storage_config.transition_to_glacier_days),
                    ),
                ],
            ),
            # Expire old versions
            s3.LifecycleRule(
                id="ExpireOldVersions",
                enabled=True,
                noncurrent_version_expiration=Duration.days(
                    self._storage_config.noncurrent_version_expiration_days
                ),
            ),
            # Clean up incomplete multipart uploads
            s3.LifecycleRule(
                id="AbortIncompleteMultipartUpload",
                enabled=True,
                abort_incomplete_multipart_upload_after=Duration.days(
                    self._storage_config.abort_incomplete_multipart_days
                ),
            ),
        ]
        
        return rules
    
    def _create_attachments_lifecycle_rules(self) -> list[s3.LifecycleRule]:
        """
        Create lifecycle rules for attachments bucket.
        
        Attachments have similar lifecycle to documents but may
        have different retention requirements.
        
        Returns:
            list[s3.LifecycleRule]: Lifecycle rules for attachments
        """
        rules = [
            # Transition to Intelligent-Tiering for variable access patterns
            s3.LifecycleRule(
                id="TransitionToIntelligentTiering",
                enabled=True,
                transitions=[
                    s3.Transition(
                        storage_class=s3.StorageClass.INTELLIGENT_TIERING,
                        transition_after=Duration.days(self._storage_config.transition_to_ia_days),
                    ),
                ],
            ),
            # Expire old versions
            s3.LifecycleRule(
                id="ExpireOldVersions",
                enabled=True,
                noncurrent_version_expiration=Duration.days(
                    self._storage_config.noncurrent_version_expiration_days
                ),
            ),
            # Clean up incomplete multipart uploads
            s3.LifecycleRule(
                id="AbortIncompleteMultipartUpload",
                enabled=True,
                abort_incomplete_multipart_upload_after=Duration.days(
                    self._storage_config.abort_incomplete_multipart_days
                ),
            ),
        ]
        
        return rules
    
    def _create_documents_bucket(self, cors_rules: list[s3.CorsRule] | None) -> SecureBucket:
        """
        Create S3 bucket for asset documents.
        
        Documents include contracts, certificates, manuals, and other
        important asset-related files that require versioning and
        long-term retention.
        
        Args:
            cors_rules: Optional CORS rules for frontend access
            
        Returns:
            SecureBucket: The documents bucket construct
        """
        bucket = SecureBucket(
            self,
            "DocumentsBucket",
            versioned=self._storage_config.enable_versioning_documents,
            encryption_key=self.encryption_key,
            lifecycle_rules=self._create_documents_lifecycle_rules(),
            cors_rules=cors_rules,
            removal_policy=RemovalPolicy.RETAIN if self._config.is_production else RemovalPolicy.DESTROY,
            auto_delete_objects=not self._config.is_production,
        )
        
        return bucket
    
    def _create_attachments_bucket(self, cors_rules: list[s3.CorsRule] | None) -> SecureBucket:
        """
        Create S3 bucket for asset attachments.
        
        Attachments include images, photos, and other files attached
        to asset records. These require versioning for audit purposes.
        
        Args:
            cors_rules: Optional CORS rules for frontend access
            
        Returns:
            SecureBucket: The attachments bucket construct
        """
        bucket = SecureBucket(
            self,
            "AttachmentsBucket",
            versioned=self._storage_config.enable_versioning_attachments,
            encryption_key=self.encryption_key,
            lifecycle_rules=self._create_attachments_lifecycle_rules(),
            cors_rules=cors_rules,
            removal_policy=RemovalPolicy.RETAIN if self._config.is_production else RemovalPolicy.DESTROY,
            auto_delete_objects=not self._config.is_production,
        )
        
        return bucket
    
    def _create_outputs(self) -> None:
        """Create CloudFormation outputs for cross-stack references."""
        CfnOutput(
            self,
            "DocumentsBucketName",
            value=self.documents_bucket.bucket.bucket_name,
            description="Documents bucket name",
            export_name=f"{self._config.stack_prefix}-documents-bucket-name",
        )
        
        CfnOutput(
            self,
            "DocumentsBucketArn",
            value=self.documents_bucket.bucket.bucket_arn,
            description="Documents bucket ARN",
            export_name=f"{self._config.stack_prefix}-documents-bucket-arn",
        )
        
        CfnOutput(
            self,
            "AttachmentsBucketName",
            value=self.attachments_bucket.bucket.bucket_name,
            description="Attachments bucket name",
            export_name=f"{self._config.stack_prefix}-attachments-bucket-name",
        )
        
        CfnOutput(
            self,
            "AttachmentsBucketArn",
            value=self.attachments_bucket.bucket.bucket_arn,
            description="Attachments bucket ARN",
            export_name=f"{self._config.stack_prefix}-attachments-bucket-arn",
        )
        
        if self.encryption_key:
            CfnOutput(
                self,
                "EncryptionKeyArn",
                value=self.encryption_key.key_arn,
                description="KMS key ARN for storage encryption",
                export_name=f"{self._config.stack_prefix}-storage-encryption-key-arn",
            )
