"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.Logger = void 0;
const pino_1 = __importDefault(require("pino"));
/**
 * Structured logging utility using pino.
 */
class Logger {
    /**
     * Initializes the logger with pino.
     */
    constructor() {
        this.logger = (0, pino_1.default)({
            level: process.env.LOG_LEVEL || 'info',
        });
    }
    /**
     * Logs an info message.
     * @param message - Message to log.
     * @param meta - Additional metadata.
     */
    info(message, meta = {}) {
        this.logger.info(meta, message);
    }
    /**
     * Logs an error message.
     * @param message - Message to log.
     * @param meta - Additional metadata.
     */
    error(message, meta = {}) {
        this.logger.error(meta, message);
    }
    /**
     * Logs a debug message.
     * @param message - Message to log.
     * @param meta - Additional metadata.
     */
    debug(message, meta = {}) {
        this.logger.debug(meta, message);
    }
    /**
     * Logs a warning message.
     * @param message - Message to log.
     * @param meta - Additional metadata.
     */
    warn(message, meta = {}) {
        this.logger.warn(meta, message);
    }
}
exports.Logger = Logger;
//# sourceMappingURL=logger.js.map