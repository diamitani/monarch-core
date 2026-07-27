#!/bin/bash
# Deploy Monarch Core

set -e

ENVIRONMENT=${1:-dev}

echo "🚀 Deploying Monarch Core to $ENVIRONMENT..."

# Check prerequisites
command -v pnpm >/dev/null 2>&1 || { echo "pnpm required"; exit 1; }
command -v aws >/dev/null 2>&1 || { echo "aws cli required"; exit 1; }

# Build packages
echo "📦 Building packages..."
pnpm build

# Deploy infrastructure (if terraform available)
if command -v terraform >/dev/null 2>&1; then
  echo "🏗️  Deploying infrastructure..."
  cd infrastructure/terraform
  terraform init -upgrade
  terraform apply -var="environment=$ENVIRONMENT" -auto-approve
  cd ../..
fi

# Get outputs
AGENT_ROLE_ARN=$(cd infrastructure/terraform && terraform output -raw agent_role_arn 2>/dev/null || echo "")

if [ -n "$AGENT_ROLE_ARN" ]; then
  echo "✅ Infrastructure deployed"
  echo "   Agent Role: $AGENT_ROLE_ARN"
fi

echo "✅ Deployment complete!"
echo ""
echo "Next steps:"
echo "  1. Create Bedrock agents via AWS console or CLI"
echo "  2. Update .env with agent IDs"
echo "  3. Run: pnpm dev"
