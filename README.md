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
- Create tally counters and adjust them with increment, decrement, or reset.

This repository is a starting point for further development such as VOX detection,
LLM integration, calendar publishing, and external API adapters.
