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

// ---- Integration Features ----

// Google Authentication and Services
let isGoogleAuthenticated = false;

async function checkGoogleAuth() {
  try {
    const res = await fetch('/auth/status');
    const data = await res.json();
    isGoogleAuthenticated = data.authenticated;
    
    const authStatus = document.getElementById('authStatus');
    const authButton = document.getElementById('googleAuth');
    const googleFeatures = document.getElementById('googleFeatures');
    
    if (isGoogleAuthenticated) {
      authStatus.textContent = `Connected as ${data.user?.name || 'User'}`;
      authButton.textContent = 'Disconnect';
      authButton.onclick = () => window.location.href = '/auth/logout';
      googleFeatures.style.display = 'block';
    } else {
      authStatus.textContent = 'Not authenticated';
      authButton.textContent = 'Connect Google Account';
      authButton.onclick = () => window.location.href = '/auth/google';
      googleFeatures.style.display = 'none';
    }
  } catch (error) {
    console.error('Error checking auth status:', error);
  }
}

async function createCalendarEvent() {
  if (!isGoogleAuthenticated) {
    alert('Please connect your Google account first');
    return;
  }

  const title = prompt('Event title:');
  const description = prompt('Event description:');
  const startTime = prompt('Start time (YYYY-MM-DDTHH:MM):');
  
  if (!title || !startTime) return;

  const endTime = new Date(new Date(startTime).getTime() + 60 * 60 * 1000).toISOString();

  try {
    const res = await fetch('/api/google/calendar/event', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title,
        description,
        startTime,
        endTime
      })
    });
    
    const data = await res.json();
    if (data.success) {
      alert('Calendar event created successfully!');
    } else {
      alert('Error creating event: ' + data.error);
    }
  } catch (error) {
    alert('Error creating event: ' + error.message);
  }
}

async function uploadToDrive() {
  if (!isGoogleAuthenticated) {
    alert('Please connect your Google account first');
    return;
  }

  const name = prompt('File name:');
  const content = prompt('File content:');
  
  if (!name || !content) return;

  try {
    const res = await fetch('/api/google/drive/upload', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name,
        content,
        mimeType: 'text/plain'
      })
    });
    
    const data = await res.json();
    if (data.success) {
      alert(`File uploaded to Drive! View at: ${data.file.webViewLink}`);
    } else {
      alert('Error uploading file: ' + data.error);
    }
  } catch (error) {
    alert('Error uploading file: ' + error.message);
  }
}

async function sendEmail() {
  if (!isGoogleAuthenticated) {
    alert('Please connect your Google account first');
    return;
  }

  const to = prompt('Recipient email:');
  const subject = prompt('Subject:');
  const body = prompt('Message:');
  
  if (!to || !subject || !body) return;

  try {
    const res = await fetch('/api/google/gmail/send', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ to, subject, body })
    });
    
    const data = await res.json();
    if (data.success) {
      alert('Email sent successfully!');
    } else {
      alert('Error sending email: ' + data.error);
    }
  } catch (error) {
    alert('Error sending email: ' + error.message);
  }
}

async function viewCalendar() {
  if (!isGoogleAuthenticated) {
    alert('Please connect your Google account first');
    return;
  }

  try {
    const res = await fetch('/api/google/calendar/events');
    const data = await res.json();
    
    if (data.events && data.events.length > 0) {
      const eventList = data.events.map(event => 
        `${event.summary} - ${new Date(event.start.dateTime || event.start.date).toLocaleString()}`
      ).join('\n');
      alert('Upcoming events:\n\n' + eventList);
    } else {
      alert('No upcoming events found');
    }
  } catch (error) {
    alert('Error fetching calendar: ' + error.message);
  }
}

// Notion Integration
async function createNotionPage() {
  const databaseId = document.getElementById('notionDatabase').value.trim();
  if (!databaseId) {
    alert('Please enter a Notion database ID');
    return;
  }

  const title = prompt('Page title:');
  const summary = prompt('Summary:');
  const transcript = prompt('Transcript:');
  
  if (!title) return;

  try {
    const res = await fetch('/api/notion/page', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        databaseId,
        pageData: {
          title,
          summary,
          transcript,
          tags: tags,
          recordingDate: new Date().toISOString()
        }
      })
    });
    
    const data = await res.json();
    if (data.success) {
      alert('Notion page created successfully!');
    } else {
      alert('Error creating Notion page: ' + data.error);
    }
  } catch (error) {
    alert('Error creating Notion page: ' + error.message);
  }
}

async function searchNotion() {
  const query = prompt('Search query:');
  if (!query) return;

  try {
    const res = await fetch('/api/notion/search', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ query })
    });
    
    const data = await res.json();
    if (data.results && data.results.length > 0) {
      const resultList = data.results.map(result => 
        `${result.properties?.Name?.title?.[0]?.text?.content || 'Untitled'}`
      ).join('\n');
      alert('Search results:\n\n' + resultList);
    } else {
      alert('No results found');
    }
  } catch (error) {
    alert('Error searching Notion: ' + error.message);
  }
}

// Export Functions
async function exportJSON() {
  // Load current data from the page
  const currentTallies = await fetch('/api/tally').then(r => r.json()).catch(() => ({}));
  const currentContacts = await fetch('/api/contacts').then(r => r.json()).catch(() => []);
  const currentCallLogs = await fetch('/api/call-logs').then(r => r.json()).catch(() => []);
  
  const exportData = {
    title: 'Radar Recording Export',
    timestamp: new Date().toISOString(),
    tags: tags,
    contacts: currentContacts,
    callLogs: currentCallLogs,
    tallies: currentTallies,
    currentTimer: currentTimer
  };

  try {
    const res = await fetch('/api/export/json', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        data: exportData,
        filename: `radar-export-${Date.now()}`
      })
    });
    
    const data = await res.json();
    if (data.success) {
      window.open(`/api/export/download/${data.filename}`, '_blank');
    } else {
      alert('Error exporting: ' + data.error);
    }
  } catch (error) {
    alert('Error exporting: ' + error.message);
  }
}

async function exportCSV() {
  // Convert data to CSV-friendly format
  const currentTallies = await fetch('/api/tally').then(r => r.json()).catch(() => ({}));
  
  const csvData = [
    { type: 'tag', name: 'Sample Tag', timestamp: new Date().toISOString() },
    ...Object.entries(currentTallies).map(([name, count]) => ({
      type: 'tally',
      name,
      count,
      timestamp: new Date().toISOString()
    }))
  ];

  try {
    const res = await fetch('/api/export/csv', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        data: csvData,
        filename: `radar-export-${Date.now()}`
      })
    });
    
    const data = await res.json();
    if (data.success) {
      window.open(`/api/export/download/${data.filename}`, '_blank');
    } else {
      alert('Error exporting: ' + data.error);
    }
  } catch (error) {
    alert('Error exporting: ' + error.message);
  }
}

async function exportMarkdown() {
  const currentTallies = await fetch('/api/tally').then(r => r.json()).catch(() => ({}));
  
  const markdownData = {
    title: 'Radar Notes Export',
    summary: 'Voice note session export',
    tags: tags,
    actionItems: ['Review recording', 'Process notes'],
    transcript: 'Sample transcript content',
    metadata: {
      exportDate: new Date().toISOString(),
      tallyCounters: currentTallies
    }
  };

  try {
    const res = await fetch('/api/export/markdown', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        data: markdownData,
        filename: `radar-export-${Date.now()}`
      })
    });
    
    const data = await res.json();
    if (data.success) {
      window.open(`/api/export/download/${data.filename}`, '_blank');
    } else {
      alert('Error exporting: ' + data.error);
    }
  } catch (error) {
    alert('Error exporting: ' + error.message);
  }
}

async function exportCalendar() {
  const events = [
    {
      id: '1',
      title: 'Radar Note Review',
      startTime: new Date().toISOString(),
      endTime: new Date(Date.now() + 60 * 60 * 1000).toISOString(),
      description: 'Review today\'s voice notes'
    }
  ];

  try {
    const res = await fetch('/api/export/ics', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        events,
        filename: `radar-calendar-${Date.now()}`
      })
    });
    
    const data = await res.json();
    if (data.success) {
      window.open(`/api/export/download/${data.filename}`, '_blank');
    } else {
      alert('Error exporting calendar: ' + data.error);
    }
  } catch (error) {
    alert('Error exporting calendar: ' + error.message);
  }
}

function shareLink() {
  const shareData = {
    title: 'Radar Notes',
    text: 'Check out my voice notes from Radar!',
    url: window.location.href
  };

  if (navigator.share) {
    navigator.share(shareData);
  } else {
    navigator.clipboard.writeText(window.location.href);
    alert('Share link copied to clipboard!');
  }
}

// Event Listeners for Integration Features
document.getElementById('createCalendarEvent')?.addEventListener('click', createCalendarEvent);
document.getElementById('uploadToDrive')?.addEventListener('click', uploadToDrive);
document.getElementById('sendEmail')?.addEventListener('click', sendEmail);
document.getElementById('viewCalendar')?.addEventListener('click', viewCalendar);

document.getElementById('createNotionPage')?.addEventListener('click', createNotionPage);
document.getElementById('searchNotion')?.addEventListener('click', searchNotion);

document.getElementById('exportJSON')?.addEventListener('click', exportJSON);
document.getElementById('exportCSV')?.addEventListener('click', exportCSV);
document.getElementById('exportMarkdown')?.addEventListener('click', exportMarkdown);
document.getElementById('exportCalendar')?.addEventListener('click', exportCalendar);
document.getElementById('shareLink')?.addEventListener('click', shareLink);

// Initialize integrations
checkGoogleAuth();

// Check for auth success from URL params
const urlParams = new URLSearchParams(window.location.search);
if (urlParams.get('auth') === 'success') {
  setTimeout(() => {
    checkGoogleAuth();
    window.history.replaceState({}, document.title, window.location.pathname);
  }, 1000);
}
