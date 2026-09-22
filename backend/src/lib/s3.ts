import {
  GetObjectCommand,
  HeadObjectCommand,
  PutObjectCommand,
  S3Client,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { randomUUID } from 'crypto';

/**
 * S3 helpers. Media never transits the Lambda: the app PUTs directly to S3 via
 * a presigned URL, then passes the object key to the analysis endpoints. This
 * keeps payloads small and avoids API Gateway's 10 MB limit.
 */
const REGION = process.env.AWS_REGION ?? 'ap-southeast-1';
export const MEDIA_BUCKET = process.env.MEDIA_BUCKET ?? '';

const client = new S3Client({ region: REGION });

export type MediaKind = 'image' | 'audio' | 'video';

const EXT_BY_CONTENT_TYPE: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/jpg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/heic': 'heic',
  'audio/m4a': 'm4a',
  'audio/mp4': 'm4a',
  'audio/mpeg': 'mp3',
  'audio/wav': 'wav',
  'audio/x-wav': 'wav',
  'audio/webm': 'webm',
  'video/mp4': 'mp4',
  'video/quicktime': 'mov',
};

/** Create a presigned PUT URL the app can upload to directly. */
export async function createUploadUrl(
  kind: MediaKind,
  contentType: string
): Promise<{ uploadUrl: string; key: string; bucket: string }> {
  if (!MEDIA_BUCKET) throw new Error('MEDIA_BUCKET env var is not configured');

  const ext = EXT_BY_CONTENT_TYPE[contentType.toLowerCase()] ?? 'bin';
  const key = `uploads/${kind}/${randomUUID()}.${ext}`;

  const uploadUrl = await getSignedUrl(
    client,
    new PutObjectCommand({ Bucket: MEDIA_BUCKET, Key: key, ContentType: contentType }),
    { expiresIn: 900 } // 15 minutes
  );

  return { uploadUrl, key, bucket: MEDIA_BUCKET };
}

/** Read an object as a UTF-8 string (used for Transcribe output JSON). */
export async function getObjectText(bucket: string, key: string): Promise<string> {
  const res = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
  const body = res.Body;
  if (!body) throw new Error(`Empty S3 object: s3://${bucket}/${key}`);
  // Node.js stream -> string
  return await (body as unknown as { transformToString: () => Promise<string> }).transformToString();
}

/** Read an object as raw bytes (used for Bedrock multimodal image input). */
export async function getObjectBytes(bucket: string, key: string): Promise<Uint8Array> {
  const res = await client.send(new GetObjectCommand({ Bucket: bucket, Key: key }));
  const body = res.Body;
  if (!body) throw new Error(`Empty S3 object: s3://${bucket}/${key}`);
  return await (body as unknown as { transformToByteArray: () => Promise<Uint8Array> }).transformToByteArray();
}

/** Confirm an uploaded object exists and return its size/content type. */
export async function headObject(
  bucket: string,
  key: string
): Promise<{ contentType?: string; contentLength?: number }> {
  const res = await client.send(new HeadObjectCommand({ Bucket: bucket, Key: key }));
  return { contentType: res.ContentType, contentLength: res.ContentLength };
}

/** Map a stored key/content type to the image format Bedrock expects. */
export function bedrockImageFormat(key: string): 'jpeg' | 'png' | 'webp' | 'gif' {
  const lower = key.toLowerCase();
  if (lower.endsWith('.png')) return 'png';
  if (lower.endsWith('.webp')) return 'webp';
  if (lower.endsWith('.gif')) return 'gif';
  return 'jpeg';
}
