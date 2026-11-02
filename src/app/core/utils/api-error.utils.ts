import { Observable, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { ApiResponse } from '../models/api-response.model';

/**
 * Client-side representation of a 400 response.
 * - `errors`: flat list, for summary alerts.
 * - `fieldErrors`: messages keyed by camelCase field name (from ValidationProblemDetails),
 *   so forms can show each message under its input.
 */
export class ApiValidationError extends Error {
  public errors: string[];
  public fieldErrors: Record<string, string[]>;

  constructor(errors: string[] | string, fieldErrors: Record<string, string[]> = {}) {
    super(Array.isArray(errors) ? errors.join(', ') : errors);
    this.name = 'ApiValidationError';
    this.errors = Array.isArray(errors) ? errors : [errors];
    this.fieldErrors = fieldErrors;
  }

  /** Builds an error from either a ValidationProblemDetails body or our Result failure body. */
  static fromResponseBody(body: unknown): ApiValidationError {
    const problem = body as { errors?: unknown; title?: string } | null;

    // ValidationProblemDetails: { title, errors: { field: [messages] } }
    if (problem?.errors && typeof problem.errors === 'object' && !Array.isArray(problem.errors)) {
      const fieldErrors = problem.errors as Record<string, string[]>;
      return new ApiValidationError(Object.values(fieldErrors).flat(), fieldErrors);
    }

    // Result failure: { succeeded: false, errors: [messages] }
    if (Array.isArray(problem?.errors) && problem.errors.length) {
      return new ApiValidationError(problem.errors as string[]);
    }

    if (typeof body === 'string' && body) {
      return new ApiValidationError(body);
    }

    return new ApiValidationError(problem?.title || 'A validation error occurred.');
  }
}

export function unwrapApiResponse<T>() {
  return (source: Observable<ApiResponse<T>>): Observable<T> => {
    return source.pipe(
      map((response) => {
        if (!response.succeeded) {
          throw new ApiValidationError(response.errors || ['An unknown error occurred']);
        }
        return response.data;
      }),
      // Other generic API errors (e.g., 400/500 statuses) are caught and thrown
      // by the global error.interceptor.ts. This catchError is just a final fallback
      // in case the interceptor passes through an unexpected error.
      catchError((error: unknown) => throwError(() => error))
    );
  };
}

/**
 * Messages to show for a failed call: field/summary messages for 400s, the server's message for 404/409
 * (Result failures carry `errors`), otherwise the fallback (403/5xx already raised a toast).
 */
export function errorMessages(error: unknown, fallback: string): string[] {
  if (error instanceof ApiValidationError) return error.errors;
  const body = (error as { error?: { errors?: unknown } } | null)?.error;
  if (Array.isArray(body?.errors) && body.errors.length) return body.errors as string[];
  return [fallback];
}
