/**
 * Minimal HTTP abstraction shared by the handlers.
 *
 * Media is POSTed as a RAW BINARY body with the file's Content-Type. That avoids
 * multipart parsing, base64 inflation, and any object storage — the simplest
 * possible path from the phone to OpenAI.
 */
export interface Req {
  /** Raw request body bytes (binary media, or UTF-8 JSON). */
  raw: Buffer;
  /** Request Content-Type header. */
  contentType: string;
  /**
   * Parsed query-string parameters. Media endpoints send the file as the whole
   * body, so options such as `?language=en` travel in the query rather than a
   * JSON field.
   */
  query?: Record<string, string>;
}

export interface Res {
  statusCode: number;
  body: unknown;
  /** Optional response headers for an individual endpoint. */
  headers?: Record<string, string>;
}

export const ok = (body: unknown): Res => ({ statusCode: 200, body });
export const created = (body: unknown): Res => ({ statusCode: 201, body });
export const badRequest = (message: string): Res => ({ statusCode: 400, body: { message } });

export function serverError(err: unknown): Res {
  // Errors from transcription/model APIs can include user-supplied text. Keep
  // Render diagnostics useful without placing media-derived content in logs.
  const kind = err instanceof Error ? err.name : typeof err;
  console.error(`Handler failed (${kind})`);
  return {
    statusCode: 500,
    body: { message: 'The server could not process this request. Please try again.' },
  };
}

/** Parse a JSON body. */
export function json<T>(req: Req): T {
  const text = req.raw.toString('utf8');
  if (!text.trim()) return {} as T;
  return JSON.parse(text) as T;
}

/** A handler is just an async function from Req to Res. */
export type Handler = (req: Req) => Promise<Res>;

const EXT_BY_MIME: Record<string, string> = {
  'image/jpeg': 'jpg',
  'image/png': 'png',
  'image/webp': 'webp',
  'image/heic': 'heic',
  'audio/m4a': 'm4a',
  'audio/mp4': 'm4a',
  'audio/x-m4a': 'm4a',
  'audio/mpeg': 'mp3',
  'audio/wav': 'wav',
  'audio/x-wav': 'wav',
  'audio/webm': 'webm',
  'video/mp4': 'mp4',
  'video/quicktime': 'mov',
  'video/webm': 'webm',
};

/**
 * Map a Content-Type to a file extension. ffmpeg and Whisper both infer the
 * container format from the extension, so this needs to be right.
 */
export function extensionFor(contentType: string, fallbackExt: string): string {
  const mime = contentType.split(';')[0].trim().toLowerCase();
  return EXT_BY_MIME[mime] ?? fallbackExt;
}

/**
 * Whisper picks its decoder from the filename extension, so derive a sensible
 * one from the Content-Type the app sent.
 */
export function filenameFor(contentType: string, fallbackExt: string): string {
  return `upload.${extensionFor(contentType, fallbackExt)}`;
}

/** Normalise a Content-Type header down to its MIME type. */
export function mimeOf(contentType: string, fallback: string): string {
  const mime = contentType.split(';')[0].trim().toLowerCase();
  return mime || fallback;
}
