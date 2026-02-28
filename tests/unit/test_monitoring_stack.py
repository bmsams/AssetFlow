"""
Unit tests and Property-based tests for MonitoringStack.

These tests verify that the MonitoringStack creates the expected
CloudWatch infrastructure with proper configuration following AWS
Well-Architected Framework principles.

**Validates: Requirements 1.9, 15.1, 15.2, 15.3**
"""

import pytest
import aws_cdk as cdk
from aws_cdk import assertions
from hypothesis import given, settings, strategies as st

from stacks.monitoring_stack import MonitoringStack
from config.environments import (
    DevEnvironmentConfig,
    StagingEnvironmentConfig,
    ProductionEnvironmentConfig,
    EnvironmentConfig,
    MonitoringConfig,
)


class TestMonitoringStackUnitTests:
    """Unit tests for MonitoringStack."""

    def test_alarm_topic_created(self, app: cdk.App, cdk_env: cdk.Environment) -> None:
        """Test that an SNS alarm notification topic is created."""
        stack = MonitoringStack(
            app,
            "TestMonitoringStack",
            config=DevEnvironmentConfig,
            env=cdk_env,
        )

        template = assertions.Template.from_stack(stack)

        # Verify SNS topic is created
        template.resource_count_is("AWS::SNS::Topic", 1)

    def test_alarm_topic_has_encryption(self, app: cdk.App, cdk_env: cdk.Environment) -> None:
        """Test that the alarm topic has KMS encryption."""
        stack = MonitoringStack(
            app,
            "TestMonitoringStack",
            config=DevEnvironmentConfig,
            env=cdk_env,
        )

        template = assertions.Template.from_stack(stack)

        # Verify SNS topic has KMS encryption
        template.has_resource_properties(
            "AWS::SNS::Topic",
            {
                "KmsMasterKeyId": assertions.Match.any_value()
            }
        )

    def test_log_groups_created(self, app: cdk.App, cdk_env: cdk.Environment) -> None:
        """Test that log groups are created for various services."""
        stack = MonitoringStack(
            app,
            "TestMonitoringStack",
            config=DevEnvironmentConfig,
            env=cdk_env,
        )

        template = assertions.Template.from_stack(stack)

        # Verify log groups are created (lambda, api_gateway, application, audit)
        template.resource_count_is("AWS::Logs::LogGroup", 4)

    def test_log_groups_have_retention(self, app: cdk.App, cdk_env: cdk.Environment) -> None:
        """Test that log groups have retention policies configured."""
        stack = MonitoringStack(
            app,
            "TestMonitoringStack",
            config=DevEnvironmentConfig,
            env=cdk_env,
        )

        template = assertions.Template.from_stack(stack)

        # Verify log groups have retention configured
        template.has_resource_properties(
            "AWS::Logs::LogGroup",
            {
                "RetentionInDays": assertions.Match.any_value()
            }
        )

    def test_dashboard_created(self, app: cdk.App, cdk_env: cdk.Environment) -> None:
        """Test that a CloudWatch dashboard is created."""
        stack = MonitoringStack(
            app,
            "TestMonitoringStack",
            config=DevEnvironmentConfig,
            env=cdk_env,
        )

        template = assertions.Template.from_stack(stack)

        # Verify dashboard is created
        template.resource_count_is("AWS::CloudWatch::Dashboard", 1)

    def test_dashboard_has_correct_name(self, app: cdk.App, cdk_env: cdk.Environment) -> None:
        """Test that the dashboard has the correct naming convention."""
        stack = MonitoringStack(
            app,
            "TestMonitoringStack",
            config=DevEnvironmentConfig,
            env=cdk_env,
        )

        template = assertions.Template.from_stack(stack)

        # Verify dashboard name follows convention
        template.has_resource_properties(
            "AWS::CloudWatch::Dashboard",
            {
                "DashboardName": "ams-dev-system-overview"
            }
        )

    def test_alarms_created(self, app: cdk.App, cdk_env: cdk.Environment) -> None:
        """Test that CloudWatch alarms are created."""
        stack = MonitoringStack(
            app,
            "TestMonitoringStack",
            config=DevEnvironmentConfig,
            env=cdk_env,
        )

        template = assertions.Template.from_stack(stack)

        # Verify alarms are created (api_latency, api_5xx, lambda_errors, 
        # lambda_throttles, dlq_messages, db_connections, cache_hit_rate)
        template.resource_count_is("AWS::CloudWatch::Alarm", 7)

    def test_api_latency_alarm_configured(self, app: cdk.App, cdk_env: cdk.Environment) -> None:
        """Test that API latency alarm is properly configured."""
        stack = MonitoringStack(
            app,
            "TestMonitoringStack",
            config=DevEnvironmentConfig,
            env=cdk_env,
        )

        template = assertions.Template.from_stack(stack)

        # Verify API latency alarm exists with correct metric
        # Note: p99 uses ExtendedStatistic instead of Statistic
        template.has_resource_properties(
            "AWS::CloudWatch::Alarm",
            {
                "AlarmName": "ams-dev-api-latency-high",
                "MetricName": "Latency",
                "Namespace": "AWS/ApiGateway",
                "ExtendedStatistic": "p99",
            }
        )

    def test_api_5xx_alarm_configured(self, app: cdk.App, cdk_env: cdk.Environment) -> None:
        """Test that API 5xx errors alarm is properly configured."""
        stack = MonitoringStack(
            app,
            "TestMonitoringStack",
            config=DevEnvironmentConfig,
            env=cdk_env,
        )

        template = assertions.Template.from_stack(stack)

        # Verify API 5xx alarm exists
        template.has_resource_properties(
            "AWS::CloudWatch::Alarm",
            {
                "AlarmName": "ams-dev-api-5xx-errors",
                "MetricName": "5XXError",
                "Namespace": "AWS/ApiGateway",
            }
        )

    def test_lambda_errors_alarm_configured(self, app: cdk.App, cdk_env: cdk.Environment) -> None:
        """Test that Lambda errors alarm is properly configured."""
        stack = MonitoringStack(
            app,
            "TestMonitoringStack",
            config=DevEnvironmentConfig,
            env=cdk_env,
        )

        template = assertions.Template.from_stack(stack)

        # Verify Lambda errors alarm exists
        template.has_resource_properties(
            "AWS::CloudWatch::Alarm",
            {
                "AlarmName": "ams-dev-lambda-errors",
                "MetricName": "Errors",
                "Namespace": "AWS/Lambda",
            }
        )

    def test_dlq_alarm_configured(self, app: cdk.App, cdk_env: cdk.Environment) -> None:
        """Test that DLQ messages alarm is properly configured."""
        stack = MonitoringStack(
            app,
            "TestMonitoringStack",
            config=DevEnvironmentConfig,
            env=cdk_env,
        )

        template = assertions.Template.from_stack(stack)

        # Verify DLQ alarm exists
        template.has_resource_properties(
            "AWS::CloudWatch::Alarm",
            {
                "AlarmName": "ams-dev-dlq-messages",
                "MetricName": "ApproximateNumberOfMessagesVisible",
                "Namespace": "AWS/SQS",
            }
        )

    def test_db_connections_alarm_configured(self, app: cdk.App, cdk_env: cdk.Environment) -> None:
        """Test that database connections alarm is properly configured."""
        stack = MonitoringStack(
            app,
            "TestMonitoringStack",
            config=DevEnvironmentConfig,
            env=cdk_env,
        )

        template = assertions.Template.from_stack(stack)

        # Verify DB connections alarm exists
        template.has_resource_properties(
            "AWS::CloudWatch::Alarm",
            {
                "AlarmName": "ams-dev-db-connections-high",
                "MetricName": "DatabaseConnections",
                "Namespace": "AWS/RDS",
            }
        )

    def test_cache_hit_rate_alarm_configured(self, app: cdk.App, cdk_env: cdk.Environment) -> None:
        """Test that cache hit rate alarm is properly configured."""
        stack = MonitoringStack(
            app,
            "TestMonitoringStack",
            config=DevEnvironmentConfig,
            env=cdk_env,
        )

        template = assertions.Template.from_stack(stack)

        # Verify cache hit rate alarm exists
        template.has_resource_properties(
            "AWS::CloudWatch::Alarm",
            {
                "AlarmName": "ams-dev-cache-hit-rate-low",
                "MetricName": "CacheHitRate",
                "Namespace": "AWS/ElastiCache",
            }
        )

    def test_alarms_have_sns_actions(self, app: cdk.App, cdk_env: cdk.Environment) -> None:
        """Test that alarms have SNS notification actions configured."""
        stack = MonitoringStack(
            app,
            "TestMonitoringStack",
            config=DevEnvironmentConfig,
            env=cdk_env,
        )

        template = assertions.Template.from_stack(stack)

        # Verify alarms have alarm actions
        template.has_resource_properties(
            "AWS::CloudWatch::Alarm",
            {
                "AlarmActions": assertions.Match.any_value()
            }
        )

    def test_outputs_created(self, app: cdk.App, cdk_env: cdk.Environment) -> None:
        """Test that CloudFormation outputs are created."""
        stack = MonitoringStack(
            app,
            "TestMonitoringStack",
            config=DevEnvironmentConfig,
            env=cdk_env,
        )

        template = assertions.Template.from_stack(stack)

        # Verify outputs exist
        outputs = template.find_outputs("*")
        # Should have outputs for: alarm topic, dashboard, 4 log groups, encryption key
        assert len(outputs) >= 7

    def test_kms_key_created(self, app: cdk.App, cdk_env: cdk.Environment) -> None:
        """Test that a KMS key is created for encryption."""
        stack = MonitoringStack(
            app,
            "TestMonitoringStack",
            config=DevEnvironmentConfig,
            env=cdk_env,
        )

        template = assertions.Template.from_stack(stack)

        # Verify KMS key is created
        template.resource_count_is("AWS::KMS::Key", 1)

    def test_kms_key_has_rotation(self, app: cdk.App, cdk_env: cdk.Environment) -> None:
        """Test that KMS key has rotation enabled."""
        stack = MonitoringStack(
            app,
            "TestMonitoringStack",
            config=DevEnvironmentConfig,
            env=cdk_env,
        )

        template = assertions.Template.from_stack(stack)

        # Verify KMS key has rotation enabled
        template.has_resource_properties(
            "AWS::KMS::Key",
            {
                "EnableKeyRotation": True
            }
        )

    def test_production_has_longer_log_retention(self, app: cdk.App) -> None:
        """Test that production environment has longer log retention."""
        prod_env = cdk.Environment(
            account=ProductionEnvironmentConfig.aws_account_id,
            region=ProductionEnvironmentConfig.aws_region,
        )

        stack = MonitoringStack(
            app,
            "TestProdMonitoringStack",
            config=ProductionEnvironmentConfig,
            env=prod_env,
        )

        template = assertions.Template.from_stack(stack)

        # Production should have 90-day retention (from config)
        template.has_resource_properties(
            "AWS::Logs::LogGroup",
            {
                "RetentionInDays": 90
            }
        )

    def test_production_has_stricter_thresholds(self, app: cdk.App) -> None:
        """Test that production has stricter alarm thresholds."""
        prod_env = cdk.Environment(
            account=ProductionEnvironmentConfig.aws_account_id,
            region=ProductionEnvironmentConfig.aws_region,
        )

        stack = MonitoringStack(
            app,
            "TestProdMonitoringStack",
            config=ProductionEnvironmentConfig,
            env=prod_env,
        )

        template = assertions.Template.from_stack(stack)

        # Production API latency threshold should be 1000ms
        template.has_resource_properties(
            "AWS::CloudWatch::Alarm",
            {
                "AlarmName": "ams-prod-api-latency-high",
                "Threshold": 1000,
            }
        )

    def test_dev_has_relaxed_thresholds(self, app: cdk.App, cdk_env: cdk.Environment) -> None:
        """Test that dev has more relaxed alarm thresholds."""
        stack = MonitoringStack(
            app,
            "TestMonitoringStack",
            config=DevEnvironmentConfig,
            env=cdk_env,
        )

        template = assertions.Template.from_stack(stack)

        # Dev API latency threshold should be 5000ms
        template.has_resource_properties(
            "AWS::CloudWatch::Alarm",
            {
                "AlarmName": "ams-dev-api-latency-high",
                "Threshold": 5000,
            }
        )

    def test_stack_properties_exposed(self, app: cdk.App, cdk_env: cdk.Environment) -> None:
        """Test that stack properties are exposed correctly."""
        stack = MonitoringStack(
            app,
            "TestMonitoringStack",
            config=DevEnvironmentConfig,
            env=cdk_env,
        )

        # Verify properties are accessible
        assert stack.alarm_topic is not None
        assert stack.dashboard is not None
        assert stack.encryption_key is not None
        assert len(stack.log_groups) == 4
        assert len(stack.alarms) == 7

    def test_audit_log_group_always_retained(self, app: cdk.App, cdk_env: cdk.Environment) -> None:
        """Test that audit log group always has RETAIN removal policy."""
        stack = MonitoringStack(
            app,
            "TestMonitoringStack",
            config=DevEnvironmentConfig,
            env=cdk_env,
        )

        template = assertions.Template.from_stack(stack)

        # Find the audit log group and verify it has Retain policy
        log_groups = template.find_resources("AWS::Logs::LogGroup")
        audit_log_found = False
        for log_id, log_props in log_groups.items():
            props = log_props.get("Properties", {})
            if "audit" in props.get("LogGroupName", ""):
                deletion_policy = log_props.get("DeletionPolicy")
                assert deletion_policy == "Retain", "Audit log group should have Retain policy"
                audit_log_found = True
        assert audit_log_found, "Audit log group should exist"


# Hypothesis strategies for generating valid monitoring configurations
@st.composite
def valid_monitoring_config(draw: st.DrawFn) -> MonitoringConfig:
    """Generate valid monitoring configurations for property-based testing."""
    return MonitoringConfig(
        log_retention_days=draw(st.sampled_from([7, 14, 30, 60, 90])),
        enable_detailed_monitoring=draw(st.booleans()),
        alarm_evaluation_periods=draw(st.integers(min_value=1, max_value=5)),
        alarm_datapoints_to_alarm=draw(st.integers(min_value=1, max_value=5)),
    )


@st.composite
def valid_environment_config(draw: st.DrawFn) -> EnvironmentConfig:
    """Generate valid environment configurations for property-based testing."""
    env_name = draw(st.sampled_from(["dev", "staging", "prod"]))
    monitoring_config = draw(valid_monitoring_config())
    
    # Ensure datapoints_to_alarm <= evaluation_periods
    if monitoring_config.alarm_datapoints_to_alarm > monitoring_config.alarm_evaluation_periods:
        monitoring_config = MonitoringConfig(
            log_retention_days=monitoring_config.log_retention_days,
            enable_detailed_monitoring=monitoring_config.enable_detailed_monitoring,
            alarm_evaluation_periods=monitoring_config.alarm_evaluation_periods,
            alarm_datapoints_to_alarm=monitoring_config.alarm_evaluation_periods,
        )

    return EnvironmentConfig(
        environment_name=env_name,
        aws_account_id="123456789012",
        aws_region="us-east-1",
        monitoring=monitoring_config,
    )


@pytest.mark.property
class TestMonitoringStackPropertyTests:
    """
    Property-based tests for MonitoringStack.

    **Validates: Requirements 1.9, 15.1, 15.2, 15.3**

    These tests verify that the MonitoringStack produces valid CDK infrastructure
    across a wide range of configuration inputs.
    """

    @given(config=valid_environment_config())
    @settings(max_examples=5, deadline=None)
    def test_stack_synthesizes_for_any_valid_config(self, config: EnvironmentConfig) -> None:
        """
        Property: Any valid environment configuration produces a synthesizable stack.

        **Validates: Requirements 1.9**

        This property ensures that the MonitoringStack can be synthesized without
        errors for any valid combination of environment settings.
        """
        app = cdk.App()
        env = cdk.Environment(
            account=config.aws_account_id,
            region=config.aws_region,
        )

        # Should not raise any exceptions
        stack = MonitoringStack(
            app,
            f"TestMonitoringStack-{config.environment_name}",
            config=config,
            env=env,
        )

        # Verify stack can be synthesized
        template = assertions.Template.from_stack(stack)
        assert template is not None

    @given(config=valid_environment_config())
    @settings(max_examples=5, deadline=None)
    def test_alarm_topic_always_created(self, config: EnvironmentConfig) -> None:
        """
        Property: An SNS alarm topic is always created regardless of configuration.

        **Validates: Requirements 15.1**

        This property ensures that alarm notifications are always available.
        """
        app = cdk.App()
        env = cdk.Environment(
            account=config.aws_account_id,
            region=config.aws_region,
        )

        stack = MonitoringStack(
            app,
            f"TestMonitoringStack-{config.environment_name}",
            config=config,
            env=env,
        )

        template = assertions.Template.from_stack(stack)
        template.resource_count_is("AWS::SNS::Topic", 1)

    @given(config=valid_environment_config())
    @settings(max_examples=5, deadline=None)
    def test_four_log_groups_always_created(self, config: EnvironmentConfig) -> None:
        """
        Property: Four log groups are always created regardless of configuration.

        **Validates: Requirements 15.3**

        This property ensures that log groups for Lambda, API Gateway, 
        application, and audit are always created.
        """
        app = cdk.App()
        env = cdk.Environment(
            account=config.aws_account_id,
            region=config.aws_region,
        )

        stack = MonitoringStack(
            app,
            f"TestMonitoringStack-{config.environment_name}",
            config=config,
            env=env,
        )

        template = assertions.Template.from_stack(stack)
        template.resource_count_is("AWS::Logs::LogGroup", 4)

    @given(config=valid_environment_config())
    @settings(max_examples=5, deadline=None)
    def test_dashboard_always_created(self, config: EnvironmentConfig) -> None:
        """
        Property: A CloudWatch dashboard is always created regardless of configuration.

        **Validates: Requirements 15.1**

        This property ensures that system metrics visualization is always available.
        """
        app = cdk.App()
        env = cdk.Environment(
            account=config.aws_account_id,
            region=config.aws_region,
        )

        stack = MonitoringStack(
            app,
            f"TestMonitoringStack-{config.environment_name}",
            config=config,
            env=env,
        )

        template = assertions.Template.from_stack(stack)
        template.resource_count_is("AWS::CloudWatch::Dashboard", 1)

    @given(config=valid_environment_config())
    @settings(max_examples=5, deadline=None)
    def test_seven_alarms_always_created(self, config: EnvironmentConfig) -> None:
        """
        Property: Seven CloudWatch alarms are always created regardless of configuration.

        **Validates: Requirements 15.2**

        This property ensures that critical threshold monitoring is always in place.
        """
        app = cdk.App()
        env = cdk.Environment(
            account=config.aws_account_id,
            region=config.aws_region,
        )

        stack = MonitoringStack(
            app,
            f"TestMonitoringStack-{config.environment_name}",
            config=config,
            env=env,
        )

        template = assertions.Template.from_stack(stack)
        template.resource_count_is("AWS::CloudWatch::Alarm", 7)

    @given(config=valid_environment_config())
    @settings(max_examples=5, deadline=None)
    def test_all_log_groups_have_retention(self, config: EnvironmentConfig) -> None:
        """
        Property: All log groups have retention policies configured.

        **Validates: Requirements 15.3**

        This property ensures that log retention is always configured for
        cost optimization and compliance.
        """
        app = cdk.App()
        env = cdk.Environment(
            account=config.aws_account_id,
            region=config.aws_region,
        )

        stack = MonitoringStack(
            app,
            f"TestMonitoringStack-{config.environment_name}",
            config=config,
            env=env,
        )

        template = assertions.Template.from_stack(stack)
        log_groups = template.find_resources("AWS::Logs::LogGroup")

        for log_id, log_props in log_groups.items():
            props = log_props.get("Properties", {})
            assert "RetentionInDays" in props, f"Log group {log_id} should have retention"

    @given(config=valid_environment_config())
    @settings(max_examples=5, deadline=None)
    def test_kms_encryption_always_enabled(self, config: EnvironmentConfig) -> None:
        """
        Property: KMS encryption is always enabled for the alarm topic.

        **Validates: Requirements 1.9**

        This property ensures that alarm notifications are always encrypted.
        """
        app = cdk.App()
        env = cdk.Environment(
            account=config.aws_account_id,
            region=config.aws_region,
        )

        stack = MonitoringStack(
            app,
            f"TestMonitoringStack-{config.environment_name}",
            config=config,
            env=env,
        )

        template = assertions.Template.from_stack(stack)
        
        # Verify KMS key is created
        template.resource_count_is("AWS::KMS::Key", 1)
        
        # Verify SNS topic has KMS encryption
        template.has_resource_properties(
            "AWS::SNS::Topic",
            {
                "KmsMasterKeyId": assertions.Match.any_value()
            }
        )

    @given(config=valid_environment_config())
    @settings(max_examples=5, deadline=None)
    def test_outputs_always_created(self, config: EnvironmentConfig) -> None:
        """
        Property: CloudFormation outputs are always created for cross-stack references.

        **Validates: Requirements 1.9**

        This property ensures that essential outputs are always created.
        """
        app = cdk.App()
        env = cdk.Environment(
            account=config.aws_account_id,
            region=config.aws_region,
        )

        stack = MonitoringStack(
            app,
            f"TestMonitoringStack-{config.environment_name}",
            config=config,
            env=env,
        )

        template = assertions.Template.from_stack(stack)
        outputs = template.find_outputs("*")

        # Should have at least 7 outputs
        assert len(outputs) >= 7

    @given(config=valid_environment_config())
    @settings(max_examples=5, deadline=None)
    def test_stack_properties_exposed_correctly(self, config: EnvironmentConfig) -> None:
        """
        Property: Stack properties are exposed correctly for all configurations.

        **Validates: Requirements 1.9**

        This property ensures that the stack exposes all necessary constructs
        through its properties for use by other stacks.
        """
        app = cdk.App()
        env = cdk.Environment(
            account=config.aws_account_id,
            region=config.aws_region,
        )

        stack = MonitoringStack(
            app,
            f"TestMonitoringStack-{config.environment_name}",
            config=config,
            env=env,
        )

        # Verify all properties are accessible
        assert stack.alarm_topic is not None
        assert stack.dashboard is not None
        assert stack.encryption_key is not None
        assert len(stack.log_groups) == 4
        assert len(stack.alarms) == 7
        assert "lambda" in stack.log_groups
        assert "api_gateway" in stack.log_groups
        assert "application" in stack.log_groups
        assert "audit" in stack.log_groups
