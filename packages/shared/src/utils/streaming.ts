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
export function createSSEWriter(res: {
  setHeader: (name: string, value: string) => void;
  write: (data: string) => boolean;
  end: () => void;
}): SSEWriter {
  // Set SSE headers
  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering

  return {
    write(event: ChatStreamEvent): void {
      res.write(`event: ${event.event}\n`);
      res.write(`data: ${JSON.stringify(event.data)}\n\n`);
    },

    writeChunk(chunk: StreamChunk): void {
      const event = chunkToEvent(chunk);
      this.write(event);
    },

    error(error: Error): void {
      this.write({
        event: 'error',
        data: {
          code: 'STREAM_ERROR',
          message: error.message
        }
      });
      this.end();
    },

    end(): void {
      this.write({ event: 'done', data: {} });
      res.end();
    }
  };
}

/**
 * Convert a StreamChunk to a ChatStreamEvent
 */
function chunkToEvent(chunk: StreamChunk): ChatStreamEvent {
  switch (chunk.type) {
    case 'delta':
      return { event: 'message', data: { content: chunk.content } };
    case 'tool_start':
      return { event: 'tool', data: { status: 'start', name: chunk.toolName, input: chunk.toolInput } };
    case 'tool_end':
      return { event: 'tool', data: { status: 'end', name: chunk.toolName, result: chunk.toolResult } };
    case 'done':
      return { event: 'done', data: {} };
    case 'error':
      return { event: 'error', data: { message: chunk.error } };
    default:
      return { event: 'message', data: chunk };
  }
}

/**
 * Parse SSE data from a string
 */
export function parseSSE(data: string): ChatStreamEvent | null {
  const lines = data.split('\n');
  let event = 'message';
  let eventData = '';

  for (const line of lines) {
    if (line.startsWith('event:')) {
      event = line.slice(6).trim();
    } else if (line.startsWith('data:')) {
      eventData = line.slice(5).trim();
    }
  }

  if (!eventData) return null;

  try {
    return {
      event: event as ChatStreamEvent['event'],
      data: JSON.parse(eventData)
    };
  } catch {
    return null;
  }
}

/**
 * Async generator to consume an SSE stream
 */
export async function* streamSSE(
  reader: ReadableStreamDefaultReader<Uint8Array>
): AsyncGenerator<ChatStreamEvent, void, unknown> {
  const decoder = new TextDecoder();
  let buffer = '';

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      
      // Split on double newline (SSE delimiter)
      const events = buffer.split('\n\n');
      buffer = events.pop() || '';

      for (const eventStr of events) {
        if (!eventStr.trim()) continue;
        const event = parseSSE(eventStr);
        if (event) yield event;
      }
    }
  } finally {
    reader.releaseLock();
  }
}

/**
 * Heartbeat to keep connection alive
 */
export function createHeartbeat(
  writer: SSEWriter,
  intervalMs: number = 15000
): { start: () => void; stop: () => void } {
  let timer: ReturnType<typeof setInterval> | null = null;

  return {
    start(): void {
      if (timer) return;
      timer = setInterval(() => {
        writer.write({ event: 'message', data: { type: 'heartbeat' } });
      }, intervalMs);
    },

    stop(): void {
      if (timer) {
        clearInterval(timer);
        timer = null;
      }
    }
  };
}
