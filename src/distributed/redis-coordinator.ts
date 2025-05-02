import { createClient } from 'redis';
import { Logger } from '../utils/logger';
import { Metrics } from '../utils/metrics';
import { DDPConnectionError } from '../utils/errors';

/**
 * Coordinates subscription state across multiple server instances using Redis pub/sub.
 */
export class RedisCoordinator {
  private client: any;
  private subscriber: any;
  private logger: Logger;
  private metrics: Metrics;
  private isConnected: boolean = false;

  /**
   * Constructs a new RedisCoordinator instance.
   * @param logger - Logger instance for logging Redis events.
   * @param metrics - Metrics instance for collecting Redis metrics.
   */
  constructor(logger: Logger, metrics: Metrics) {
    this.logger = logger;
    this.metrics = metrics;
    const redisUrl = process.env.REDIS_URL || 'redis://localhost:6379';
    this.client = createClient({ url: redisUrl });
    this.subscriber = this.client.duplicate();
  }

  /**
   * Connects to Redis and sets up pub/sub.
   * @returns Promise that resolves when connected.
   */
  async connect(): Promise<void> {
    try {
      await this.client.connect();
      await this.subscriber.connect();
      this.isConnected = true;
      this.logger.info('Connected to Redis');
      this.metrics.increment('redis.connected');
    } catch (error) {
      this.logger.error('Failed to connect to Redis', { error });
      this.metrics.increment('redis.error');
      console.error('Redis connection failed:', error);
      throw new DDPConnectionError('Redis connection failed', { cause: error });
    }
  }

  /**
   * Disconnects from Redis.
   * @returns Promise that resolves when disconnected.
   */
  async disconnect(): Promise<void> {
    try {
      await this.client.quit();
      await this.subscriber.quit();
      this.isConnected = false;
      this.logger.info('Disconnected from Redis');
      this.metrics.increment('redis.disconnected');
    } catch (error) {
      this.logger.error('Failed to disconnect from Redis', { error });
      this.metrics.increment('redis.error');
      throw new DDPConnectionError('Redis disconnection failed', {
        cause: error,
      });
    }
  }

  /**
   * Registers a subscription in Redis.
   * @param subscription - Subscription to register.
   */
  async registerSubscription(subscription: Subscription): Promise<void> {
    if (!this.isConnected) {
      throw new DDPConnectionError('Redis not connected');
    }
    try {
      await this.client.hSet(`subscription:${subscription.id}`, {
        connectionId: subscription.connectionId,
        name: subscription.name,
        params: JSON.stringify(subscription.params),
      });
      await this.client.publish(
        'subscriptions',
        JSON.stringify({ action: 'register', subscription })
      );
      this.logger.info(`Registered subscription: ${subscription.id}`);
      this.metrics.increment('redis.subscription.registered');
    } catch (error) {
      this.logger.error('Failed to register subscription', {
        error,
        subscription,
      });
      this.metrics.increment('redis.error');
      console.error('Redis subscription registration failed:', error);
      throw new DDPConnectionError('Subscription registration failed', {
        cause: error,
      });
    }
  }

  /**
   * Unregisters a subscription from Redis.
   * @param subId - Subscription ID.
   */
  async unregisterSubscription(subId: string): Promise<void> {
    if (!this.isConnected) {
      throw new DDPConnectionError('Redis not connected');
    }
    try {
      await this.client.del(`subscription:${subId}`);
      await this.client.publish(
        'subscriptions',
        JSON.stringify({ action: 'unregister', subId })
      );
      this.logger.info(`Unregistered subscription: ${subId}`);
      this.metrics.increment('redis.subscription.unregistered');
    } catch (error) {
      this.logger.error('Failed to unregister subscription', { error, subId });
      this.metrics.increment('redis.error');
      throw new DDPConnectionError('Subscription unregistration failed', {
        cause: error,
      });
    }
  }
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
