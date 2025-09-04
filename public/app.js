let mediaRecorder;
let currentStream;
let currentVideoStream;
let tags = [];
let pressedButtons = [];
let chatLog = [];

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
  const stream = await getStream();
  mediaRecorder = new MediaRecorder(stream);
  mediaRecorder.start();
  document.getElementById('recordBtn').classList.add('recording');
  document.getElementById('recordBtn').textContent = 'Stop Recording';
}

function stopRecording() {
  if (!mediaRecorder) return;
  mediaRecorder.stop();
  mediaRecorder = null;
  document.getElementById('recordBtn').classList.remove('recording');
  document.getElementById('recordBtn').textContent = 'Start Recording';
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
