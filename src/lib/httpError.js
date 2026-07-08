/**
 * Error that carries an HTTP status + client-safe message.
 *
 * Throw this from inside a `withTransaction` callback (or any route logic) to abort
 * with a proper status code: throwing rolls back the transaction, and the route's
 * catch block can translate it into a JSON response via `httpErrorResponse`.
 */
export class HttpError extends Error {
  constructor(status, message) {
    super(message);
    this.name = 'HttpError';
    this.status = status;
  }
}

/** Shorthand: `throw httpError(404, 'No encontrado')`. */
export function httpError(status, message) {
  return new HttpError(status, message);
}

/**
 * If `err` is an HttpError, return a NextResponse-shaped `{ body, status }`;
 * otherwise return null so the caller can fall back to a generic 500.
 * @param {unknown} err
 * @returns {{ body: { error: string }, status: number } | null}
 */
export function asHttpErrorPayload(err) {
  if (err instanceof HttpError) {
    return { body: { error: err.message }, status: err.status };
  }
  return null;
}
