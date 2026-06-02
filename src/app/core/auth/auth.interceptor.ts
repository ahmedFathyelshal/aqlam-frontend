import { HttpHandlerFn, HttpInterceptorFn, HttpRequest } from '@angular/common/http';

export const authInterceptor: HttpInterceptorFn = (
  req: HttpRequest<unknown>,
  next: HttpHandlerFn
) => {
  // Clone the request and add withCredentials to include HttpOnly cookies
  const modifiedReq = req.clone({
    withCredentials: true
  });

  return next(modifiedReq);
};
