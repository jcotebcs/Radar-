let mediaRecorder;
let currentStream;
let currentVideoStream;
let tags = [];
let pressedButtons = [];
let chatLog = [];

// UI Helper functions
function showLoading(element) {
  if (typeof element === 'string') {
    element = document.getElementById(element);
  }
  if (element) {
    element.classList.add('loading');
    if (element.tagName === 'BUTTON') {
      element.disabled = true;
    }
  }
}

function hideLoading(element) {
  if (typeof element === 'string') {
    element = document.getElementById(element);
  }
  if (element) {
    element.classList.remove('loading');
    if (element.tagName === 'BUTTON') {
      element.disabled = false;
    }
  }
}

function showSuccess(message, duration = 3000) {
  const notification = document.createElement('div');
  notification.textContent = '✅ ' + message;
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: var(--accent-color);
    color: white;
    padding: 1rem 1.5rem;
    border-radius: var(--border-radius);
    box-shadow: var(--shadow-lg);
    z-index: 1000;
    animation: slideIn 0.3s ease-out;
  `;
  document.body.appendChild(notification);
  setTimeout(() => {
    notification.style.animation = 'slideOut 0.3s ease-out';
    setTimeout(() => notification.remove(), 300);
  }, duration);
}

function showError(message, duration = 5000) {
  const notification = document.createElement('div');
  notification.textContent = '❌ ' + message;
  notification.style.cssText = `
    position: fixed;
    top: 20px;
    right: 20px;
    background: var(--danger-color);
    color: white;
    padding: 1rem 1.5rem;
    border-radius: var(--border-radius);
    box-shadow: var(--shadow-lg);
    z-index: 1000;
    animation: slideIn 0.3s ease-out;
  `;
  document.body.appendChild(notification);
  setTimeout(() => {
    notification.style.animation = 'slideOut 0.3s ease-out';
    setTimeout(() => notification.remove(), 300);
  }, duration);
}

// Add notification animations to CSS
if (!document.getElementById('notification-styles')) {
  const style = document.createElement('style');
  style.id = 'notification-styles';
  style.textContent = `
    @keyframes slideIn {
      from { transform: translateX(100%); opacity: 0; }
      to { transform: translateX(0); opacity: 1; }
    }
    @keyframes slideOut {
      from { transform: translateX(0); opacity: 1; }
      to { transform: translateX(100%); opacity: 0; }
    }
  `;
  document.head.appendChild(style);
}

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
  try {
    const deviceId = document.getElementById('videoInput').value;
    if (currentVideoStream) {
      currentVideoStream.getTracks().forEach(t => t.stop());
    }
    currentVideoStream = await navigator.mediaDevices.getUserMedia({
      video: deviceId ? { deviceId: { exact: deviceId } } : true
    });
    const preview = document.getElementById('preview');
    preview.srcObject = currentVideoStream;
    preview.style.display = 'block';
    showSuccess('Camera started');
  } catch (error) {
    showError('Failed to start camera: ' + error.message);
    console.error('Camera error:', error);
  }
}

function stopVideo() {
  if (!currentVideoStream) return;
  try {
    currentVideoStream.getTracks().forEach(t => t.stop());
    currentVideoStream = null;
    const preview = document.getElementById('preview');
    preview.srcObject = null;
    preview.style.display = 'none';
    showSuccess('Camera stopped');
  } catch (error) {
    showError('Failed to stop camera: ' + error.message);
    console.error('Stop camera error:', error);
  }
}

async function toggleCamera() {
  if (currentVideoStream) {
    stopVideo();
    document.getElementById('cameraBtn').textContent = '📷 Start Camera';
  } else {
    showLoading('cameraBtn');
    await getVideoStream();
    hideLoading('cameraBtn');
    document.getElementById('cameraBtn').textContent = '⏹️ Stop Camera';
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
    showLoading('recordBtn');
    const stream = await getStream();
    mediaRecorder = new MediaRecorder(stream);
    mediaRecorder.start();
    document.getElementById('recordBtn').classList.add('recording');
    document.getElementById('recordBtn').textContent = '⏹️ Stop Recording';
    hideLoading('recordBtn');
    showSuccess('Recording started');
  } catch (error) {
    hideLoading('recordBtn');
    showError('Failed to start recording: ' + error.message);
    console.error('Recording error:', error);
  }
}

function stopRecording() {
  if (!mediaRecorder) return;
  try {
    mediaRecorder.stop();
    mediaRecorder = null;
    document.getElementById('recordBtn').classList.remove('recording');
    document.getElementById('recordBtn').textContent = '🔴 Start Recording';
    showSuccess('Recording stopped');
  } catch (error) {
    showError('Failed to stop recording: ' + error.message);
    console.error('Stop recording error:', error);
  }
}

async function toggleRecording() {
  if (mediaRecorder && mediaRecorder.state === 'recording') {
    stopRecording();
  } else {
    await startRecording();
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

// ---- Timer ----
async function refreshTimer() {
  try {
    const res = await fetch('/api/timer/status');
    const response = await res.json();
    const data = response.data || response; // Handle both old and new format
    const display = document.getElementById('timerDisplay');
    if (!display) return;
    if (data.running) {
      const secs = Math.ceil(data.remaining / 1000);
      display.textContent = `${data.title}: ${secs}s remaining`;
    } else if (data.completed) {
      display.textContent = '⏰ Timer completed!';
      showSuccess('Timer completed!');
    } else {
      display.textContent = 'No active timer';
    }
  } catch (error) {
    showError('Failed to refresh timer status');
  }
}

async function startTimer() {
  const title = document.getElementById('timerTitle').value.trim();
  const seconds = parseInt(document.getElementById('timerSeconds').value);
  
  if (!title) {
    showError('Please enter a timer title');
    return;
  }
  if (!seconds || seconds <= 0) {
    showError('Please enter a valid duration in seconds');
    return;
  }
  
  try {
    showLoading('startTimer');
    const res = await fetch('/api/timer/start', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, seconds })
    });
    
    const response = await res.json();
    hideLoading('startTimer');
    
    if (response.success) {
      showSuccess(`Timer "${title}" started for ${seconds} seconds`);
      document.getElementById('timerTitle').value = '';
      document.getElementById('timerSeconds').value = '';
    } else {
      showError(response.data?.error || 'Failed to start timer');
    }
    refreshTimer();
  } catch (error) {
    hideLoading('startTimer');
    showError('Failed to start timer');
  }
}

async function stopTimer() {
  try {
    showLoading('stopTimer');
    const res = await fetch('/api/timer/stop', { method: 'POST' });
    const response = await res.json();
    hideLoading('stopTimer');
    
    if (response.success) {
      showSuccess('Timer stopped');
    }
    refreshTimer();
  } catch (error) {
    hideLoading('stopTimer');
    showError('Failed to stop timer');
  }
}

document.getElementById('startTimer')?.addEventListener('click', startTimer);
document.getElementById('stopTimer')?.addEventListener('click', stopTimer);
setInterval(refreshTimer, 1000);
refreshTimer();

// ---- Tally ----
async function loadCounters() {
  try {
    const res = await fetch('/api/tally');
    const response = await res.json();
    const data = response.data || response; // Handle both old and new format
    const list = document.getElementById('tallyList');
    if (!list) return;
    list.innerHTML = '';
    
    if (typeof data === 'object' && data !== null) {
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
  } catch (error) {
    showError('Failed to load counters');
  }
}

async function addCounter() {
  const name = document.getElementById('tallyName').value.trim();
  if (!name) {
    showError('Please enter a counter name');
    return;
  }
  
  try {
    showLoading('addCounter');
    const res = await fetch('/api/tally/create', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name })
    });
    
    const response = await res.json();
    hideLoading('addCounter');
    
    if (response.success) {
      showSuccess(`Counter "${name}" created`);
      document.getElementById('tallyName').value = '';
      loadCounters();
    } else {
      showError(response.data?.error || 'Failed to create counter');
    }
  } catch (error) {
    hideLoading('addCounter');
    showError('Failed to create counter');
  }
}

async function incrementCounter(name) {
  try {
    const res = await fetch('/api/tally/increment', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name })
    });
    
    const response = await res.json();
    if (response.success) {
      const count = response.data?.count;
      if (count !== undefined) {
        showSuccess(`${name}: ${count}`);
      }
      loadCounters();
    } else {
      showError(response.data?.error || 'Failed to increment counter');
    }
  } catch (error) {
    showError('Failed to increment counter');
  }
}

document.getElementById('addCounter')?.addEventListener('click', addCounter);
loadCounters();

// ---- Contacts & Call Logs ----
async function loadContacts() {
  try {
    const res = await fetch('/api/contacts');
    const response = await res.json();
    const data = response.data || response; // Handle both old and new format
    const list = document.getElementById('contactList');
    if (!list) return;
    list.innerHTML = '';
    
    if (Array.isArray(data)) {
      data.forEach(c => {
        const li = document.createElement('li');
        li.innerHTML = `
          <span>${c.name}</span>
          <span style="color: var(--text-muted); font-size: 0.875rem;">${c.phone}</span>
        `;
        list.appendChild(li);
      });
    }
  } catch (error) {
    showError('Failed to load contacts');
  }
}

async function loadCallLogs() {
  try {
    const res = await fetch('/api/call-logs');
    const response = await res.json();
    const data = response.data || response; // Handle both old and new format
    const list = document.getElementById('callLogList');
    if (!list) return;
    list.innerHTML = '';
    
    if (Array.isArray(data)) {
      data.forEach(l => {
        const time = new Date(l.time).toLocaleString();
        const li = document.createElement('li');
        const typeIcon = l.type === 'incoming' ? '📞' : '📤';
        li.innerHTML = `
          <span>${typeIcon} ${l.type} with ${l.contact}</span>
          <span style="color: var(--text-muted); font-size: 0.75rem;">${time} (${l.duration}s)</span>
        `;
        list.appendChild(li);
      });
    }
  } catch (error) {
    showError('Failed to load call logs');
  }
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
    div.innerHTML = `<strong>${entry.who}:</strong> ${entry.text}`;
    if (entry.who === 'You') {
      div.style.textAlign = 'right';
      div.style.color = 'var(--primary-color)';
    } else {
      div.style.color = 'var(--accent-color)';
    }
    log.appendChild(div);
  });
  log.scrollTop = log.scrollHeight; // Auto-scroll to bottom
}

async function sendChat() {
  const input = document.getElementById('chatInput');
  const text = input.value.trim();
  if (!text) {
    showError('Please enter a message');
    return;
  }
  
  chatLog.push({ who: 'You', text });
  renderChat();
  input.value = '';
  
  try {
    showLoading('chatSend');
    const res = await fetch('/api/chat', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ message: text })
    });
    
    const response = await res.json();
    hideLoading('chatSend');
    
    if (response.success) {
      const reply = response.data?.reply || 'No response';
      const textReply = reply.replace(/^Radar Oriley:\s*/, '');
      chatLog.push({ who: 'Radar Oriley', text: textReply });
    } else {
      chatLog.push({ who: 'Radar Oriley', text: 'Sorry, I encountered an error.' });
    }
    renderChat();
  } catch (error) {
    hideLoading('chatSend');
    chatLog.push({ who: 'Radar Oriley', text: 'Something went wrong with the connection.' });
    renderChat();
  }
}

document.getElementById('chatSend')?.addEventListener('click', sendChat);
document.getElementById('chatInput')?.addEventListener('keydown', e => {
  if (e.key === 'Enter') sendChat();
});
