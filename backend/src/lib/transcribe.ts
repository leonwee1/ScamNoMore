import {
  GetTranscriptionJobCommand,
  StartTranscriptionJobCommand,
  TranscribeClient,
  type LanguageCode,
} from '@aws-sdk/client-transcribe';
import { randomUUID } from 'crypto';

/**
 * Amazon Transcribe: speech-to-text for the voice flow.
 *
 * Transcribe is asynchronous — start a job against the S3 object, poll until it
 * completes, then fetch and parse the transcript JSON from the output location.
 */
const REGION = process.env.AWS_REGION ?? 'ap-southeast-1';
const client = new TranscribeClient({ region: REGION });

const POLL_INTERVAL_MS = Number(process.env.TRANSCRIBE_POLL_MS ?? 3000);
const MAX_POLL_ATTEMPTS = Number(process.env.TRANSCRIBE_MAX_POLLS ?? 60); // ~3 min

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export interface TranscribeInput {
  bucket: string;
  key: string;
  /**
   * Language of the recording. Singapore users may speak English, Mandarin,
   * Malay or Tamil, so callers can pass the UI language; we default to
   * multi-language identification when unspecified.
   */
  languageCode?: LanguageCode;
}

/** Map the app's 4 UI languages to Transcribe language codes. */
export const LANGUAGE_MAP: Record<string, LanguageCode> = {
  en: 'en-SG' as LanguageCode,
  zh: 'zh-CN' as LanguageCode,
  ms: 'ms-MY' as LanguageCode,
  ta: 'ta-IN' as LanguageCode,
};

/**
 * Extract the transcript text from a Transcribe output JSON document.
 * Shape: { results: { transcripts: [{ transcript: "..." }] } }
 */
export function parseTranscriptJson(body: string): string {
  const doc = JSON.parse(body) as {
    results?: { transcripts?: Array<{ transcript?: string }> };
  };
  const text = (doc.results?.transcripts ?? [])
    .map((t) => t.transcript ?? '')
    .join(' ')
    .trim();
  return text;
}

/** Full flow: start + poll the job, returning the S3 key of the transcript. */
export async function runTranscriptionJob(input: TranscribeInput): Promise<string> {
  const jobName = `scamnomore-${randomUUID()}`;
  const outputKey = `transcripts/${jobName}.json`;
  const mediaUri = `s3://${input.bucket}/${input.key}`;

  await client.send(
    new StartTranscriptionJobCommand({
      TranscriptionJobName: jobName,
      Media: { MediaFileUri: mediaUri },
      OutputBucketName: input.bucket,
      OutputKey: outputKey,
      ...(input.languageCode
        ? { LanguageCode: input.languageCode }
        : {
            IdentifyLanguage: true,
            LanguageOptions: ['en-SG', 'zh-CN', 'ms-MY', 'ta-IN'] as LanguageCode[],
          }),
    })
  );

  for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS; attempt++) {
    const res = await client.send(
      new GetTranscriptionJobCommand({ TranscriptionJobName: jobName })
    );
    const status = res.TranscriptionJob?.TranscriptionJobStatus;

    if (status === 'FAILED') {
      throw new Error(
        `Transcription failed: ${res.TranscriptionJob?.FailureReason ?? 'unknown'}`
      );
    }
    if (status === 'COMPLETED') return outputKey;
    await sleep(POLL_INTERVAL_MS);
  }
  throw new Error('Transcription timed out');
}
