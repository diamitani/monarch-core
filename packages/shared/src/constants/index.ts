/**
 * Shared constants
 */

// Model IDs
export const MODELS = {
  CLAUDE_SONNET_4: 'anthropic.claude-sonnet-4-20250514-v1:0',
  CLAUDE_OPUS_4: 'global.anthropic.claude-opus-4-5-20251101-v1:0',
  CLAUDE_HAIKU: 'anthropic.claude-3-5-haiku-20241022-v1:0',
  DEEPSEEK_V3: 'deepseek.deepseek-v3-0324-v1:0'
} as const;

// Default runtime configuration
export const DEFAULT_RUNTIME_CONFIG = {
  modelId: MODELS.CLAUDE_SONNET_4,
  temperature: 0.2,
  maxTokens: 8192,
  maxParallelTasks: 3,
  timeoutSeconds: 300
} as const;

// Context budget
export const CONTEXT_BUDGET = {
  maxTokens: 200000,
  systemPromptBudget: 4000,
  toolsBudget: 2000,
  examplesBudget: 1000,
  outputReserve: 8192,
  userContextBudget: 184808 // maxTokens - others
} as const;

// Session configuration
export const SESSION_CONFIG = {
  idleTimeoutSeconds: 3600,      // 1 hour
  maxSessionDurationSeconds: 86400, // 24 hours
  maxConcurrentSessions: 10
} as const;

// Rate limits
export const RATE_LIMITS = {
  free: {
    requestsPerMinute: 10,
    requestsPerDay: 100,
    tokensPerDay: 100000
  },
  pro: {
    requestsPerMinute: 60,
    requestsPerDay: 1000,
    tokensPerDay: 1000000
  },
  team: {
    requestsPerMinute: 120,
    requestsPerDay: 5000,
    tokensPerDay: 5000000
  }
} as const;

// Artifact configuration
export const ARTIFACT_CONFIG = {
  maxSizeBytes: 10 * 1024 * 1024, // 10MB
  supportedTypes: ['plan', 'brief', 'document', 'checklist', 'tracker', 'code', 'design'],
  defaultTTLDays: 90
} as const;

// Memory configuration
export const MEMORY_CONFIG = {
  maxEntriesPerProject: 1000,
  embeddingDimensions: 1024,
  similarityThreshold: 0.7,
  defaultTTLDays: {
    decision: 365,
    learning: 180,
    context: 30,
    artifact: 90
  }
} as const;

// API configuration
export const API_CONFIG = {
  basePath: '/api/v1',
  version: '1.0.0',
  defaultPageSize: 20,
  maxPageSize: 100
} as const;

// AWS configuration
export const AWS_CONFIG = {
  region: process.env.AWS_REGION || 'us-east-1',
  bedrockEndpoint: `https://bedrock-runtime.${process.env.AWS_REGION || 'us-east-1'}.amazonaws.com`,
  bedrockAgentEndpoint: `https://bedrock-agent-runtime.${process.env.AWS_REGION || 'us-east-1'}.amazonaws.com`
} as const;
