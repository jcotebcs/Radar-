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

## Google API placeholders

The server can surface configuration for a wide range of Google APIs. Set environment variables named after each API in uppercase
snake case with a `_KEY` suffix (for example `YOUTUBE_DATA_API_V3_KEY`, `GOOGLE_CALENDAR_API_KEY`).
When `server.js` starts it reports which of these keys are present to help with future integration work.

## Run

```
node server.js
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
