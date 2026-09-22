import type { APIGatewayProxyHandler } from 'aws-lambda';
import { badRequest, ok, parseBody, serverError } from '../lib/http';
import { getObjectText, MEDIA_BUCKET } from '../lib/s3';
import { LANGUAGE_MAP, parseTranscriptJson, runTranscriptionJob } from '../lib/transcribe';

/**
 * POST /transcribe
 * Body: { key: string, lang?: 'en'|'zh'|'ms'|'ta' }
 * Returns: { text: string }
 *
 * Amazon Transcribe converts the recording to text. The app then shows the
 * transcript for the user to edit before sending it to /analyze/text (Bedrock).
 */
export const handler: APIGatewayProxyHandler = async (event) => {
  try {
    const { key, lang } = parseBody<{ key?: string; lang?: string }>(event);
    if (!key) return badRequest('Missing "key" (upload the audio first via /upload-url)');
    if (!MEDIA_BUCKET) return serverError(new Error('MEDIA_BUCKET not configured'));

    const outputKey = await runTranscriptionJob({
      bucket: MEDIA_BUCKET,
      key,
      languageCode: lang ? LANGUAGE_MAP[lang] : undefined,
    });

    const body = await getObjectText(MEDIA_BUCKET, outputKey);
    const text = parseTranscriptJson(body);

    return ok({ text });
  } catch (err) {
    return serverError(err);
  }
};
