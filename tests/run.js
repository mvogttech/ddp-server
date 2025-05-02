const { DDPServer } = require('../dist/index.js');

/**
 * Starts the DDP server with test handlers for client connection testing.
 */
async function startTestServer() {
  console.log('Starting DDP test server...');

  const server = new DDPServer({
    heartbeatInterval: 5000,
    heartbeatTimeout: 30000,
    enableClustering: true,
  });

  // Connect to Redis
  //   try {
  //     console.log('Connecting to Redis...');
  //     await server.redisCoordinator.connect();
  //     console.log('Redis connected');
  //   } catch (err) {
  //     console.error('Failed to connect to Redis:', err);
  //     process.exit(1);
  //   }

  // Register a test publication
  try {
    console.log('Registering publication: posts');
    server.publish('posts', async (params, context) => {
      console.log('Client subscribed to posts:', params);
      return {
        _publishCursor: async (ctx) => {
          console.log('Publishing cursor data for posts:', {
            title: 'Test Post',
            content: 'Hello, DDP!',
          });
          ctx.added('posts', 'doc1', {
            title: 'Test Post',
            content: 'Hello, DDP!',
            createdAt: new Date(),
            authorId: 'user0',
            comments: [
              {
                authorId: 'user1',
                content: 'Great post!',
                timestamp: new Date(),
              },
            ],
          });
          ctx.ready();
        },
        _getCollectionName: () => 'posts',
      };
    });
    console.log('Registered publication: posts');
  } catch (err) {
    console.error('Failed to register publication: posts', err);
  }

  // Register a test method
  server.method('testMethod', async ([value], context) => {
    console.log('Client called testMethod:', value);
    console.log('context:', context);
    return value;
  });

  try {
    await server.start(2999);
    console.log('DDP server running on ws://localhost:3000/websocket');
  } catch (err) {
    console.error('Failed to start DDP server:', err);
    process.exit(1);
  }

  // Handle graceful shutdown
  process.on('SIGINT', async () => {
    console.log('Shutting down DDP server...');
    await server.stop();
    process.exit(0);
  });
}

startTestServer().catch((err) => {
  console.error('Test server failed:', err);
  process.exit(1);
});
