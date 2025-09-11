# Radar Notes Prototype

This prototype demonstrates a simple Radar Notes client and server with basic Bluetooth-friendly controls and extensive integrations with Google services, Notion, Square, and export/share functionality.

## Features

- Select any available audio input, including Bluetooth microphones.
- Start/stop recording and add tags using:
  - On-screen buttons
  - Bluetooth keyboard shortcuts
  - Mouse/remote/shutter button clicks or wheel events
  - Gamepad-style Bluetooth remotes (buttons 0 = record, 1 = tag)
- Tags are displayed beneath the controls.
- Print the page to a connected printer or PDF.
- Preview video from the device camera, attached webcams, or remote camera URLs.
- Simple timer with start/stop controls and remaining time display.
- Multiple tally counters for quick incremental tracking.
- View stub contact and call log data that will later link to device phone records.
- Chat with **Radar Oriley**, a lighthearted assistant inspired by M*A*S*H's Radar O'Reilly.

## New Integration Features

### Google Services Integration
- **Google OAuth2 SSO**: Secure authentication with Google accounts
- **Google Calendar**: Create events, view upcoming events
- **Google Drive**: Upload files and notes directly to Drive
- **Gmail**: Send emails and view recent messages
- **Google Workspace**: Full integration with Google's productivity suite

### Notion Integration
- **Create Pages**: Automatically create Notion pages with voice note content
- **Search**: Search existing Notion content
- **Database Integration**: Connect to specific Notion databases
- **Export Compatibility**: Export notes in Notion-compatible formats

### Square Integration
- **Payment Processing**: Handle payments for premium features
- **Customer Management**: Create and manage customer records
- **Invoicing**: Generate and send professional invoices
- **Transaction Analytics**: View payment history and analytics

### Export & Share Features
- **Multiple Formats**: Export notes as JSON, CSV, Markdown, iCalendar (ICS)
- **Share Links**: Generate shareable links for notes
- **Google Takeout Compatibility**: Export in Google Takeout format
- **Microsoft 365 Compatibility**: Export for Microsoft services
- **OPML Support**: Export outlines and mind maps

## Setup Instructions

### 1. Install Dependencies
```bash
npm install
```

### 2. Configure Environment Variables
Copy the example environment file and fill in your API credentials:
```bash
cp .env.example .env
```

Edit `.env` with your API keys:
- **Google OAuth**: Get credentials from [Google Cloud Console](https://console.cloud.google.com/)
- **Notion API**: Get your integration token from [Notion Developers](https://developers.notion.com/)
- **Square API**: Get credentials from [Square Developer Dashboard](https://developer.squareup.com/)

### 3. Google OAuth Setup
1. Go to [Google Cloud Console](https://console.cloud.google.com/)
2. Create a new project or select existing one
3. Enable the following APIs:
   - Google Calendar API
   - Google Drive API
   - Gmail API
   - Google+ API
4. Create OAuth 2.0 credentials
5. Add `http://localhost:3000/auth/google/callback` to authorized redirect URIs
6. Copy Client ID and Client Secret to your `.env` file

### 4. Notion Setup
1. Go to [Notion Developers](https://developers.notion.com/)
2. Create a new integration
3. Copy the Internal Integration Token to your `.env` file
4. Share your Notion databases with the integration

### 5. Square Setup (Optional)
1. Go to [Square Developer Dashboard](https://developer.squareup.com/)
2. Create a new application
3. Get your Access Token and Application ID
4. For testing, use sandbox credentials

## Run

```
npm start
```

Then open [http://localhost:3000](http://localhost:3000) in any modern browser.

### Web access

The client is a Progressive Web App (PWA) and runs directly in the browser. Pair your Bluetooth microphone and input devices with the OS before launching the app.

### Android installation

On Android, open the site in Chrome and use **Add to Home screen** to install it like a native application. The service worker provides basic offline caching so the app launches even without a network connection.

To use the camera preview, select a camera from the list and press **Start Camera**. Remote IP cameras can be loaded by entering their stream URL.

Use the **Print** button to open the browser print dialog, which can target physical printers or save as PDF.

Use the chat section to send a message to Radar Oriley and receive a playful response.

## Integration Usage

### Google Services
1. Click "Connect Google Account" to authenticate
2. Once connected, you can:
   - Create calendar events from voice notes
   - Upload recordings to Google Drive
   - Send email summaries via Gmail
   - View your calendar events

### Notion
1. Enter your Notion Database ID in the input field
2. Click "Create Notion Page" to save voice notes to Notion
3. Use "Search Notion" to find existing content

### Square (Payments)
1. Configure Square credentials in environment variables
2. Use payment features for premium functionality
3. View transaction history and analytics

### Export & Share
- Click any export button to download notes in various formats
- Use "Generate Share Link" to create shareable URLs
- Export calendar events as ICS files for import into other calendar apps

## Google API placeholders

The server can surface configuration for a wide range of Google APIs. Set environment variables named after each API in uppercase
snake case with a `_KEY` suffix (for example `YOUTUBE_DATA_API_V3_KEY`, `GOOGLE_CALENDAR_API_KEY`).
When `server.js` starts it reports which of these keys are present to help with future integration work.

## Keyboard/Remote Shortcuts

- **Record toggle:** Space, Enter, `R`, `MediaRecord`, or `MediaPlayPause`
- **Add tag:** `T`, `#`, or `MediaTrackNext`
- **Mouse/Remote:** Left click anywhere on the page toggles record; right/middle click adds a tag.
- **Scroll wheel:** scroll up to start/stop, scroll down to tag.

Gamepad/scrolling remotes are polled continuously; button 0 toggles record and button 1 adds a tag.

## Bluetooth Notes

Bluetooth microphones appear as normal audio inputs after pairing with the OS. The device selector lists all available `audioinput` devices.

Keyboards, mice, shutter buttons and scrolling remotes typically send standard keyboard, pointer, or gamepad events; the app listens for these to provide hands‑free control.

## Project Roadmap

A comprehensive outline of planned features and integrations is available in [RADAR_NOTES_SPEC.md](RADAR_NOTES_SPEC.md).

## API Documentation

### Integration Endpoints

#### Google Services
- `GET /auth/google` - Initiate Google OAuth
- `GET /auth/google/callback` - OAuth callback
- `POST /api/google/calendar/event` - Create calendar event
- `GET /api/google/calendar/events` - Get upcoming events
- `POST /api/google/drive/upload` - Upload file to Drive
- `POST /api/google/gmail/send` - Send email
- `GET /api/google/gmail/messages` - Get recent emails

#### Notion
- `POST /api/notion/page` - Create Notion page
- `GET /api/notion/databases` - List databases
- `POST /api/notion/search` - Search Notion

#### Square
- `POST /api/square/payment` - Process payment
- `POST /api/square/checkout` - Create checkout
- `POST /api/square/customer` - Create customer
- `GET /api/square/payments` - Get payment history

#### Export
- `POST /api/export/json` - Export as JSON
- `POST /api/export/csv` - Export as CSV
- `POST /api/export/markdown` - Export as Markdown
- `POST /api/export/ics` - Export calendar as ICS
- `GET /api/export/download/:filename` - Download export file

## Security & Privacy

- All API credentials are stored as environment variables
- Google OAuth2 provides secure authentication
- Session management with secure cookies
- No sensitive data is logged or stored in plain text
- Export files are temporarily stored and automatically cleaned up

## Development

### Adding New Integrations

1. Create a new integration file in `/integrations/`
2. Add API endpoints in `server.js`
3. Add UI controls in `public/index.html`
4. Add JavaScript functions in `public/app.js`
5. Add styling in `public/style.css`
6. Update environment variables in `.env.example`

### Testing

The application includes basic error handling and user feedback. Test each integration by:
1. Configuring the required API credentials
2. Testing authentication flows
3. Verifying data export/import functionality
4. Checking error handling for invalid inputs
