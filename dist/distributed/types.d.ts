/**
 * Represents a subscription stored in Redis for distributed coordination.
 */
export interface Subscription {
    /**
     * Unique identifier for the subscription.
     */
    id: string;
    /**
     * Unique identifier for the connection associated with the subscription.
     */
    connectionId: string;
    /**
     * Name of the publication.
     */
    name: string;
    /**
     * Parameters for the subscription.
     */
    params: unknown[];
}
/**
 * Represents a pub/sub event published to the Redis subscriptions channel.
 */
export interface SubscriptionEvent {
    /**
     * Action type for the event (e.g., 'register', 'unregister').
     */
    action: 'register' | 'unregister';
    /**
     * Subscription data for 'register' events, or subscription ID for 'unregister' events.
     */
    subscription?: Subscription;
    /**
     * Subscription ID for 'unregister' events.
     */
    subId?: string;
}
