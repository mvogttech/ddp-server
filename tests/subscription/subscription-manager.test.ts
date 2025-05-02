import { SubscriptionManager } from '../../src/subscription/subscription-manager';
import { RedisCoordinator } from '../../src/distributed/redis-coordinator';
import { Logger } from '../../src/utils/logger';
import { Metrics } from '../../src/utils/metrics';
import { WebSocket } from 'ws';

jest.mock('ws');
jest.mock('../../src/utils/logger');
jest.mock('../../src/utils/metrics');
jest.mock('../../src/distributed/redis-coordinator');

describe('SubscriptionManager', () => {
  let manager: SubscriptionManager;
  let mockRedisCoordinator: jest.Mocked<RedisCoordinator>;
  let mockLogger: jest.Mocked<Logger>;
  let mockMetrics: jest.Mocked<Metrics>;
  let mockWs: jest.Mocked<WebSocket>;

  beforeEach(() => {
    mockRedisCoordinator = new RedisCoordinator(
      {} as any,
      {} as any
    ) as jest.Mocked<RedisCoordinator>;
    mockLogger = new Logger() as jest.Mocked<Logger>;
    mockMetrics = new Metrics() as jest.Mocked<Metrics>;
    mockWs = new WebSocket('ws://localhost') as jest.Mocked<WebSocket>;
    Object.defineProperty(mockWs, 'readyState', { value: WebSocket.OPEN });
    mockWs.send = jest.fn();
    manager = new SubscriptionManager(
      mockRedisCoordinator,
      mockLogger,
      mockMetrics
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test('should register a publish handler', () => {
    const handler = jest.fn();
    manager.registerPublishHandler('posts', handler);
    expect(mockLogger.info).toHaveBeenCalledWith(
      'Registered publish handler: posts'
    );
  });

  test('should subscribe to a publication', async () => {
    const connection = {
      id: 'conn1',
      ws: mockWs,
      heartbeat: { messageReceived: jest.fn() },
      userId: null,
    };
    const handler = jest.fn().mockResolvedValue({
      _publishCursor: jest.fn(),
      _getCollectionName: () => 'posts',
    });
    manager.registerPublishHandler('posts', handler);
    mockRedisCoordinator.registerSubscription.mockResolvedValue();
    await manager.subscribe(connection, 'sub1', 'posts', []);
    expect(handler).toHaveBeenCalled();
    expect(mockRedisCoordinator.registerSubscription).toHaveBeenCalled();
    expect(mockLogger.info).toHaveBeenCalledWith(
      'Registered subscription: sub1'
    );
    expect(mockMetrics.increment).toHaveBeenCalledWith('subscription.ready');
  });

  test('should throw error for unknown publication', async () => {
    const connection = {
      id: 'conn1',
      ws: mockWs,
      heartbeat: { messageReceived: jest.fn() },
      userId: null,
    };
    await expect(
      manager.subscribe(connection, 'sub1', 'unknown', [])
    ).rejects.toThrow('Publication unknown not found');
  });

  test('should unsubscribe from a publication', async () => {
    const connection = {
      id: 'conn1',
      ws: mockWs,
      heartbeat: { messageReceived: jest.fn() },
      userId: null,
    };
    const handler = jest.fn().mockResolvedValue({
      _publishCursor: jest.fn(),
      _getCollectionName: () => 'posts',
    });
    manager.registerPublishHandler('posts', handler);
    mockRedisCoordinator.registerSubscription.mockResolvedValue();
    await manager.subscribe(connection, 'sub1', 'posts', []);
    mockRedisCoordinator.unregisterSubscription.mockResolvedValue();
    await manager.unsubscribe(connection, 'sub1');
    expect(mockRedisCoordinator.unregisterSubscription).toHaveBeenCalledWith(
      'sub1'
    );
    expect(mockLogger.info).toHaveBeenCalledWith('Unsubscribed: sub1');
    expect(mockMetrics.increment).toHaveBeenCalledWith(
      'subscription.unsubscribed'
    );
  });

  test('should handle added document', async () => {
    const connection = {
      id: 'conn1',
      ws: mockWs,
      heartbeat: { messageReceived: jest.fn() },
      userId: null,
    };
    const handler = jest.fn().mockImplementation((params, context) => {
      context.added('posts', 'doc1', { title: 'Test' });
      context.ready();
    });
    manager.registerPublishHandler('posts', handler);
    mockRedisCoordinator.registerSubscription.mockResolvedValue();
    await manager.subscribe(connection, 'sub1', 'posts', []);
    expect(mockWs.send).toHaveBeenCalledWith(expect.stringContaining('added'));
    expect(mockWs.send).toHaveBeenCalledWith(expect.stringContaining('ready'));
    expect(mockMetrics.increment).toHaveBeenCalledWith(
      'subscription.document.added'
    );
  });
});
