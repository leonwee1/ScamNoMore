import { badRequest, Handler, json, ok, serverError } from '../lib/http';
import { analyzeTextEvidence } from '../lib/openai';

/**
 * POST /analyze/text
 * Body: { text: string, source?: 'voice' | 'text' }
 *
 * gpt-4o analysis of a transcript (voice flow, after the user edits it) or of
 * text the user typed or pasted (message / email / advertisement).
 */
export const handler: Handler = async (req) => {
  try {
    const { text, source } = json<{ text?: string; source?: string }>(req);
    if (!text?.trim()) return badRequest('Missing "text"');

    const kind = source === 'text' ? 'text' : 'voice';
    return ok(await analyzeTextEvidence(text, kind));
  } catch (err) {
    return serverError(err);
  }
};
