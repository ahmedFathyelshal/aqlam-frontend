import { HttpErrorResponse, HttpHandlerFn, HttpInterceptorFn, HttpRequest } from '@angular/common/http';
import { inject } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Router } from '@angular/router';
import { throwError } from 'rxjs';
import { catchError } from 'rxjs/operators';
import { ApiValidationError } from '../utils/api-error.utils';
import { ApiResponse } from '../models/api-response.model';

export const errorInterceptor: HttpInterceptorFn = (
  req: HttpRequest<unknown>,
  next: HttpHandlerFn
) => {
  const snackBar = inject(MatSnackBar);
  const router = inject(Router);

  return next(req).pipe(
    catchError((error: HttpErrorResponse) => {
      // 1. Status 400/422 (Validation Errors) -> Throw to Component
      if (error.status === 400 || error.status === 422) {
        let errorMessages: string[] = ['A validation error occurred.'];

        if (error.error) {
          const apiResponse = error.error as ApiResponse;
          if (apiResponse.errors && Array.isArray(apiResponse.errors)) {
            errorMessages = apiResponse.errors;
          } else if (typeof error.error === 'string') {
            errorMessages = [error.error];
          }
        }
        
        // Pass strictly typed error to the component to bind to the UI
        return throwError(() => new ApiValidationError(errorMessages));
      }

      // 1b. Status 500 with ProblemDetails for ValidationException
      if (error.status === 500 && error.error && typeof error.error.detail === 'string' && error.error.detail.startsWith('Validation failed:')) {
        // Parse the .NET ValidationException detail string into an array of strings
        // e.g. "Validation failed: \r\n -- UserName: UserNameAlreadyInUse Severity: Error"
        const detailParts = error.error.detail.split('--').slice(1).map((part: string) => part.trim());
        const errorMessages = detailParts.length > 0 ? detailParts : [error.error.detail];
        
        return throwError(() => new ApiValidationError(errorMessages));
      }

      // 2. Status 401 (Unauthorized - usually if Refresh failed) -> Toast & Redirect
      if (error.status === 401) {
        snackBar.open('Your session has expired. Please log in again.', 'Close', { duration: 5000, panelClass: 'error-toast' });
        router.navigateByUrl('/auth/sign-in');
        return throwError(() => error);
      }

      // 3. Status 403 (Forbidden) -> Toast
      if (error.status === 403) {
        snackBar.open('You do not have permission to perform this action.', 'Close', { duration: 5000, panelClass: 'warning-toast' });
        return throwError(() => error);
      }

      // 4. Status 500+ / Network Errors -> Global Toast
      let genericMessage = 'An unexpected server error occurred. Please try again.';
      if (error.status === 0) {
        genericMessage = 'Cannot connect to the server. Please check your internet connection.';
      }

      snackBar.open(genericMessage, 'Close', { duration: 5000, panelClass: 'error-toast' });
      
      // Still throw it so the stream resolves as an error
      return throwError(() => error);
    })
  );
};
