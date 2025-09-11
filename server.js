const http = require('http');
const fs = require('fs');
const path = require('path');
const { apiKeys } = require('./googleApis');
const DataStore = require('./datastore');
const { v4: uuidv4 } = require('uuid');

const dataStore = new DataStore();
let currentTimer = null;
const tallies = {};
const activeRecordings = new Map(); // Track active recording sessions

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

// Handle binary data for audio uploads
function parseBinaryBody(req, cb) {
  const chunks = [];
  req.on('data', chunk => chunks.push(chunk));
  req.on('end', () => cb(Buffer.concat(chunks)));
}

const server = http.createServer((req, res) => {
  // CORS headers for all requests
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, PUT, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type');
  
  if (req.method === 'OPTIONS') {
    res.writeHead(200);
    res.end();
    return;
  }

  // Audio recording endpoints
  if (req.url === '/api/recording/start' && req.method === 'POST') {
    parseBody(req, data => {
      const recordingId = uuidv4();
      const recording = dataStore.createRecording({
        id: recordingId,
        title: data.title || 'Recording',
        status: 'recording',
        deviceId: data.deviceId
      });
      activeRecordings.set(recordingId, {
        id: recordingId,
        chunks: [],
        startTime: Date.now()
      });
      json(res, 200, { recordingId, recording });
    });
    return;
  }

  if (req.url.startsWith('/api/recording/chunk/') && req.method === 'POST') {
    const recordingId = req.url.split('/').pop();
    const activeRecording = activeRecordings.get(recordingId);
    
    if (!activeRecording) {
      json(res, 404, { error: 'Recording not found' });
      return;
    }

    parseBinaryBody(req, audioChunk => {
      activeRecording.chunks.push(audioChunk);
      json(res, 200, { status: 'chunk received' });
    });
    return;
  }

  if (req.url.startsWith('/api/recording/stop/') && req.method === 'POST') {
    const recordingId = req.url.split('/').pop();
    const activeRecording = activeRecordings.get(recordingId);
    
    if (!activeRecording) {
      json(res, 404, { error: 'Recording not found' });
      return;
    }

    // Combine all audio chunks and save to file
    const audioBuffer = Buffer.concat(activeRecording.chunks);
    const filePath = dataStore.getRecordingFilePath(recordingId);
    
    fs.writeFileSync(filePath, audioBuffer);
    
    // Update recording in database
    const recording = dataStore.updateRecording(recordingId, {
      status: 'completed',
      duration: Date.now() - activeRecording.startTime,
      filePath: filePath,
      size: audioBuffer.length
    });

    activeRecordings.delete(recordingId);
    
    // Trigger transcription process (placeholder for now)
    processRecording(recording);
    
    json(res, 200, { recording });
    return;
  }

  if (req.url === '/api/recordings' && req.method === 'GET') {
    const recordings = dataStore.getAllRecordings();
    json(res, 200, recordings);
    return;
  }

  if (req.url.startsWith('/api/recording/') && req.method === 'GET') {
    const recordingId = req.url.split('/').pop();
    const recording = dataStore.getRecording(recordingId);
    if (recording) {
      json(res, 200, recording);
    } else {
      json(res, 404, { error: 'Recording not found' });
    }
    return;
  }

  // Notes endpoints
  if (req.url === '/api/notes' && req.method === 'GET') {
    const notes = dataStore.getAllNotes();
    json(res, 200, notes);
    return;
  }

  if (req.url === '/api/notes' && req.method === 'POST') {
    parseBody(req, data => {
      const note = dataStore.createNote(data);
      json(res, 201, note);
    });
    return;
  }

  // Tasks endpoints
  if (req.url === '/api/tasks' && req.method === 'GET') {
    const tasks = dataStore.getAllTasks();
    json(res, 200, tasks);
    return;
  }

  if (req.url === '/api/tasks' && req.method === 'POST') {
    parseBody(req, data => {
      const task = dataStore.createTask(data);
      json(res, 201, task);
    });
    return;
  }

  if (req.url.startsWith('/api/tasks/') && req.method === 'PUT') {
    const taskId = req.url.split('/').pop();
    parseBody(req, data => {
      const task = dataStore.updateTask(taskId, data);
      if (task) {
        json(res, 200, task);
      } else {
        json(res, 404, { error: 'Task not found' });
      }
    });
    return;
  }

  // Events endpoints
  if (req.url === '/api/events' && req.method === 'GET') {
    const events = dataStore.getAllEvents();
    json(res, 200, events);
    return;
  }

  if (req.url === '/api/events' && req.method === 'POST') {
    parseBody(req, data => {
      const event = dataStore.createEvent(data);
      json(res, 201, event);
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
    json(res, 200, dataStore.getContacts());
    return;
  }

  if (req.url === '/api/call-logs' && req.method === 'GET') {
    json(res, 200, dataStore.getCallLogs());
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

// Recording processing function (placeholder for transcription)
async function processRecording(recording) {
  try {
    console.log(`Processing recording: ${recording.id}`);
    
    // Placeholder for transcription service integration
    // This would integrate with OpenAI Whisper, Google STT, etc.
    const mockTranscript = generateMockTranscript();
    
    // Save transcript
    const transcriptPath = dataStore.getTranscriptFilePath(recording.id);
    const transcriptData = {
      recordingId: recording.id,
      transcript: mockTranscript,
      summary: generateMockSummary(mockTranscript),
      tags: extractMockTags(mockTranscript),
      tasks: extractMockTasks(mockTranscript),
      events: extractMockEvents(mockTranscript),
      processedAt: new Date().toISOString()
    };
    
    fs.writeFileSync(transcriptPath, JSON.stringify(transcriptData, null, 2));
    
    // Update recording with transcript info
    dataStore.updateRecording(recording.id, {
      transcriptPath: transcriptPath,
      hasTranscript: true,
      transcript: mockTranscript,
      summary: transcriptData.summary,
      tags: transcriptData.tags
    });

    // Create tasks and events from extracted data
    transcriptData.tasks.forEach(task => {
      dataStore.createTask({
        ...task,
        recordingId: recording.id,
        source: 'voice_recording'
      });
    });

    transcriptData.events.forEach(event => {
      dataStore.createEvent({
        ...event,
        recordingId: recording.id,
        source: 'voice_recording'
      });
    });
    
    console.log(`Recording processed successfully: ${recording.id}`);
  } catch (error) {
    console.error(`Error processing recording ${recording.id}:`, error);
  }
}

// Mock functions for demonstration (to be replaced with real AI services)
function generateMockTranscript() {
  return "This is a sample transcript of the voice recording. The user mentioned they need to call John about the project meeting tomorrow at 3 PM. They also want to remember to buy groceries and finish the quarterly report.";
}

function generateMockSummary(transcript) {
  return "User discussed upcoming project meeting with John and personal tasks including grocery shopping and completing quarterly report.";
}

function extractMockTags(transcript) {
  return ["meeting", "project", "groceries", "report", "tasks"];
}

function extractMockTasks(transcript) {
  return [
    {
      title: "Call John about project meeting",
      description: "Contact John to discuss project meeting details",
      priority: "high",
      dueDate: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString()
    },
    {
      title: "Buy groceries",
      description: "Purchase groceries",
      priority: "medium"
    },
    {
      title: "Finish quarterly report",
      description: "Complete and submit quarterly report",
      priority: "high"
    }
  ];
}

function extractMockEvents(transcript) {
  return [
    {
      title: "Project Meeting with John",
      description: "Discuss project progress and next steps",
      startTime: new Date(Date.now() + 24 * 60 * 60 * 1000 + 15 * 60 * 60 * 1000).toISOString(), // Tomorrow 3 PM
      duration: 60,
      attendees: ["John"]
    }
  ];
}
