"""
CDK assertion tests for Lambda environment variables.

Feature: integrity-fixes
Property 3: Lambda environment completeness
Validates: Requirements 7.1, 7.2
"""

import pytest
import aws_cdk as cdk
from aws_cdk import assertions, aws_ec2 as ec2, aws_secretsmanager as sm
from hypothesis import HealthCheck, given, settings, strategies as st

from config.environments import DevEnvironmentConfig
from stacks.api_stack import ApiStack
from stacks.api_lambda_stack import ApiLambdaNestedStack


@pytest.fixture
def stack_with_opensearch(app: cdk.App, cdk_env: cdk.Environment):
    api_stack = ApiStack(
        app,
        "TestApiStackEnvVars",
        config=DevEnvironmentConfig,
        env=cdk_env,
    )

    vpc = ec2.Vpc(api_stack, "TestVpcEnvVars")
    db_sg = ec2.SecurityGroup(api_stack, "TestDbSgEnvVars", vpc=vpc)
    db_secret = sm.Secret(api_stack, "TestDbSecretEnvVars")

    nested = ApiLambdaNestedStack(
        api_stack,
        "TestApiLambdasEnvVars",
        config=DevEnvironmentConfig,
        rest_api_id=api_stack.api.rest_api_id,
        root_resource_id=api_stack.api.rest_api_root_resource_id,
        vpc=vpc,
        db_secret_arn=db_secret.secret_arn,
        db_security_group=db_sg,
        cache_endpoint="redis://test:6379",
        opensearch_endpoint="https://example-opensearch.local",
    )

    return nested


def _lambda_env_vars(template: assertions.Template):
    lambdas = template.find_resources("AWS::Lambda::Function")
    envs = []
    for _logical_id, res in lambdas.items():
        props = res.get("Properties", {})
        envs.append(props.get("Environment", {}).get("Variables", {}))
    return envs


class TestLambdaEnvCompleteness:
    @given(idx=st.integers(min_value=0, max_value=1000))
    @settings(
        max_examples=100,
        deadline=None,
        suppress_health_check=[HealthCheck.function_scoped_fixture],
    )
    def test_all_lambdas_have_service_name(self, idx: int, stack_with_opensearch) -> None:
        template = assertions.Template.from_stack(stack_with_opensearch)
        envs = _lambda_env_vars(template)
        assert envs, "expected at least one Lambda"

        env = envs[idx % len(envs)]
        assert "SERVICE_NAME" in env
        assert isinstance(env["SERVICE_NAME"], str)
        assert env["SERVICE_NAME"]

    def test_search_assets_lambda_has_opensearch_endpoint(self, stack_with_opensearch) -> None:
        template = assertions.Template.from_stack(stack_with_opensearch)

        # There should be a Lambda wired for dist/handlers/search-assets.handler with OPENSEARCH_ENDPOINT.
        template.has_resource_properties(
            "AWS::Lambda::Function",
            {
                "Handler": "dist/handlers/search-assets.handler",
                "Environment": {
                    "Variables": {
                        "OPENSEARCH_ENDPOINT": "https://example-opensearch.local",
                    }
                },
            },
        )

