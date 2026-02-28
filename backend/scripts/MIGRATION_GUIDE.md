# Database Migration Guide for AWS Aurora PostgreSQL

This guide explains how to configure and run database migrations against the Aurora PostgreSQL database deployed in AWS.

## Overview

The Asset Management System (AMS) uses Aurora PostgreSQL Serverless v2 deployed in **isolated VPC subnets**. This means the database is not directly accessible from the public internet or your local machine. This guide covers the environment configuration and connectivity options.

## Quick Start: Lambda-Based Migration (Recommended)

The easiest way to run migrations is using the Lambda-based migration runner. This approach requires no VPC connectivity from your local machine.

### Deploy the Migration Stack

```bash
# Deploy the migration Lambda (if not already deployed)
cdk deploy ams-dev-migration -c env=dev
```

### Run Migrations

```bash
# Run database migrations
aws lambda invoke \
  --function-name ams-dev-migration-runner \
  --payload '{"action": "migrate"}' \
  --cli-binary-format raw-in-base64-out \
  response.json && cat response.json

# Seed the database with test data
aws lambda invoke \
  --function-name ams-dev-migration-runner \
  --payload '{"action": "seed"}' \
  --cli-binary-format raw-in-base64-out \
  response.json && cat response.json

# Run both migrations and seeding
aws lambda invoke \
  --function-name ams-dev-migration-runner \
  --payload '{"action": "migrate-and-seed"}' \
  --cli-binary-format raw-in-base64-out \
  response.json && cat response.json

# Check migration status
aws lambda invoke \
  --function-name ams-dev-migration-runner \
  --payload '{"action": "status"}' \
  --cli-binary-format raw-in-base64-out \
  response.json && cat response.json
```

### Expected Response

```json
{
  "success": true,
  "action": "migrate-and-seed",
  "message": "Migrations and seeding complete",
  "details": {
    "appliedMigrations": ["001", "002", "003", "004", "005", "006", "007", "008"],
    "currentVersion": "008",
    "seedCounts": {
      "departments": 8,
      "users": 12,
      "stockrooms": 5,
      "manufacturers": 12,
      "hardware_assets": 50
    }
  },
  "duration": 15234
}
```

## Environment Variables (For Local Development)

### Required Variables

| Variable | Description | Value |
|----------|-------------|-------|
| `DB_SECRET_ARN` | AWS Secrets Manager ARN containing database credentials | `arn:aws:secretsmanager:us-east-1:764184373468:secret:ams-dev/database/credentials-5zePGU` |
| `AWS_REGION` | AWS region where resources are deployed | `us-east-1` |

### Optional Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `DB_SSL` | `true` | Enable SSL for database connection |
| `MIGRATIONS_PATH` | `../../migrations` | Path to migrations directory |

### Quick Setup

```bash
# Set environment variables for AWS migration
export DB_SECRET_ARN="arn:aws:secretsmanager:us-east-1:764184373468:secret:ams-dev/database/credentials-5zePGU"
export AWS_REGION="us-east-1"
```

Or create a `.env.migration` file in the `backend/scripts` directory:

```bash
# .env.migration - Migration configuration for AWS Aurora
DB_SECRET_ARN=arn:aws:secretsmanager:us-east-1:764184373468:secret:ams-dev/database/credentials-5zePGU
AWS_REGION=us-east-1
DB_SSL=true
```

## VPC Connectivity Options

Since Aurora PostgreSQL is deployed in **isolated subnets** (no internet access, no NAT Gateway access), you cannot connect directly from your local machine. Here are the available options:

### Option 1: Lambda-Based Migration (Recommended) ⭐

Deploy a Lambda function within the VPC to run migrations. This is the most secure and AWS-native approach.

**Advantages:**
- No need for bastion hosts or VPN
- Runs within the same VPC as the database
- Can be triggered via AWS CLI or Console
- Follows least-privilege security model
- Already implemented in `stacks/migration_stack.py`

**Usage:**
```bash
# Deploy the migration stack
cdk deploy ams-dev-migration -c env=dev

# Run migrations
aws lambda invoke \
  --function-name ams-dev-migration-runner \
  --payload '{"action": "migrate"}' \
  --cli-binary-format raw-in-base64-out \
  response.json

# Check the response
cat response.json
```

### Option 2: Bastion Host / Jump Box

Deploy an EC2 instance in a private subnet with NAT Gateway access to act as a jump box.

**Setup Steps:**
1. Deploy an EC2 instance in a private subnet
2. Configure SSH access via Session Manager or SSH key
3. Install Node.js and the migration script on the bastion
4. Run migrations from the bastion host

**Connection via SSH Tunnel:**
```bash
# Create SSH tunnel through bastion
ssh -L 5432:<aurora-endpoint>:5432 ec2-user@<bastion-ip>

# Then run migrations locally pointing to localhost:5432
export DB_HOST=localhost
export DB_PORT=5432
export DB_USERNAME=<from-secrets-manager>
export DB_PASSWORD=<from-secrets-manager>
export DB_NAME=assetmgmt
npm run db:migrate
```

### Option 3: AWS VPN (Client VPN or Site-to-Site)

Set up AWS Client VPN to connect your local machine directly to the VPC.

**Setup Steps:**
1. Create a Client VPN endpoint in the VPC
2. Configure authentication (certificate-based or Active Directory)
3. Associate the VPN with the private subnets
4. Download and configure the VPN client
5. Connect to VPN and run migrations

**After VPN Connection:**
```bash
# Get credentials from Secrets Manager
aws secretsmanager get-secret-value \
  --secret-id ams-dev/database/credentials-5zePGU \
  --query SecretString --output text | jq .

# Set direct connection variables
export DB_HOST=ams-dev-database-assetdatabase46a48a83-liltpjc5oxtn.cluster-caruses68o28.us-east-1.rds.amazonaws.com
export DB_PORT=5432
export DB_NAME=assetmgmt
export DB_USERNAME=<from-secret>
export DB_PASSWORD=<from-secret>
export DB_SSL=true

npm run db:migrate
```

### Option 4: AWS Systems Manager Session Manager Port Forwarding

Use SSM Session Manager to create a port forwarding session through an EC2 instance.

**Prerequisites:**
- EC2 instance in a private subnet with SSM agent
- IAM permissions for SSM Session Manager

**Steps:**
```bash
# Start port forwarding session
aws ssm start-session \
  --target <instance-id> \
  --document-name AWS-StartPortForwardingSessionToRemoteHost \
  --parameters '{"host":["ams-dev-database-assetdatabase46a48a83-liltpjc5oxtn.cluster-caruses68o28.us-east-1.rds.amazonaws.com"],"portNumber":["5432"],"localPortNumber":["5432"]}'

# In another terminal, run migrations
export DB_HOST=localhost
export DB_PORT=5432
# ... set other credentials
npm run db:migrate
```

## Database Connection Details

| Property | Value |
|----------|-------|
| **Cluster Endpoint** | `ams-dev-database-assetdatabase46a48a83-liltpjc5oxtn.cluster-caruses68o28.us-east-1.rds.amazonaws.com` |
| **Reader Endpoint** | `ams-dev-database-assetdatabase46a48a83-liltpjc5oxtn.cluster-ro-caruses68o28.us-east-1.rds.amazonaws.com` |
| **Port** | `5432` |
| **Database Name** | `assetmgmt` |
| **Secret ARN** | `arn:aws:secretsmanager:us-east-1:764184373468:secret:ams-dev/database/credentials-5zePGU` |
| **Security Group** | `sg-02136c7a7c8c73475` |

## Retrieving Database Credentials

The database credentials are stored in AWS Secrets Manager. To retrieve them:

```bash
# Using AWS CLI
aws secretsmanager get-secret-value \
  --secret-id ams-dev/database/credentials-5zePGU \
  --query SecretString \
  --output text | jq .

# Expected output format:
# {
#   "host": "ams-dev-database-...",
#   "port": 5432,
#   "dbname": "assetmgmt",
#   "username": "ams_admin",
#   "password": "<generated-password>"
# }
```

## Running Migrations

### From Lambda (Recommended for Production)

```bash
# Invoke the migration Lambda function
aws lambda invoke \
  --function-name ams-dev-migration-runner \
  --payload '{"action": "migrate"}' \
  --cli-binary-format raw-in-base64-out \
  response.json

# Check the response
cat response.json
```

### From Local Machine (Requires VPC Connectivity)

```bash
# Navigate to backend directory
cd backend

# Set environment variables
export DB_SECRET_ARN="arn:aws:secretsmanager:us-east-1:764184373468:secret:ams-dev/database/credentials-5zePGU"
export AWS_REGION="us-east-1"

# Run migrations
npm run db:migrate
```

### Expected Output

```
========================================
  AMS Database Migration Runner
========================================

Fetching credentials from Secrets Manager: arn:aws:secretsmanager:us-east-1:764184373468:secret:ams-dev/database/credentials-5zePGU
Successfully retrieved credentials for host: ams-dev-database-...
Connecting to database: ams-dev-database-...:5432/assetmgmt
Database connection established successfully
Ensuring schema_migrations table exists...
schema_migrations table ready

Already applied migrations: none
Loading migrations from: /path/to/migrations
Found 8 migration files

Pending migrations: 8

Applying migration V001: core asset schema
  File: V001__core_asset_schema.sql
  ✓ Migration V001 applied successfully (234ms)

... (more migrations)

========================================
  ✓ All migrations applied successfully
  Current schema version: V008
========================================

Database connection closed
```

## Troubleshooting

### Connection Timeout

If you see connection timeout errors:
1. Verify you have VPC connectivity (VPN, bastion, etc.)
2. Check the database security group allows your source IP/security group
3. Verify the database cluster is in "Available" state

```bash
# Check Aurora cluster status
aws rds describe-db-clusters \
  --db-cluster-identifier ams-dev-database \
  --query 'DBClusters[0].Status'
```

### Permission Denied (Secrets Manager)

If you see Secrets Manager access denied:
1. Verify your AWS credentials have `secretsmanager:GetSecretValue` permission
2. Check the secret resource policy allows your IAM principal

```bash
# Test Secrets Manager access
aws secretsmanager get-secret-value \
  --secret-id ams-dev/database/credentials-5zePGU
```

### SSL Certificate Errors

If you see SSL certificate errors:
1. The migration script uses `rejectUnauthorized: false` by default for Aurora
2. For stricter SSL, download the RDS CA bundle and configure it

```bash
# Download RDS CA bundle
wget https://truststore.pki.rds.amazonaws.com/global/global-bundle.pem

# Set SSL CA path (if needed)
export DB_SSL_CA=/path/to/global-bundle.pem
```

### Lambda Invocation Errors

If the Lambda invocation fails:
1. Check CloudWatch logs for the Lambda function
2. Verify the Lambda has VPC connectivity
3. Check the Lambda security group can access the database

```bash
# View Lambda logs
aws logs tail /aws/lambda/ams-dev-migration-runner --follow
```

## Security Considerations

1. **Never commit credentials** - Always use Secrets Manager or environment variables
2. **Use least-privilege IAM** - Only grant necessary permissions for migrations
3. **Audit migration runs** - All migrations are logged in CloudWatch
4. **Use SSL** - Always enable SSL for database connections
5. **Limit VPC access** - Use security groups to restrict database access

## Related Documentation

- [AWS Aurora PostgreSQL Documentation](https://docs.aws.amazon.com/AmazonRDS/latest/AuroraUserGuide/Aurora.AuroraPostgreSQL.html)
- [AWS Secrets Manager Documentation](https://docs.aws.amazon.com/secretsmanager/latest/userguide/intro.html)
- [AWS Client VPN Documentation](https://docs.aws.amazon.com/vpn/latest/clientvpn-admin/what-is.html)
- [AWS Systems Manager Session Manager](https://docs.aws.amazon.com/systems-manager/latest/userguide/session-manager.html)

## Next Steps

After deploying the migration stack:
1. Run migrations: `aws lambda invoke --function-name ams-dev-migration-runner --payload '{"action": "migrate"}' ...`
2. Seed database: `aws lambda invoke --function-name ams-dev-migration-runner --payload '{"action": "seed"}' ...`
3. Verify: `aws lambda invoke --function-name ams-dev-migration-runner --payload '{"action": "status"}' ...`
