import type { APIGatewayProxyResult } from 'aws-lambda';

/** Shared JSON/CORS response helpers for all handlers. */
const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'Content-Type',
  'Access-Control-Allow-Methods': 'OPTIONS,POST,GET',
};

export function ok(body: unknown): APIGatewayProxyResult {
  return { statusCode: 200, headers: { 'Content-Type': 'application/json', ...CORS }, body: JSON.stringify(body) };
}

export function badRequest(message: string): APIGatewayProxyResult {
  return { statusCode: 400, headers: { 'Content-Type': 'application/json', ...CORS }, body: JSON.stringify({ message }) };
}

export function serverError(err: unknown): APIGatewayProxyResult {
  const message = err instanceof Error ? err.message : 'Unexpected error';
  console.error('Handler failed:', err);
  return { statusCode: 500, headers: { 'Content-Type': 'application/json', ...CORS }, body: JSON.stringify({ message }) };
}

/** Parse a JSON body from API Gateway (handles base64 encoding). */
export function parseBody<T>(event: { body?: string | null; isBase64Encoded?: boolean }): T {
  if (!event.body) return {} as T;
  const raw = event.isBase64Encoded
    ? Buffer.from(event.body, 'base64').toString('utf8')
    : event.body;
  return JSON.parse(raw) as T;
}
