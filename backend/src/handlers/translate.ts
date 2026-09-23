import { badRequest, Handler, json, ok, serverError } from '../lib/http';
import { translateTexts } from '../lib/openai';

/** Guard against a client asking for an unbounded translation job. */
const MAX_TEXTS = 20;
const MAX_TOTAL_CHARS = 8000;

/**
 * POST /translate
 * Body: { language: 'en'|'zh'|'ms'|'ta', texts: string[] }
 * Returns: { texts: string[] }  — same length and order as the input.
 *
 * Re-expresses text the model already produced in a different language. Used
 * when the user switches language after an analysis has finished: the verdict
 * stays exactly as it was, only its wording changes. Re-running the analysis
 * instead could yield a different probability, which would look like the app
 * changing its mind.
 */
export const handler: Handler = async (req) => {
  try {
    const { language, texts } = json<{ language?: string; texts?: unknown }>(req);

    if (!language?.trim()) return badRequest('Missing "language"');
    if (!Array.isArray(texts) || !texts.every((t) => typeof t === 'string')) {
      return badRequest('"texts" must be an array of strings');
    }
    if (texts.length > MAX_TEXTS) {
      return badRequest(`Too many strings (max ${MAX_TEXTS})`);
    }
    const total = texts.reduce((n, t) => n + t.length, 0);
    if (total > MAX_TOTAL_CHARS) {
      return badRequest(`Text too long (${total} chars, max ${MAX_TOTAL_CHARS})`);
    }

    return ok({ texts: await translateTexts(texts as string[], language) });
  } catch (err) {
    return serverError(err);
  }
};
