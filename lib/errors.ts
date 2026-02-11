/**
 * Expected / business errors. Use for validation, config, and known failure cases.
 * In catch: show e.message to user. Unexpected errors (Error): show GENERIC_ERROR_MESSAGE, always console.error(e).
 * Optional details (e.g. locationId for QB_REFRESH_EXPIRED) for redirects or UI.
 */
export class AppError extends Error {
  constructor(
    message: string,
    public readonly code?: string,
    public readonly details?: Record<string, unknown>,
  ) {
    super(message);
    this.name = 'AppError';
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

/** Show in UI for unexpected errors; always log full error with console.error(e). */
export const GENERIC_ERROR_MESSAGE = 'Something went wrong';
