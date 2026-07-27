/**
 * Streaming handler for AgentCore responses
 */

import type { AgentStreamEvent, StreamChunk, ChatStreamEvent } from '@monarch/shared';
import { createLogger } from '@monarch/shared';

const logger = createLogger('streaming');

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
export async function processAgentStream(
  stream: AsyncGenerator<AgentStreamEvent>,
  handler: Partial<StreamHandler>
): Promise<string> {
  let fullResponse = '';
  
  try {
    for await (const event of stream) {
      switch (event.type) {
        case 'text': {
          const text = (event.data as { text?: string })?.text || '';
          fullResponse += text;
          handler.onText?.(text);
          break;
        }
        
        case 'tool_use': {
          const toolData = event.data as { 
            invocationInputs?: Array<{
              actionGroupInvocationInput?: { function?: string; parameters?: unknown };
            }>;
          };
          const toolInfo = toolData.invocationInputs?.[0]?.actionGroupInvocationInput;
          if (toolInfo?.function) {
            handler.onToolUse?.(toolInfo.function, toolInfo.parameters);
          }
          break;
        }
        
        case 'tool_result': {
          const resultData = event.data as { toolName?: string; result?: unknown };
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
          const errorData = event.data as { message?: string };
          handler.onError?.(new Error(errorData.message || 'Unknown error'));
          break;
        }
      }
    }
    
    handler.onComplete?.();
    return fullResponse;
    
  } catch (error) {
    logger.error('Stream processing error', error as Error);
    handler.onError?.(error as Error);
    throw error;
  }
}

/**
 * Convert AgentCore events to SSE-friendly chunks
 */
export function* convertToStreamChunks(
  events: AgentStreamEvent[]
): Generator<StreamChunk> {
  for (const event of events) {
    switch (event.type) {
      case 'text':
        yield {
          type: 'delta',
          content: (event.data as { text?: string })?.text || ''
        };
        break;
        
      case 'tool_use': {
        const toolData = event.data as {
          invocationInputs?: Array<{
            actionGroupInvocationInput?: { function?: string; parameters?: unknown };
          }>;
        };
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
        const resultData = event.data as { toolName?: string; result?: unknown };
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
          error: (event.data as { message?: string })?.message || 'Unknown error'
        };
        break;
    }
  }
  
  yield { type: 'done' };
}

/**
 * Create a chat event from a stream chunk
 */
export function chunkToChatEvent(chunk: StreamChunk): ChatStreamEvent {
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
  private buffer = '';
  private flushInterval: number;
  private timer: ReturnType<typeof setInterval> | null = null;
  private onFlush: (text: string) => void;

  constructor(onFlush: (text: string) => void, flushIntervalMs = 50) {
    this.onFlush = onFlush;
    this.flushInterval = flushIntervalMs;
  }

  append(text: string): void {
    this.buffer += text;
    
    if (!this.timer) {
      this.timer = setInterval(() => this.flush(), this.flushInterval);
    }
  }

  flush(): void {
    if (this.buffer) {
      this.onFlush(this.buffer);
      this.buffer = '';
    }
  }

  stop(): void {
    if (this.timer) {
      clearInterval(this.timer);
      this.timer = null;
    }
    this.flush();
  }
}
