import { extractAudioForTranscription, NoAudioTrackError } from '../lib/audio';
import { badRequest, extensionFor, Handler, mimeOf, ok, serverError } from '../lib/http';
import { transcribeMedia } from '../lib/openai';

/**
 * POST /transcribe
 * Body: raw audio bytes, Content-Type: audio/m4a | audio/mpeg | audio/wav | ...
 * Query: ?language=en|zh|ms|ta (optional; falls back to auto-detect)
 * Returns: { text }
 *
 * Whisper converts speech to text. The app shows the transcript for the user to
 * edit, then sends it to /analyze/text.
 *
 * The upload is compressed to 16 kHz mono MP3 first, so files far larger than
 * OpenAI's 25 MB transcription cap are accepted.
 */
export const handler: Handler = async (req) => {
  try {
    if (!req.raw.byteLength) return badRequest('Empty audio body');

    const mime = mimeOf(req.contentType, 'audio/m4a');
    if (!mime.startsWith('audio/') && !mime.startsWith('video/')) {
      return badRequest(`Expected an audio Content-Type, got "${mime}"`);
    }

    const audio = await extractAudioForTranscription(req.raw, extensionFor(mime, 'm4a'));
    console.log(
      `/transcribe compressed ${(audio.originalBytes / 1024 / 1024).toFixed(1)} MB -> ` +
        `${(audio.bytes.byteLength / 1024 / 1024).toFixed(2)} MB, ` +
        `mean ${audio.meanVolumeDb ?? '?'} dB${audio.silent ? ' (SILENT)' : ''}`
    );

    // A silent track makes Whisper hallucinate fluent text, so don't ask it.
    if (audio.silent) return ok({ text: '', noSpeechDetected: true });

    // ?language=en|zh|ms|ta — the app's selected UI language. Without it
    // Whisper auto-detects and can return Malay for spoken English.
    const text = await transcribeMedia(
      audio.bytes,
      audio.filename,
      audio.mimeType,
      req.query?.language
    );
    return ok({ text, noSpeechDetected: text.trim() === '' });
  } catch (err) {
    // A silent recording is a normal outcome, not a server fault.
    if (err instanceof NoAudioTrackError) return ok({ text: '', noSpeechDetected: true });
    return serverError(err);
  }
};
