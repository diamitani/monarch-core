/**
 * Streaming handler for AgentCore responses
 */
import { createLogger } from '@monarch/shared';
const logger = createLogger('streaming');
/**
 * Process AgentCore stream events and convert to chat events
 */
export async function processAgentStream(stream, handler) {
    let fullResponse = '';
    try {
        for await (const event of stream) {
            switch (event.type) {
                case 'text': {
                    const text = event.data?.text || '';
                    fullResponse += text;
                    handler.onText?.(text);
                    break;
                }
                case 'tool_use': {
                    const toolData = event.data;
                    const toolInfo = toolData.invocationInputs?.[0]?.actionGroupInvocationInput;
                    if (toolInfo?.function) {
                        handler.onToolUse?.(toolInfo.function, toolInfo.parameters);
                    }
                    break;
                }
                case 'tool_result': {
                    const resultData = event.data;
                    if (resultData.toolName) {
                        handler.onToolResult?.(resultData.toolName, resultData.result);
                    }
                    break;
                }
                case 'artifact': {
                    handler.onArtifact?.(event.data);
                    break;
                }
                case 'trace': {
                    handler.onTrace?.(event.data);
                    break;
                }
                case 'error': {
                    const errorData = event.data;
                    handler.onError?.(new Error(errorData.message || 'Unknown error'));
                    break;
                }
            }
        }
        handler.onComplete?.();
        return fullResponse;
    }
    catch (error) {
        logger.error('Stream processing error', error);
        handler.onError?.(error);
        throw error;
    }
}
/**
 * Convert AgentCore events to SSE-friendly chunks
 */
export function* convertToStreamChunks(events) {
    for (const event of events) {
        switch (event.type) {
            case 'text':
                yield {
                    type: 'delta',
                    content: event.data?.text || ''
                };
                break;
            case 'tool_use': {
                const toolData = event.data;
                const toolInfo = toolData.invocationInputs?.[0]?.actionGroupInvocationInput;
                if (toolInfo?.function) {
                    yield {
                        type: 'tool_start',
                        toolName: toolInfo.function,
                        toolInput: toolInfo.parameters
                    };
                }
                break;
            }
            case 'tool_result': {
                const resultData = event.data;
                if (resultData.toolName) {
                    yield {
                        type: 'tool_end',
                        toolName: resultData.toolName,
                        toolResult: resultData.result
                    };
                }
                break;
            }
            case 'error':
                yield {
                    type: 'error',
                    error: event.data?.message || 'Unknown error'
                };
                break;
        }
    }
    yield { type: 'done' };
}
/**
 * Create a chat event from a stream chunk
 */
export function chunkToChatEvent(chunk) {
    switch (chunk.type) {
        case 'delta':
            return { event: 'message', data: { content: chunk.content } };
        case 'tool_start':
            return {
                event: 'tool',
                data: { status: 'start', name: chunk.toolName, input: chunk.toolInput }
            };
        case 'tool_end':
            return {
                event: 'tool',
                data: { status: 'end', name: chunk.toolName, result: chunk.toolResult }
            };
        case 'error':
            return { event: 'error', data: { message: chunk.error } };
        case 'done':
            return { event: 'done', data: {} };
    }
}
/**
 * Buffer streaming text for smoother display
 */
export class TextBuffer {
    buffer = '';
    flushInterval;
    timer = null;
    onFlush;
    constructor(onFlush, flushIntervalMs = 50) {
        this.onFlush = onFlush;
        this.flushInterval = flushIntervalMs;
    }
    append(text) {
        this.buffer += text;
        if (!this.timer) {
            this.timer = setInterval(() => this.flush(), this.flushInterval);
        }
    }
    flush() {
        if (this.buffer) {
            this.onFlush(this.buffer);
            this.buffer = '';
        }
    }
    stop() {
        if (this.timer) {
            clearInterval(this.timer);
            this.timer = null;
        }
        this.flush();
    }
}
//# sourceMappingURL=streaming.js.map