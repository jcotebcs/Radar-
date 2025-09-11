# Deployment Guide

## Environment Variables

The following environment variables can be configured for production deployment:

### Required
- `PORT` - Port number for the server (default: 3000)
- `NODE_ENV` - Environment (development, production)

### Optional Google API Keys
Set any of these environment variables to enable Google API integrations:
- `YOUTUBE_DATA_API_V3_KEY`
- `GOOGLE_CALENDAR_API_KEY`
- `GOOGLE_CLOUD_STORAGE_JSON_API_KEY`
- `GOOGLE_MAPS_JAVASCRIPT_API_KEY`
- `CLOUD_SPEECH_TO_TEXT_API_KEY`
- `CLOUD_TRANSLATION_API_KEY`
- And many more (see googleApis.js for full list)

## Docker Deployment

Build and run with Docker:

```bash
docker build -t radar-notes .
docker run -p 8080:8080 -e NODE_ENV=production radar-notes
```

## Cloud Run Deployment

The application is configured for Google Cloud Run deployment with:
- PORT=8080 (set in Dockerfile)
- Health check endpoint at `/health`
- Graceful shutdown handling
- Request logging

## Health Check

The application provides a health check endpoint at `/health` that returns:
```json
{
  "status": "healthy",
  "timestamp": "2023-XX-XXTXX:XX:XX.XXXZ",
  "uptime": 123.456,
  "version": "1.0.0"
}
```

## Features

- Progressive Web App (PWA) support
- Offline caching via service worker
- CORS enabled for cross-origin requests
- Security headers and directory traversal protection
- Error handling and logging
- Static file serving with proper MIME types
- Timer and tally counter APIs
- Contact and call log APIs
- Chat API with Radar Oriley assistant

## API Endpoints

- `GET /health` - Health check
- `POST /api/timer/start` - Start timer
- `POST /api/timer/stop` - Stop timer
- `GET /api/timer/status` - Get timer status
- `GET /api/tally` - List tally counters
- `POST /api/tally/create` - Create tally counter
- `POST /api/tally/increment` - Increment tally counter
- `POST /api/chat` - Chat with Radar Oriley
- `GET /api/contacts` - Get contacts
- `GET /api/call-logs` - Get call logs