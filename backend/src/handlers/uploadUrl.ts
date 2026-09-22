import type { APIGatewayProxyHandler } from 'aws-lambda';
import { badRequest, ok, parseBody, serverError } from '../lib/http';
import { createUploadUrl, type MediaKind } from '../lib/s3';

/**
 * POST /upload-url
 * Body: { kind: 'image'|'audio'|'video', contentType: string }
 * Returns: { uploadUrl, key, bucket }
 *
 * The app PUTs the file straight to S3 with this presigned URL, so media never
 * passes through API Gateway (avoiding its 10 MB payload limit) and no AWS
 * credentials are needed on the device.
 */
const VALID: MediaKind[] = ['image', 'audio', 'video'];

export const handler: APIGatewayProxyHandler = async (event) => {
  try {
    const { kind, contentType } = parseBody<{ kind?: string; contentType?: string }>(event);

    if (!kind || !VALID.includes(kind as MediaKind)) {
      return badRequest(`"kind" must be one of: ${VALID.join(', ')}`);
    }
    if (!contentType) return badRequest('Missing "contentType"');

    const result = await createUploadUrl(kind as MediaKind, contentType);
    return ok(result);
  } catch (err) {
    return serverError(err);
  }
};
