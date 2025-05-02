import { WebSocket } from 'k6/ws';
import { check, sleep } from 'k6';
import { Counter } from 'k6/metrics';

// Custom metrics
const methodLatency = new Counter('ddp_method_latency_ms');
const subscriptionLatency = new Counter('ddp_subscription_latency_ms');

export const options = {
  vus: 10000, // Virtual users (simulate 10,000 concurrent connections)
  duration: '30s', // Run for 30 seconds
  thresholds: {
    ddp_method_latency_ms: ['p(95)<100'], // 95th percentile latency under 100ms
    ddp_subscription_latency_ms: ['p(95)<150'], // 95th percentile latency under 150ms
    ws_connecting: ['p(95)<50'], // Connection time under 50ms
  },
};

export default function () {
  const url = 'ws://localhost:3000/websocket';
  const params = { tags: { test: 'ddp_performance' } };

  // Connect to the DDP server
  const ws = new WebSocket(url, null, params);
  ws.on('open', () => {
    // Send connect message
    ws.send(
      JSON.stringify({ msg: 'connect', version: '1.0', support: ['1.0'] })
    );

    // Measure method call latency
    const methodStart = Date.now();
    ws.send(
      JSON.stringify({
        msg: 'method',
        id: `method-${Date.now()}`,
        method: 'testMethod',
        params: ['test'],
      })
    );
    ws.on('message', (data) => {
      const msg = JSON.parse(data);
      if (msg.msg === 'result' && msg.id.startsWith('method-')) {
        methodLatency.add(Date.now() - methodStart);
        check(msg, { 'Method call succeeded': (r) => r.result === 'test' });
      }
    });

    // Measure subscription latency
    const subStart = Date.now();
    ws.send(
      JSON.stringify({
        msg: 'sub',
        id: `sub-${Date.now()}`,
        name: 'posts',
        params: [],
      })
    );
    ws.on('message', (data) => {
      const msg = JSON.parse(data);
      if (msg.msg === 'ready' && msg.subs.includes(`sub-${Date.now()}`)) {
        subscriptionLatency.add(Date.now() - subStart);
        check(msg, { 'Subscription ready': (r) => r.subs.length > 0 });
      }
    });

    // Simulate client activity
    sleep(1);
  });

  ws.on('error', (err) => {
    console.error('WebSocket error:', err);
  });

  ws.on('close', () => {
    // Connection closed
  });

  // Close the connection after the test
  ws.close();
}
