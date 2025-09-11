const fs = require('fs');
const path = require('path');

class DataStore {
  constructor() {
    this.dataPath = path.join(__dirname, 'data');
    this.dbPath = path.join(this.dataPath, 'db.json');
    this.ensureDirectories();
    this.loadDatabase();
  }

  ensureDirectories() {
    const dirs = [
      this.dataPath,
      path.join(this.dataPath, 'recordings'),
      path.join(this.dataPath, 'transcripts')
    ];
    dirs.forEach(dir => {
      if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
      }
    });
  }

  loadDatabase() {
    if (fs.existsSync(this.dbPath)) {
      try {
        const data = fs.readFileSync(this.dbPath, 'utf8');
        this.db = JSON.parse(data);
      } catch (err) {
        console.error('Error loading database:', err);
        this.initializeDatabase();
      }
    } else {
      this.initializeDatabase();
    }
  }

  initializeDatabase() {
    this.db = {
      recordings: [],
      notes: [],
      tasks: [],
      events: [],
      tags: [],
      contacts: [
        { id: 1, name: 'Alice', phone: '+15551234567' },
        { id: 2, name: 'Bob', phone: '+15557654321' }
      ],
      callLogs: [
        { id: 1, contact: 'Alice', type: 'incoming', time: Date.now() - 600000, duration: 120 },
        { id: 2, contact: 'Bob', type: 'outgoing', time: Date.now() - 3600000, duration: 240 }
      ]
    };
    this.saveDatabase();
  }

  saveDatabase() {
    try {
      fs.writeFileSync(this.dbPath, JSON.stringify(this.db, null, 2));
    } catch (err) {
      console.error('Error saving database:', err);
    }
  }

  // Recording methods
  createRecording(recordingData) {
    const recording = {
      id: this.generateId(),
      ...recordingData,
      createdAt: new Date().toISOString()
    };
    this.db.recordings.push(recording);
    this.saveDatabase();
    return recording;
  }

  getRecording(id) {
    return this.db.recordings.find(r => r.id === id);
  }

  getAllRecordings() {
    return this.db.recordings;
  }

  updateRecording(id, updates) {
    const index = this.db.recordings.findIndex(r => r.id === id);
    if (index !== -1) {
      this.db.recordings[index] = { ...this.db.recordings[index], ...updates };
      this.saveDatabase();
      return this.db.recordings[index];
    }
    return null;
  }

  // Note methods
  createNote(noteData) {
    const note = {
      id: this.generateId(),
      ...noteData,
      createdAt: new Date().toISOString()
    };
    this.db.notes.push(note);
    this.saveDatabase();
    return note;
  }

  getNote(id) {
    return this.db.notes.find(n => n.id === id);
  }

  getAllNotes() {
    return this.db.notes;
  }

  // Task methods
  createTask(taskData) {
    const task = {
      id: this.generateId(),
      ...taskData,
      completed: false,
      createdAt: new Date().toISOString()
    };
    this.db.tasks.push(task);
    this.saveDatabase();
    return task;
  }

  getAllTasks() {
    return this.db.tasks;
  }

  updateTask(id, updates) {
    const index = this.db.tasks.findIndex(t => t.id === id);
    if (index !== -1) {
      this.db.tasks[index] = { ...this.db.tasks[index], ...updates };
      this.saveDatabase();
      return this.db.tasks[index];
    }
    return null;
  }

  // Event methods
  createEvent(eventData) {
    const event = {
      id: this.generateId(),
      ...eventData,
      createdAt: new Date().toISOString()
    };
    this.db.events.push(event);
    this.saveDatabase();
    return event;
  }

  getAllEvents() {
    return this.db.events;
  }

  // Contacts and call logs
  getContacts() {
    return this.db.contacts;
  }

  getCallLogs() {
    return this.db.callLogs;
  }

  // Utility methods
  generateId() {
    return Date.now().toString(36) + Math.random().toString(36).substr(2);
  }

  getRecordingFilePath(recordingId) {
    return path.join(this.dataPath, 'recordings', `${recordingId}.webm`);
  }

  getTranscriptFilePath(recordingId) {
    return path.join(this.dataPath, 'transcripts', `${recordingId}.json`);
  }
}

module.exports = DataStore;