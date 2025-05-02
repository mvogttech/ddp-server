import { RedisCoordinator } from '../distributed/redis-coordinator';
import { Logger } from '../utils/logger';
import { Metrics } from '../utils/metrics';
import { DDPProtocolError } from '../utils/errors';
import {
  PublicationStrategy,
  PublicationStrategies,
} from './publication-strategy';
import {
  AddedMessage,
  ChangedMessage,
  DDPMessage,
  ReadyMessage,
  RemovedMessage,
} from '../protocol/types';
import { Connection } from '../connection/types';
import { MessageParser } from '../protocol/message-parser';

/**
 * Manages subscriptions and publication strategies for DDP clients.
 */
export class SubscriptionManager {
  private publishHandlers: Map<string, PublishHandler> = new Map();
  private subscriptions: Map<string, Subscription> = new Map();
  private redisCoordinator: RedisCoordinator;
  private logger: Logger;
  private metrics: Metrics;
  private messageParser: MessageParser;
  private connections: Map<string, Connection> = new Map(); // Cache for connection instances
  private collectionViews: Map<string, CollectionView> = new Map(); // Cache for SERVER_MERGE diffing

  constructor(
    redisCoordinator: RedisCoordinator,
    logger: Logger,
    metrics: Metrics,
    messageParser: MessageParser
  ) {
    this.redisCoordinator = redisCoordinator;
    this.logger = logger;
    this.metrics = metrics;
    this.messageParser = messageParser;
  }

  /**
   * Updates the connections cache with the latest connections from ConnectionManager.
   * @param connections - Map of connection ID to Connection.
   */
  updateConnections(connections: Map<string, Connection>): void {
    this.connections = new Map(connections);
    this.logger.debug('Updated connections cache', {
      count: this.connections.size,
    });
  }

  /**
   * Registers a publish handler for a subscription.
   * @param name - Name of the publication.
   * @param handler - Handler function for the publication.
   */
  registerPublishHandler(name: string, handler: PublishHandler): void {
    this.publishHandlers.set(name, handler);
    this.logger.info(`Registered publish handler: ${name}`);
    this.metrics.increment('publish.registered');
  }

  /**
   * Subscribes a client to a publication.
   * @param connection - Client connection.
   * @param subId - Subscription ID.
   * @param name - Publication name.
   * @param params - Subscription parameters.
   */
  async subscribe(
    connection: Connection,
    subId: string,
    name: string,
    params: any[]
  ): Promise<void> {
    const handler = this.publishHandlers.get(name);
    if (!handler) {
      throw new DDPProtocolError(`Publication ${name} not found`);
    }

    const subscription: Subscription = {
      id: subId,
      connectionId: connection.id,
      name,
      params,
      documents: new Map(),
      ready: false,
      strategy: PublicationStrategies.SERVER_MERGE, // Default strategy
    };

    this.subscriptions.set(subId, subscription);
    this.connections.set(connection.id, connection); // Cache connection
    try {
      await this.redisCoordinator.registerSubscription(subscription);
    } catch (error) {
      this.logger.error(`Failed to register subscription: ${name}`, {
        error,
        subscription,
      });
      this.metrics.increment('subscription.redis.error');
      throw new DDPProtocolError(`Failed to register subscription: ${name}`, {
        cause: error,
      });
    }

    const context: PublishContext = {
      userId: connection.userId,
      connectionId: connection.id,
      added: (collection, id, fields) =>
        this.handleAdded(subscription, collection, id, fields),
      changed: (collection, id, fields) =>
        this.handleChanged(subscription, collection, id, fields),
      removed: (collection, id) =>
        this.handleRemoved(subscription, collection, id),
      ready: () => this.handleReady(subscription),
    };

    try {
      const result = await handler(params, context);
      await this.processPublishResult(subscription, result);
    } catch (error) {
      this.logger.error(`Publish failed: ${name}`, { error });
      this.metrics.increment('subscription.publish.error');
      throw new DDPProtocolError(`Publish failed: ${name}`, { cause: error });
    }
  }

  /**
   * Unsubscribes a client from a publication.
   * @param connection - Client connection.
   * @param subId - Subscription ID.
   */
  async unsubscribe(connection: Connection, subId: string): Promise<void> {
    const subscription = this.subscriptions.get(subId);
    if (!subscription || subscription.connectionId !== connection.id) {
      return;
    }

    try {
      await this.redisCoordinator.unregisterSubscription(subId);
    } catch (error) {
      this.logger.error(`Failed to unregister subscription: ${subId}`, {
        error,
      });
      this.metrics.increment('subscription.redis.error');
    }
    this.subscriptions.delete(subId);
    this.logger.info(`Unsubscribed: ${subId}`);
    this.metrics.increment('subscription.unsubscribed');
  }

  /**
   * Sets the publication strategy for a collection.
   * @param collectionName - Name of the collection.
   * @param strategy - Publication strategy to use.
   */
  setPublicationStrategy(
    collectionName: string,
    strategy: PublicationStrategy
  ): void {
    this.logger.info(
      `Set publication strategy for ${collectionName}: ${JSON.stringify(strategy)}`
    );
  }

  /**
   * Handles added documents for a subscription.
   * @param subscription - Subscription instance.
   * @param collection - Collection name.
   * @param id - Document ID.
   * @param fields - Document fields.
   */
  private handleAdded(
    subscription: Subscription,
    collection: string,
    id: string,
    fields: Record<string, any>
  ): void {
    if (subscription.strategy.useCollectionView) {
      const view = this.getCollectionView(collection);
      view.add(subscription.id, id, fields);
      const diffMessage = view.diff(id, fields);
      this.sendMessage(subscription.connectionId, diffMessage);
    } else {
      subscription.documents.set(`${collection}:${id}`, fields);
      this.sendMessage(subscription.connectionId, {
        msg: 'added',
        collection,
        id,
        fields,
      });
    }
    this.metrics.increment('subscription.document.added');
  }

  /**
   * Handles changed documents for a subscription.
   * @param subscription - Subscription instance.
   * @param collection - Collection name.
   * @param id - Document ID.
   * @param fields - Updated fields.
   */
  private handleChanged(
    subscription: Subscription,
    collection: string,
    id: string,
    fields: Record<string, any>
  ): void {
    if (subscription.strategy.useCollectionView) {
      const view = this.getCollectionView(collection);
      view.update(subscription.id, id, fields);
      const diffMessage = view.diff(id, fields);
      this.sendMessage(subscription.connectionId, diffMessage);
    } else {
      subscription.documents.set(`${collection}:${id}`, {
        ...subscription.documents.get(`${collection}:${id}`),
        ...fields,
      });
      this.sendMessage(subscription.connectionId, {
        msg: 'changed',
        collection,
        id,
        fields,
      });
    }
    this.metrics.increment('subscription.document.changed');
  }

  /**
   * Handles removed documents for a subscription.
   * @param subscription - Subscription instance.
   * @param collection - Collection name.
   * @param id - Document ID.
   */
  private handleRemoved(
    subscription: Subscription,
    collection: string,
    id: string
  ): void {
    if (subscription.strategy.useCollectionView) {
      const view = this.getCollectionView(collection);
      view.remove(subscription.id, id);
      this.sendMessage(subscription.connectionId, {
        msg: 'removed',
        collection,
        id,
      });
    } else {
      subscription.documents.delete(`${collection}:${id}`);
      this.sendMessage(subscription.connectionId, {
        msg: 'removed',
        collection,
        id,
      });
    }
    this.metrics.increment('subscription.document.removed');
  }

  /**
   * Handles subscription ready state.
   * @param subscription - Subscription instance.
   */
  private handleReady(subscription: Subscription): void {
    if (!subscription.ready) {
      subscription.ready = true;
      this.sendMessage(subscription.connectionId, {
        msg: 'ready',
        subs: [subscription.id],
      });
      this.metrics.increment('subscription.ready');
    }
  }

  /**
   * Processes the result of a publish handler.
   * @param subscription - Subscription instance.
   * @param result - Result from the publish handler.
   */
  private async processPublishResult(
    subscription: Subscription,
    result: Cursor | Cursor[]
  ): Promise<void> {
    if (Array.isArray(result)) {
      await Promise.all(
        result.map((cursor) =>
          cursor._publishCursor(this.createPublishContext(subscription))
        )
      );
    } else if (result && result._publishCursor) {
      await result._publishCursor(this.createPublishContext(subscription));
    } else if (result) {
      throw new DDPProtocolError(
        'Publish handler must return a Cursor or array of Cursors'
      );
    }
    this.handleReady(subscription);
  }

  /**
   * Creates a publish context for a subscription.
   * @param subscription - Subscription instance.
   * @returns Publish context.
   */
  private createPublishContext(subscription: Subscription): PublishContext {
    const connection = this.connections.get(subscription.connectionId);
    return {
      userId: connection?.userId ?? null,
      connectionId: subscription.connectionId,
      added: (collection, id, fields) =>
        this.handleAdded(subscription, collection, id, fields),
      changed: (collection, id, fields) =>
        this.handleChanged(subscription, collection, id, fields),
      removed: (collection, id) =>
        this.handleRemoved(subscription, collection, id),
      ready: () => this.handleReady(subscription),
    };
  }

  /**
   * Sends a message to a client, using batching for efficiency.
   * @param connectionId - Connection ID.
   * @param message - Message to send.
   */
  private sendMessage(
    connectionId: string,
    message:
      | DDPMessage
      | AddedMessage
      | ChangedMessage
      | RemovedMessage
      | ReadyMessage
  ): void {
    const connection = this.connections.get(connectionId);
    if (!connection || !connection.ws) {
      this.logger.warn(`Cannot send message to connection: ${connectionId}`);
      return;
    }

    this.messageParser.bufferMessage(message, (data) =>
      connection.ws!.send(data)
    );
    this.logger.debug(`Sent message to connection: ${connectionId}`, {
      msg: message.msg,
    });
  }

  /**
   * Gets or creates a collection view for SERVER_MERGE diffing.
   * @param collectionName - Name of the collection.
   * @returns Collection view instance.
   * @private
   */
  private getCollectionView(collectionName: string): CollectionView {
    let view = this.collectionViews.get(collectionName);
    if (!view) {
      view = new CollectionView(collectionName);
      this.collectionViews.set(collectionName, view);
    }
    return view;
  }
}

/**
 * Handler function for publish operations.
 */
type PublishHandler = (
  params: any[],
  context: PublishContext
) => Promise<Cursor | Cursor[]>;

/**
 * Context provided to publish handlers.
 */
interface PublishContext {
  userId: string | null;
  connectionId: string;
  added: (collection: string, id: string, fields: Record<string, any>) => void;
  changed: (
    collection: string,
    id: string,
    fields: Record<string, any>
  ) => void;
  removed: (collection: string, id: string) => void;
  ready: () => void;
}

/**
 * Represents a subscription.
 */
interface Subscription {
  id: string;
  connectionId: string;
  name: string;
  params: any[];
  documents: Map<string, Record<string, any>>;
  ready: boolean;
  strategy: PublicationStrategy;
}

/**
 * Represents a data cursor for publications.
 */
interface Cursor {
  _publishCursor: (context: PublishContext) => Promise<void>;
  _getCollectionName: () => string;
}

/**
 * Manages incremental diffing for SERVER_MERGE strategy.
 */
class CollectionView {
  private collectionName: string;
  private documents: Map<string, Record<string, any>> = new Map(); // Document state
  private subscriptions: Map<string, Set<string>> = new Map(); // Subscription to document IDs

  constructor(collectionName: string) {
    this.collectionName = collectionName;
  }

  /**
   * Adds a document to the view.
   * @param subId - Subscription ID.
   * @param id - Document ID.
   * @param fields - Document fields.
   */
  add(subId: string, id: string, fields: Record<string, any>): void {
    this.documents.set(id, fields);
    let subDocs = this.subscriptions.get(subId);
    if (!subDocs) {
      subDocs = new Set();
      this.subscriptions.set(subId, subDocs);
    }
    subDocs.add(id);
  }

  /**
   * Updates a document in the view, computing incremental diff.
   * @param subId - Subscription ID.
   * @param id - Document ID.
   * @param fields - Updated fields.
   */
  update(subId: string, id: string, fields: Record<string, any>): void {
    const current = this.documents.get(id) || {};
    this.documents.set(id, { ...current, ...fields });
  }

  /**
   * Removes a document from the view.
   * @param subId - Subscription ID.
   * @param id - Document ID.
   */
  remove(subId: string, id: string): void {
    const subDocs = this.subscriptions.get(subId);
    if (subDocs) {
      subDocs.delete(id);
      if (subDocs.size === 0) {
        this.subscriptions.delete(subId);
      }
    }
    if (!Array.from(this.subscriptions.values()).some((docs) => docs.has(id))) {
      this.documents.delete(id);
    }
  }

  /**
   * Computes the incremental diff for a document update.
   * @param id - Document ID.
   * @param newFields - New fields.
   * @returns DDP message with the diff.
   */
  diff(
    id: string,
    newFields: Record<string, any>
  ): AddedMessage | ChangedMessage {
    const current = this.documents.get(id) || {};
    const changedFields: Record<string, any> = {};
    for (const [key, value] of Object.entries(newFields)) {
      if (current[key] !== value) {
        changedFields[key] = value;
      }
    }
    const message = {
      msg: Object.keys(changedFields).length > 0 ? 'changed' : 'added',
      collection: this.collectionName,
      id,
      fields: Object.keys(changedFields).length > 0 ? changedFields : newFields,
    };
    return message;
  }
}
