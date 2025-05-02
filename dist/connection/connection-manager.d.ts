import { Server as WebSocketServer, WebSocket } from 'ws';
import { ProtocolHandler } from '../protocol/protocol-handler';
import { Logger } from '../utils/logger';
import { Metrics } from '../utils/metrics';
import { Heartbeat } from './heartbeat';
/**
 * Manages WebSocket connections, including initialization, pooling, and heartbeat.
 */
export declare class ConnectionManager {
    private connections;
    private pendingConnections;
    private connectionPool;
    private protocolHandler;
    private logger;
    private metrics;
    private options;
    constructor(protocolHandler: ProtocolHandler, logger: Logger, metrics: Metrics, options?: ConnectionOptions);
    /**
     * Initializes WebSocket handling for the server.
     * @param wsServer - WebSocket server instance.
     */
    initialize(wsServer: WebSocketServer): void;
    /**
     * Returns a copy of the current connections.
     * @returns Map of connection ID to Connection.
     */
    getConnections(): Map<string, Connection>;
    /**
     * Handles a new WebSocket connection, reusing from pool if available.
     * @param ws - WebSocket instance.
     */
    private handleOpen;
    /**
     * Handles incoming WebSocket messages.
     * @param ws - WebSocket instance.
     * @param data - Raw message data.
     * @param isBinary - Whether the message is binary.
     */
    private handleMessage;
    /**
     * Handles WebSocket connection closure, returning to pool if reusable.
     * @param ws - WebSocket instance.
     * @param code - Closure code.
     * @param reason - Closure reason.
     */
    private handleClose;
    /**
     * Closes a specific connection.
     * @param connectionId - ID of the connection to close.
     */
    closeConnection(connectionId: string): void;
    /**
     * Closes all connections and clears the pool.
     */
    closeAll(): void;
    /**
     * Sends an error message to a client.
     * @param ws - WebSocket instance.
     * @param reason - Error reason.
     * @param details - Additional error details.
     */
    private sendError;
}
/**
 * Connection options.
 */
interface ConnectionOptions {
    heartbeatInterval?: number;
    heartbeatTimeout?: number;
    compression?: boolean;
}
/**
 * Represents a single WebSocket connection.
 */
interface Connection {
    id: string;
    ws: WebSocket | null;
    heartbeat: Heartbeat;
    userId: string | null;
}
export {};
