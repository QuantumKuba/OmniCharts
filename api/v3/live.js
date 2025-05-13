import { WebSocketServer } from 'ws';
import WebSocket from 'ws'; // For the client connection to Binance
import http from 'http';

// Store connections: client WebSocket -> Binance WebSocket
// This simple map helps manage and clean up connections.
// For a production system with many users, a more robust shared connection management would be needed.
const clientBinanceMap = new Map();

const server = http.createServer((req, res) => {
  // This basic HTTP server will mostly be used for WebSocket upgrades.
  // You can add a simple health check response if needed for direct HTTP GET.
  if (req.url === '/api/v3/live' && req.method === 'GET') {
    res.writeHead(200, { 'Content-Type': 'text/plain' });
    res.end('WebSocket server is running. Connect via WebSocket protocol.');
  } else {
    // For any other HTTP request to this path, respond with 404.
    res.writeHead(404);
    res.end();
  }
});

const wss = new WebSocketServer({ server }); // Attach WebSocket server to HTTP server

wss.on('connection', (clientWs, req) => {
  console.log('[Vercel WS Proxy] Client connected.');

  let binanceWs = null; // Holds the WebSocket connection to Binance for this client

  clientWs.on('message', async (message) => {
    try {
      const parsedMessage = JSON.parse(message.toString());
      console.log('[Vercel WS Proxy] Received from client:', parsedMessage);

      if (parsedMessage.action === 'subscribe' && parsedMessage.symbols && Array.isArray(parsedMessage.symbols)) {
        // If there's an existing Binance connection for this client, close it before creating a new one.
        if (binanceWs && binanceWs.readyState === WebSocket.OPEN) {
          console.log('[Vercel WS Proxy] Closing existing Binance WS to resubscribe.');
          binanceWs.close();
          clientBinanceMap.delete(clientWs); // Remove old mapping
        }

        // Construct stream names for Binance (e.g., btcusdt@aggTrade/ethusdt@aggTrade)
        const streams = parsedMessage.symbols.map(s => `${s.toLowerCase()}@aggTrade`).join('/');
        const binanceStreamUrl = `wss://stream.binance.com:9443/ws/${streams}`;
        
        console.log(`[Vercel WS Proxy] Attempting to connect to Binance stream: ${binanceStreamUrl}`);
        binanceWs = new WebSocket(binanceStreamUrl);
        clientBinanceMap.set(clientWs, binanceWs); // Map this client to its new Binance WS

        binanceWs.onopen = () => {
          console.log('[Vercel WS Proxy] Successfully connected to Binance. Subscribed to streams:', streams);
          clientWs.send(JSON.stringify({ type: 'status', message: 'Subscribed to Binance streams: ' + streams }));
        };

        binanceWs.onmessage = (event) => {
          // Relay message from Binance to the specific client
          if (clientWs.readyState === WebSocket.OPEN) {
            clientWs.send(event.data.toString());
          }
        };

        binanceWs.onerror = (error) => {
          console.error('[Vercel WS Proxy] Binance WebSocket error:', error.message);
          if (clientWs.readyState === WebSocket.OPEN) {
            clientWs.send(JSON.stringify({ type: 'error', message: 'Binance connection error: ' + error.message }));
          }
          if (binanceWs) {
            binanceWs.close(); // Clean up
          }
        };

        binanceWs.onclose = (event) => {
          console.log(`[Vercel WS Proxy] Binance WebSocket closed. Code: ${event.code}, Reason: ${event.reason}`);
          if (clientWs.readyState === WebSocket.OPEN) {
            clientWs.send(JSON.stringify({ type: 'status', message: 'Binance connection closed.' }));
          }
          // Clean up the mapping if the Binance WS closes
          if (clientBinanceMap.get(clientWs) === binanceWs) {
             clientBinanceMap.delete(clientWs);
          }
        };

      } else {
        if (clientWs.readyState === WebSocket.OPEN) {
          clientWs.send(JSON.stringify({ type: 'error', message: 'Unknown action or invalid message format. Send {action: "subscribe", symbols: ["symbol1", ...]}' }));
        }
      }
    } catch (error) {
      console.error('[Vercel WS Proxy] Error processing client message:', error.message);
      if (clientWs.readyState === WebSocket.OPEN) {
        clientWs.send(JSON.stringify({ type: 'error', message: 'Failed to process your message.' }));
      }
    }
  });

  clientWs.on('close', () => {
    console.log('[Vercel WS Proxy] Client disconnected.');
    const associatedBinanceWs = clientBinanceMap.get(clientWs);
    if (associatedBinanceWs) {
      associatedBinanceWs.close(); // Close the corresponding Binance WebSocket connection
      clientBinanceMap.delete(clientWs);
      console.log('[Vercel WS Proxy] Closed associated Binance WebSocket.');
    }
  });

  clientWs.on('error', (error) => {
    console.error('[Vercel WS Proxy] Client WebSocket error:', error.message);
    const associatedBinanceWs = clientBinanceMap.get(clientWs);
    if (associatedBinanceWs) {
      associatedBinanceWs.close(); // Clean up on error too
      clientBinanceMap.delete(clientWs);
    }
  });
});

// Vercel's runtime environment will handle calling server.listen().
// We export the server instance directly.
export default server;
