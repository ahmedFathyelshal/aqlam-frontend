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
  // Personal pages render in the browser. The public marketplace pages (search, /prep, /t, /courses) are rendered
  // on the server (story 3.5.1): search engines and link previews read them without running the app.
  ...['checkout/**', 'redeem', 'admin/**'].map((path): ServerRoute => ({ path, renderMode: RenderMode.Client })),
  {
    path: '**',
    renderMode: RenderMode.Server,
  },
];
