import { Server as WebSocketServer } from 'ws';
import { createServer } from 'http';
import { ConnectionManager } from './connection/connection-manager';
import { ProtocolHandler } from './protocol/protocol-handler';
import { MessageParser } from './protocol/message-parser';
import { SubscriptionManager } from './subscription/subscription-manager';
import { RedisCoordinator } from './distributed/redis-coordinator';
import { Logger } from './utils/logger';
import { Metrics } from './utils/metrics';
import { DDPConnectionError } from './utils/errors';
import cluster from 'cluster';
import os from 'os';

/**
 * Main DDP server class responsible for initializing and managing the WebSocket server,
 * connection handling, protocol processing, and subscription management, with clustering support.
 */
export class DDPServer {
  private httpServer: any;
  private wsServer: WebSocketServer | null = null;
  private connectionManager: ConnectionManager;
  private protocolHandler: ProtocolHandler;
  private messageParser: MessageParser;
  private subscriptionManager: SubscriptionManager;
  private redisCoordinator: RedisCoordinator;
  private logger: Logger;
  private metrics: Metrics;
  private isWorker: boolean = false;

  constructor(options: DDPServerOptions = {}) {
    this.logger = new Logger();
    this.metrics = new Metrics();
    this.messageParser = new MessageParser(this.logger, this.metrics);
    this.redisCoordinator = new RedisCoordinator(this.logger, this.metrics);
    this.subscriptionManager = new SubscriptionManager(
      this.redisCoordinator,
      this.logger,
      this.metrics,
      this.messageParser
    );
    this.protocolHandler = new ProtocolHandler(
      this.subscriptionManager,
      this.logger,
      this.metrics
    );
    this.connectionManager = new ConnectionManager(
      this.protocolHandler,
      this.logger,
      this.metrics,
      options
    );

    if (cluster.isPrimary && options.enableClustering) {
      // Start cluster workers
      const numCPUs = os.cpus().length;
      this.logger.info(`Starting ${numCPUs} cluster workers`);
      for (let i = 0; i < numCPUs; i++) {
        cluster.fork();
      }
      cluster.on('exit', (worker, code, signal) => {
        this.logger.warn(`Worker ${worker.process.pid} died. Restarting...`, {
          code,
          signal,
        });
        cluster.fork();
      });
    } else {
      // Initialize server in worker or single-instance mode
      this.isWorker = true;
      this.httpServer = createServer();
      this.wsServer = new WebSocketServer({
        server: this.httpServer,
        path: '/websocket',
      });
    }
  }

  /**
   * Starts the DDP server and listens for WebSocket connections.
   * @param port - Port to listen on (default: 3000).
   * @returns Promise that resolves when the server is listening.
   */
  async start(port: number = 3000): Promise<void> {
    if (!this.isWorker) {
      this.logger.info('Primary process started. Workers handle connections.');
      return;
    }

    try {
      await this.redisCoordinator.connect();
      this.connectionManager.initialize(this.wsServer!);
      await new Promise<void>((resolve, reject) => {
        this.httpServer.listen(port, () => {
          this.logger.info(
            `DDP server listening on port ${port} (worker ${process.pid})`
          );
          this.metrics.increment('server.start');
          resolve();
        });
        this.httpServer.on('error', (error) => {
          reject(
            new DDPConnectionError('Failed to bind to port', { cause: error })
          );
        });
      });
    } catch (error) {
      this.logger.error('Failed to start server', { error });
      this.metrics.increment('server.error');
      throw new DDPConnectionError('Server startup failed', { cause: error });
    }
  }

  /**
   * Registers a publish handler for a named subscription.
   * @param name - Name of the publication.
   * @param handler - Function to handle subscription data.
   */
  publish(name: string, handler: PublishHandler): void {
    this.subscriptionManager.registerPublishHandler(name, handler);
    this.logger.info(`Registered publish handler: ${name}`);
    this.metrics.increment('publish.registered');
  }

  /**
   * Registers a method handler for a remote procedure call.
   * @param name - Name of the method.
   * @param handler - Function to handle method execution.
   */
  method(name: string, handler: MethodHandler): void {
    this.protocolHandler.registerMethodHandler(name, handler);
    this.logger.info(`Registered method handler: ${name}`);
    this.metrics.increment('method.registered');
  }

  /**
   * Stops the DDP server and cleans up resources.
   * @returns Promise that resolves when the server is stopped.
   */
  async stop(): Promise<void> {
    if (!this.isWorker) {
      this.logger.info('Stopping primary process. Workers will terminate.');
      Object.values(cluster.workers!).forEach((worker) => worker!.kill());
      return;
    }

    this.logger.info('Initiating server shutdown...');
    const shutdownStart = Date.now();

    try {
      // Close WebSocket server with 5-second timeout
      await Promise.race([
        new Promise<void>((resolve) => {
          this.wsServer!.close(() => {
            this.logger.info('WebSocket server closed', {
              duration: Date.now() - shutdownStart,
            });
            resolve();
          });
        }),
        new Promise((_, reject) =>
          setTimeout(
            () => reject(new Error('WebSocket server close timeout')),
            5000
          )
        ),
      ]);
      // Close HTTP server with 5-second timeout
      await Promise.race([
        new Promise<void>((resolve) => {
          this.httpServer.close(() => {
            this.logger.info('HTTP server closed', {
              duration: Date.now() - shutdownStart,
            });
            resolve();
          });
        }),
        new Promise((_, reject) =>
          setTimeout(() => reject(new Error('HTTP server close timeout')), 5000)
        ),
      ]);

      // Disconnect Redis
      await this.redisCoordinator.disconnect();
      this.logger.info('Redis disconnected', {
        duration: Date.now() - shutdownStart,
      });

      // Close all connections
      this.connectionManager.closeAll();

      this.logger.info('All connections closed', {
        duration: Date.now() - shutdownStart,
      });

      this.logger.info('DDP server stopped', {
        totalDuration: Date.now() - shutdownStart,
      });
      this.metrics.increment('server.stop');
    } catch (error) {
      this.logger.error('Failed to stop server', { error });
      this.metrics.increment('server.error');
      throw new DDPConnectionError('Server shutdown failed', { cause: error });
    }
  }
}

/**
 * Configuration options for the DDP server.
 */
export interface DDPServerOptions {
  heartbeatInterval?: number;
  heartbeatTimeout?: number;
  compression?: boolean;
  enableClustering?: boolean; // Enable clustering
}

/**
 * Handler function for publish operations.
 */
type PublishHandler = (
  params: any[],
  context: PublishContext
) => Promise<Cursor | Cursor[]>;

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
  changed: (
    collection: string,
    id: string,
    fields: Record<string, any>
  ) => void;
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
