import pino from 'pino';

/**
 * Structured logging utility using pino.
 */
export class Logger {
  private logger: pino.Logger;

  /**
   * Initializes the logger with pino.
   */
  constructor() {
    this.logger = pino({
      level: process.env.LOG_LEVEL || 'info',
    });
  }

  /**
   * Logs an info message.
   * @param message - Message to log.
   * @param meta - Additional metadata.
   */
  info(message: string, meta: Record<string, any> = {}): void {
    this.logger.info(meta, message);
  }

  /**
   * Logs an error message.
   * @param message - Message to log.
   * @param meta - Additional metadata.
   */
  error(message: string, meta: Record<string, any> = {}): void {
    this.logger.error(meta, message);
  }

  /**
   * Logs a debug message.
   * @param message - Message to log.
   * @param meta - Additional metadata.
   */
  debug(message: string, meta: Record<string, any> = {}): void {
    this.logger.debug(meta, message);
  }

  /**
   * Logs a warning message.
   * @param message - Message to log.
   * @param meta - Additional metadata.
   */
  warn(message: string, meta: Record<string, any> = {}): void {
    this.logger.warn(meta, message);
  }
}
