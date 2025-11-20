import pino from 'pino';
import { config } from '../../../composition/config.js';

/**
 * Logger interface for messaging/event observability
 */
export interface Logger {
  info(message: string, meta?: Record<string, unknown>): void;
  error(message: string, error: Error, meta?: Record<string, unknown>): void;
  warn(message: string, meta?: Record<string, unknown>): void;
  debug(message: string, meta?: Record<string, unknown>): void;
}

/**
 * Pino-based logger for messaging and event dispatching
 * Specialized for outbox pattern and event processing observability
 */
export class PinoLogger implements Logger {
  private logger: pino.Logger;

  constructor(component: string = 'messaging') {
    this.logger = pino({
      name: `clean-orders:${component}`,
      level: config.LOG_LEVEL,
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

  info(message: string, meta?: Record<string, unknown>): void {
    if (meta) {
      this.logger.info(meta, message);
    } else {
      this.logger.info(message);
    }
  }

  error(message: string, error: Error, meta?: Record<string, unknown>): void {
    const logMeta = {
      ...meta,
      error: {
        message: error.message,
        stack: error.stack,
        name: error.name,
      },
    };

    this.logger.error(logMeta, message);
  }

  warn(message: string, meta?: Record<string, unknown>): void {
    if (meta) {
      this.logger.warn(meta, message);
    } else {
      this.logger.warn(message);
    }
  }

  debug(message: string, meta?: Record<string, unknown>): void {
    if (meta) {
      this.logger.debug(meta, message);
    } else {
      this.logger.debug(message);
    }
  }
}
