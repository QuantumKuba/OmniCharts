// General purpose proxy to handle any Binance API request
export default async function handler(req, res) {
  // Set CORS headers for all responses
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  // Handle OPTIONS method for CORS preflight requests
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  try {
    // For debugging
    console.log('API endpoint hit: /api/v3/proxy');
    console.log('Query parameters:', req.query);
    
    // Extract path and query parameters
    const { url, ...queryParams } = req.query;
    
    if (!url) {
      console.log('Missing URL parameter');
      return res.status(400).json({
        error: 'Missing URL parameter. Please provide a Binance API endpoint.'
      });
    }
    
    // Construct full URL with query parameters
    let binanceUrl = `https://api.binance.com/api/v3/${url}`;
    
    // Add query parameters if they exist
    const queryString = new URLSearchParams(queryParams).toString();
    if (queryString) {
      binanceUrl += `?${queryString}`;
    }

    console.log(`Forwarding request to: ${binanceUrl}`);

    // Forward the request to Binance with the same method
    const response = await fetch(binanceUrl, {
      method: req.method === 'OPTIONS' ? 'GET' : req.method, // Default to GET for OPTIONS
      headers: {
        'Content-Type': 'application/json',
      },
      // If this is a POST/PUT request, forward the body
      body: ['POST', 'PUT'].includes(req.method) ? JSON.stringify(req.body) : undefined,
    });
    
    if (!response.ok) {
      console.error(`Binance API responded with status: ${response.status}`);
      return res.status(response.status).json({ 
        error: `Binance API error: ${response.statusText}`,
        status: response.status
      });
    }

    const data = await response.json();
    console.log('Proxy request successful');
    
    return res.status(200).json(data);
    
  } catch (error) {
    console.error('API Error:', error.message);
    return res.status(500).json({ error: error.message });
  }
}