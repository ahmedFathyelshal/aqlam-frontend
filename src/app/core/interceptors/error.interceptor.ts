import { HttpErrorResponse, HttpHandlerFn, HttpInterceptorFn, HttpRequest } from '@angular/common/http';
import { inject } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { ApiValidationError } from '../utils/api-error.utils';

/**
 * Hybrid error handling:
 * - 400/422 → ApiValidationError thrown to the component (inline field errors, no toast).
 * - 401     → passed through untouched; auth.interceptor owns silent refresh and the "session expired" message.
 * - 404/409 → passed through; the caller decides (e.g. "course not found" page).
 * - 403, 429, 5xx, network → global toast.
 */
export const errorInterceptor: HttpInterceptorFn = (
  req: HttpRequest<unknown>,
  next: HttpHandlerFn
) => {
  const snackBar = inject(MatSnackBar);

  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      if (error.status === 400 || error.status === 422) {
        return throwError(() => ApiValidationError.fromResponseBody(error.error));
      }

      // Refresh failures (including 403 replay detection) are handled by auth.interceptor.
      if (error.status === 401 || error.status === 404 || error.status === 409 || isRefreshRequest(req)) {
        return throwError(() => error);
      }

      let message = 'An unexpected server error occurred. Please try again.';
      if (error.status === 403) {
        message = 'You do not have permission to perform this action.';
      } else if (error.status === 429) {
        message = 'Too many attempts. Please wait a minute and try again.';
      } else if (error.status === 0) {
        message = 'Cannot connect to the server. Please check your internet connection.';
      }

      // The session probe on app start fails silently when the user is not signed in.
      if (!req.url.endsWith('/Auth/me')) {
        setTimeout(() => {
          snackBar.open(message, 'Close', {
            duration: 5000,
            panelClass: error.status === 403 ? 'warning-toast' : 'error-toast',
          });
        });
      }

      return throwError(() => error);
    })
  );
};

const isRefreshRequest = (req: HttpRequest<unknown>) => req.url.endsWith('/Auth/refresh');
