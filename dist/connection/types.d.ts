import { WebSocket } from 'ws';
import { Heartbeat } from './heartbeat';
import { DDPMessage } from '../protocol/types';
/**
 * Represents a single WebSocket connection in the DDP server.
 */
export interface Connection {
    /**
     * Unique identifier for the connection.
     */
    id: string;
    /**
     * WebSocket instance for the connection.
     */
    ws: WebSocket;
    /**
     * Heartbeat instance managing ping/pong for connection health.
     */
    heartbeat: Heartbeat;
    /**
     * ID of the authenticated user, if any.
     */
    userId: string | null;
}
/**
 * Configuration options for connection management.
 */
export interface ConnectionOptions {
    /**
     * Interval between heartbeat ping messages (in milliseconds).
     * @default 15000
     */
    heartbeatInterval?: number;
    /**
     * Timeout for receiving a heartbeat pong response (in milliseconds).
     * @default 15000
     */
    heartbeatTimeout?: number;
    /**
     * Whether to enable WebSocket compression.
     * @default true
     */
    compression?: boolean;
}
/**
 * Represents a DDP ping message sent by the server.
 */
export interface PingMessage extends DDPMessage {
    /**
     * Message type, always 'ping'.
     */
    msg: 'ping';
    /**
     * Unique identifier for the ping message.
     */
    id?: string;
}
/**
 * Represents a DDP pong message received from the client.
 */
export interface PongMessage extends DDPMessage {
    /**
     * Message type, always 'pong'.
     */
    msg: 'pong';
    /**
     * Identifier matching the corresponding ping message, if provided.
     */
    id?: string;
}
