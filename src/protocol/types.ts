/**
 * Base interface for all DDP messages.
 */
export interface DDPMessage {
  /**
   * Message type (e.g., 'connect', 'sub', 'method', 'ping').
   */
  msg: string;
  /**
   * Optional identifier for the message.
   * This is used for tracking responses to method calls or subscriptions.
   */
  id?: string;
}

/**
 * DDP connect message sent by the client to establish a connection.
 */
export interface ConnectMessage extends DDPMessage {
  /**
   * Message type, always 'connect'.
   */
  msg: 'connect';

  /**
   * DDP protocol version proposed by the client.
   */
  version: string;

  /**
   * Array of DDP versions supported by the client.
   */
  support: string[];
}

/**
 * DDP subscription message sent by the client to subscribe to a publication.
 */
export interface SubMessage extends DDPMessage {
  /**
   * Message type, always 'sub'.
   */
  msg: 'sub';

  /**
   * Unique identifier for the subscription.
   */
  id: string;

  /**
   * Name of the publication to subscribe to.
   */
  name: string;

  /**
   * Optional parameters for the subscription.
   */
  params?: any[];
}

/**
 * DDP unsubscribe message sent by the client to stop a subscription.
 */
export interface UnsubMessage extends DDPMessage {
  /**
   * Message type, always 'unsub'.
   */
  msg: 'unsub';

  /**
   * Identifier of the subscription to unsubscribe from.
   */
  id: string;
}

/**
 * DDP method message sent by the client to invoke a server-side method.
 */
export interface MethodMessage extends DDPMessage {
  /**
   * Message type, always 'method'.
   */
  msg: 'method';

  /**
   * Unique identifier for the method call.
   */
  id: string;

  /**
   * Name of the method to invoke.
   */
  method: string;

  /**
   * Optional parameters for the method.
   */
  params?: any[];
}

/**
 * DDP ping message sent by the server or client to check connection health.
 */
export interface PingMessage extends DDPMessage {
  /**
   * Message type, always 'ping'.
   */
  msg: 'ping';

  /**
   * Optional identifier for the ping message.
   */
  id?: string;
}

/**
 * DDP pong message sent in response to a ping.
 */
export interface PongMessage extends DDPMessage {
  /**
   * Message type, always 'pong'.
   */
  msg: 'pong';

  /**
   * Optional identifier matching the corresponding ping message.
   */
  id?: string;
}

/**
 * DDP connected message sent by the server after a successful connection.
 */
export interface ConnectedMessage extends DDPMessage {
  /**
   * Message type, always 'connected'.
   */
  msg: 'connected';

  /**
   * Session identifier for the connection.
   */
  session: string;
}

/**
 * DDP failed message sent by the server if connection negotiation fails.
 */
export interface FailedMessage extends DDPMessage {
  /**
   * Message type, always 'failed'.
   */
  msg: 'failed';

  /**
   * Suggested DDP version for the client to retry.
   */
  version: string;
}

/**
 * DDP result message sent by the server with the result of a method call.
 */
export interface ResultMessage extends DDPMessage {
  /**
   * Message type, always 'result'.
   */
  msg: 'result';

  /**
   * Identifier of the method call.
   */
  id: string;

  /**
   * Result of the method call, if successful.
   */
  result?: any;

  /**
   * Error details, if the method call failed.
   */
  error?: DDPError;
}

/**
 * DDP error message sent by the server for general errors.
 */
export interface ErrorMessage extends DDPMessage {
  /**
   * Message type, always 'error'.
   */
  msg: 'error';

  /**
   * Reason for the error.
   */
  reason: string;

  /**
   * Additional error details.
   */
  details?: string;
}

/**
 * DDP nosub message sent by the server when a subscription is stopped or not found.
 */
export interface NoSubMessage extends DDPMessage {
  /**
   * Message type, always 'nosub'.
   */
  msg: 'nosub';

  /**
   * Identifier of the subscription.
   */
  id: string;

  /**
   * Error details, if the subscription failed.
   */
  error?: DDPError;
}

/**
 * DDP ready message sent by the server when a subscription is ready.
 */
export interface ReadyMessage extends DDPMessage {
  /**
   * Message type, always 'ready'.
   */
  msg: 'ready';

  /**
   * Array of subscription IDs that are ready.
   */
  subs: string[];
}

/**
 * DDP added message sent by the server to add a document to a subscription.
 */
export interface AddedMessage extends DDPMessage {
  /**
   * Message type, always 'added'.
   */
  msg: 'added';

  /**
   * Name of the collection.
   */
  collection: string;

  /**
   * Document ID.
   */
  id: string;

  /**
   * Document fields.
   */
  fields: Record<string, any>;
}

/**
 * DDP changed message sent by the server to update a document in a subscription.
 */
export interface ChangedMessage extends DDPMessage {
  /**
   * Message type, always 'changed'.
   */
  msg: 'changed';

  /**
   * Name of the collection.
   */
  collection: string;

  /**
   * Document ID.
   */
  id: string;

  /**
   * Updated document fields.
   */
  fields: Record<string, any>;
}

/**
 * DDP removed message sent by the server to remove a document from a subscription.
 */
export interface RemovedMessage extends DDPMessage {
  /**
   * Message type, always 'removed'.
   */
  msg: 'removed';

  /**
   * Name of the collection.
   */
  collection: string;

  /**
   * Document ID.
   */
  id: string;
}

/**
 * Error details included in DDP messages.
 */
export interface DDPError {
  /**
   * Error code (e.g., 400, 404, 500).
   */
  error: number;

  /**
   * Reason for the error.
   */
  reason: string;

  /**
   * Additional error details.
   */
  details?: Record<string, any>;
}

/**
 * Context provided to method handlers.
 */
export interface MethodContext {
  /**
   * ID of the authenticated user, if any.
   */
  userId: string | null;

  /**
   * Unique identifier for the connection.
   */
  connectionId: string;

  /**
   * Function to set the user ID for the connection.
   */
  setUserId: (userId: string | null) => void;
}

/**
 * Context provided to publish handlers.
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
  changed: (
    collection: string,
    id: string,
    fields: Record<string, any>
  ) => void;

  /**
   * Removes a document from the subscription.
   * @param collection - Name of the collection.
   * @param id - Document ID.
   */
  removed: (collection: string, id: string) => void;

  /**
   * Marks the subscription as ready.
   */
  ready: () => void;
}

/**
 * Represents a data cursor for publications.
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
