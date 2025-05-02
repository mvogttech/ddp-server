import { Logger } from '../utils/logger';
import { Metrics } from '../utils/metrics';
/**
 * Coordinates subscription state across multiple server instances using Redis pub/sub.
 */
export declare class RedisCoordinator {
    private client;
    private subscriber;
    private logger;
    private metrics;
    private isConnected;
    /**
     * Constructs a new RedisCoordinator instance.
     * @param logger - Logger instance for logging Redis events.
     * @param metrics - Metrics instance for collecting Redis metrics.
     */
    constructor(logger: Logger, metrics: Metrics);
    /**
     * Connects to Redis and sets up pub/sub.
     * @returns Promise that resolves when connected.
     */
    connect(): Promise<void>;
    /**
     * Disconnects from Redis.
     * @returns Promise that resolves when disconnected.
     */
    disconnect(): Promise<void>;
    /**
     * Registers a subscription in Redis.
     * @param subscription - Subscription to register.
     */
    registerSubscription(subscription: Subscription): Promise<void>;
    /**
     * Unregisters a subscription from Redis.
     * @param subId - Subscription ID.
     */
    unregisterSubscription(subId: string): Promise<void>;
}
/**
 * Represents a subscription.
 */
interface Subscription {
    /**
     * Unique identifier for the subscription.
     */
    id: string;
    /**
     * Unique identifier for the connection.
     */
    connectionId: string;
    /**
     * Name of the publication.
     */
    name: string;
    /**
     * Parameters for the subscription.
     */
    params: any[];
}
export {};
