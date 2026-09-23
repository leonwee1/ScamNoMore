import { badRequest, created, Handler, json, ok, serverError } from '../lib/http';
import {
  createReport,
  listReports,
  ReportValidationError,
} from '../lib/reportsDb';

const NO_STORE = { 'Cache-Control': 'no-store' };

/** POST /reports — persist an unverified public incident report. */
export const createHandler: Handler = async (req) => {
  try {
    const report = createReport(json<unknown>(req));
    return { ...created({ report }), headers: NO_STORE };
  } catch (err) {
    if (err instanceof ReportValidationError) return badRequest(err.message);
    if (err instanceof SyntaxError) return badRequest('Request body must be valid JSON');
    return serverError(err);
  }
};

/** GET /reports — hydrate every Expo session/device from the shared SQLite file. */
export const listHandler: Handler = async () => {
  try {
    return { ...ok({ reports: listReports() }), headers: NO_STORE };
  } catch (err) {
    return serverError(err);
  }
};
