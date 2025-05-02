import { SubscriptionManager } from '../subscription/subscription-manager';
import { Logger } from '../utils/logger';
import { Metrics } from '../utils/metrics';
import { DDPMessage } from './types';
import { Connection } from '../connection/types';
/**
 * Handles DDP protocol messages, including parsing, validation, and processing.
 */
export declare class ProtocolHandler {
    private subscriptionManager;
    private logger;
    private metrics;
    private methodHandlers;
    constructor(subscriptionManager: SubscriptionManager, logger: Logger, metrics: Metrics);
    /**
     * Handles incoming WebSocket messages, buffering them for processing.
     * @param connection - The client connection.
     * @param message - Raw message data.
     * @param isBinary - Whether the message is binary.
     * @returns Promise that resolves when the message is buffered.
     */
    bufferMessage(connection: Connection, message: ArrayBuffer, isBinary: boolean): Promise<void>;
    /**
     * Parses an incoming WebSocket message.
     * @param message - Raw message data.
     * @param isBinary - Whether the message is binary.
     * @returns Parsed DDP message.
     */
    parseMessage(message: ArrayBuffer, isBinary: boolean): Promise<DDPMessage>;
    /**
     * Processes a DDP message for a connection.
     * @param connection - The client connection.
     * @param msg - The DDP message to process.
     */
    processMessage(connection: Connection, msg: any): Promise<void>;
    /**
     * Registers a method handler.
     * @param name - Method name.
     * @param handler - Method handler function.
     */
    registerMethodHandler(name: string, handler: MethodHandler): void;
    /**
     * Handles a connect message.
     * @param connection - The client connection.
     * @param msg - Connect message.
     */
    private handleConnect;
    /**
     * Handles a subscription message.
     * @param connection - The client connection.
     * @param msg - Subscription message.
     */
    private handleSub;
    /**
     * Handles an unsubscribe message.
     * @param connection - The client connection.
     * @param msg - Unsubscribe message.
     */
    private handleUnsub;
    /**
     * Handles a method call message.
     * @param connection - The client connection.
     * @param msg - Method message.
     */
    private handleMethod;
    /**
     * Handles a ping message.
     * @param connection - The client connection.
     * @param msg - Ping message.
     */
    private handlePing;
    /**
     * Calculates the best DDP version based on client and server support.
     * @param clientVersions - Versions supported by the client.
     * @param serverVersions - Versions supported by the server.
     * @returns Best matching version.
     */
    private calculateVersion;
}
/**
 * Handler function for method operations.
 */
type MethodHandler = (params: any[], context: MethodContext) => Promise<any>;
/**
 * Context provided to method handlers.
 */
interface MethodContext {
    userId: string | null;
    connectionId: string;
    setUserId: (userId: string | null) => void;
}
export {};
