import http from 'http';

const PORT = 3001;

const mockResponses = {
  '/api/auth/login': {
    user: { id: 1, email: 'traveler@example.com', role: 'TRAVELER', name: 'Test Traveler' },
    token: 'mock-jwt-token-12345'
  },
  '/api/search': {
    properties: [
      { id: 1, title: 'Cozy Apartment', city: 'San Jose', price_per_night: 120 },
      { id: 2, title: 'Luxury Villa', city: 'San Jose', price_per_night: 350 }
    ]
  },
  '/api/bookings': {
    booking: { id: 1, status: 'PENDING', total_price: 360 }
  }
};

const server = http.createServer((req, res) => {
  const url = req.url.split('?')[0];
  
  // CORS headers
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }
  
  // Health check
  if (url === '/health') {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, service: 'mock-traveler-service' }));
    return;
  }
  
  // Mock responses
  const mockData = mockResponses[url];
  if (mockData) {
    res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(mockData));
    return;
  }
  
  // Default 404
  res.writeHead(404, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify({ error: 'Not found' }));
});

server.listen(PORT, () => {
  console.log(`✅ Mock traveler-service running on http://localhost:${PORT}`);
  console.log('Available endpoints:');
  console.log('  - POST /api/auth/login');
  console.log('  - GET  /api/search');
  console.log('  - POST /api/bookings');
});
