"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ConnectionManager = void 0;
const uuid_1 = require("uuid");
const heartbeat_1 = require("./heartbeat");
/**
 * Manages WebSocket connections, including initialization, pooling, and heartbeat.
 */
class ConnectionManager {
    constructor(protocolHandler, logger, metrics, options = {}) {
        this.connections = new Map();
        this.pendingConnections = new Set(); // Track pending WebSockets
        this.connectionPool = []; // Pool for reusable connections
        this.protocolHandler = protocolHandler;
        this.logger = logger;
        this.metrics = metrics;
        this.options = {
            heartbeatInterval: options.heartbeatInterval ?? 15000,
            heartbeatTimeout: options.heartbeatTimeout ?? 15000,
            compression: options.compression ?? true,
        };
    }
    /**
     * Initializes WebSocket handling for the server.
     * @param wsServer - WebSocket server instance.
     */
    initialize(wsServer) {
        wsServer.on('connection', (ws) => {
            this.handleOpen(ws);
            ws.on('message', (data, isBinary) => this.handleMessage(ws, data, isBinary));
            ws.on('close', (code, reason) => this.handleClose(ws, code, reason));
            ws.on('error', (error) => {
                this.logger.error('WebSocket error', { error, wsState: ws.readyState });
                this.metrics.increment('connection.error');
            });
        });
        this.logger.info('WebSocket handler initialized');
        this.metrics.increment('connection.manager.initialized');
    }
    /**
     * Returns a copy of the current connections.
     * @returns Map of connection ID to Connection.
     */
    getConnections() {
        return new Map(this.connections);
    }
    /**
     * Handles a new WebSocket connection, reusing from pool if available.
     * @param ws - WebSocket instance.
     */
    async handleOpen(ws) {
        this.pendingConnections.add(ws); // Track pending WebSocket
        this.logger.debug('Pending connection added', { wsState: ws.readyState });
        const connectionId = (0, uuid_1.v4)();
        let connection;
        if (this.connectionPool.length > 0) {
            connection = this.connectionPool.pop();
            connection.ws = ws;
            connection.heartbeat = new heartbeat_1.Heartbeat(this.options.heartbeatInterval, this.options.heartbeatTimeout, () => this.closeConnection(connection.id), this.logger, this.metrics, connection.id);
            this.logger.info(`Reused pooled connection: ${connection.id}`);
            this.metrics.increment('connection.pooled');
        }
        else {
            const heartbeat = new heartbeat_1.Heartbeat(this.options.heartbeatInterval, this.options.heartbeatTimeout, () => this.closeConnection(connectionId), this.logger, this.metrics, connectionId);
            connection = {
                id: connectionId,
                ws,
                heartbeat,
                userId: null,
            };
            this.logger.info(`New connection established: ${connectionId}`);
            this.metrics.increment('connection.opened');
        }
        this.connections.set(connection.id, connection);
        this.pendingConnections.delete(ws); // Remove from pending
        this.logger.debug('Connection registered', {
            connectionId,
            wsState: ws.readyState,
        });
        connection.heartbeat.start(ws);
        this.metrics.gauge('connection.active', this.connections.size);
    }
    /**
     * Handles incoming WebSocket messages.
     * @param ws - WebSocket instance.
     * @param data - Raw message data.
     * @param isBinary - Whether the message is binary.
     */
    async handleMessage(ws, data, isBinary) {
        const connection = Array.from(this.connections.values()).find((c) => c.ws === ws);
        if (!connection) {
            this.logger.warn('Received message for unknown connection', {
                isBinary,
                dataLength: data.length,
                wsState: ws.readyState,
            });
            return;
        }
        try {
            const msg = await this.protocolHandler.parseMessage(data, isBinary);
            connection.heartbeat.messageReceived();
            await this.protocolHandler.processMessage(connection, msg);
            this.metrics.increment(`message.received.${msg.msg}`);
        }
        catch (error) {
            this.logger.error('Failed to process message', {
                error,
                wsState: ws.readyState,
            });
            this.metrics.increment('message.error');
            this.sendError(ws, 'Invalid message', error instanceof Error ? error.message : 'Unknown error');
        }
    }
    /**
     * Handles WebSocket connection closure, returning to pool if reusable.
     * @param ws - WebSocket instance.
     * @param code - Closure code.
     * @param reason - Closure reason.
     */
    async handleClose(ws, code, reason) {
        const connection = Array.from(this.connections.values()).find((c) => c.ws === ws);
        if (!connection && !this.pendingConnections.has(ws)) {
            this.logger.warn('Close event for unknown connection', {
                code,
                reason: reason.toString(),
                wsState: ws.readyState,
            });
            return;
        }
        if (this.pendingConnections.has(ws)) {
            this.logger.debug('Close event for pending connection', {
                code,
                reason: reason.toString(),
                wsState: ws.readyState,
            });
            this.pendingConnections.delete(ws);
            return;
        }
        connection.heartbeat.stop();
        if (code === 1000 && this.connectionPool.length < 1000) {
            // Normal closure, pool limit
            connection.ws = null; // Clear WebSocket to allow reuse
            this.connectionPool.push(connection);
            this.logger.info(`Connection pooled: ${connection.id}`, { code });
            this.metrics.increment('connection.pooled');
        }
        else {
            this.logger.info(`Connection closed: ${connection.id}`, {
                code,
                reason: reason.toString(),
                wsState: ws.readyState,
            });
            this.metrics.increment('connection.closed');
        }
        this.connections.delete(connection.id);
        this.metrics.gauge('connection.active', this.connections.size);
    }
    /**
     * Closes a specific connection.
     * @param connectionId - ID of the connection to close.
     */
    closeConnection(connectionId) {
        const connection = this.connections.get(connectionId);
        if (connection) {
            connection.ws?.close();
            connection.heartbeat.stop();
            this.connections.delete(connectionId);
            this.logger.info(`Connection closed: ${connectionId}`);
            this.metrics.increment('connection.closed');
            this.metrics.gauge('connection.active', this.connections.size);
        }
    }
    /**
     * Closes all connections and clears the pool.
     */
    closeAll() {
        this.connections.forEach((_, id) => this.closeConnection(id));
        this.pendingConnections.clear();
        this.connectionPool = [];
        this.metrics.gauge('connection.active', 0);
    }
    /**
     * Sends an error message to a client.
     * @param ws - WebSocket instance.
     * @param reason - Error reason.
     * @param details - Additional error details.
     */
    sendError(ws, reason, details) {
        const errorMsg = {
            msg: 'error',
            reason,
            details,
        };
        ws.send(JSON.stringify(errorMsg)); // Fallback to JSON for errors
        this.metrics.increment('message.sent.error');
    }
}
exports.ConnectionManager = ConnectionManager;
//# sourceMappingURL=connection-manager.js.map