import { badRequest, Handler, json, ok, serverError } from '../lib/http';
import { chat, ChatTurn } from '../lib/openai';

/**
 * POST /chat
 * Body: { message, history?: [{ role, content }], today?: 'YYYY-MM-DD',
 *         language?: 'en'|'zh'|'ms'|'ta' }
 * Returns: { reply: string }
 *
 * `today` is the device's calendar date. The model has no clock, so without it
 * it judges dates against its training cutoff and calls past dates "future".
 *
 * gpt-4o chatbot: answers scam questions and gives awareness tips, with
 * conversation history so follow-up questions keep their context.
 */
export const handler: Handler = async (req) => {
  try {
    const { message, history, today, language } = json<{
      message?: string;
      history?: ChatTurn[];
      today?: string;
      language?: string;
    }>(req);
    if (!message?.trim()) return badRequest('Missing "message"');

    const reply = await chat(message, history ?? [], today, language);
    return ok({ reply });
  } catch (err) {
    return serverError(err);
  }
};
