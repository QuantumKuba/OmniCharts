// General purpose proxy to handle any Binance API request
export default async function handler(req, res) {
  try {
    // Extract path and query parameters
    const { url, ...queryParams } = req.query;
    
    // Construct full URL with query parameters
    let binanceUrl = `https://api.binance.com/api/v3/${url || ''}`;
    
    // Add query parameters if they exist
    const queryString = new URLSearchParams(queryParams).toString();
    if (queryString) {
      binanceUrl += `?${queryString}`;
    }

    console.log(`[API General Proxy] Forwarding request to: ${binanceUrl}`);

    // Forward the request to Binance with the same method
    const response = await fetch(binanceUrl, {
      method: req.method,
      headers: {
        'Content-Type': 'application/json',
        // Forward any other necessary headers
      },
      // If this is a POST/PUT request, forward the body
      body: ['POST', 'PUT'].includes(req.method) ? JSON.stringify(req.body) : undefined,
    });
    
    if (!response.ok) {
      throw new Error(`Binance API responded with status: ${response.status}`);
    }

    const data = await response.json();

    // Set CORS headers
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');

    res.status(200).json(data);
  } catch (error) {
    console.error('[API General Proxy] Error:', error.message);
    
    res.setHeader('Access-Control-Allow-Origin', '*');
    res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
    
    res.status(500).json({ error: error.message });
  }
}