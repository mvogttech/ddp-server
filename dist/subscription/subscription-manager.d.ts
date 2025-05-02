import { RedisCoordinator } from '../distributed/redis-coordinator';
import { Logger } from '../utils/logger';
import { Metrics } from '../utils/metrics';
import { PublicationStrategy } from './publication-strategy';
import { Connection } from '../connection/types';
import { MessageParser } from '../protocol/message-parser';
/**
 * Manages subscriptions and publication strategies for DDP clients.
 */
export declare class SubscriptionManager {
    private publishHandlers;
    private subscriptions;
    private redisCoordinator;
    private logger;
    private metrics;
    private messageParser;
    private connections;
    private collectionViews;
    constructor(redisCoordinator: RedisCoordinator, logger: Logger, metrics: Metrics, messageParser: MessageParser);
    /**
     * Updates the connections cache with the latest connections from ConnectionManager.
     * @param connections - Map of connection ID to Connection.
     */
    updateConnections(connections: Map<string, Connection>): void;
    /**
     * Registers a publish handler for a subscription.
     * @param name - Name of the publication.
     * @param handler - Handler function for the publication.
     */
    registerPublishHandler(name: string, handler: PublishHandler): void;
    /**
     * Subscribes a client to a publication.
     * @param connection - Client connection.
     * @param subId - Subscription ID.
     * @param name - Publication name.
     * @param params - Subscription parameters.
     */
    subscribe(connection: Connection, subId: string, name: string, params: any[]): Promise<void>;
    /**
     * Unsubscribes a client from a publication.
     * @param connection - Client connection.
     * @param subId - Subscription ID.
     */
    unsubscribe(connection: Connection, subId: string): Promise<void>;
    /**
     * Sets the publication strategy for a collection.
     * @param collectionName - Name of the collection.
     * @param strategy - Publication strategy to use.
     */
    setPublicationStrategy(collectionName: string, strategy: PublicationStrategy): void;
    /**
     * Handles added documents for a subscription.
     * @param subscription - Subscription instance.
     * @param collection - Collection name.
     * @param id - Document ID.
     * @param fields - Document fields.
     */
    private handleAdded;
    /**
     * Handles changed documents for a subscription.
     * @param subscription - Subscription instance.
     * @param collection - Collection name.
     * @param id - Document ID.
     * @param fields - Updated fields.
     */
    private handleChanged;
    /**
     * Handles removed documents for a subscription.
     * @param subscription - Subscription instance.
     * @param collection - Collection name.
     * @param id - Document ID.
     */
    private handleRemoved;
    /**
     * Handles subscription ready state.
     * @param subscription - Subscription instance.
     */
    private handleReady;
    /**
     * Processes the result of a publish handler.
     * @param subscription - Subscription instance.
     * @param result - Result from the publish handler.
     */
    private processPublishResult;
    /**
     * Creates a publish context for a subscription.
     * @param subscription - Subscription instance.
     * @returns Publish context.
     */
    private createPublishContext;
    /**
     * Sends a message to a client, using batching for efficiency.
     * @param connectionId - Connection ID.
     * @param message - Message to send.
     */
    private sendMessage;
    /**
     * Gets or creates a collection view for SERVER_MERGE diffing.
     * @param collectionName - Name of the collection.
     * @returns Collection view instance.
     * @private
     */
    private getCollectionView;
}
/**
 * Handler function for publish operations.
 */
type PublishHandler = (params: any[], context: PublishContext) => Promise<Cursor | Cursor[]>;
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
 * Represents a data cursor for publications.
 */
interface Cursor {
    _publishCursor: (context: PublishContext) => Promise<void>;
    _getCollectionName: () => string;
}
export {};
