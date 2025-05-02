import { encode, decode } from 'cbor-x';
import { Logger } from '../utils/logger';
import { Metrics } from '../utils/metrics';
import { DDPProtocolError } from '../utils/errors';
import { DDPMessage } from './types';

/**
 * Parses incoming WebSocket messages into DDP messages, supporting both CBOR and JSON formats,
 * and supports batching multiple messages into a single frame.
 */
export class MessageParser {
  private logger: Logger;
  private metrics: Metrics;
  private batchBuffer: DDPMessage[] = []; // Buffer for batched messages
  private batchTimeout: NodeJS.Timeout | null = null;

  /**
   * Constructs a new MessageParser instance.
   * @param logger - Logger instance for logging parsing events and errors.
   * @param metrics - Metrics instance for collecting parsing metrics.
   */
  constructor(logger: Logger, metrics: Metrics) {
    this.logger = logger;
    this.metrics = metrics;
  }

  /**
   * Parses a WebSocket message into one or more DDP messages.
   * @param data - Raw message data from the WebSocket.
   * @param isBinary - Whether the message is binary (CBOR) format.
   * @returns Array of parsed DDP messages.
   * @throws DDPProtocolError if the message is invalid or cannot be parsed.
   */
  async parseMessage(data: Buffer, isBinary: boolean): Promise<DDPMessage[]> {
    try {
      const parsed = isBinary ? this.parseBinary(data) : this.parseText(data);
      const messages = Array.isArray(parsed) ? parsed : [parsed];
      messages.forEach((msg) => this.validateMessage(msg));
      this.logger.debug(`Parsed ${messages.length} message(s)`, {
        isBinary,
        types: messages.map((m) => m.msg),
      });
      this.metrics.increment(`message.parsed.batch`, {
        count: messages.length.toString(),
        format: isBinary ? 'cbor' : 'json',
      });
      return messages;
    } catch (error) {
      this.logger.error('Failed to parse message', { error, isBinary });
      this.metrics.increment('message.parse.error', {
        format: isBinary ? 'cbor' : 'json',
      });
      throw new DDPProtocolError('Invalid message format', {
        cause: error,
        isBinary,
      });
    }
  }

  /**
   * Parses a binary (CBOR) message, supporting batched messages.
   * @param data - Raw binary data.
   * @returns Parsed message or array of messages.
   * @private
   */
  private parseBinary(data: Buffer): any {
    try {
      const decoded = decode(new Uint8Array(data));
      this.metrics.increment('message.parse.binary');
      return decoded;
    } catch (error) {
      throw new DDPProtocolError('Failed to decode CBOR message', {
        cause: error,
      });
    }
  }

  /**
   * Parses a text (JSON) message, supporting batched messages.
   * @param data - Raw text data.
   * @returns Parsed message or array of messages.
   * @private
   */
  private parseText(data: Buffer): any {
    try {
      const decoded = JSON.parse(data.toString('utf-8'));
      this.metrics.increment('message.parse.json');
      return decoded;
    } catch (error) {
      throw new DDPProtocolError('Failed to parse JSON message', {
        cause: error,
      });
    }
  }

  /**
   * Validates the structure of a parsed DDP message.
   * @param message - Parsed message object.
   * @throws DDPProtocolError if the message is invalid.
   * @private
   */
  private validateMessage(message: any): void {
    if (!message || typeof message !== 'object') {
      throw new DDPProtocolError('Message must be an object');
    }

    if (!('msg' in message) || typeof message.msg !== 'string') {
      throw new DDPProtocolError('Message missing or invalid "msg" field');
    }

    // Additional validation based on message type
    switch (message.msg) {
      case 'connect':
        if (
          typeof message.version !== 'string' ||
          !Array.isArray(message.support)
        ) {
          throw new DDPProtocolError(
            'Invalid connect message: missing version or support'
          );
        }
        break;
      case 'sub':
        if (
          typeof message.id !== 'string' ||
          typeof message.name !== 'string'
        ) {
          throw new DDPProtocolError('Invalid sub message: missing id or name');
        }
        if ('params' in message && !Array.isArray(message.params)) {
          throw new DDPProtocolError(
            'Invalid sub message: params must be an array'
          );
        }
        break;
      case 'unsub':
        if (typeof message.id !== 'string') {
          throw new DDPProtocolError('Invalid unsub message: missing id');
        }
        break;
      case 'method':
        if (
          typeof message.id !== 'string' ||
          typeof message.method !== 'string'
        ) {
          throw new DDPProtocolError(
            'Invalid method message: missing id or method'
          );
        }
        if ('params' in message && !Array.isArray(message.params)) {
          throw new DDPProtocolError(
            'Invalid method message: params must be an array'
          );
        }
        break;
      case 'ping':
      case 'pong':
        if ('id' in message && typeof message.id !== 'string') {
          throw new DDPProtocolError(
            'Invalid ping/pong message: id must be a string'
          );
        }
        break;
      default:
        throw new DDPProtocolError(`Unsupported message type: ${message.msg}`);
    }
  }

  /**
   * Buffers a DDP message for batching, sending when the buffer is full or timeout occurs.
   * @param message - DDP message to encode.
   * @param send - Function to send the encoded message.
   * @param useBinary - Whether to encode as CBOR (true) or JSON (false).
   */
  bufferMessage(
    message: DDPMessage,
    send: (data: Buffer) => void,
    useBinary: boolean = true
  ): void {
    this.batchBuffer.push(message);
    this.metrics.increment('message.buffered', { type: message.msg });

    if (this.batchBuffer.length >= 10) {
      // Send when buffer reaches 10 messages
      this.flushBuffer(send, useBinary);
    } else if (!this.batchTimeout) {
      // Set timeout to flush buffer after 10ms
      this.batchTimeout = setTimeout(
        () => this.flushBuffer(send, useBinary),
        10
      );
    }
  }

  /**
   * Flushes the batch buffer, encoding and sending all buffered messages.
   * @param send - Function to send the encoded message.
   * @param useBinary - Whether to encode as CBOR (true) or JSON (false).
   * @private
   */
  private flushBuffer(send: (data: Buffer) => void, useBinary: boolean): void {
    if (this.batchBuffer.length === 0) return;

    try {
      const messages = this.batchBuffer;
      this.batchBuffer = [];
      if (this.batchTimeout) {
        clearTimeout(this.batchTimeout);
        this.batchTimeout = null;
      }

      const encoded = useBinary
        ? Buffer.from(encode(messages))
        : Buffer.from(JSON.stringify(messages), 'utf-8');
      send(encoded);
      this.logger.debug(
        `Encoded and sent ${messages.length} batched message(s)`,
        { useBinary }
      );
      this.metrics.increment('message.encoded.batch', {
        count: messages.length.toString(),
        format: useBinary ? 'cbor' : 'json',
      });
    } catch (error) {
      this.logger.error('Failed to encode batched messages', {
        error,
        useBinary,
      });
      this.metrics.increment('message.encode.error', {
        format: useBinary ? 'cbor' : 'json',
      });
      throw new DDPProtocolError('Failed to encode batched messages', {
        cause: error,
        useBinary,
      });
    }
  }

  /**
   * Encodes a DDP message into the specified format (CBOR or JSON).
   * @param message - DDP message to encode.
   * @param useBinary - Whether to encode as CBOR (true) or JSON (false).
   * @returns Encoded message as Buffer.
   */
  encodeMessage(message: DDPMessage, useBinary: boolean): Buffer {
    const encoded = useBinary
      ? Buffer.from(encode(message))
      : Buffer.from(JSON.stringify(message), 'utf-8');
    this.logger.debug(`Encoded message: ${message.msg}`, {
      useBinary,
    });
    this.metrics.increment(`message.encoded.${message.msg}`, {
      format: useBinary ? 'cbor' : 'json',
    });
    return encoded;
  }
}
