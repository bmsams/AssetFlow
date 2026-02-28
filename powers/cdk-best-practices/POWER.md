---
name: "cdk-best-practices"
displayName: "AWS CDK Best Practices"
description: "Best practices for building AWS infrastructure with CDK in Python following Well-Architected principles"
keywords: ["cdk", "aws", "infrastructure", "python", "well-architected"]
author: "AMS Team"
---

# AWS CDK Best Practices

## Overview

This power provides guidance on building AWS infrastructure using AWS CDK v2 with Python. It covers patterns for creating secure, scalable, and maintainable infrastructure code following AWS Well-Architected Framework principles.

## Core Principles

1. **Immutable Configuration** - Use frozen dataclasses for environment configs
2. **Stack Separation** - One stack per concern (network, database, api, etc.)
3. **L3 Constructs** - Create reusable constructs for common patterns
4. **Environment Parity** - Same code, different configs for dev/staging/prod

## Stack Patterns

### Naming Convention
```python
# Pattern: ams-{environment}-{stack}
stack_name = f"{config.stack_prefix}-network"
# Example: ams-dev-network
```

### Stack Dependencies
```
NetworkStack (VPC, subnets)
    ├── DatabaseStack (requires VPC)
    └── CacheStack (requires VPC)
MessagingStack (independent)
ApiStack (independent)
```

### Configuration Pattern
```python
from dataclasses import dataclass
from pydantic import BaseModel

@dataclass(frozen=True)
class EnvironmentConfig:
    environment: str
    stack_prefix: str
    vpc_config: VpcConfig
    database_config: DatabaseConfig
```

## Security Best Practices

- Enable encryption at rest for all data stores
- Use VPC endpoints for AWS service access
- Apply least-privilege IAM policies
- Enable WAF on API Gateway
- Use Secrets Manager for credentials

## Testing Pattern

```python
# Use CDK assertions
from aws_cdk import assertions

def test_stack_creates_vpc():
    template = assertions.Template.from_stack(stack)
    template.resource_count_is("AWS::EC2::VPC", 1)
```

## Common Commands

```bash
cdk synth                    # Synthesize (default: dev)
cdk synth -c env=staging     # Specific environment
cdk deploy -c env=dev        # Deploy to dev
cdk diff -c env=dev          # Show changes
pytest --cov=stacks          # Run tests with coverage
```

## Troubleshooting

### Error: "Cannot find module"
**Cause:** Dependencies not installed
**Solution:** Run `pip install -e ".[dev]"`

### Error: "Stack already exists"
**Cause:** Trying to create duplicate stack
**Solution:** Use `cdk deploy` to update or delete existing stack first
