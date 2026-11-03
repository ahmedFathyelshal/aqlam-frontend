import { Routes } from '@angular/router';
import { noAuthGuard } from '@/app/core/auth/guards/no-auth.guard';

const routes: Routes = [
  {
    path: '',
    loadComponent: () => import('./layout'),
    canActivate: [noAuthGuard],
    children: [
      {
        path: '',
        pathMatch: 'full',
        redirectTo: 'sign-in',
      },
      {
        path: 'forgot-password',
        loadComponent: () =>
          import('./features/forgot-password/forgot-password'),
      },
      {
        path: 'sign-in',
        loadComponent: () => import('./features/sign-in/sign-in'),
      },
      {
        path: 'sign-up',
        loadComponent: () => import('./features/sign-up/sign-up'),
      },
    ],
  },
];

export default routes;
