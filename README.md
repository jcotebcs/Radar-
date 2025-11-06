# 📡 Radar Notes

<div align="center">

![Radar Notes](https://img.shields.io/badge/Radar-Notes-blue.svg)
![Node.js](https://img.shields.io/badge/Node.js-18+-green.svg)
![PWA](https://img.shields.io/badge/PWA-Ready-purple.svg)
![License](https://img.shields.io/badge/License-MIT-yellow.svg)

**A modern, voice-activated note-taking and productivity application with Bluetooth-friendly controls.**

*Inspired by M*A*S*H's Radar O'Reilly, this prototype demonstrates hands-free recording, smart tagging, timers, and conversational AI assistance.*

[🚀 Quick Start](#quick-start) • [📱 Features](#features) • [🛠️ Installation](#installation) • [📖 Usage](#usage) • [🤝 Contributing](#contributing)

</div>

---

## ✨ Features

### 🎤 **Voice Recording & Audio**
- **Multi-device audio input** - Select any available audio source including Bluetooth microphones
- **One-touch recording** - Start/stop recording with keyboard shortcuts, mouse clicks, or gamepad buttons
- **Smart tagging system** - Add contextual tags during or after recording sessions
- **Cross-platform compatibility** - Works on desktop, tablet, and mobile devices

### ⏱️ **Productivity Tools**
- **Customizable timers** - Set named timers for Pomodoro, breaks, or task tracking
- **Tally counters** - Quick incremental counting for inventory, events, or metrics
- **Contact management** - View and manage contact information
- **Call logs** - Track incoming and outgoing communication

### 📹 **Camera & Visual**
- **Local camera preview** - Access device cameras and external webcams
- **Remote camera streams** - Load and display IP camera feeds
- **Print functionality** - Generate PDF reports or print to physical devices
- **Responsive UI** - Modern, mobile-friendly interface with dark/light theme support

### 🤖 **AI Assistant**
- **Chat with Radar Oriley** - Conversational AI assistant for task management
- **Voice commands** - Natural language processing for hands-free operation
- **Context awareness** - Intelligent responses based on current activity

### 🔧 **Accessibility & Control**
- **Bluetooth remote support** - Works with Bluetooth keyboards, mice, and gaming controllers
- **Keyboard shortcuts** - Comprehensive hotkey system for power users
- **Voice activation** - Hands-free operation for accessibility
- **Offline capability** - Progressive Web App (PWA) with offline functionality

---

## 🚀 Quick Start

### Prerequisites
- Node.js 18+ installed on your system
- Modern web browser (Chrome, Firefox, Safari, Edge)
- Optional: Bluetooth microphone or headset for best experience

### Installation

1. **Clone the repository**
   ```bash
   git clone https://github.com/jcotebcs/Radar-.git
   cd Radar-
   ```

2. **Start the server**
   ```bash
   node server.js
   ```

3. **Open in browser**
   Navigate to [http://localhost:3000](http://localhost:3000)

4. **Install as PWA** (Optional)
   - On mobile: Use "Add to Home Screen" in your browser menu
   - On desktop: Look for the install prompt in the address bar

---

## 📱 Usage

### 🎵 **Audio Recording**

**Start Recording:**
- Click the 🔴 **Start Recording** button
- Press `Space`, `Enter`, or `R` key
- Left-click anywhere on the page
- Press button 0 on a connected gamepad

**Add Tags:**
- Click 🏷️ **Add Tag** button
- Press `T` or `#` key
- Right-click anywhere on the page
- Press button 1 on a connected gamepad

### ⏲️ **Timer Usage**

1. Enter a descriptive timer name (e.g., "Coffee Break", "Meeting")
2. Set duration in seconds
3. Click ▶️ **Start** to begin countdown
4. Monitor remaining time in real-time
5. Use ⏹️ **Stop** to cancel timer early

### 📊 **Tally Counters**

1. Enter counter name in the text field
2. Click ➕ **Add Counter** to create
3. Use **+** button to increment count
4. Perfect for inventory, attendance, or event tracking

### 💬 **Chat Assistant**

1. Type your message in the chat input
2. Click 📤 **Send** or press `Enter`
3. Radar Oriley will respond with helpful suggestions
4. Chat history is maintained during your session

### 📹 **Camera Features**

**Local Camera:**
1. Select camera from dropdown menu
2. Click 📷 **Start Camera** to preview
3. Use ⏹️ **Stop Camera** to end preview

**Remote Camera:**
1. Enter IP camera URL (e.g., `http://192.168.1.100:8080/stream`)
2. Click 🔗 **Load URL** to connect
3. Stream will display in preview area

---

## ⌨️ Keyboard Shortcuts

| Action | Keys | Alternative |
|--------|------|-------------|
| **Toggle Recording** | `Space`, `Enter`, `R` | `MediaRecord`, `MediaPlayPause` |
| **Add Tag** | `T`, `#` | `MediaTrackNext` |
| **Print Page** | `Ctrl+P` | Click print button |
| **Send Chat** | `Enter` | Click send button |

### 🎮 **Gamepad/Remote Control**
- **Button 0**: Toggle recording
- **Button 1**: Add tag
- **Scroll wheel up**: Start/stop recording
- **Scroll wheel down**: Add tag

---

## 🛠️ Configuration

### 🌐 **Environment Variables**

Set up Google API integration by configuring environment variables:

```bash
# Example Google API configurations
export YOUTUBE_DATA_API_V3_KEY="your_youtube_api_key"
export GOOGLE_CALENDAR_API_KEY="your_calendar_api_key"
export GOOGLE_CLOUD_SPEECH_API_KEY="your_speech_api_key"
```

The server will automatically detect and report configured APIs on startup.

### ⚙️ **Server Configuration**

```bash
# Set custom port (default: 3000)
export PORT=8080

# Set host address (default: localhost)
export HOST=0.0.0.0

# Set environment (affects caching behavior)
export NODE_ENV=production
```

---

## 🔧 API Endpoints

### Timer API
- `GET /api/timer/status` - Get current timer status
- `POST /api/timer/start` - Start new timer
- `POST /api/timer/stop` - Stop active timer

### Tally API
- `GET /api/tally` - List all counters
- `POST /api/tally/create` - Create new counter
- `POST /api/tally/increment` - Increment counter

### Communication API
- `GET /api/contacts` - Get contact list
- `GET /api/call-logs` - Get call history
- `POST /api/chat` - Send message to AI assistant

### System API
- `GET /api/health` - Server health check

---

## 🎨 Customization

### Theme Variables
The application uses CSS custom properties for easy theming:

```css
:root {
  --primary-color: #2563eb;
  --accent-color: #059669;
  --danger-color: #dc2626;
  --background-color: #f8fafc;
  --text-color: #1e293b;
}
```

### 📱 **Mobile Optimization**
- Responsive grid layout adapts to screen size
- Touch-friendly button sizing
- Optimized for portrait and landscape orientations
- PWA features for native app-like experience

---

## 🔐 **Security & Privacy**

- ✅ **No data collection** - All processing happens locally
- ✅ **Secure API endpoints** - Input validation and error handling
- ✅ **CORS protection** - Configurable cross-origin policies
- ✅ **Request size limits** - Protection against abuse
- ✅ **Graceful error handling** - User-friendly error messages

---

## 🚧 **Development**

### Project Structure
```
├── public/                 # Client-side assets
│   ├── index.html         # Main HTML file
│   ├── app.js             # JavaScript application
│   ├── style.css          # Styling and themes
│   ├── manifest.json      # PWA configuration
│   └── sw.js              # Service worker
├── server.js              # Node.js server
├── googleApis.js          # Google API configuration
└── README.md              # This file
```

### 🧪 **Testing**
```bash
# Start development server
node server.js

# Test API endpoints
curl http://localhost:3000/api/health

# Check PWA features
# Open browser dev tools > Application > Service Workers
```

---

## 🗺️ **Roadmap**

### 🎯 **Phase 1: Core Functionality** ✅
- ✅ Voice recording with Bluetooth support
- ✅ Timer and tally counter tools
- ✅ Chat assistant integration
- ✅ Camera preview functionality
- ✅ PWA implementation

### 🎯 **Phase 2: AI Integration** 🚧
- [ ] Speech-to-text transcription
- [ ] LLM-powered note summarization
- [ ] Automatic tag generation
- [ ] Voice command recognition

### 🎯 **Phase 3: Cloud Integration** 🔮
- [ ] Google Drive sync
- [ ] Calendar integration
- [ ] Contact synchronization
- [ ] Cloud backup and restore

### 🎯 **Phase 4: Advanced Features** 🔮
- [ ] Mind map generation
- [ ] Multi-user collaboration
- [ ] Advanced analytics
- [ ] Custom workflow automation

For detailed technical specifications, see [RADAR_NOTES_SPEC.md](RADAR_NOTES_SPEC.md).

---

## 🤝 **Contributing**

We welcome contributions! Please follow these steps:

1. **Fork** the repository
2. **Create** a feature branch (`git checkout -b feature/amazing-feature`)
3. **Commit** your changes (`git commit -m 'Add amazing feature'`)
4. **Push** to the branch (`git push origin feature/amazing-feature`)
5. **Open** a Pull Request

### 🐛 **Bug Reports**
Found a bug? Please create an issue with:
- Clear description of the problem
- Steps to reproduce
- Expected vs actual behavior
- Browser and device information

---

## 📄 **License**

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

---

## 👨‍💻 **Author**

**Radar Notes Team**
- GitHub: [@jcotebcs](https://github.com/jcotebcs)
- Project: [Radar Notes](https://github.com/jcotebcs/Radar-)

---

## 🙏 **Acknowledgments**

- Inspired by the character Radar O'Reilly from M*A*S*H
- Built with modern web technologies and progressive enhancement principles
- Special thanks to the open-source community for tools and inspiration

---

<div align="center">

**Made with ❤️ for productivity enthusiasts and accessibility advocates**

[⬆ Back to Top](#-radar-notes)

</div>
