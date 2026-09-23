import { extractAudioForTranscription, NoAudioTrackError } from '../lib/audio';
import { badRequest, extensionFor, Handler, mimeOf, ok, serverError } from '../lib/http';
import { analyzeTextEvidence, noSpeechResult, transcribeMedia } from '../lib/openai';

/**
 * POST /analyze/video
 * Body: raw video bytes, Content-Type: video/mp4 | video/quicktime | video/webm
 * Query: ?today=YYYY-MM-DD  ?language=en|zh|ms|ta
 *
 * Whisper transcribes the video's AUDIO TRACK, then gpt-4o analyses the
 * transcript for scam indicators. Most scam videos — fake testimonials,
 * investment pitches, voice-overs — carry their message in speech, so this
 * captures the substance.
 *
 * The audio is stripped out with ffmpeg first rather than posting the whole
 * video. Whisper would discard the frames anyway, and they are what pushes a
 * phone recording past OpenAI's 25 MB cap.
 */
export const handler: Handler = async (req) => {
  try {
    if (!req.raw.byteLength) return badRequest('Empty video body');

    const mime = mimeOf(req.contentType, 'video/mp4');
    if (!mime.startsWith('video/')) {
      return badRequest(`Expected a video Content-Type, got "${mime}"`);
    }

    const audio = await extractAudioForTranscription(req.raw, extensionFor(mime, 'mp4'));
    console.log(
      `/analyze/video compressed ${(audio.originalBytes / 1024 / 1024).toFixed(1)} MB -> ` +
        `${(audio.bytes.byteLength / 1024 / 1024).toFixed(2)} MB, ` +
        `mean ${audio.meanVolumeDb ?? '?'} dB${audio.silent ? ' (SILENT)' : ''}`
    );

    // Skip Whisper on a silent track. Asked to transcribe silence it does not
    // return nothing — it invents confident text — so this must be caught here.
    if (audio.silent) return ok(noSpeechResult('video'));

    const transcript = await transcribeMedia(
      audio.bytes,
      audio.filename,
      audio.mimeType,
      req.query?.language
    );

    // A silent video yields nothing to analyse — say so rather than guessing.
    if (!transcript) return ok(noSpeechResult('video'));

    return ok(
      await analyzeTextEvidence(transcript, 'video', req.query?.today, req.query?.language)
    );
  } catch (err) {
    // A video with no audio stream at all is the same user-facing outcome as a
    // silent one, so report it that way instead of as a server error.
    if (err instanceof NoAudioTrackError) return ok(noSpeechResult('video'));
    return serverError(err);
  }
};
