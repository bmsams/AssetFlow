#!/bin/bash
# =============================================================================
# AMS Database Migration Environment Setup Script
# =============================================================================
#
# This script sets up the environment variables needed to run database
# migrations against Aurora PostgreSQL in AWS.
#
# Usage:
#   source ./setup-migration-env.sh
#   npm run db:migrate
#
# Note: The database is in isolated VPC subnets and requires VPC connectivity.
# See MIGRATION_GUIDE.md for connectivity options.
# =============================================================================

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  AMS Migration Environment Setup${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# =============================================================================
# Environment Configuration
# =============================================================================

# AWS Region
export AWS_REGION="us-east-1"
echo -e "${GREEN}✓${NC} AWS_REGION=${AWS_REGION}"

# Database Secret ARN (from deployment outputs)
export DB_SECRET_ARN="arn:aws:secretsmanager:us-east-1:764184373468:secret:ams-dev/database/credentials-5zePGU"
echo -e "${GREEN}✓${NC} DB_SECRET_ARN=${DB_SECRET_ARN}"

# SSL Configuration
export DB_SSL="true"
echo -e "${GREEN}✓${NC} DB_SSL=${DB_SSL}"

echo ""
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  Database Connection Details${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""
echo -e "Cluster Endpoint: ${YELLOW}ams-dev-database-assetdatabase46a48a83-liltpjc5oxtn.cluster-caruses68o28.us-east-1.rds.amazonaws.com${NC}"
echo -e "Port:             ${YELLOW}5432${NC}"
echo -e "Database:         ${YELLOW}assetmgmt${NC}"
echo -e "Security Group:   ${YELLOW}sg-02136c7a7c8c73475${NC}"
echo ""

# =============================================================================
# VPC Connectivity Check
# =============================================================================

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  VPC Connectivity Notice${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""
echo -e "${YELLOW}⚠ IMPORTANT:${NC} The Aurora database is in isolated VPC subnets."
echo -e "   Direct connection from your local machine is ${RED}NOT possible${NC}."
echo ""
echo -e "   ${GREEN}Connectivity Options:${NC}"
echo -e "   1. ${BLUE}Lambda-based migration${NC} (Recommended)"
echo -e "      - Deploy migration as Lambda function in VPC"
echo -e "      - Invoke via: aws lambda invoke --function-name ams-dev-migration-runner"
echo ""
echo -e "   2. ${BLUE}Bastion Host / Jump Box${NC}"
echo -e "      - Deploy EC2 in private subnet"
echo -e "      - SSH tunnel: ssh -L 5432:<aurora-endpoint>:5432 ec2-user@<bastion>"
echo ""
echo -e "   3. ${BLUE}AWS Client VPN${NC}"
echo -e "      - Set up Client VPN endpoint"
echo -e "      - Connect via VPN client"
echo ""
echo -e "   4. ${BLUE}SSM Session Manager Port Forwarding${NC}"
echo -e "      - Requires EC2 instance with SSM agent"
echo -e "      - Use AWS-StartPortForwardingSessionToRemoteHost"
echo ""
echo -e "   See ${GREEN}MIGRATION_GUIDE.md${NC} for detailed instructions."
echo ""

# =============================================================================
# AWS Credentials Check
# =============================================================================

echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  AWS Credentials Check${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""

# Check if AWS CLI is configured
if command -v aws &> /dev/null; then
    IDENTITY=$(aws sts get-caller-identity 2>/dev/null)
    if [ $? -eq 0 ]; then
        ACCOUNT=$(echo $IDENTITY | jq -r '.Account')
        USER=$(echo $IDENTITY | jq -r '.Arn' | cut -d'/' -f2)
        echo -e "${GREEN}✓${NC} AWS credentials configured"
        echo -e "  Account: ${YELLOW}${ACCOUNT}${NC}"
        echo -e "  User:    ${YELLOW}${USER}${NC}"
        
        # Verify Secrets Manager access
        echo ""
        echo -e "Testing Secrets Manager access..."
        SECRET_TEST=$(aws secretsmanager get-secret-value --secret-id "$DB_SECRET_ARN" --query 'Name' --output text 2>/dev/null)
        if [ $? -eq 0 ]; then
            echo -e "${GREEN}✓${NC} Secrets Manager access verified"
        else
            echo -e "${RED}✗${NC} Cannot access Secrets Manager secret"
            echo -e "  Ensure your IAM user/role has secretsmanager:GetSecretValue permission"
        fi
    else
        echo -e "${RED}✗${NC} AWS credentials not configured or expired"
        echo -e "  Run: aws configure"
    fi
else
    echo -e "${RED}✗${NC} AWS CLI not installed"
    echo -e "  Install: https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html"
fi

echo ""
echo -e "${BLUE}========================================${NC}"
echo -e "${BLUE}  Ready to Run Migrations${NC}"
echo -e "${BLUE}========================================${NC}"
echo ""
echo -e "Once you have VPC connectivity, run:"
echo -e "  ${GREEN}npm run db:migrate${NC}"
echo ""
echo -e "To verify the current schema version:"
echo -e "  ${GREEN}npm run db:migrate -- --dry-run${NC} (if supported)"
echo ""
