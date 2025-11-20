import pino from 'pino';
import { config } from '../../composition/config.js';

/**
 * Logger interface for application-wide logging
 */
export interface Logger {
  info(message: string, context?: Record<string, unknown>): void;
  error(message: string, error?: Error, context?: Record<string, unknown>): void;
  warn(message: string, context?: Record<string, unknown>): void;
  debug(message: string, context?: Record<string, unknown>): void;
}

/**
 * Pino-based logger implementation
 * Provides structured logging with configurable levels
 */
export class PinoLogger implements Logger {
  private logger: pino.Logger;

  constructor(options?: { name?: string; level?: string }) {
    this.logger = pino({
      name: options?.name || 'clean-orders',
      level: options?.level || config.LOG_LEVEL,
      transport:
        config.NODE_ENV === 'development'
          ? {
              target: 'pino-pretty',
              options: {
                colorize: true,
                translateTime: 'SYS:standard',
                ignore: 'pid,hostname',
              },
            }
          : undefined,
    });
  }

  info(message: string, context?: Record<string, unknown>): void {
    if (context) {
      this.logger.info(context, message);
    } else {
      this.logger.info(message);
    }
  }

  error(message: string, error?: Error, context?: Record<string, unknown>): void {
    const logContext = {
      ...context,
      ...(error && {
        error: {
          message: error.message,
          stack: error.stack,
          name: error.name,
        },
      }),
    };

    this.logger.error(logContext, message);
  }

  warn(message: string, context?: Record<string, unknown>): void {
    if (context) {
      this.logger.warn(context, message);
    } else {
      this.logger.warn(message);
    }
  }

  debug(message: string, context?: Record<string, unknown>): void {
    if (context) {
      this.logger.debug(context, message);
    } else {
      this.logger.debug(message);
    }
  }

  /**
   * Create a child logger with additional context
   */
  child(bindings: Record<string, unknown>): PinoLogger {
    const childLogger = new PinoLogger();
    childLogger.logger = this.logger.child(bindings);
    return childLogger;
  }
}
