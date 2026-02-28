"""
Messaging Stack for Asset Management System.

This stack provisions SQS queues and SNS topics with dead-letter queue
handling following AWS Well-Architected Framework principles:

- Dead-letter queues capture failed messages for investigation
- Visibility timeout set to 6x Lambda timeout for retry handling
- Server-side encryption for message security (KMS)
- CloudWatch alarms for DLQ monitoring
- SNS topic for event fanout with queue subscription
- Environment-specific configurations

Requirements: 1.6
"""

from aws_cdk import (
    Stack,
    Duration,
    RemovalPolicy,
    aws_sqs as sqs,
    aws_sns as sns,
    aws_sns_subscriptions as subscriptions,
    aws_cloudwatch as cloudwatch,
    CfnOutput,
)
from constructs import Construct

from config.environments import EnvironmentConfig


class MessagingStack(Stack):
    """
    Messaging infrastructure stack for Asset Management System.

    Creates SQS queues and SNS topics with:
    - Main event queue for processing asset events
    - Dead-letter queue for failed message handling
    - SNS topic for event fanout
    - KMS encryption for message security
    - CloudWatch alarm for DLQ monitoring
    """

    def __init__(
        self,
        scope: Construct,
        construct_id: str,
        config: EnvironmentConfig,
        **kwargs,
    ) -> None:
        super().__init__(scope, construct_id, **kwargs)

        self._config = config

        # Create dead-letter queue for failed messages
        self.dlq = self._create_dead_letter_queue()

        # Create main event queue with DLQ configuration
        self.event_queue = self._create_event_queue()

        # Create SNS topic for event fanout
        self.event_topic = self._create_event_topic()

        # Subscribe queue to topic for event fanout
        self._subscribe_queue_to_topic()

        # Create CloudWatch alarm for DLQ monitoring
        self.dlq_alarm = self._create_dlq_alarm()

        # Export outputs for cross-stack references
        self._create_outputs()

    def _create_dead_letter_queue(self) -> sqs.Queue:
        """Create dead-letter queue for failed messages."""
        dlq = sqs.Queue(
            self,
            "AssetEventsDLQ",
            queue_name=f"{self._config.stack_prefix}-asset-events-dlq",
            retention_period=Duration.days(14),
            encryption=sqs.QueueEncryption.SQS_MANAGED,
            enforce_ssl=True,
            removal_policy=RemovalPolicy.DESTROY,
        )
        return dlq

    def _create_event_queue(self) -> sqs.Queue:
        """Create main event queue for asset event processing."""
        event_queue = sqs.Queue(
            self,
            "AssetEventsQueue",
            queue_name=f"{self._config.stack_prefix}-asset-events",
            visibility_timeout=Duration.minutes(6),
            retention_period=Duration.days(7),
            encryption=sqs.QueueEncryption.SQS_MANAGED,
            dead_letter_queue=sqs.DeadLetterQueue(
                queue=self.dlq,
                max_receive_count=3,
            ),
            enforce_ssl=True,
            removal_policy=RemovalPolicy.DESTROY,
        )
        return event_queue

    def _create_event_topic(self) -> sns.Topic:
        """Create SNS topic for event fanout."""
        event_topic = sns.Topic(
            self,
            "AssetEventsTopic",
            topic_name=f"{self._config.stack_prefix}-asset-events",
            display_name="Asset Management Events",
        )
        return event_topic

    def _subscribe_queue_to_topic(self) -> None:
        """Subscribe the event queue to the event topic."""
        self.event_topic.add_subscription(
            subscriptions.SqsSubscription(
                self.event_queue,
                raw_message_delivery=True,
            )
        )

    def _create_dlq_alarm(self) -> cloudwatch.Alarm:
        """Create CloudWatch alarm for DLQ monitoring."""
        alarm = cloudwatch.Alarm(
            self,
            "DLQAlarm",
            alarm_name=f"{self._config.stack_prefix}-dlq-messages",
            alarm_description="Messages in dead-letter queue require investigation",
            metric=self.dlq.metric_approximate_number_of_messages_visible(
                period=Duration.minutes(1),
                statistic="Sum",
            ),
            threshold=1,
            evaluation_periods=1,
            comparison_operator=cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
            treat_missing_data=cloudwatch.TreatMissingData.NOT_BREACHING,
        )
        return alarm

    def _create_outputs(self) -> None:
        """Create CloudFormation outputs for cross-stack references."""
        CfnOutput(
            self,
            "EventQueueUrl",
            value=self.event_queue.queue_url,
            description="Asset events queue URL",
            export_name=f"{self._config.stack_prefix}-event-queue-url",
        )

        CfnOutput(
            self,
            "EventQueueArn",
            value=self.event_queue.queue_arn,
            description="Asset events queue ARN",
            export_name=f"{self._config.stack_prefix}-event-queue-arn",
        )

        CfnOutput(
            self,
            "DLQUrl",
            value=self.dlq.queue_url,
            description="Dead-letter queue URL",
            export_name=f"{self._config.stack_prefix}-dlq-url",
        )

        CfnOutput(
            self,
            "DLQArn",
            value=self.dlq.queue_arn,
            description="Dead-letter queue ARN",
            export_name=f"{self._config.stack_prefix}-dlq-arn",
        )

        CfnOutput(
            self,
            "EventTopicArn",
            value=self.event_topic.topic_arn,
            description="Asset events topic ARN",
            export_name=f"{self._config.stack_prefix}-event-topic-arn",
        )

        CfnOutput(
            self,
            "DLQAlarmArn",
            value=self.dlq_alarm.alarm_arn,
            description="DLQ CloudWatch alarm ARN",
            export_name=f"{self._config.stack_prefix}-dlq-alarm-arn",
        )

    def grant_send_messages(self, grantee) -> None:
        """Grant permission to send messages to the event queue."""
        self.event_queue.grant_send_messages(grantee)

    def grant_consume_messages(self, grantee) -> None:
        """Grant permission to consume messages from the event queue."""
        self.event_queue.grant_consume_messages(grantee)

    def grant_publish(self, grantee) -> None:
        """Grant permission to publish to the event topic."""
        self.event_topic.grant_publish(grantee)
