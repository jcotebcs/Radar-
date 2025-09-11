// Load environment variables
require('dotenv').config();

const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const compression = require('compression');
const helmet = require('helmet');
const winston = require('winston');
const { apiKeys } = require('./googleApis');

// Configure logging
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'radar-notes' },
  transports: [
    new winston.transports.Console({
      format: winston.format.combine(
        winston.format.colorize(),
        winston.format.simple()
      )
    })
  ]
});

// Add file logging if configured
if (process.env.LOG_FILE) {
  logger.add(new winston.transports.File({ 
    filename: process.env.LOG_FILE,
    maxsize: 10485760, // 10MB
    maxFiles: 5,
    tailable: true
  }));
}

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
logger.info('Google APIs configured', { apis: configuredApis.length > 0 ? configuredApis.join(', ') : 'none' });

// Application startup time for health checks
const startTime = Date.now();

function json(res, status, obj) {
  res.writeHead(status, { 'Content-Type': 'application/json' });
  res.end(JSON.stringify(obj));
}

function parseBody(req, cb) {
  let body = '';
  req.on('data', chunk => { body += chunk; });
  req.on('end', () => {
    try { cb(JSON.parse(body || '{}')); } catch { cb({}); }
  });
}

const server = http.createServer((req, res) => {
  // Enable compression middleware
  if (process.env.COMPRESSION_ENABLED !== 'false') {
    compression()(req, res, () => {});
  }
  
  // Apply security headers
  helmet({
    contentSecurityPolicy: false, // We set CSP in nginx/apache
    crossOriginEmbedderPolicy: false // Allow for PWA functionality
  })(req, res, () => {});
  
  // CORS headers
  const corsOrigin = process.env.CORS_ORIGIN || '*';
  res.setHeader('Access-Control-Allow-Origin', corsOrigin);
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
  
  // Handle preflight requests
  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }
  
  // Log requests
  logger.info('Request', { 
    method: req.method, 
    url: req.url, 
    userAgent: req.headers['user-agent'],
    ip: req.headers['x-forwarded-for'] || req.connection.remoteAddress
  });
  
  // Health check endpoint
  if (req.url === '/health' && req.method === 'GET') {
    const uptime = Date.now() - startTime;
    const healthData = {
      status: 'healthy',
      uptime: uptime,
      timestamp: new Date().toISOString(),
      version: process.env.npm_package_version || '1.0.0',
      environment: process.env.NODE_ENV || 'development',
      memory: process.memoryUsage(),
      configuredApis: configuredApis.length
    };
    json(res, 200, healthData);
    return;
  }
  if (req.url === '/api/timer/start' && req.method === 'POST') {
    parseBody(req, data => {
      const seconds = Number(data.seconds) || 0;
      currentTimer = {
        title: data.title || 'Timer',
        end: Date.now() + seconds * 1000
      };
      json(res, 200, { status: 'started' });
    });
    return;
  }
  if (req.url === '/api/timer/stop' && req.method === 'POST') {
    currentTimer = null;
    json(res, 200, { status: 'stopped' });
    return;
  }
  if (req.url === '/api/timer/status') {
    if (currentTimer) {
      const remaining = Math.max(0, currentTimer.end - Date.now());
      if (remaining === 0) currentTimer = null;
      json(res, 200, { running: true, title: currentTimer.title, remaining });
    } else {
      json(res, 200, { running: false });
    }
    return;
  }
  if (req.url === '/api/tally' && req.method === 'GET') {
    json(res, 200, tallies);
    return;
  }
  if (req.url === '/api/tally/create' && req.method === 'POST') {
    parseBody(req, data => {
      const name = (data.name || '').trim();
      if (name && !tallies[name]) tallies[name] = 0;
      json(res, 200, tallies);
    });
    return;
  }
  if (req.url === '/api/tally/increment' && req.method === 'POST') {
    parseBody(req, data => {
      const name = (data.name || '').trim();
      if (!tallies[name]) tallies[name] = 0;
      tallies[name] += 1;
      json(res, 200, { name, count: tallies[name] });
    });
    return;
  }

  if (req.url === '/api/chat' && req.method === 'POST') {
    parseBody(req, data => {
      const msg = (data.message || '').toString();
      const reply = `Radar Oriley: I hear you say, "${msg}". Consider it done!`;
      json(res, 200, { reply });
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

  // Determine which directory to serve from (dist for production, public for development)
  const staticDir = process.env.NODE_ENV === 'production' ? 'dist' : 'public';
  let filePath = path.join(__dirname, staticDir, req.url === '/' ? 'index.html' : req.url);
  const ext = path.extname(filePath);
  const map = {
    '.html': 'text/html',
    '.js': 'text/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon',
    '.woff': 'font/woff',
    '.woff2': 'font/woff2'
  };
  
  fs.readFile(filePath, (err, content) => {
    if (err) {
      if (err.code === 'ENOENT') {
        // For SPA routing, serve index.html for non-API routes
        if (!req.url.startsWith('/api/') && !req.url.startsWith('/health')) {
          const indexPath = path.join(__dirname, staticDir, 'index.html');
          fs.readFile(indexPath, (indexErr, indexContent) => {
            if (indexErr) {
              logger.error('Index file not found', { error: indexErr });
              res.writeHead(404);
              res.end('Not Found');
              return;
            }
            res.writeHead(200, { 'Content-Type': 'text/html' });
            res.end(indexContent);
          });
          return;
        }
      }
      logger.error('File read error', { path: filePath, error: err });
      res.writeHead(404);
      res.end('Not Found');
      return;
    }
    
    const contentType = map[ext] || 'text/plain';
    const headers = { 'Content-Type': contentType };
    
    // Set caching headers based on file type
    if (process.env.STATIC_CACHE_ENABLED !== 'false') {
      if (ext === '.js' || ext === '.css' || ext.match(/\.(png|jpg|gif|ico|svg|woff|woff2)$/)) {
        headers['Cache-Control'] = `public, max-age=${process.env.CACHE_MAX_AGE || 31536000}`;
      } else if (req.url === '/sw.js') {
        headers['Cache-Control'] = 'no-cache, no-store, must-revalidate';
        headers['Pragma'] = 'no-cache';
        headers['Expires'] = '0';
      } else if (req.url === '/manifest.json') {
        headers['Cache-Control'] = 'public, max-age=86400';
      }
    }
    
    res.writeHead(200, headers);
    res.end(content);
  });
});

const port = process.env.PORT || 3000;
const host = process.env.HOST || '0.0.0.0';

// Create server (HTTP or HTTPS based on configuration)
let serverInstance;
if (process.env.HTTPS_ENABLED === 'true') {
  const httpsOptions = {
    key: fs.readFileSync(process.env.SSL_KEY_PATH),
    cert: fs.readFileSync(process.env.SSL_CERT_PATH)
  };
  serverInstance = https.createServer(httpsOptions, server);
  logger.info('HTTPS server configured');
} else {
  serverInstance = server;
}

serverInstance.listen(port, host, () => {
  logger.info('Server started', { 
    port, 
    host, 
    protocol: process.env.HTTPS_ENABLED === 'true' ? 'https' : 'http',
    environment: process.env.NODE_ENV || 'development',
    staticDir: process.env.NODE_ENV === 'production' ? 'dist' : 'public'
  });
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received, shutting down gracefully');
  serverInstance.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });
});

process.on('SIGINT', () => {
  logger.info('SIGINT received, shutting down gracefully');
  serverInstance.close(() => {
    logger.info('Server closed');
    process.exit(0);
  });
});
