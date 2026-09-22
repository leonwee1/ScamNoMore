import {
  GetLabelDetectionCommand,
  GetTextDetectionCommand,
  RekognitionClient,
  StartLabelDetectionCommand,
  StartTextDetectionCommand,
} from '@aws-sdk/client-rekognition';
import { AnalysisSignals } from './types';

/**
 * Amazon Rekognition Video evidence extraction.
 *
 * Video APIs are asynchronous: Start* returns a JobId, then Get* must be polled
 * until the job leaves the IN_PROGRESS state. We aggregate on-screen text and
 * labels across sampled frames, dedupe them, and hand the result to Bedrock.
 */
const REGION = process.env.AWS_REGION ?? 'ap-southeast-1';
const client = new RekognitionClient({ region: REGION });

const POLL_INTERVAL_MS = Number(process.env.REKOGNITION_POLL_MS ?? 3000);
const MAX_POLL_ATTEMPTS = Number(process.env.REKOGNITION_MAX_POLLS ?? 40); // ~2 min

export interface VideoRef {
  bucket: string;
  key: string;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export async function analyzeVideoWithRekognition(ref: VideoRef): Promise<AnalysisSignals> {
  const Video = { S3Object: { Bucket: ref.bucket, Name: ref.key } };

  const [textJob, labelJob] = await Promise.all([
    client.send(new StartTextDetectionCommand({ Video })),
    client.send(new StartLabelDetectionCommand({ Video, MinConfidence: 70 })),
  ]);

  const [textResult, labelResult] = await Promise.all([
    pollTextDetection(textJob.JobId!),
    pollLabelDetection(labelJob.JobId!).catch(() => ({ labels: [] as string[] })),
  ]);

  return {
    source: 'rekognition-video',
    ocrText: textResult.lines.join('\n'),
    frameCount: textResult.frameCount,
    labels: labelResult.labels,
    hasQrCode: labelResult.labels.some((l) =>
      ['qr code', 'qr', 'barcode', 'bar code'].includes(l.toLowerCase())
    ),
  };
}

async function pollTextDetection(
  jobId: string
): Promise<{ lines: string[]; frameCount: number }> {
  for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS; attempt++) {
    const res = await client.send(new GetTextDetectionCommand({ JobId: jobId, MaxResults: 1000 }));

    if (res.JobStatus === 'FAILED') {
      throw new Error(`Rekognition text detection failed: ${res.StatusMessage ?? 'unknown'}`);
    }
    if (res.JobStatus === 'SUCCEEDED') {
      const detections = res.TextDetections ?? [];
      const timestamps = new Set<number>();
      const seen = new Set<string>();
      const lines: string[] = [];

      for (const d of detections) {
        if (typeof d.Timestamp === 'number') timestamps.add(d.Timestamp);
        const t = d.TextDetection;
        if (t?.Type !== 'LINE' || !t.DetectedText) continue;
        const norm = t.DetectedText.trim();
        // Dedupe: the same on-screen text repeats across consecutive frames.
        const dedupeKey = norm.toLowerCase();
        if (norm && !seen.has(dedupeKey)) {
          seen.add(dedupeKey);
          lines.push(norm);
        }
      }
      return { lines, frameCount: timestamps.size };
    }
    await sleep(POLL_INTERVAL_MS);
  }
  throw new Error('Rekognition text detection timed out');
}

async function pollLabelDetection(jobId: string): Promise<{ labels: string[] }> {
  for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS; attempt++) {
    const res = await client.send(new GetLabelDetectionCommand({ JobId: jobId, MaxResults: 1000 }));

    if (res.JobStatus === 'FAILED') {
      throw new Error(`Rekognition label detection failed: ${res.StatusMessage ?? 'unknown'}`);
    }
    if (res.JobStatus === 'SUCCEEDED') {
      const names = new Set<string>();
      for (const l of res.Labels ?? []) {
        const name = l.Label?.Name;
        if (name) names.add(name);
      }
      return { labels: Array.from(names).slice(0, 30) };
    }
    await sleep(POLL_INTERVAL_MS);
  }
  throw new Error('Rekognition label detection timed out');
}
