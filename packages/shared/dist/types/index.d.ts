/**
 * Monarch Core - Shared Types
 * The contracts every package builds on
 */
export interface ROSTRManifest {
    agentId: string;
    agentRole: AgentRole;
    phase: WorkflowPhase;
    priority: PriorityScore;
    runtime: RuntimeConfig;
    instructions: AgentInstructions;
    tools: ToolDefinition[];
    memory: MemoryConfig;
    streaming: StreamingConfig;
}
export type AgentRole = 'orchestrator' | 'researcher' | 'planner' | 'writer' | 'organizer' | 'deployer' | 'debugger';
export type WorkflowPhase = 'pred' | 'design' | 'develop' | 'deploy' | 'debug';
export interface PriorityScore {
    phaseUrgency: number;
    dependencyImpact: number;
    businessImpact: number;
    resourceEfficiency: number;
    composite: number;
}
export interface RuntimeConfig {
    modelId: string;
    temperature: number;
    maxTokens: number;
    maxParallelTasks: number;
    timeoutSeconds: number;
}
export interface AgentInstructions {
    systemPrompt: string;
    goal: string;
    constraints: string[];
    successCriteria: string[];
    escalationPolicy: 'auto-proceed' | 'require-approval' | 'human-in-loop';
}
export interface ToolDefinition {
    toolName: string;
    description: string;
    inputSchema: JsonSchema;
    toolCategory: 'builtin' | 'composio' | 'custom';
    requiresApproval?: boolean;
}
export interface JsonSchema {
    type: string;
    properties?: Record<string, JsonSchema>;
    required?: string[];
    items?: JsonSchema;
    description?: string;
}
export interface MemoryConfig {
    mode: 'session' | 'project' | 'persistent';
    maxContextTokens: number;
    longTermMemoryEnabled: boolean;
    contextSources: string[];
    saveTriggers: ('decisions' | 'learnings' | 'artifacts')[];
}
export interface StreamingConfig {
    enabled: boolean;
    bidirectional: boolean;
    heartbeatIntervalMs: number;
}
export interface PALInput {
    userPrompt: string;
    attachments?: Attachment[];
    context?: ProjectContext;
}
export interface PALOutput {
    manifest: ROSTRManifest;
    extractedIntent: ExtractedIntent;
    enhancedPrompt: string;
    confidence: number;
}
export interface ExtractedIntent {
    primaryIntent: string;
    domain: Domain;
    subject: string;
    constraints: string[];
    desiredOutput: string;
    urgency: 'immediate' | 'queued' | 'scheduled';
    ambiguityScore: number;
}
export type Domain = 'code' | 'design' | 'research' | 'ops' | 'sales' | 'content' | 'deploy' | 'debug';
export interface Attachment {
    type: 'file' | 'url' | 'image';
    name: string;
    content?: string;
    url?: string;
    mimeType?: string;
}
export interface ProjectContext {
    projectId: string;
    projectName: string;
    goals?: string[];
    decisions?: Decision[];
    artifacts?: ArtifactMetadata[];
    recentMessages?: Message[];
}
export interface Decision {
    id: string;
    timestamp: Date;
    decision: string;
    rationale: string;
    agentId: string;
}
export interface AgentCoreInvokeParams {
    sessionId: string;
    userInput: string;
    enableTrace?: boolean;
    sessionState?: SessionState;
}
export interface SessionState {
    sessionAttributes?: Record<string, string>;
    promptSessionAttributes?: Record<string, string>;
}
export interface AgentCoreEvent {
    type: 'text' | 'tool_use' | 'tool_result' | 'artifact' | 'error' | 'trace';
    data: unknown;
    timestamp: Date;
    traceId?: string;
}
export interface ComposioIntegration {
    integrationId: string;
    provider: string;
    scopes: string[];
    status: 'connected' | 'expired' | 'revoked';
    connectedAt: Date;
    expiresAt?: Date;
}
export interface ComposioToolExecution {
    toolName: string;
    params: Record<string, unknown>;
    integrationId: string;
    userId: string;
    requiresApproval: boolean;
}
export interface ComposioToolResult {
    success: boolean;
    data?: unknown;
    error?: string;
    executionTimeMs: number;
}
export interface User {
    id: string;
    email: string;
    name?: string;
    plan: 'free' | 'pro' | 'team';
    integrations: ComposioIntegration[];
    createdAt: Date;
    updatedAt: Date;
}
export interface Project {
    id: string;
    userId: string;
    name: string;
    description?: string;
    phase: WorkflowPhase;
    status: 'active' | 'paused' | 'completed' | 'archived';
    goals: string[];
    decisions: Decision[];
    createdAt: Date;
    updatedAt: Date;
}
export interface ArtifactMetadata {
    id: string;
    projectId: string;
    type: ArtifactType;
    name: string;
    description?: string;
    s3Key: string;
    version: number;
    agentId: string;
    createdAt: Date;
}
export type ArtifactType = 'plan' | 'brief' | 'document' | 'checklist' | 'tracker' | 'code' | 'design';
export interface Message {
    id: string;
    projectId: string;
    sessionId: string;
    role: 'user' | 'assistant' | 'tool';
    content: string;
    toolCalls?: ToolCall[];
    createdAt: Date;
}
export interface ToolCall {
    id: string;
    toolName: string;
    input: unknown;
    output?: unknown;
    status: 'pending' | 'running' | 'completed' | 'failed';
    executionTimeMs?: number;
}
export interface APIResponse<T = unknown> {
    success: boolean;
    data?: T;
    error?: APIError;
    meta?: {
        requestId: string;
        timestamp: string;
        latencyMs: number;
    };
}
export interface APIError {
    code: string;
    message: string;
    details?: unknown;
}
export interface ChatRequest {
    message: string;
    attachments?: Attachment[];
    sessionId?: string;
}
export interface MemoryEntry {
    id: string;
    projectId: string;
    type: 'decision' | 'learning' | 'context' | 'artifact';
    content: string;
    summary?: string;
    embedding?: number[];
    metadata: Record<string, unknown>;
    createdAt: Date;
    expiresAt?: Date;
}
export interface MemoryQuery {
    projectId: string;
    query: string;
    types?: MemoryEntry['type'][];
    limit?: number;
    minScore?: number;
}
export interface MemorySearchResult {
    entry: MemoryEntry;
    score: number;
}
//# sourceMappingURL=index.d.ts.map