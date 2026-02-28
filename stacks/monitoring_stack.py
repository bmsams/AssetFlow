"""
Monitoring Stack for Asset Management System.

This stack provisions CloudWatch dashboards, alarms, and log groups following
AWS Well-Architected Framework principles:

- CloudWatch dashboards for system overview and metrics visualization
- Alarms for critical thresholds (latency, errors, DLQ messages)
- Log groups with configurable retention policies
- SNS topic for alarm notifications
- Environment-specific configurations

Requirements: 1.9, 15.1, 15.2, 15.3
"""

from aws_cdk import (
    Stack,
    Duration,
    RemovalPolicy,
    aws_cloudwatch as cloudwatch,
    aws_cloudwatch_actions as cloudwatch_actions,
    aws_logs as logs,
    aws_sns as sns,
    aws_kms as kms,
    CfnOutput,
)
from constructs import Construct

from config.environments import EnvironmentConfig


class MonitoringStack(Stack):
    """
    Monitoring infrastructure stack for Asset Management System.

    Creates CloudWatch resources for:
    - System overview dashboard with key metrics
    - Log groups for Lambda functions, API Gateway, and other services
    - Alarms for critical thresholds
    - SNS topic for alarm notifications

    Attributes:
        alarm_topic: SNS topic for alarm notifications
        dashboard: CloudWatch dashboard for system overview
        log_groups: Dictionary of log groups by service name
        alarms: Dictionary of CloudWatch alarms by name
    """

    def __init__(
        self,
        scope: Construct,
        construct_id: str,
        config: EnvironmentConfig,
        **kwargs,
    ) -> None:
        """
        Initialize the Monitoring Stack.

        Args:
            scope: The parent construct
            construct_id: The construct ID
            config: Environment configuration
            **kwargs: Additional stack properties
        """
        super().__init__(scope, construct_id, **kwargs)

        self._config = config
        self._monitoring_config = config.monitoring

        # Create KMS key for SNS encryption
        self.encryption_key = self._create_encryption_key()

        # Create SNS topic for alarm notifications
        self.alarm_topic = self._create_alarm_topic()

        # Create log groups for various services
        self.log_groups: dict[str, logs.LogGroup] = {}
        self._create_log_groups()

        # Create CloudWatch dashboard
        self.dashboard = self._create_dashboard()

        # Create CloudWatch alarms
        self.alarms: dict[str, cloudwatch.Alarm] = {}
        self._create_alarms()

        # Export outputs for cross-stack references
        self._create_outputs()

    def _create_encryption_key(self) -> kms.Key:
        """
        Create KMS key for SNS topic encryption.

        Returns:
            kms.Key: The KMS encryption key
        """
        key = kms.Key(
            self,
            "MonitoringEncryptionKey",
            alias=f"alias/{self._config.stack_prefix}-monitoring-key",
            description=f"KMS key for monitoring encryption ({self._config.environment_name})",
            enable_key_rotation=True,
            removal_policy=RemovalPolicy.RETAIN if self._config.is_production else RemovalPolicy.DESTROY,
        )
        return key

    def _create_alarm_topic(self) -> sns.Topic:
        """
        Create SNS topic for alarm notifications.

        Returns:
            sns.Topic: The alarm notification topic
        """
        topic = sns.Topic(
            self,
            "AlarmNotificationTopic",
            topic_name=f"{self._config.stack_prefix}-alarm-notifications",
            display_name=f"Asset Management System Alarms ({self._config.environment_name})",
            master_key=self.encryption_key,
        )
        return topic

    def _create_log_groups(self) -> None:
        """Create log groups for various services with retention policies."""
        retention_days = self._get_log_retention()

        # Log group for Lambda functions
        self.log_groups["lambda"] = logs.LogGroup(
            self,
            "LambdaLogGroup",
            log_group_name=f"/aws/lambda/{self._config.stack_prefix}",
            retention=retention_days,
            removal_policy=RemovalPolicy.RETAIN if self._config.is_production else RemovalPolicy.DESTROY,
        )

        # Log group for API Gateway
        self.log_groups["api_gateway"] = logs.LogGroup(
            self,
            "ApiGatewayLogGroup",
            log_group_name=f"/aws/apigateway/{self._config.stack_prefix}",
            retention=retention_days,
            removal_policy=RemovalPolicy.RETAIN if self._config.is_production else RemovalPolicy.DESTROY,
        )

        # Log group for application logs
        self.log_groups["application"] = logs.LogGroup(
            self,
            "ApplicationLogGroup",
            log_group_name=f"/ams/{self._config.environment_name}/application",
            retention=retention_days,
            removal_policy=RemovalPolicy.RETAIN if self._config.is_production else RemovalPolicy.DESTROY,
        )

        # Log group for audit logs (longer retention for compliance)
        audit_retention = self._get_audit_log_retention()
        self.log_groups["audit"] = logs.LogGroup(
            self,
            "AuditLogGroup",
            log_group_name=f"/ams/{self._config.environment_name}/audit",
            retention=audit_retention,
            removal_policy=RemovalPolicy.RETAIN,  # Always retain audit logs
        )

    def _get_log_retention(self) -> logs.RetentionDays:
        """
        Get log retention based on configuration.

        Returns:
            logs.RetentionDays: The retention period for logs
        """
        retention_days = self._monitoring_config.log_retention_days

        # Map configuration days to CDK RetentionDays enum
        retention_mapping = {
            1: logs.RetentionDays.ONE_DAY,
            3: logs.RetentionDays.THREE_DAYS,
            5: logs.RetentionDays.FIVE_DAYS,
            7: logs.RetentionDays.ONE_WEEK,
            14: logs.RetentionDays.TWO_WEEKS,
            30: logs.RetentionDays.ONE_MONTH,
            60: logs.RetentionDays.TWO_MONTHS,
            90: logs.RetentionDays.THREE_MONTHS,
            120: logs.RetentionDays.FOUR_MONTHS,
            150: logs.RetentionDays.FIVE_MONTHS,
            180: logs.RetentionDays.SIX_MONTHS,
            365: logs.RetentionDays.ONE_YEAR,
            400: logs.RetentionDays.THIRTEEN_MONTHS,
            545: logs.RetentionDays.EIGHTEEN_MONTHS,
            731: logs.RetentionDays.TWO_YEARS,
            1827: logs.RetentionDays.FIVE_YEARS,
            3653: logs.RetentionDays.TEN_YEARS,
        }

        # Find the closest matching retention period
        for days, retention in sorted(retention_mapping.items()):
            if retention_days <= days:
                return retention

        return logs.RetentionDays.ONE_MONTH

    def _get_audit_log_retention(self) -> logs.RetentionDays:
        """
        Get audit log retention (longer for compliance).

        Returns:
            logs.RetentionDays: The retention period for audit logs
        """
        if self._config.is_production:
            return logs.RetentionDays.TWO_YEARS
        elif self._config.environment_name == "staging":
            return logs.RetentionDays.ONE_YEAR
        else:
            return logs.RetentionDays.THREE_MONTHS

    def _create_dashboard(self) -> cloudwatch.Dashboard:
        """
        Create CloudWatch dashboard for system overview.

        Returns:
            cloudwatch.Dashboard: The system overview dashboard
        """
        dashboard = cloudwatch.Dashboard(
            self,
            "SystemDashboard",
            dashboard_name=f"{self._config.stack_prefix}-system-overview",
        )

        # Add API Gateway metrics row
        dashboard.add_widgets(
            cloudwatch.TextWidget(
                markdown="# API Gateway Metrics",
                width=24,
                height=1,
            )
        )

        dashboard.add_widgets(
            cloudwatch.GraphWidget(
                title="API Gateway Requests",
                width=8,
                height=6,
                left=[
                    cloudwatch.Metric(
                        namespace="AWS/ApiGateway",
                        metric_name="Count",
                        dimensions_map={"ApiName": f"{self._config.stack_prefix}-api"},
                        statistic="Sum",
                        period=Duration.minutes(1),
                    )
                ],
            ),
            cloudwatch.GraphWidget(
                title="API Gateway Latency (p99)",
                width=8,
                height=6,
                left=[
                    cloudwatch.Metric(
                        namespace="AWS/ApiGateway",
                        metric_name="Latency",
                        dimensions_map={"ApiName": f"{self._config.stack_prefix}-api"},
                        statistic="p99",
                        period=Duration.minutes(1),
                    )
                ],
            ),
            cloudwatch.GraphWidget(
                title="API Gateway Errors",
                width=8,
                height=6,
                left=[
                    cloudwatch.Metric(
                        namespace="AWS/ApiGateway",
                        metric_name="5XXError",
                        dimensions_map={"ApiName": f"{self._config.stack_prefix}-api"},
                        statistic="Sum",
                        period=Duration.minutes(1),
                        color="#d62728",
                    ),
                    cloudwatch.Metric(
                        namespace="AWS/ApiGateway",
                        metric_name="4XXError",
                        dimensions_map={"ApiName": f"{self._config.stack_prefix}-api"},
                        statistic="Sum",
                        period=Duration.minutes(1),
                        color="#ff7f0e",
                    ),
                ],
            ),
        )

        # Add Lambda metrics row
        dashboard.add_widgets(
            cloudwatch.TextWidget(
                markdown="# Lambda Metrics",
                width=24,
                height=1,
            )
        )

        dashboard.add_widgets(
            cloudwatch.GraphWidget(
                title="Lambda Invocations",
                width=8,
                height=6,
                left=[
                    cloudwatch.Metric(
                        namespace="AWS/Lambda",
                        metric_name="Invocations",
                        statistic="Sum",
                        period=Duration.minutes(1),
                    )
                ],
            ),
            cloudwatch.GraphWidget(
                title="Lambda Errors",
                width=8,
                height=6,
                left=[
                    cloudwatch.Metric(
                        namespace="AWS/Lambda",
                        metric_name="Errors",
                        statistic="Sum",
                        period=Duration.minutes(1),
                        color="#d62728",
                    )
                ],
            ),
            cloudwatch.GraphWidget(
                title="Lambda Throttles",
                width=8,
                height=6,
                left=[
                    cloudwatch.Metric(
                        namespace="AWS/Lambda",
                        metric_name="Throttles",
                        statistic="Sum",
                        period=Duration.minutes(1),
                        color="#ff7f0e",
                    )
                ],
            ),
        )

        # Add Database metrics row
        dashboard.add_widgets(
            cloudwatch.TextWidget(
                markdown="# Database Metrics",
                width=24,
                height=1,
            )
        )

        dashboard.add_widgets(
            cloudwatch.GraphWidget(
                title="Database Connections",
                width=8,
                height=6,
                left=[
                    cloudwatch.Metric(
                        namespace="AWS/RDS",
                        metric_name="DatabaseConnections",
                        statistic="Average",
                        period=Duration.minutes(1),
                    )
                ],
            ),
            cloudwatch.GraphWidget(
                title="Database CPU Utilization",
                width=8,
                height=6,
                left=[
                    cloudwatch.Metric(
                        namespace="AWS/RDS",
                        metric_name="CPUUtilization",
                        statistic="Average",
                        period=Duration.minutes(1),
                    )
                ],
            ),
            cloudwatch.GraphWidget(
                title="Database ACU Utilization",
                width=8,
                height=6,
                left=[
                    cloudwatch.Metric(
                        namespace="AWS/RDS",
                        metric_name="ServerlessDatabaseCapacity",
                        statistic="Average",
                        period=Duration.minutes(1),
                    )
                ],
            ),
        )

        # Add Cache metrics row
        dashboard.add_widgets(
            cloudwatch.TextWidget(
                markdown="# Cache Metrics",
                width=24,
                height=1,
            )
        )

        dashboard.add_widgets(
            cloudwatch.GraphWidget(
                title="Cache Hit Rate",
                width=8,
                height=6,
                left=[
                    cloudwatch.Metric(
                        namespace="AWS/ElastiCache",
                        metric_name="CacheHitRate",
                        statistic="Average",
                        period=Duration.minutes(1),
                    )
                ],
            ),
            cloudwatch.GraphWidget(
                title="Cache Memory Usage",
                width=8,
                height=6,
                left=[
                    cloudwatch.Metric(
                        namespace="AWS/ElastiCache",
                        metric_name="DatabaseMemoryUsagePercentage",
                        statistic="Average",
                        period=Duration.minutes(1),
                    )
                ],
            ),
            cloudwatch.GraphWidget(
                title="Cache Connections",
                width=8,
                height=6,
                left=[
                    cloudwatch.Metric(
                        namespace="AWS/ElastiCache",
                        metric_name="CurrConnections",
                        statistic="Average",
                        period=Duration.minutes(1),
                    )
                ],
            ),
        )

        # Add Messaging metrics row
        dashboard.add_widgets(
            cloudwatch.TextWidget(
                markdown="# Messaging Metrics",
                width=24,
                height=1,
            )
        )

        dashboard.add_widgets(
            cloudwatch.GraphWidget(
                title="SQS Messages Sent",
                width=8,
                height=6,
                left=[
                    cloudwatch.Metric(
                        namespace="AWS/SQS",
                        metric_name="NumberOfMessagesSent",
                        dimensions_map={"QueueName": f"{self._config.stack_prefix}-asset-events"},
                        statistic="Sum",
                        period=Duration.minutes(1),
                    )
                ],
            ),
            cloudwatch.GraphWidget(
                title="SQS Messages Received",
                width=8,
                height=6,
                left=[
                    cloudwatch.Metric(
                        namespace="AWS/SQS",
                        metric_name="NumberOfMessagesReceived",
                        dimensions_map={"QueueName": f"{self._config.stack_prefix}-asset-events"},
                        statistic="Sum",
                        period=Duration.minutes(1),
                    )
                ],
            ),
            cloudwatch.GraphWidget(
                title="DLQ Messages",
                width=8,
                height=6,
                left=[
                    cloudwatch.Metric(
                        namespace="AWS/SQS",
                        metric_name="ApproximateNumberOfMessagesVisible",
                        dimensions_map={"QueueName": f"{self._config.stack_prefix}-asset-events-dlq"},
                        statistic="Sum",
                        period=Duration.minutes(1),
                        color="#d62728",
                    )
                ],
            ),
        )

        return dashboard

    def _create_alarms(self) -> None:
        """Create CloudWatch alarms for critical thresholds."""
        evaluation_periods = self._monitoring_config.alarm_evaluation_periods
        datapoints_to_alarm = self._monitoring_config.alarm_datapoints_to_alarm

        # API Gateway p99 Latency Alarm
        self.alarms["api_latency"] = cloudwatch.Alarm(
            self,
            "ApiLatencyAlarm",
            alarm_name=f"{self._config.stack_prefix}-api-latency-high",
            alarm_description="API Gateway p99 latency exceeds threshold",
            metric=cloudwatch.Metric(
                namespace="AWS/ApiGateway",
                metric_name="Latency",
                dimensions_map={"ApiName": f"{self._config.stack_prefix}-api"},
                statistic="p99",
                period=Duration.minutes(1),
            ),
            threshold=self._get_latency_threshold(),
            evaluation_periods=evaluation_periods,
            datapoints_to_alarm=datapoints_to_alarm,
            comparison_operator=cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
            treat_missing_data=cloudwatch.TreatMissingData.NOT_BREACHING,
        )
        self.alarms["api_latency"].add_alarm_action(
            cloudwatch_actions.SnsAction(self.alarm_topic)
        )

        # API Gateway 5xx Errors Alarm
        self.alarms["api_5xx_errors"] = cloudwatch.Alarm(
            self,
            "Api5xxErrorsAlarm",
            alarm_name=f"{self._config.stack_prefix}-api-5xx-errors",
            alarm_description="API Gateway 5xx errors exceed threshold",
            metric=cloudwatch.Metric(
                namespace="AWS/ApiGateway",
                metric_name="5XXError",
                dimensions_map={"ApiName": f"{self._config.stack_prefix}-api"},
                statistic="Sum",
                period=Duration.minutes(1),
            ),
            threshold=self._get_error_threshold(),
            evaluation_periods=evaluation_periods,
            datapoints_to_alarm=datapoints_to_alarm,
            comparison_operator=cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
            treat_missing_data=cloudwatch.TreatMissingData.NOT_BREACHING,
        )
        self.alarms["api_5xx_errors"].add_alarm_action(
            cloudwatch_actions.SnsAction(self.alarm_topic)
        )

        # Lambda Errors Alarm
        self.alarms["lambda_errors"] = cloudwatch.Alarm(
            self,
            "LambdaErrorsAlarm",
            alarm_name=f"{self._config.stack_prefix}-lambda-errors",
            alarm_description="Lambda function errors exceed threshold",
            metric=cloudwatch.Metric(
                namespace="AWS/Lambda",
                metric_name="Errors",
                statistic="Sum",
                period=Duration.minutes(1),
            ),
            threshold=self._get_error_threshold(),
            evaluation_periods=evaluation_periods,
            datapoints_to_alarm=datapoints_to_alarm,
            comparison_operator=cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
            treat_missing_data=cloudwatch.TreatMissingData.NOT_BREACHING,
        )
        self.alarms["lambda_errors"].add_alarm_action(
            cloudwatch_actions.SnsAction(self.alarm_topic)
        )

        # Lambda Throttles Alarm
        self.alarms["lambda_throttles"] = cloudwatch.Alarm(
            self,
            "LambdaThrottlesAlarm",
            alarm_name=f"{self._config.stack_prefix}-lambda-throttles",
            alarm_description="Lambda function throttles exceed threshold",
            metric=cloudwatch.Metric(
                namespace="AWS/Lambda",
                metric_name="Throttles",
                statistic="Sum",
                period=Duration.minutes(1),
            ),
            threshold=self._get_throttle_threshold(),
            evaluation_periods=evaluation_periods,
            datapoints_to_alarm=datapoints_to_alarm,
            comparison_operator=cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
            treat_missing_data=cloudwatch.TreatMissingData.NOT_BREACHING,
        )
        self.alarms["lambda_throttles"].add_alarm_action(
            cloudwatch_actions.SnsAction(self.alarm_topic)
        )

        # DLQ Messages Alarm (using different name to avoid conflict with MessagingStack)
        self.alarms["dlq_messages"] = cloudwatch.Alarm(
            self,
            "DLQMessagesAlarm",
            alarm_name=f"{self._config.stack_prefix}-monitoring-dlq-messages",
            alarm_description="Messages in dead-letter queue require investigation",
            metric=cloudwatch.Metric(
                namespace="AWS/SQS",
                metric_name="ApproximateNumberOfMessagesVisible",
                dimensions_map={"QueueName": f"{self._config.stack_prefix}-asset-events-dlq"},
                statistic="Sum",
                period=Duration.minutes(1),
            ),
            threshold=1,
            evaluation_periods=1,
            comparison_operator=cloudwatch.ComparisonOperator.GREATER_THAN_OR_EQUAL_TO_THRESHOLD,
            treat_missing_data=cloudwatch.TreatMissingData.NOT_BREACHING,
        )
        self.alarms["dlq_messages"].add_alarm_action(
            cloudwatch_actions.SnsAction(self.alarm_topic)
        )

        # Database Connections Alarm
        self.alarms["db_connections"] = cloudwatch.Alarm(
            self,
            "DatabaseConnectionsAlarm",
            alarm_name=f"{self._config.stack_prefix}-db-connections-high",
            alarm_description="Database connections approaching limit",
            metric=cloudwatch.Metric(
                namespace="AWS/RDS",
                metric_name="DatabaseConnections",
                statistic="Average",
                period=Duration.minutes(5),
            ),
            threshold=self._get_db_connection_threshold(),
            evaluation_periods=evaluation_periods,
            datapoints_to_alarm=datapoints_to_alarm,
            comparison_operator=cloudwatch.ComparisonOperator.GREATER_THAN_THRESHOLD,
            treat_missing_data=cloudwatch.TreatMissingData.NOT_BREACHING,
        )
        self.alarms["db_connections"].add_alarm_action(
            cloudwatch_actions.SnsAction(self.alarm_topic)
        )

        # Cache Hit Rate Alarm (low hit rate indicates potential issues)
        self.alarms["cache_hit_rate"] = cloudwatch.Alarm(
            self,
            "CacheHitRateAlarm",
            alarm_name=f"{self._config.stack_prefix}-cache-hit-rate-low",
            alarm_description="Cache hit rate is below threshold",
            metric=cloudwatch.Metric(
                namespace="AWS/ElastiCache",
                metric_name="CacheHitRate",
                statistic="Average",
                period=Duration.minutes(5),
            ),
            threshold=self._get_cache_hit_rate_threshold(),
            evaluation_periods=evaluation_periods,
            datapoints_to_alarm=datapoints_to_alarm,
            comparison_operator=cloudwatch.ComparisonOperator.LESS_THAN_THRESHOLD,
            treat_missing_data=cloudwatch.TreatMissingData.NOT_BREACHING,
        )
        self.alarms["cache_hit_rate"].add_alarm_action(
            cloudwatch_actions.SnsAction(self.alarm_topic)
        )

    def _get_latency_threshold(self) -> float:
        """
        Get API latency threshold based on environment.

        Returns:
            float: Latency threshold in milliseconds
        """
        if self._config.is_production:
            return 1000  # 1 second for production
        elif self._config.environment_name == "staging":
            return 2000  # 2 seconds for staging
        else:
            return 5000  # 5 seconds for dev (more relaxed)

    def _get_error_threshold(self) -> float:
        """
        Get error count threshold based on environment.

        Returns:
            float: Error count threshold
        """
        if self._config.is_production:
            return 5  # Stricter for production
        elif self._config.environment_name == "staging":
            return 10
        else:
            return 50  # More relaxed for dev

    def _get_throttle_threshold(self) -> float:
        """
        Get throttle count threshold based on environment.

        Returns:
            float: Throttle count threshold
        """
        if self._config.is_production:
            return 1  # Any throttle in production is concerning
        elif self._config.environment_name == "staging":
            return 5
        else:
            return 20  # More relaxed for dev

    def _get_db_connection_threshold(self) -> float:
        """
        Get database connection threshold based on environment.

        Returns:
            float: Database connection threshold
        """
        if self._config.is_production:
            return 80  # 80% of max connections
        elif self._config.environment_name == "staging":
            return 60
        else:
            return 40  # Lower threshold for dev

    def _get_cache_hit_rate_threshold(self) -> float:
        """
        Get cache hit rate threshold based on environment.

        Returns:
            float: Cache hit rate threshold (0-1)
        """
        if self._config.is_production:
            return 0.8  # 80% hit rate expected in production
        elif self._config.environment_name == "staging":
            return 0.6
        else:
            return 0.3  # Lower expectation for dev

    def _create_outputs(self) -> None:
        """Create CloudFormation outputs for cross-stack references."""
        CfnOutput(
            self,
            "AlarmTopicArn",
            value=self.alarm_topic.topic_arn,
            description="SNS topic ARN for alarm notifications",
            export_name=f"{self._config.stack_prefix}-alarm-topic-arn",
        )

        CfnOutput(
            self,
            "DashboardName",
            value=self.dashboard.dashboard_name,
            description="CloudWatch dashboard name",
            export_name=f"{self._config.stack_prefix}-dashboard-name",
        )

        CfnOutput(
            self,
            "LambdaLogGroupName",
            value=self.log_groups["lambda"].log_group_name,
            description="Lambda log group name",
            export_name=f"{self._config.stack_prefix}-lambda-log-group",
        )

        CfnOutput(
            self,
            "ApiGatewayLogGroupName",
            value=self.log_groups["api_gateway"].log_group_name,
            description="API Gateway log group name",
            export_name=f"{self._config.stack_prefix}-api-log-group",
        )

        CfnOutput(
            self,
            "ApplicationLogGroupName",
            value=self.log_groups["application"].log_group_name,
            description="Application log group name",
            export_name=f"{self._config.stack_prefix}-app-log-group",
        )

        CfnOutput(
            self,
            "AuditLogGroupName",
            value=self.log_groups["audit"].log_group_name,
            description="Audit log group name",
            export_name=f"{self._config.stack_prefix}-audit-log-group",
        )

        CfnOutput(
            self,
            "EncryptionKeyArn",
            value=self.encryption_key.key_arn,
            description="KMS key ARN for monitoring encryption",
            export_name=f"{self._config.stack_prefix}-monitoring-key-arn",
        )

    def grant_publish_alarms(self, grantee) -> None:
        """Grant permission to publish to the alarm topic."""
        self.alarm_topic.grant_publish(grantee)

    def grant_write_logs(self, grantee, log_group_name: str) -> None:
        """Grant permission to write to a specific log group."""
        if log_group_name in self.log_groups:
            self.log_groups[log_group_name].grant_write(grantee)
