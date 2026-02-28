# Asset Management System - CDK Infrastructure

An enterprise asset management system built on AWS infrastructure using AWS CDK with Python.

## Overview

This project provides comprehensive lifecycle management for hardware, software, and enterprise assets with multi-tier capabilities. The architecture follows AWS Well-Architected Framework principles across all six pillars:

- **Operational Excellence**: Infrastructure as code, automated deployments, comprehensive monitoring
- **Security**: Defense in depth, encryption, least-privilege access, audit logging
- **Reliability**: Multi-AZ deployment, automated failover, backup and recovery
- **Performance Efficiency**: Caching, connection pooling, async processing
- **Cost Optimization**: Serverless where appropriate, auto-scaling, resource right-sizing
- **Sustainability**: Efficient resource utilization, serverless compute

## Project Structure

```
.
├── app.py                    # CDK application entry point
├── cdk.json                  # CDK configuration
├── pyproject.toml            # Python project configuration
├── README.md                 # This file
├── config/                   # Environment configurations
│   ├── __init__.py
│   └── environments.py       # Dev/Staging/Prod configurations
├── stacks/                   # CDK stack definitions
│   ├── __init__.py
│   └── network_stack.py      # VPC and networking
├── ams_constructs/           # Reusable CDK constructs
│   ├── __init__.py
│   └── secure_bucket.py      # Secure S3 bucket construct
└── tests/                    # Test suite
    ├── __init__.py
    ├── conftest.py           # Pytest fixtures
    └── unit/
        ├── __init__.py
        └── test_network_stack.py
```

## Prerequisites

- Python 3.11 or later
- AWS CDK CLI v2
- AWS CLI configured with appropriate credentials

## Installation

1. Create and activate a virtual environment:

```bash
python -m venv .venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate
```

2. Install dependencies:

```bash
pip install -e ".[dev]"
```

3. Verify CDK installation:

```bash
cdk --version
```

## Environment Configuration

The system supports three environments with different configurations:

| Environment | Description | Key Differences |
|-------------|-------------|-----------------|
| `dev` | Development | Single NAT, smaller instances, relaxed security |
| `staging` | Pre-production | Production-like, medium capacity |
| `prod` | Production | Full HA, maximum security, compliance features |

Update the AWS account IDs in `config/environments.py` before deployment.

## Usage

### Synthesize CloudFormation Templates

```bash
# Synthesize for development environment (default)
cdk synth

# Synthesize for specific environment
cdk synth -c env=staging
cdk synth -c env=prod
```

### Deploy Stacks

```bash
# Deploy to development
cdk deploy -c env=dev

# Deploy to staging
cdk deploy -c env=staging

# Deploy to production (requires approval)
cdk deploy -c env=prod --require-approval broadening
```

### List Stacks

```bash
cdk list -c env=dev
```

### Diff Changes

```bash
cdk diff -c env=dev
```

## Testing

Run the test suite:

```bash
# Run all tests
pytest

# Run with coverage
pytest --cov=stacks --cov=constructs --cov=config

# Run specific test file
pytest tests/unit/test_network_stack.py -v
```

## CDK Stacks

### NetworkStack
Provisions VPC infrastructure with:
- Multi-AZ VPC with public, private, and isolated subnets
- NAT Gateways for private subnet egress
- VPC Endpoints for S3, DynamoDB, and other AWS services
- VPC Flow Logs for security monitoring

### Future Stacks (To Be Implemented)
- **DatabaseStack**: Aurora PostgreSQL Serverless v2
- **CacheStack**: ElastiCache Redis
- **MessagingStack**: SQS queues and SNS topics
- **ApiStack**: API Gateway with WAF
- **AuthStack**: Cognito User Pool
- **StorageStack**: S3 buckets
- **MonitoringStack**: CloudWatch dashboards and alarms
- **FrontendStack**: CloudFront distribution

## Security

- All data encrypted at rest and in transit
- VPC with network segmentation (public/private/isolated)
- WAF protection for API Gateway
- IAM roles following least-privilege principle
- Secrets managed via AWS Secrets Manager

## Contributing

1. Create a feature branch
2. Make changes following the existing patterns
3. Run tests and linting
4. Submit a pull request

## License

MIT License
