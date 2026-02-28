"""
Unit tests for AuthStack.

These tests verify that the AuthStack creates the expected
Cognito User Pool, User Pool Client, Domain, and Identity Pool
following AWS Well-Architected Framework security best practices.

**Validates: Requirements 1.11**
"""

import pytest
import aws_cdk as cdk
from aws_cdk import assertions

from stacks.auth_stack import AuthStack
from config.environments import (
    DevEnvironmentConfig,
    StagingEnvironmentConfig,
    ProductionEnvironmentConfig,
)


class TestAuthStackUserPool:
    """Unit tests for Cognito User Pool configuration."""

    def test_user_pool_created(
        self, app: cdk.App, cdk_env: cdk.Environment
    ) -> None:
        """Test that a Cognito User Pool is created."""
        stack = AuthStack(
            app,
            "TestAuthStack",
            config=DevEnvironmentConfig,
            env=cdk_env,
        )

        template = assertions.Template.from_stack(stack)

        # Verify User Pool is created
        template.resource_count_is("AWS::Cognito::UserPool", 1)

    def test_user_pool_name(
        self, app: cdk.App, cdk_env: cdk.Environment
    ) -> None:
        """Test that User Pool has correct name."""
        stack = AuthStack(
            app,
            "TestAuthStack",
            config=DevEnvironmentConfig,
            env=cdk_env,
        )

        template = assertions.Template.from_stack(stack)

        # Verify User Pool name follows convention
        template.has_resource_properties(
            "AWS::Cognito::UserPool",
            {
                "UserPoolName": "ams-dev-user-pool",
            },
        )

    def test_user_pool_email_sign_in(
        self, app: cdk.App, cdk_env: cdk.Environment
    ) -> None:
        """Test that User Pool allows email sign-in."""
        stack = AuthStack(
            app,
            "TestAuthStack",
            config=DevEnvironmentConfig,
            env=cdk_env,
        )

        template = assertions.Template.from_stack(stack)

        # Verify email is used as sign-in alias
        template.has_resource_properties(
            "AWS::Cognito::UserPool",
            {
                "UsernameAttributes": ["email"],
            },
        )

    def test_user_pool_auto_verify_email(
        self, app: cdk.App, cdk_env: cdk.Environment
    ) -> None:
        """Test that User Pool auto-verifies email."""
        stack = AuthStack(
            app,
            "TestAuthStack",
            config=DevEnvironmentConfig,
            env=cdk_env,
        )

        template = assertions.Template.from_stack(stack)

        # Verify email auto-verification is enabled
        template.has_resource_properties(
            "AWS::Cognito::UserPool",
            {
                "AutoVerifiedAttributes": ["email"],
            },
        )

    def test_user_pool_password_policy_dev(
        self, app: cdk.App, cdk_env: cdk.Environment
    ) -> None:
        """Test that User Pool has correct password policy for dev."""
        stack = AuthStack(
            app,
            "TestAuthStack",
            config=DevEnvironmentConfig,
            env=cdk_env,
        )

        template = assertions.Template.from_stack(stack)

        # Verify password policy for dev environment
        template.has_resource_properties(
            "AWS::Cognito::UserPool",
            {
                "Policies": {
                    "PasswordPolicy": {
                        "MinimumLength": DevEnvironmentConfig.auth.password_min_length,
                        "RequireLowercase": True,
                        "RequireUppercase": True,
                        "RequireNumbers": True,
                        "RequireSymbols": True,
                    },
                },
            },
        )

    def test_user_pool_mfa_optional_dev(
        self, app: cdk.App, cdk_env: cdk.Environment
    ) -> None:
        """Test that MFA is optional in dev environment."""
        stack = AuthStack(
            app,
            "TestAuthStack",
            config=DevEnvironmentConfig,
            env=cdk_env,
        )

        template = assertions.Template.from_stack(stack)

        # Verify MFA is optional for dev
        template.has_resource_properties(
            "AWS::Cognito::UserPool",
            {
                "MfaConfiguration": "OPTIONAL",
            },
        )

    def test_user_pool_mfa_required_prod(self, app: cdk.App) -> None:
        """Test that MFA is required in production environment."""
        prod_env = cdk.Environment(
            account=ProductionEnvironmentConfig.aws_account_id,
            region=ProductionEnvironmentConfig.aws_region,
        )

        stack = AuthStack(
            app,
            "TestProdAuthStack",
            config=ProductionEnvironmentConfig,
            env=prod_env,
        )

        template = assertions.Template.from_stack(stack)

        # Verify MFA is required for production
        template.has_resource_properties(
            "AWS::Cognito::UserPool",
            {
                "MfaConfiguration": "ON",
            },
        )

    def test_user_pool_totp_enabled(
        self, app: cdk.App, cdk_env: cdk.Environment
    ) -> None:
        """Test that TOTP MFA is enabled."""
        stack = AuthStack(
            app,
            "TestAuthStack",
            config=DevEnvironmentConfig,
            env=cdk_env,
        )

        template = assertions.Template.from_stack(stack)

        # Verify TOTP is enabled as MFA method
        template.has_resource_properties(
            "AWS::Cognito::UserPool",
            {
                "EnabledMfas": ["SOFTWARE_TOKEN_MFA"],
            },
        )

    def test_user_pool_account_recovery_email(
        self, app: cdk.App, cdk_env: cdk.Environment
    ) -> None:
        """Test that account recovery is via email only."""
        stack = AuthStack(
            app,
            "TestAuthStack",
            config=DevEnvironmentConfig,
            env=cdk_env,
        )

        template = assertions.Template.from_stack(stack)

        # Verify account recovery is email only
        template.has_resource_properties(
            "AWS::Cognito::UserPool",
            {
                "AccountRecoverySetting": {
                    "RecoveryMechanisms": [
                        {
                            "Name": "verified_email",
                            "Priority": 1,
                        },
                    ],
                },
            },
        )

    def test_user_pool_self_signup_enabled_dev(
        self, app: cdk.App, cdk_env: cdk.Environment
    ) -> None:
        """Test that self-signup is enabled in dev."""
        stack = AuthStack(
            app,
            "TestAuthStack",
            config=DevEnvironmentConfig,
            env=cdk_env,
        )

        template = assertions.Template.from_stack(stack)

        # Verify self-signup is enabled for dev
        template.has_resource_properties(
            "AWS::Cognito::UserPool",
            {
                "AdminCreateUserConfig": {
                    "AllowAdminCreateUserOnly": False,
                },
            },
        )

    def test_user_pool_self_signup_disabled_prod(self, app: cdk.App) -> None:
        """Test that self-signup is disabled in production."""
        prod_env = cdk.Environment(
            account=ProductionEnvironmentConfig.aws_account_id,
            region=ProductionEnvironmentConfig.aws_region,
        )

        stack = AuthStack(
            app,
            "TestProdAuthStack",
            config=ProductionEnvironmentConfig,
            env=prod_env,
        )

        template = assertions.Template.from_stack(stack)

        # Verify self-signup is disabled for production
        template.has_resource_properties(
            "AWS::Cognito::UserPool",
            {
                "AdminCreateUserConfig": {
                    "AllowAdminCreateUserOnly": True,
                },
            },
        )

    def test_user_pool_advanced_security_prod(self, app: cdk.App) -> None:
        """Test that advanced security is enabled in production."""
        prod_env = cdk.Environment(
            account=ProductionEnvironmentConfig.aws_account_id,
            region=ProductionEnvironmentConfig.aws_region,
        )

        stack = AuthStack(
            app,
            "TestProdAuthStack",
            config=ProductionEnvironmentConfig,
            env=prod_env,
        )

        template = assertions.Template.from_stack(stack)

        # Verify advanced security is enforced for production
        template.has_resource_properties(
            "AWS::Cognito::UserPool",
            {
                "UserPoolAddOns": {
                    "AdvancedSecurityMode": "ENFORCED",
                },
            },
        )


class TestAuthStackUserPoolClient:
    """Unit tests for Cognito User Pool Client configuration."""

    def test_user_pool_client_created(
        self, app: cdk.App, cdk_env: cdk.Environment
    ) -> None:
        """Test that a User Pool Client is created."""
        stack = AuthStack(
            app,
            "TestAuthStack",
            config=DevEnvironmentConfig,
            env=cdk_env,
        )

        template = assertions.Template.from_stack(stack)

        # Verify User Pool Client is created
        template.resource_count_is("AWS::Cognito::UserPoolClient", 1)

    def test_user_pool_client_name(
        self, app: cdk.App, cdk_env: cdk.Environment
    ) -> None:
        """Test that User Pool Client has correct name."""
        stack = AuthStack(
            app,
            "TestAuthStack",
            config=DevEnvironmentConfig,
            env=cdk_env,
        )

        template = assertions.Template.from_stack(stack)

        # Verify client name follows convention
        template.has_resource_properties(
            "AWS::Cognito::UserPoolClient",
            {
                "ClientName": "ams-dev-client",
            },
        )

    def test_user_pool_client_oauth_flows(
        self, app: cdk.App, cdk_env: cdk.Environment
    ) -> None:
        """Test that OAuth flows are configured correctly."""
        stack = AuthStack(
            app,
            "TestAuthStack",
            config=DevEnvironmentConfig,
            env=cdk_env,
        )

        template = assertions.Template.from_stack(stack)

        # Verify OAuth flows (order may vary)
        template.has_resource_properties(
            "AWS::Cognito::UserPoolClient",
            {
                "AllowedOAuthFlows": assertions.Match.array_with([
                    "implicit",
                ]),
                "AllowedOAuthFlowsUserPoolClient": True,
            },
        )
        
        # Also verify code flow is present
        template.has_resource_properties(
            "AWS::Cognito::UserPoolClient",
            {
                "AllowedOAuthFlows": assertions.Match.array_with([
                    "code",
                ]),
            },
        )

    def test_user_pool_client_oauth_scopes(
        self, app: cdk.App, cdk_env: cdk.Environment
    ) -> None:
        """Test that OAuth scopes are configured correctly."""
        stack = AuthStack(
            app,
            "TestAuthStack",
            config=DevEnvironmentConfig,
            env=cdk_env,
        )

        template = assertions.Template.from_stack(stack)

        # Verify OAuth scopes
        template.has_resource_properties(
            "AWS::Cognito::UserPoolClient",
            {
                "AllowedOAuthScopes": assertions.Match.array_with([
                    "email",
                    "openid",
                    "profile",
                ]),
            },
        )

    def test_user_pool_client_callback_urls_dev(
        self, app: cdk.App, cdk_env: cdk.Environment
    ) -> None:
        """Test that callback URLs are configured for dev."""
        stack = AuthStack(
            app,
            "TestAuthStack",
            config=DevEnvironmentConfig,
            env=cdk_env,
        )

        template = assertions.Template.from_stack(stack)

        # Verify callback URLs include localhost for dev
        template.has_resource_properties(
            "AWS::Cognito::UserPoolClient",
            {
                "CallbackURLs": assertions.Match.array_with([
                    "http://localhost:3000/callback",
                ]),
            },
        )

    def test_user_pool_client_token_validity(
        self, app: cdk.App, cdk_env: cdk.Environment
    ) -> None:
        """Test that token validity is configured."""
        stack = AuthStack(
            app,
            "TestAuthStack",
            config=DevEnvironmentConfig,
            env=cdk_env,
        )

        template = assertions.Template.from_stack(stack)

        # Verify token validity settings
        # Note: CDK converts refresh token days to minutes internally
        # 30 days = 30 * 24 * 60 = 43200 minutes
        template.has_resource_properties(
            "AWS::Cognito::UserPoolClient",
            {
                "AccessTokenValidity": DevEnvironmentConfig.auth.access_token_validity_minutes,
                "IdTokenValidity": DevEnvironmentConfig.auth.id_token_validity_minutes,
                "RefreshTokenValidity": DevEnvironmentConfig.auth.refresh_token_validity_days * 24 * 60,
                "TokenValidityUnits": {
                    "AccessToken": "minutes",
                    "IdToken": "minutes",
                    "RefreshToken": "minutes",
                },
            },
        )

    def test_user_pool_client_token_revocation_enabled(
        self, app: cdk.App, cdk_env: cdk.Environment
    ) -> None:
        """Test that token revocation is enabled."""
        stack = AuthStack(
            app,
            "TestAuthStack",
            config=DevEnvironmentConfig,
            env=cdk_env,
        )

        template = assertions.Template.from_stack(stack)

        # Verify token revocation is enabled
        template.has_resource_properties(
            "AWS::Cognito::UserPoolClient",
            {
                "EnableTokenRevocation": True,
            },
        )

    def test_user_pool_client_prevent_user_existence_errors(
        self, app: cdk.App, cdk_env: cdk.Environment
    ) -> None:
        """Test that user existence errors are prevented (security best practice)."""
        stack = AuthStack(
            app,
            "TestAuthStack",
            config=DevEnvironmentConfig,
            env=cdk_env,
        )

        template = assertions.Template.from_stack(stack)

        # Verify user existence errors are prevented
        template.has_resource_properties(
            "AWS::Cognito::UserPoolClient",
            {
                "PreventUserExistenceErrors": "ENABLED",
            },
        )

    def test_user_pool_client_auth_flows(
        self, app: cdk.App, cdk_env: cdk.Environment
    ) -> None:
        """Test that auth flows are configured correctly."""
        stack = AuthStack(
            app,
            "TestAuthStack",
            config=DevEnvironmentConfig,
            env=cdk_env,
        )

        template = assertions.Template.from_stack(stack)

        # Verify explicit auth flows
        template.has_resource_properties(
            "AWS::Cognito::UserPoolClient",
            {
                "ExplicitAuthFlows": assertions.Match.array_with([
                    "ALLOW_USER_PASSWORD_AUTH",
                    "ALLOW_USER_SRP_AUTH",
                    "ALLOW_REFRESH_TOKEN_AUTH",
                ]),
            },
        )


class TestAuthStackUserPoolDomain:
    """Unit tests for Cognito User Pool Domain configuration."""

    def test_user_pool_domain_created(
        self, app: cdk.App, cdk_env: cdk.Environment
    ) -> None:
        """Test that a User Pool Domain is created."""
        stack = AuthStack(
            app,
            "TestAuthStack",
            config=DevEnvironmentConfig,
            env=cdk_env,
        )

        template = assertions.Template.from_stack(stack)

        # Verify User Pool Domain is created
        template.resource_count_is("AWS::Cognito::UserPoolDomain", 1)

    def test_user_pool_domain_prefix(
        self, app: cdk.App, cdk_env: cdk.Environment
    ) -> None:
        """Test that User Pool Domain has correct prefix."""
        stack = AuthStack(
            app,
            "TestAuthStack",
            config=DevEnvironmentConfig,
            env=cdk_env,
        )

        template = assertions.Template.from_stack(stack)

        # Verify domain prefix follows convention
        template.has_resource_properties(
            "AWS::Cognito::UserPoolDomain",
            {
                "Domain": assertions.Match.string_like_regexp(r"ams-dev-auth.*"),
            },
        )


class TestAuthStackIdentityPool:
    """Unit tests for Cognito Identity Pool configuration."""

    def test_identity_pool_created(
        self, app: cdk.App, cdk_env: cdk.Environment
    ) -> None:
        """Test that an Identity Pool is created."""
        stack = AuthStack(
            app,
            "TestAuthStack",
            config=DevEnvironmentConfig,
            env=cdk_env,
        )

        template = assertions.Template.from_stack(stack)

        # Verify Identity Pool is created
        template.resource_count_is("AWS::Cognito::IdentityPool", 1)

    def test_identity_pool_name(
        self, app: cdk.App, cdk_env: cdk.Environment
    ) -> None:
        """Test that Identity Pool has correct name."""
        stack = AuthStack(
            app,
            "TestAuthStack",
            config=DevEnvironmentConfig,
            env=cdk_env,
        )

        template = assertions.Template.from_stack(stack)

        # Verify Identity Pool name
        template.has_resource_properties(
            "AWS::Cognito::IdentityPool",
            {
                "IdentityPoolName": "ams dev identity pool",
            },
        )

    def test_identity_pool_unauthenticated_disabled(
        self, app: cdk.App, cdk_env: cdk.Environment
    ) -> None:
        """Test that unauthenticated access is disabled."""
        stack = AuthStack(
            app,
            "TestAuthStack",
            config=DevEnvironmentConfig,
            env=cdk_env,
        )

        template = assertions.Template.from_stack(stack)

        # Verify unauthenticated access is disabled
        template.has_resource_properties(
            "AWS::Cognito::IdentityPool",
            {
                "AllowUnauthenticatedIdentities": False,
            },
        )

    def test_identity_pool_cognito_provider(
        self, app: cdk.App, cdk_env: cdk.Environment
    ) -> None:
        """Test that Identity Pool is linked to User Pool."""
        stack = AuthStack(
            app,
            "TestAuthStack",
            config=DevEnvironmentConfig,
            env=cdk_env,
        )

        template = assertions.Template.from_stack(stack)

        # Verify Cognito identity provider is configured
        template.has_resource_properties(
            "AWS::Cognito::IdentityPool",
            {
                "CognitoIdentityProviders": assertions.Match.array_with([
                    assertions.Match.object_like({
                        "ClientId": assertions.Match.any_value(),
                        "ProviderName": assertions.Match.any_value(),
                    }),
                ]),
            },
        )

    def test_identity_pool_role_attachment_created(
        self, app: cdk.App, cdk_env: cdk.Environment
    ) -> None:
        """Test that Identity Pool role attachment is created."""
        stack = AuthStack(
            app,
            "TestAuthStack",
            config=DevEnvironmentConfig,
            env=cdk_env,
        )

        template = assertions.Template.from_stack(stack)

        # Verify role attachment is created
        template.resource_count_is("AWS::Cognito::IdentityPoolRoleAttachment", 1)


class TestAuthStackIAMRoles:
    """Unit tests for IAM roles configuration."""

    def test_authenticated_role_created(
        self, app: cdk.App, cdk_env: cdk.Environment
    ) -> None:
        """Test that authenticated IAM role is created."""
        stack = AuthStack(
            app,
            "TestAuthStack",
            config=DevEnvironmentConfig,
            env=cdk_env,
        )

        template = assertions.Template.from_stack(stack)

        # Verify authenticated role is created
        template.has_resource_properties(
            "AWS::IAM::Role",
            {
                "RoleName": "ams-dev-cognito-authenticated",
            },
        )

    def test_unauthenticated_role_created(
        self, app: cdk.App, cdk_env: cdk.Environment
    ) -> None:
        """Test that unauthenticated IAM role is created."""
        stack = AuthStack(
            app,
            "TestAuthStack",
            config=DevEnvironmentConfig,
            env=cdk_env,
        )

        template = assertions.Template.from_stack(stack)

        # Verify unauthenticated role is created
        template.has_resource_properties(
            "AWS::IAM::Role",
            {
                "RoleName": "ams-dev-cognito-unauthenticated",
            },
        )

    def test_authenticated_role_trust_policy(
        self, app: cdk.App, cdk_env: cdk.Environment
    ) -> None:
        """Test that authenticated role has correct trust policy."""
        stack = AuthStack(
            app,
            "TestAuthStack",
            config=DevEnvironmentConfig,
            env=cdk_env,
        )

        template = assertions.Template.from_stack(stack)

        # Verify trust policy for authenticated role
        template.has_resource_properties(
            "AWS::IAM::Role",
            {
                "RoleName": "ams-dev-cognito-authenticated",
                "AssumeRolePolicyDocument": {
                    "Statement": assertions.Match.array_with([
                        assertions.Match.object_like({
                            "Action": "sts:AssumeRoleWithWebIdentity",
                            "Effect": "Allow",
                            "Principal": {
                                "Federated": "cognito-identity.amazonaws.com",
                            },
                        }),
                    ]),
                },
            },
        )


class TestAuthStackOutputs:
    """Unit tests for CloudFormation outputs."""

    def test_outputs_created(
        self, app: cdk.App, cdk_env: cdk.Environment
    ) -> None:
        """Test that CloudFormation outputs are created."""
        stack = AuthStack(
            app,
            "TestAuthStack",
            config=DevEnvironmentConfig,
            env=cdk_env,
        )

        template = assertions.Template.from_stack(stack)

        # Verify outputs exist
        outputs = template.find_outputs("*")
        # Should have: UserPoolId, UserPoolArn, UserPoolClientId, UserPoolDomain,
        # UserPoolProviderUrl, IdentityPoolId, AuthenticatedRoleArn, HostedUIUrl
        assert len(outputs) >= 8

    def test_stack_properties_exposed(
        self, app: cdk.App, cdk_env: cdk.Environment
    ) -> None:
        """Test that stack properties are exposed correctly."""
        stack = AuthStack(
            app,
            "TestAuthStack",
            config=DevEnvironmentConfig,
            env=cdk_env,
        )

        # Verify all properties are accessible
        assert stack.user_pool is not None
        assert stack.user_pool_client is not None
        assert stack.user_pool_domain is not None
        assert stack.identity_pool is not None
        assert stack.authenticated_role is not None
        assert stack.unauthenticated_role is not None


class TestAuthStackEnvironments:
    """Unit tests for different environment configurations."""

    def test_staging_environment(self, app: cdk.App) -> None:
        """Test that staging environment creates same resources."""
        staging_env = cdk.Environment(
            account=StagingEnvironmentConfig.aws_account_id,
            region=StagingEnvironmentConfig.aws_region,
        )

        stack = AuthStack(
            app,
            "TestStagingAuthStack",
            config=StagingEnvironmentConfig,
            env=staging_env,
        )

        template = assertions.Template.from_stack(stack)

        # Verify same resources are created
        template.resource_count_is("AWS::Cognito::UserPool", 1)
        template.resource_count_is("AWS::Cognito::UserPoolClient", 1)
        template.resource_count_is("AWS::Cognito::UserPoolDomain", 1)
        template.resource_count_is("AWS::Cognito::IdentityPool", 1)

    def test_production_environment(self, app: cdk.App) -> None:
        """Test that production environment creates same resources."""
        prod_env = cdk.Environment(
            account=ProductionEnvironmentConfig.aws_account_id,
            region=ProductionEnvironmentConfig.aws_region,
        )

        stack = AuthStack(
            app,
            "TestProdAuthStack",
            config=ProductionEnvironmentConfig,
            env=prod_env,
        )

        template = assertions.Template.from_stack(stack)

        # Verify same resources are created
        template.resource_count_is("AWS::Cognito::UserPool", 1)
        template.resource_count_is("AWS::Cognito::UserPoolClient", 1)
        template.resource_count_is("AWS::Cognito::UserPoolDomain", 1)
        template.resource_count_is("AWS::Cognito::IdentityPool", 1)

    def test_production_password_policy(self, app: cdk.App) -> None:
        """Test that production has stronger password policy."""
        prod_env = cdk.Environment(
            account=ProductionEnvironmentConfig.aws_account_id,
            region=ProductionEnvironmentConfig.aws_region,
        )

        stack = AuthStack(
            app,
            "TestProdAuthStack",
            config=ProductionEnvironmentConfig,
            env=prod_env,
        )

        template = assertions.Template.from_stack(stack)

        # Verify stronger password policy for production
        template.has_resource_properties(
            "AWS::Cognito::UserPool",
            {
                "Policies": {
                    "PasswordPolicy": {
                        "MinimumLength": ProductionEnvironmentConfig.auth.password_min_length,
                    },
                },
            },
        )

    def test_production_token_validity(self, app: cdk.App) -> None:
        """Test that production has shorter token validity."""
        prod_env = cdk.Environment(
            account=ProductionEnvironmentConfig.aws_account_id,
            region=ProductionEnvironmentConfig.aws_region,
        )

        stack = AuthStack(
            app,
            "TestProdAuthStack",
            config=ProductionEnvironmentConfig,
            env=prod_env,
        )

        template = assertions.Template.from_stack(stack)

        # Verify shorter token validity for production
        # Note: CDK converts refresh token days to minutes internally
        # 7 days = 7 * 24 * 60 = 10080 minutes
        template.has_resource_properties(
            "AWS::Cognito::UserPoolClient",
            {
                "AccessTokenValidity": ProductionEnvironmentConfig.auth.access_token_validity_minutes,
                "RefreshTokenValidity": ProductionEnvironmentConfig.auth.refresh_token_validity_days * 24 * 60,
            },
        )
