"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.ProtocolHandler = void 0;
const cbor_x_1 = require("cbor-x");
const errors_1 = require("../utils/errors");
/**
 * Handles DDP protocol messages, including parsing, validation, and processing.
 */
class ProtocolHandler {
    constructor(subscriptionManager, logger, metrics) {
        this.methodHandlers = new Map();
        this.subscriptionManager = subscriptionManager;
        this.logger = logger;
        this.metrics = metrics;
    }
    /**
     * Handles incoming WebSocket messages, buffering them for processing.
     * @param connection - The client connection.
     * @param message - Raw message data.
     * @param isBinary - Whether the message is binary.
     * @returns Promise that resolves when the message is buffered.
     */
    async bufferMessage(connection, message, isBinary) {
        this.logger.debug('Buffering message', { connectionId: connection.id });
        this.metrics.increment('message.buffered');
        try {
            const parsedMessage = await this.parseMessage(message, isBinary);
            await this.processMessage(connection, parsedMessage);
        }
        catch (error) {
            this.logger.error('Failed to buffer message', { error });
            this.metrics.increment('message.buffer.error');
        }
    }
    /**
     * Parses an incoming WebSocket message.
     * @param message - Raw message data.
     * @param isBinary - Whether the message is binary.
     * @returns Parsed DDP message.
     */
    async parseMessage(message, isBinary) {
        try {
            const data = isBinary
                ? (0, cbor_x_1.decode)(new Uint8Array(message))
                : JSON.parse(new TextDecoder().decode(message));
            if (!data.msg) {
                throw new errors_1.DDPProtocolError('Message missing "msg" field');
            }
            this.logger.debug('Parsed message', { msg: data.msg });
            return data;
        }
        catch (error) {
            this.logger.error('Failed to parse message', { error });
            this.metrics.increment('message.parse.error');
            throw new errors_1.DDPProtocolError('Invalid message format', { cause: error });
        }
    }
    /**
     * Processes a DDP message for a connection.
     * @param connection - The client connection.
     * @param msg - The DDP message to process.
     */
    async processMessage(connection, msg) {
        this.logger.debug(`Processing message: ${msg.msg}`, {
            connectionId: connection.id,
        });
        this.metrics.increment(`message.processed.${msg.msg}`);
        switch (msg.msg) {
            case 'connect':
                await this.handleConnect(connection, msg);
                break;
            case 'sub':
                await this.handleSub(connection, msg);
                break;
            case 'unsub':
                await this.handleUnsub(connection, msg);
                break;
            case 'method':
                await this.handleMethod(connection, msg);
                break;
            case 'ping':
                await this.handlePing(connection, msg);
                break;
            case 'pong':
                // No-op, handled by heartbeat
                break;
            default:
                throw new errors_1.DDPProtocolError(`Unsupported message type: ${msg.msg}`);
        }
    }
    /**
     * Registers a method handler.
     * @param name - Method name.
     * @param handler - Method handler function.
     */
    registerMethodHandler(name, handler) {
        this.methodHandlers.set(name, handler);
        this.logger.info(`Registered method: ${name}`);
    }
    /**
     * Handles a connect message.
     * @param connection - The client connection.
     * @param msg - Connect message.
     */
    async handleConnect(connection, msg) {
        if (!msg.version || !Array.isArray(msg.support)) {
            connection.ws.send((0, cbor_x_1.encode)({ msg: 'failed', version: '1.0' }));
            connection.ws.close();
            throw new errors_1.DDPProtocolError('Invalid connect message');
        }
        const version = this.calculateVersion(msg.support, ['1.0']);
        if (msg.version !== version) {
            connection.ws.send((0, cbor_x_1.encode)({ msg: 'failed', version }));
            connection.ws.close();
            return;
        }
        connection.ws.send((0, cbor_x_1.encode)({ msg: 'connected', session: connection.id }));
        this.logger.info(`Connection established: ${connection.id}`, { version });
        this.metrics.increment('connection.connected');
    }
    /**
     * Handles a subscription message.
     * @param connection - The client connection.
     * @param msg - Subscription message.
     */
    async handleSub(connection, msg) {
        if (typeof msg.id !== 'string' ||
            typeof msg.name !== 'string' ||
            (msg.params && !Array.isArray(msg.params))) {
            connection.ws.send((0, cbor_x_1.encode)({
                msg: 'nosub',
                id: msg.id,
                error: { error: 400, reason: 'Invalid subscription' },
            }));
            throw new errors_1.DDPProtocolError('Invalid subscription message');
        }
        try {
            await this.subscriptionManager.subscribe(connection, msg.id, msg.name, msg.params ?? []);
            this.logger.info(`Subscribed: ${msg.name}`, {
                connectionId: connection.id,
                subId: msg.id,
            });
        }
        catch (error) {
            connection.ws.send((0, cbor_x_1.encode)({
                msg: 'nosub',
                id: msg.id,
                error: { error: 404, reason: `Subscription ${msg.name} not found` },
            }));
            this.logger.error(`Subscription failed: ${msg.name}`, { error });
            this.metrics.increment('subscription.error');
        }
    }
    /**
     * Handles an unsubscribe message.
     * @param connection - The client connection.
     * @param msg - Unsubscribe message.
     */
    async handleUnsub(connection, msg) {
        await this.subscriptionManager.unsubscribe(connection, msg.id);
        connection.ws.send((0, cbor_x_1.encode)({ msg: 'nosub', id: msg.id }));
        this.logger.info(`Unsubscribed: ${msg.id}`, {
            connectionId: connection.id,
        });
        this.metrics.increment('subscription.unsubscribed');
    }
    /**
     * Handles a method call message.
     * @param connection - The client connection.
     * @param msg - Method message.
     */
    async handleMethod(connection, msg) {
        if (typeof msg.id !== 'string' ||
            typeof msg.method !== 'string' ||
            (msg.params && !Array.isArray(msg.params))) {
            connection.ws.send((0, cbor_x_1.encode)({
                msg: 'result',
                id: msg.id,
                error: { error: 400, reason: 'Invalid method' },
            }));
            throw new errors_1.DDPProtocolError('Invalid method message');
        }
        const handler = this.methodHandlers.get(msg.method);
        if (!handler) {
            connection.ws.send((0, cbor_x_1.encode)({
                msg: 'result',
                id: msg.id,
                error: { error: 404, reason: `Method ${msg.method} not found` },
            }));
            return;
        }
        try {
            const result = await handler(msg.params ?? [], {
                userId: connection.userId,
                connectionId: connection.id,
                setUserId: (userId) => (connection.userId = userId),
            });
            connection.ws.send((0, cbor_x_1.encode)({ msg: 'result', id: msg.id, result }));
            this.logger.info(`Method executed: ${msg.method}`, {
                connectionId: connection.id,
            });
            this.metrics.increment('method.executed');
        }
        catch (error) {
            connection.ws.send((0, cbor_x_1.encode)({
                msg: 'result',
                id: msg.id,
                error: {
                    error: 500,
                    reason: error instanceof Error && error.message
                        ? error.message
                        : 'Internal server error',
                },
            }));
            this.logger.error(`Method failed: ${msg.method}`, { error });
            this.metrics.increment('method.error');
        }
    }
    /**
     * Handles a ping message.
     * @param connection - The client connection.
     * @param msg - Ping message.
     */
    async handlePing(connection, msg) {
        connection.ws.send((0, cbor_x_1.encode)({ msg: 'pong', id: msg.id }));
        this.metrics.increment('message.sent.pong');
    }
    /**
     * Calculates the best DDP version based on client and server support.
     * @param clientVersions - Versions supported by the client.
     * @param serverVersions - Versions supported by the server.
     * @returns Best matching version.
     */
    calculateVersion(clientVersions, serverVersions) {
        const match = clientVersions.find((v) => serverVersions.includes(v));
        return match || serverVersions[0];
    }
}
exports.ProtocolHandler = ProtocolHandler;
//# sourceMappingURL=protocol-handler.js.map