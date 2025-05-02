"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.Heartbeat = void 0;
const ws_1 = require("ws");
const errors_1 = require("../utils/errors");
/**
 * Manages heartbeat functionality for a WebSocket connection, sending pings and
 * monitoring pong responses to ensure connection health.
 */
class Heartbeat {
    /**
     * Constructs a new Heartbeat instance.
     * @param intervalMs - Interval between ping messages (in milliseconds).
     * @param timeoutMs - Timeout for receiving a pong response (in milliseconds).
     * @param onTimeout - Callback to invoke when the connection times out.
     * @param logger - Logger instance for logging events.
     * @param metrics - Metrics instance for collecting metrics.
     * @param connectionId - Unique identifier for the connection.
     */
    constructor(intervalMs, timeoutMs, onTimeout, logger, metrics, connectionId) {
        this.pingTimer = null;
        this.timeoutTimer = null;
        this.connectionId = connectionId;
        this.ws = null; // Will be set when start() is called
        this.intervalMs = intervalMs;
        this.timeoutMs = timeoutMs;
        this.onTimeout = onTimeout;
        this.logger = logger;
        this.metrics = metrics;
        this.lastPong = Date.now();
    }
    /**
     * Starts the heartbeat mechanism for a WebSocket connection.
     * @param ws - WebSocket instance to monitor.
     */
    start(ws) {
        if (this.pingTimer || this.timeoutTimer) {
            this.logger.warn(`Heartbeat already started for connection: ${this.connectionId}`);
            return;
        }
        this.ws = ws;
        this.lastPong = Date.now();
        // Schedule periodic pings
        this.pingTimer = setInterval(() => this.sendPing(), this.intervalMs);
        // Schedule timeout check
        this.timeoutTimer = setInterval(() => this.checkTimeout(), this.timeoutMs / 2);
        this.logger.debug(`Heartbeat started for connection: ${this.connectionId}`, {
            intervalMs: this.intervalMs,
            timeoutMs: this.timeoutMs,
        });
        this.metrics.increment('heartbeat.started', {
            connectionId: this.connectionId,
        });
    }
    /**
     * Stops the heartbeat mechanism and clears timers.
     */
    stop() {
        if (this.pingTimer) {
            clearInterval(this.pingTimer);
            this.pingTimer = null;
        }
        if (this.timeoutTimer) {
            clearInterval(this.timeoutTimer);
            this.timeoutTimer = null;
        }
        this.ws = null;
        this.logger.debug(`Heartbeat stopped for connection: ${this.connectionId}`);
        this.metrics.increment('heartbeat.stopped', {
            connectionId: this.connectionId,
        });
    }
    /**
     * Records a received message (pong or other) to reset the timeout.
     */
    messageReceived() {
        this.lastPong = Date.now();
        this.metrics.increment('heartbeat.pong.received', {
            connectionId: this.connectionId,
        });
    }
    /**
     * Sends a ping message to the client.
     * @private
     */
    sendPing() {
        if (!this.ws || this.ws.readyState !== ws_1.WebSocket.OPEN) {
            // Log warning if connection is closed
            this.logger.warn(`Cannot send ping, connection closed: ${this.connectionId}`);
            this.stop();
            this.onTimeout();
            return;
        }
        const pingMsg = { msg: 'ping', id: `ping-${Date.now()}` };
        try {
            this.ws.send(JSON.stringify(pingMsg)); // Use JSON for pings for simplicity
            // Log ping send (verified template literal)
            this.logger.debug(`Sent ping to connection: ${this.connectionId}`, {
                id: pingMsg.id,
            });
            this.metrics.increment('heartbeat.ping.sent', {
                connectionId: this.connectionId,
            });
        }
        catch (error) {
            // Log error if ping fails
            this.logger.error(`Failed to send ping for connection: ${this.connectionId}`, { error });
            this.metrics.increment('heartbeat.ping.error', {
                connectionId: this.connectionId,
            });
            this.stop();
            this.onTimeout();
            throw new errors_1.DDPConnectionError('Failed to send ping', {
                cause: error,
                connectionId: this.connectionId,
            });
        }
    }
    /**
     * Checks if the connection has timed out based on the last pong received.
     * @private
     */
    checkTimeout() {
        const now = Date.now();
        if (now - this.lastPong > this.timeoutMs) {
            // Log timeout warning
            this.logger.warn(`Connection timed out: ${this.connectionId}`, {
                lastPong: new Date(this.lastPong).toISOString(),
                now: new Date(now).toISOString(),
            });
            this.metrics.increment('heartbeat.timeout', {
                connectionId: this.connectionId,
            });
            this.stop();
            this.onTimeout();
        }
    }
}
exports.Heartbeat = Heartbeat;
//# sourceMappingURL=heartbeat.js.map