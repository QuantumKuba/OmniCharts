import { createClient } from 'binance-api-node';
import cors from 'vercel-cors';

// Create a CORS middleware that allows all origins
const allowCors = cors({ 
  origin: '*',
  methods: ['GET', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
});

// Export the handler wrapped in CORS middleware
export default allowCors(async (req, res) => {
  try {
    // For debugging
    console.log('API endpoint hit: /api/v3/klines');
    console.log('Query parameters:', req.query);

    // Extract query parameters from the request
    const { symbol, interval, limit, endTime } = req.query;
    
    // Check for required parameters
    if (!symbol || !interval) {
      console.log('Missing required parameters');
      return res.status(400).json({ 
        error: 'Missing required parameters. Both symbol and interval are required.'
      });
    }

    // Initialize the Binance client
    // Note: API key and secret are optional for public endpoints like klines
    const client = createClient({
      // If you need authenticated endpoints, uncomment and set these from env vars
      // apiKey: process.env.BINANCE_API_KEY,
      // apiSecret: process.env.BINANCE_API_SECRET,
    });

    // Build options object for the API call
    const options = {
      symbol: symbol,
      interval: interval
    };

    // Add optional parameters if they exist
    if (limit) options.limit = parseInt(limit);
    if (endTime) options.endTime = parseInt(endTime);

    console.log(`Fetching klines with options:`, options);

    // Make the request using the Binance client
    const data = await client.candles(options);
    console.log(`Success! Received ${data.length} data points`);

    // Send the response back to the client
    return res.status(200).json(data);
  } catch (error) {
    console.error('API Error:', error.message);
    return res.status(500).json({ error: error.message });
  }
});