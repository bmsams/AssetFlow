"""
Auth Stack for Asset Management System.

This stack provisions Cognito User Pool for authentication with MFA support
following AWS Well-Architected Framework security best practices:

- Cognito User Pool with configurable MFA (optional for dev, required for prod)
- Strong password policies with complexity requirements
- Email verification for account security
- Self-service sign-up (configurable per environment)
- Account recovery via email
- User Pool Client with OAuth 2.0 flows
- User Pool Domain for hosted UI
- Identity Pool for federated access (optional)

Requirements: 1.11
"""

from aws_cdk import (
    Stack,
    Duration,
    RemovalPolicy,
    CfnOutput,
    aws_cognito as cognito,
    aws_iam as iam,
)
from constructs import Construct

from config.environments import EnvironmentConfig


class AuthStack(Stack):
    """
    Authentication infrastructure stack for Asset Management System.

    Creates Cognito resources with:
    - User Pool with MFA support and password policies
    - User Pool Client with OAuth 2.0 configuration
    - User Pool Domain for hosted UI
    - Identity Pool for federated access
    - IAM roles for authenticated and unauthenticated users

    Attributes:
        user_pool: The Cognito User Pool
        user_pool_client: The User Pool Client
        user_pool_domain: The User Pool Domain
        identity_pool: The Identity Pool (optional)
        authenticated_role: IAM role for authenticated users
        unauthenticated_role: IAM role for unauthenticated users
    """

    def __init__(
        self,
        scope: Construct,
        construct_id: str,
        config: EnvironmentConfig,
        **kwargs,
    ) -> None:
        """
        Initialize the Auth Stack.

        Args:
            scope: The parent construct
            construct_id: The construct ID
            config: Environment configuration
            **kwargs: Additional stack properties
        """
        super().__init__(scope, construct_id, **kwargs)

        self._config = config

        # Create Cognito User Pool
        self.user_pool = self._create_user_pool()

        # Create User Pool Client
        self.user_pool_client = self._create_user_pool_client()

        # Create User Pool Domain
        self.user_pool_domain = self._create_user_pool_domain()

        # Create Identity Pool with IAM roles
        self.identity_pool = self._create_identity_pool()
        self.authenticated_role, self.unauthenticated_role = self._create_identity_pool_roles()
        self._attach_roles_to_identity_pool()

        # Export outputs for cross-stack references
        self._create_outputs()

    def _create_user_pool(self) -> cognito.UserPool:
        """
        Create Cognito User Pool with MFA and password policies.

        The User Pool is configured with:
        - MFA support (optional or required based on environment)
        - Strong password policies
        - Email verification
        - Self-service sign-up (configurable)
        - Account recovery via email
        - Standard attributes (email, name)

        Returns:
            cognito.UserPool: The Cognito User Pool
        """
        auth_config = self._config.auth

        # Determine MFA configuration based on environment
        if auth_config.mfa_required:
            mfa = cognito.Mfa.REQUIRED
        else:
            mfa = cognito.Mfa.OPTIONAL

        # Configure MFA second factors
        mfa_second_factor = cognito.MfaSecondFactor(
            sms=False,  # SMS MFA disabled for security (SIM swapping attacks)
            otp=True,   # TOTP (authenticator app) enabled
        )

        # Create User Pool
        user_pool = cognito.UserPool(
            self,
            "AssetUserPool",
            user_pool_name=f"{self._config.stack_prefix}-user-pool",
            # Sign-in configuration
            sign_in_aliases=cognito.SignInAliases(
                email=True,
                username=False,
            ),
            # Self-service sign-up
            self_sign_up_enabled=auth_config.self_sign_up_enabled,
            # User verification
            user_verification=cognito.UserVerificationConfig(
                email_subject="Asset Management System - Verify your email",
                email_body="Your verification code is {####}",
                email_style=cognito.VerificationEmailStyle.CODE,
            ),
            # Auto-verify email
            auto_verify=cognito.AutoVerifiedAttrs(
                email=auth_config.auto_verify_email,
            ),
            # Standard attributes
            standard_attributes=cognito.StandardAttributes(
                email=cognito.StandardAttribute(
                    required=True,
                    mutable=True,
                ),
                given_name=cognito.StandardAttribute(
                    required=False,
                    mutable=True,
                ),
                family_name=cognito.StandardAttribute(
                    required=False,
                    mutable=True,
                ),
            ),
            # Password policy
            password_policy=cognito.PasswordPolicy(
                min_length=auth_config.password_min_length,
                require_lowercase=auth_config.require_lowercase,
                require_uppercase=auth_config.require_uppercase,
                require_digits=auth_config.require_digits,
                require_symbols=auth_config.require_symbols,
                temp_password_validity=Duration.days(auth_config.temp_password_validity_days),
            ),
            # MFA configuration
            mfa=mfa,
            mfa_second_factor=mfa_second_factor,
            # Account recovery
            account_recovery=cognito.AccountRecovery.EMAIL_ONLY
            if auth_config.account_recovery_email
            else cognito.AccountRecovery.NONE,
            # Advanced security (only in production)
            advanced_security_mode=cognito.AdvancedSecurityMode.ENFORCED
            if self._config.is_production
            else cognito.AdvancedSecurityMode.OFF,
            # Removal policy
            removal_policy=RemovalPolicy.RETAIN
            if self._config.is_production
            else RemovalPolicy.DESTROY,
        )

        return user_pool

    def _create_user_pool_client(self) -> cognito.UserPoolClient:
        """
        Create User Pool Client with OAuth 2.0 configuration.

        The client is configured with:
        - OAuth 2.0 flows (authorization code, implicit)
        - Token validity settings
        - Callback URLs for frontend
        - Supported identity providers

        Returns:
            cognito.UserPoolClient: The User Pool Client
        """
        auth_config = self._config.auth

        # Define callback URLs based on environment
        callback_urls = self._get_callback_urls()
        logout_urls = self._get_logout_urls()

        user_pool_client = cognito.UserPoolClient(
            self,
            "AssetUserPoolClient",
            user_pool=self.user_pool,
            user_pool_client_name=f"{self._config.stack_prefix}-client",
            # Generate client secret for confidential clients
            generate_secret=False,  # False for SPA/mobile apps
            # OAuth 2.0 configuration
            o_auth=cognito.OAuthSettings(
                flows=cognito.OAuthFlows(
                    authorization_code_grant=True,
                    implicit_code_grant=True,
                ),
                scopes=[
                    cognito.OAuthScope.EMAIL,
                    cognito.OAuthScope.OPENID,
                    cognito.OAuthScope.PROFILE,
                ],
                callback_urls=callback_urls,
                logout_urls=logout_urls,
            ),
            # Supported identity providers
            supported_identity_providers=[
                cognito.UserPoolClientIdentityProvider.COGNITO,
            ],
            # Token validity
            access_token_validity=Duration.minutes(auth_config.access_token_validity_minutes),
            id_token_validity=Duration.minutes(auth_config.id_token_validity_minutes),
            refresh_token_validity=Duration.days(auth_config.refresh_token_validity_days),
            # Enable token revocation
            enable_token_revocation=True,
            # Prevent user existence errors (security best practice)
            prevent_user_existence_errors=True,
            # Auth flows
            auth_flows=cognito.AuthFlow(
                user_password=True,
                user_srp=True,
                custom=False,
                admin_user_password=False,
            ),
        )

        return user_pool_client

    def _create_user_pool_domain(self) -> cognito.UserPoolDomain:
        """
        Create User Pool Domain for hosted UI.

        Returns:
            cognito.UserPoolDomain: The User Pool Domain
        """
        # Use Cognito-hosted domain (prefix-based)
        # Include account ID suffix to ensure uniqueness across AWS accounts
        import hashlib
        account_hash = hashlib.md5(self._config.aws_account_id.encode()).hexdigest()[:8]
        domain_prefix = f"{self._config.stack_prefix}-auth-{account_hash}".replace("_", "-")

        user_pool_domain = cognito.UserPoolDomain(
            self,
            "AssetUserPoolDomain",
            user_pool=self.user_pool,
            cognito_domain=cognito.CognitoDomainOptions(
                domain_prefix=domain_prefix,
            ),
        )

        return user_pool_domain

    def _create_identity_pool(self) -> cognito.CfnIdentityPool:
        """
        Create Identity Pool for federated access.

        The Identity Pool allows:
        - Authenticated access via Cognito User Pool
        - Unauthenticated access (configurable)
        - Federation with external identity providers

        Returns:
            cognito.CfnIdentityPool: The Identity Pool
        """
        identity_pool = cognito.CfnIdentityPool(
            self,
            "AssetIdentityPool",
            identity_pool_name=f"{self._config.stack_prefix}-identity-pool".replace("-", " "),
            allow_unauthenticated_identities=False,  # Disable unauthenticated access
            cognito_identity_providers=[
                cognito.CfnIdentityPool.CognitoIdentityProviderProperty(
                    client_id=self.user_pool_client.user_pool_client_id,
                    provider_name=self.user_pool.user_pool_provider_name,
                )
            ],
        )

        return identity_pool

    def _create_identity_pool_roles(self) -> tuple[iam.Role, iam.Role]:
        """
        Create IAM roles for Identity Pool.

        Returns:
            tuple[iam.Role, iam.Role]: Authenticated and unauthenticated roles
        """
        # Authenticated role - for users who have signed in
        authenticated_role = iam.Role(
            self,
            "CognitoAuthenticatedRole",
            role_name=f"{self._config.stack_prefix}-cognito-authenticated",
            assumed_by=iam.FederatedPrincipal(
                "cognito-identity.amazonaws.com",
                conditions={
                    "StringEquals": {
                        "cognito-identity.amazonaws.com:aud": self.identity_pool.ref,
                    },
                    "ForAnyValue:StringLike": {
                        "cognito-identity.amazonaws.com:amr": "authenticated",
                    },
                },
                assume_role_action="sts:AssumeRoleWithWebIdentity",
            ),
            description="IAM role for authenticated Cognito users",
        )

        # Add basic permissions for authenticated users
        authenticated_role.add_to_policy(
            iam.PolicyStatement(
                effect=iam.Effect.ALLOW,
                actions=[
                    "cognito-sync:*",
                    "cognito-identity:*",
                ],
                resources=["*"],
            )
        )

        # Unauthenticated role - for users who have not signed in
        unauthenticated_role = iam.Role(
            self,
            "CognitoUnauthenticatedRole",
            role_name=f"{self._config.stack_prefix}-cognito-unauthenticated",
            assumed_by=iam.FederatedPrincipal(
                "cognito-identity.amazonaws.com",
                conditions={
                    "StringEquals": {
                        "cognito-identity.amazonaws.com:aud": self.identity_pool.ref,
                    },
                    "ForAnyValue:StringLike": {
                        "cognito-identity.amazonaws.com:amr": "unauthenticated",
                    },
                },
                assume_role_action="sts:AssumeRoleWithWebIdentity",
            ),
            description="IAM role for unauthenticated Cognito users",
        )

        # Minimal permissions for unauthenticated users
        unauthenticated_role.add_to_policy(
            iam.PolicyStatement(
                effect=iam.Effect.ALLOW,
                actions=[
                    "cognito-sync:*",
                ],
                resources=["*"],
            )
        )

        return authenticated_role, unauthenticated_role

    def _attach_roles_to_identity_pool(self) -> None:
        """Attach IAM roles to the Identity Pool."""
        cognito.CfnIdentityPoolRoleAttachment(
            self,
            "IdentityPoolRoleAttachment",
            identity_pool_id=self.identity_pool.ref,
            roles={
                "authenticated": self.authenticated_role.role_arn,
                "unauthenticated": self.unauthenticated_role.role_arn,
            },
        )

    def _get_callback_urls(self) -> list[str]:
        """
        Get callback URLs based on environment.

        Returns:
            list[str]: List of callback URLs
        """
        if self._config.environment_name == "dev":
            return [
                "http://localhost:3000/callback",
                "http://localhost:5173/callback",
                "https://localhost:3000/callback",
                "https://d2b0ikyq27qo9w.cloudfront.net/callback",
                "https://d2b0ikyq27qo9w.cloudfront.net/",
            ]
        elif self._config.environment_name == "staging":
            return [
                "https://staging.assetmanagement.example.com/callback",
                "http://localhost:3000/callback",
            ]
        else:  # production
            return [
                "https://assetmanagement.example.com/callback",
            ]

    def _get_logout_urls(self) -> list[str]:
        """
        Get logout URLs based on environment.

        Returns:
            list[str]: List of logout URLs
        """
        if self._config.environment_name == "dev":
            return [
                "http://localhost:3000/",
                "http://localhost:5173/",
                "https://localhost:3000/",
                "https://d2b0ikyq27qo9w.cloudfront.net/",
            ]
        elif self._config.environment_name == "staging":
            return [
                "https://staging.assetmanagement.example.com/",
                "http://localhost:3000/",
            ]
        else:  # production
            return [
                "https://assetmanagement.example.com/",
            ]

    def _create_outputs(self) -> None:
        """Create CloudFormation outputs for cross-stack references."""
        CfnOutput(
            self,
            "UserPoolId",
            value=self.user_pool.user_pool_id,
            description="Cognito User Pool ID",
            export_name=f"{self._config.stack_prefix}-user-pool-id",
        )

        CfnOutput(
            self,
            "UserPoolArn",
            value=self.user_pool.user_pool_arn,
            description="Cognito User Pool ARN",
            export_name=f"{self._config.stack_prefix}-user-pool-arn",
        )

        CfnOutput(
            self,
            "UserPoolClientId",
            value=self.user_pool_client.user_pool_client_id,
            description="Cognito User Pool Client ID",
            export_name=f"{self._config.stack_prefix}-user-pool-client-id",
        )

        CfnOutput(
            self,
            "UserPoolDomain",
            value=self.user_pool_domain.domain_name,
            description="Cognito User Pool Domain",
            export_name=f"{self._config.stack_prefix}-user-pool-domain",
        )

        CfnOutput(
            self,
            "UserPoolProviderUrl",
            value=self.user_pool.user_pool_provider_url,
            description="Cognito User Pool Provider URL",
            export_name=f"{self._config.stack_prefix}-user-pool-provider-url",
        )

        CfnOutput(
            self,
            "IdentityPoolId",
            value=self.identity_pool.ref,
            description="Cognito Identity Pool ID",
            export_name=f"{self._config.stack_prefix}-identity-pool-id",
        )

        CfnOutput(
            self,
            "AuthenticatedRoleArn",
            value=self.authenticated_role.role_arn,
            description="IAM Role ARN for authenticated users",
            export_name=f"{self._config.stack_prefix}-authenticated-role-arn",
        )

        CfnOutput(
            self,
            "HostedUIUrl",
            value=f"https://{self.user_pool_domain.domain_name}.auth.{self._config.aws_region}.amazoncognito.com",
            description="Cognito Hosted UI URL",
            export_name=f"{self._config.stack_prefix}-hosted-ui-url",
        )

    @property
    def user_pool_provider_name(self) -> str:
        """Get the User Pool provider name for use in other stacks."""
        return self.user_pool.user_pool_provider_name
