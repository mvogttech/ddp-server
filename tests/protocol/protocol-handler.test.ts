import { ProtocolHandler } from '../../src/protocol/protocol-handler';
import { SubscriptionManager } from '../../src/subscription/subscription-manager';
import { Logger } from '../../src/utils/logger';
import { Metrics } from '../../src/utils/metrics';
import { WebSocket } from 'ws';
import * as cborx from 'cbor-x';

jest.mock('ws');
jest.mock('../../src/utils/logger');
jest.mock('../../src/utils/metrics');
jest.mock('../../src/subscription/subscription-manager');

describe('ProtocolHandler', () => {
  let handler: ProtocolHandler;
  let mockSubscriptionManager: jest.Mocked<SubscriptionManager>;
  let mockLogger: jest.Mocked<Logger>;
  let mockMetrics: jest.Mocked<Metrics>;
  let mockWs: jest.Mocked<WebSocket>;

  beforeEach(() => {
    mockSubscriptionManager = new SubscriptionManager(
      {} as any,
      {} as any,
      {} as any
    ) as jest.Mocked<SubscriptionManager>;
    mockLogger = new Logger() as jest.Mocked<Logger>;
    mockMetrics = new Metrics() as jest.Mocked<Metrics>;
    mockWs = new WebSocket('ws://localhost') as jest.Mocked<WebSocket>;
    Object.defineProperty(mockWs, 'readyState', { value: WebSocket.OPEN });
    mockWs.send = jest.fn();
    handler = new ProtocolHandler(
      mockSubscriptionManager,
      mockLogger,
      mockMetrics
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test('should parse a JSON message', async () => {
    const message = Buffer.from(JSON.stringify({ msg: 'ping', id: 'test' }));
    const result = await handler.parseMessage(message, false);
    expect(result).toEqual({ msg: 'ping', id: 'test' });
    expect(mockLogger.debug).toHaveBeenCalledWith('Parsed message', {
      msg: 'ping',
    });
    expect(mockMetrics.increment).toHaveBeenCalledWith('message.parsed.ping', {
      format: 'json',
    });
  });

  test('should parse a CBOR message', async () => {
    const message = Buffer.from(cborx.encode({ msg: 'ping', id: 'test' }));
    const result = await handler.parseMessage(message, true);
    expect(result).toEqual({ msg: 'ping', id: 'test' });
    expect(mockLogger.debug).toHaveBeenCalledWith('Parsed message', {
      msg: 'ping',
    });
    expect(mockMetrics.increment).toHaveBeenCalledWith('message.parsed.ping', {
      format: 'cbor',
    });
  });

  test('should throw DDPProtocolError for invalid message', async () => {
    const message = Buffer.from('invalid');
    await expect(handler.parseMessage(message, false)).rejects.toThrow(
      'Invalid message format'
    );
    expect(mockLogger.error).toHaveBeenCalledWith(
      'Failed to parse message',
      expect.any(Object)
    );
    expect(mockMetrics.increment).toHaveBeenCalledWith('message.parse.error', {
      format: 'json',
    });
  });

  test('should handle connect message', async () => {
    const connection = {
      id: 'conn1',
      ws: mockWs,
      heartbeat: { messageReceived: jest.fn() },
      userId: null,
    };
    const message = { msg: 'connect', version: '1.0', support: ['1.0'] };
    await handler.processMessage(connection, message);
    expect(mockWs.send).toHaveBeenCalledWith(
      expect.stringContaining('connected')
    );
    expect(mockLogger.info).toHaveBeenCalledWith(
      'Connection established: conn1',
      { version: '1.0' }
    );
    expect(mockMetrics.increment).toHaveBeenCalledWith('connection.connected');
  });

  test('should handle sub message', async () => {
    const connection = {
      id: 'conn1',
      ws: mockWs,
      heartbeat: { messageReceived: jest.fn() },
      userId: null,
    };
    const message = { msg: 'sub', id: 'sub1', name: 'posts', params: [] };
    mockSubscriptionManager.subscribe.mockResolvedValue();
    await handler.processMessage(connection, message);
    expect(mockSubscriptionManager.subscribe).toHaveBeenCalledWith(
      connection,
      'sub1',
      'posts',
      []
    );
    expect(mockLogger.info).toHaveBeenCalledWith('Subscribed: posts', {
      connectionId: 'conn1',
      subId: 'sub1',
    });
  });

  test('should handle method message', async () => {
    const connection = {
      id: 'conn1',
      ws: mockWs,
      heartbeat: { messageReceived: jest.fn() },
      userId: null,
    };
    const message = {
      msg: 'method',
      id: 'method1',
      method: 'createPost',
      params: ['content'],
    };
    const handlerFn = jest.fn().mockResolvedValue('result');
    handler.registerMethodHandler('createPost', handlerFn);
    await handler.processMessage(connection, message);
    expect(handlerFn).toHaveBeenCalledWith(['content'], expect.any(Object));
    expect(mockWs.send).toHaveBeenCalledWith(expect.stringContaining('result'));
    expect(mockLogger.info).toHaveBeenCalledWith(
      'Method executed: createPost',
      { connectionId: 'conn1' }
    );
  });

  test('should handle ping message', async () => {
    const connection = {
      id: 'conn1',
      ws: mockWs,
      heartbeat: { messageReceived: jest.fn() },
      userId: null,
    };
    const message = { msg: 'ping', id: 'ping1' };
    await handler.processMessage(connection, message);
    expect(mockWs.send).toHaveBeenCalledWith(expect.stringContaining('pong'));
    expect(mockMetrics.increment).toHaveBeenCalledWith('message.sent.pong');
  });
});
