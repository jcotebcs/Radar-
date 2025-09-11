# Radar Notes Prototype

This prototype demonstrates a simple Radar Notes client and server with basic Bluetooth-friendly controls.

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

## Production Deployment

This repository includes comprehensive production deployment infrastructure with:

- **Web Server Configuration**: Optimized nginx and Apache configurations with HTTPS support
- **Build Pipeline**: Automated asset optimization (minification, compression)
- **Environment Management**: Comprehensive environment variable configuration
- **Monitoring**: Prometheus, Grafana, and Loki integration for observability
- **Backup Strategies**: Automated backup with retention policies
- **Load Balancing**: Multi-instance support with health checks
- **Containerization**: Docker and Docker Compose configurations

### Quick Start (Development)

```bash
# Install dependencies
npm install

# Start development server
npm run dev
```

Then open [http://localhost:3000](http://localhost:3000) in any modern browser.

### Production Deployment

#### Option 1: Traditional Deployment

```bash
# 1. Build the application
npm run build

# 2. Configure environment
cp .env.example .env
# Edit .env with your configuration

# 3. Deploy with script
sudo ./scripts/deploy.sh
```

#### Option 2: Docker Deployment

```bash
# Single container
npm run docker:build
npm run docker:run

# Full stack with nginx, Redis, monitoring
docker-compose up -d
```

#### Option 3: Docker with Monitoring

```bash
# Deploy with full monitoring stack
docker-compose --profile monitoring up -d
```

### Web Server Configuration

#### Nginx Configuration

1. Copy `nginx.conf` to your nginx configuration directory
2. Update domain names and SSL certificate paths
3. Reload nginx: `sudo systemctl reload nginx`

#### Apache Configuration

1. Copy `apache.conf` to your Apache sites directory
2. Enable required modules and site
3. Restart Apache: `sudo systemctl restart apache2`

### SSL/HTTPS Setup

The application requires HTTPS for full PWA functionality. You can:

1. **Use Let's Encrypt** (recommended):
   ```bash
   sudo certbot --nginx -d your-domain.com
   ```

2. **Use existing certificates**:
   - Update SSL paths in nginx.conf or apache.conf
   - Set HTTPS_ENABLED=true in .env

3. **For development**: Use self-signed certificates or tools like mkcert

### Environment Configuration

Key environment variables (see `.env.example` for full list):

```bash
# Server
NODE_ENV=production
PORT=3000
HTTPS_ENABLED=true
SSL_CERT_PATH=/path/to/cert.pem
SSL_KEY_PATH=/path/to/private.key

# Monitoring
LOG_LEVEL=info
HEALTH_CHECK_ENABLED=true

# Performance
COMPRESSION_ENABLED=true
CACHE_MAX_AGE=31536000
```

### Monitoring and Health Checks

- **Health Check**: `GET /health` - Returns application status and metrics
- **Logs**: Structured JSON logs with Winston (configurable levels)
- **Prometheus**: Metrics collection (port 9090)
- **Grafana**: Monitoring dashboards (port 3001)
- **Loki**: Log aggregation (port 3100)

### Backup Strategy

Automated backups with the included backup script:

```bash
# Manual backup
./scripts/backup.sh

# Automatic backups (configured in docker-compose.yml)
# - Daily backups by default
# - 30-day retention
# - Backup verification
# - Notification support (webhook)
```

### Load Balancing

For high availability, deploy multiple instances:

1. **Nginx upstream configuration** (included in nginx.conf)
2. **Docker Compose scaling**:
   ```bash
   docker-compose up -d --scale radar-notes=3
   ```
3. **Health checks** ensure traffic only goes to healthy instances

### Performance Optimization

The build pipeline includes:

- **JavaScript minification** with Terser
- **CSS optimization** with cssnano
- **HTML minification** with html-minifier-terser
- **Service Worker** with advanced caching strategies
- **Compression** (gzip/brotli support)
- **CDN-ready** with proper cache headers

### Security Features

- **HTTPS enforcement** with HSTS headers
- **Content Security Policy** optimized for PWA
- **Security headers** (X-Frame-Options, X-Content-Type-Options, etc.)
- **Rate limiting** configuration (nginx/Apache)
- **Container security** with non-root user

## Google API placeholders

The server can surface configuration for a wide range of Google APIs. Set environment variables named after each API in uppercase
snake case with a `_KEY` suffix (for example `YOUTUBE_DATA_API_V3_KEY`, `GOOGLE_CALENDAR_API_KEY`).
When `server.js` starts it reports which of these keys are present to help with future integration work.

## Run

### Development
```bash
node server.js
```

### Production
```bash
NODE_ENV=production node server.js
```

Then open [http://localhost:3000](http://localhost:3000) in any modern browser.

### Web access

The client is a Progressive Web App (PWA) and runs directly in the browser. Pair your Bluetooth microphone and input devices with the OS before launching the app.

### Android installation

On Android, open the site in Chrome and use **Add to Home screen** to install it like a native application. The service worker provides basic offline caching so the app launches even without a network connection.

To use the camera preview, select a camera from the list and press **Start Camera**. Remote IP cameras can be loaded by entering their stream URL.

Use the **Print** button to open the browser print dialog, which can target physical printers or save as PDF.

Use the chat section to send a message to Radar Oriley and receive a playful response.

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
