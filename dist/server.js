"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.DDPServer = void 0;
const ws_1 = require("ws");
const http_1 = require("http");
const connection_manager_1 = require("./connection/connection-manager");
const protocol_handler_1 = require("./protocol/protocol-handler");
const message_parser_1 = require("./protocol/message-parser");
const subscription_manager_1 = require("./subscription/subscription-manager");
const redis_coordinator_1 = require("./distributed/redis-coordinator");
const logger_1 = require("./utils/logger");
const metrics_1 = require("./utils/metrics");
const errors_1 = require("./utils/errors");
const cluster_1 = __importDefault(require("cluster"));
const os_1 = __importDefault(require("os"));
/**
 * Main DDP server class responsible for initializing and managing the WebSocket server,
 * connection handling, protocol processing, and subscription management, with clustering support.
 */
class DDPServer {
    constructor(options = {}) {
        this.wsServer = null;
        this.isWorker = false;
        this.logger = new logger_1.Logger();
        this.metrics = new metrics_1.Metrics();
        this.messageParser = new message_parser_1.MessageParser(this.logger, this.metrics);
        this.redisCoordinator = new redis_coordinator_1.RedisCoordinator(this.logger, this.metrics);
        this.subscriptionManager = new subscription_manager_1.SubscriptionManager(this.redisCoordinator, this.logger, this.metrics, this.messageParser);
        this.protocolHandler = new protocol_handler_1.ProtocolHandler(this.subscriptionManager, this.logger, this.metrics);
        this.connectionManager = new connection_manager_1.ConnectionManager(this.protocolHandler, this.logger, this.metrics, options);
        if (cluster_1.default.isPrimary && options.enableClustering) {
            // Start cluster workers
            const numCPUs = os_1.default.cpus().length;
            this.logger.info(`Starting ${numCPUs} cluster workers`);
            for (let i = 0; i < numCPUs; i++) {
                cluster_1.default.fork();
            }
            cluster_1.default.on('exit', (worker, code, signal) => {
                this.logger.warn(`Worker ${worker.process.pid} died. Restarting...`, {
                    code,
                    signal,
                });
                cluster_1.default.fork();
            });
        }
        else {
            // Initialize server in worker or single-instance mode
            this.isWorker = true;
            this.httpServer = (0, http_1.createServer)();
            this.wsServer = new ws_1.Server({
                server: this.httpServer,
                path: '/websocket',
            });
        }
    }
    /**
     * Starts the DDP server and listens for WebSocket connections.
     * @param port - Port to listen on (default: 3000).
     * @returns Promise that resolves when the server is listening.
     */
    async start(port = 3000) {
        if (!this.isWorker) {
            this.logger.info('Primary process started. Workers handle connections.');
            return;
        }
        try {
            await this.redisCoordinator.connect();
            this.connectionManager.initialize(this.wsServer);
            await new Promise((resolve, reject) => {
                this.httpServer.listen(port, () => {
                    this.logger.info(`DDP server listening on port ${port} (worker ${process.pid})`);
                    this.metrics.increment('server.start');
                    resolve();
                });
                this.httpServer.on('error', (error) => {
                    reject(new errors_1.DDPConnectionError('Failed to bind to port', { cause: error }));
                });
            });
        }
        catch (error) {
            this.logger.error('Failed to start server', { error });
            this.metrics.increment('server.error');
            throw new errors_1.DDPConnectionError('Server startup failed', { cause: error });
        }
    }
    /**
     * Registers a publish handler for a named subscription.
     * @param name - Name of the publication.
     * @param handler - Function to handle subscription data.
     */
    publish(name, handler) {
        this.subscriptionManager.registerPublishHandler(name, handler);
        this.logger.info(`Registered publish handler: ${name}`);
        this.metrics.increment('publish.registered');
    }
    /**
     * Registers a method handler for a remote procedure call.
     * @param name - Name of the method.
     * @param handler - Function to handle method execution.
     */
    method(name, handler) {
        this.protocolHandler.registerMethodHandler(name, handler);
        this.logger.info(`Registered method handler: ${name}`);
        this.metrics.increment('method.registered');
    }
    /**
     * Stops the DDP server and cleans up resources.
     * @returns Promise that resolves when the server is stopped.
     */
    async stop() {
        if (!this.isWorker) {
            this.logger.info('Stopping primary process. Workers will terminate.');
            Object.values(cluster_1.default.workers).forEach((worker) => worker.kill());
            return;
        }
        this.logger.info('Initiating server shutdown...');
        const shutdownStart = Date.now();
        try {
            // Close WebSocket server with 5-second timeout
            await Promise.race([
                new Promise((resolve) => {
                    this.wsServer.close(() => {
                        this.logger.info('WebSocket server closed', {
                            duration: Date.now() - shutdownStart,
                        });
                        resolve();
                    });
                }),
                new Promise((_, reject) => setTimeout(() => reject(new Error('WebSocket server close timeout')), 5000)),
            ]);
            // Close HTTP server with 5-second timeout
            await Promise.race([
                new Promise((resolve) => {
                    this.httpServer.close(() => {
                        this.logger.info('HTTP server closed', {
                            duration: Date.now() - shutdownStart,
                        });
                        resolve();
                    });
                }),
                new Promise((_, reject) => setTimeout(() => reject(new Error('HTTP server close timeout')), 5000)),
            ]);
            // Disconnect Redis
            await this.redisCoordinator.disconnect();
            this.logger.info('Redis disconnected', {
                duration: Date.now() - shutdownStart,
            });
            // Close all connections
            this.connectionManager.closeAll();
            this.logger.info('All connections closed', {
                duration: Date.now() - shutdownStart,
            });
            this.logger.info('DDP server stopped', {
                totalDuration: Date.now() - shutdownStart,
            });
            this.metrics.increment('server.stop');
        }
        catch (error) {
            this.logger.error('Failed to stop server', { error });
            this.metrics.increment('server.error');
            throw new errors_1.DDPConnectionError('Server shutdown failed', { cause: error });
        }
    }
}
exports.DDPServer = DDPServer;
//# sourceMappingURL=server.js.map