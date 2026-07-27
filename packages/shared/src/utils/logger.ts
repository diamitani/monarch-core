/**
 * Logger utility with structured output
 */

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

interface LogEntry {
  level: LogLevel;
  message: string;
  timestamp: string;
  context?: Record<string, unknown>;
  error?: Error;
}

const LOG_LEVELS: Record<LogLevel, number> = {
  debug: 0,
  info: 1,
  warn: 2,
  error: 3
};

class Logger {
  private minLevel: LogLevel;
  private context: Record<string, unknown>;

  constructor(minLevel: LogLevel = 'info', context: Record<string, unknown> = {}) {
    this.minLevel = minLevel;
    this.context = context;
  }

  private shouldLog(level: LogLevel): boolean {
    return LOG_LEVELS[level] >= LOG_LEVELS[this.minLevel];
  }

  private formatEntry(entry: LogEntry): string {
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

  private log(level: LogLevel, message: string, context?: Record<string, unknown>, error?: Error): void {
    if (!this.shouldLog(level)) return;

    const entry: LogEntry = {
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

  debug(message: string, context?: Record<string, unknown>): void {
    this.log('debug', message, context);
  }

  info(message: string, context?: Record<string, unknown>): void {
    this.log('info', message, context);
  }

  warn(message: string, context?: Record<string, unknown>): void {
    this.log('warn', message, context);
  }

  error(message: string, error?: Error, context?: Record<string, unknown>): void {
    this.log('error', message, context, error);
  }

  child(additionalContext: Record<string, unknown>): Logger {
    return new Logger(this.minLevel, { ...this.context, ...additionalContext });
  }
}

export function createLogger(name: string, minLevel?: LogLevel): Logger {
  const level = minLevel || (process.env.LOG_LEVEL as LogLevel) || 'info';
  return new Logger(level, { service: name });
}

export const logger = createLogger('monarch-core');
