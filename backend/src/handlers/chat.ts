import { badRequest, Handler, json, ok, serverError } from '../lib/http';
import { chat, ChatTurn } from '../lib/openai';

/**
 * POST /chat
 * Body: { message: string, history?: [{ role, content }] }
 * Returns: { reply: string }
 *
 * gpt-4o chatbot: answers scam questions and gives awareness tips, with
 * conversation history so follow-up questions keep their context.
 */
export const handler: Handler = async (req) => {
  try {
    const { message, history } = json<{ message?: string; history?: ChatTurn[] }>(req);
    if (!message?.trim()) return badRequest('Missing "message"');

    const reply = await chat(message, history ?? []);
    return ok({ reply });
  } catch (err) {
    return serverError(err);
  }
};
