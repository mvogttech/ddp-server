"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.PublicationStrategyManager = exports.PublicationStrategies = void 0;
/**
 * Defines publication strategies for managing subscription data updates in the DDP server.
 * Strategies control how data is merged, tracked, and sent to clients, balancing performance and resource usage.
 */
exports.PublicationStrategies = {
    /**
     * Default strategy: Maintains a server-side copy of subscribed data to send deltas across multiple publications.
     * Optimizes bandwidth by sending only changes but uses more server memory.
     */
    SERVER_MERGE: {
        useCollectionView: true,
        useDummyDocumentView: false,
        doAccountingForCollection: true,
    },
    /**
     * Sends all publication data directly to the client without tracking history.
     * Suitable for send-and-forget queues, minimizing server memory but increasing bandwidth.
     */
    NO_MERGE_NO_HISTORY: {
        useCollectionView: false,
        useDummyDocumentView: false,
        doAccountingForCollection: false,
    },
    /**
     * Sends data directly to the client but tracks document IDs to send removals on unsubscribe.
     * Useful for single-publication collections, balancing memory and bandwidth.
     */
    NO_MERGE: {
        useCollectionView: false,
        useDummyDocumentView: false,
        doAccountingForCollection: true,
    },
    /**
     * Tracks documents across multiple publications without diffing, reducing CPU usage compared to SERVER_MERGE.
     * Uses more memory than NO_MERGE but supports overlapping subscriptions.
     */
    NO_MERGE_MULTI: {
        useCollectionView: true,
        useDummyDocumentView: true,
        doAccountingForCollection: true,
    },
};
/**
 * Utility class for managing publication strategy logic.
 */
class PublicationStrategyManager {
    constructor() {
        this.strategies = new Map();
    }
    /**
     * Sets the publication strategy for a collection.
     * @param collectionName - Name of the collection.
     * @param strategy - Publication strategy to apply.
     * @throws Error if the strategy is invalid.
     */
    setStrategy(collectionName, strategy) {
        if (!Object.values(exports.PublicationStrategies).includes(strategy)) {
            throw new Error(`Invalid publication strategy for collection ${collectionName}`);
        }
        this.strategies.set(collectionName, strategy);
    }
    /**
     * Gets the publication strategy for a collection.
     * @param collectionName - Name of the collection.
     * @returns Publication strategy, defaulting to SERVER_MERGE if not set.
     */
    getStrategy(collectionName) {
        return (this.strategies.get(collectionName) || exports.PublicationStrategies.SERVER_MERGE);
    }
    /**
     * Checks if a collection should use a collection view for data tracking.
     * @param collectionName - Name of the collection.
     * @returns True if the collection uses a collection view.
     */
    shouldUseCollectionView(collectionName) {
        return this.getStrategy(collectionName).useCollectionView;
    }
    /**
     * Checks if a collection should track document IDs for accounting.
     * @param collectionName - Name of the collection.
     * @returns True if the collection requires accounting.
     */
    shouldDoAccounting(collectionName) {
        return this.getStrategy(collectionName).doAccountingForCollection;
    }
    /**
     * Checks if a collection should use a dummy document view for multi-publication tracking.
     * @param collectionName - Name of the collection.
     * @returns True if the collection uses a dummy document view.
     */
    shouldUseDummyDocumentView(collectionName) {
        return this.getStrategy(collectionName).useDummyDocumentView;
    }
}
exports.PublicationStrategyManager = PublicationStrategyManager;
//# sourceMappingURL=publication-strategy.js.map