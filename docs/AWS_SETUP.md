# AWS setup (free tier)

ScamNoMore runs fully on-device in Expo Go using deterministic mocks
(`useMockServices: true` in `app.json`). This document describes how to wire the
real AWS services when you are ready. The recommended topology keeps **all
credentials off the device**:

```
Expo app  ──HTTPS──▶  API Gateway  ──▶  Lambda  ──▶  Rekognition / Rekognition Video
                                            │            Transcribe / Bedrock
                                            └──▶  DynamoDB (ScamNoMoreScams)
```

The app only ever holds an `apiBaseUrl`. It never embeds AWS keys.

## 1. DynamoDB (data + reports)

Free tier: 25 GB storage + 25 WCU/RCU (provisioned) or generous on-demand usage.

```bash
aws dynamodb create-table \
  --table-name ScamNoMoreScams \
  --attribute-definitions AttributeName=id,AttributeType=S \
  --key-schema AttributeName=id,KeyType=HASH \
  --billing-mode PAY_PER_REQUEST \
  --region ap-southeast-1
```

Seed the 5000 rows:

```bash
AWS_REGION=ap-southeast-1 DYNAMO_TABLE=ScamNoMoreScams npm run seed
```

Incident reports submitted in the app are written to this **same table**
(`putReport` in `src/services/dynamo.ts`), not a separate table.

## 2. Rekognition (image) and Rekognition Video

- Image: Lambda calls `DetectText` + `DetectModerationLabels`, feeds the OCR text
  into the shared analyzer (`analyzeText`) or Bedrock, returns an `AnalysisResult`.
- Video: Lambda starts `StartTextDetection` / `StartLabelDetection`, polls
  `GetTextDetection`, aggregates on-screen text across sampled frames.
- Free tier: 5,000 images/month and 1,000 minutes of video for the first 12 months.

## 3. Transcribe (voice → text)

- Lambda uploads the audio to S3, calls `StartTranscriptionJob`, returns text.
- Free tier: 60 minutes/month for the first 12 months.

## 4. Bedrock (LLM analysis + chatbot)

- Enable model access (e.g. Anthropic Claude or Amazon Titan Text) in the Bedrock
  console for your region.
- Lambda calls `InvokeModel` with a prompt that reuses the scam categories in
  `src/services/analysis.ts` for consistent, explainable output.
- Bedrock is pay-as-you-go (no perpetual free tier); costs are per-token and small
  for this workload.

## 5. Point the app at your backend

In `app.json` under `expo.extra`:

```json
{
  "useMockServices": false,
  "apiBaseUrl": "https://<your-api-id>.execute-api.ap-southeast-1.amazonaws.com/prod",
  "awsRegion": "ap-southeast-1",
  "dynamoTable": "ScamNoMoreScams"
}
```

The service facade (`src/services/aws.ts`) automatically switches from mocks to
real API calls when `useMockServices` is `false` and `apiBaseUrl` is set.

## Expected Lambda routes

| Route              | Input                        | Output (`AnalysisResult` unless noted) |
| ------------------ | ---------------------------- | -------------------------------------- |
| `POST /analyze/image` | `{ imageUri }` (or S3 key) | scam probability + reasons             |
| `POST /analyze/video` | `{ videoUri }`             | scam probability + reasons             |
| `POST /transcribe`    | `{ audioUri }`             | `{ text }`                             |
| `POST /analyze/text`  | `{ text }`                 | scam probability + reasons             |
| `POST /chat`          | `{ message, history }`     | `{ reply }`                            |
| `POST /report`        | report fields              | `{ ok: true }` (writes to DynamoDB)    |
