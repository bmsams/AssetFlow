"""
Pytest configuration and fixtures for CDK tests.
"""

import pytest
import aws_cdk as cdk

from config.environments import DevEnvironmentConfig, EnvironmentConfig


@pytest.fixture
def app() -> cdk.App:
    """Create a CDK app for testing."""
    return cdk.App()


@pytest.fixture
def dev_config() -> EnvironmentConfig:
    """Get development environment configuration."""
    return DevEnvironmentConfig


@pytest.fixture
def cdk_env(dev_config: EnvironmentConfig) -> cdk.Environment:
    """Create a CDK environment from dev config."""
    return cdk.Environment(
        account=dev_config.aws_account_id,
        region=dev_config.aws_region,
    )
