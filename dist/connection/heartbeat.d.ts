import { WebSocket } from 'ws';
import { Logger } from '../utils/logger';
import { Metrics } from '../utils/metrics';
/**
 * Manages heartbeat functionality for a WebSocket connection, sending pings and
 * monitoring pong responses to ensure connection health.
 */
export declare class Heartbeat {
    private connectionId;
    private ws;
    private intervalMs;
    private timeoutMs;
    private onTimeout;
    private logger;
    private metrics;
    private pingTimer;
    private timeoutTimer;
    private lastPong;
    /**
     * Constructs a new Heartbeat instance.
     * @param intervalMs - Interval between ping messages (in milliseconds).
     * @param timeoutMs - Timeout for receiving a pong response (in milliseconds).
     * @param onTimeout - Callback to invoke when the connection times out.
     * @param logger - Logger instance for logging events.
     * @param metrics - Metrics instance for collecting metrics.
     * @param connectionId - Unique identifier for the connection.
     */
    constructor(intervalMs: number, timeoutMs: number, onTimeout: () => void, logger: Logger, metrics: Metrics, connectionId: string);
    /**
     * Starts the heartbeat mechanism for a WebSocket connection.
     * @param ws - WebSocket instance to monitor.
     */
    start(ws: WebSocket): void;
    /**
     * Stops the heartbeat mechanism and clears timers.
     */
    stop(): void;
    /**
     * Records a received message (pong or other) to reset the timeout.
     */
    messageReceived(): void;
    /**
     * Sends a ping message to the client.
     * @private
     */
    private sendPing;
    /**
     * Checks if the connection has timed out based on the last pong received.
     * @private
     */
    private checkTimeout;
}
