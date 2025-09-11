const http = require('http');
const fs = require('fs');
const path = require('path');
const { apiKeys } = require('./googleApis');

let currentTimer = null;
const tallies = {};
const contacts = [
  { id: 1, name: 'Alice', phone: '+15551234567' },
  { id: 2, name: 'Bob', phone: '+15557654321' }
];
const callLogs = [
  { id: 1, contact: 'Alice', type: 'incoming', time: Date.now() - 600000, duration: 120 },
  { id: 2, contact: 'Bob', type: 'outgoing', time: Date.now() - 3600000, duration: 240 }
];

const configuredApis = Object.keys(apiKeys).filter(k => apiKeys[k]);
console.log('Google APIs configured:', configuredApis.join(', ') || 'none');

// MIME type mapping for static files
const mimeTypes = {
  '.html': 'text/html',
  '.js': 'text/javascript',
  '.css': 'text/css',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpg',
  '.gif': 'image/gif',
  '.ico': 'image/x-icon',
  '.svg': 'image/svg+xml',
  '.wav': 'audio/wav',
  '.mp4': 'video/mp4',
  '.woff': 'application/font-woff',
  '.ttf': 'application/font-ttf',
  '.eot': 'application/vnd.ms-fontobject',
  '.otf': 'application/font-otf',
  '.wasm': 'application/wasm'
};

function json(res, status, obj) {
  res.writeHead(status, { 
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type'
  });
  res.end(JSON.stringify(obj));
}

function parseBody(req, cb) {
  let body = '';
  req.on('data', chunk => { body += chunk; });
  req.on('end', () => {
    try { cb(JSON.parse(body || '{}')); } catch { cb({}); }
  });
}

// Request logging middleware
function logRequest(req) {
  const timestamp = new Date().toISOString();
  console.log(`${timestamp} ${req.method} ${req.url}`);
}

const server = http.createServer((req, res) => {
  // Log all requests
  logRequest(req);

  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    res.writeHead(200, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type'
    });
    res.end();
    return;
  }

  // Health check endpoint for deployment monitoring
  if (req.url === '/health' || req.url === '/api/health') {
    json(res, 200, { 
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      version: process.env.npm_package_version || '1.0.0'
    });
    return;
  }
  if (req.url === '/api/timer/start' && req.method === 'POST') {
    parseBody(req, data => {
      try {
        const seconds = Number(data.seconds) || 0;
        if (seconds < 0 || seconds > 86400) { // Max 24 hours
          json(res, 400, { error: 'Timer duration must be between 0 and 86400 seconds' });
          return;
        }
        currentTimer = {
          title: (data.title || 'Timer').toString().substring(0, 100), // Limit title length
          end: Date.now() + seconds * 1000
        };
        json(res, 200, { status: 'started', timer: currentTimer });
      } catch (error) {
        console.error('Error starting timer:', error);
        json(res, 500, { error: 'Internal server error' });
      }
    });
    return;
  }
  if (req.url === '/api/timer/stop' && req.method === 'POST') {
    currentTimer = null;
    json(res, 200, { status: 'stopped' });
    return;
  }
  if (req.url === '/api/timer/status') {
    try {
      if (currentTimer) {
        const remaining = Math.max(0, currentTimer.end - Date.now());
        if (remaining === 0) {
          currentTimer = null;
          json(res, 200, { running: false });
        } else {
          json(res, 200, { 
            running: true, 
            title: currentTimer.title, 
            remaining,
            remainingSeconds: Math.ceil(remaining / 1000)
          });
        }
      } else {
        json(res, 200, { running: false });
      }
    } catch (error) {
      console.error('Error getting timer status:', error);
      json(res, 500, { error: 'Internal server error' });
    }
    return;
  }
  if (req.url === '/api/tally' && req.method === 'GET') {
    json(res, 200, tallies);
    return;
  }
  if (req.url === '/api/tally/create' && req.method === 'POST') {
    parseBody(req, data => {
      try {
        const name = (data.name || '').trim();
        if (!name) {
          json(res, 400, { error: 'Name is required' });
          return;
        }
        if (name.length > 50) {
          json(res, 400, { error: 'Name must be 50 characters or less' });
          return;
        }
        if (!tallies[name]) tallies[name] = 0;
        json(res, 200, tallies);
      } catch (error) {
        console.error('Error creating tally:', error);
        json(res, 500, { error: 'Internal server error' });
      }
    });
    return;
  }
  if (req.url === '/api/tally/increment' && req.method === 'POST') {
    parseBody(req, data => {
      try {
        const name = (data.name || '').trim();
        if (!name) {
          json(res, 400, { error: 'Name is required' });
          return;
        }
        if (!tallies[name]) tallies[name] = 0;
        tallies[name] += 1;
        json(res, 200, { name, count: tallies[name] });
      } catch (error) {
        console.error('Error incrementing tally:', error);
        json(res, 500, { error: 'Internal server error' });
      }
    });
    return;
  }

  if (req.url === '/api/chat' && req.method === 'POST') {
    parseBody(req, data => {
      try {
        const msg = (data.message || '').toString().trim();
        if (!msg) {
          json(res, 400, { error: 'Message is required' });
          return;
        }
        if (msg.length > 500) {
          json(res, 400, { error: 'Message must be 500 characters or less' });
          return;
        }
        const reply = `Radar Oriley: I hear you say, "${msg}". Consider it done!`;
        json(res, 200, { reply });
      } catch (error) {
        console.error('Error processing chat:', error);
        json(res, 500, { error: 'Internal server error' });
      }
    });
    return;
  }

  if (req.url === '/api/contacts' && req.method === 'GET') {
    json(res, 200, contacts);
    return;
  }

  if (req.url === '/api/call-logs' && req.method === 'GET') {
    json(res, 200, callLogs);
    return;
  }

  // Serve static files
  let filePath = path.join(__dirname, 'public', req.url === '/' ? 'index.html' : req.url);
  
  // Security: prevent directory traversal
  if (!filePath.startsWith(path.join(__dirname, 'public'))) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }

  const ext = path.extname(filePath);
  const contentType = mimeTypes[ext] || 'application/octet-stream';
  
  fs.readFile(filePath, (err, content) => {
    if (err) {
      if (err.code === 'ENOENT') {
        res.writeHead(404, { 'Content-Type': 'text/html' });
        res.end('<!DOCTYPE html><html><head><title>404 Not Found</title></head><body><h1>404 Not Found</h1><p>The requested resource could not be found.</p></body></html>');
      } else {
        console.error('Error serving file:', err);
        res.writeHead(500, { 'Content-Type': 'text/html' });
        res.end('<!DOCTYPE html><html><head><title>500 Internal Server Error</title></head><body><h1>500 Internal Server Error</h1></body></html>');
      }
      return;
    }
    
    // Set appropriate headers for static files
    const headers = {
      'Content-Type': contentType,
      'Cache-Control': ext === '.html' ? 'no-cache' : 'public, max-age=86400'
    };
    
    res.writeHead(200, headers);
    res.end(content);
  });
});

// Configure port - use environment variable or default to 3000
const port = process.env.PORT || 3000;

server.listen(port, () => {
  console.log(`Server listening on http://localhost:${port}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`Health check available at: http://localhost:${port}/health`);
});

// Graceful shutdown handling
process.on('SIGTERM', () => {
  console.log('SIGTERM received, shutting down gracefully');
  server.close(() => {
    console.log('Process terminated');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  console.log('SIGINT received, shutting down gracefully');
  server.close(() => {
    console.log('Process terminated');
    process.exit(0);
  });
});

// Handle uncaught exceptions
process.on('uncaughtException', (err) => {
  console.error('Uncaught Exception:', err);
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  process.exit(1);
});
