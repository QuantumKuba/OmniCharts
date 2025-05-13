import { createClient } from 'binance-api-node';
import cors from 'vercel-cors';

// Create a CORS middleware that allows all origins
const allowCors = cors({ 
  origin: '*',
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
});

// Export the handler wrapped in CORS middleware
export default allowCors(async (req, res) => {
  try {
    // For debugging
    console.log('API endpoint hit: /api/v3/proxy');
    console.log('Query parameters:', req.query);
    
    // Extract endpoint and query parameters
    const { endpoint, ...queryParams } = req.query;
    
    if (!endpoint) {
      console.log('Missing endpoint parameter');
      return res.status(400).json({
        error: 'Missing endpoint parameter. Please provide a Binance API endpoint.'
      });
    }

    // Initialize the Binance client
    const client = createClient({
      // If you need authenticated endpoints, uncomment and set these from env vars
      apiKey: process.env.BINANCE_API_KEY,
      apiSecret: process.env.BINANCE_API_SECRET,
    });

    console.log(`Accessing Binance endpoint: ${endpoint} with params:`, queryParams);

    let data;
    // Handle different Binance API endpoints
    switch(endpoint) {
      case 'time':
        data = await client.time();
        break;
      case 'exchangeInfo':
        data = await client.exchangeInfo(queryParams);
        break;
      case 'candles':
      case 'klines':
        // Ensure required parameters are present
        if (!queryParams.symbol || !queryParams.interval) {
          return res.status(400).json({
            error: 'Missing required parameters for candles. Both symbol and interval are required.'
          });
        }
        data = await client.candles(queryParams);
        break;
      case 'dailyStats':
        data = queryParams.symbol ? 
          await client.dailyStats({ symbol: queryParams.symbol }) :
          await client.dailyStats();
        break;
      case 'prices':
        data = queryParams.symbol ?
          await client.prices({ symbol: queryParams.symbol }) :
          await client.prices();
        break;
      case 'ticker':
        data = queryParams.symbol ?
          await client.ticker({ symbol: queryParams.symbol }) :
          await client.ticker();
        break;
      case 'trades':
        if (!queryParams.symbol) {
          return res.status(400).json({
            error: 'Missing symbol parameter for trades endpoint.'
          });
        }
        data = await client.trades({ 
          symbol: queryParams.symbol,
          limit: queryParams.limit ? parseInt(queryParams.limit) : undefined
        });
        break;
      default:
        return res.status(400).json({
          error: `Unsupported endpoint: ${endpoint}`
        });
    }

    console.log('Proxy request successful');
    return res.status(200).json(data);
    
  } catch (error) {
    console.error('API Error:', error.message);
    return res.status(500).json({ error: error.message });
  }
});