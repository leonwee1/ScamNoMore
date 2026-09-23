# Deploy ScamNoMore to Render

Render gives the Expo app a public HTTPS backend URL. AI analysis, chatbot
requests, submitted incident reports, and community-room messages then work from
any network.

## Important: persistent reports and chats need a paid disk

The SQLite file is permanent only when it lives on a Render Persistent Disk.
Render's default/free filesystem is ephemeral, so a free service loses files on
restart or redeploy. Persistent disks require a paid web service and must stay on
one service instance. See [Render Persistent Disks](https://render.com/docs/disks).

The repository's `backend/render.yaml` configures:

```yaml
plan: 0.5c-512mb
disk:
  name: scamnomore-data
  mountPath: /var/data
  sizeGB: 1
envVars:
  - key: REPORTS_DB_PATH
    value: /var/data/scamnomore.sqlite
```

The backend creates/migrates its schema at runtime. Reports and community
messages are both stored in that one file.

> If the existing service was made manually in the Render dashboard, editing
> `render.yaml` alone does **not** add a disk to it. Upgrade the service and add
> the disk in the dashboard as described below, or create a new Blueprint-based
> service.

## Configure the existing Render service

1. In Render, open your ScamNoMore web service and change its instance type to
   a paid plan that supports Persistent Disks (the Blueprint uses `0.5c-512mb`).
2. Open **Disks** and add a disk named `scamnomore-data`:
   - Mount path: `/var/data`
   - Size: `1 GB`
3. In **Environment**, add or confirm:

   | Key | Value |
   | --- | --- |
   | `OPENAI_API_KEY` | your OpenAI project key |
   | `APP_SHARED_SECRET` | a long random value matching `app.json` |
   | `REPORTS_DB_PATH` | `/var/data/scamnomore.sqlite` |
   | `RATE_LIMIT_GLOBAL_BURST_MAX` | `60` (adjust for your demo) |
   | `RATE_LIMIT_GLOBAL_DAILY_MAX` | `250` (adjust to your OpenAI budget) |

4. Keep these service settings:

   | Field | Value |
   | --- | --- |
   | Root directory | `backend` |
   | Build command | `npm install && npm run build` |
   | Start command | `npm start` |
   | Health check | `/health` |

5. Deploy the code only when you are ready to publish your local changes. Render
   auto-deploys after a GitHub push to the configured branch.

For a new service, **New + → Blueprint** can read `backend/render.yaml`; still
enter the two secret values in Render rather than committing them.

## Point Expo Go at Render

In `app.json`, set the public backend URL and the matching shared-secret value:

```json
"extra": {
  "apiBaseUrl": "https://scamnomore.onrender.com",
  "appSecret": "the-same-value-as-APP_SHARED_SECRET"
}
```

Then restart Expo with a cleared cache:

```powershell
npx expo start -c
```

## Verify shared persistence

1. On phone A, submit an incident report.
2. On phone B (or a new Expo session), open Search, turn off **Show verified
   cases only**, and use a date range that includes the report. The row should
   appear with `verified: No`.
3. In Community, enter the same scam-type room on either phone. Send a message,
   exit, then enter it again. The server reloads the saved message from SQLite.

The five thousand bundled mock rows remain on each phone. Only user-submitted,
unverified reports and shared community messages come from SQLite.

## Privacy and security limits

- The app asks for consent before each image, audio, video, or transcript upload.
  It sends the content over HTTPS to the ScamNoMore backend and OpenAI. The app
  does not deliberately save raw media; avoid uploading OTPs, passwords, NRICs,
  full card numbers, or other personal information.
- Community messages are anonymous but visible to other users of the app. They
  are not moderated or suitable for emergency reporting; do not post personal
  details.
- `APP_SHARED_SECRET` is a basic abuse guard, not user authentication: it is
  bundled into the app and can be extracted. Do not use it to authorize account
  actions or moderation. Real accounts are needed for that.
- The backend also has a service-wide rate ceiling, independent of forwarded IP
  headers, so copying the app secret cannot create unlimited request allowance.
  Set its global burst/daily limits before a public demo; it is a spend cap, not
  a replacement for authentication, WAF rules, or accounts.
- A disk-backed Render service is single-instance and has deploy downtime. It is
  suitable for this demo's SQLite workload, not a horizontally scaled system.

## Troubleshooting

| Symptom | Check |
| --- | --- |
| New reports/messages disappear after deploy | Confirm a paid disk is attached at `/var/data` and `REPORTS_DB_PATH` is exactly `/var/data/scamnomore.sqlite`. |
| Backend build fails | Confirm Root Directory is `backend` and run `npm install && npm run build`. |
| App says not authorised | `appSecret` must match `APP_SHARED_SECRET`. |
| Phone cannot reach backend | Verify `apiBaseUrl`, the Render service status, and network access. |
| New report is not in Search | Turn off the default **Show verified cases only** filter. |
