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
- Create, start, and stop a single timer.
- Create tally counters and increment them.

This repository is a starting point for further development such as VOX detection,
LLM integration, calendar publishing, and external API adapters.
