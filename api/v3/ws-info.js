// filepath: /Users/kuba/Documents/Github/OmniCharts/api/v3/ws-info.js
import cors from 'vercel-cors';

// Create a CORS middleware that allows all origins
const allowCors = cors({ 
  origin: '*',
  methods: ['GET', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
});

// This endpoint provides information for clients to connect directly to Binance WebSockets
export default allowCors(async (req, res) => {
  try {
    // For debugging
    console.log('API endpoint hit: /api/v3/ws-info');
    console.log('Query parameters:', req.query);

    // Get the symbols from the query
    const { symbols } = req.query;
    
    if (!symbols) {
      return res.status(400).json({ 
        error: 'Missing required parameter: symbols (comma-separated list)'
      });
    }

    // Parse the symbols
    const symbolList = symbols.split(',');
    
    if (symbolList.length === 0) {
      return res.status(400).json({
        error: 'No valid symbols provided'
      });
    }

    // Construct stream names for Binance (e.g., btcusdt@aggTrade/ethusdt@aggTrade)
    const streams = symbolList.map(s => `${s.toLowerCase()}@aggTrade`).join('/');
    const binanceStreamUrl = `wss://stream.binance.com:9443/ws/${streams}`;

    // Return the WebSocket URL and configuration details to the client
    return res.status(200).json({
      wsUrl: binanceStreamUrl,
      symbols: symbolList,
      streams: streams.split('/'),
      instructions: "Connect directly to this WebSocket URL from your client-side code"
    });
    
  } catch (error) {
    console.error('API Error:', error.message);
    return res.status(500).json({ error: error.message });
  }
});