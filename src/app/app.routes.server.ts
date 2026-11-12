import { RenderMode, ServerRoute } from '@angular/ssr';

export const serverRoutes: ServerRoute[] = [
  {
    path: '',
    renderMode: RenderMode.Client,
  },
  {
    path: 'student/**',
    renderMode: RenderMode.Client,
  },
  {
    path: 'teacher/**',
    renderMode: RenderMode.Client,
  },
  {
    path: 'learn/**',
    renderMode: RenderMode.Client,
  },
  {
    path: 'auth/**',
    renderMode: RenderMode.Client,
  },
  // Marketplace pages render in the browser for now: on the server the relative /api address has no host.
  // Server rendering for search engines (story 3.5.1) needs an absolute API origin on the server first.
  ...['search', 'prep/**', 't/**', 'courses/**', 'checkout/**', 'redeem', 'admin/**'].map((path): ServerRoute => ({ path, renderMode: RenderMode.Client })),
  {
    path: '**',
    renderMode: RenderMode.Server,
  },
];
