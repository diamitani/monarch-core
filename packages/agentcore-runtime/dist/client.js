/**
 * Bedrock AgentCore Runtime Client
 * Wraps AWS SDK with streaming, session management, and error handling
 */
import { BedrockAgentRuntimeClient, InvokeAgentCommand, GetAgentMemoryCommand, DeleteAgentMemoryCommand } from '@aws-sdk/client-bedrock-agent-runtime';
import { BedrockRuntimeClient, ConverseStreamCommand } from '@aws-sdk/client-bedrock-runtime';
import { BedrockError, createLogger, AWS_CONFIG } from '@monarch/shared';
const logger = createLogger('agentcore-client');
export class AgentCoreClient {
    agentClient;
    runtimeClient;
    config;
    constructor(config) {
        this.config = {
            region: config?.region || AWS_CONFIG.region,
            maxRetries: config?.maxRetries || 3,
            timeout: config?.timeout || 300000
        };
        this.agentClient = new BedrockAgentRuntimeClient({
            region: this.config.region,
            credentials: config?.credentials,
            maxAttempts: this.config.maxRetries
        });
        this.runtimeClient = new BedrockRuntimeClient({
            region: this.config.region,
            credentials: config?.credentials,
            maxAttempts: this.config.maxRetries
        });
    }
    /**
     * Invoke a Bedrock Agent with streaming response
     */
    async *invokeAgent(params) {
        logger.info('Invoking agent', {
            agentId: params.agentId,
            sessionId: params.sessionId
        });
        try {
            const command = new InvokeAgentCommand({
                agentId: params.agentId,
                agentAliasId: 'TSTALIASID', // Use test alias or configure
                sessionId: params.sessionId,
                inputText: params.inputText,
                enableTrace: params.enableTrace,
                endSession: params.endSession,
                memoryId: params.memoryId,
                sessionState: params.sessionState ? {
                    sessionAttributes: params.sessionState.sessionAttributes,
                    promptSessionAttributes: params.sessionState.promptSessionAttributes,
                    files: params.sessionState.files?.map(f => ({
                        name: f.name,
                        source: {
                            sourceType: f.source.sourceType,
                            s3Location: f.source.s3Location,
                            byteContent: f.source.byteContent ? {
                                mediaType: f.source.byteContent.mediaType,
                                data: Buffer.from(f.source.byteContent.data, 'base64')
                            } : undefined
                        },
                        useCase: f.useCase
                    }))
                } : undefined
            });
            const response = await this.agentClient.send(command);
            if (!response.completion) {
                throw new BedrockError('No completion stream in response');
            }
            // Process streaming response
            for await (const event of response.completion) {
                if (event.chunk) {
                    const text = event.chunk.bytes
                        ? new TextDecoder().decode(event.chunk.bytes)
                        : '';
                    yield {
                        type: 'text',
                        data: { text, attribution: event.chunk.attribution },
                        timestamp: new Date()
                    };
                }
                if (event.trace) {
                    yield {
                        type: 'trace',
                        data: event.trace,
                        timestamp: new Date(),
                        traceId: event.trace.trace?.orchestrationTrace?.rationale?.traceId
                    };
                }
                if (event.returnControl) {
                    yield {
                        type: 'tool_use',
                        data: {
                            invocationId: event.returnControl.invocationId,
                            invocationInputs: event.returnControl.invocationInputs
                        },
                        timestamp: new Date()
                    };
                }
            }
        }
        catch (error) {
            logger.error('Agent invocation failed', error, {
                agentId: params.agentId,
                sessionId: params.sessionId
            });
            yield {
                type: 'error',
                data: {
                    message: error.message,
                    code: error?.name || 'UNKNOWN_ERROR'
                },
                timestamp: new Date()
            };
            throw new BedrockError(`Agent invocation failed: ${error.message}`, { agentId: params.agentId, sessionId: params.sessionId, originalError: error });
        }
    }
    /**
     * Direct model invocation with streaming (for cases without agent)
     */
    async *converseStream(modelId, messages, systemPrompt) {
        const command = new ConverseStreamCommand({
            modelId,
            messages: messages.map(m => ({
                role: m.role,
                content: [{ text: m.content }]
            })),
            system: systemPrompt ? [{ text: systemPrompt }] : undefined,
            inferenceConfig: {
                maxTokens: 8192,
                temperature: 0.2
            }
        });
        try {
            const response = await this.runtimeClient.send(command);
            if (!response.stream) {
                throw new BedrockError('No stream in converse response');
            }
            for await (const event of response.stream) {
                if (event.contentBlockDelta?.delta?.text) {
                    yield {
                        type: 'text',
                        content: event.contentBlockDelta.delta.text
                    };
                }
                if (event.messageStop) {
                    yield { type: 'done' };
                }
            }
        }
        catch (error) {
            logger.error('Converse stream failed', error, { modelId });
            throw new BedrockError(`Converse failed: ${error.message}`, { modelId, originalError: error });
        }
    }
    /**
     * Get agent memory
     */
    async getMemory(params) {
        try {
            const command = new GetAgentMemoryCommand({
                agentId: params.agentId,
                agentAliasId: 'TSTALIASID',
                memoryId: params.memoryId,
                memoryType: params.memoryType || 'SESSION_SUMMARY',
                maxItems: params.maxItems || 10,
                nextToken: params.nextToken
            });
            const response = await this.agentClient.send(command);
            return {
                sessions: (response.memoryContents || []).map(mem => ({
                    memoryId: params.memoryId,
                    sessionId: mem.sessionSummary?.sessionId || '',
                    sessionStartTime: String(mem.sessionSummary?.sessionStartTime || ''),
                    sessionExpiryTime: mem.sessionSummary?.sessionExpiryTime ? String(mem.sessionSummary.sessionExpiryTime) : undefined,
                    summaryText: mem.sessionSummary?.summaryText
                }))
            };
        }
        catch (error) {
            logger.error('Get memory failed', error, params);
            throw new BedrockError(`Get memory failed: ${error.message}`, { ...params, originalError: error });
        }
    }
    /**
     * Delete agent memory
     */
    async deleteMemory(agentId, memoryId) {
        try {
            const command = new DeleteAgentMemoryCommand({
                agentId,
                agentAliasId: 'TSTALIASID',
                memoryId
            });
            await this.agentClient.send(command);
            logger.info('Memory deleted', { agentId, memoryId });
        }
        catch (error) {
            logger.error('Delete memory failed', error, { agentId, memoryId });
            throw new BedrockError(`Delete memory failed: ${error.message}`, { agentId, memoryId, originalError: error });
        }
    }
}
// Export singleton for convenience
export const agentCoreClient = new AgentCoreClient();
//# sourceMappingURL=client.js.map