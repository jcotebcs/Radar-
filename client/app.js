// audio recording
const recordBtn = document.getElementById('recordBtn');
const statusEl = document.getElementById('status');
function setStatus(msg) { statusEl.textContent = msg; }
let mediaRecorder;
let chunks = [];
recordBtn.addEventListener('click', async () => {
  try {
    if (!mediaRecorder || mediaRecorder.state === 'inactive') {
      if (!MediaRecorder || !MediaRecorder.isTypeSupported('audio/webm')) {
        setStatus('Recording not supported in this browser');
        return;
      }
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      mediaRecorder = new MediaRecorder(stream);
      mediaRecorder.ondataavailable = e => chunks.push(e.data);
      mediaRecorder.onstop = sendRecording;
      chunks = [];
      mediaRecorder.start();
      recordBtn.textContent = 'Stop Recording';
      setStatus('Recording...');
    } else {
      mediaRecorder.stop();
      recordBtn.textContent = 'Start Recording';
    }
  } catch (err) {
    setStatus('Microphone access failed');
  }
});

async function sendRecording() {
  try {
    const blob = new Blob(chunks, { type: 'audio/webm' });
    const init = await fetch('/v1/ingest/init', { method: 'POST' }).then(r => r.json());
    await fetch(`/v1/ingest/chunk?id=${init.recordingId}`, {
      method: 'POST',
      body: blob
    });
    const res = await fetch(`/v1/ingest/finalize?id=${init.recordingId}`, { method: 'POST' }).then(r => r.json());
    setStatus(`BLUF: ${res.bluf}`);
  } catch {
    setStatus('Upload failed');
  }
}

// timer
let currentTimerId = null;
const timerDisplay = document.getElementById('timerDisplay');
document.getElementById('createTimer').onclick = async () => {
  const title = document.getElementById('timerTitle').value;
  const duration = parseInt(document.getElementById('timerDuration').value, 10);
  try {
    const t = await fetch('/v1/timers', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title, duration })
    }).then(r => r.json());
    currentTimerId = t.id;
    timerDisplay.textContent = `${t.title}: ${t.duration}s`;
  } catch {
    setStatus('Timer creation failed');
  }
};

document.getElementById('startTimer').onclick = async () => {
  if (!currentTimerId) return;
  try {
    await fetch(`/v1/timers/${currentTimerId}/start`, { method: 'POST' });
    tick();
  } catch {
    setStatus('Failed to start timer');
  }
};

document.getElementById('stopTimer').onclick = async () => {
  if (!currentTimerId) return;
  try {
    await fetch(`/v1/timers/${currentTimerId}/stop`, { method: 'POST' });
  } catch {
    setStatus('Failed to stop timer');
  }
};

document.getElementById('deleteTimer').onclick = async () => {
  if (!currentTimerId) return;
  try {
    await fetch(`/v1/timers/${currentTimerId}`, { method: 'DELETE' });
    currentTimerId = null;
    timerDisplay.textContent = '';
  } catch {
    setStatus('Failed to delete timer');
  }
};

async function tick() {
  if (!currentTimerId) return;
  let timers;
  try {
    timers = await fetch('/v1/timers').then(r => r.json());
  } catch {
    setStatus('Timer update failed');
    return;
  }
  const t = timers.find(x => x.id === currentTimerId);
  if (t && t.start) {
    const remaining = Math.max(0, Math.ceil((t.end - Date.now()) / 1000));
    timerDisplay.textContent = `${t.title}: ${remaining}s`;
    if (remaining > 0) setTimeout(tick, 1000);
  }
}

// tally
document.getElementById('addTally').onclick = async () => {
  const title = document.getElementById('tallyTitle').value;
  try {
    const t = await fetch('/v1/tally', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ title })
    }).then(r => r.json());
    addTallyToList(t);
  } catch {
    setStatus('Failed to add tally');
  }
};

function addTallyToList(t) {
  const li = document.createElement('li');
  const label = document.createElement('span');
  label.textContent = `${t.title}: `;
  const value = document.createElement('span');
  value.textContent = t.value;

  async function update(path) {
    try {
      const updated = await fetch(`/v1/tally/${t.id}/${path}`, { method: 'POST' }).then(r => r.json());
      value.textContent = updated.value;
    } catch {
      setStatus('Update failed');
    }
  }

  const incBtn = document.createElement('button');
  incBtn.textContent = '+';
  incBtn.setAttribute('aria-label', `Increment ${t.title}`);
  incBtn.onclick = () => update('inc');

  const decBtn = document.createElement('button');
  decBtn.textContent = '-';
  decBtn.setAttribute('aria-label', `Decrement ${t.title}`);
  decBtn.onclick = () => update('dec');

  const resetBtn = document.createElement('button');
  resetBtn.textContent = 'reset';
  resetBtn.setAttribute('aria-label', `Reset ${t.title}`);
  resetBtn.onclick = () => update('reset');

  const delBtn = document.createElement('button');
  delBtn.textContent = 'delete';
  delBtn.setAttribute('aria-label', `Delete ${t.title}`);
  delBtn.onclick = async () => {
    try {
      await fetch(`/v1/tally/${t.id}`, { method: 'DELETE' });
      li.remove();
    } catch {
      setStatus('Delete failed');
    }
  };

  li.append(label, value, incBtn, decBtn, resetBtn, delBtn);
  document.getElementById('tallyList').appendChild(li);
}

async function loadInitial() {
  try {
    const [ts, talliesData] = await Promise.all([
      fetch('/v1/timers').then(r => r.json()),
      fetch('/v1/tally').then(r => r.json())
    ]);
    if (ts.length > 0) {
      const t = ts[ts.length - 1];
      currentTimerId = t.id;
      timerDisplay.textContent = `${t.title}: ${t.duration}s`;
      if (t.start) tick();
    }
    talliesData.forEach(addTallyToList);
  } catch {
    setStatus('Failed to load data');
  }
}

loadInitial();
