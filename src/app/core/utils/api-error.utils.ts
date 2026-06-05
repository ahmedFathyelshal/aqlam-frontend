export class ApiValidationError extends Error {
  public errors: string[];

  constructor(errors: string[] | string) {
    super(Array.isArray(errors) ? errors.join(', ') : errors);
    this.name = 'ApiValidationError';
    this.errors = Array.isArray(errors) ? errors : [errors];
  }
}

import { Observable, throwError } from 'rxjs';
import { catchError, map } from 'rxjs/operators';
import { ApiResponse } from '../models/api-response.model';

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
      catchError((error: any) => throwError(() => error))
    );
  };
}
