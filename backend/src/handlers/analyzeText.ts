import type { APIGatewayProxyHandler } from 'aws-lambda';
import { analyzeWithBedrock } from '../lib/bedrock';
import { badRequest, ok, parseBody, serverError } from '../lib/http';

/**
 * POST /analyze/text
 * Body: { text: string, source?: 'transcribe' | 'text' }
 *
 * Bedrock LLM analysis of a transcript (voice flow) or of text the user typed
 * or pasted (message / email / advertisement).
 */
export const handler: APIGatewayProxyHandler = async (event) => {
  try {
    const { text, source } = parseBody<{ text?: string; source?: string }>(event);
    if (!text?.trim()) return badRequest('Missing "text"');

    const isTranscript = source !== 'text';
    const result = await analyzeWithBedrock(
      isTranscript
        ? { source: 'transcribe', transcript: text }
        : { source: 'text', ocrText: text }
    );

    return ok(result);
  } catch (err) {
    return serverError(err);
  }
};
