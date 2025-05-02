const WebSocket = require('ws');
const { encode, decode } = require('cbor-x');

/**
 * Test client for connecting to the DDP WebSocket server, supporting both CBOR and JSON formats.
 */
async function runTestClient() {
  console.log('Starting DDP test client with CBOR support...');

  const ws = new WebSocket('ws://localhost:3000/websocket');
  const useCbor = true; // Set to false to test JSON fallback

  /**
   * Sends a DDP message, encoding as CBOR or JSON based on useCbor.
   * @param {Object} message - DDP message to send.
   */
  function sendMessage(message) {
    try {
      if (useCbor) {
        const encoded = encode(message);
        ws.send(encoded);
        console.log(`Sent CBOR message (${encoded.length} bytes):`, message);
      } else {
        const encoded = JSON.stringify(message);
        ws.send(encoded);
        console.log(`Sent JSON message (${encoded.length} bytes):`, message);
      }
    } catch (err) {
      console.error('Failed to encode message:', err);
    }
  }

  ws.on('open', () => {
    console.log('Connected to DDP server');

    // Send connect message
    sendMessage({ msg: 'connect', version: '1.0', support: ['1.0'] });

    // Send ping message after connect
    setTimeout(() => {
      sendMessage({ msg: 'ping', id: 'ping1' });
    }, 500);

    // Subscribe to posts publication
    setTimeout(() => {
      sendMessage({ msg: 'sub', id: 'sub1', name: 'posts', params: [] });
    }, 500);

    // Call testMethod
    setTimeout(() => {
      sendMessage({
        msg: 'method',
        id: 'method1',
        method: 'testMethod',
        params: ['Hello, DDP!'],
      });
    }, 500);
  });

  ws.on('message', (data, isBinary) => {
    try {
      let message;
      if (isBinary) {
        message = decode(new Uint8Array(data));
        console.log(`Received CBOR message (${data.length} bytes):`, message);
      } else {
        message = JSON.parse(data.toString());
        console.log(`Received JSON message (${data.length} bytes):`, message);
      }

      // Verify responses
      if (message.msg === 'connected') {
        console.log('✔ Connect successful, session:', message.session);
      } else if (message.msg === 'pong') {
        console.log('✔ Ping successful, id:', message.id);
      } else if (message.msg === 'ready') {
        console.log('✔ Subscription ready, subs:', message.subs);
      } else if (message.msg === 'added') {
        console.log(
          '✔ Document added:',
          message.collection,
          message.id,
          message.fields
        );
      } else if (message.msg === 'result') {
        console.log('✔ Method result:', message.result);
      } else if (message.msg === 'error') {
        console.error('✘ Error:', message.reason, message.details);
      }
    } catch (err) {
      console.error('Failed to decode message:', err);
    }
  });

  ws.on('error', (err) => {
    console.error('WebSocket error:', err);
  });

  ws.on('close', (code, reason) => {
    console.log('Disconnected:', code, reason.toString());
    process.exit(0);
  });

  // Timeout after 10 seconds
  setTimeout(() => {
    console.log('Test timeout, closing connection...');
    ws.close();
  }, 10000);
}

runTestClient().catch((err) => {
  console.error('Test client failed:', err);
  process.exit(1);
});
