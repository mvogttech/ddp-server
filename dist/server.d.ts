/**
 * Main DDP server class responsible for initializing and managing the WebSocket server,
 * connection handling, protocol processing, and subscription management, with clustering support.
 */
export declare class DDPServer {
    private httpServer;
    private wsServer;
    private connectionManager;
    private protocolHandler;
    private messageParser;
    private subscriptionManager;
    private redisCoordinator;
    private logger;
    private metrics;
    private isWorker;
    constructor(options?: DDPServerOptions);
    /**
     * Starts the DDP server and listens for WebSocket connections.
     * @param port - Port to listen on (default: 3000).
     * @returns Promise that resolves when the server is listening.
     */
    start(port?: number): Promise<void>;
    /**
     * Registers a publish handler for a named subscription.
     * @param name - Name of the publication.
     * @param handler - Function to handle subscription data.
     */
    publish(name: string, handler: PublishHandler): void;
    /**
     * Registers a method handler for a remote procedure call.
     * @param name - Name of the method.
     * @param handler - Function to handle method execution.
     */
    method(name: string, handler: MethodHandler): void;
    /**
     * Stops the DDP server and cleans up resources.
     * @returns Promise that resolves when the server is stopped.
     */
    stop(): Promise<void>;
}
/**
 * Configuration options for the DDP server.
 */
export interface DDPServerOptions {
    heartbeatInterval?: number;
    heartbeatTimeout?: number;
    compression?: boolean;
    enableClustering?: boolean;
}
/**
 * Handler function for publish operations.
 */
type PublishHandler = (params: any[], context: PublishContext) => Promise<Cursor | Cursor[]>;
/**
 * Handler function for method operations.
 */
type MethodHandler = (params: any[], context: MethodContext) => Promise<any>;
/**
 * Context provided to publish handlers.
 */
interface PublishContext {
    userId: string | null;
    connectionId: string;
    added: (collection: string, id: string, fields: Record<string, any>) => void;
    changed: (collection: string, id: string, fields: Record<string, any>) => void;
    removed: (collection: string, id: string) => void;
    ready: () => void;
}
/**
 * Context provided to method handlers.
 */
interface MethodContext {
    userId: string | null;
    connectionId: string;
    setUserId: (userId: string | null) => void;
}
/**
 * Represents a data cursor for publications.
 */
interface Cursor {
    _publishCursor: (context: PublishContext) => Promise<void>;
    _getCollectionName: () => string;
}
export {};
