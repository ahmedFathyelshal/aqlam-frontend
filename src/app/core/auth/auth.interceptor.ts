import { HttpErrorResponse, HttpHandlerFn, HttpInterceptorFn, HttpRequest } from '@angular/common/http';
import { inject } from '@angular/core';
import { MatSnackBar } from '@angular/material/snack-bar';
import { Router } from '@angular/router';
import { BehaviorSubject, Observable, throwError, timer } from 'rxjs';
import { catchError, filter, switchMap, take } from 'rxjs/operators';
import { AuthService } from './auth.service';

let isRefreshing = false;
const refreshSubject = new BehaviorSubject<boolean | null>(null);

/** Delay before retrying when another tab rotated the session at the same moment (HTTP 409). */
const CONCURRENT_REFRESH_RETRY_MS = 300;

const isAuthEndpoint = (url: string) =>
  url.endsWith('/Auth/login') || url.endsWith('/Auth/refresh') || url.endsWith('/Auth/logout');

export const authInterceptor: HttpInterceptorFn = (
  req: HttpRequest<unknown>,
  next: HttpHandlerFn
) => {
  const authService = inject(AuthService);
  const router = inject(Router);
  const snackBar = inject(MatSnackBar);

  // Clone the request and add withCredentials to include HttpOnly cookies
  const modifiedReq = req.clone({
    withCredentials: true
  });

  return next(modifiedReq).pipe(
    catchError((error) => {
      if (error instanceof HttpErrorResponse && error.status === 401 && !isAuthEndpoint(req.url)) {
        return handle401Error(modifiedReq, next, authService, router, snackBar);
      }
      return throwError(() => error);
    })
  );
};

const handle401Error = (
  req: HttpRequest<unknown>,
  next: HttpHandlerFn,
  authService: AuthService,
  router: Router,
  snackBar: MatSnackBar
): Observable<any> => {
  if (isRefreshing) {
    // Queue until the in-flight refresh settles, then replay or fail.
    return refreshSubject.pipe(
      filter((val) => val !== null),
      take(1),
      switchMap((ok) => (ok ? next(req) : throwError(() => new Error('Session refresh failed.'))))
    );
  }

  isRefreshing = true;
  refreshSubject.next(null);

  return authService.refreshSession().pipe(
    switchMap(() => {
      isRefreshing = false;
      refreshSubject.next(true);
      return next(req);
    }),
    catchError((err) => {
      isRefreshing = false;

      // 409: another tab refreshed the same session a moment ago and the browser now holds the
      // new cookies. The session is fine — just replay the request.
      if (err instanceof HttpErrorResponse && err.status === 409) {
        refreshSubject.next(true);
        return timer(CONCURRENT_REFRESH_RETRY_MS).pipe(switchMap(() => next(req)));
      }

      refreshSubject.next(false);
      const wasSignedIn = authService.isAuthenticated();
      authService.signOutLocal();

      // Anonymous visitors (e.g. the /me probe on a public page) stay where they are;
      // route guards protect private pages.
      if (wasSignedIn) {
        snackBar.open('Your session has expired. Please sign in again.', 'Close', {
          duration: 5000,
          panelClass: 'warning-toast',
        });
        router.navigateByUrl('/auth/sign-in');
      }
      return throwError(() => err);
    })
  );
};
