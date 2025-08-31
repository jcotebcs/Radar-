const http = require('http');
const fs = require('fs');
const path = require('path');
const url = require('url');
const { randomUUID } = require('crypto');

const LOG_REQUESTS = process.env.LOG_REQUESTS === '1';

// in-memory stores
const recordings = new Map();
const timers = new Map();
const tallies = new Map();
let nextTimerId = 1;
let nextTallyId = 1;
const MAX_UPLOAD_SIZE = 1 * 1024 * 1024; // 1MB
const MAX_BODY_SIZE = 1 * 1024 * 1024; // 1MB

const clientDir = path.join(__dirname, '..', 'client');

function send(res, status, payload, type = 'application/json') {
  res.writeHead(status, { 'Content-Type': type });
  if (payload === undefined) return res.end();
  const data = type === 'application/json' ? JSON.stringify(payload) + '\n' : payload;
  res.end(data);
}

function parseBody(req) {
  return new Promise((resolve, reject) => {
    let body = '';
    let size = 0;
    let tooLarge = false;
    req.on('data', chunk => {
      if (tooLarge) return;
      size += chunk.length;
      if (size > MAX_BODY_SIZE) {
        tooLarge = true;
        return;
      }
      body += chunk;
    });
    req.on('end', () => {
      if (tooLarge) {
        return reject({ status: 413, payload: { error: 'payload too large' } });
      }
      try {
        resolve(JSON.parse(body || '{}'));
      } catch {
        reject({ status: 400, payload: { error: 'invalid JSON' } });
      }
    });
  });
}

const server = http.createServer(async (req, res) => {
  if (LOG_REQUESTS) {
    res.on('finish', () => {
      console.log(`${req.method} ${req.url} ${res.statusCode}`);
    });
  }
  try {
    const parsed = url.parse(req.url, true);
    const { pathname, query } = parsed;

    // --- Ingest endpoints ---
    if (req.method === 'POST' && pathname === '/v1/ingest/init') {
      const id = randomUUID();
      recordings.set(id, []);
      return send(res, 200, { recordingId: id });
    }
  if (req.method === 'POST' && pathname === '/v1/ingest/chunk') {
    const id = query.id;
    const store = recordings.get(id);
    if (!store) return send(res, 404, { error: 'unknown id' });
    const data = [];
    req.on('data', d => data.push(d));
    req.on('end', () => {
      const chunk = Buffer.concat(data);
      const total = store.reduce((n, b) => n + b.length, 0) + chunk.length;
      if (total > MAX_UPLOAD_SIZE) {
        recordings.delete(id);
        return send(res, 413, { error: 'upload too large' });
      }
      store.push(chunk);
      send(res, 200, { ok: true });
    });
    return;
  }
    if (req.method === 'POST' && pathname === '/v1/ingest/finalize') {
      const id = query.id;
      if (!recordings.has(id)) {
        return send(res, 404, { error: 'unknown id' });
      }
      recordings.delete(id);
      return send(res, 200, {
        transcript: 'mock transcript',
        bluf: 'mock bluf summary'
      });
    }

    // --- Timer endpoints ---
    if (pathname === '/v1/timers' && req.method === 'GET') {
      return send(res, 200, Array.from(timers.values()));
    }
    if (pathname === '/v1/timers' && req.method === 'POST') {
      let body;
      try {
        body = await parseBody(req);
      } catch (err) {
        return send(res, err.status, err.payload);
      }
      const duration = Number(body.duration);
      if (!Number.isInteger(duration) || duration <= 0) {
        return send(res, 400, { error: 'invalid duration' });
      }
      const id = String(nextTimerId++);
      timers.set(id, { id, title: body.title || `Timer ${id}`, duration, start: null, end: null });
      return send(res, 200, timers.get(id));
    }
  if (req.method === 'POST' && pathname.startsWith('/v1/timers/') && pathname.endsWith('/start')) {
    const id = pathname.split('/')[3];
    const timer = timers.get(id);
    if (!timer) return send(res, 404, { error: 'unknown timer' });
    if (timer.start) {
      return send(res, 409, { error: 'timer already running' });
    }
    timer.start = Date.now();
    timer.end = timer.start + timer.duration * 1000;
    return send(res, 200, timer);
  }
  if (req.method === 'POST' && pathname.startsWith('/v1/timers/') && pathname.endsWith('/stop')) {
    const id = pathname.split('/')[3];
    const timer = timers.get(id);
    if (!timer) return send(res, 404, { error: 'unknown timer' });
    timer.start = null;
    timer.end = null;
    return send(res, 200, timer);
  }
  if (req.method === 'DELETE' && pathname.startsWith('/v1/timers/')) {
    const id = pathname.split('/')[3];
    if (!timers.has(id)) return send(res, 404, { error: 'unknown timer' });
    timers.delete(id);
    return send(res, 200, { ok: true });
  }

    // --- Tally endpoints ---
    if (pathname === '/v1/tally' && req.method === 'GET') {
      return send(res, 200, Array.from(tallies.values()));
    }
    if (pathname === '/v1/tally' && req.method === 'POST') {
      let body;
      try {
        body = await parseBody(req);
      } catch (err) {
        return send(res, err.status, err.payload);
      }
      const id = String(nextTallyId++);
      tallies.set(id, { id, title: body.title || `Counter ${id}`, value: 0 });
      return send(res, 200, tallies.get(id));
    }
  if (req.method === 'POST' && pathname.startsWith('/v1/tally/') && pathname.endsWith('/inc')) {
    const id = pathname.split('/')[3];
    const tally = tallies.get(id);
    if (!tally) return send(res, 404, { error: 'unknown tally' });
    tally.value += 1;
    return send(res, 200, tally);
  }
  if (req.method === 'POST' && pathname.startsWith('/v1/tally/') && pathname.endsWith('/dec')) {
    const id = pathname.split('/')[3];
    const tally = tallies.get(id);
    if (!tally) return send(res, 404, { error: 'unknown tally' });
    if (tally.value === 0) {
      return send(res, 409, { error: 'tally cannot go below zero' });
    }
    tally.value -= 1;
    return send(res, 200, tally);
  }
  if (req.method === 'POST' && pathname.startsWith('/v1/tally/') && pathname.endsWith('/reset')) {
    const id = pathname.split('/')[3];
    const tally = tallies.get(id);
    if (!tally) return send(res, 404, { error: 'unknown tally' });
    tally.value = 0;
    return send(res, 200, tally);
  }
  if (req.method === 'DELETE' && pathname.startsWith('/v1/tally/')) {
    const id = pathname.split('/')[3];
    if (!tallies.has(id)) return send(res, 404, { error: 'unknown tally' });
    tallies.delete(id);
    return send(res, 200, { ok: true });
  }

    // --- static files ---
    let filePath;
    if (pathname === '/') {
      filePath = path.join(clientDir, 'index.html');
    } else {
      filePath = path.resolve(clientDir, '.' + pathname);
    }
    if (!filePath.startsWith(clientDir)) {
      res.writeHead(404);
      return res.end('Not found');
    }
    fs.readFile(filePath, (err, data) => {
      if (err) {
        res.writeHead(404);
        res.end('Not found');
      } else {
        const ext = path.extname(filePath);
        const type = {
          '.html': 'text/html',
          '.js': 'text/javascript',
          '.css': 'text/css'
        }[ext] || 'application/octet-stream';
        send(res, 200, data, type);
      }
    });
  } catch (err) {
    handleError(res, err);
  }
});

function handleError(res, err) {
  const status = err && err.status ? err.status : 500;
  const payload = err && err.payload ? err.payload : { error: 'internal error' };
  if (!res.writableEnded) {
    send(res, status, payload);
  }
}

const PORT = process.env.PORT || 3000;
server.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});
