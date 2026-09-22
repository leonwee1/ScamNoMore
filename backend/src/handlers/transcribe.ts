import { badRequest, filenameFor, Handler, mimeOf, ok, serverError } from '../lib/http';
import { transcribeMedia } from '../lib/openai';

/**
 * POST /transcribe
 * Body: raw audio bytes, Content-Type: audio/m4a | audio/mpeg | audio/wav | ...
 * Returns: { text }
 *
 * Whisper converts speech to text. The app shows the transcript for the user to
 * edit, then sends it to /analyze/text.
 */
export const handler: Handler = async (req) => {
  try {
    if (!req.raw.byteLength) return badRequest('Empty audio body');

    const mime = mimeOf(req.contentType, 'audio/m4a');
    if (!mime.startsWith('audio/') && !mime.startsWith('video/')) {
      return badRequest(`Expected an audio Content-Type, got "${mime}"`);
    }

    const text = await transcribeMedia(req.raw, filenameFor(mime, 'm4a'), mime);
    return ok({ text });
  } catch (err) {
    return serverError(err);
  }
};
