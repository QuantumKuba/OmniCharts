// Serverless function to proxy requests to Binance API
export default async function handler(req, res) {
  // Set CORS headers for all responses
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  // Handle OPTIONS method for CORS preflight requests
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  try {
    // Extract query parameters from the request
    const { symbol, interval, limit, endTime } = req.query;
    
    // Check for required parameters
    if (!symbol || !interval) {
      return res.status(400).json({ 
        error: 'Missing required parameters. Both symbol and interval are required.'
      });
    }

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
      console.error(`[API Proxy] Binance API responded with status: ${response.status}`);
      return res.status(response.status).json({ 
        error: `Binance API error: ${response.statusText}`,
        status: response.status
      });
    }

    // Parse the response as JSON
    const data = await response.json();

    // Send the response back to the client
    return res.status(200).json(data);
  } catch (error) {
    console.error('[API Proxy] Error:', error.message);
    return res.status(500).json({ error: error.message });
  }
}