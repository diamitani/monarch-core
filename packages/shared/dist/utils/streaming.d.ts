/**
 * SSE streaming utilities
 */
import type { StreamChunk, ChatStreamEvent } from '../types/bedrock.js';
export interface SSEWriter {
    write(event: ChatStreamEvent): void;
    writeChunk(chunk: StreamChunk): void;
    error(error: Error): void;
    end(): void;
}
/**
 * Create an SSE writer for a response object
 */
export declare function createSSEWriter(res: {
    setHeader: (name: string, value: string) => void;
    write: (data: string) => boolean;
    end: () => void;
}): SSEWriter;
/**
 * Parse SSE data from a string
 */
export declare function parseSSE(data: string): ChatStreamEvent | null;
/**
 * Async generator to consume an SSE stream
 */
export declare function streamSSE(reader: ReadableStreamDefaultReader<Uint8Array>): AsyncGenerator<ChatStreamEvent, void, unknown>;
/**
 * Heartbeat to keep connection alive
 */
export declare function createHeartbeat(writer: SSEWriter, intervalMs?: number): {
    start: () => void;
    stop: () => void;
};
//# sourceMappingURL=streaming.d.ts.map