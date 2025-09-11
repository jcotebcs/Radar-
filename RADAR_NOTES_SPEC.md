# radar Application Outline

## 1 Project overview & purpose

* **Goal:** Build a cross‑platform, voice‑first note‑taking and information‑structuring system that helps users (especially those with ADHD/learning differences) capture spoken information effortlessly and turn it into structured, actionable knowledge.
* **Core principles:**
  – **Accessibility:** large controls, live captions, minimal UI clutter; works on desktop and mobile.
  – **Hands‑free capture:** continuous voice monitoring (Radar) triggered by speech onset/offset; optional wake‑words and voice markers.
  – **Structured output:** BLUF summaries, tasks, events, glossaries, keywords, mind maps and appendices linked back to evidence.
  – **Consent & privacy:** explicit recording indication, user‑controlled retention, opt‑in location tagging, encryption of stored data.
* **Platforms:** Progressive Web App (PWA) for desktop and Android (installable via Add to Home screen) plus a native wrapper (React Native/Capacitor) for iOS to allow background recording. A dedicated Android package can also be generated from the PWA for store distribution.
* **Tech stack:** Node.js backend, Postgres or similar for metadata, object storage (S3/GCS) for media, front‑end in React/TypeScript.

## 2 Core components & system capabilities

### 2.1 Radar (VOX) engine

* Monitors the selected microphone (system mic or paired Bluetooth mic e.g. Razer Seiren BT) and detects voice activity using adaptive thresholding and hang‑time.
* Supports voice markers (e.g. "Action item," "Decision," "Reminder Tuesday 3 PM") that immediately generate structured entities.
* Provides a safety pre‑roll buffer (~300 ms) to avoid clipping initial phonemes.
* Emits segments `{start, end, avgRMS, fileOffset}`, which feed into transcription.

### 2.2 Echolalia mode

* Continuous logging mode for brainstorming or free‑form thought ("EchoCache").
* Chunks audio by silence and tags each chunk with timestamps and geolocation (if enabled).
* Periodically summarises the stream (BLUF), extracts actions and keywords, and builds a running glossary.

### 2.3 Universal file intake

* Accepts uploads of PDFs, DOCX files, images and videos.
* Uses OCR (default via OCR.space; alternate providers via Tesseract or cloud OCR) to extract text from images and video keyframes.
* Maintains bidirectional provenance: each extracted fact or task links back to transcript spans or document coordinates.

### 2.4 AI & summarization

* **Speech transcription:** pluggable STT back‑ends (OpenAI Whisper, Google STT) perform diarised transcription.
* **LLM summarization:** prompts ChatGPT, Claude or NoteX to produce structured JSON (BLUF, actions, events, glossary, keywords, medications).
* **Mind map extraction:** optional conversion to mind map via Mindomo API or local rendering into OPML, Mermaid or FreeMind `.mm`.

### 2.5 Calendar & reminders

* Generates calendar events with structured metadata; pushes to Google Calendar or Microsoft Graph via OAuth2, or exports `.ics` files for Apple Calendar.
* Creates reminders and to‑dos with due dates; optionally publishes to Google Tasks or Microsoft To Do (future work).

## 3 API surface

| Endpoint               | Method  | Description                                                                                                                                    |
| ---------------------- | ------- | ---------------------------------------------------------------------------------------------------------------------------------------------- |
| `/v1/ingest/init`      | POST    | Allocates a recording ID and (optionally) returns a signed upload URL.                                                                         |
| `/v1/ingest/chunk`     | POST    | Accepts Base64/Opus audio chunks tied to a recording ID.                                                                                       |
| `/v1/ingest/finalize`  | POST    | Finalizes the recording, triggers STT/OCR/LLM pipelines and returns structured output (BLUF, transcript, actions, events, glossary, keywords). |
| `/v1/notes/:id`        | GET     | Retrieves a structured note with evidence links.                                                                                               |
| `/v1/calendar/publish` | POST    | Publishes events/tasks to linked calendars or returns `.ics`.                                                                                  |
| `/v1/files`            | POST    | Parses an uploaded document and returns extracted text plus entity metadata.                                                                   |
| **Timers & alarms**    | Various | POST `/v1/timers` to create, PUT `/v1/timers/:id/start`/`stop`, GET `/v1/timers/:id` for remaining time; POST `/v1/alarms` to schedule alarms with RRULEs. |
| **Tally counters**     | Various | POST `/v1/tally` to create, PUT `/v1/tally/:id/inc` to increment, GET `/v1/tally` to list counters.                                            |
| `/v1/mindmaps`         | POST    | Creates mind maps from recordings/notes/files; supports export in JSON, OPML, Mermaid, `.mm`, `.xmind`.                                        |
| `/v1/integrations/*`   | Various | Endpoints for connecting external services (Timesheet, SMS, Mindomo, Digi‑Key).                                                                |

## 4 Data models

* **recording:** `{id, userId, startedAt, endedAt, deviceId, location {lat, lng}, consentFlags, storageUri}`
* **segment:** `{id, recordingId, t0, t1, avgRms, transcriptText, speaker}`
* **note:** `{id, recordingId, title, bluf, summaryMd, keywords[], glossary[], sourceRefs[]}`
* **task:** `{id, noteId, text, dueAt, assignee, priority, srcSpan {t0, t1}}`
* **event:** `{id, noteId, title, startAt, endAt, location, attendees[], srcSpan}`
* **file:** `{id, mime, uri, sha256, ocrText, tags[]}`
* **mindmap:** `{id, noteId, provider, title, version, exportedUris[]}` with nested `nodes` and `links`.
* **timer:** `{id, title, durationSec, startTime, state('inactive'|'running'|'stopped')}`
* **tally:** `{id, title, value}`
* **contact:** `{id, name, phone}`
* **callLog:** `{id, contact, type('incoming'|'outgoing'|'missed'), time, durationSec}`
* **integration tokens:** separate tables per provider storing OAuth tokens or API keys.

## 5 Process activation & command palette

* **State model:** Each process (Radar, Echolalia, OCR intake, Timesheet timer) transitions Inactive → Armed → Active.
* **Voice commands:** “Activate Radar,” “Disable Echocache,” “Start timer on Project Alpha,” “Pause timer,” “Stop timer,” “Increment units removed by three.”
* **Safety:** Destructive actions require confirmation or provide an undo window.
* **Click palette:** Keyboard shortcut (Ctrl/⌘‑K) opens a palette listing commands; accessible on desktop and mobile.

## 6 External integrations

### 6.1 Timesheet.io

* OAuth2 integration to start/pause/resume/stop project timers.
* Mirrors Radar recording sessions into timesheets and back‑annotates notes with authoritative start/stop times via webhooks.

### 6.2 SMS/Text messaging

* Primary path via httpSMS (Android phone acts as SMS gateway).
* Fallback to native OS SMS composer for iOS/Android; reads via webhooks.
* Commands: “Text <contact> <message>,” “Reply ‘on my way’,” “Read my new texts.”

### 6.3 Visual intelligence

* Default provider Imagga; alternates Google Vision, AWS Rekognition, Azure CV.
* Tags, objects, categories, colours and moderation flags enrich keywords and mind maps.

### 6.4 Media control

* Spotify Web API + Web Playback SDK for playback, search, playlists and device selection.
* YouTube & YouTube Music via IFrame Player API and Data API v3 for search and playback control.
* Unified media mini‑player with commands: “Play playlist on Spotify,” “Pause,” “Next,” “Volume 50%,” “Seek to 2:30.”

### 6.5 Vehicle intelligence

* NHTSA vPIC API for decoding VIN/WMI and manufacturer data; supports batch decode up to 50 VINs.

### 6.6 Chat with PDFs

* ChatPDF backend API: add PDF sources via URL/file, ask questions and receive contextual answers with page references.

### 6.7 Vertex AI AutoML

* Optional path to train and deploy custom models on Google Vertex AI for domain‑specific extraction or prioritization.

### 6.8 Digi‑Key product information

* OAuth2 integration to search parts, get pricing, substitutions, manufacturer info, categories, media and product change notices.
* Voice commands like “Find SN74HC595,” “Price 100 units,” “Show substitutions.”

### 6.9 Mind mapping

* Mindomo API for creating and updating mind maps; fallback to local rendering.
* Live map grows branches as the user speaks; post‑hoc map creation from notes; document map from OCR.

### 6.10 Captioned calls and phone access

* Access device call logs and contacts to contextualize conversations.
* Provide real‑time call captions similar to InnoCaption, CaptionCall, and related services.
* Pluggable speech‑to‑text providers for call captioning: Deepgram, OpenAI Whisper, Microsoft Azure Speech, Google Speech‑to‑Text, AssemblyAI, Rev AI.
* Potential integration with third‑party captioning apps (CaptionMate, RogerVoice, Nagish, Olelo) where APIs are available.
* Data stored as call logs with links to contacts, transcripts, and follow‑up tasks.

## 7 Timers, alarms, Pomodoro & tally counters

* **Global timer service:** create named timers, start/stop/pause/resume, laps and project binding; optionally mirror to Timesheet.
* **Alarms:** one‑off or recurring (RRULE) alarms with notifications; fallback to calendar events when background delivery is unreliable.
* **Pomodoro engine:** configurable work/break cycles with auto‑advance, long breaks, skip/extend; optional coupling to Timesheet.
* **Tally counter:** multiple named counters with voice increments/decrements; logs quantitative actions and attaches to tasks or notes.

## 8 User interface & accessibility

* Recording surface with prominent controls, live waveform and marker chips.
* Review screen with transcript, BLUF, action table, event list and audio timeline.
* Mind map viewer with export options (OPML, Mermaid, `.mm`/`.xmind`).
* Timer/Tally dock showing active timers, pomodoro cycle and counters.
* Radar Oriley chatbot panel for quick Q/A and playful assistance.
* Accessibility: large hit targets, high‑contrast palette, voice prompts, keyboard navigation, alt text.

## 9 Security, privacy & compliance

* Explicit consent banner and recording indicator; optional verbal consent reminders.
* TLS in transit; AES‑256 at rest; per‑user keys via envelope encryption.
* Default 90‑day retention for raw audio, configurable by user; structured artefacts retained until deletion.
* Automatic redaction of sensitive data; full HIPAA compliance requires additional measures beyond MVP.

## 10 Development plan & roadmap

1. **Prototype:** simple Node.js server and PWA client with recording, timers and tally counters.
2. **Core functionality:** implement VOX detection, transcription pipeline, LLM summarization, note pages and calendar publishing.
3. **Structuring modules:** mind map generation, glossary/keyword lineage, alarms and pomodoro.
4. **External integrations:** Timesheet.io, httpSMS, Imagga, Spotify/YouTube, vPIC, ChatPDF, Vertex AI and Digi‑Key.
5. **Native shells & mobile:** wrap PWA for iOS background recording; implement offline queues.
6. **Compliance & enterprise features:** retention controls, audit trails, encryption at rest, enterprise SSO.

