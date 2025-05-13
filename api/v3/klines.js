// Serverless function to proxy requests to Binance API
export default async function handler(req, res) {
  try {
    // Extract query parameters from the request
    const { symbol, interval, limit, endTime } = req.query;

    // Construct the URL for Binance API
    let binanceUrl = `https://api.binance.com/api/v3/klines?symbol=${symbol}&interval=${interval}`;
    
    // Add optional parameters if they exist
    if (limit) binanceUrl += `&limit=${limit}`;
    if (endTime) binanceUrl += `&endTime=${endTime}`;

    console.log(`[API Proxy] Forwarding request to: ${binanceUrl}`);

    // Make the request to Binance
    const response = await fetch(binanceUrl);
    
    // Check if the request was successful
    if (!response.ok) {
      throw new Error(`Binance API responded with status: ${response.status}`);
    }

    // Parse the response as JSON
    const data = await response.json();

    // Set CORS headers to allow requests from any origin
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    // Send the response back to the client
    res.status(200).json(data);
  } catch (error) {
    console.error('[API Proxy] Error:', error.message);
    
    // Set CORS headers even for error responses
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    res.status(500).json({ error: error.message });
  }
}