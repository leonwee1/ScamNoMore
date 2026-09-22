# Deploy the backend to Render

This gives you a **permanent HTTPS URL** so anyone can use the app from any
network — your laptop no longer needs to be running the backend.

You do **not** upload files anywhere. Render pulls the code from your GitHub repo
(`leonwee1/ScamNoMore`) and builds the `backend/` folder.

---

## Step 0 — Generate a shared secret

This is the password the app sends so strangers can't spend your OpenAI quota.
Generate a random one:

```powershell
node -e "console.log(require('crypto').randomBytes(24).toString('base64url'))"
```

Copy the output — you'll paste it in two places (Render, and `app.json`).

## Step 1 — Push your code

Render deploys from GitHub, so make sure everything is pushed:

```powershell
git push origin main
```

## Step 2 — Create the service on Render

1. Go to <https://dashboard.render.com> → **New +** → **Web Service**.
2. Connect your GitHub account if prompted, then pick the **ScamNoMore** repo.
3. Fill in these settings — the **Root Directory is the important one**, because
   the backend lives in a subfolder:

   | Field | Value |
   | --- | --- |
   | Name | `scamnomore-backend` (any name; becomes part of the URL) |
   | Language / Runtime | **Node** |
   | Branch | `main` |
   | **Root Directory** | **`backend`** |
   | Build Command | `npm install && npm run build` |
   | Start Command | `npm start` |
   | Instance Type | **Free** |

4. Click **Advanced** → **Health Check Path** → set to `/health`.

> Alternative: the repo includes `backend/render.yaml`, so you can instead use
> **New + → Blueprint** and Render will read those settings automatically. You
> will still be asked for the two secrets below.

## Step 3 — Set the environment variables

In the service → **Environment** → **Add Environment Variable**. Add:

| Key | Value |
| --- | --- |
| `OPENAI_API_KEY` | your `sk-proj-...` key |
| `APP_SHARED_SECRET` | the secret from Step 0 |

Optional tuning (sensible defaults already apply):

| Key | Default | Meaning |
| --- | --- | --- |
| `OPENAI_CHAT_MODEL` | `gpt-4o` | Must stay **vision-capable** for image analysis |
| `OPENAI_TRANSCRIBE_MODEL` | `whisper-1` | Speech-to-text |
| `RATE_LIMIT_BURST_MAX` | `15` | Requests per minute per client |
| `RATE_LIMIT_DAILY_MAX` | `200` | Requests per day per client |

Do **not** set `PORT` — Render provides it and the server reads it automatically.

## Step 4 — Deploy and verify

Click **Create Web Service**. The first build takes a few minutes. When it shows
**Live**, copy your URL, e.g.:

```
https://scamnomore-backend.onrender.com
```

Verify it in a browser:

```
https://scamnomore-backend.onrender.com/health
```

You should see:

```json
{
  "ok": true,
  "provider": "openai",
  "chatModel": "gpt-4o",
  "apiKeyConfigured": true,
  "authRequired": true,
  "rateLimits": { "burstMax": 15, "burstWindowMs": 60000, "dailyMax": 200 }
}
```

Check both `apiKeyConfigured` and `authRequired` are `true`. If `authRequired` is
`false`, your `APP_SHARED_SECRET` didn't save — the URL is unprotected.

## Step 5 — Point the app at Render

In `app.json` → `expo.extra`:

```json
"extra": {
  "apiBaseUrl": "https://scamnomore-backend.onrender.com",
  "appSecret": "the-secret-from-step-0"
}
```

No trailing slash. Then restart Expo with a cleared cache:

```powershell
npx expo start -c
```

Now anyone can install Expo Go, scan your QR code, and the AI features work from
any network.

---

## Important: free-tier cold starts

Render's free instances **sleep after ~15 minutes of inactivity**. The next
request wakes them, which takes **about 50 seconds**.

What that means in practice:

- The first analysis after an idle period feels very slow.
- The app's request timeout is 180s, so it will still succeed — just be patient.
- Before demoing, open `/health` in a browser once to wake the service.

To remove cold starts entirely, upgrade to Render's paid Starter tier.

## Updating the backend later

Render auto-deploys on every push to `main`:

```powershell
git add -A; git commit -m "..."; git push origin main
```

Watch progress under the service's **Events** / **Logs** tabs.

## Security notes — please read

1. **The shared secret is bundled into the app, so it is not truly secret.**
   Someone who extracts the JS bundle can read it. It stops *casual* abuse — bots
   and passers-by who find your URL — which is the realistic threat. It is not
   user authentication. For that you'd need accounts and server-issued tokens.

2. **Rate limits are per-IP and in-memory.** They reset if Render restarts or
   redeploys the instance, and they'd be per-instance if you ever scale beyond
   one. Fine for a demo; use Redis if you scale.

3. **You pay for all usage.** Every analysis and chat message bills your OpenAI
   account. The daily cap (`RATE_LIMIT_DAILY_MAX`) is your main cost guard — lower
   it if you're sharing widely. Also set a **monthly budget limit** in the OpenAI
   dashboard (Settings → Limits) as a hard backstop.

4. **Rotate the secret** if you ever share the app widely and want to cut access:
   change `APP_SHARED_SECRET` in Render and `appSecret` in `app.json`, then
   redistribute the app. Old copies stop working.

## Troubleshooting

| Symptom | Cause / fix |
| --- | --- |
| Build fails: `tsc: not found` | Build Command must be `npm install && npm run build`. |
| Build fails: `Cannot find module` | **Root Directory** isn't set to `backend`. |
| `/health` 404s | Wrong URL, or the service is still building. |
| `apiKeyConfigured: false` | `OPENAI_API_KEY` missing in Render → Environment. |
| App: "Not authorised by the server" | `appSecret` in `app.json` ≠ `APP_SHARED_SECRET` in Render. |
| App: "Cannot reach the backend" | Wrong `apiBaseUrl`, or the service is asleep — open `/health` first. |
| First request takes ~50s | Free-tier cold start. Expected. |
| `429 Too many requests` | Rate limit hit. Wait, or raise `RATE_LIMIT_BURST_MAX`. |
| `401 Incorrect API key` in logs | Bad OpenAI key. Regenerate at platform.openai.com. |
| `429 quota exceeded` in logs | OpenAI account out of credit. Add billing. |
