import { badRequest, Handler, json, ok, serverError } from '../lib/http';
import { analyzeTextEvidence } from '../lib/openai';

/**
 * POST /analyze/text
 * Body: { text, source?: 'voice' | 'text', today?: 'YYYY-MM-DD', language?: 'en'|'zh'|'ms'|'ta' }
 *
 * gpt-4o analysis of a transcript (voice flow, after the user edits it) or of
 * text the user typed or pasted (message / email / advertisement).
 */
export const handler: Handler = async (req) => {
  try {
    const { text, source, today, language } = json<{
      text?: string;
      source?: string;
      today?: string;
      language?: string;
    }>(req);
    if (!text?.trim()) return badRequest('Missing "text"');

    const kind = source === 'text' ? 'text' : 'voice';
    return ok(await analyzeTextEvidence(text, kind, today, language));
  } catch (err) {
    return serverError(err);
  }
};
