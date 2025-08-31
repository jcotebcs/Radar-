# Radar Notes

Minimal prototype for the Radar Notes application. It exposes a small Node.js server
(without external dependencies) and a browser client with audio recording, a simple
timer, and tally counters.

## Running

```
node server/server.js
```

Then open `http://localhost:3000` in your browser.

## Features

- Record audio and send to the server; the server responds with a mock BLUF summary.
- Create timers with positive durations; start and stop them safely.
- Create tally counters and adjust them with increment, decrement, reset, or delete.
- Attempting to decrement a tally below zero now returns a 409 error instead of silently clamping.
- Delete timers or tally counters and reload existing ones on page load.
- Recording and API endpoints enforce size limits and return `404` for unknown IDs.
- Optional request logging via `LOG_REQUESTS=1` prints method, path, and status.
- Uncaught server errors now return JSON with HTTP 500 status.
- JSON responses end with a newline for friendlier command-line usage.
- Static file serving resolves paths safely to block directory traversal attempts.

This repository is a starting point for further development such as VOX detection,
LLM integration, calendar publishing, and external API adapters.
