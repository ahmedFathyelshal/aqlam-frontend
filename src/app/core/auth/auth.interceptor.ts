import { HttpErrorResponse, HttpHandlerFn, HttpInterceptorFn, HttpRequest } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { BehaviorSubject, throwError } from 'rxjs';
import { catchError, filter, switchMap, take } from 'rxjs/operators';
import { AuthService } from './auth.service';

let isRefreshing = false;
let refreshSubject: BehaviorSubject<any> = new BehaviorSubject<any>(null);

export const authInterceptor: HttpInterceptorFn = (
  req: HttpRequest<unknown>,
  next: HttpHandlerFn
) => {
  const authService = inject(AuthService);
  const router = inject(Router);

  // Clone the request and add withCredentials to include HttpOnly cookies
  const modifiedReq = req.clone({
    withCredentials: true
  });

  return next(modifiedReq).pipe(
    catchError((error) => {
      if (
        error instanceof HttpErrorResponse &&
        error.status === 401 &&
        !req.url.includes('/api/Auth/login') &&
        !req.url.includes('/api/Auth/refresh')
      ) {
        return handle401Error(modifiedReq, next, authService, router);
      }
      return throwError(() => error);
    })
  );
};

const handle401Error = (req: HttpRequest<any>, next: HttpHandlerFn, authService: AuthService, router: Router) => {
  if (!isRefreshing) {
    isRefreshing = true;
    refreshSubject.next(null);

    return authService.refreshSession().pipe(
      switchMap((response: any) => {
        isRefreshing = false;
        refreshSubject.next(response);
        return next(req);
      }),
      catchError((err) => {
        isRefreshing = false;
        refreshSubject.next(false); // Signal failure to queued requests
        authService.signOutLocal();
        router.navigateByUrl('/auth/sign-in');
        return throwError(() => err);
      })
    );
  } else {
    // If already refreshing, wait until refreshSubject emits a non-null value
    return refreshSubject.pipe(
      filter(val => val !== null),
      take(1),
      switchMap(val => {
        if (val === false) {
          return throwError(() => new Error('Session refresh failed.'));
        }
        return next(req);
      })
    );
  }
};
