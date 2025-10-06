let mediaRecorder;
let currentStream;
let currentVideoStream;
let tags = [];
let pressedButtons = [];
let chatLog = [];
let currentRecording = null;
let audioChunks = [];
let voxEnabled = false;
let voxTimeout = null;
let audioContext = null;
let analyser = null;
let voxThreshold = 0.01; // Voice activity threshold
let voxDelay = 2000; // 2 seconds of silence before stopping

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js').catch(console.error);
}

async function populateAudioInputs() {
  const devices = await navigator.mediaDevices.enumerateDevices();
  const select = document.getElementById('audioInput');
  select.innerHTML = '';
  devices.filter(d => d.kind === 'audioinput').forEach((d, i) => {
    const opt = document.createElement('option');
    opt.value = d.deviceId;
    opt.textContent = d.label || `Microphone ${i+1}`;
    select.appendChild(opt);
  });
}

async function populateVideoInputs() {
  const devices = await navigator.mediaDevices.enumerateDevices();
  const select = document.getElementById('videoInput');
  if (!select) return;
  select.innerHTML = '';
  devices.filter(d => d.kind === 'videoinput').forEach((d, i) => {
    const opt = document.createElement('option');
    opt.value = d.deviceId;
    opt.textContent = d.label || `Camera ${i+1}`;
    select.appendChild(opt);
  });
}

async function getStream() {
  const deviceId = document.getElementById('audioInput').value;
  if (currentStream) {
    currentStream.getTracks().forEach(t => t.stop());
  }
  currentStream = await navigator.mediaDevices.getUserMedia({
    audio: deviceId ? { deviceId: { exact: deviceId } } : true
  });
  return currentStream;
}

async function getVideoStream() {
  const deviceId = document.getElementById('videoInput').value;
  if (currentVideoStream) {
    currentVideoStream.getTracks().forEach(t => t.stop());
  }
  currentVideoStream = await navigator.mediaDevices.getUserMedia({
    video: deviceId ? { deviceId: { exact: deviceId } } : true
  });
  document.getElementById('preview').srcObject = currentVideoStream;
}

function stopVideo() {
  if (!currentVideoStream) return;
  currentVideoStream.getTracks().forEach(t => t.stop());
  currentVideoStream = null;
  document.getElementById('preview').srcObject = null;
}

function toggleCamera() {
  if (currentVideoStream) {
    stopVideo();
    document.getElementById('cameraBtn').textContent = 'Start Camera';
  } else {
    getVideoStream();
    document.getElementById('cameraBtn').textContent = 'Stop Camera';
  }
}

function updateTagList() {
  const ul = document.getElementById('tagList');
  ul.innerHTML = '';
  tags.forEach(t => {
    const li = document.createElement('li');
    li.textContent = t;
    ul.appendChild(li);
  });
}

function addTag(text) {
  if (!text) return;
  tags.push(text);
  updateTagList();
}

async function startRecording() {
  try {
    const stream = await getStream();
    
    // Setup audio context for VOX detection
    if (!audioContext) {
      audioContext = new (window.AudioContext || window.webkitAudioContext)();
      analyser = audioContext.createAnalyser();
      const source = audioContext.createMediaStreamSource(stream);
      source.connect(analyser);
      analyser.fftSize = 256;
    }
    
    // Start recording session on server
    const response = await fetch('/api/recording/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        title: `Recording ${new Date().toLocaleString()}`,
        deviceId: document.getElementById('audioInput').value
      })
    });
    
    const data = await response.json();
    currentRecording = data;
    
    mediaRecorder = new MediaRecorder(stream, {
      mimeType: 'audio/webm;codecs=opus'
    });
    
    audioChunks = [];
    
    mediaRecorder.ondataavailable = async (event) => {
      if (event.data.size > 0) {
        audioChunks.push(event.data);
        
        // Send chunk to server
        const arrayBuffer = await event.data.arrayBuffer();
        await fetch(`/api/recording/chunk/${currentRecording.recordingId}`, {
          method: 'POST',
          body: arrayBuffer,
          headers: {
            'Content-Type': 'application/octet-stream'
          }
        });
      }
    };
    
    mediaRecorder.onstart = () => {
      console.log('Recording started');
      updateRecordingUI(true);
    };
    
    mediaRecorder.onstop = async () => {
      console.log('Recording stopped');
      updateRecordingUI(false);
      
      if (currentRecording) {
        // Finalize recording on server
        await fetch(`/api/recording/stop/${currentRecording.recordingId}`, {
          method: 'POST'
        });
        
        showRecordingComplete(currentRecording);
        currentRecording = null;
      }
    };
    
    // Start recording with small chunks for real-time processing
    mediaRecorder.start(1000); // 1-second chunks
    
    // Start VOX monitoring if enabled
    if (voxEnabled) {
      startVoxMonitoring();
    }
    
  } catch (error) {
    console.error('Error starting recording:', error);
    alert('Error starting recording: ' + error.message);
  }
}

function stopRecording() {
  if (!mediaRecorder) return;
  
  if (voxTimeout) {
    clearTimeout(voxTimeout);
    voxTimeout = null;
  }
  
  mediaRecorder.stop();
  mediaRecorder = null;
}

function updateRecordingUI(recording) {
  const recordBtn = document.getElementById('recordBtn');
  if (recording) {
    recordBtn.classList.add('recording');
    recordBtn.textContent = 'Stop Recording';
    recordBtn.style.backgroundColor = '#ff4444';
    recordBtn.style.animation = 'pulse 1s infinite';
  } else {
    recordBtn.classList.remove('recording');
    recordBtn.textContent = 'Start Recording';
    recordBtn.style.backgroundColor = '';
    recordBtn.style.animation = '';
  }
}

function showRecordingComplete(recording) {
  const notification = document.createElement('div');
  notification.className = 'recording-notification';
  notification.innerHTML = `
    <p>✅ Recording completed and processing...</p>
    <p>ID: ${recording.recordingId}</p>
    <button onclick="this.parentElement.remove()">Dismiss</button>
  `;
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: #4CAF50;
    color: white;
    padding: 15px;
    border-radius: 5px;
    z-index: 1000;
    box-shadow: 0 2px 10px rgba(0,0,0,0.3);
  `;
  document.body.appendChild(notification);
  
  // Auto-remove after 5 seconds
  setTimeout(() => {
    if (notification.parentElement) {
      notification.remove();
    }
  }, 5000);
}

// VOX (Voice Activity Detection) functionality
function startVoxMonitoring() {
  if (!analyser) return;
  
  const bufferLength = analyser.frequencyBinCount;
  const dataArray = new Uint8Array(bufferLength);
  
  function checkVoiceActivity() {
    if (!mediaRecorder || mediaRecorder.state !== 'recording') return;
    
    analyser.getByteFrequencyData(dataArray);
    
    // Calculate average amplitude
    let sum = 0;
    for (let i = 0; i < bufferLength; i++) {
      sum += dataArray[i];
    }
    const average = sum / bufferLength / 255; // Normalize to 0-1
    
    if (average > voxThreshold) {
      // Voice detected, clear any stop timeout
      if (voxTimeout) {
        clearTimeout(voxTimeout);
        voxTimeout = null;
      }
    } else {
      // Silence detected, start timeout if not already started
      if (!voxTimeout) {
        voxTimeout = setTimeout(() => {
          console.log('VOX: Stopping due to silence');
          stopRecording();
        }, voxDelay);
      }
    }
    
    // Continue monitoring
    if (mediaRecorder && mediaRecorder.state === 'recording') {
      requestAnimationFrame(checkVoiceActivity);
    }
  }
  
  checkVoiceActivity();
}

function toggleRecording() {
  if (mediaRecorder && mediaRecorder.state === 'recording') {
    stopRecording();
  } else {
    startRecording();
  }
}

function handleKey(e) {
  const startStopKeys = [' ', 'Enter', 'r', 'R', 'MediaRecord', 'MediaPlayPause'];
  const tagKeys = ['t', 'T', '#', 'MediaTrackNext'];
  if (startStopKeys.includes(e.key)) {
    e.preventDefault();
    toggleRecording();
  } else if (tagKeys.includes(e.key)) {
    e.preventDefault();
    const text = prompt('Tag text');
    addTag(text);
  }
}

document.addEventListener('keydown', handleKey);

document.getElementById('recordBtn').addEventListener('click', toggleRecording);

// VOX toggle
document.getElementById('voxToggle').addEventListener('change', (e) => {
  voxEnabled = e.target.checked;
  console.log('VOX enabled:', voxEnabled);
});

document.getElementById('tagBtn').addEventListener('click', () => {
  const text = prompt('Tag text');
  addTag(text);
});

// Load and display data
async function loadRecordings() {
  try {
    const response = await fetch('/api/recordings');
    const recordings = await response.json();
    displayRecordings(recordings);
  } catch (error) {
    console.error('Error loading recordings:', error);
  }
}

async function loadNotes() {
  try {
    const response = await fetch('/api/notes');
    const notes = await response.json();
    displayNotes(notes);
  } catch (error) {
    console.error('Error loading notes:', error);
  }
}

async function loadTasks() {
  try {
    const response = await fetch('/api/tasks');
    const tasks = await response.json();
    displayTasks(tasks);
  } catch (error) {
    console.error('Error loading tasks:', error);
  }
}

async function loadEvents() {
  try {
    const response = await fetch('/api/events');
    const events = await response.json();
    displayEvents(events);
  } catch (error) {
    console.error('Error loading events:', error);
  }
}

function displayRecordings(recordings) {
  const container = document.getElementById('recordingsList');
  if (!container) return;
  
  container.innerHTML = '';
  recordings.slice(-5).reverse().forEach(recording => { // Show last 5 recordings
    const div = document.createElement('div');
    div.className = 'recording-item';
    div.innerHTML = `
      <h4>${recording.title}</h4>
      <p>Status: ${recording.status}</p>
      <p>Created: ${new Date(recording.createdAt).toLocaleString()}</p>
      ${recording.summary ? `<p><strong>Summary:</strong> ${recording.summary}</p>` : ''}
      ${recording.transcript ? `<p><strong>Transcript:</strong> ${recording.transcript}</p>` : ''}
      ${recording.tags ? `<p><strong>Tags:</strong> ${recording.tags.join(', ')}</p>` : ''}
    `;
    container.appendChild(div);
  });
}

function displayNotes(notes) {
  const container = document.getElementById('notesList');
  if (!container) return;
  
  container.innerHTML = '';
  notes.slice(-5).reverse().forEach(note => { // Show last 5 notes
    const div = document.createElement('div');
    div.className = 'note-item';
    div.innerHTML = `
      <h4>${note.title || 'Untitled Note'}</h4>
      <p>${note.content || note.summary || 'No content'}</p>
      <p><small>Created: ${new Date(note.createdAt).toLocaleString()}</small></p>
    `;
    container.appendChild(div);
  });
}

function displayTasks(tasks) {
  const container = document.getElementById('tasksList');
  if (!container) return;
  
  container.innerHTML = '';
  const activeTasks = tasks.filter(task => !task.completed);
  activeTasks.forEach(task => {
    const div = document.createElement('div');
    div.className = 'task-item';
    div.innerHTML = `
      <label>
        <input type="checkbox" onchange="toggleTask('${task.id}', this.checked)">
        <span class="task-title">${task.title}</span>
      </label>
      ${task.description ? `<p class="task-description">${task.description}</p>` : ''}
      ${task.dueDate ? `<p class="task-due">Due: ${new Date(task.dueDate).toLocaleDateString()}</p>` : ''}
      <p class="task-priority">Priority: ${task.priority || 'normal'}</p>
    `;
    container.appendChild(div);
  });
}

function displayEvents(events) {
  const container = document.getElementById('eventsList');
  if (!container) return;
  
  container.innerHTML = '';
  // Show upcoming events
  const upcomingEvents = events
    .filter(event => new Date(event.startTime) > new Date())
    .sort((a, b) => new Date(a.startTime) - new Date(b.startTime))
    .slice(0, 5);
    
  upcomingEvents.forEach(event => {
    const div = document.createElement('div');
    div.className = 'event-item';
    div.innerHTML = `
      <h4>${event.title}</h4>
      <p><strong>Time:</strong> ${new Date(event.startTime).toLocaleString()}</p>
      ${event.description ? `<p>${event.description}</p>` : ''}
      ${event.attendees && event.attendees.length ? `<p><strong>Attendees:</strong> ${event.attendees.join(', ')}</p>` : ''}
    `;
    container.appendChild(div);
  });
}

async function toggleTask(taskId, completed) {
  try {
    await fetch(`/api/tasks/${taskId}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ completed })
    });
    loadTasks(); // Refresh task list
  } catch (error) {
    console.error('Error updating task:', error);
  }
}

document.addEventListener('pointerdown', (e) => {
  // Left click anywhere toggles recording; right/middle adds tag.
  if (e.button === 0 && e.target === document.body) {
    toggleRecording();
  } else if (e.button !== 0) {
    const text = prompt('Tag text');
    addTag(text);
  }
});

document.addEventListener('wheel', (e) => {
  if (e.deltaY < 0) {
    toggleRecording();
  } else if (e.deltaY > 0) {
    const text = prompt('Tag text');
    addTag(text);
  }
});

window.addEventListener('gamepadconnected', () => {
  requestAnimationFrame(pollGamepad);
});

function pollGamepad() {
  const pads = navigator.getGamepads();
  for (const gp of pads) {
    if (!gp) continue;
    gp.buttons.forEach((btn, i) => {
      const wasPressed = pressedButtons[i];
      if (btn.pressed && !wasPressed) {
        if (i === 0) {
          toggleRecording();
        } else if (i === 1) {
          const text = prompt('Tag text');
          addTag(text);
        }
      }
      pressedButtons[i] = btn.pressed;
    });
  }
  requestAnimationFrame(pollGamepad);
}

function loadCameraUrl() {
  const url = document.getElementById('cameraUrl').value;
  if (!url) return;
  stopVideo();
  const vid = document.getElementById('preview');
  vid.srcObject = null;
  vid.src = url;
  vid.play();
}

document.getElementById('cameraBtn')?.addEventListener('click', toggleCamera);
document.getElementById('loadCameraUrl')?.addEventListener('click', loadCameraUrl);
document.getElementById('printBtn')?.addEventListener('click', () => window.print());

function initDevices() {
  populateAudioInputs();
  populateVideoInputs();
}

initDevices();
navigator.mediaDevices.addEventListener('devicechange', initDevices);

// Load all data on page load
loadRecordings();
loadNotes();
loadTasks();
loadEvents();

// Refresh data periodically
setInterval(() => {
  loadRecordings();
  loadNotes();
  loadTasks();
  loadEvents();
}, 30000); // Refresh every 30 seconds

// ---- Timer ----
async function refreshTimer() {
  try {
    const res = await fetch('/api/timer/status');
    const data = await res.json();
    const display = document.getElementById('timerDisplay');
    if (!display) return;
    if (data.running) {
      const secs = Math.ceil(data.remaining / 1000);
      display.textContent = `${data.title}: ${secs}s remaining`;
    } else {
      display.textContent = 'No active timer';
    }
  } catch {}
}

async function startTimer() {
  const title = document.getElementById('timerTitle').value;
  const seconds = document.getElementById('timerSeconds').value;
  await fetch('/api/timer/start', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, seconds })
  });
  refreshTimer();
}

async function stopTimer() {
  await fetch('/api/timer/stop', { method: 'POST' });
  refreshTimer();
}

document.getElementById('startTimer')?.addEventListener('click', startTimer);
document.getElementById('stopTimer')?.addEventListener('click', stopTimer);
setInterval(refreshTimer, 1000);
refreshTimer();

// ---- Tally ----
async function loadCounters() {
  const res = await fetch('/api/tally');
  const data = await res.json();
  const list = document.getElementById('tallyList');
  if (!list) return;
  list.innerHTML = '';
  Object.entries(data).forEach(([name, count]) => {
    const li = document.createElement('li');
    li.textContent = `${name}: `;
    const span = document.createElement('span');
    span.textContent = count;
    li.appendChild(span);
    const btn = document.createElement('button');
    btn.textContent = '+';
    btn.addEventListener('click', () => incrementCounter(name));
    li.appendChild(btn);
    list.appendChild(li);
  });
}

async function addCounter() {
  const name = document.getElementById('tallyName').value.trim();
  if (!name) return;
  await fetch('/api/tally/create', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name })
  });
  document.getElementById('tallyName').value = '';
  loadCounters();
}

async function incrementCounter(name) {
  await fetch('/api/tally/increment', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ name })
  });
  loadCounters();
}

document.getElementById('addCounter')?.addEventListener('click', addCounter);
loadCounters();

// ---- Contacts & Call Logs ----
async function loadContacts() {
  try {
    const res = await fetch('/api/contacts');
    const data = await res.json();
    const list = document.getElementById('contactList');
    if (!list) return;
    list.innerHTML = '';
    data.forEach(c => {
      const li = document.createElement('li');
      li.textContent = `${c.name} (${c.phone})`;
      list.appendChild(li);
    });
  } catch {}
}

async function loadCallLogs() {
  try {
    const res = await fetch('/api/call-logs');
    const data = await res.json();
    const list = document.getElementById('callLogList');
    if (!list) return;
    list.innerHTML = '';
    data.forEach(l => {
      const time = new Date(l.time).toLocaleString();
      const li = document.createElement('li');
      li.textContent = `${l.type} with ${l.contact} at ${time} (${l.duration}s)`;
      list.appendChild(li);
    });
  } catch {}
}

loadContacts();
loadCallLogs();

// ---- Chatbot ----
function renderChat() {
  const log = document.getElementById('chatLog');
  if (!log) return;
  log.innerHTML = '';
  chatLog.forEach(entry => {
    const div = document.createElement('div');
    div.textContent = `${entry.who}: ${entry.text}`;
    log.appendChild(div);
  });
}

async function sendChat() {
  const input = document.getElementById('chatInput');
  const text = input.value.trim();
  if (!text) return;
  chatLog.push({ who: 'You', text });
  renderChat();
  input.value = '';
  try {
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: text })
    });
    const data = await res.json();
    const textReply = data.reply.replace(/^Radar Oriley:\s*/, '');
    chatLog.push({ who: 'Radar Oriley', text: textReply });
    renderChat();
  } catch {
    chatLog.push({ who: 'Radar Oriley', text: 'Something went wrong.' });
    renderChat();
  }
}

document.getElementById('chatSend')?.addEventListener('click', sendChat);
document.getElementById('chatInput')?.addEventListener('keydown', e => {
  if (e.key === 'Enter') sendChat();
});
