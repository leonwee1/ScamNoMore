import { badRequest, filenameFor, Handler, mimeOf, ok, serverError } from '../lib/http';
import { analyzeTextEvidence, noSpeechResult, transcribeMedia } from '../lib/openai';

/**
 * POST /analyze/video
 * Body: raw video bytes, Content-Type: video/mp4 | video/quicktime | video/webm
 *
 * Whisper transcribes the video's AUDIO TRACK (no frame extraction required),
 * then gpt-4o analyses the transcript for scam indicators. Most scam videos —
 * fake testimonials, investment pitches, voice-overs — carry their message in
 * speech, so this captures the substance.
 */
export const handler: Handler = async (req) => {
  try {
    if (!req.raw.byteLength) return badRequest('Empty video body');

    const mime = mimeOf(req.contentType, 'video/mp4');
    if (!mime.startsWith('video/')) {
      return badRequest(`Expected a video Content-Type, got "${mime}"`);
    }

    const transcript = await transcribeMedia(req.raw, filenameFor(mime, 'mp4'), mime);

    // A silent video yields nothing to analyse — say so rather than guessing.
    if (!transcript) return ok(noSpeechResult('video'));

    return ok(await analyzeTextEvidence(transcript, 'video'));
  } catch (err) {
    return serverError(err);
  }
};
