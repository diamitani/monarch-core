/**
 * Streaming handler for AgentCore responses
 */
import type { AgentStreamEvent, StreamChunk, ChatStreamEvent } from '@monarch/shared';
export interface StreamHandler {
    onText: (text: string) => void;
    onToolUse: (toolName: string, input: unknown) => void;
    onToolResult: (toolName: string, result: unknown) => void;
    onArtifact: (artifact: unknown) => void;
    onTrace: (trace: unknown) => void;
    onError: (error: Error) => void;
    onComplete: () => void;
}
/**
 * Process AgentCore stream events and convert to chat events
 */
export declare function processAgentStream(stream: AsyncGenerator<AgentStreamEvent>, handler: Partial<StreamHandler>): Promise<string>;
/**
 * Convert AgentCore events to SSE-friendly chunks
 */
export declare function convertToStreamChunks(events: AgentStreamEvent[]): Generator<StreamChunk>;
/**
 * Create a chat event from a stream chunk
 */
export declare function chunkToChatEvent(chunk: StreamChunk): ChatStreamEvent;
/**
 * Buffer streaming text for smoother display
 */
export declare class TextBuffer {
    private buffer;
    private flushInterval;
    private timer;
    private onFlush;
    constructor(onFlush: (text: string) => void, flushIntervalMs?: number);
    append(text: string): void;
    flush(): void;
    stop(): void;
}
//# sourceMappingURL=streaming.d.ts.map