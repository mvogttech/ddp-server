import { DDPServer } from '../src/server';
import { Logger } from '../src/utils/logger';
import { Metrics } from '../src/utils/metrics';
import { RedisCoordinator } from '../src/distributed/redis-coordinator';
import { WebSocketServer } from 'ws';
import { createServer } from 'http';

jest.mock('ws');
jest.mock('../src/utils/logger');
jest.mock('../src/utils/metrics');
jest.mock('../src/distributed/redis-coordinator');

describe('DDPServer', () => {
  let server: DDPServer;
  let mockHttpServer: any;
  let mockWsServer: any;
  let mockLogger: jest.Mocked<Logger>;
  let mockMetrics: jest.Mocked<Metrics>;
  let mockRedisCoordinator: jest.Mocked<RedisCoordinator>;

  beforeEach(() => {
    mockHttpServer = {
      listen: jest.fn((port, cb) => cb()),
      close: jest.fn((cb) => cb()),
      on: jest.fn(),
    };
    mockWsServer = {
      close: jest.fn((cb) => cb()),
    };
    (createServer as jest.Mock).mockReturnValue(mockHttpServer);
    (WebSocketServer as unknown as jest.Mock).mockReturnValue(mockWsServer);
    mockLogger = new Logger() as jest.Mocked<Logger>;
    mockMetrics = new Metrics() as jest.Mocked<Metrics>;
    mockRedisCoordinator = new RedisCoordinator(
      mockLogger,
      mockMetrics
    ) as jest.Mocked<RedisCoordinator>;
    mockRedisCoordinator.connect.mockResolvedValue();
    mockRedisCoordinator.disconnect.mockResolvedValue();
    server = new DDPServer();
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test('should start the server on the specified port', async () => {
    await server.start(3000);
    expect(mockHttpServer.listen).toHaveBeenCalledWith(
      3000,
      expect.any(Function)
    );
    expect(mockLogger.info).toHaveBeenCalledWith(
      'DDP server listening on port 3000'
    );
    expect(mockMetrics.increment).toHaveBeenCalledWith('server.start');
  });

  test('should throw DDPConnectionError if server fails to bind', async () => {
    mockHttpServer.listen.mockImplementation(() => {
      mockHttpServer.on.mockImplementation(
        (event: string, handler: (err: Error) => void) => {
          if (event === 'error') handler(new Error('Bind error'));
        }
      );
    });
    await expect(server.start(3000)).rejects.toThrow('Failed to bind to port');
    expect(mockLogger.error).toHaveBeenCalledWith(
      'Failed to start server',
      expect.any(Object)
    );
    expect(mockMetrics.increment).toHaveBeenCalledWith('server.error');
  });

  test('should register a publish handler', () => {
    const handler = jest.fn();
    server.publish('posts', handler);
    expect(mockLogger.info).toHaveBeenCalledWith(
      'Registered publish handler: posts'
    );
    expect(mockMetrics.increment).toHaveBeenCalledWith('publish.registered');
  });

  test('should register a method handler', () => {
    const handler = jest.fn();
    server.method('createPost', handler);
    expect(mockLogger.info).toHaveBeenCalledWith(
      'Registered method handler: createPost'
    );
    expect(mockMetrics.increment).toHaveBeenCalledWith('method.registered');
  });

  test('should stop the server and disconnect Redis', async () => {
    await server.stop();
    expect(mockWsServer.close).toHaveBeenCalled();
    expect(mockHttpServer.close).toHaveBeenCalled();
    expect(mockRedisCoordinator.disconnect).toHaveBeenCalled();
    expect(mockLogger.info).toHaveBeenCalledWith('DDP server stopped');
    expect(mockMetrics.increment).toHaveBeenCalledWith('server.stop');
  });

  test('should throw DDPConnectionError if stop fails', async () => {
    mockRedisCoordinator.disconnect.mockRejectedValue(
      new Error('Disconnect error')
    );
    await expect(server.stop()).rejects.toThrow('Server shutdown failed');
    expect(mockLogger.error).toHaveBeenCalledWith(
      'Failed to stop server',
      expect.any(Object)
    );
    expect(mockMetrics.increment).toHaveBeenCalledWith('server.error');
  });
});
