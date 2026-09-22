import type { APIGatewayProxyHandler } from 'aws-lambda';
import { analyzeWithBedrock } from '../lib/bedrock';
import { badRequest, ok, parseBody, serverError } from '../lib/http';
import { analyzeVideoWithRekognition } from '../lib/rekognitionVideo';
import { MEDIA_BUCKET } from '../lib/s3';

/**
 * POST /analyze/video
 * Body: { key: string }
 *
 * Pipeline: Rekognition Video (StartTextDetection + StartLabelDetection,
 * polled to completion) aggregates on-screen text and labels across sampled
 * frames, then Bedrock reasons over that evidence to produce the verdict.
 */
export const handler: APIGatewayProxyHandler = async (event) => {
  try {
    const { key } = parseBody<{ key?: string }>(event);
    if (!key) return badRequest('Missing "key" (upload the video first via /upload-url)');
    if (!MEDIA_BUCKET) return serverError(new Error('MEDIA_BUCKET not configured'));

    const signals = await analyzeVideoWithRekognition({ bucket: MEDIA_BUCKET, key });
    const result = await analyzeWithBedrock(signals);

    return ok(result);
  } catch (err) {
    return serverError(err);
  }
};
