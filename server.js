const http = require('http');
const fs = require('fs');
const path = require('path');
const { apiKeys } = require('./googleApis');

// Create directories for data storage
const dataDir = path.join(__dirname, 'data');
const recordingsDir = path.join(dataDir, 'recordings');

try {
  if (!fs.existsSync(dataDir)) fs.mkdirSync(dataDir, { recursive: true });
  if (!fs.existsSync(recordingsDir)) fs.mkdirSync(recordingsDir, { recursive: true });
} catch (error) {
  console.error('Failed to create data directories:', error.message);
}

// Initialize data storage
let currentTimer = null;
let tallies = {};
let recordings = {};
let nextRecordingId = 1;

const contacts = [
  { id: 1, name: 'Alice', phone: '+15551234567' },
  { id: 2, name: 'Bob', phone: '+15557654321' }
];
const callLogs = [
  { id: 1, contact: 'Alice', type: 'incoming', time: Date.now() - 600000, duration: 120 },
  { id: 2, contact: 'Bob', type: 'outgoing', time: Date.now() - 3600000, duration: 240 }
];

// Load persisted data
function loadPersistedData() {
  try {
    const talliesPath = path.join(dataDir, 'tallies.json');
    if (fs.existsSync(talliesPath)) {
      tallies = JSON.parse(fs.readFileSync(talliesPath, 'utf8'));
    }
    const recordingsPath = path.join(dataDir, 'recordings.json');
    if (fs.existsSync(recordingsPath)) {
      const data = JSON.parse(fs.readFileSync(recordingsPath, 'utf8'));
      recordings = data.recordings || {};
      nextRecordingId = data.nextId || 1;
    }
  } catch (error) {
    console.error('Failed to load persisted data:', error.message);
  }
}

// Save data to persistence
function saveData() {
  try {
    fs.writeFileSync(path.join(dataDir, 'tallies.json'), JSON.stringify(tallies, null, 2));
    fs.writeFileSync(path.join(dataDir, 'recordings.json'), JSON.stringify({
      recordings,
      nextId: nextRecordingId
    }, null, 2));
  } catch (error) {
    console.error('Failed to save data:', error.message);
  }
}

loadPersistedData();

const configuredApis = Object.keys(apiKeys).filter(k => apiKeys[k]);
console.log('Google APIs configured:', configuredApis.join(', ') || 'none');
console.log(`Data directory: ${dataDir}`);

function json(res, status, obj) {
  res.writeHead(status, { 
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
  });
  res.end(JSON.stringify(obj));
}

function sanitizeInput(input, maxLength = 1000) {
  if (typeof input !== 'string') return '';
  return input.trim().slice(0, maxLength).replace(/[<>]/g, '');
}

function parseBody(req, cb) {
  let body = '';
  req.on('data', chunk => { 
    body += chunk; 
    // Prevent DoS attacks with large payloads
    if (body.length > 10000) {
      req.destroy();
      return;
    }
  });
  req.on('end', () => {
    try { 
      const parsed = JSON.parse(body || '{}');
      cb(parsed); 
    } catch (error) { 
      console.error('JSON parse error:', error.message);
      cb({}); 
    }
  });
  req.on('error', (error) => {
    console.error('Request error:', error.message);
    cb({});
  });
}

const server = http.createServer((req, res) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    res.writeHead(200, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    });
    res.end();
    return;
  }

  // Audio recording endpoints
  if (req.url === '/api/recording/start' && req.method === 'POST') {
    parseBody(req, data => {
      try {
        const recordingId = nextRecordingId++;
        const title = sanitizeInput(data.title) || `Recording ${recordingId}`;
        const startTime = Date.now();
        
        recordings[recordingId] = {
          id: recordingId,
          title,
          startTime,
          endTime: null,
          chunks: [],
          status: 'recording',
          tags: []
        };
        
        saveData();
        json(res, 200, { recordingId, title, startTime });
      } catch (error) {
        console.error('Start recording error:', error.message);
        json(res, 500, { error: 'Failed to start recording' });
      }
    });
    return;
  }

  if (req.url === '/api/recording/chunk' && req.method === 'POST') {
    parseBody(req, data => {
      try {
        const recordingId = Number(data.recordingId);
        const chunk = data.chunk; // Base64 encoded audio
        
        if (!recordings[recordingId] || recordings[recordingId].status !== 'recording') {
          json(res, 400, { error: 'Invalid recording session' });
          return;
        }
        
        recordings[recordingId].chunks.push({
          timestamp: Date.now(),
          data: chunk
        });
        
        json(res, 200, { status: 'chunk saved' });
      } catch (error) {
        console.error('Save chunk error:', error.message);
        json(res, 500, { error: 'Failed to save audio chunk' });
      }
    });
    return;
  }

  if (req.url === '/api/recording/stop' && req.method === 'POST') {
    parseBody(req, data => {
      try {
        const recordingId = Number(data.recordingId);
        
        if (!recordings[recordingId]) {
          json(res, 400, { error: 'Recording not found' });
          return;
        }
        
        recordings[recordingId].endTime = Date.now();
        recordings[recordingId].status = 'completed';
        
        // Save recording to file for future processing
        const filename = `recording_${recordingId}_${Date.now()}.json`;
        const filepath = path.join(recordingsDir, filename);
        
        fs.writeFileSync(filepath, JSON.stringify(recordings[recordingId], null, 2));
        recordings[recordingId].filepath = filepath;
        
        saveData();
        json(res, 200, { 
          recordingId, 
          status: 'completed',
          duration: recordings[recordingId].endTime - recordings[recordingId].startTime,
          filepath: filename
        });
      } catch (error) {
        console.error('Stop recording error:', error.message);
        json(res, 500, { error: 'Failed to stop recording' });
      }
    });
    return;
  }

  if (req.url === '/api/recording/tag' && req.method === 'POST') {
    parseBody(req, data => {
      try {
        const recordingId = Number(data.recordingId);
        const tag = sanitizeInput(data.tag, 200);
        
        if (!recordings[recordingId]) {
          json(res, 400, { error: 'Recording not found' });
          return;
        }
        
        if (!tag) {
          json(res, 400, { error: 'Tag text required' });
          return;
        }
        
        recordings[recordingId].tags.push({
          text: tag,
          timestamp: Date.now()
        });
        
        saveData();
        json(res, 200, { tag, timestamp: Date.now() });
      } catch (error) {
        console.error('Add tag error:', error.message);
        json(res, 500, { error: 'Failed to add tag' });
      }
    });
    return;
  }

  if (req.url === '/api/recordings' && req.method === 'GET') {
    try {
      const recordingList = Object.values(recordings).map(r => ({
        id: r.id,
        title: r.title,
        startTime: r.startTime,
        endTime: r.endTime,
        status: r.status,
        tagCount: r.tags.length,
        duration: r.endTime ? r.endTime - r.startTime : null
      }));
      json(res, 200, recordingList);
    } catch (error) {
      console.error('List recordings error:', error.message);
      json(res, 500, { error: 'Failed to list recordings' });
    }
    return;
  }
  // Timer endpoints with improved error handling
  if (req.url === '/api/timer/start' && req.method === 'POST') {
    parseBody(req, data => {
      try {
        const seconds = Math.max(0, Math.min(Number(data.seconds) || 0, 86400)); // Max 24 hours
        const title = sanitizeInput(data.title) || 'Timer';
        currentTimer = {
          title,
          end: Date.now() + seconds * 1000,
          duration: seconds
        };
        json(res, 200, { status: 'started', title, seconds });
      } catch (error) {
        console.error('Timer start error:', error.message);
        json(res, 500, { error: 'Failed to start timer' });
      }
    });
    return;
  }
  
  if (req.url === '/api/timer/stop' && req.method === 'POST') {
    try {
      currentTimer = null;
      json(res, 200, { status: 'stopped' });
    } catch (error) {
      console.error('Timer stop error:', error.message);
      json(res, 500, { error: 'Failed to stop timer' });
    }
    return;
  }
  
  if (req.url === '/api/timer/status') {
    try {
      if (currentTimer) {
        const remaining = Math.max(0, currentTimer.end - Date.now());
        if (remaining === 0) currentTimer = null;
        json(res, 200, { 
          running: remaining > 0, 
          title: currentTimer?.title, 
          remaining,
          totalDuration: currentTimer?.duration
        });
      } else {
        json(res, 200, { running: false });
      }
    } catch (error) {
      console.error('Timer status error:', error.message);
      json(res, 500, { error: 'Failed to get timer status' });
    }
    return;
  }
  // Tally endpoints with improved validation
  if (req.url === '/api/tally' && req.method === 'GET') {
    try {
      json(res, 200, tallies);
    } catch (error) {
      console.error('Get tallies error:', error.message);
      json(res, 500, { error: 'Failed to get tallies' });
    }
    return;
  }
  
  if (req.url === '/api/tally/create' && req.method === 'POST') {
    parseBody(req, data => {
      try {
        const name = sanitizeInput(data.name, 50);
        if (!name) {
          json(res, 400, { error: 'Valid name required' });
          return;
        }
        if (tallies[name] !== undefined) {
          json(res, 400, { error: 'Counter already exists' });
          return;
        }
        tallies[name] = 0;
        saveData();
        json(res, 200, { name, count: 0 });
      } catch (error) {
        console.error('Create tally error:', error.message);
        json(res, 500, { error: 'Failed to create counter' });
      }
    });
    return;
  }
  
  if (req.url === '/api/tally/increment' && req.method === 'POST') {
    parseBody(req, data => {
      try {
        const name = sanitizeInput(data.name, 50);
        const amount = Math.max(-1000, Math.min(Number(data.amount) || 1, 1000)); // Reasonable limits
        
        if (!name) {
          json(res, 400, { error: 'Valid name required' });
          return;
        }
        
        if (tallies[name] === undefined) tallies[name] = 0;
        tallies[name] = Math.max(0, tallies[name] + amount); // Prevent negative counts
        
        saveData();
        json(res, 200, { name, count: tallies[name], change: amount });
      } catch (error) {
        console.error('Increment tally error:', error.message);
        json(res, 500, { error: 'Failed to increment counter' });
      }
    });
    return;
  }

  // Additional API endpoints from specification
  if (req.url === '/api/health' && req.method === 'GET') {
    try {
      const pkg = JSON.parse(fs.readFileSync(path.join(__dirname, 'package.json'), 'utf8'));
      json(res, 200, { 
        status: 'healthy', 
        timestamp: Date.now(),
        uptime: process.uptime(),
        version: pkg.version,
        apis: configuredApis,
        environment: process.env.NODE_ENV || 'development'
      });
    } catch (error) {
      json(res, 500, { status: 'unhealthy', error: error.message });
    }
    return;
  }

  // Voice Activity Detection (VOX) placeholder endpoint
  if (req.url === '/api/vox/status' && req.method === 'GET') {
    try {
      json(res, 200, { 
        status: 'placeholder',
        message: 'VOX engine not implemented yet',
        features: ['threshold_detection', 'hang_time', 'pre_roll_buffer']
      });
    } catch (error) {
      json(res, 500, { error: 'VOX status unavailable' });
    }
    return;
  }

  // Transcription placeholder endpoint
  if (req.url === '/api/transcribe' && req.method === 'POST') {
    parseBody(req, data => {
      try {
        const recordingId = Number(data.recordingId);
        if (!recordings[recordingId]) {
          json(res, 400, { error: 'Recording not found' });
          return;
        }
        
        // Placeholder response - would integrate with OpenAI Whisper, Google STT, etc.
        json(res, 200, {
          recordingId,
          status: 'placeholder',
          message: 'Transcription service not implemented yet',
          transcript: 'This is a placeholder transcript for development',
          confidence: 0.95,
          language: 'en-US',
          duration: recordings[recordingId].endTime ? 
            recordings[recordingId].endTime - recordings[recordingId].startTime : null
        });
      } catch (error) {
        console.error('Transcription error:', error.message);
        json(res, 500, { error: 'Transcription failed' });
      }
    });
    return;
  }

  // BLUF (Bottom Line Up Front) summary endpoint
  if (req.url === '/api/summarize' && req.method === 'POST') {
    parseBody(req, data => {
      try {
        const recordingId = Number(data.recordingId);
        if (!recordings[recordingId]) {
          json(res, 400, { error: 'Recording not found' });
          return;
        }
        
        // Placeholder response - would integrate with ChatGPT, Claude, etc.
        json(res, 200, {
          recordingId,
          bluf: 'Placeholder BLUF summary',
          keyPoints: ['Point 1', 'Point 2', 'Point 3'],
          actionItems: ['Action 1', 'Action 2'],
          keywords: ['keyword1', 'keyword2'],
          confidence: 0.90,
          generatedAt: Date.now()
        });
      } catch (error) {
        console.error('Summarization error:', error.message);
        json(res, 500, { error: 'Summarization failed' });
      }
    });
    return;
  }
  if (req.url === '/api/chat' && req.method === 'POST') {
    parseBody(req, data => {
      try {
        const msg = sanitizeInput(data.message, 500);
        if (!msg) {
          json(res, 400, { error: 'Message required' });
          return;
        }
        
        // Generate contextual responses based on message content
        let reply = '';
        const msgLower = msg.toLowerCase();
        
        if (msgLower.includes('record') || msgLower.includes('start')) {
          reply = `Roger that! Ready to start recording when you are. Just hit that big red button!`;
        } else if (msgLower.includes('timer') || msgLower.includes('time')) {
          reply = `Time's always important in the field. Set a timer and I'll keep track for you!`;
        } else if (msgLower.includes('help') || msgLower.includes('how')) {
          reply = `I'm here to help! You can record audio, set timers, count things with tallies, and chat with me. What do you need?`;
        } else if (msgLower.includes('tag') || msgLower.includes('note')) {
          reply = `Good thinking! Tags help organize your recordings. Add them during or after recording.`;
        } else {
          reply = `I hear you say, "${msg}". Consider it noted in the log!`;
        }
        
        json(res, 200, { reply });
      } catch (error) {
        console.error('Chat error:', error.message);
        json(res, 500, { error: 'Chat service unavailable' });
      }
    });
    return;
  }

  // Contacts endpoint with error handling
  if (req.url === '/api/contacts' && req.method === 'GET') {
    try {
      json(res, 200, contacts);
    } catch (error) {
      console.error('Get contacts error:', error.message);
      json(res, 500, { error: 'Failed to get contacts' });
    }
    return;
  }

  // Call logs endpoint with error handling
  if (req.url === '/api/call-logs' && req.method === 'GET') {
    try {
      json(res, 200, callLogs);
    } catch (error) {
      console.error('Get call logs error:', error.message);
      json(res, 500, { error: 'Failed to get call logs' });
    }
    return;
  }

  // Static file serving with security headers
  let filePath = path.join(__dirname, 'public', req.url === '/' ? 'index.html' : req.url);
  
  // Prevent directory traversal attacks
  if (!filePath.startsWith(path.join(__dirname, 'public'))) {
    res.writeHead(403);
    res.end('Forbidden');
    return;
  }
  
  const ext = path.extname(filePath);
  const contentTypeMap = {
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
      console.error(`File not found: ${filePath}`);
      res.writeHead(404, { 'Content-Type': 'text/html' });
      res.end('<!DOCTYPE html><html><head><title>404 Not Found</title></head><body><h1>404 - File Not Found</h1></body></html>');
      return;
    }
    
    const contentType = contentTypeMap[ext] || 'text/plain';
    const headers = {
      'Content-Type': contentType,
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'X-XSS-Protection': '1; mode=block'
    };
    
    // Add cache headers for static assets
    if (ext !== '.html') {
      headers['Cache-Control'] = 'public, max-age=86400'; // 24 hours
    }
    
    res.writeHead(200, headers);
    res.end(content);
  });
});

const port = process.env.PORT || 3000;
const server_instance = server.listen(port, () => {
  console.log(`Server listening on http://localhost:${port}`);
  console.log(`Environment: ${process.env.NODE_ENV || 'development'}`);
  console.log(`PID: ${process.pid}`);
});

// Graceful shutdown handling
function gracefulShutdown(signal) {
  console.log(`\nReceived ${signal}, shutting down gracefully...`);
  
  // Save current state
  saveData();
  
  server_instance.close(() => {
    console.log('HTTP server closed');
    process.exit(0);
  });
  
  // Force close after 5 seconds
  setTimeout(() => {
    console.error('Could not close connections in time, forcefully shutting down');
    process.exit(1);
  }, 5000);
}

process.on('SIGTERM', () => gracefulShutdown('SIGTERM'));
process.on('SIGINT', () => gracefulShutdown('SIGINT'));

// Handle uncaught exceptions
process.on('uncaughtException', (error) => {
  console.error('Uncaught Exception:', error);
  saveData();
  process.exit(1);
});

process.on('unhandledRejection', (reason, promise) => {
  console.error('Unhandled Rejection at:', promise, 'reason:', reason);
  saveData();
  process.exit(1);
});
