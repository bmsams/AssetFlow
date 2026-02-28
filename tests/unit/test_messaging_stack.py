"""
Unit tests for MessagingStack.

These tests verify that the MessagingStack creates the expected
SQS queues, SNS topics, and CloudWatch alarms with proper configuration
following AWS Well-Architected Framework principles.

**Validates: Requirements 1.6**
"""

import pytest
import aws_cdk as cdk
from aws_cdk import assertions

from stacks.messaging_stack import MessagingStack
from config.environments import (
    DevEnvironmentConfig,
    StagingEnvironmentConfig,
    ProductionEnvironmentConfig,
)


@pytest.fixture
def messaging_stack(app: cdk.App, cdk_env: cdk.Environment) -> MessagingStack:
    """Create a MessagingStack for testing."""
    return MessagingStack(
        app,
        "TestMessagingStack",
        config=DevEnvironmentConfig,
        env=cdk_env,
    )


class TestMessagingStackUnitTests:
    """Unit tests for MessagingStack."""

    def test_event_queue_created(
        self, app: cdk.App, cdk_env: cdk.Environment
    ) -> None:
        """Test that an event queue is created."""
        stack = MessagingStack(
            app,
            "TestMessagingStack",
            config=DevEnvironmentConfig,
            env=cdk_env,
        )

        template = assertions.Template.from_stack(stack)

        # Verify at least 2 queues are created (main queue + DLQ)
        template.resource_count_is("AWS::SQS::Queue", 2)

    def test_dead_letter_queue_created(
        self, app: cdk.App, cdk_env: cdk.Environment
    ) -> None:
        """Test that a dead-letter queue is created."""
        stack = MessagingStack(
            app,
            "TestMessagingStack",
            config=DevEnvironmentConfig,
            env=cdk_env,
        )

        template = assertions.Template.from_stack(stack)

        # Verify DLQ has 14-day retention (in seconds)
        template.has_resource_properties(
            "AWS::SQS::Queue",
            {
                "MessageRetentionPeriod": 1209600,  # 14 days in seconds
            },
        )

    def test_event_queue_visibility_timeout(
        self, app: cdk.App, cdk_env: cdk.Environment
    ) -> None:
        """Test that event queue has 6-minute visibility timeout."""
        stack = MessagingStack(
            app,
            "TestMessagingStack",
            config=DevEnvironmentConfig,
            env=cdk_env,
        )

        template = assertions.Template.from_stack(stack)

        # Verify visibility timeout is 6 minutes (360 seconds)
        template.has_resource_properties(
            "AWS::SQS::Queue",
            {
                "VisibilityTimeout": 360,
            },
        )

    def test_event_queue_retention_period(
        self, app: cdk.App, cdk_env: cdk.Environment
    ) -> None:
        """Test that event queue has 7-day retention period."""
        stack = MessagingStack(
            app,
            "TestMessagingStack",
            config=DevEnvironmentConfig,
            env=cdk_env,
        )

        template = assertions.Template.from_stack(stack)

        # Verify retention period is 7 days (in seconds)
        template.has_resource_properties(
            "AWS::SQS::Queue",
            {
                "MessageRetentionPeriod": 604800,  # 7 days in seconds
            },
        )

    def test_event_queue_dlq_configuration(
        self, app: cdk.App, cdk_env: cdk.Environment
    ) -> None:
        """Test that event queue has DLQ configuration with max receive count of 3."""
        stack = MessagingStack(
            app,
            "TestMessagingStack",
            config=DevEnvironmentConfig,
            env=cdk_env,
        )

        template = assertions.Template.from_stack(stack)

        # Verify DLQ configuration with max receive count
        template.has_resource_properties(
            "AWS::SQS::Queue",
            {
                "RedrivePolicy": assertions.Match.object_like({
                    "maxReceiveCount": 3,
                }),
            },
        )

    def test_queues_kms_encrypted(
        self, app: cdk.App, cdk_env: cdk.Environment
    ) -> None:
        """Test that queues use KMS encryption."""
        stack = MessagingStack(
            app,
            "TestMessagingStack",
            config=DevEnvironmentConfig,
            env=cdk_env,
        )

        template = assertions.Template.from_stack(stack)

        # Verify KMS key is created
        template.resource_count_is("AWS::KMS::Key", 1)

        # Verify queues reference KMS key
        queues = template.find_resources("AWS::SQS::Queue")
        for queue_id, queue in queues.items():
            assert "KmsMasterKeyId" in queue["Properties"]

    def test_sns_topic_created(
        self, app: cdk.App, cdk_env: cdk.Environment
    ) -> None:
        """Test that an SNS topic is created."""
        stack = MessagingStack(
            app,
            "TestMessagingStack",
            config=DevEnvironmentConfig,
            env=cdk_env,
        )

        template = assertions.Template.from_stack(stack)

        # Verify SNS topic is created
        template.resource_count_is("AWS::SNS::Topic", 1)

    def test_sns_topic_kms_encrypted(
        self, app: cdk.App, cdk_env: cdk.Environment
    ) -> None:
        """Test that SNS topic uses KMS encryption."""
        stack = MessagingStack(
            app,
            "TestMessagingStack",
            config=DevEnvironmentConfig,
            env=cdk_env,
        )

        template = assertions.Template.from_stack(stack)

        # Verify SNS topic has KMS key
        template.has_resource_properties(
            "AWS::SNS::Topic",
            {
                "KmsMasterKeyId": assertions.Match.any_value(),
            },
        )

    def test_sns_topic_display_name(
        self, app: cdk.App, cdk_env: cdk.Environment
    ) -> None:
        """Test that SNS topic has display name."""
        stack = MessagingStack(
            app,
            "TestMessagingStack",
            config=DevEnvironmentConfig,
            env=cdk_env,
        )

        template = assertions.Template.from_stack(stack)

        # Verify SNS topic has display name
        template.has_resource_properties(
            "AWS::SNS::Topic",
            {
                "DisplayName": "Asset Management Events",
            },
        )

    def test_queue_subscription_to_topic(
        self, app: cdk.App, cdk_env: cdk.Environment
    ) -> None:
        """Test that queue is subscribed to topic."""
        stack = MessagingStack(
            app,
            "TestMessagingStack",
            config=DevEnvironmentConfig,
            env=cdk_env,
        )

        template = assertions.Template.from_stack(stack)

        # Verify SNS subscription is created
        template.resource_count_is("AWS::SNS::Subscription", 1)

        # Verify subscription protocol is SQS
        template.has_resource_properties(
            "AWS::SNS::Subscription",
            {
                "Protocol": "sqs",
            },
        )

    def test_subscription_raw_message_delivery(
        self, app: cdk.App, cdk_env: cdk.Environment
    ) -> None:
        """Test that subscription uses raw message delivery."""
        stack = MessagingStack(
            app,
            "TestMessagingStack",
            config=DevEnvironmentConfig,
            env=cdk_env,
        )

        template = assertions.Template.from_stack(stack)

        # Verify raw message delivery is enabled
        template.has_resource_properties(
            "AWS::SNS::Subscription",
            {
                "RawMessageDelivery": True,
            },
        )

    def test_cloudwatch_alarm_created(
        self, app: cdk.App, cdk_env: cdk.Environment
    ) -> None:
        """Test that CloudWatch alarm for DLQ is created."""
        stack = MessagingStack(
            app,
            "TestMessagingStack",
            config=DevEnvironmentConfig,
            env=cdk_env,
        )

        template = assertions.Template.from_stack(stack)

        # Verify CloudWatch alarm is created
        template.resource_count_is("AWS::CloudWatch::Alarm", 1)

    def test_dlq_alarm_threshold(
        self, app: cdk.App, cdk_env: cdk.Environment
    ) -> None:
        """Test that DLQ alarm triggers on 1 or more messages."""
        stack = MessagingStack(
            app,
            "TestMessagingStack",
            config=DevEnvironmentConfig,
            env=cdk_env,
        )

        template = assertions.Template.from_stack(stack)

        # Verify alarm threshold is 1
        template.has_resource_properties(
            "AWS::CloudWatch::Alarm",
            {
                "Threshold": 1,
                "EvaluationPeriods": 1,
            },
        )

    def test_dlq_alarm_metric(
        self, app: cdk.App, cdk_env: cdk.Environment
    ) -> None:
        """Test that DLQ alarm monitors ApproximateNumberOfMessagesVisible."""
        stack = MessagingStack(
            app,
            "TestMessagingStack",
            config=DevEnvironmentConfig,
            env=cdk_env,
        )

        template = assertions.Template.from_stack(stack)

        # Verify alarm metric
        template.has_resource_properties(
            "AWS::CloudWatch::Alarm",
            {
                "MetricName": "ApproximateNumberOfMessagesVisible",
                "Namespace": "AWS/SQS",
            },
        )

    def test_kms_key_rotation_enabled(
        self, app: cdk.App, cdk_env: cdk.Environment
    ) -> None:
        """Test that KMS key has rotation enabled."""
        stack = MessagingStack(
            app,
            "TestMessagingStack",
            config=DevEnvironmentConfig,
            env=cdk_env,
        )

        template = assertions.Template.from_stack(stack)

        # Verify KMS key rotation is enabled
        template.has_resource_properties(
            "AWS::KMS::Key",
            {
                "EnableKeyRotation": True,
            },
        )

    def test_outputs_created(
        self, app: cdk.App, cdk_env: cdk.Environment
    ) -> None:
        """Test that CloudFormation outputs are created."""
        stack = MessagingStack(
            app,
            "TestMessagingStack",
            config=DevEnvironmentConfig,
            env=cdk_env,
        )

        template = assertions.Template.from_stack(stack)

        # Verify outputs exist
        outputs = template.find_outputs("*")
        # Should have: EventQueueUrl, EventQueueArn, DLQUrl, DLQArn,
        # EventTopicArn, EncryptionKeyArn, DLQAlarmArn
        assert len(outputs) >= 7

    def test_stack_properties_exposed(
        self, app: cdk.App, cdk_env: cdk.Environment
    ) -> None:
        """Test that stack properties are exposed correctly."""
        stack = MessagingStack(
            app,
            "TestMessagingStack",
            config=DevEnvironmentConfig,
            env=cdk_env,
        )

        # Verify all properties are accessible
        assert stack.event_queue is not None
        assert stack.dlq is not None
        assert stack.event_topic is not None
        assert stack.dlq_alarm is not None
        assert stack.encryption_key is not None

    def test_staging_environment(self, app: cdk.App) -> None:
        """Test that staging environment creates same resources."""
        staging_env = cdk.Environment(
            account=StagingEnvironmentConfig.aws_account_id,
            region=StagingEnvironmentConfig.aws_region,
        )

        stack = MessagingStack(
            app,
            "TestStagingMessagingStack",
            config=StagingEnvironmentConfig,
            env=staging_env,
        )

        template = assertions.Template.from_stack(stack)

        # Verify same resources are created
        template.resource_count_is("AWS::SQS::Queue", 2)
        template.resource_count_is("AWS::SNS::Topic", 1)
        template.resource_count_is("AWS::CloudWatch::Alarm", 1)

    def test_production_environment(self, app: cdk.App) -> None:
        """Test that production environment creates same resources."""
        prod_env = cdk.Environment(
            account=ProductionEnvironmentConfig.aws_account_id,
            region=ProductionEnvironmentConfig.aws_region,
        )

        stack = MessagingStack(
            app,
            "TestProdMessagingStack",
            config=ProductionEnvironmentConfig,
            env=prod_env,
        )

        template = assertions.Template.from_stack(stack)

        # Verify same resources are created
        template.resource_count_is("AWS::SQS::Queue", 2)
        template.resource_count_is("AWS::SNS::Topic", 1)
        template.resource_count_is("AWS::CloudWatch::Alarm", 1)

    def test_production_kms_key_retained(self, app: cdk.App) -> None:
        """Test that production KMS key has RETAIN removal policy."""
        prod_env = cdk.Environment(
            account=ProductionEnvironmentConfig.aws_account_id,
            region=ProductionEnvironmentConfig.aws_region,
        )

        stack = MessagingStack(
            app,
            "TestProdMessagingStack",
            config=ProductionEnvironmentConfig,
            env=prod_env,
        )

        template = assertions.Template.from_stack(stack)

        # Verify KMS key has Retain deletion policy in production
        template.has_resource(
            "AWS::KMS::Key",
            {
                "DeletionPolicy": "Retain",
                "UpdateReplacePolicy": "Retain",
            },
        )

    def test_dev_kms_key_deletable(
        self, app: cdk.App, cdk_env: cdk.Environment
    ) -> None:
        """Test that dev KMS key can be deleted."""
        stack = MessagingStack(
            app,
            "TestMessagingStack",
            config=DevEnvironmentConfig,
            env=cdk_env,
        )

        template = assertions.Template.from_stack(stack)

        # Verify KMS key has Delete deletion policy in dev
        template.has_resource(
            "AWS::KMS::Key",
            {
                "DeletionPolicy": "Delete",
            },
        )

    def test_queue_naming_convention(
        self, app: cdk.App, cdk_env: cdk.Environment
    ) -> None:
        """Test that queues follow naming convention."""
        stack = MessagingStack(
            app,
            "TestMessagingStack",
            config=DevEnvironmentConfig,
            env=cdk_env,
        )

        template = assertions.Template.from_stack(stack)

        # Verify queue names follow convention
        template.has_resource_properties(
            "AWS::SQS::Queue",
            {
                "QueueName": assertions.Match.string_like_regexp(
                    r"ams-dev-asset-events.*"
                ),
            },
        )

    def test_topic_naming_convention(
        self, app: cdk.App, cdk_env: cdk.Environment
    ) -> None:
        """Test that topic follows naming convention."""
        stack = MessagingStack(
            app,
            "TestMessagingStack",
            config=DevEnvironmentConfig,
            env=cdk_env,
        )

        template = assertions.Template.from_stack(stack)

        # Verify topic name follows convention
        template.has_resource_properties(
            "AWS::SNS::Topic",
            {
                "TopicName": "ams-dev-asset-events",
            },
        )

    def test_sqs_queue_policy_created(
        self, app: cdk.App, cdk_env: cdk.Environment
    ) -> None:
        """Test that SQS queue policies are created for SSL enforcement and SNS subscription."""
        stack = MessagingStack(
            app,
            "TestMessagingStack",
            config=DevEnvironmentConfig,
            env=cdk_env,
        )

        template = assertions.Template.from_stack(stack)

        # Verify queue policies are created (one for each queue with enforce_ssl)
        template.resource_count_is("AWS::SQS::QueuePolicy", 2)
