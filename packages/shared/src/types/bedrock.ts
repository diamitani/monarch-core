/**
 * Bedrock AgentCore specific types
 */

// Session management
export interface CreateSessionParams {
  agentId: string;
  projectId: string;
  userId: string;
  metadata?: Record<string, unknown>;
}

export interface AgentCoreSession {
  sessionId: string;
  agentId: string;
  projectId: string;
  userId: string;
  status: SessionStatus;
  memoryId?: string;
  createdAt: Date;
  lastActivityAt: Date;
  metadata?: Record<string, unknown>;
}

export interface SessionInfo {
  memoryId: string;
  sessionId: string;
  sessionStartTime: string;
  sessionExpiryTime?: string;
  summaryText?: string;
}

export type SessionStatus = 'active' | 'paused' | 'completed' | 'failed' | 'expired';

// Agent invocation
export interface InvokeAgentParams {
  agentId: string;
  sessionId: string;
  inputText: string;
  enableTrace?: boolean;
  endSession?: boolean;
  memoryId?: string;
  sessionState?: {
    sessionAttributes?: Record<string, string>;
    promptSessionAttributes?: Record<string, string>;
    files?: FileConfig[];
  };
}

export interface FileConfig {
  name: string;
  source: {
    sourceType: 'S3' | 'BYTE_CONTENT';
    s3Location?: { uri: string };
    byteContent?: { mediaType: string; data: string };
  };
  useCase: 'CODE_INTERPRETER' | 'CHAT';
}

// Streaming events - generic structure for flexibility
export interface AgentStreamEvent {
  type: 'text' | 'tool_use' | 'tool_result' | 'artifact' | 'trace' | 'error';
  data: unknown;
  timestamp: Date;
  traceId?: string;
}

// Memory
export interface GetMemoryParams {
  agentId: string;
  memoryId: string;
  memoryType?: 'SESSION_SUMMARY';
  maxItems?: number;
  nextToken?: string;
}

// Stream chunks for SSE
export type StreamChunk = 
  | { type: 'delta'; content: string }
  | { type: 'tool_start'; toolName: string; toolInput?: unknown }
  | { type: 'tool_end'; toolName: string; toolResult?: unknown }
  | { type: 'error'; error: string }
  | { type: 'done' };

export interface ChatStreamEvent {
  event: 'message' | 'tool' | 'artifact' | 'error' | 'done';
  data: Record<string, unknown>;
}

// AgentCore client configuration
export interface AgentCoreClientConfig {
  region?: string;
  credentials?: {
    accessKeyId: string;
    secretAccessKey: string;
    sessionToken?: string;
  };
  maxRetries?: number;
  timeout?: number;
}
