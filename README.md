# ScamNoMore

A mobile-first, cross-platform scam-detection and awareness app built with
**React Native + TypeScript on Expo (SDK 54)** — runs in **Expo Go** with no
custom native modules. It analyzes suspicious **images, voice, and video**, lets
users **search** a database of Singapore scam cases, **report** new incidents
into the same dataset, join **community** chat rooms, and chat with a
**scam-awareness bot** — in **4 languages** (English, 中文, Bahasa Melayu, தமிழ்).

It is seeded with a **5,000-row Singapore scam dataset** (scam type, keywords,
town, specific place, source, year) and integrates **AWS DynamoDB, Rekognition,
Rekognition Video, Transcribe, and Bedrock** — with deterministic on-device
mocks so it demos instantly with zero cloud setup.

## Stack

- Expo SDK **54** · React Native **0.81** · React **19** · TypeScript
- React Navigation (bottom tabs + native stack)
- `expo-image-picker` (image/video), `expo-audio` (voice recording)
- AWS SDK v3 (`@aws-sdk/client-dynamodb`, `@aws-sdk/lib-dynamodb`) — Node/Lambda only

## Quick start

```bash
npm install
npm start          # then press 'i' (iOS), 'a' (Android), or scan the QR in Expo Go
```

The app launches in **mock mode** (`app.json` → `expo.extra.useMockServices: true`),
so every AWS-backed feature returns realistic results locally. To connect real
AWS services, see [`docs/AWS_SETUP.md`](docs/AWS_SETUP.md).

If the phone cannot reach the dev server over Wi-Fi (or you are on a phone
hotspot / a network with client isolation), start in tunnel mode:

```bash
npx expo start --tunnel
```

### Other commands

```bash
npm test           # run unit tests (Jest) — 18 tests
npm run typecheck  # TypeScript type check
npm run seed       # load the 5000 rows into DynamoDB (needs AWS creds)
node scripts/buildMockDataset.js   # regenerate src/data/scams.json (5000 rows)
```

## Screens (mapped to the wireframes)

- **Home** — "Please select what to analyze": (1) take picture, (2) upload image,
  (3) upload audio, (4) say what happened / record voice, (5) upload video.
  Global **Chatbot** button + language switcher on every screen.
- **Image analysis** — Rekognition text/moderation → scam probability, reasoning,
  advice, "Check another".
- **Voice analysis** — record (max 5 min) or upload → Transcribe → **editable
  transcript** → Bedrock analysis.
- **Video analysis** — upload (max 5 min) → Rekognition Video → scam result.
- **Search** — time period + optional keywords + "verified only" →
  "Go statistics for your search" → **Statistics by Town**, top scam types, and a
  scrollable case list.
- **Report** — mandatory date (defaults to today), 200-word description, town and
  scam-type pickers → writes into the **same dataset** as the 5,000 rows → shows a
  thank-you + comforting message with the **1799 helpline**.
- **Community** — pick a chat room by scam type → live chat session with sample
  messages → post/exit.
- **Chatbot** — Bedrock-backed Q&A and awareness tips, reachable from anywhere.

## Architecture

```
App.tsx
 └─ I18nProvider (4 languages)            src/i18n
     └─ NavigationContainer               src/navigation.tsx
         ├─ Tabs: Home / Search / Report / Community
         └─ Stack: Image / Voice / Video analysis, Chatbot

src/
  data/       scams.json (5000 rows) · scamStore (search, stats, addReport)
  services/   analysis.ts (explainable scam engine)
              aws.ts      (Rekognition / Transcribe / Bedrock facade + mocks)
              dynamo.ts   (AWS SDK v3, Node-only: seed + Lambda)
              media.ts    (expo-image-picker helpers)
              config.ts   (reads app.json extra)
  components/ ui.tsx, ScreenHeader, AnalysisResultView
  screens/    Home, ImageAnalysis, VoiceAnalysis, VideoAnalysis,
              Search, Report, Community, Chatbot
scripts/      buildMockDataset.js · generateDataset.js · seedDynamo.ts
docs/         AWS_SETUP.md
```

### Design decisions

- **Expo Go compatibility**: built on Expo SDK 54; only Expo-supported modules are
  used (`expo-image-picker`, `expo-audio`, React Navigation). The AWS SDK is
  imported **only** in Node contexts (seed script / Lambda), never in the RN bundle.
- **No secrets on device**: the app talks to an API Gateway + Lambda front door;
  AWS credentials live server-side. Until that backend is configured, the app
  uses deterministic mocks.
- **Shared dataset for reports**: `scamStore.addReport` appends user reports to the
  in-memory copy of the 5,000-row dataset (mirrored to DynamoDB via `/report` +
  `putReport` in production), so reported cases appear in Search immediately.
- **Explainable analysis**: `analyzeText` produces a probability **and reasons**,
  so users understand *why* something looks like a scam. The same categories seed
  the Bedrock prompt for consistency.

## The 5,000-row dataset

`src/data/scams.json` ships with 5,000 verified records across 14 scam types and
40 Singapore towns, with fields matching the provided `ScamInfoDB-5000` schema:
`id, dateReported, scamType, keywords[], town, specificPlace, source, verified,
year`.

- To use your **real CSV export**, drop it at `scripts/ScamInfoDB-5000.csv` and run
  `node scripts/generateDataset.js` (RFC-4180-aware parser that handles the quoted
  `Keywords` column).
- To regenerate the bundled synthetic dataset, run
  `node scripts/buildMockDataset.js` (deterministic; same distribution/schema).

## Testing

`npm test` runs Jest suites covering dataset integrity (5000 rows, required
fields), search filters (date range, keywords, verified-only, town/type), stats
aggregation, the shared-table `addReport` flow, keyword extraction, and the scam
analysis engine (phishing/investment detection, urgency/money signals, benign
text). 18 tests currently pass.

## Limitations

- Mock analyzers are heuristic and for awareness only — not a substitute for
  official verification. When unsure, users are directed to call **1799**.
- Expo Go cannot pick arbitrary audio files; the audio picker accepts library
  media. A production build can add `expo-document-picker` for any audio file.
- Full WCAG conformance requires manual testing with assistive technologies.
