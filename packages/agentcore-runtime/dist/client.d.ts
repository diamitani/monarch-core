/**
 * Bedrock AgentCore Runtime Client
 * Wraps AWS SDK with streaming, session management, and error handling
 */
import type { AgentCoreClientConfig, InvokeAgentParams, AgentStreamEvent, SessionInfo, GetMemoryParams } from '@monarch/shared';
export declare class AgentCoreClient {
    private agentClient;
    private runtimeClient;
    private config;
    constructor(config?: Partial<AgentCoreClientConfig>);
    /**
     * Invoke a Bedrock Agent with streaming response
     */
    invokeAgent(params: InvokeAgentParams): AsyncGenerator<AgentStreamEvent>;
    /**
     * Direct model invocation with streaming (for cases without agent)
     */
    converseStream(modelId: string, messages: Array<{
        role: 'user' | 'assistant';
        content: string;
    }>, systemPrompt?: string): AsyncGenerator<{
        type: 'text' | 'done';
        content?: string;
    }>;
    /**
     * Get agent memory
     */
    getMemory(params: GetMemoryParams): Promise<{
        sessions: SessionInfo[];
    }>;
    /**
     * Delete agent memory
     */
    deleteMemory(agentId: string, memoryId: string): Promise<void>;
}
export declare const agentCoreClient: AgentCoreClient;
//# sourceMappingURL=client.d.ts.map