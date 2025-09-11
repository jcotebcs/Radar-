# Radar Notes Deployment Guide

## Prerequisites

- Node.js 16.0.0 or higher
- npm or yarn package manager
- Domain name and SSL certificates (for production HTTPS)

## Installation

1. Clone the repository:
```bash
git clone https://github.com/jcotebcs/Radar-.git
cd Radar-
```

2. Install dependencies:
```bash
npm install
```

3. Set up environment variables:
```bash
cp .env.example .env
# Edit .env file with your configuration
```

## Configuration

### Environment Variables

Copy `.env.example` to `.env` and configure the following:

#### Basic Server Configuration
- `PORT`: HTTP port (default: 3000)
- `NODE_ENV`: Environment (development/production)

#### Google API Keys
Set the API keys for services you want to use:
- `YOUTUBE_DATA_API_V3_KEY`: For YouTube integration
- `GOOGLE_CALENDAR_API_KEY`: For calendar integration
- `CLOUD_SPEECH_TO_TEXT_API_KEY`: For transcription
- etc. (see .env.example for full list)

#### HTTPS/SSL Configuration
For production deployment with HTTPS:
- `HTTPS_PORT`: HTTPS port (default: 443)
- `SSL_KEY_PATH`: Path to SSL private key file
- `SSL_CERT_PATH`: Path to SSL certificate file

#### Data Backup Configuration
- `BACKUP_INTERVAL_HOURS`: How often to create backups (default: 24)
- `BACKUP_RETENTION_DAYS`: How long to keep backups (default: 30)

### SSL Certificate Setup

#### Option 1: Let's Encrypt (Recommended)
```bash
# Install certbot
sudo apt install certbot

# Generate certificate
sudo certbot certonly --standalone -d your-domain.com

# Set environment variables
SSL_KEY_PATH=/etc/letsencrypt/live/your-domain.com/privkey.pem
SSL_CERT_PATH=/etc/letsencrypt/live/your-domain.com/fullchain.pem
```

#### Option 2: Self-signed certificates (Development only)
```bash
# Generate self-signed certificate
openssl req -x509 -newkey rsa:4096 -keyout key.pem -out cert.pem -days 365 -nodes

# Set environment variables
SSL_KEY_PATH=./key.pem
SSL_CERT_PATH=./cert.pem
```

## Running the Application

### Development Mode
```bash
npm run dev
```

### Production Mode
```bash
npm start
```

The application will be available at:
- HTTP: http://localhost:3000
- HTTPS: https://localhost:443 (if SSL is configured)

## PWA Installation

### Android
1. Open the site in Chrome
2. Tap the menu (⋮)
3. Select "Add to Home screen"
4. Follow the prompts

### iOS
1. Open the site in Safari
2. Tap the Share button
3. Select "Add to Home Screen"
4. Follow the prompts

### Desktop
1. Open the site in Chrome/Edge
2. Look for the install icon in the address bar
3. Click to install

## Testing

### Camera and Microphone Permissions
1. Open the application
2. Check the permissions status in the "Permissions" section
3. Click "Request Permissions" if needed
4. Allow camera and microphone access when prompted
5. Verify that device lists populate correctly

### PWA Functionality
1. Install the app using the browser's install prompt
2. Test offline functionality by disconnecting from the internet
3. Verify the app still loads and basic features work
4. Reconnect to sync any offline changes

### API Health Check
Visit `/health` endpoint to verify server status:
```
GET /health
```

Expected response:
```json
{
  "status": "healthy",
  "timestamp": "2024-01-01T00:00:00.000Z",
  "apis": 5
}
```

## Monitoring and Logging

### Log Files
- `logs/error.log`: Error messages only
- `logs/combined.log`: All log messages

### Log Levels
Configure via `LOG_LEVEL` environment variable:
- `error`: Errors only
- `warn`: Warnings and errors
- `info`: Informational messages (default)
- `debug`: Detailed debugging information

### Data Backup
- Automatic backups are created in the `backups/` directory
- Backup frequency controlled by `BACKUP_INTERVAL_HOURS`
- Old backups are automatically cleaned up based on `BACKUP_RETENTION_DAYS`

## Production Deployment

### Using PM2 (Recommended)
```bash
# Install PM2
npm install -g pm2

# Start the application
pm2 start server.js --name radar-notes

# Set up auto-restart on reboot
pm2 startup
pm2 save
```

### Using Docker
```bash
# Build Docker image
docker build -t radar-notes .

# Run container
docker run -p 3000:3000 -p 443:443 \
  -v /path/to/ssl:/ssl \
  -v /path/to/data:/app/data \
  -e SSL_KEY_PATH=/ssl/privkey.pem \
  -e SSL_CERT_PATH=/ssl/fullchain.pem \
  radar-notes
```

### Reverse Proxy (Nginx)
```nginx
server {
    listen 80;
    server_name your-domain.com;
    return 301 https://$server_name$request_uri;
}

server {
    listen 443 ssl;
    server_name your-domain.com;
    
    ssl_certificate /etc/letsencrypt/live/your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;
    
    location / {
        proxy_pass http://localhost:3000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

## Troubleshooting

### Common Issues

1. **Camera/Microphone not working**
   - Ensure HTTPS is enabled (required for getUserMedia API)
   - Check browser permissions
   - Verify device availability

2. **Service Worker not updating**
   - Clear browser cache
   - Check browser developer tools for service worker errors

3. **SSL certificate errors**
   - Verify certificate files exist and are readable
   - Check certificate expiration date
   - Ensure proper file permissions

4. **API not configured**
   - Check environment variables are set correctly
   - Verify API keys are valid
   - Check server logs for configuration errors

### Support
Check the logs directory for detailed error information and consult the GitHub repository issues page for community support.