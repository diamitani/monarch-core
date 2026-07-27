/**
 * Logger utility with structured output
 */
export type LogLevel = 'debug' | 'info' | 'warn' | 'error';
declare class Logger {
    private minLevel;
    private context;
    constructor(minLevel?: LogLevel, context?: Record<string, unknown>);
    private shouldLog;
    private formatEntry;
    private log;
    debug(message: string, context?: Record<string, unknown>): void;
    info(message: string, context?: Record<string, unknown>): void;
    warn(message: string, context?: Record<string, unknown>): void;
    error(message: string, error?: Error, context?: Record<string, unknown>): void;
    child(additionalContext: Record<string, unknown>): Logger;
}
export declare function createLogger(name: string, minLevel?: LogLevel): Logger;
export declare const logger: Logger;
export {};
//# sourceMappingURL=logger.d.ts.map