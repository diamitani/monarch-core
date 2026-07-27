/**
 * Logger utility with structured output
 */
const LOG_LEVELS = {
    debug: 0,
    info: 1,
    warn: 2,
    error: 3
};
class Logger {
    minLevel;
    context;
    constructor(minLevel = 'info', context = {}) {
        this.minLevel = minLevel;
        this.context = context;
    }
    shouldLog(level) {
        return LOG_LEVELS[level] >= LOG_LEVELS[this.minLevel];
    }
    formatEntry(entry) {
        const base = {
            ...entry,
            ...this.context,
            error: entry.error ? {
                name: entry.error.name,
                message: entry.error.message,
                stack: entry.error.stack
            } : undefined
        };
        return JSON.stringify(base);
    }
    log(level, message, context, error) {
        if (!this.shouldLog(level))
            return;
        const entry = {
            level,
            message,
            timestamp: new Date().toISOString(),
            context,
            error
        };
        const formatted = this.formatEntry(entry);
        switch (level) {
            case 'error':
                console.error(formatted);
                break;
            case 'warn':
                console.warn(formatted);
                break;
            default:
                console.log(formatted);
        }
    }
    debug(message, context) {
        this.log('debug', message, context);
    }
    info(message, context) {
        this.log('info', message, context);
    }
    warn(message, context) {
        this.log('warn', message, context);
    }
    error(message, error, context) {
        this.log('error', message, context, error);
    }
    child(additionalContext) {
        return new Logger(this.minLevel, { ...this.context, ...additionalContext });
    }
}
export function createLogger(name, minLevel) {
    const level = minLevel || process.env.LOG_LEVEL || 'info';
    return new Logger(level, { service: name });
}
export const logger = createLogger('monarch-core');
//# sourceMappingURL=logger.js.map