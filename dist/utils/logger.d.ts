/**
 * Structured logging utility using pino.
 */
export declare class Logger {
    private logger;
    /**
     * Initializes the logger with pino.
     */
    constructor();
    /**
     * Logs an info message.
     * @param message - Message to log.
     * @param meta - Additional metadata.
     */
    info(message: string, meta?: Record<string, any>): void;
    /**
     * Logs an error message.
     * @param message - Message to log.
     * @param meta - Additional metadata.
     */
    error(message: string, meta?: Record<string, any>): void;
    /**
     * Logs a debug message.
     * @param message - Message to log.
     * @param meta - Additional metadata.
     */
    debug(message: string, meta?: Record<string, any>): void;
    /**
     * Logs a warning message.
     * @param message - Message to log.
     * @param meta - Additional metadata.
     */
    warn(message: string, meta?: Record<string, any>): void;
}
