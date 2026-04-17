import { NextResponse } from 'next/server';
import { Prisma } from '@prisma/client';

/**
 * Expected / business errors. Use for validation, config, and known failure cases.
 * In catch: show userMessage (or message) to user. Unexpected errors: show GENERIC_ERROR_MESSAGE, always console.error(e).
 *
 * Signatures (all backward compatible):
 * - new AppError(message)
 * - new AppError(message, code)
 * - new AppError(message, code, details)
 * - new AppError(message, code, details, statusCode, userMessage)
 */
export class AppError extends Error {
  public readonly code: string;
  public readonly statusCode: number;
  public readonly userMessage: string;
  public readonly details?: Record<string, unknown>;

  constructor(
    message: string,
    code?: string,
    details?: Record<string, unknown>,
    statusCode?: number,
    userMessage?: string,
  ) {
    super(message);
    this.name = 'AppError';
    this.code = code ?? 'APP_ERROR';
    this.statusCode = statusCode ?? (code ? 502 : 500);
    this.userMessage = userMessage ?? message;
    this.details = details;
    Object.setPrototypeOf(this, AppError.prototype);
  }
}

/** Show in UI for unexpected errors; always log full error with console.error(e). */
export const GENERIC_ERROR_MESSAGE = 'Something went wrong';

/** Validation / bad request (400) */
export class ValidationError extends AppError {
  constructor(message: string, public field?: string) {
    super(message, 'VALIDATION_ERROR', undefined, 400, message);
    this.name = 'ValidationError';
  }
}

/** Resource not found (404) */
export class NotFoundError extends AppError {
  constructor(resource: string, id?: string) {
    const message = id ? `${resource} with id ${id} not found` : `${resource} not found`;
    super(message, 'NOT_FOUND', undefined, 404, message);
    this.name = 'NotFoundError';
  }
}

/** Unauthorized (401) */
export class UnauthorizedError extends AppError {
  constructor(message: string = 'Unauthorized') {
    super(message, 'UNAUTHORIZED', undefined, 401, message);
    this.name = 'UnauthorizedError';
  }
}

/** Database / Prisma errors (500) */
export class DatabaseError extends AppError {
  constructor(message: string, originalError?: unknown) {
    super(
      `Database error: ${message}`,
      'DATABASE_ERROR',
      undefined,
      500,
      'A database error occurred. Please try again.',
    );
    this.name = 'DatabaseError';
    if (originalError) {
      this.cause = originalError;
    }
  }
}

/** GraphQL / external API errors (500) */
export class GraphQLError extends AppError {
  constructor(message: string, errors?: unknown) {
    super(
      message,
      'GRAPHQL_ERROR',
      undefined,
      500,
      'Failed to fetch data from external service.',
    );
    this.name = 'GraphQLError';
    if (errors) {
      this.cause = errors;
    }
  }
}

function prismaKnownRequestUserMessage(
  e: Prisma.PrismaClientKnownRequestError,
): string {
  switch (e.code) {
    case 'P2021':
      return 'A required database table is missing. Run migrations (e.g. pnpm prisma migrate deploy) for this environment.';
    case 'P1000':
    case 'P1001':
    case 'P1002':
    case 'P1003':
    case 'P1017':
      return 'Could not reach the database. Check DATABASE_URL, network access, and that Postgres is running.';
    case 'P2002':
      return 'A unique constraint would be violated.';
    default:
      return 'A database error occurred. Please try again.';
  }
}

const isDev = process.env.NODE_ENV === 'development';

/**
 * Canonical API error handler. Returns NextResponse with body { error, code? } and appropriate status.
 * Use in route handlers: catch (e) { return handleApiError(e); }
 */
export function handleApiError(error: unknown): NextResponse {
  console.error('[API Error]', error);

  if (error instanceof AppError) {
    return NextResponse.json(
      { error: error.userMessage, code: error.code },
      { status: error.statusCode },
    );
  }

  if (error instanceof Prisma.PrismaClientInitializationError) {
    const e = error as Prisma.PrismaClientInitializationError;
    return NextResponse.json(
      {
        error: isDev
          ? e.message
          : 'Could not connect to the database. Check DATABASE_URL and that the server can reach Postgres.',
        code: 'PRISMA_INIT',
      },
      { status: 503 },
    );
  }

  if (error instanceof Prisma.PrismaClientUnknownRequestError) {
    const e = error as Prisma.PrismaClientUnknownRequestError;
    return NextResponse.json(
      {
        error: isDev
          ? e.message
          : 'The database returned an unexpected error. Check server logs.',
        code: 'PRISMA_UNKNOWN',
      },
      { status: 500 },
    );
  }

  if (error instanceof Prisma.PrismaClientValidationError) {
    const e = error as Prisma.PrismaClientValidationError;
    return NextResponse.json(
      {
        error: isDev ? e.message : 'Invalid database query.',
        code: 'PRISMA_VALIDATION',
      },
      { status: 500 },
    );
  }

  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    const prismaError = error as Prisma.PrismaClientKnownRequestError;
    return NextResponse.json(
      {
        error: prismaKnownRequestUserMessage(prismaError),
        code: prismaError.code,
      },
      { status: 500 },
    );
  }

  if (error && typeof error === 'object' && 'graphQLErrors' in error) {
    const graphQLError = new GraphQLError('GraphQL error', error);
    return NextResponse.json(
      { error: graphQLError.userMessage, code: graphQLError.code },
      { status: graphQLError.statusCode },
    );
  }

  const message =
    error instanceof Error
      ? error.message
      : typeof error === 'string'
        ? error
        : 'An unexpected error occurred';

  return NextResponse.json(
    {
      error: isDev && message ? message : GENERIC_ERROR_MESSAGE,
      code: 'UNKNOWN_ERROR',
      ...(!isDev
        ? {
            hint: 'If this persists, check the server terminal or hosting logs for this API route.',
          }
        : {}),
    },
    { status: 500 },
  );
}

/**
 * Standard API error response: log with context, then return same shape as handleApiError.
 * Use for existing call sites: return toApiErrorResponse(err, 'GET /api/...');
 */
export function toApiErrorResponse(err: unknown, logContext: string): NextResponse {
  console.error(logContext, err);
  return handleApiError(err);
}

/**
 * Wraps an async route handler with try/catch and handleApiError.
 * Example: export const GET = withErrorHandling(async (req) => { ... });
 */
export function withErrorHandling<T extends (...args: any[]) => Promise<NextResponse>>(
  handler: T,
): T {
  return (async (...args: Parameters<T>) => {
    try {
      return await handler(...args);
    } catch (error) {
      return handleApiError(error);
    }
  }) as T;
}
