# ScamNoMore

A mobile-first, cross-platform scam-detection and awareness app built with
**React Native + TypeScript on Expo (SDK 54)** — runs in **Expo Go**, no custom
native modules. It analyzes suspicious **images, voice, and video** with OpenAI,
lets users **search** a database of Singapore scam cases, **report** new incidents
into the same dataset, join **community** chat rooms, and chat with a
**scam-awareness bot** — in **4 languages** (English, 中文, Bahasa Melayu, தமிழ்).

It ships with a **5,000-row Singapore scam dataset** (scam type, keywords, town,
specific place, source, year).

> **An OpenAI API key is required.** All analysis and the chatbot run on OpenAI —
> there is no mock/offline analyzer. Put your key in `backend/.env`, start the
> backend, and set `apiBaseUrl` in `app.json`. Until then the app shows a warning
> banner and analysis fails with a clear message rather than inventing results.
> Full steps: **[`docs/SETUP.md`](docs/SETUP.md)** (about 3 minutes).

## Stack

- Expo SDK **54** · React Native **0.81** · React **19** · TypeScript
- React Navigation (bottom tabs + native stack)
- `expo-image-picker` (image/video), `expo-audio` (recording), `react-native-svg` (gauge)
- Backend: Node + TypeScript, **OpenAI** `gpt-4o` (vision + text) and `whisper-1`

## Quick start

```bash
# 1. Backend (holds the OpenAI key)
cd backend
npm install
copy .env.example .env        # paste your key into .env
npm start                     # http://localhost:3000

# 2. App — set apiBaseUrl in app.json to your LAN IP, e.g. http://172.20.10.11:3000
cd ..
npm install
npx expo start -c
```

Scan the QR code in Expo Go. See [`docs/SETUP.md`](docs/SETUP.md) for finding your
LAN IP and troubleshooting.

### Commands

```bash
npm test           # app unit tests (36)
npm run typecheck  # app type check
cd backend && npm test        # backend unit tests (28)
cd backend && npm run typecheck
node scripts/buildMockDataset.js   # regenerate src/data/scams.json (5000 rows)
```

## How analysis works

| Feature | Pipeline |
| --- | --- |
| Take picture / Upload image | **`gpt-4o` vision** — reads all text in the image *and* judges visual scam cues (implausible discounts, fake urgency banners, fake news/brand mastheads, fake endorsements, fake login/payment screens, QR codes) |
| Upload audio / Say what happened | **`whisper-1`** transcribes (auto language detection) → user edits the transcript → **`gpt-4o`** analyses it |
| Upload video | **`whisper-1`** transcribes the **audio track** → **`gpt-4o`** analyses it. No frame extraction; a silent video honestly reports "no speech detected" |
| Chatbot | **`gpt-4o`** with conversation history and a Singapore-specific system prompt |

Every result returns a calibrated `probability`, a `riskLevel`, the best-fit
`scamType`, specific `reasons` citing the actual evidence, `advice`, and a
`signals` object carrying the raw transcript/text so you can audit exactly what
the model was shown.

Media is POSTed as raw bytes with its `Content-Type` — no object storage, no
presigned URLs, no multipart parsing. The API key never leaves the backend.

## Screens (mapped to the wireframes)

- **Home** — "Please select what to analyze": (1) take picture, (2) upload image,
  (3) upload audio, (4) say what happened / record voice, (5) upload video.
  Global **Chatbot** button + language switcher on every screen.
- **Image / Voice / Video analysis** — results show a **speedometer gauge** with the
  scam probability, the reasoning, the detected content, and what to do next.
- **Search** — time period + optional keywords + "verified only" →
  "Go statistics for your search" → **Statistics by Town**, top scam types, and a
  scrollable case list.
- **Report** — mandatory date (defaults to today), 200-word description, town and
  scam-type pickers → writes into the **same dataset** as the 5,000 rows → shows a
  thank-you + comforting message with the **1799 helpline**.
- **Community** — pick a chat room by scam type → live chat session → post/exit.
- **Chatbot** — reachable from anywhere.

## Architecture

```
App.tsx
 └─ I18nProvider (4 languages)            src/i18n
     └─ NavigationContainer               src/navigation.tsx
         ├─ Tabs: Home / Search / Report / Community
         └─ Stack: Image / Voice / Video analysis, Chatbot

src/
  data/       scams.json (5000 rows) · scamStore (search, stats, addReport)
  services/   api.ts      (backend client; no mocks, fails loudly)
              analysis.ts (shared result types + risk bands)
              media.ts    (expo-image-picker helpers)
              config.ts   (reads app.json extra)
  components/ ui.tsx, RiskGauge, ScreenHeader, AnalysisResultView, BackendBanner
  screens/    Home, ImageAnalysis, VoiceAnalysis, VideoAnalysis,
              Search, Report, Community, Chatbot

backend/
  src/lib/      openai.ts (vision/Whisper/chat) · prompts.ts · parse.ts
                types.ts · http.ts
  src/handlers/ analyzeImage · analyzeVideo · transcribe · analyzeText · chat
  src/local-server.ts   (loads .env, routes requests)
```

### Design decisions

- **Expo Go compatible**: only Expo-supported modules; no custom native code.
- **No secrets on device**: the OpenAI key lives in `backend/.env` only.
- **No mock analyzers**: an earlier build fabricated OCR text and presented it as
  real, which is worse than failing. Now every verdict comes from OpenAI, and any
  failure surfaces the real error. A unit test fails the build if mock sample
  text or an API key ever appears in the app source.
- **Shared dataset for reports**: `scamStore.addReport` appends user reports to the
  in-memory copy of the 5,000-row dataset, so reported cases appear in Search
  immediately.
- **Fail safe on bad model output**: probabilities are validated and clamped; a
  model returning `1.5` clamps *up* to 1 rather than being read as `0.015`
  (which would flip an extreme verdict to "safe").

## The 5,000-row dataset

`src/data/scams.json` holds 5,000 verified records across 14 scam types and 40
Singapore towns: `id, dateReported, scamType, keywords[], town, specificPlace,
source, verified, year`.

- To use a **real CSV export**, drop it at `scripts/ScamInfoDB-5000.csv` and run
  `node scripts/generateDataset.js` (RFC-4180-aware parser for the quoted
  `Keywords` column).
- To regenerate the bundled dataset: `node scripts/buildMockDataset.js`.

## Testing

**64 tests** — 36 app + 28 backend:

- Dataset integrity (5000 rows, required fields), search filters, stats
  aggregation, shared-table reporting, keyword extraction
- Speedometer gauge geometry (angle mapping, arc paths, band/threshold agreement)
- Content-type detection, risk-band thresholds
- Backend: LLM JSON extraction (fenced, prose-wrapped, nested, escaped quotes),
  probability validation and clamping, prompt construction, Whisper filename
  derivation
- Guards that no mock analyzer or API key can reappear in the app source

## Limitations

- Analysis is AI-assisted awareness, not a verdict. Users are pointed to **1799**.
- **Whisper caps uploads at 25 MB**; long videos must be trimmed.
- Video analysis reads the **audio track only** — a purely visual scam video is
  better checked by screenshotting it and using the image flow.
- Expo Go cannot pick arbitrary audio files; the picker accepts library media.
  A production build can add `expo-document-picker`.
- Full WCAG conformance requires manual testing with assistive technologies.
