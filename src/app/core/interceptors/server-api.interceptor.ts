import { isPlatformServer } from '@angular/common';
import { HttpInterceptorFn } from '@angular/common/http';
import { inject, PLATFORM_ID, REQUEST } from '@angular/core';

/**
 * On the server, relative API addresses ("/api/...") have no host. They go to API_ORIGIN when it is set (API on
 * another host), otherwise to the host the page was requested from (the same-host setup, and the dev server's
 * proxy). In the browser this does nothing.
 */
export const serverApiInterceptor: HttpInterceptorFn = (req, next) => {
  if (!isPlatformServer(inject(PLATFORM_ID)) || !req.url.startsWith('/')) return next(req);

  const configured = typeof process !== 'undefined' ? process.env['API_ORIGIN'] : undefined;
  const request = inject(REQUEST, { optional: true });
  const origin = configured?.replace(/\/$/, '') ?? (request ? new URL(request.url).origin : null);
  return origin ? next(req.clone({ url: origin + req.url })) : next(req);
};
