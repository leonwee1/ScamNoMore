import {
  DetectLabelsCommand,
  DetectModerationLabelsCommand,
  DetectTextCommand,
  RekognitionClient,
} from '@aws-sdk/client-rekognition';
import { AnalysisSignals } from './types';

/**
 * Amazon Rekognition (image) evidence extraction.
 *
 * We run three detectors in parallel and hand the combined evidence to Bedrock:
 *  - DetectText            -> OCR of the message/email/QR caption (the key signal)
 *  - DetectLabels          -> objects/scenes, incl. QR code and screenshot hints
 *  - DetectModerationLabels-> unsafe content flags
 */
const REGION = process.env.AWS_REGION ?? 'ap-southeast-1';
const client = new RekognitionClient({ region: REGION });

/** Labels that indicate a QR / barcode is present in the image. */
const QR_LABEL_HINTS = ['qr code', 'qr', 'barcode', 'bar code'];
/** Labels that suggest we're looking at a screen capture rather than a photo. */
const SCREENSHOT_HINTS = [
  'text',
  'page',
  'screenshot',
  'website',
  'web page',
  'computer',
  'mobile phone',
  'phone',
  'electronics',
  'screen',
  'monitor',
  'software',
  'menu',
  'document',
  'letter',
];

export interface ImageRef {
  bucket: string;
  key: string;
}

export async function analyzeImageWithRekognition(ref: ImageRef): Promise<AnalysisSignals> {
  const S3Object = { Bucket: ref.bucket, Name: ref.key };

  const [textRes, labelRes, modRes] = await Promise.all([
    client.send(new DetectTextCommand({ Image: { S3Object } })),
    client.send(new DetectLabelsCommand({ Image: { S3Object }, MaxLabels: 25, MinConfidence: 70 })),
    // Moderation can fail on some image types; treat as optional evidence.
    client
      .send(new DetectModerationLabelsCommand({ Image: { S3Object }, MinConfidence: 60 }))
      .catch(() => ({ ModerationLabels: [] })),
  ]);

  // Prefer LINE detections and preserve reading order for coherent OCR text.
  const ocrText = (textRes.TextDetections ?? [])
    .filter((d) => d.Type === 'LINE' && d.DetectedText)
    .map((d) => d.DetectedText as string)
    .join('\n');

  const labels = (labelRes.Labels ?? [])
    .map((l) => l.Name)
    .filter((n): n is string => Boolean(n));

  const moderationLabels = (modRes.ModerationLabels ?? [])
    .map((l) => l.Name)
    .filter((n): n is string => Boolean(n));

  const lowerLabels = labels.map((l) => l.toLowerCase());

  return {
    source: 'rekognition-image',
    ocrText,
    labels,
    moderationLabels,
    hasQrCode: lowerLabels.some((l) => QR_LABEL_HINTS.includes(l)),
    isScreenshot: detectScreenshot(lowerLabels, ocrText),
  };
}

/**
 * Heuristic: Rekognition has no explicit "screenshot" label, so infer it from
 * screen-related labels plus a decent amount of OCR text.
 */
export function detectScreenshot(lowerLabels: string[], ocrText: string): boolean {
  const screenish = lowerLabels.filter((l) => SCREENSHOT_HINTS.includes(l)).length;
  const textHeavy = ocrText.replace(/\s/g, '').length > 40;
  return screenish >= 2 && textHeavy;
}
