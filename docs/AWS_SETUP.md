# AWS setup

**There is no mock mode.** Every scam verdict and every chatbot reply comes from
AWS. If `apiBaseUrl` is not set the app shows a clear error and a warning banner
rather than inventing a result.

```
Expo app ──HTTPS──▶ API Gateway ──▶ Lambda ──┬──▶ Rekognition        (image OCR/labels/moderation)
                │                            ├──▶ Rekognition Video  (frame text/labels)
                │                            ├──▶ Transcribe         (speech → text)
                │                            ├──▶ Bedrock LLM        (all analysis + chatbot)
                │                            └──▶ DynamoDB           (scam cases + reports)
                └──PUT presigned URL──▶ S3   (media never passes through the API)
```

No AWS credentials ever live on the device.

## Prerequisites

1. **Enable Bedrock model access.** Bedrock console → *Model access* → request
   access to a text+vision model (e.g. Anthropic Claude 3.5 Sonnet, or Amazon
   Nova Lite/Pro). This is a one-time approval per account/region.
2. AWS credentials locally (`aws configure`).
3. Node 20+.

> Vision matters: image analysis sends the **actual picture** to Bedrock, not just
> OCR text. That is what lets it catch a fake "80% OFF" advert with a bogus
> doctor endorsement, which text extraction alone would miss.

---

## Option A — Local dev server (fastest, no deployment)

Real AWS calls, running from your laptop. Best for development and demos.

```powershell
# 1. Create a bucket for uploads
aws s3 mb s3://scamnomore-media-<unique> --region ap-southeast-1

# 2. Allow the phone to PUT directly to it
aws s3api put-bucket-cors --bucket scamnomore-media-<unique> --cors-configuration '{
  "CORSRules":[{"AllowedMethods":["PUT","GET"],"AllowedOrigins":["*"],"AllowedHeaders":["*"]}]
}'

# 3. Run the backend
cd backend
npm install
$env:AWS_REGION="ap-southeast-1"
$env:MEDIA_BUCKET="scamnomore-media-<unique>"
$env:BEDROCK_MODEL_ID="apac.anthropic.claude-3-5-sonnet-20240620-v1:0"
npx ts-node src/local-server.ts
```

Check it: open `http://localhost:3000/health` — it echoes the region, bucket and model.

Then point the app at your machine's **LAN IP** (not `localhost`, the phone must
reach your laptop). In `app.json`:

```json
"extra": { "apiBaseUrl": "http://172.20.10.11:3000" }
```

Restart Expo with a cleared cache so the new config is picked up:

```
npx expo start -c
```

> iOS blocks plain HTTP by default. For local testing this works in Expo Go, but
> a production build must use HTTPS (Option B).

---

## Option B — Deploy to AWS (production)

Requires the [AWS SAM CLI](https://docs.aws.amazon.com/serverless-application-model/latest/developerguide/install-sam-cli.html).

```bash
cd backend
npm install
npm run build          # tsc -> dist/
sam build
sam deploy --guided    # accept defaults; note the ApiBaseUrl output
```

The stack creates the API, the six Lambdas, the S3 media bucket (with 1-day
lifecycle expiry on uploads for privacy), the DynamoDB table, and least-privilege
IAM roles. Copy the `ApiBaseUrl` output into `app.json` → `expo.extra.apiBaseUrl`.

Seed the 5,000 scam rows:

```bash
cd ..
AWS_REGION=ap-southeast-1 DYNAMO_TABLE=ScamNoMoreScams npm run seed
```

---

## Endpoints

| Route | Input | AWS services used | Output |
| --- | --- | --- | --- |
| `POST /upload-url` | `{ kind, contentType }` | S3 (presign) | `{ uploadUrl, key }` |
| `POST /analyze/image` | `{ key }` | **Rekognition** → **Bedrock (vision)** | `AnalysisResult` |
| `POST /analyze/video` | `{ key }` | **Rekognition Video** → **Bedrock** | `AnalysisResult` |
| `POST /transcribe` | `{ key, lang? }` | **Transcribe** | `{ text }` |
| `POST /analyze/text` | `{ text, source? }` | **Bedrock** | `AnalysisResult` |
| `POST /chat` | `{ message, history }` | **Bedrock** | `{ reply }` |

`AnalysisResult` = `{ probability, riskLevel, scamType, reasons[], advice, detectedText?, signals? }`.
`signals` carries the raw Rekognition/Transcribe evidence for auditing, so you can
always see *what* the LLM was shown.

## Cost notes (free tier where available)

- **Rekognition**: 5,000 images + 1,000 video minutes/month, first 12 months.
- **Transcribe**: 60 audio minutes/month, first 12 months.
- **DynamoDB**: 25 GB on-demand storage always free.
- **S3**: uploads auto-delete after 1 day.
- **Bedrock**: pay-per-token, no perpetual free tier. Costs are small for this
  workload (a few hundred tokens per analysis). Choose a cheaper model such as
  Amazon Nova Lite via `BEDROCK_MODEL_ID` to reduce it further.

## Troubleshooting

| Symptom | Cause / fix |
| --- | --- |
| Banner: "AWS backend not configured" | `apiBaseUrl` empty in `app.json`. Set it and `npx expo start -c`. |
| `AccessDeniedException` on Bedrock | Model access not approved, or wrong region. Check Bedrock → Model access. |
| `ValidationException: model ... not supported` | Use a cross-region inference profile id (e.g. `apac.` / `us.` prefix) for your region. |
| `Upload failed: 403` | Bucket CORS missing, or the presigned URL expired (15 min). |
| Image analysis is generic | Confirm your model supports **vision**; text-only models can't see the image. |
| Video analysis times out | Long videos exceed the poll window. Keep clips under the 5-minute app limit. |
