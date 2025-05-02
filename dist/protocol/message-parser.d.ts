/// <reference types="node" />
/// <reference types="node" />
import { Logger } from '../utils/logger';
import { Metrics } from '../utils/metrics';
import { DDPMessage } from './types';
/**
 * Parses incoming WebSocket messages into DDP messages, supporting both CBOR and JSON formats,
 * and supports batching multiple messages into a single frame.
 */
export declare class MessageParser {
    private logger;
    private metrics;
    private batchBuffer;
    private batchTimeout;
    /**
     * Constructs a new MessageParser instance.
     * @param logger - Logger instance for logging parsing events and errors.
     * @param metrics - Metrics instance for collecting parsing metrics.
     */
    constructor(logger: Logger, metrics: Metrics);
    /**
     * Parses a WebSocket message into one or more DDP messages.
     * @param data - Raw message data from the WebSocket.
     * @param isBinary - Whether the message is binary (CBOR) format.
     * @returns Array of parsed DDP messages.
     * @throws DDPProtocolError if the message is invalid or cannot be parsed.
     */
    parseMessage(data: Buffer, isBinary: boolean): Promise<DDPMessage[]>;
    /**
     * Parses a binary (CBOR) message, supporting batched messages.
     * @param data - Raw binary data.
     * @returns Parsed message or array of messages.
     * @private
     */
    private parseBinary;
    /**
     * Parses a text (JSON) message, supporting batched messages.
     * @param data - Raw text data.
     * @returns Parsed message or array of messages.
     * @private
     */
    private parseText;
    /**
     * Validates the structure of a parsed DDP message.
     * @param message - Parsed message object.
     * @throws DDPProtocolError if the message is invalid.
     * @private
     */
    private validateMessage;
    /**
     * Buffers a DDP message for batching, sending when the buffer is full or timeout occurs.
     * @param message - DDP message to encode.
     * @param send - Function to send the encoded message.
     * @param useBinary - Whether to encode as CBOR (true) or JSON (false).
     */
    bufferMessage(message: DDPMessage, send: (data: Buffer) => void, useBinary?: boolean): void;
    /**
     * Flushes the batch buffer, encoding and sending all buffered messages.
     * @param send - Function to send the encoded message.
     * @param useBinary - Whether to encode as CBOR (true) or JSON (false).
     * @private
     */
    private flushBuffer;
    /**
     * Encodes a DDP message into the specified format (CBOR or JSON).
     * @param message - DDP message to encode.
     * @param useBinary - Whether to encode as CBOR (true) or JSON (false).
     * @returns Encoded message as Buffer.
     */
    encodeMessage(message: DDPMessage, useBinary: boolean): Buffer;
}
