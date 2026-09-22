import type { APIGatewayProxyHandler } from 'aws-lambda';
import { analyzeImageWithBedrockVision } from '../lib/bedrock';
import { badRequest, ok, parseBody, serverError } from '../lib/http';
import { analyzeImageWithRekognition } from '../lib/rekognition';
import { bedrockImageFormat, getObjectBytes, MEDIA_BUCKET } from '../lib/s3';

/**
 * POST /analyze/image
 * Body: { key: string }   (S3 key from POST /upload-url)
 *
 * Pipeline: Rekognition (DetectText + DetectLabels + Moderation) extracts
 * evidence, then Bedrock reasons over BOTH that evidence and the actual image
 * pixels (multimodal) to produce the scam verdict.
 */
export const handler: APIGatewayProxyHandler = async (event) => {
  try {
    const { key } = parseBody<{ key?: string }>(event);
    if (!key) return badRequest('Missing "key" (upload the image first via /upload-url)');
    if (!MEDIA_BUCKET) return serverError(new Error('MEDIA_BUCKET not configured'));

    // 1. Rekognition: OCR + labels + moderation flags.
    const signals = await analyzeImageWithRekognition({ bucket: MEDIA_BUCKET, key });

    // 2. Bedrock (vision + evidence) -> calibrated verdict with reasoning.
    const imageBytes = await getObjectBytes(MEDIA_BUCKET, key);
    const result = await analyzeImageWithBedrockVision(
      imageBytes,
      bedrockImageFormat(key),
      signals
    );

    return ok(result);
  } catch (err) {
    return serverError(err);
  }
};
