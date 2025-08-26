// audio recording
const recordBtn = document.getElementById('recordBtn');
let mediaRecorder;
let chunks = [];
recordBtn.addEventListener('click', async () => {
  if (!mediaRecorder || mediaRecorder.state === 'inactive') {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    mediaRecorder = new MediaRecorder(stream);
    mediaRecorder.ondataavailable = e => chunks.push(e.data);
    mediaRecorder.onstop = sendRecording;
    chunks = [];
    mediaRecorder.start();
    recordBtn.textContent = 'Stop Recording';
  } else {
    mediaRecorder.stop();
    recordBtn.textContent = 'Start Recording';
  }
});

async function sendRecording() {
  const blob = new Blob(chunks, { type: 'audio/webm' });
  const init = await fetch('/v1/ingest/init', { method: 'POST' }).then(r => r.json());
  await fetch(`/v1/ingest/chunk?id=${init.recordingId}`, {
    method: 'POST',
    body: blob
  });
  const res = await fetch(`/v1/ingest/finalize?id=${init.recordingId}`, { method: 'POST' }).then(r => r.json());
  alert(`BLUF: ${res.bluf}`);
}

// timer
let currentTimerId = null;
const timerDisplay = document.getElementById('timerDisplay');
document.getElementById('createTimer').onclick = async () => {
  const title = document.getElementById('timerTitle').value;
  const duration = parseInt(document.getElementById('timerDuration').value, 10);
  const t = await fetch('/v1/timers', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, duration })
  }).then(r => r.json());
  currentTimerId = t.id;
  timerDisplay.textContent = `${t.title}: ${t.duration}s`;
};

document.getElementById('startTimer').onclick = async () => {
  if (!currentTimerId) return;
  await fetch(`/v1/timers/${currentTimerId}/start`, { method: 'POST' });
  tick();
};

document.getElementById('stopTimer').onclick = async () => {
  if (!currentTimerId) return;
  await fetch(`/v1/timers/${currentTimerId}/stop`, { method: 'POST' });
};

async function tick() {
  if (!currentTimerId) return;
  const timers = await fetch('/v1/timers').then(r => r.json());
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
  const t = await fetch('/v1/tally', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ title })
  }).then(r => r.json());
  addTallyToList(t);
};

function addTallyToList(t) {
  const li = document.createElement('li');
  const btn = document.createElement('button');
  btn.textContent = `${t.title}: ${t.value}`;
  btn.onclick = async () => {
    const updated = await fetch(`/v1/tally/${t.id}/inc`, { method: 'POST' }).then(r => r.json());
    btn.textContent = `${updated.title}: ${updated.value}`;
  };
  li.appendChild(btn);
  document.getElementById('tallyList').appendChild(li);
}
