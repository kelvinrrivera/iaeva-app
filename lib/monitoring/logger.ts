/**
 * Logging System
 *
 * Structured logging with Pino for production monitoring.
 */

import pino from 'pino';

const isDevelopment = process.env.NODE_ENV === 'development';

export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport:
    isDevelopment
      ? {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'SYS:standard',
            ignore: 'pid,hostname',
          },
        }
      : undefined,
  formatters: {
    level: (label) => {
      return {
        level: label,
      };
    },
  },
  // Add redaction for sensitive data in production
  redact: {
    paths: ['email', 'phone', 'password', 'token', 'secret'],
    remove: true,
  },
});

export type LogLevel = 'debug' | 'info' | 'warn' | 'error';

/**
 * Create child logger with context
 */
export function createChildLogger(context: string) {
  return logger.child({ module: context });
}

/**
 * Log HTTP request
 */
export function logRequest(
  method: string,
  path: string,
  statusCode: number,
  duration: number
) {
  logger.info({
    type: 'http_request',
    method,
    path,
    statusCode,
    duration,
  });
}

/**
 * Log error with context
 */
export function logError(error: Error, context?: Record<string, any>) {
  logger.error({
    type: 'error',
    error: {
      message: error.message,
      stack: error.stack,
      name: error.name,
    },
    ...context,
  });
}

/**
 * Log audit event
 */
export function logAudit(
  action: string,
  userId: string,
  details?: Record<string, any>
) {
  logger.info({
    type: 'audit',
    action,
    userId,
    ...details,
  });
}
