// BinanceService.js - Client-side service to interact with Binance data through our Vercel API endpoints

/**
 * BinanceService provides methods to fetch market data from Binance through our Vercel API proxies
 */
class BinanceService {
  constructor(baseUrl = '') {
    // Base URL is empty for relative paths when deployed
    // For local development with different ports, you might need to set it explicitly
    this.baseUrl = baseUrl;
  }

  /**
   * Fetch candlestick (klines) data for a symbol
   * @param {string} symbol - Trading pair symbol (e.g., 'BTCUSDT')
   * @param {string} interval - Candlestick interval (e.g., '1h', '1d')
   * @param {number} limit - Number of candles to fetch (optional)
   * @param {number} endTime - End time in ms timestamp (optional)
   * @returns {Promise<Array>} - Array of kline data
   */
  async getKlines(symbol, interval, limit = null, endTime = null) {
    let url = `${this.baseUrl}/api/v3/klines?symbol=${symbol}&interval=${interval}`;
    
    if (limit) url += `&limit=${limit}`;
    if (endTime) url += `&endTime=${endTime}`;
    
    try {
      const response = await fetch(url);
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error('Error fetching klines:', error);
      throw error;
    }
  }

  /**
   * Use the general-purpose proxy endpoint to access various Binance API endpoints
   * @param {string} endpoint - Binance API endpoint (e.g., 'prices', 'time', 'ticker')
   * @param {Object} params - Additional query parameters
   * @returns {Promise<any>} - API response data
   */
  async callProxy(endpoint, params = {}) {
    // Construct URL with endpoint and any additional params
    let queryParams = new URLSearchParams({
      endpoint,
      ...params
    }).toString();
    
    const url = `${this.baseUrl}/api/v3/proxy?${queryParams}`;
    
    try {
      const response = await fetch(url);
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      }
      
      return await response.json();
    } catch (error) {
      console.error(`Error calling proxy endpoint ${endpoint}:`, error);
      throw error;
    }
  }

  /**
   * Get current prices for one or all symbols
   * @param {string} symbol - Optional symbol to get price for
   * @returns {Promise<Object>} - Price data
   */
  async getPrices(symbol = null) {
    const params = symbol ? { symbol } : {};
    return this.callProxy('prices', params);
  }

  /**
   * Get 24h ticker information
   * @param {string} symbol - Optional symbol
   * @returns {Promise<Object|Array>} - Ticker data
   */
  async getTicker(symbol = null) {
    const params = symbol ? { symbol } : {};
    return this.callProxy('ticker', params);
  }

  /**
   * Connect to Binance WebSocket for real-time data
   * @param {string[]} symbols - Array of symbols to watch
   * @param {function} onMessageCallback - Callback function for incoming messages
   * @returns {WebSocket} - WebSocket instance
   */
  async connectToWebSocket(symbols, onMessageCallback) {
    try {
      // First get WebSocket connection info from our API
      const symbolsParam = symbols.join(',');
      const response = await fetch(`${this.baseUrl}/api/v3/ws-info?symbols=${symbolsParam}`);
      
      if (!response.ok) {
        const errorData = await response.json();
        throw new Error(errorData.error || `HTTP error! status: ${response.status}`);
      }
      
      const wsInfo = await response.json();
      
      // Connect directly to Binance WebSocket with the URL our API provided
      const ws = new WebSocket(wsInfo.wsUrl);
      
      // Set up event handlers
      ws.onopen = () => {
        console.log(`WebSocket connected for symbols: ${symbols.join(', ')}`);
      };
      
      ws.onmessage = (event) => {
        try {
          const data = JSON.parse(event.data);
          onMessageCallback(data);
        } catch (error) {
          console.error('Error processing WebSocket message:', error);
        }
      };
      
      ws.onerror = (error) => {
        console.error('WebSocket error:', error);
      };
      
      return ws;
    } catch (error) {
      console.error('Error setting up WebSocket:', error);
      throw error;
    }
  }
}

// Export as a singleton instance
const binanceService = new BinanceService();
export default binanceService;

// Also export the class for custom instantiation if needed
export { BinanceService };