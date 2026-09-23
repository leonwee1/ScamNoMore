# Setup

ScamNoMore sends analysis and chatbot requests through its Node backend. The
backend holds the OpenAI key; never put that key in the Expo app.

```text
Expo app → backend → OpenAI
```

## 1. Configure and start the backend

```powershell
cd backend
npm install
copy .env.example .env
```

Set this in `backend/.env`:

```text
OPENAI_API_KEY=sk-proj-your-real-key-here
```

You may also set a local `APP_SHARED_SECRET` and match it in `app.json`. It is
only a basic request guard, not authentication, because values packaged in an
Expo app can be extracted.

Then start the server:

```powershell
npm run dev
```

Check `http://localhost:3000/health` from the same computer.

## 2. Point Expo Go at the backend

For a phone on the same Wi-Fi, find the computer's LAN IP:

```powershell
Get-NetIPAddress -AddressFamily IPv4 | Where-Object { $_.InterfaceAlias -like '*Wi-Fi*' }
```

Set it in `app.json` under `expo.extra` (not `localhost`):

```json
"extra": { "apiBaseUrl": "http://172.20.10.11:3000" }
```

Restart Expo after changing configuration:

```powershell
npx expo start -c
```

## 3. Processing and result behavior

The app asks for consent before each image, audio, video, or transcript is
sent. It sends the content over HTTPS to the backend and OpenAI; the app does
not intentionally save raw media. Do not upload OTPs, passwords, NRICs, full
card numbers, or other sensitive information.

| Feature | Pipeline | Important limit |
| --- | --- | --- |
| Image | selected image → OpenAI vision | GIF is sent as `image/gif`. |
| Audio | document/recording → Whisper → editable transcript → OpenAI text analysis | Expo Go uses a document picker for common audio formats such as MP3, M4A, and WAV. |
| Video | video audio track → Whisper → editable transcript → OpenAI text analysis | Video frames are not inspected. |
| Chatbot | text/history → OpenAI | Awareness guidance only, not official advice. |

An assessed result contains a model-derived score and guidance. If the media
has no usable speech or the model returns no valid probability, the response is
`assessmentStatus: "unable_to_assess"`. The UI gives a reason and conservative
next steps and deliberately hides the score/gauge; it is not a low-risk result.

## API routes

| Route | Purpose |
| --- | --- |
| `POST /analyze/image` | Analyze raw image bytes. |
| `POST /analyze/video` | Transcribe/analyze raw video bytes. |
| `POST /transcribe` | Transcribe raw audio bytes. |
| `POST /analyze/text` | Analyze `{ text, source }`. |
| `POST /chat` | Chatbot request with `{ message, history }`. |
| `GET /reports`, `POST /reports` | List or create unverified incident records. |
| `GET /community/messages?roomKey=…`, `POST /community/messages` | List or create anonymous room messages; `beforeCreatedAt` + `beforeId` load older pages. |
| `GET /health` | Server health and configured models. |

Reports and community messages use the backend's SQLite path. Local development
defaults to `backend/data/scamnomore.sqlite`; set `REPORTS_DB_PATH` to override
it. For persistence across deploys and devices on Render, follow
[the Render deployment guide](DEPLOY_RENDER.md) and attach the persistent disk.

## Limits and troubleshooting

- The app accepts media files up to 64 MB, then the backend extracts/compresses
  audio before the resulting Whisper upload is checked against its 25 MB limit.
  Trim very long videos before upload.
- A silent or purely visual video should be checked with an image/screenshot
  flow, since video analysis does not extract frames.
- A new report is `Verified: No` and is hidden while Search's default
  **verified only** filter is enabled.
- A community room is public and unmoderated; do not post personal details or
  use it for emergency reporting.

| Symptom | Check |
| --- | --- |
| Backend banner says not configured | Set `apiBaseUrl` and restart Expo with `-c`. |
| Phone cannot reach backend | Confirm the LAN IP, Wi-Fi/network access, and `/health`. |
| API key error | Check `backend/.env`, then restart the backend. |
| New data disappears after Render deploy | A paid disk must be mounted at `/var/data` and `REPORTS_DB_PATH` must point there. |
| Media result says Unable to assess | Read the displayed reason; do not infer that the content is safe. |
