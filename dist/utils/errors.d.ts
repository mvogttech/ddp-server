/**
 * Custom error classes for DDP server.
 */
export declare class DDPConnectionError extends Error {
    code: number;
    details: Record<string, any>;
    constructor(message: string, details?: Record<string, any>);
}
export declare class DDPProtocolError extends Error {
    code: number;
    details: Record<string, any>;
    constructor(message: string, details?: Record<string, any>);
}
