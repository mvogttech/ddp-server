import { DDPServer, DDPServerOptions } from './server';
import { DDPMessage, ConnectMessage, SubMessage, UnsubMessage, MethodMessage, PingMessage, PongMessage, ConnectedMessage, FailedMessage, ResultMessage, ErrorMessage, NoSubMessage, ReadyMessage, AddedMessage, ChangedMessage, RemovedMessage, DDPError, MethodContext, PublishContext, Cursor } from './protocol/types';
import { PublicationStrategies, PublicationStrategy, PublicationStrategyManager } from './subscription/publication-strategy';
import { Subscription, PublishHandler } from './subscription/types';
/**
 * The main DDP server implementation for Meteor.js, providing a high-performance,
 * scalable, and type-safe way to handle real-time data subscriptions and method calls.
 *
 * @example
 * ```typescript
 * import { DDPServer, PublicationStrategies } from '@meteor/ddp-server';
 *
 * const server = new DDPServer({ heartbeatInterval: 15000 });
 *
 * server.publish('posts', async (params, context) => {
 *   return Posts.find({});
 * });
 *
 * server.method('createPost', async ([content], context) => {
 *   return Posts.insert({ content, userId: context.userId });
 * });
 *
 * await server.start(3000);
 * ```
 */
export { DDPServer, DDPServerOptions, DDPMessage, ConnectMessage, SubMessage, UnsubMessage, MethodMessage, PingMessage, PongMessage, ConnectedMessage, FailedMessage, ResultMessage, ErrorMessage, NoSubMessage, ReadyMessage, AddedMessage, ChangedMessage, RemovedMessage, DDPError, MethodContext, PublishContext, Cursor, PublicationStrategies, PublicationStrategy, PublicationStrategyManager, Subscription, PublishHandler, };
