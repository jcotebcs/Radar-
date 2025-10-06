require('dotenv').config();
const express = require('express');
const session = require('express-session');
const passport = require('passport');
const fs = require('fs');
const path = require('path');
const { apiKeys } = require('./googleApis');

// Import integrations
const GoogleIntegration = require('./integrations/google');
const NotionIntegration = require('./integrations/notion');
const SquareIntegration = require('./integrations/square');
const ExportUtilities = require('./integrations/export');

// Initialize integrations
const googleIntegration = new GoogleIntegration();
const notionIntegration = new NotionIntegration();
const squareIntegration = new SquareIntegration();
const exportUtils = new ExportUtilities();

const app = express();

// Configure session and passport
app.use(session({
  secret: process.env.SESSION_SECRET || 'radar-notes-secret',
  resave: false,
  saveUninitialized: false
}));

app.use(passport.initialize());
app.use(passport.session());
app.use(express.json());
app.use(express.static('public'));

let currentTimer = null;
const tallies = {};
const contacts = [
  { id: 1, name: 'Alice', phone: '+15551234567' },
  { id: 2, name: 'Bob', phone: '+15557654321' }
];
const callLogs = [
  { id: 1, contact: 'Alice', type: 'incoming', time: Date.now() - 600000, duration: 120 },
  { id: 2, contact: 'Bob', type: 'outgoing', time: Date.now() - 3600000, duration: 240 }
];

const configuredApis = Object.keys(apiKeys).filter(k => apiKeys[k]);
console.log('Google APIs configured:', configuredApis.join(', ') || 'none');

function json(res, status, obj) {
  res.status(status).json(obj);
}

// Google OAuth routes
app.get('/auth/google', passport.authenticate('google', { 
  scope: ['profile', 'email'] 
}));

app.get('/auth/google/callback', 
  passport.authenticate('google', { failureRedirect: '/' }),
  (req, res) => {
    res.redirect('/?auth=success');
  }
);

app.get('/auth/logout', (req, res) => {
  req.logout((err) => {
    if (err) return res.status(500).json({ error: 'Logout failed' });
    res.redirect('/');
  });
});

app.get('/auth/status', (req, res) => {
  res.json({ 
    authenticated: !!req.user,
    user: req.user ? { 
      name: req.user.displayName, 
      email: req.user.emails?.[0]?.value 
    } : null 
  });
});

// Google Workspace integrations
app.post('/api/google/calendar/event', async (req, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
    
    const event = await googleIntegration.createCalendarEvent(req.body);
    json(res, 200, { success: true, event });
  } catch (error) {
    json(res, 500, { error: error.message });
  }
});

app.get('/api/google/calendar/events', async (req, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
    
    const events = await googleIntegration.getCalendarEvents(req.query.timeMin, req.query.timeMax);
    json(res, 200, { events });
  } catch (error) {
    json(res, 500, { error: error.message });
  }
});

app.post('/api/google/drive/upload', async (req, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
    
    const file = await googleIntegration.createDriveFile(
      req.body.name, 
      req.body.content, 
      req.body.mimeType
    );
    json(res, 200, { success: true, file });
  } catch (error) {
    json(res, 500, { error: error.message });
  }
});

app.post('/api/google/gmail/send', async (req, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
    
    const result = await googleIntegration.sendEmail(
      req.body.to, 
      req.body.subject, 
      req.body.body
    );
    json(res, 200, { success: true, result });
  } catch (error) {
    json(res, 500, { error: error.message });
  }
});

app.get('/api/google/gmail/messages', async (req, res) => {
  try {
    if (!req.user) return res.status(401).json({ error: 'Not authenticated' });
    
    const messages = await googleIntegration.getRecentEmails(req.query.maxResults);
    json(res, 200, { messages });
  } catch (error) {
    json(res, 500, { error: error.message });
  }
});

// Notion integrations
app.post('/api/notion/page', async (req, res) => {
  try {
    const page = await notionIntegration.createPage(req.body.databaseId, req.body.pageData);
    json(res, 200, { success: true, page });
  } catch (error) {
    json(res, 500, { error: error.message });
  }
});

app.get('/api/notion/databases', async (req, res) => {
  try {
    const databases = await notionIntegration.getDatabases();
    json(res, 200, { databases });
  } catch (error) {
    json(res, 500, { error: error.message });
  }
});

app.post('/api/notion/search', async (req, res) => {
  try {
    const results = await notionIntegration.searchPages(req.body.query);
    json(res, 200, { results });
  } catch (error) {
    json(res, 500, { error: error.message });
  }
});

// Square integrations
app.post('/api/square/payment', async (req, res) => {
  try {
    const payment = await squareIntegration.createPayment(
      req.body.amount,
      req.body.currency,
      req.body.source
    );
    json(res, 200, { success: true, payment });
  } catch (error) {
    json(res, 500, { error: error.message });
  }
});

app.post('/api/square/checkout', async (req, res) => {
  try {
    const checkout = await squareIntegration.createCheckout(req.body);
    json(res, 200, { success: true, checkout });
  } catch (error) {
    json(res, 500, { error: error.message });
  }
});

app.post('/api/square/customer', async (req, res) => {
  try {
    const customer = await squareIntegration.createCustomer(
      req.body.email,
      req.body.firstName,
      req.body.lastName
    );
    json(res, 200, { success: true, customer });
  } catch (error) {
    json(res, 500, { error: error.message });
  }
});

app.get('/api/square/payments', async (req, res) => {
  try {
    const payments = await squareIntegration.getPayments(req.query.beginTime, req.query.endTime);
    json(res, 200, { payments });
  } catch (error) {
    json(res, 500, { error: error.message });
  }
});

// Export endpoints
app.post('/api/export/json', async (req, res) => {
  try {
    const filename = req.body.filename || `radar-export-${Date.now()}`;
    const filePath = await exportUtils.exportToJSON(req.body.data, filename);
    json(res, 200, { success: true, filePath, filename: `${filename}.json` });
  } catch (error) {
    json(res, 500, { error: error.message });
  }
});

app.post('/api/export/csv', async (req, res) => {
  try {
    const filename = req.body.filename || `radar-export-${Date.now()}`;
    const filePath = await exportUtils.exportToCSV(req.body.data, filename);
    json(res, 200, { success: true, filePath, filename: `${filename}.csv` });
  } catch (error) {
    json(res, 500, { error: error.message });
  }
});

app.post('/api/export/markdown', async (req, res) => {
  try {
    const filename = req.body.filename || `radar-export-${Date.now()}`;
    const filePath = await exportUtils.exportToMarkdown(req.body.data, filename);
    json(res, 200, { success: true, filePath, filename: `${filename}.md` });
  } catch (error) {
    json(res, 500, { error: error.message });
  }
});

app.post('/api/export/ics', async (req, res) => {
  try {
    const filename = req.body.filename || `radar-events-${Date.now()}`;
    const filePath = await exportUtils.exportToICS(req.body.events, filename);
    json(res, 200, { success: true, filePath, filename: `${filename}.ics` });
  } catch (error) {
    json(res, 500, { error: error.message });
  }
});

app.post('/api/export/notion', async (req, res) => {
  try {
    const formatted = notionIntegration.formatForExport(req.body.data);
    json(res, 200, { success: true, formatted });
  } catch (error) {
    json(res, 500, { error: error.message });
  }
});

// Download export files
app.get('/api/export/download/:filename', (req, res) => {
  try {
    const filePath = path.join(__dirname, 'exports', req.params.filename);
    if (fs.existsSync(filePath)) {
      res.download(filePath);
    } else {
      res.status(404).json({ error: 'File not found' });
    }
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
});

// Existing API endpoints
app.post('/api/timer/start', (req, res) => {
  const seconds = Number(req.body.seconds) || 0;
  currentTimer = {
    title: req.body.title || 'Timer',
    end: Date.now() + seconds * 1000
  };
  json(res, 200, { status: 'started' });
});

app.post('/api/timer/stop', (req, res) => {
  currentTimer = null;
  json(res, 200, { status: 'stopped' });
});

app.get('/api/timer/status', (req, res) => {
  if (currentTimer) {
    const remaining = Math.max(0, currentTimer.end - Date.now());
    if (remaining === 0) currentTimer = null;
    json(res, 200, { running: true, title: currentTimer.title, remaining });
  } else {
    json(res, 200, { running: false });
  }
});

app.get('/api/tally', (req, res) => {
  json(res, 200, tallies);
});

app.post('/api/tally/create', (req, res) => {
  const name = (req.body.name || '').trim();
  if (name && !tallies[name]) tallies[name] = 0;
  json(res, 200, tallies);
});

app.post('/api/tally/increment', (req, res) => {
  const name = (req.body.name || '').trim();
  if (!tallies[name]) tallies[name] = 0;
  tallies[name] += 1;
  json(res, 200, { name, count: tallies[name] });
});

app.post('/api/chat', (req, res) => {
  const msg = (req.body.message || '').toString();
  const reply = `Radar Oriley: I hear you say, "${msg}". Consider it done!`;
  json(res, 200, { reply });
});

app.get('/api/contacts', (req, res) => {
  json(res, 200, contacts);
});

app.get('/api/call-logs', (req, res) => {
  json(res, 200, callLogs);
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`Server listening on http://localhost:${port}`);
});
