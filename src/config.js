// Configuration for different environments

// Determine the current environment
const isProduction = window.location.hostname !== 'localhost' && 
                    !window.location.hostname.includes('127.0.0.1');

// API Configuration
const config = {
  // Base API URL - use relative path for local development, absolute for production
  apiBaseUrl: isProduction ? '' : '',
  
  // Binance API endpoints
  endpoints: {
    klines: '/api/v3/klines',
    exchangeInfo: '/api/v3/exchangeInfo',
  },
  
  // Default chart settings
  defaultSymbol: 'BTCUSDT',
  defaultTimeframe: '5m',
  
  // API request limits
  maxCandlesPerRequest: 1000,
  minRequestInterval: 500, // ms

  // WebSocket URL
  // For production, it will be wss://<your-app-domain>/api/v3/live
  // For local dev, it will be ws://localhost:<port>/api/v3/live
  websocketUrl: isProduction 
    ? `wss://${window.location.hostname}/api/v3/live` 
    : `ws://${window.location.hostname}:3000/api/v3/live`, // Assuming Vercel dev runs on 3000 or adjust if different
};

export default config;
