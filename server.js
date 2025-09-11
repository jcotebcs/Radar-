require('dotenv').config();
const http = require('http');
const https = require('https');
const fs = require('fs');
const path = require('path');
const { apiKeys } = require('./googleApis');
const logger = require('./logger');
const DataManager = require('./dataManager');

// Initialize data manager
const dataManager = new DataManager();

let currentTimer = null;

const configuredApis = Object.keys(apiKeys).filter(k => apiKeys[k]);
logger.info('Google APIs configured:', { apis: configuredApis.join(', ') || 'none' });

function json(res, status, obj) {
  res.writeHead(status, { 
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
  });
  res.end(JSON.stringify(obj));
}

function parseBody(req, cb) {
  let body = '';
  req.on('data', chunk => { body += chunk; });
  req.on('end', () => {
    try { 
      cb(JSON.parse(body || '{}')); 
    } catch (error) { 
      logger.warn('Failed to parse request body:', error.message);
      cb({}); 
    }
  });
}

const server = http.createServer((req, res) => {
  // Log requests
  logger.debug(`${req.method} ${req.url}`);

  // Handle OPTIONS requests for CORS
  if (req.method === 'OPTIONS') {
    res.writeHead(200, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    });
    res.end();
    return;
  }

  // Health check endpoint
  if (req.url === '/health' && req.method === 'GET') {
    json(res, 200, { 
      status: 'healthy', 
      timestamp: new Date().toISOString(),
      apis: configuredApis.length 
    });
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
    json(res, 200, dataManager.getTallies());
    return;
  }
  if (req.url === '/api/tally/create' && req.method === 'POST') {
    parseBody(req, async data => {
      const name = (data.name || '').trim();
      if (name && !dataManager.getTallies()[name]) {
        await dataManager.setTally(name, 0);
      }
      json(res, 200, dataManager.getTallies());
    });
    return;
  }
  if (req.url === '/api/tally/increment' && req.method === 'POST') {
    parseBody(req, async data => {
      const name = (data.name || '').trim();
      const tallies = dataManager.getTallies();
      if (!tallies[name]) tallies[name] = 0;
      tallies[name] += 1;
      await dataManager.setTally(name, tallies[name]);
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
    json(res, 200, dataManager.getContacts());
    return;
  }

  if (req.url === '/api/call-logs' && req.method === 'GET') {
    json(res, 200, dataManager.getCallLogs());
    return;
  }

  let filePath = path.join(__dirname, 'public', req.url === '/' ? 'index.html' : req.url);
  const ext = path.extname(filePath);
  const map = {
    '.html': 'text/html',
    '.js': 'text/javascript',
    '.css': 'text/css',
    '.json': 'application/json',
    '.png': 'image/png',
    '.jpg': 'image/jpeg',
    '.jpeg': 'image/jpeg',
    '.gif': 'image/gif',
    '.svg': 'image/svg+xml',
    '.ico': 'image/x-icon'
  };
  fs.readFile(filePath, (err, content) => {
    if (err) {
      logger.warn(`File not found: ${filePath}`);
      res.writeHead(404);
      res.end('Not Found');
      return;
    }
    res.writeHead(200, { 'Content-Type': map[ext] || 'text/plain' });
    res.end(content);
  });
});

const port = process.env.PORT || 3000;

// Start HTTP server
server.listen(port, () => {
  logger.info(`HTTP server listening on http://localhost:${port}`);
});

// Start HTTPS server if certificates are provided
const httpsPort = process.env.HTTPS_PORT || 443;
const sslKeyPath = process.env.SSL_KEY_PATH;
const sslCertPath = process.env.SSL_CERT_PATH;

if (sslKeyPath && sslCertPath) {
  try {
    const options = {
      key: fs.readFileSync(sslKeyPath),
      cert: fs.readFileSync(sslCertPath)
    };

    const httpsServer = https.createServer(options, server._connectionListener || ((req, res) => {
      server.emit('request', req, res);
    }));

    httpsServer.listen(httpsPort, () => {
      logger.info(`HTTPS server listening on https://localhost:${httpsPort}`);
    });
  } catch (error) {
    logger.error('Failed to start HTTPS server:', error.message);
    logger.info('HTTPS server not started. Using HTTP only.');
  }
} else {
  logger.info('SSL certificates not configured. Using HTTP only.');
  logger.info('To enable HTTPS, set SSL_KEY_PATH and SSL_CERT_PATH environment variables.');
}
