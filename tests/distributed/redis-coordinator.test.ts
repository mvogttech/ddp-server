import { RedisCoordinator } from '../../src/distributed/redis-coordinator';
import { Logger } from '../../src/utils/logger';
import { Metrics } from '../../src/utils/metrics';
import { createClient } from 'redis';

jest.mock('redis');
jest.mock('../../src/utils/logger');
jest.mock('../../src/utils/metrics');

describe('RedisCoordinator', () => {
  let coordinator: RedisCoordinator;
  let mockLogger: jest.Mocked<Logger>;
  let mockMetrics: jest.Mocked<Metrics>;
  let mockClient: any;
  let mockSubscriber: any;

  beforeEach(() => {
    mockLogger = new Logger() as jest.Mocked<Logger>;
    mockMetrics = new Metrics() as jest.Mocked<Metrics>;
    mockClient = {
      connect: jest.fn().mockResolvedValue(undefined),
      quit: jest.fn().mockResolvedValue(undefined),
      hSet: jest.fn().mockResolvedValue(undefined),
      del: jest.fn().mockResolvedValue(undefined),
      publish: jest.fn().mockResolvedValue(undefined),
    };
    mockSubscriber = {
      connect: jest.fn().mockResolvedValue(undefined),
      quit: jest.fn().mockResolvedValue(undefined),
    };
    (createClient as jest.Mock).mockReturnValue(mockClient);
    mockClient.duplicate.mockReturnValue(mockSubscriber);
    coordinator = new RedisCoordinator(mockLogger, mockMetrics);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test('should connect to Redis', async () => {
    await coordinator.connect();
    expect(mockClient.connect).toHaveBeenCalled();
    expect(mockSubscriber.connect).toHaveBeenCalled();
    expect(mockLogger.info).toHaveBeenCalledWith('Connected to Redis');
    expect(mockMetrics.increment).toHaveBeenCalledWith('redis.connected');
  });

  test('should throw DDPConnectionError on connection failure', async () => {
    mockClient.connect.mockRejectedValue(new Error('Connection error'));
    await expect(coordinator.connect()).rejects.toThrow(
      'Redis connection failed'
    );
    expect(mockLogger.error).toHaveBeenCalledWith(
      'Failed to connect to Redis',
      expect.any(Object)
    );
    expect(mockMetrics.increment).toHaveBeenCalledWith('redis.error');
  });

  test('should disconnect from Redis', async () => {
    await coordinator.disconnect();
    expect(mockClient.quit).toHaveBeenCalled();
    expect(mockSubscriber.quit).toHaveBeenCalled();
    expect(mockLogger.info).toHaveBeenCalledWith('Disconnected from Redis');
    expect(mockMetrics.increment).toHaveBeenCalledWith('redis.disconnected');
  });

  test('should register a subscription', async () => {
    const subscription = {
      id: 'sub1',
      connectionId: 'conn1',
      name: 'posts',
      params: [],
    };
    await coordinator.registerSubscription(subscription);
    expect(mockClient.hSet).toHaveBeenCalledWith(
      'subscription:sub1',
      expect.any(Object)
    );
    expect(mockClient.publish).toHaveBeenCalledWith(
      'subscriptions',
      expect.stringContaining('register')
    );
    expect(mockLogger.info).toHaveBeenCalledWith(
      'Registered subscription: sub1'
    );
    expect(mockMetrics.increment).toHaveBeenCalledWith(
      'redis.subscription.registered'
    );
  });

  test('should unregister a subscription', async () => {
    await coordinator.unregisterSubscription('sub1');
    expect(mockClient.del).toHaveBeenCalledWith('subscription:sub1');
    expect(mockClient.publish).toHaveBeenCalledWith(
      'subscriptions',
      expect.stringContaining('unregister')
    );
    expect(mockLogger.info).toHaveBeenCalledWith(
      'Unregistered subscription: sub1'
    );
    expect(mockMetrics.increment).toHaveBeenCalledWith(
      'redis.subscription.unregistered'
    );
  });
});
