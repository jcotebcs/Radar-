const { google } = require('googleapis');
const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;

class GoogleIntegration {
  constructor() {
    this.oauth2Client = null;
    this.calendar = null;
    this.drive = null;
    this.gmail = null;
    this.setupOAuth();
  }

  setupOAuth() {
    if (!process.env.GOOGLE_CLIENT_ID || !process.env.GOOGLE_CLIENT_SECRET) {
      console.log('Google OAuth not configured - set GOOGLE_CLIENT_ID and GOOGLE_CLIENT_SECRET');
      return;
    }

    this.oauth2Client = new google.auth.OAuth2(
      process.env.GOOGLE_CLIENT_ID,
      process.env.GOOGLE_CLIENT_SECRET,
      process.env.GOOGLE_REDIRECT_URI || 'http://localhost:3000/auth/google/callback'
    );

    // Setup Passport Google Strategy
    passport.use(new GoogleStrategy({
      clientID: process.env.GOOGLE_CLIENT_ID,
      clientSecret: process.env.GOOGLE_CLIENT_SECRET,
      callbackURL: "/auth/google/callback"
    }, async (accessToken, refreshToken, profile, done) => {
      // Store tokens for API access
      this.oauth2Client.setCredentials({
        access_token: accessToken,
        refresh_token: refreshToken
      });
      
      // Initialize Google APIs
      this.calendar = google.calendar({ version: 'v3', auth: this.oauth2Client });
      this.drive = google.drive({ version: 'v3', auth: this.oauth2Client });
      this.gmail = google.gmail({ version: 'v1', auth: this.oauth2Client });

      return done(null, { ...profile, accessToken, refreshToken });
    }));

    passport.serializeUser((user, done) => done(null, user));
    passport.deserializeUser((user, done) => done(null, user));
  }

  getAuthUrl() {
    if (!this.oauth2Client) return null;
    
    const scopes = [
      'https://www.googleapis.com/auth/userinfo.profile',
      'https://www.googleapis.com/auth/calendar',
      'https://www.googleapis.com/auth/drive.file',
      'https://www.googleapis.com/auth/gmail.readonly',
      'https://www.googleapis.com/auth/gmail.send'
    ];

    return this.oauth2Client.generateAuthUrl({
      access_type: 'offline',
      scope: scopes
    });
  }

  // Calendar Integration
  async createCalendarEvent(eventData) {
    if (!this.calendar) throw new Error('Calendar not initialized');
    
    const event = {
      summary: eventData.title,
      description: eventData.description,
      start: {
        dateTime: eventData.startTime,
        timeZone: 'America/Los_Angeles',
      },
      end: {
        dateTime: eventData.endTime,
        timeZone: 'America/Los_Angeles',
      },
      attendees: eventData.attendees || [],
      reminders: {
        useDefault: false,
        overrides: [
          { method: 'email', minutes: 24 * 60 },
          { method: 'popup', minutes: 10 },
        ],
      },
    };

    const result = await this.calendar.events.insert({
      calendarId: 'primary',
      resource: event,
    });

    return result.data;
  }

  async getCalendarEvents(timeMin, timeMax) {
    if (!this.calendar) throw new Error('Calendar not initialized');
    
    const result = await this.calendar.events.list({
      calendarId: 'primary',
      timeMin: timeMin || new Date().toISOString(),
      timeMax: timeMax,
      maxResults: 10,
      singleEvents: true,
      orderBy: 'startTime',
    });

    return result.data.items;
  }

  // Drive Integration
  async createDriveFile(name, content, mimeType = 'text/plain') {
    if (!this.drive) throw new Error('Drive not initialized');

    const fileMetadata = { name };
    const media = {
      mimeType,
      body: content
    };

    const result = await this.drive.files.create({
      resource: fileMetadata,
      media: media,
      fields: 'id,name,webViewLink'
    });

    return result.data;
  }

  async uploadToDrive(name, buffer, mimeType) {
    if (!this.drive) throw new Error('Drive not initialized');

    const fileMetadata = { name };
    const media = {
      mimeType,
      body: buffer
    };

    const result = await this.drive.files.create({
      resource: fileMetadata,
      media: media,
      fields: 'id,name,webViewLink'
    });

    return result.data;
  }

  // Gmail Integration
  async sendEmail(to, subject, body) {
    if (!this.gmail) throw new Error('Gmail not initialized');

    const email = [
      'Content-Type: text/html; charset="UTF-8"',
      'MIME-Version: 1.0',
      `To: ${to}`,
      `Subject: ${subject}`,
      '',
      body
    ].join('\n');

    const encodedEmail = Buffer.from(email).toString('base64')
      .replace(/\+/g, '-')
      .replace(/\//g, '_')
      .replace(/=+$/, '');

    const result = await this.gmail.users.messages.send({
      userId: 'me',
      resource: {
        raw: encodedEmail
      }
    });

    return result.data;
  }

  async getRecentEmails(maxResults = 10) {
    if (!this.gmail) throw new Error('Gmail not initialized');

    const result = await this.gmail.users.messages.list({
      userId: 'me',
      maxResults
    });

    const messages = [];
    for (const message of result.data.messages || []) {
      const msg = await this.gmail.users.messages.get({
        userId: 'me',
        id: message.id
      });
      messages.push(msg.data);
    }

    return messages;
  }
}

module.exports = GoogleIntegration;