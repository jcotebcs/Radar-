# Radar Notes - Police Voice Recording System

[![Validation Status](https://img.shields.io/badge/validation-100%25%20passed-brightgreen)](./validation-report.json)
[![Node.js](https://img.shields.io/badge/node.js-14%2B-green)](https://nodejs.org/)
[![PWA Ready](https://img.shields.io/badge/PWA-ready-blue)](./public/manifest.json)

A voice-first note-taking and information-structuring system designed for Police Radar applications. This Progressive Web App (PWA) provides hands-free audio recording, real-time tagging, and structured data capture with Bluetooth device support.

![Radar Notes Interface](https://github.com/user-attachments/assets/07b6da82-2c2f-477d-94a0-2906aa6b4bf9)

## ✨ Features

### 🎙️ Core Recording
- **Voice Activity Detection (VOX)** - Placeholder for automatic speech detection
- **Multi-device Support** - Works with built-in mics, USB mics, and Bluetooth devices
- **Real-time Audio Processing** - Chunked recording with immediate server storage
- **Live Tagging** - Add contextual tags during recording sessions
- **Structured Output** - BLUF summaries, action items, and keyword extraction (placeholders)

### 🎮 Hands-free Controls
- **Keyboard Shortcuts** - Space/Enter/R to record, T/# to tag
- **Bluetooth Remote Support** - Gamepad-style remotes (button 0 = record, 1 = tag)
- **Mouse/Wheel Support** - Click anywhere to toggle recording, scroll to tag
- **Voice Commands** - Placeholder for "Activate Radar," "Add tag," etc.

### 📱 Progressive Web App
- **Offline Capable** - Service worker with asset caching
- **Mobile Installation** - Add to home screen on Android/iOS
- **Responsive Design** - Works on desktop, tablet, and mobile
- **High Contrast Support** - Accessibility-first design

### 🛠️ Utility Features
- **Timer System** - Named timers with start/stop/pause functionality
- **Tally Counters** - Multiple increment/decrement counters
- **Camera Preview** - Local cameras and remote IP camera streams
- **Chat Assistant** - "Radar Oriley" contextual help system
- **Contact Integration** - Stub contact and call log management

## 🚀 Quick Start

### Prerequisites
- Node.js 14+ 
- Modern web browser with WebRTC support
- Microphone access (for recording features)

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/jcotebcs/Radar-.git
   cd Radar-
   ```

2. **Install dependencies**
   ```bash
   npm install  # Creates package.json if missing
   ```

3. **Start the server**
   ```bash
   npm start
   # or
   node server.js
   ```

4. **Open in browser**
   ```
   http://localhost:3000
   ```

5. **Install as PWA** (optional)
   - On Android: Open in Chrome → "Add to Home screen"
   - On iOS: Open in Safari → Share → "Add to Home Screen"

## 🔧 Configuration

### Environment Variables
Configure Google API integrations by setting environment variables:

```bash
# Example API keys (see googleApis.js for full list)
export YOUTUBE_DATA_API_V3_KEY="your-youtube-api-key"
export GOOGLE_CALENDAR_API_KEY="your-calendar-api-key"
export CLOUD_SPEECH_TO_TEXT_API_KEY="your-speech-api-key"
```

The server reports configured APIs on startup:
```
Google APIs configured: YouTube Data API v3, Google Calendar API
```

### Data Storage
- **Local Development**: Data stored in `./data/` directory
- **Recordings**: Saved as JSON files in `./data/recordings/`
- **Persistence**: Tallies and session data auto-saved
- **Cleanup**: No automatic deletion - manual management required

## 📡 API Reference

### Core Endpoints

| Endpoint | Method | Description |
|----------|---------|-------------|
| `/api/health` | GET | Server health and status |
| `/api/recording/start` | POST | Start new recording session |
| `/api/recording/chunk` | POST | Upload audio chunk (Base64) |
| `/api/recording/stop` | POST | Finalize recording |
| `/api/recording/tag` | POST | Add tag to active recording |
| `/api/recordings` | GET | List all recordings |
| `/api/timer/start` | POST | Start named timer |
| `/api/timer/status` | GET | Get timer status |
| `/api/timer/stop` | POST | Stop active timer |
| `/api/tally/create` | POST | Create counter |
| `/api/tally/increment` | POST | Increment/decrement counter |
| `/api/tally` | GET | List all counters |
| `/api/chat` | POST | Chat with Radar Oriley |
| `/api/contacts` | GET | Get contact list |
| `/api/call-logs` | GET | Get call history |

### Future Endpoints (Placeholders)
- `/api/vox/status` - Voice activity detection status
- `/api/transcribe` - Speech-to-text processing
- `/api/summarize` - BLUF summary generation

## 🎯 Usage Guide

### Recording Workflow
1. **Select Microphone** - Choose from available audio inputs
2. **Start Recording** - Click "Start Recording" or press Space
3. **Add Tags** - Click "Add Tag" or press T during recording
4. **Stop Recording** - Click "Stop Recording" or press Space again
5. **Review** - Check `/api/recordings` for session data

### Keyboard Shortcuts
- **Space, Enter, R** - Toggle recording on/off
- **T, #** - Add tag to current recording
- **Ctrl/⌘+K** - Open command palette (planned)

### Bluetooth Integration
1. **Pair Device** - Pair Bluetooth mic/remote with OS first
2. **Select Input** - Choose Bluetooth mic from dropdown
3. **Test Controls** - Use remote buttons (0=record, 1=tag)

## 🧪 Testing & Validation

Run comprehensive validation tests:

```bash
node validate.js
```

This tests:
- ✅ All API endpoints
- ✅ Data persistence
- ✅ Security headers
- ✅ Input validation
- ✅ XSS protection
- ✅ Error handling

View detailed results in `validation-report.json`.

## 🛡️ Security Features

### Implemented Protections
- **Input Sanitization** - XSS protection on all user inputs
- **Request Size Limits** - Prevent DoS attacks
- **Security Headers** - X-Frame-Options, X-XSS-Protection, etc.
- **Path Traversal Protection** - Secure static file serving
- **CORS Configuration** - Controlled cross-origin access

### Privacy Controls
- **Recording Consent** - Clear notice banner on first use
- **Local Storage** - All data stays on device by default
- **No External Calls** - No telemetry or tracking (development mode)

## 🔮 Roadmap & Missing Components

### Core Features (Planned)
- [ ] **VOX Engine** - Automatic voice activity detection
- [ ] **Speech-to-Text** - OpenAI Whisper, Google STT integration
- [ ] **LLM Integration** - ChatGPT/Claude for BLUF summaries
- [ ] **Mind Map Generation** - Mindomo API integration
- [ ] **Calendar Sync** - Google Calendar, Microsoft Graph
- [ ] **File Upload/OCR** - PDF, DOCX, image processing

### Integrations (Planned)
- [ ] **Timesheet.io** - Project time tracking
- [ ] **SMS Gateway** - httpSMS for text messaging
- [ ] **Media Control** - Spotify, YouTube playback
- [ ] **Visual Intelligence** - Imagga, Google Vision
- [ ] **Vehicle Data** - NHTSA vPIC API
- [ ] **Parts Database** - Digi-Key integration

### Infrastructure (Planned)
- [ ] **Database Layer** - PostgreSQL for production
- [ ] **Object Storage** - S3/GCS for audio files
- [ ] **Authentication** - User management and OAuth
- [ ] **Real-time Sync** - WebSocket for live collaboration
- [ ] **Mobile Apps** - React Native for iOS background recording

## 🤝 Contributing

### Development Setup
1. Fork the repository
2. Create feature branch: `git checkout -b feature-name`
3. Make changes with proper error handling
4. Run validation: `node validate.js`
5. Test in multiple browsers
6. Submit pull request

### Code Standards
- **Minimal Changes** - Preserve existing functionality
- **Error Handling** - Comprehensive try/catch blocks
- **Input Validation** - Sanitize all user inputs
- **Accessibility** - ARIA labels and keyboard navigation
- **Comments** - Document fixes and complex logic

## 📄 License

MIT License - see LICENSE file for details.

## 🆘 Support

For issues, questions, or feature requests:
1. Check existing GitHub issues
2. Run `node validate.js` for diagnostics
3. Include browser/OS information
4. Provide console error messages

---

**⚠️ Development Status**: This is a prototype application. Many advanced features (transcription, AI summarization, external integrations) are implemented as placeholders for future development.
