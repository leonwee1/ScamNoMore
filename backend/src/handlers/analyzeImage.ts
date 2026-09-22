import { badRequest, Handler, mimeOf, ok, serverError } from '../lib/http';
import { analyzeImage } from '../lib/openai';

/**
 * POST /analyze/image
 * Body: raw image bytes, Content-Type: image/jpeg | image/png | image/webp
 *
 * gpt-4o vision reads all text in the image AND judges visual scam cues, so no
 * separate OCR service is needed.
 */
export const handler: Handler = async (req) => {
  try {
    if (!req.raw.byteLength) return badRequest('Empty image body');

    const mime = mimeOf(req.contentType, 'image/jpeg');
    if (!mime.startsWith('image/')) {
      return badRequest(`Expected an image Content-Type, got "${mime}"`);
    }

    return ok(await analyzeImage(req.raw, mime));
  } catch (err) {
    return serverError(err);
  }
};
