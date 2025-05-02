import { ConnectionManager } from '../../src/connection/connection-manager';
import { ProtocolHandler } from '../../src/protocol/protocol-handler';
import { Logger } from '../../src/utils/logger';
import { Metrics } from '../../src/utils/metrics';
import { WebSocket, WebSocketServer } from 'ws';

jest.mock('ws');
jest.mock('../../src/utils/logger');
jest.mock('../../src/utils/metrics');
jest.mock('../../src/protocol/protocol-handler');

describe('ConnectionManager', () => {
  let manager: ConnectionManager;
  let mockWsServer: jest.Mocked<WebSocketServer>;
  let mockProtocolHandler: jest.Mocked<ProtocolHandler>;
  let mockLogger: jest.Mocked<Logger>;
  let mockMetrics: jest.Mocked<Metrics>;
  let mockWs: jest.Mocked<WebSocket>;

  beforeEach(() => {
    mockWsServer = new WebSocketServer({
      port: 0,
    }) as jest.Mocked<WebSocketServer>;
    mockProtocolHandler = new ProtocolHandler(
      {} as any,
      {} as any,
      {} as any
    ) as jest.Mocked<ProtocolHandler>;
    mockLogger = new Logger() as jest.Mocked<Logger>;
    mockMetrics = new Metrics() as jest.Mocked<Metrics>;
    mockWs = new WebSocket('ws://localhost') as jest.Mocked<WebSocket>;
    Object.defineProperty(mockWs, 'readyState', { value: WebSocket.OPEN });
    mockWs.close = jest.fn();
    mockWs.send = jest.fn();
    manager = new ConnectionManager(
      mockProtocolHandler,
      mockLogger,
      mockMetrics,
      {
        heartbeatInterval: 1000,
        heartbeatTimeout: 2000,
      }
    );
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test('should initialize WebSocket handler', () => {
    manager.initialize(mockWsServer);
    expect(mockLogger.info).toHaveBeenCalledWith(
      'WebSocket handler initialized'
    );
    expect(mockMetrics.increment).toHaveBeenCalledWith(
      'connection.manager.initialized'
    );
  });

  test('should handle new WebSocket connection', async () => {
    manager.initialize(mockWsServer);
    const connectionHandler = mockWsServer.on.mock.calls.find(
      (call) => call[0] === 'connection'
    )?.[1];
    expect(connectionHandler).toBeDefined();
    await connectionHandler!.call(mockWsServer, mockWs);
    expect(mockLogger.info).toHaveBeenCalledWith(
      expect.stringContaining('New connection established')
    );
    expect(mockMetrics.increment).toHaveBeenCalledWith('connection.opened');
    expect(mockMetrics.gauge).toHaveBeenCalledWith('connection.active', 1);
  });

  test('should handle incoming message', async () => {
    manager.initialize(mockWsServer);
    const connectionHandler = mockWsServer.on.mock.calls.find(
      (call) => call[0] === 'connection'
    )?.[1];
    await connectionHandler!.call(mockWsServer, mockWs);
    const messageHandler = mockWs.on.mock.calls.find(
      (call) => call[0] === 'message'
    )?.[1];
    const mockMessage = Buffer.from(JSON.stringify({ msg: 'ping' }));
    mockProtocolHandler.parseMessage.mockResolvedValue({ msg: 'ping' });
    await messageHandler!.call(mockWs, mockMessage, false);
    expect(mockProtocolHandler.parseMessage).toHaveBeenCalledWith(
      mockMessage,
      false
    );
    expect(mockProtocolHandler.processMessage).toHaveBeenCalled();
    expect(mockMetrics.increment).toHaveBeenCalledWith('message.received.ping');
  });

  test('should handle message parsing error', async () => {
    manager.initialize(mockWsServer);
    const connectionHandler = mockWsServer.on.mock.calls.find(
      (call) => call[0] === 'connection'
    )?.[1];
    await connectionHandler!.call(mockWsServer, mockWs);
    const messageHandler = mockWs.on.mock.calls.find(
      (call) => call[0] === 'message'
    )?.[1];
    const mockMessage = Buffer.from('invalid');
    mockProtocolHandler.parseMessage.mockRejectedValue(
      new Error('Parse error')
    );
    await messageHandler!.call(mockWs, mockMessage, false);
    expect(mockLogger.error).toHaveBeenCalledWith(
      'Failed to process message',
      expect.any(Object)
    );
    expect(mockMetrics.increment).toHaveBeenCalledWith('message.error');
    expect(mockWs.send).toHaveBeenCalledWith(
      expect.stringContaining('Invalid message')
    );
  });

  test('should handle connection closure', async () => {
    manager.initialize(mockWsServer);
    const connectionHandler = mockWsServer.on.mock.calls.find(
      (call) => call[0] === 'connection'
    )?.[1];
    await connectionHandler!.call(mockWsServer, mockWs);
    const closeHandler = mockWs.on.mock.calls.find(
      (call) => call[0] === 'close'
    )?.[1];
    await closeHandler!.call(mockWs, 1000, Buffer.from('Normal closure'));
    expect(mockLogger.info).toHaveBeenCalledWith(
      expect.stringContaining('Connection closed')
    );
    expect(mockMetrics.increment).toHaveBeenCalledWith('connection.closed');
    expect(mockMetrics.gauge).toHaveBeenCalledWith('connection.active', 0);
  });

  test('should close a specific connection', async () => {
    manager.initialize(mockWsServer);
    const connectionHandler = mockWsServer.on.mock.calls.find(
      (call) => call[0] === 'connection'
    )?.[1];
    await connectionHandler!.call(mockWsServer, mockWs);
    const connectionId = mockLogger.info.mock.calls
      .find((call) => call[0].includes('New connection established'))?.[0]
      .match(/: (.+)/)?.[1];
    manager.closeConnection(connectionId!);
    expect(mockWs.close).toHaveBeenCalled();
    expect(mockLogger.info).toHaveBeenCalledWith(
      `Connection closed: ${connectionId}`
    );
    expect(mockMetrics.increment).toHaveBeenCalledWith('connection.closed');
  });
});
