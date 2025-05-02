# Meteor DDP Server

> This project is still in development not yet ready for production use or publication to npm.

A modern implementation of the Distributed Data Protocol (DDP) server for Meteor.js, built with TypeScript, Node.js, and ws for high performance and scalability.
Features

- High-performance WebSocket handling with ws.
- Efficient message serialization with CBOR.
- Distributed subscription coordination with Redis.
- Structured logging with pino.
- Metrics collection with Prometheus.
- Type-safe codebase with TypeScript.
- Comprehensive test suite with Jest.

### Installation (soon to be published)

```bash
npm install mvogttech/ddp-server
```

Usage

```javascript
import { DDPServer } from 'mvogttech/ddp-server';

const server = new DDPServer();

server.publish('posts', async (params, context) => {
  // Return a cursor or array of cursors
  return Posts.find({});
});

server.method('createPost', async ([content], context) => {
  return Posts.insert({ content, userId: context.userId });
});

await server.start(3000);
```

### Configuration

- REDIS_URL: URL for Redis connection (default: redis://localhost:6379).
- LOG_LEVEL: Logging level for pino (default: info).
- SERVER_WEBSOCKET_COMPRESSION: Enable WebSocket compression (default: true).

Development

# Build the project

```bash
npm run build
```

# Setup Local Redis Server

> Docker is required for local Redis server setup. If you don’t have it, download and install Docker from the [official website](https://www.docker.com/get-started).

Install Docker and run the following commands to set up a local Redis server:

```bash
docker pull redis:latest
```

```bash
docker run -d --name redis -p 6379:6379 redis:latest
```

# Run tests

```bash
npm run test
```

# Generate API documentation

```bash
npm run docs
```

Contributing
See CONTRIBUTING.md for guidelines on contributing to this project.
License
MIT
