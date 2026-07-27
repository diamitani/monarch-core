/**
 * Custom error classes for Monarch Core
 */
export class MonarchError extends Error {
    code;
    statusCode;
    details;
    retryable;
    constructor(message, code, statusCode = 500, details, retryable = false) {
        super(message);
        this.name = 'MonarchError';
        this.code = code;
        this.statusCode = statusCode;
        this.details = details;
        this.retryable = retryable;
        Error.captureStackTrace(this, this.constructor);
    }
    toJSON() {
        return {
            name: this.name,
            code: this.code,
            message: this.message,
            statusCode: this.statusCode,
            details: this.details,
            retryable: this.retryable
        };
    }
}
// Authentication & Authorization
export class AuthenticationError extends MonarchError {
    constructor(message = 'Authentication required', details) {
        super(message, 'AUTH_REQUIRED', 401, details, false);
        this.name = 'AuthenticationError';
    }
}
export class AuthorizationError extends MonarchError {
    constructor(message = 'Permission denied', details) {
        super(message, 'FORBIDDEN', 403, details, false);
        this.name = 'AuthorizationError';
    }
}
// Validation
export class ValidationError extends MonarchError {
    constructor(message, details) {
        super(message, 'VALIDATION_ERROR', 400, details, false);
        this.name = 'ValidationError';
    }
}
// Not Found
export class NotFoundError extends MonarchError {
    constructor(resource, id) {
        const message = id ? `${resource} not found: ${id}` : `${resource} not found`;
        super(message, 'NOT_FOUND', 404, { resource, id }, false);
        this.name = 'NotFoundError';
    }
}
// Rate Limiting
export class RateLimitError extends MonarchError {
    retryAfter;
    constructor(message = 'Rate limit exceeded', retryAfter) {
        super(message, 'RATE_LIMITED', 429, { retryAfter }, true);
        this.name = 'RateLimitError';
        this.retryAfter = retryAfter;
    }
}
// External Service Errors
export class ExternalServiceError extends MonarchError {
    service;
    constructor(service, message, details) {
        super(message, 'EXTERNAL_SERVICE_ERROR', 502, { service, ...details }, true);
        this.name = 'ExternalServiceError';
        this.service = service;
    }
}
// Bedrock Specific
export class BedrockError extends ExternalServiceError {
    constructor(message, details) {
        super('bedrock', message, details);
        this.name = 'BedrockError';
    }
}
// Composio Specific
export class ComposioError extends ExternalServiceError {
    constructor(message, details) {
        super('composio', message, details);
        this.name = 'ComposioError';
    }
}
// Agent Execution
export class AgentExecutionError extends MonarchError {
    agentId;
    sessionId;
    constructor(agentId, message, sessionId, details) {
        super(message, 'AGENT_EXECUTION_ERROR', 500, { agentId, sessionId, ...details }, true);
        this.name = 'AgentExecutionError';
        this.agentId = agentId;
        this.sessionId = sessionId;
    }
}
// PAL Compilation
export class PALCompilationError extends MonarchError {
    stage;
    constructor(stage, message, details) {
        super(message, 'PAL_COMPILATION_ERROR', 400, { stage, ...details }, false);
        this.name = 'PALCompilationError';
        this.stage = stage;
    }
}
// Timeout
export class TimeoutError extends MonarchError {
    constructor(operation, timeoutMs) {
        super(`Operation timed out: ${operation}`, 'TIMEOUT', 504, { operation, timeoutMs }, true);
        this.name = 'TimeoutError';
    }
}
// Helper to check if error is retryable
export function isRetryableError(error) {
    if (error instanceof MonarchError) {
        return error.retryable;
    }
    // Network errors are typically retryable
    if (error instanceof Error) {
        const message = error.message.toLowerCase();
        return (message.includes('econnreset') ||
            message.includes('econnrefused') ||
            message.includes('etimedout') ||
            message.includes('socket hang up'));
    }
    return false;
}
// Helper to wrap unknown errors
export function wrapError(error, context) {
    if (error instanceof MonarchError) {
        return error;
    }
    if (error instanceof Error) {
        return new MonarchError(context ? `${context}: ${error.message}` : error.message, 'INTERNAL_ERROR', 500, { originalError: error.name, stack: error.stack });
    }
    return new MonarchError(context || 'Unknown error', 'INTERNAL_ERROR', 500, { originalError: error });
}
//# sourceMappingURL=errors.js.map