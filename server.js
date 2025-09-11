const http = require('http');
const fs = require('fs');
const path = require('path');
const { apiKeys } = require('./googleApis');

// Configuration
const PORT = process.env.PORT || 3000;
const HOST = process.env.HOST || 'localhost';

// Application state
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

// Logging utility
function log(level, message, data = {}) {
  const timestamp = new Date().toISOString();
  const logEntry = {
    timestamp,
    level,
    message,
    ...data
  };
  console.log(`[${timestamp}] ${level.toUpperCase()}: ${message}`, 
    Object.keys(data).length ? data : '');
}

// API configuration logging
const configuredApis = Object.keys(apiKeys).filter(k => apiKeys[k]);
log('info', 'Server starting', { 
  port: PORT, 
  host: HOST,
  configuredApis: configuredApis.length ? configuredApis : ['none']
});

// Enhanced JSON response helper
function json(res, status, obj, headers = {}) {
  const responseHeaders = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization',
    ...headers
  };
  
  res.writeHead(status, responseHeaders);
  const response = {
    success: status >= 200 && status < 300,
    data: obj,
    timestamp: new Date().toISOString()
  };
  res.end(JSON.stringify(response, null, 2));
}

// Enhanced error response helper
function errorResponse(res, status, message, details = {}) {
  log('error', message, { status, ...details });
  json(res, status, {
    error: message,
    ...details
  });
}

// Enhanced body parser with validation
function parseBody(req, cb) {
  let body = '';
  req.on('data', chunk => { 
    body += chunk; 
    // Prevent abuse - limit body size to 1MB
    if (body.length > 1024 * 1024) {
      errorResponse(res, 413, 'Request body too large');
      req.destroy();
      return;
    }
  });
  req.on('end', () => {
    try { 
      const parsed = JSON.parse(body || '{}');
      cb(parsed); 
    } catch (error) { 
      log('warn', 'Invalid JSON in request body', { body });
      cb({}); 
    }
  });
  req.on('error', (error) => {
    log('error', 'Request parsing error', { error: error.message });
    cb({});
  });
}

// API route handlers
const apiRoutes = {
  // Timer API
  'POST /api/timer/start': (req, res) => {
    parseBody(req, data => {
      const seconds = Number(data.seconds) || 0;
      if (seconds <= 0) {
        return errorResponse(res, 400, 'Invalid timer duration');
      }
      currentTimer = {
        title: data.title || 'Timer',
        end: Date.now() + seconds * 1000
      };
      log('info', 'Timer started', { title: currentTimer.title, seconds });
      json(res, 200, { status: 'started', timer: currentTimer });
    });
  },

  'POST /api/timer/stop': (req, res) => {
    if (currentTimer) {
      log('info', 'Timer stopped', { title: currentTimer.title });
      currentTimer = null;
    }
    json(res, 200, { status: 'stopped' });
  },

  'GET /api/timer/status': (req, res) => {
    if (currentTimer) {
      const remaining = Math.max(0, currentTimer.end - Date.now());
      if (remaining === 0) {
        log('info', 'Timer completed', { title: currentTimer.title });
        currentTimer = null;
        json(res, 200, { running: false, completed: true });
      } else {
        json(res, 200, { running: true, title: currentTimer.title, remaining });
      }
    } else {
      json(res, 200, { running: false });
    }
  },

  // Tally API
  'GET /api/tally': (req, res) => {
    json(res, 200, tallies);
  },

  'POST /api/tally/create': (req, res) => {
    parseBody(req, data => {
      const name = (data.name || '').trim();
      if (!name) {
        return errorResponse(res, 400, 'Counter name is required');
      }
      if (!tallies[name]) {
        tallies[name] = 0;
        log('info', 'Tally counter created', { name });
      }
      json(res, 200, tallies);
    });
  },

  'POST /api/tally/increment': (req, res) => {
    parseBody(req, data => {
      const name = (data.name || '').trim();
      if (!name) {
        return errorResponse(res, 400, 'Counter name is required');
      }
      if (!tallies[name]) tallies[name] = 0;
      tallies[name] += 1;
      log('info', 'Tally counter incremented', { name, count: tallies[name] });
      json(res, 200, { name, count: tallies[name] });
    });
  },

  // Chat API
  'POST /api/chat': (req, res) => {
    parseBody(req, data => {
      const msg = (data.message || '').toString().trim();
      if (!msg) {
        return errorResponse(res, 400, 'Message is required');
      }
      const reply = `Radar Oriley: I hear you say, "${msg}". Consider it done!`;
      log('info', 'Chat message processed', { message: msg });
      json(res, 200, { reply });
    });
  },

  // Contacts API
  'GET /api/contacts': (req, res) => {
    json(res, 200, contacts);
  },

  // Call logs API
  'GET /api/call-logs': (req, res) => {
    json(res, 200, callLogs);
  },

  // Health check
  'GET /api/health': (req, res) => {
    json(res, 200, {
      status: 'healthy',
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      configuredApis: configuredApis.length
    });
  }
};

const server = http.createServer((req, res) => {
  const startTime = Date.now();
  const routeKey = `${req.method} ${req.url}`;
  
  // Log all requests
  log('info', 'Request received', { 
    method: req.method, 
    url: req.url, 
    userAgent: req.headers['user-agent'],
    ip: req.headers['x-forwarded-for'] || req.connection.remoteAddress 
  });

  // Handle CORS preflight
  if (req.method === 'OPTIONS') {
    res.writeHead(200, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    });
    res.end();
    return;
  }

  // Handle API routes
  if (apiRoutes[routeKey]) {
    try {
      apiRoutes[routeKey](req, res);
    } catch (error) {
      log('error', 'API route error', { route: routeKey, error: error.message });
      errorResponse(res, 500, 'Internal server error');
    }
    return;
  }

  // Serve static files
  let filePath = path.join(__dirname, 'public', req.url === '/' ? 'index.html' : req.url);
  const ext = path.extname(filePath);
  const mimeTypes = {
    '.html': 'text/html',
    '.js': 'text/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon'
  };

  fs.readFile(filePath, (err, content) => {
    const responseTime = Date.now() - startTime;
    
    if (err) {
      log('warn', 'File not found', { path: filePath, responseTime });
      res.writeHead(404, { 'Content-Type': 'text/html' });
      res.end(`
        <!DOCTYPE html>
        <html>
        <head><title>404 - Not Found</title></head>
        <body>
          <h1>404 - File Not Found</h1>
          <p>The requested resource was not found on this server.</p>
          <a href="/">← Back to Home</a>
        </body>
        </html>
      `);
      return;
    }

    const contentType = mimeTypes[ext] || 'text/plain';
    const isDevelopment = process.env.NODE_ENV !== 'production';
    const cacheControl = ext === '.html' || (isDevelopment && ext === '.js') 
      ? 'no-cache' 
      : 'public, max-age=3600';
    
    res.writeHead(200, { 
      'Content-Type': contentType,
      'Cache-Control': cacheControl
    });
    res.end(content);
    
    log('info', 'Static file served', { 
      path: req.url, 
      contentType, 
      size: content.length, 
      responseTime 
    });
  });
});

// Enhanced server startup
server.listen(PORT, HOST, () => {
  log('info', 'Server started successfully', {
    url: `http://${HOST}:${PORT}`,
    env: process.env.NODE_ENV || 'development',
    nodeVersion: process.version
  });
});

// Graceful shutdown handling
process.on('SIGTERM', () => {
  log('info', 'SIGTERM received, shutting down gracefully');
  server.close(() => {
    log('info', 'Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  log('info', 'SIGINT received, shutting down gracefully');
  server.close(() => {
    log('info', 'Server closed');
    process.exit(0);
  });
});

// Error handling
process.on('uncaughtException', (error) => {
  log('error', 'Uncaught exception', { error: error.message, stack: error.stack });
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  log('error', 'Unhandled promise rejection', { reason, promise });
});
