const http = require('http');
const WebSocket = require('ws');
const { encode, decode } = require('cbor-x');
const { DDPServer } = require('../../dist/index.js');

// Increase max sockets to handle high concurrency
http.globalAgent.maxSockets = 50000;

/**
 * Delays execution for a specified time.
 * @param ms - Milliseconds to delay.
 */
async function delay(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function runLoadTest(useCbor = true, connectionCount = 1000) {
  const format = useCbor ? 'CBOR' : 'JSON';
  console.log(
    `Starting connection load test with ${format} (${connectionCount} connections)...`
  );

  const results = {
    format,
    connectionsPerSec: 0,
    latencyAvg: 0,
    latencyP95: 0,
    throughput: 0,
    errors: 0,
    timeouts: 0,
    totalConnections: 0,
    messageSizes: [],
    errorDetails: [],
    connectionTimes: [],
    messageLatencies: [],
  };

  const clients = [];
  const startTime = Date.now();
  const batchSize = 100; // Connect in batches to avoid spikes
  const batchDelay = 50; // 50ms delay between batches

  // Create WebSocket clients in batches
  for (let i = 0; i < connectionCount; i += batchSize) {
    const batch = [];
    for (let j = 0; j < batchSize && i + j < connectionCount; j++) {
      const clientIndex = i + j;
      batch.push(
        new Promise(async (resolve, reject) => {
          const clientStartTime = Date.now();
          const ws = new WebSocket('ws://localhost:3000/websocket', {
            timeout: 20000,
          });

          ws.on('open', () => {
            const connectTime = Date.now() - clientStartTime;
            results.connectionTimes.push(connectTime);

            // Send connect message
            const connectMsg = {
              msg: 'connect',
              version: '1.0',
              support: ['1.0'],
            };
            const connectData = useCbor
              ? encode(connectMsg)
              : JSON.stringify(connectMsg);
            results.messageSizes.push(connectData.length);
            ws.send(connectData);

            // Send ping message
            setTimeout(() => {
              const pingMsg = { msg: 'ping', id: 'ping1' };
              const pingData = useCbor
                ? encode(pingMsg)
                : JSON.stringify(pingMsg);
              results.messageSizes.push(pingData.length);
              ws.send(pingData);
            }, 100);

            // Subscribe to posts
            setTimeout(() => {
              const subMsg = {
                msg: 'sub',
                id: 'sub1',
                name: 'posts',
                params: [],
              };
              const subData = useCbor ? encode(subMsg) : JSON.stringify(subMsg);
              results.messageSizes.push(subData.length);
              ws.send(subData);
            }, 200);
          });

          ws.on('message', (data, isBinary) => {
            try {
              const message = isBinary
                ? decode(new Uint8Array(data))
                : JSON.parse(data.toString());
              if (
                message.msg === 'connected' ||
                message.msg === 'pong' ||
                message.msg === 'ready'
              ) {
                const latency = Date.now() - clientStartTime;
                results.messageLatencies.push(latency);
                console.log(
                  `Client ${clientIndex}: Received ${message.msg} in ${latency}ms (${format})`
                );
              }
              results.messageSizes.push(data.length);
              results.throughput += data.length;
            } catch (err) {
              console.error(
                `Client ${clientIndex}: Failed to parse message:`,
                err
              );
              results.errorDetails.push({
                client: clientIndex,
                type: 'parse',
                error: err.message,
              });
              results.errors++;
            }
          });

          ws.on('error', (err) => {
            console.error(
              `Client ${clientIndex}: WebSocket error: ${err.message}`
            );
            results.errorDetails.push({
              client: clientIndex,
              type: 'websocket',
              error: err.message,
            });
            results.errors++;
            reject(err);
          });

          ws.on('close', (code, reason) => {
            console.log(
              `Client ${clientIndex}: Closed with code ${code}, reason: ${reason.toString()}`
            );
            if (code !== 1000) {
              results.errorDetails.push({
                client: clientIndex,
                type: 'close',
                code,
                reason: reason.toString(),
              });
              results.errors++;
            }
            resolve();
          });

          // Timeout after 20 seconds
          setTimeout(() => {
            if (ws.readyState !== WebSocket.OPEN) {
              console.error(`Client ${clientIndex}: Connection timed out`);
              results.errorDetails.push({
                client: clientIndex,
                type: 'timeout',
              });
              results.timeouts++;
              ws.close();
              reject(new Error('Connection timed out'));
            }
          }, 20000);
        })
      );
    }
    await Promise.allSettled(batch);
    await delay(batchDelay); // Delay between batches
  }

  try {
    const duration = (Date.now() - startTime) / 1000; // seconds
    results.totalConnections = connectionCount - results.timeouts;
    results.connectionsPerSec = results.totalConnections / duration;
    results.latencyAvg = results.messageLatencies.length
      ? results.messageLatencies.reduce((a, b) => a + b, 0) /
        results.messageLatencies.length
      : 0;
    results.latencyP95 = results.messageLatencies.length
      ? results.messageLatencies.sort((a, b) => a - b)[
          Math.floor(results.messageLatencies.length * 0.95)
        ] || 0
      : 0;
    results.throughput = (results.throughput / duration / 1024).toFixed(2); // KB/sec

    console.log(`${format} Load Test Results:`);
    console.log(`- Connections/sec: ${results.connectionsPerSec.toFixed(2)}`);
    console.log(
      `- Connection Latency (avg): ${results.latencyAvg.toFixed(2)}ms`
    );
    console.log(
      `- Connection Latency (p95): ${results.latencyP95.toFixed(2)}ms`
    );
    console.log(`- Throughput: ${results.throughput} KB/sec`);
    console.log(`- Errors: ${results.errors}`);
    console.log(`- Timeouts: ${results.timeouts}`);
    console.log(`- Total Connections: ${results.totalConnections}`);
    console.log(
      `- Average Message Size: ${(results.messageSizes.reduce((a, b) => a + b, 0) / (results.messageSizes.length || 1)).toFixed(2)} bytes`
    );
    console.log(`- Error Details:`, results.errorDetails);
  } catch (err) {
    console.error('Load test failed:', err);
  }

  return results;
}

async function runAllTests() {
  console.log('Running performance tests for CBOR and JSON...');

  // Run CBOR test
  const cborResults = await runLoadTest(true, 100);

  // Run JSON test
  //const jsonResults = await runLoadTest(false, 1000);

  // Compare results
  console.log('\nPerformance Comparison:');
  console.log(
    '| Metric                  | CBOR            | JSON            |'
  );
  console.log(
    '|-------------------------|-----------------|-----------------|'
  );
  console.log(
    `| Connections/sec         | ${cborResults.connectionsPerSec.toFixed(2)} | ${jsonResults.connectionsPerSec.toFixed(2)} |`
  );
  console.log(
    `| Latency (avg, ms)       | ${cborResults.latencyAvg.toFixed(2)} | ${jsonResults.latencyAvg.toFixed(2)} |`
  );
  console.log(
    `| Latency (p95, ms)       | ${cborResults.latencyP95.toFixed(2)} | ${jsonResults.latencyP95.toFixed(2)} |`
  );
  console.log(
    `| Throughput (KB/sec)     | ${cborResults.throughput} | ${jsonResults.throughput} |`
  );
  console.log(
    `| Errors                  | ${cborResults.errors} | ${jsonResults.errors} |`
  );
  console.log(
    `| Timeouts                | ${cborResults.timeouts} | ${jsonResults.timeouts} |`
  );
  console.log(
    `| Total Connections       | ${cborResults.totalConnections} | ${jsonResults.totalConnections} |`
  );
  console.log(
    `| Avg Message Size (bytes)| ${(cborResults.messageSizes.reduce((a, b) => a + b, 0) / (cborResults.messageSizes.length || 1)).toFixed(2)} | ${(jsonResults.messageSizes.reduce((a, b) => a + b, 0) / (jsonResults.messageSizes.length || 1)).toFixed(2)} |`
  );
}

runAllTests().catch((err) => {
  console.error('Performance tests failed:', err);
  process.exit(1);
});
