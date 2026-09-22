# Setup

ScamNoMore uses **OpenAI** for all analysis and the chatbot. Setup is three steps.

```
Expo app ──HTTP──▶ backend (holds the key) ──▶ OpenAI
                                              ├─ gpt-4o vision  → image analysis
                                              ├─ whisper-1      → voice + video audio
                                              └─ gpt-4o         → text analysis + chatbot
```

## Where the OpenAI API key goes

**In `backend/.env` — never in the app, never in source code.**

```powershell
cd backend
copy .env.example .env      # macOS/Linux: cp .env.example .env
```

Then edit `.env`:

```
OPENAI_API_KEY=sk-proj-your-real-key-here
```

`backend/.env` is gitignored, so it will not be committed. `dotenv` loads it at
startup (first line of `src/local-server.ts`) and `src/lib/openai.ts` reads
`process.env.OPENAI_API_KEY`.

> **Why not in the app?** Anything bundled into an Expo app can be extracted from
> the build, and a leaked key is billed to you. The backend keeps it server-side.

Get a key at <https://platform.openai.com/api-keys>.

## 1. Start the backend

```powershell
cd backend
npm install
npm run dev
```

You should see:

```
ScamNoMore backend listening on http://0.0.0.0:3000
  chat model : gpt-4o
  whisper    : whisper-1
  API key    : loaded from environment ✓
```

Verify: open <http://localhost:3000/health> — it reports the models and whether
the key was found.

## 2. Point the app at the backend

Find your computer's LAN IP (the phone cannot reach `localhost`):

```powershell
Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.InterfaceAlias -like '*Wi-Fi*' }
```

Put it in `app.json` → `expo.extra`:

```json
"extra": { "apiBaseUrl": "http://172.20.10.11:3000" }
```

## 3. Start the app

```powershell
npx expo start -c      # -c clears the cache so the new config is picked up
```

Phone and computer must be on the same Wi-Fi. If the QR won't connect, use
`npx expo start --tunnel`.

---

## How each feature works

| Feature | Pipeline | Notes |
| --- | --- | --- |
| Take picture / Upload image | `gpt-4o` vision | Reads all text in the image **and** judges visual cues: implausible discounts, fake urgency banners, fake news/brand mastheads, fake endorsements, fake login/payment screens, QR codes |
| Upload audio / Say what happened | `whisper-1` → user edits transcript → `gpt-4o` | Whisper auto-detects the language (EN/ZH/MS/TA) |
| Upload video | `whisper-1` on the **audio track** → `gpt-4o` | No frame extraction needed. A silent video reports "no speech detected" rather than guessing |
| Chatbot | `gpt-4o` with history | Singapore-specific system prompt, 1799 helpline |

Media is POSTed as raw bytes with its `Content-Type` — no object storage, no
presigned URLs, no multipart parsing.

### Endpoints

| Route | Body | Returns |
| --- | --- | --- |
| `POST /analyze/image` | raw image bytes | `AnalysisResult` |
| `POST /analyze/video` | raw video bytes | `AnalysisResult` |
| `POST /transcribe` | raw audio bytes | `{ text }` |
| `POST /analyze/text` | `{ text, source }` | `AnalysisResult` |
| `POST /chat` | `{ message, history }` | `{ reply }` |
| `GET /health` | – | models + key status |

`AnalysisResult` = `{ probability, riskLevel, scamType, reasons[], advice, detectedText?, signals? }`.
`signals` carries the raw evidence (transcript/text) so you can audit exactly
what the model was shown.

## Limits and cost

- **Whisper caps files at 25 MB.** The app checks this before uploading and shows
  a friendly message. A 5-minute voice recording is comfortably under it; a
  5-minute *video* may not be — use a shorter clip.
- Costs are per-token/per-minute and small for this workload. `gpt-4o-mini`
  (set `OPENAI_CHAT_MODEL`) is cheaper, but **must remain vision-capable** for
  image analysis.

## Troubleshooting

| Symptom | Fix |
| --- | --- |
| Orange banner "Backend not configured" | `apiBaseUrl` empty in `app.json`. Set it and run `npx expo start -c`. |
| "Cannot reach the backend at ..." | Backend not running, wrong LAN IP, or phone on a different network. Check `/health` from your computer first. |
| `OPENAI_API_KEY is not set` | Create `backend/.env` with the key, then restart the backend. |
| `401 Incorrect API key` | Bad or revoked key. Regenerate at platform.openai.com. |
| `429 quota exceeded` | Add billing credit to your OpenAI account. |
| Video returns "no speech detected" | The clip is silent. Screenshot it and use the image check instead. |
| `EADDRINUSE :::3000` | Port already used. Stop the old process or set `PORT=3001`. |
| Want a permanent public URL? | See [DEPLOY_RENDER.md](DEPLOY_RENDER.md). |
