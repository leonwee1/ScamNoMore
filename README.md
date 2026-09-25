# ScamNoMore

ScamNoMore is an Expo mobile demo for scam-awareness conversations and
AI-assisted checks of images, audio, video, and typed descriptions. It supports
English, Chinese, Bahasa Melayu, and Tamil, and runs in Expo Go.

It is an awareness tool, not a fraud-reporting authority, safety guarantee, or
professional determination. If somebody may be at risk, contact the relevant
bank, platform, or Singapore ScamShield helpline (1799) promptly.

## What is real in this demo

- The bundled 5,000-case search dataset is **mock/demo data created for this
  project**. Its `Verified: Yes` labels are demonstration metadata; they do not
  mean records verified by an authority.
- A submitted incident report is sent to the backend, stored as `Verified: No`,
  and appears in Search after the app reloads the backend data. This is shared
  across devices only when the deployed backend has persistent SQLite storage.
- Community rooms save anonymous messages on the backend. Re-entering the same
  room reloads saved messages, and older history can be loaded in pages, but
  this is a refresh-based discussion board—not real-time chat, an account
  system, or a moderated community service.
- Image, audio, video, text, and chatbot responses use OpenAI through the
  backend when it is configured. An AI result is an estimate, not a calibrated
  probability or proof that something is safe/scam-related.

## Privacy before analysis

Before every media or transcript upload, the app asks for consent. The selected
content is sent over HTTPS to the ScamNoMore backend and then to OpenAI for
processing. The application does not intentionally persist raw media, but users
should avoid uploading passwords, OTPs, NRICs, full card numbers, or other
sensitive personal information. OpenAI processing is subject to OpenAI's own
policies.

The app displays **Unable to assess** when it cannot make a meaningful
assessment—for example, a video has no usable speech or the model response has
no valid probability. It shows the reason, hides the risk gauge, and gives
conservative next steps; it never treats an inconclusive result as safe.

## Stack

- Expo SDK 54, React Native, TypeScript, React Navigation
- `expo-image-picker` for image/video selection, `expo-document-picker` for
  MP3/M4A/WAV and other audio files, and `expo-audio` for recording
- Node.js + TypeScript backend, OpenAI vision/text and Whisper APIs
- SQLite (`better-sqlite3`) for submitted reports and community messages

## Run ScamNoMore on a mobile phone

The phone runs the Expo app through **Expo Go**. The QR code you scan is the QR
code printed by `npx expo start`; it is not the backend health-check URL.

### Recommended: use the shared Render backend

This is the simplest way to let a teammate try the app. The laptop only needs
to serve the Expo JavaScript bundle; analysis, chatbot, reports, and community
requests go to the public backend.

1. Install **Node.js LTS** on the laptop and **Expo Go** on the phone.
2. Clone the repository and open PowerShell in the project folder:

   ```powershell
   git clone https://github.com/leonwee1/ScamNoMore.git
   cd ScamNoMore
   npm install
   ```

3. Open `app.json` and confirm that `expo.extra.apiBaseUrl` points to the
   deployed backend:

   ```json
   "apiBaseUrl": "https://scamnomore.onrender.com"
   ```

4. Start Expo with a tunnel:

   ```powershell
   npx expo start -c --tunnel
   ```

5. Wait for the terminal to display a QR code. Open **Expo Go**, choose its QR
   scanner, and scan that QR code. On iPhone, the Camera app can also open the
   Expo link and then hand it to Expo Go.
6. Keep PowerShell running while using the app. The phone and laptop do not
   need to be on the same Wi-Fi when `--tunnel` is working.

To check the backend separately, open
`https://scamnomore.onrender.com/health` in a browser. That page only reports
backend health; it is not an app QR code and cannot launch Expo Go.

### Local backend option (same Wi-Fi)

Use this when developing the Node backend on the laptop itself:

1. In a second PowerShell window, configure and start the backend:

   ```powershell
   cd backend
   npm install
   copy .env.example .env
   # Edit .env and set OPENAI_API_KEY (and optionally APP_SHARED_SECRET)
   npm run dev
   ```

2. Find the laptop's Wi-Fi IPv4 address:

   ```powershell
   ipconfig
   ```

   Look for the IPv4 address under the active Wi-Fi adapter, for example
   `192.168.1.25`.

3. In `app.json`, set the API URL to the laptop's address, not `localhost`:

   ```json
   "apiBaseUrl": "http://192.168.1.25:3000"
   ```

4. Make sure the phone and laptop are on the same Wi-Fi, then start Expo from
   the repository root:

   ```powershell
   cd ..
   npx expo start -c --lan
   ```

5. Scan the QR code shown by Expo Go. If the phone cannot connect, allow Node.js
   through Windows Firewall or use the shared Render backend with `--tunnel`.

Local reports and community messages are stored in
`backend/data/scamnomore.sqlite`. They are not available to other phones unless
those phones use the same reachable backend. For a shared deployment, use the
Render persistent-disk setup described in [the Render deployment guide](docs/DEPLOY_RENDER.md).

### Common problems

- **“No apps connected”**: Expo is running, but no phone has opened the QR link
  yet. Scan the QR code with Expo Go.
- **Tunnel error / “remote gone away”**: restart Expo and try
  `npx expo start -c --tunnel` again. If both devices are on the same Wi-Fi,
  use `--lan` instead.
- **The app opens but analysis or reports fail**: check `apiBaseUrl`, confirm
  the backend health page is reachable, and wait briefly if Render is waking up.
- **Camera, microphone, or photo access fails**: grant the requested permission
  to Expo Go in the phone's system settings.

See the fuller [setup instructions](docs/SETUP.md) for development details.

### Test and type-check

```powershell
npm test
npm run typecheck
cd backend
npm test
npm run typecheck
npm run build
```

## Share it with teammates or judges

Set `apiBaseUrl` in `app.json` to your public Render backend:

```json
"apiBaseUrl": "https://scamnomore.onrender.com"
```

That lets Expo Go devices reach the AI features, report endpoint, community
endpoint, and chatbot from any network. A public URL alone does **not** make
SQLite permanent: attach a paid Render Persistent Disk and set
`REPORTS_DB_PATH=/var/data/scamnomore.sqlite`. The project contains the needed
Blueprint configuration in `backend/render.yaml`; existing manually-created
Render services need the disk added in the dashboard. Follow
[the Render deployment guide](docs/DEPLOY_RENDER.md) before relying on shared
reports or chats in a demo.

`APP_SHARED_SECRET` adds a basic request guard but is bundled in the app, so it
is not authentication. The backend also has a configurable service-wide
burst/daily ceiling to cap public-demo spend even if that value is copied. Set
the global limits for your OpenAI budget; neither mechanism is suitable for
accounts, access control, or moderation.

## Feature behavior

| Feature | Behavior and limit |
| --- | --- |
| Image analysis | Sends the selected image to the backend/OpenAI after consent. GIFs are uploaded as `image/gif`. |
| Audio analysis | Selects actual audio documents (including MP3/M4A/WAV where supported), transcribes them, then lets the user review/edit the transcript before analysis. |
| Video analysis | Transcribes the audio track only; it does not inspect video frames. A silent or unusable audio track returns **Unable to assess** rather than a safe result. |
| Text/chatbot | Sends the user-entered text to the backend/OpenAI. Chatbot answers are awareness guidance, not official advice. |
| Report | Persists an unverified, privacy-minimized search record only after the backend confirms the write. Descriptions are not returned in the shared search response. |
| Community | Stores anonymous room messages in SQLite, reloads them on room entry, and can load older history. There are no user identities, moderation controls, or instant push updates. |

## Architecture

```text
Expo app
  ├─ bundled 5,000-row mock dataset (search/statistics seed)
  ├─ API client (analysis, chatbot, reports, community)
  └─ consent gate before media/transcript processing

Node backend
  ├─ OpenAI handlers (image, transcription, text, chatbot)
  ├─ report/community HTTP handlers
  └─ SQLite database (reports and anonymous messages)
       └─ REPORTS_DB_PATH, /var/data/scamnomore.sqlite on Render
```

## Data and operational limits

- New reports are deliberately unverified and can be publicly searchable when
  the default **verified only** Search filter is turned off. They are not
  reviewed, deduplicated, or validated by an authority.
- Community messages are public to app users and unmoderated. Do not post
  personal details, accusations, evidence, or emergency reports there.
- Persistent SQLite on Render is appropriate for this single-instance demo.
  It is not a multi-instance, highly available, or audit-grade database design.
- Render's free/default filesystem is ephemeral. Without a persistent disk,
  reports and community messages can disappear after a restart or deployment.
- The app accepts media files up to 64 MB, then the backend extracts/compresses
  audio before sending it to Whisper (whose resulting upload must be at most
  25 MB). Video analysis is based on audio, so a purely visual video should
  instead be checked with an image/screenshot flow.
- The app does not claim model calibration, verified data provenance,
  auditability, live moderation, or a real-time chat service.

## Dataset development

`src/data/scams.json` is the project's generated mock dataset. Regenerate it
for demo use with:

```powershell
node scripts/buildMockDataset.js
```

Do not present the generated records or their verification labels as official
Singapore scam case data.
