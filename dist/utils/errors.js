"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.DDPProtocolError = exports.DDPConnectionError = void 0;
/**
 * Custom error classes for DDP server.
 */
class DDPConnectionError extends Error {
    constructor(message, details = {}) {
        super(message);
        this.name = 'DDPConnectionError';
        this.code = 1000;
        this.details = details;
    }
}
exports.DDPConnectionError = DDPConnectionError;
class DDPProtocolError extends Error {
    constructor(message, details = {}) {
        super(message);
        this.name = 'DDPProtocolError';
        this.code = 1001;
        this.details = details;
    }
}
exports.DDPProtocolError = DDPProtocolError;
//# sourceMappingURL=errors.js.map