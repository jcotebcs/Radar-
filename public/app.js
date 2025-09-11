let mediaRecorder;
let currentStream;
let currentVideoStream;
let tags = [];
let pressedButtons = [];
let chatLog = [];
let currentRecordingId = null;
let audioChunks = [];

// Service Worker registration with error handling
if ('serviceWorker' in navigator) {
  navigator.serviceWorker.register('/sw.js')
    .then(reg => console.log('Service Worker registered:', reg.scope))
    .catch(err => console.warn('Service Worker registration failed:', err));
}

async function populateAudioInputs() {
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const select = document.getElementById('audioInput');
    if (!select) return;
    
    select.innerHTML = '<option value="">Default Microphone</option>';
    
    devices.filter(d => d.kind === 'audioinput').forEach((d, i) => {
      const opt = document.createElement('option');
      opt.value = d.deviceId;
      opt.textContent = d.label || `Microphone ${i+1}`;
      select.appendChild(opt);
    });
  } catch (error) {
    console.error('Error populating audio inputs:', error);
    showError('Could not access microphone devices');
  }
}

async function populateVideoInputs() {
  try {
    const devices = await navigator.mediaDevices.enumerateDevices();
    const select = document.getElementById('videoInput');
    if (!select) return;
    
    select.innerHTML = '<option value="">Default Camera</option>';
    
    devices.filter(d => d.kind === 'videoinput').forEach((d, i) => {
      const opt = document.createElement('option');
      opt.value = d.deviceId;
      opt.textContent = d.label || `Camera ${i+1}`;
      select.appendChild(opt);
    });
  } catch (error) {
    console.error('Error populating video inputs:', error);
    showError('Could not access camera devices');
  }
}

// Error display function
function showError(message) {
  const errorDiv = document.getElementById('errorDisplay') || createErrorDisplay();
  errorDiv.textContent = message;
  errorDiv.style.display = 'block';
  setTimeout(() => {
    errorDiv.style.display = 'none';
  }, 5000);
}

function createErrorDisplay() {
  const errorDiv = document.createElement('div');
  errorDiv.id = 'errorDisplay';
  errorDiv.style.cssText = `
    position: fixed; top: 10px; right: 10px; 
    background: #ff4444; color: white; 
    padding: 10px; border-radius: 4px; 
    z-index: 1000; display: none;
    max-width: 300px; word-wrap: break-word;
  `;
  document.body.appendChild(errorDiv);
  return errorDiv;
}

async function getStream() {
  try {
    const deviceId = document.getElementById('audioInput').value;
    if (currentStream) {
      currentStream.getTracks().forEach(t => t.stop());
    }
    currentStream = await navigator.mediaDevices.getUserMedia({
      audio: deviceId ? { deviceId: { exact: deviceId } } : true
    });
    return currentStream;
  } catch (error) {
    console.error('Error getting audio stream:', error);
    showError('Could not access microphone. Please check permissions.');
    throw error;
  }
}

async function getVideoStream() {
  try {
    const deviceId = document.getElementById('videoInput').value;
    if (currentVideoStream) {
      currentVideoStream.getTracks().forEach(t => t.stop());
    }
    currentVideoStream = await navigator.mediaDevices.getUserMedia({
      video: deviceId ? { deviceId: { exact: deviceId } } : true
    });
    document.getElementById('preview').srcObject = currentVideoStream;
  } catch (error) {
    console.error('Error getting video stream:', error);
    showError('Could not access camera. Please check permissions.');
    throw error;
  }
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
  if (!ul) return;
  
  ul.innerHTML = '';
  tags.forEach((t, index) => {
    const li = document.createElement('li');
    li.innerHTML = `<span>${escapeHtml(t)}</span>`;
    ul.appendChild(li);
  });
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

async function addTag(text) {
  if (!text || typeof text !== 'string') return;
  
  const sanitizedText = text.trim().slice(0, 200);
  if (!sanitizedText) return;
  
  try {
    // Add to local tags
    tags.push(sanitizedText);
    updateTagList();
    
    // If recording, send to server
    if (currentRecordingId) {
      const response = await fetch('/api/recording/tag', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          recordingId: currentRecordingId, 
          tag: sanitizedText 
        })
      });
      
      if (!response.ok) {
        console.warn('Failed to save tag to recording');
      }
    }
  } catch (error) {
    console.error('Error adding tag:', error);
    showError('Failed to add tag');
  }
}

async function startRecording() {
  try {
    // Start recording session on server
    const response = await fetch('/api/recording/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title: `Recording ${new Date().toLocaleTimeString()}` })
    });
    
    if (!response.ok) {
      throw new Error('Failed to start recording session');
    }
    
    const data = await response.json();
    currentRecordingId = data.recordingId;
    
    // Get audio stream and start MediaRecorder
    const stream = await getStream();
    audioChunks = [];
    
    mediaRecorder = new MediaRecorder(stream, {
      mimeType: MediaRecorder.isTypeSupported('audio/webm') ? 'audio/webm' : 'audio/mp4'
    });
    
    mediaRecorder.ondataavailable = async (event) => {
      if (event.data.size > 0) {
        audioChunks.push(event.data);
        
        // Convert to base64 and send to server
        try {
          const reader = new FileReader();
          reader.onload = async () => {
            const base64 = reader.result.split(',')[1];
            await fetch('/api/recording/chunk', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({ 
                recordingId: currentRecordingId, 
                chunk: base64 
              })
            });
          };
          reader.readAsDataURL(event.data);
        } catch (error) {
          console.error('Error sending audio chunk:', error);
        }
      }
    };
    
    mediaRecorder.onerror = (error) => {
      console.error('MediaRecorder error:', error);
      showError('Recording error occurred');
    };
    
    mediaRecorder.start(1000); // Record in 1-second chunks
    
    const recordBtn = document.getElementById('recordBtn');
    recordBtn.classList.add('recording');
    recordBtn.textContent = 'Stop Recording';
    
    console.log('Recording started with ID:', currentRecordingId);
  } catch (error) {
    console.error('Failed to start recording:', error);
    showError('Failed to start recording');
    currentRecordingId = null;
  }
}

async function stopRecording() {
  try {
    if (!mediaRecorder || !currentRecordingId) return;
    
    mediaRecorder.stop();
    mediaRecorder = null;
    
    // Stop recording session on server
    const response = await fetch('/api/recording/stop', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ recordingId: currentRecordingId })
    });
    
    if (!response.ok) {
      throw new Error('Failed to stop recording session');
    }
    
    const data = await response.json();
    console.log('Recording stopped:', data);
    
    const recordBtn = document.getElementById('recordBtn');
    recordBtn.classList.remove('recording');
    recordBtn.textContent = 'Start Recording';
    
    currentRecordingId = null;
    audioChunks = [];
    
  } catch (error) {
    console.error('Failed to stop recording:', error);
    showError('Failed to stop recording properly');
  }
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

document.getElementById('tagBtn').addEventListener('click', () => {
  const text = prompt('Tag text');
  addTag(text);
});

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

// ---- Timer with improved functionality ----
async function refreshTimer() {
  try {
    const res = await fetch('/api/timer/status');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    
    const data = await res.json();
    const display = document.getElementById('timerDisplay');
    if (!display) return;
    
    if (data.running) {
      const secs = Math.ceil(data.remaining / 1000);
      const mins = Math.floor(secs / 60);
      const remainingSecs = secs % 60;
      const timeDisplay = `${mins}:${remainingSecs.toString().padStart(2, '0')}`;
      display.textContent = `${data.title}: ${timeDisplay} remaining`;
    } else {
      display.textContent = 'No active timer';
    }
  } catch (error) {
    console.error('Timer refresh error:', error);
    const display = document.getElementById('timerDisplay');
    if (display) display.textContent = 'Timer status unavailable';
  }
}

async function startTimer() {
  try {
    const titleInput = document.getElementById('timerTitle');
    const secondsInput = document.getElementById('timerSeconds');
    
    const title = titleInput.value.trim() || 'Timer';
    const seconds = Math.max(1, Math.min(Number(secondsInput.value) || 60, 86400)); // 1 sec to 24 hours
    
    const response = await fetch('/api/timer/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, seconds })
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    // Clear inputs
    titleInput.value = '';
    secondsInput.value = '';
    
    refreshTimer();
  } catch (error) {
    console.error('Start timer error:', error);
    showError('Failed to start timer');
  }
}

async function stopTimer() {
  try {
    const response = await fetch('/api/timer/stop', { method: 'POST' });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    refreshTimer();
  } catch (error) {
    console.error('Stop timer error:', error);
    showError('Failed to stop timer');
  }
}

document.getElementById('startTimer')?.addEventListener('click', startTimer);
document.getElementById('stopTimer')?.addEventListener('click', stopTimer);
setInterval(refreshTimer, 1000);
refreshTimer();

// ---- Tally with improved functionality ----
async function loadCounters() {
  try {
    const res = await fetch('/api/tally');
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    
    const data = await res.json();
    const list = document.getElementById('tallyList');
    if (!list) return;
    
    list.innerHTML = '';
    Object.entries(data).forEach(([name, count]) => {
      const li = document.createElement('li');
      li.innerHTML = `
        <span>${escapeHtml(name)}: </span>
        <strong>${count}</strong>
        <button onclick="incrementCounter('${escapeHtml(name).replace(/'/g, "\\'")}')">+</button>
        <button onclick="decrementCounter('${escapeHtml(name).replace(/'/g, "\\'")}')">-</button>
      `;
      list.appendChild(li);
    });
  } catch (error) {
    console.error('Load counters error:', error);
    showError('Failed to load counters');
  }
}

async function addCounter() {
  try {
    const input = document.getElementById('tallyName');
    const name = input.value.trim();
    
    if (!name) {
      showError('Counter name is required');
      return;
    }
    
    if (name.length > 50) {
      showError('Counter name too long (max 50 characters)');
      return;
    }
    
    const response = await fetch('/api/tally/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name })
    });
    
    if (!response.ok) {
      const error = await response.json();
      throw new Error(error.error || 'Failed to create counter');
    }
    
    input.value = '';
    loadCounters();
    
  } catch (error) {
    console.error('Add counter error:', error);
    showError(error.message || 'Failed to add counter');
  }
}

async function incrementCounter(name) {
  await changeCounter(name, 1);
}

async function decrementCounter(name) {
  await changeCounter(name, -1);
}

async function changeCounter(name, amount) {
  try {
    const response = await fetch('/api/tally/increment', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, amount })
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    loadCounters();
  } catch (error) {
    console.error('Change counter error:', error);
    showError('Failed to update counter');
  }
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

// ---- Chatbot with improved functionality ----
function renderChat() {
  const log = document.getElementById('chatLog');
  if (!log) return;
  
  log.innerHTML = '';
  chatLog.forEach(entry => {
    const div = document.createElement('div');
    div.className = entry.who === 'You' ? 'chat-user' : 'chat-bot';
    div.innerHTML = `<strong>${escapeHtml(entry.who)}:</strong> ${escapeHtml(entry.text)}`;
    log.appendChild(div);
  });
  
  // Auto-scroll to bottom
  log.scrollTop = log.scrollHeight;
}

async function sendChat() {
  const input = document.getElementById('chatInput');
  if (!input) return;
  
  const text = input.value.trim();
  if (!text) return;
  
  // Add user message
  chatLog.push({ who: 'You', text });
  renderChat();
  input.value = '';
  
  // Disable input while processing
  input.disabled = true;
  
  try {
    const response = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: text })
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    const data = await response.json();
    chatLog.push({ who: 'Radar Oriley', text: data.reply });
    
  } catch (error) {
    console.error('Chat error:', error);
    chatLog.push({ 
      who: 'Radar Oriley', 
      text: 'Sorry, I\'m having trouble right now. Try again in a moment.' 
    });
  } finally {
    input.disabled = false;
    input.focus();
    renderChat();
  }
}

document.getElementById('chatSend')?.addEventListener('click', sendChat);
document.getElementById('chatInput')?.addEventListener('keydown', e => {
  if (e.key === 'Enter') sendChat();
});
