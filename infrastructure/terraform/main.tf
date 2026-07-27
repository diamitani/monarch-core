# Terraform configuration for Monarch Core AWS infrastructure

terraform {
  required_version = ">= 1.5.0"
  
  required_providers {
    aws = {
      source  = "hashicorp/aws"
      version = "~> 5.0"
    }
  }

  # Uncomment for remote state
  # backend "s3" {
  #   bucket = "monarch-terraform-state"
  #   key    = "monarch-core/terraform.tfstate"
  #   region = "us-east-1"
  # }
}

provider "aws" {
  region = var.aws_region

  default_tags {
    tags = {
      Project     = "monarch-core"
      Environment = var.environment
      ManagedBy   = "terraform"
    }
  }
}

# Variables
variable "aws_region" {
  description = "AWS region"
  type        = string
  default     = "us-east-1"
}

variable "environment" {
  description = "Environment name"
  type        = string
  default     = "dev"
}

variable "foundation_model" {
  description = "Bedrock foundation model ID"
  type        = string
  default     = "anthropic.claude-sonnet-4-20250514-v1:0"
}

# IAM Role for Bedrock Agents
resource "aws_iam_role" "bedrock_agent_role" {
  name = "monarch-bedrock-agent-role-${var.environment}"

  assume_role_policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Action = "sts:AssumeRole"
        Effect = "Allow"
        Principal = {
          Service = "bedrock.amazonaws.com"
        }
        Condition = {
          StringEquals = {
            "aws:SourceAccount" = data.aws_caller_identity.current.account_id
          }
          ArnLike = {
            "aws:SourceArn" = "arn:aws:bedrock:${var.aws_region}:${data.aws_caller_identity.current.account_id}:agent/*"
          }
        }
      }
    ]
  })
}

resource "aws_iam_role_policy" "bedrock_agent_policy" {
  name = "monarch-bedrock-agent-policy"
  role = aws_iam_role.bedrock_agent_role.id

  policy = jsonencode({
    Version = "2012-10-17"
    Statement = [
      {
        Effect = "Allow"
        Action = [
          "bedrock:InvokeModel",
          "bedrock:InvokeModelWithResponseStream"
        ]
        Resource = "arn:aws:bedrock:${var.aws_region}::foundation-model/${var.foundation_model}"
      },
      {
        Effect = "Allow"
        Action = [
          "s3:GetObject",
          "s3:PutObject",
          "s3:ListBucket"
        ]
        Resource = [
          aws_s3_bucket.artifacts.arn,
          "${aws_s3_bucket.artifacts.arn}/*"
        ]
      },
      {
        Effect = "Allow"
        Action = [
          "dynamodb:GetItem",
          "dynamodb:PutItem",
          "dynamodb:UpdateItem",
          "dynamodb:DeleteItem",
          "dynamodb:Query"
        ]
        Resource = [
          aws_dynamodb_table.sessions.arn,
          aws_dynamodb_table.memory.arn
        ]
      }
    ]
  })
}

# S3 Bucket for artifacts
resource "aws_s3_bucket" "artifacts" {
  bucket = "monarch-artifacts-${var.environment}-${data.aws_caller_identity.current.account_id}"
}

resource "aws_s3_bucket_versioning" "artifacts" {
  bucket = aws_s3_bucket.artifacts.id
  versioning_configuration {
    status = "Enabled"
  }
}

resource "aws_s3_bucket_server_side_encryption_configuration" "artifacts" {
  bucket = aws_s3_bucket.artifacts.id

  rule {
    apply_server_side_encryption_by_default {
      sse_algorithm = "AES256"
    }
  }
}

# DynamoDB Table for sessions
resource "aws_dynamodb_table" "sessions" {
  name         = "monarch-sessions-${var.environment}"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "sessionId"

  attribute {
    name = "sessionId"
    type = "S"
  }

  attribute {
    name = "projectId"
    type = "S"
  }

  attribute {
    name = "userId"
    type = "S"
  }

  global_secondary_index {
    name            = "project-index"
    hash_key        = "projectId"
    projection_type = "ALL"
  }

  global_secondary_index {
    name            = "user-index"
    hash_key        = "userId"
    projection_type = "ALL"
  }

  ttl {
    attribute_name = "expiresAt"
    enabled        = true
  }
}

# DynamoDB Table for memory
resource "aws_dynamodb_table" "memory" {
  name         = "monarch-memory-${var.environment}"
  billing_mode = "PAY_PER_REQUEST"
  hash_key     = "pk"
  range_key    = "sk"

  attribute {
    name = "pk"
    type = "S"
  }

  attribute {
    name = "sk"
    type = "S"
  }

  ttl {
    attribute_name = "expiresAt"
    enabled        = true
  }
}

# Current account info
data "aws_caller_identity" "current" {}

# Outputs
output "agent_role_arn" {
  description = "ARN of the Bedrock agent IAM role"
  value       = aws_iam_role.bedrock_agent_role.arn
}

output "artifacts_bucket" {
  description = "Name of the S3 artifacts bucket"
  value       = aws_s3_bucket.artifacts.bucket
}

output "sessions_table" {
  description = "Name of the DynamoDB sessions table"
  value       = aws_dynamodb_table.sessions.name
}

output "memory_table" {
  description = "Name of the DynamoDB memory table"
  value       = aws_dynamodb_table.memory.name
}
