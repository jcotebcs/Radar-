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

  let filePath = path.join(__dirname, 'public', req.url === '/' ? 'index.html' : req.url);
  const ext = path.extname(filePath);
  const map = {
    '.html': 'text/html',
    '.js': 'text/javascript',
    '.css': 'text/css'
  };
  fs.readFile(filePath, (err, content) => {
    if (err) {
      res.writeHead(404);
      res.end('Not Found');
      return;
    }
    res.writeHead(200, { 'Content-Type': map[ext] || 'text/plain' });
    res.end(content);
  });
});

const port = process.env.PORT || 3000;
server.listen(port, () => {
  console.log(`Server listening on http://localhost:${port}`);
});
