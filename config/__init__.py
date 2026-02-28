"""
Configuration module for Asset Management System CDK infrastructure.

This module provides environment-specific configurations for deploying
the Asset Management System across different AWS accounts and regions.
"""

from config.environments import (
    EnvironmentConfig,
    get_environment_config,
    DevEnvironmentConfig,
    StagingEnvironmentConfig,
    ProductionEnvironmentConfig,
)

__all__ = [
    "EnvironmentConfig",
    "get_environment_config",
    "DevEnvironmentConfig",
    "StagingEnvironmentConfig",
    "ProductionEnvironmentConfig",
]
