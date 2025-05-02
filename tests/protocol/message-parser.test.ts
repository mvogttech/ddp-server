import { MessageParser } from '../../src/protocol/message-parser';
import { Logger } from '../../src/utils/logger';
import { Metrics } from '../../src/utils/metrics';
import { encode } from 'cbor-x';

jest.mock('../../src/utils/logger');
jest.mock('../../src/utils/metrics');

describe('MessageParser', () => {
  let parser: MessageParser;
  let mockLogger: jest.Mocked<Logger>;
  let mockMetrics: jest.Mocked<Metrics>;

  beforeEach(() => {
    mockLogger = new Logger() as jest.Mocked<Logger>;
    mockMetrics = new Metrics() as jest.Mocked<Metrics>;
    parser = new MessageParser(mockLogger, mockMetrics);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  test('should parse valid JSON message', async () => {
    const message = Buffer.from(JSON.stringify({ msg: 'ping', id: 'test' }));
    const result = await parser.parseMessage(message, false);
    expect(result).toEqual({ msg: 'ping', id: 'test' });
    expect(mockLogger.debug).toHaveBeenCalledWith('Parsed message: ping', {
      isBinary: false,
    });
    expect(mockMetrics.increment).toHaveBeenCalledWith('message.parsed.ping', {
      format: 'json',
    });
  });

  test('should parse valid CBOR message', async () => {
    const message = Buffer.from(encode({ msg: 'ping', id: 'test' }));
    const result = await parser.parseMessage(message, true);
    expect(result).toEqual({ msg: 'ping', id: 'test' });
    expect(mockLogger.debug).toHaveBeenCalledWith('Parsed message: ping', {
      isBinary: true,
    });
    expect(mockMetrics.increment).toHaveBeenCalledWith('message.parsed.ping', {
      format: 'cbor',
    });
  });

  test('should throw DDPProtocolError for invalid JSON', async () => {
    const message = Buffer.from('invalid');
    await expect(parser.parseMessage(message, false)).rejects.toThrow(
      'Failed to parse JSON message'
    );
    expect(mockLogger.error).toHaveBeenCalledWith(
      'Failed to parse message',
      expect.any(Object)
    );
    expect(mockMetrics.increment).toHaveBeenCalledWith('message.parse.error', {
      format: 'json',
    });
  });

  test('should throw DDPProtocolError for invalid CBOR', async () => {
    const message = Buffer.from([0xff]);
    await expect(parser.parseMessage(message, true)).rejects.toThrow(
      'Failed to decode CBOR message'
    );
    expect(mockLogger.error).toHaveBeenCalledWith(
      'Failed to parse message',
      expect.any(Object)
    );
    expect(mockMetrics.increment).toHaveBeenCalledWith('message.parse.error', {
      format: 'cbor',
    });
  });

  test('should throw DDPProtocolError for missing msg field', async () => {
    const message = Buffer.from(JSON.stringify({ id: 'test' }));
    await expect(parser.parseMessage(message, false)).rejects.toThrow(
      'Message missing or invalid "msg" field'
    );
  });

  test('should encode message as CBOR', () => {
    const message = { msg: 'pong', id: 'test' };
    const result = parser.encodeMessage(message, true);
    expect(result).toEqual(Buffer.from(encode(message)));
    expect(mockLogger.debug).toHaveBeenCalledWith('Encoded message: pong', {
      useBinary: true,
    });
    expect(mockMetrics.increment).toHaveBeenCalledWith('message.encoded.pong', {
      format: 'cbor',
    });
  });

  test('should encode message as JSON', () => {
    const message = { msg: 'pong', id: 'test' };
    const result = parser.encodeMessage(message, false);
    expect(result).toEqual(Buffer.from(JSON.stringify(message), 'utf-8'));
    expect(mockLogger.debug).toHaveBeenCalledWith('Encoded message: pong', {
      useBinary: false,
    });
    expect(mockMetrics.increment).toHaveBeenCalledWith('message.encoded.pong', {
      format: 'json',
    });
  });
});
