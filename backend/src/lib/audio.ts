import { spawn } from 'child_process';
import { mkdtemp, readFile, rm, stat, writeFile } from 'fs/promises';
import { tmpdir } from 'os';
import { join } from 'path';
import ffmpegPath from 'ffmpeg-static';

/**
 * Audio extraction for the transcription flows.
 *
 * WHY THIS EXISTS
 * OpenAI's transcription endpoint rejects any upload over 25 MB. That cap is on
 * BYTES, not duration — there is no length limit — so the way to support a large
 * video is not to raise a number, it is to stop sending the parts Whisper throws
 * away. A 33 MB phone video is almost entirely video frames; its speech is a
 * couple of MB at most.
 *
 * So before transcribing we re-encode to the smallest format that preserves
 * speech intelligibility: 16 kHz mono MP3 at 32 kbit/s. Whisper downsamples to
 * 16 kHz mono internally anyway, so this discards nothing it would have used.
 * That works out to roughly 240 KB per minute, meaning ~100 minutes of speech
 * fits inside the 25 MB ceiling regardless of the source file's size.
 */

/** OpenAI's hard per-file limit on the transcription endpoint. */
export const WHISPER_MAX_BYTES = 25 * 1024 * 1024;

/**
 * What we accept from the app. Only the EXTRACTED audio has to satisfy
 * WHISPER_MAX_BYTES, so this can be far larger.
 *
 * Bounded by MEMORY, not by OpenAI. The server buffers the whole request body
 * before writing it to a temp file, and Buffer.concat briefly holds a second
 * copy, so peak usage is roughly twice the upload size. Render's free tier has
 * 512 MB, so 64 MB peaks near 128 MB and leaves comfortable headroom. Raising
 * this much further would require streaming the body straight to disk.
 */
export const MAX_UPLOAD_BYTES = 64 * 1024 * 1024;

/** Speech-optimised output settings. */
const SAMPLE_RATE = 16_000;
const BITRATE = '32k';

/**
 * Mean loudness below which we treat a track as having no speech.
 *
 * Whisper does not return "nothing here" for silence — it invents fluent,
 * confident text drawn from its training data (YouTube sign-offs, travel
 * narration) and will happily repeat it. So silence has to be caught BEFORE
 * transcription.
 *
 * For scale: ordinary speech in a phone recording averages -20 to -35 dB. A
 * measured real-world failure case came in at -51 dB mean / -33 dB peak and
 * produced pure hallucination even after being amplified by 35 dB. -45 dB sits
 * clearly below any genuine speech while still catching these.
 */
const SILENCE_MEAN_DB = Number(process.env.SILENCE_MEAN_DB ?? -45);

/** Give up rather than pinning a free-tier instance indefinitely. */
const FFMPEG_TIMEOUT_MS = 120_000;

export interface ExtractedAudio {
  bytes: Buffer;
  filename: string;
  mimeType: string;
  /** Size of the original upload, for logging. */
  originalBytes: number;
  /** Mean loudness in dB, or undefined if ffmpeg did not report it. */
  meanVolumeDb?: number;
  /** Peak loudness in dB, or undefined if ffmpeg did not report it. */
  maxVolumeDb?: number;
  /**
   * True when the track is too quiet to contain speech. Callers should skip
   * transcription entirely rather than let Whisper hallucinate.
   */
  silent: boolean;
}

/** Parse ffmpeg's volumedetect output. */
export function parseVolume(stderr: string): { mean?: number; max?: number } {
  const mean = /mean_volume:\s*(-?[\d.]+) dB/.exec(stderr);
  const max = /max_volume:\s*(-?[\d.]+) dB/.exec(stderr);
  return {
    mean: mean ? Number(mean[1]) : undefined,
    max: max ? Number(max[1]) : undefined,
  };
}

/** Whether a measured mean loudness indicates there is no speech present. */
export function isSilentLevel(meanDb: number | undefined): boolean {
  // Unknown loudness must NOT be treated as silence, or a parsing change would
  // silently disable transcription.
  return meanDb !== undefined && meanDb < SILENCE_MEAN_DB;
}

/** Thrown when the input carries no audio track at all (e.g. a silent video). */
export class NoAudioTrackError extends Error {
  constructor() {
    super('The file contains no audio track.');
    this.name = 'NoAudioTrackError';
  }
}

function ffmpegBinary(): string {
  // ffmpeg-static resolves to a platform-specific binary at install time.
  if (!ffmpegPath) {
    throw new Error(
      'ffmpeg binary not found. Reinstall backend dependencies (npm install) so ' +
        'ffmpeg-static can download it.'
    );
  }
  return ffmpegPath;
}

/**
 * Run ffmpeg with the given arguments.
 *
 * Uses spawn with an ARGUMENT ARRAY (never a shell string), so file paths cannot
 * be interpreted as shell syntax.
 */
function runFfmpeg(args: string[]): Promise<{ code: number | null; stderr: string }> {
  return new Promise((resolve, reject) => {
    const child = spawn(ffmpegBinary(), args, { stdio: ['ignore', 'ignore', 'pipe'] });

    let stderr = '';
    child.stderr.on('data', (chunk: Buffer) => {
      // Keep the tail only; ffmpeg is extremely chatty.
      stderr = (stderr + chunk.toString()).slice(-4000);
    });

    const timer = setTimeout(() => {
      child.kill('SIGKILL');
      reject(new Error(`Audio extraction timed out after ${FFMPEG_TIMEOUT_MS / 1000}s.`));
    }, FFMPEG_TIMEOUT_MS);

    child.on('error', (err) => {
      clearTimeout(timer);
      reject(err);
    });
    child.on('close', (code) => {
      clearTimeout(timer);
      resolve({ code, stderr });
    });
  });
}

/** ffmpeg's way of saying the container had no audio stream. */
function meansNoAudio(stderr: string): boolean {
  return (
    /does not contain any stream/i.test(stderr) ||
    /Output file (#0 )?does not contain any stream/i.test(stderr) ||
    /Stream map .* matches no streams/i.test(stderr)
  );
}

/**
 * Re-encode an upload down to a compact speech-only track.
 *
 * @param input      Raw uploaded bytes (audio or video container).
 * @param inputExt   Extension hinting the container format, e.g. "mp4".
 * @throws NoAudioTrackError when the file has no audio stream.
 */
export async function extractAudioForTranscription(
  input: Buffer,
  inputExt: string
): Promise<ExtractedAudio> {
  const dir = await mkdtemp(join(tmpdir(), 'scamnomore-'));
  // Fixed names inside a private temp dir: no user-controlled path segments.
  const inPath = join(dir, `input.${inputExt.replace(/[^a-z0-9]/gi, '') || 'bin'}`);
  const outPath = join(dir, 'audio.mp3');

  try {
    await writeFile(inPath, input);

    const { code, stderr } = await runFfmpeg([
      '-hide_banner',
      '-nostdin',
      // volumedetect writes its summary at "info" level.
      '-loglevel', 'info',
      '-i', inPath,
      '-vn', // drop video — this is the whole point
      '-ac', '1', // mono
      '-ar', String(SAMPLE_RATE),
      // Measures loudness while passing audio through, so the silence check
      // costs nothing extra: same single pass that does the encoding.
      '-af', 'volumedetect',
      '-c:a', 'libmp3lame',
      '-b:a', BITRATE,
      '-y',
      outPath,
    ]);

    if (code !== 0) {
      if (meansNoAudio(stderr)) throw new NoAudioTrackError();
      throw new Error(
        `Could not read the audio from this file (ffmpeg exit ${code}). ` +
          'Please try a different format such as MP4 or M4A.'
      );
    }

    const { size } = await stat(outPath);
    if (size === 0) throw new NoAudioTrackError();

    const { mean, max } = parseVolume(stderr);
    const bytes = await readFile(outPath);
    return {
      bytes,
      filename: 'audio.mp3',
      mimeType: 'audio/mpeg',
      originalBytes: input.byteLength,
      meanVolumeDb: mean,
      maxVolumeDb: max,
      silent: isSilentLevel(mean),
    };
  } finally {
    // Render's filesystem is ephemeral, but a long-lived instance would still
    // accumulate these, so always clean up.
    await rm(dir, { recursive: true, force: true }).catch(() => undefined);
  }
}
