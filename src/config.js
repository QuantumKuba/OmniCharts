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
};

export default config;