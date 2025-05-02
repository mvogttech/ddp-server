import { PublicationStrategy } from './publication-strategy';
/**
 * Represents a subscription managed by the DDP server.
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
    params: any[];
    /**
     * Map of documents in the subscription, keyed by `${collection}:${id}`.
     */
    documents: Map<string, Record<string, any>>;
    /**
     * Whether the subscription is ready (i.e., initial data has been sent).
     */
    ready: boolean;
    /**
     * Publication strategy for the subscription.
     */
    strategy: PublicationStrategy;
}
/**
 * Handler function for publication operations.
 */
export type PublishHandler = (params: any[], context: PublishContext) => Promise<Cursor | Cursor[]>;
/**
 * Context provided to publication handlers.
 */
export interface PublishContext {
    /**
     * ID of the authenticated user, if any.
     */
    userId: string | null;
    /**
     * Unique identifier for the connection.
     */
    connectionId: string;
    /**
     * Adds a document to the subscription.
     * @param collection - Name of the collection.
     * @param id - Document ID.
     * @param fields - Document fields.
     */
    added: (collection: string, id: string, fields: Record<string, any>) => void;
    /**
     * Updates a document in the subscription.
     * @param collection - Name of the collection.
     * @param id - Document ID.
     * @param fields - Updated fields.
     */
    changed: (collection: string, id: string, fields: Record<string, any>) => void;
    /**
     * Removes a document from the subscription.
     * @param collection - Name of the collection.
     * @param id - Document ID.
     */
    removed: (collection: string, id: string) => void;
    /**
     * Marks the subscription as ready, triggering a 'ready' message to the client.
     */
    ready: () => void;
}
/**
 * Represents a data cursor for publications, compatible with Meteor's reactive data model.
 */
export interface Cursor {
    /**
     * Publishes the cursor's data to the subscription.
     * @param context - Publish context for sending data.
     */
    _publishCursor: (context: PublishContext) => Promise<void>;
    /**
     * Gets the name of the collection associated with the cursor.
     * @returns Collection name.
     */
    _getCollectionName: () => string;
}
