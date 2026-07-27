/**
 * SSE streaming utilities
 */
/**
 * Create an SSE writer for a response object
 */
export function createSSEWriter(res) {
    // Set SSE headers
    res.setHeader('Content-Type', 'text/event-stream');
    res.setHeader('Cache-Control', 'no-cache');
    res.setHeader('Connection', 'keep-alive');
    res.setHeader('X-Accel-Buffering', 'no'); // Disable nginx buffering
    return {
        write(event) {
            res.write(`event: ${event.event}\n`);
            res.write(`data: ${JSON.stringify(event.data)}\n\n`);
        },
        writeChunk(chunk) {
            const event = chunkToEvent(chunk);
            this.write(event);
        },
        error(error) {
            this.write({
                event: 'error',
                data: {
                    code: 'STREAM_ERROR',
                    message: error.message
                }
            });
            this.end();
        },
        end() {
            this.write({ event: 'done', data: {} });
            res.end();
        }
    };
}
/**
 * Convert a StreamChunk to a ChatStreamEvent
 */
function chunkToEvent(chunk) {
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
export function parseSSE(data) {
    const lines = data.split('\n');
    let event = 'message';
    let eventData = '';
    for (const line of lines) {
        if (line.startsWith('event:')) {
            event = line.slice(6).trim();
        }
        else if (line.startsWith('data:')) {
            eventData = line.slice(5).trim();
        }
    }
    if (!eventData)
        return null;
    try {
        return {
            event: event,
            data: JSON.parse(eventData)
        };
    }
    catch {
        return null;
    }
}
/**
 * Async generator to consume an SSE stream
 */
export async function* streamSSE(reader) {
    const decoder = new TextDecoder();
    let buffer = '';
    try {
        while (true) {
            const { done, value } = await reader.read();
            if (done)
                break;
            buffer += decoder.decode(value, { stream: true });
            // Split on double newline (SSE delimiter)
            const events = buffer.split('\n\n');
            buffer = events.pop() || '';
            for (const eventStr of events) {
                if (!eventStr.trim())
                    continue;
                const event = parseSSE(eventStr);
                if (event)
                    yield event;
            }
        }
    }
    finally {
        reader.releaseLock();
    }
}
/**
 * Heartbeat to keep connection alive
 */
export function createHeartbeat(writer, intervalMs = 15000) {
    let timer = null;
    return {
        start() {
            if (timer)
                return;
            timer = setInterval(() => {
                writer.write({ event: 'message', data: { type: 'heartbeat' } });
            }, intervalMs);
        },
        stop() {
            if (timer) {
                clearInterval(timer);
                timer = null;
            }
        }
    };
}
//# sourceMappingURL=streaming.js.map