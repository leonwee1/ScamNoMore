import { badRequest, created, Handler, json, ok, serverError } from '../lib/http';
import {
  createCommunityMessage,
  listCommunityMessagePage,
  ReportValidationError,
} from '../lib/reportsDb';

const NO_STORE = { 'Cache-Control': 'no-store' };

/** POST /community/messages — add an anonymous message to one shared room. */
export const createHandler: Handler = async (req) => {
  try {
    const message = createCommunityMessage(json<unknown>(req));
    return { ...created({ message }), headers: NO_STORE };
  } catch (err) {
    if (err instanceof ReportValidationError) return badRequest(err.message);
    if (err instanceof SyntaxError) return badRequest('Request body must be valid JSON');
    return serverError(err);
  }
};

/** GET /community/messages?roomKey=Phishing%20Scam — read one shared room. */
export const listHandler: Handler = async (req) => {
  try {
    const page = listCommunityMessagePage(
      req.query?.roomKey,
      req.query?.beforeCreatedAt,
      req.query?.beforeId
    );
    return { ...ok(page), headers: NO_STORE };
  } catch (err) {
    if (err instanceof ReportValidationError) return badRequest(err.message);
    return serverError(err);
  }
};
