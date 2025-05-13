// Simple endpoint to check if the API is running
export default function handler(req, res) {
  // Set CORS headers for all responses
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  // Handle OPTIONS method for CORS preflight requests
  if (req.method === 'OPTIONS') {
    return res.status(200).end();
  }
  
  // Log for debugging
  console.log('[API] Root endpoint accessed');
  
  return res.status(200).json({
    status: "ok",
    message: "OmniCharts API is running",
    endpoints: {
      klines: "/api/v3/klines?symbol=BTCUSDT&interval=1m&limit=10",
      proxy: "/api/v3/proxy?url=exchangeInfo"
    },
    timestamp: new Date().toISOString()
  });
}