/**
 * Defines publication strategies for managing subscription data updates in the DDP server.
 * Strategies control how data is merged, tracked, and sent to clients, balancing performance and resource usage.
 */
export declare const PublicationStrategies: {
    /**
     * Default strategy: Maintains a server-side copy of subscribed data to send deltas across multiple publications.
     * Optimizes bandwidth by sending only changes but uses more server memory.
     */
    readonly SERVER_MERGE: {
        readonly useCollectionView: true;
        readonly useDummyDocumentView: false;
        readonly doAccountingForCollection: true;
    };
    /**
     * Sends all publication data directly to the client without tracking history.
     * Suitable for send-and-forget queues, minimizing server memory but increasing bandwidth.
     */
    readonly NO_MERGE_NO_HISTORY: {
        readonly useCollectionView: false;
        readonly useDummyDocumentView: false;
        readonly doAccountingForCollection: false;
    };
    /**
     * Sends data directly to the client but tracks document IDs to send removals on unsubscribe.
     * Useful for single-publication collections, balancing memory and bandwidth.
     */
    readonly NO_MERGE: {
        readonly useCollectionView: false;
        readonly useDummyDocumentView: false;
        readonly doAccountingForCollection: true;
    };
    /**
     * Tracks documents across multiple publications without diffing, reducing CPU usage compared to SERVER_MERGE.
     * Uses more memory than NO_MERGE but supports overlapping subscriptions.
     */
    readonly NO_MERGE_MULTI: {
        readonly useCollectionView: true;
        readonly useDummyDocumentView: true;
        readonly doAccountingForCollection: true;
    };
};
/**
 * Type representing a publication strategy.
 */
export type PublicationStrategy = (typeof PublicationStrategies)[keyof typeof PublicationStrategies];
/**
 * Interface for publication strategy configuration.
 */
export interface PublicationStrategyConfig {
    /**
     * Whether to use a collection view to track document state and compute deltas.
     */
    useCollectionView: boolean;
    /**
     * Whether to use a dummy document view for tracking multiple publications without diffing.
     */
    useDummyDocumentView: boolean;
    /**
     * Whether to track document IDs for accounting (e.g., sending removals on unsubscribe).
     */
    doAccountingForCollection: boolean;
}
/**
 * Utility class for managing publication strategy logic.
 */
export declare class PublicationStrategyManager {
    private strategies;
    /**
     * Sets the publication strategy for a collection.
     * @param collectionName - Name of the collection.
     * @param strategy - Publication strategy to apply.
     * @throws Error if the strategy is invalid.
     */
    setStrategy(collectionName: string, strategy: PublicationStrategy): void;
    /**
     * Gets the publication strategy for a collection.
     * @param collectionName - Name of the collection.
     * @returns Publication strategy, defaulting to SERVER_MERGE if not set.
     */
    getStrategy(collectionName: string): PublicationStrategy;
    /**
     * Checks if a collection should use a collection view for data tracking.
     * @param collectionName - Name of the collection.
     * @returns True if the collection uses a collection view.
     */
    shouldUseCollectionView(collectionName: string): boolean;
    /**
     * Checks if a collection should track document IDs for accounting.
     * @param collectionName - Name of the collection.
     * @returns True if the collection requires accounting.
     */
    shouldDoAccounting(collectionName: string): boolean;
    /**
     * Checks if a collection should use a dummy document view for multi-publication tracking.
     * @param collectionName - Name of the collection.
     * @returns True if the collection uses a dummy document view.
     */
    shouldUseDummyDocumentView(collectionName: string): boolean;
}
