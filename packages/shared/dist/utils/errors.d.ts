/**
 * Custom error classes for Monarch Core
 */
export declare class MonarchError extends Error {
    readonly code: string;
    readonly statusCode: number;
    readonly details?: unknown;
    readonly retryable: boolean;
    constructor(message: string, code: string, statusCode?: number, details?: unknown, retryable?: boolean);
    toJSON(): {
        name: string;
        code: string;
        message: string;
        statusCode: number;
        details: unknown;
        retryable: boolean;
    };
}
export declare class AuthenticationError extends MonarchError {
    constructor(message?: string, details?: unknown);
}
export declare class AuthorizationError extends MonarchError {
    constructor(message?: string, details?: unknown);
}
export declare class ValidationError extends MonarchError {
    constructor(message: string, details?: unknown);
}
export declare class NotFoundError extends MonarchError {
    constructor(resource: string, id?: string);
}
export declare class RateLimitError extends MonarchError {
    readonly retryAfter?: number;
    constructor(message?: string, retryAfter?: number);
}
export declare class ExternalServiceError extends MonarchError {
    readonly service: string;
    constructor(service: string, message: string, details?: unknown);
}
export declare class BedrockError extends ExternalServiceError {
    constructor(message: string, details?: unknown);
}
export declare class ComposioError extends ExternalServiceError {
    constructor(message: string, details?: unknown);
}
export declare class AgentExecutionError extends MonarchError {
    readonly agentId: string;
    readonly sessionId?: string;
    constructor(agentId: string, message: string, sessionId?: string, details?: unknown);
}
export declare class PALCompilationError extends MonarchError {
    readonly stage: string;
    constructor(stage: string, message: string, details?: unknown);
}
export declare class TimeoutError extends MonarchError {
    constructor(operation: string, timeoutMs: number);
}
export declare function isRetryableError(error: unknown): boolean;
export declare function wrapError(error: unknown, context?: string): MonarchError;
//# sourceMappingURL=errors.d.ts.map