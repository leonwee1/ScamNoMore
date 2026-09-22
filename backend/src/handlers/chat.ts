import type { APIGatewayProxyHandler } from 'aws-lambda';
import { chatWithBedrock } from '../lib/bedrock';
import { badRequest, ok, parseBody, serverError } from '../lib/http';

/**
 * POST /chat
 * Body: { message: string, history?: [{ role, content }] }
 * Returns: { reply: string }
 *
 * Bedrock LLM chatbot: answers scam questions and gives awareness tips, with
 * conversation history so follow-up questions keep their context.
 */
export const handler: APIGatewayProxyHandler = async (event) => {
  try {
    const { message, history } = parseBody<{
      message?: string;
      history?: Array<{ role: 'user' | 'assistant'; content: string }>;
    }>(event);

    if (!message?.trim()) return badRequest('Missing "message"');

    const reply = await chatWithBedrock(message, history ?? []);
    return ok({ reply });
  } catch (err) {
    return serverError(err);
  }
};
