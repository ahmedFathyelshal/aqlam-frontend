import { inject } from '@angular/core';
import { Router, Routes } from '@angular/router';

import { AuthService } from '@/app/core/auth/auth.service';
import { authenticatedGuard } from '@/app/core/auth/guards/authenticated.guard';
import { PublicShell } from './public-shell';

/** Public marketplace (open before sign-in), plus checkout and code redemption in the same frame. */
const routes: Routes = [
  {
    path: '',
    component: PublicShell,
    children: [
      { path: 'search', loadComponent: () => import('./search.page') },
      { path: 'prep/qudrat', loadComponent: () => import('./search.page'), data: { prep: 'qudrat' } },
      { path: 'prep/tahsili', loadComponent: () => import('./search.page'), data: { prep: 'tahsili' } },
      { path: 't/:slug', loadComponent: () => import('./teacher.page') },
      { path: 'courses/:slug', loadComponent: () => import('./course.page') },
      { path: 'redeem', canActivate: [authenticatedGuard], loadComponent: () => import('./redeem.page') },
      {
        path: 'admin/marketplace',
        canActivate: [authenticatedGuard, () => inject(AuthService).user()?.roles?.includes('SuperAdmin') || inject(Router).createUrlTree(['/search'])],
        loadComponent: () => import('./admin-marketplace.page'),
      },
      { path: 'checkout/test/:paymentId', canActivate: [authenticatedGuard], loadComponent: () => import('./checkout.page').then(m => m.TestCheckoutPage) },
      { path: 'checkout/:paymentId', canActivate: [authenticatedGuard], loadComponent: () => import('./checkout.page').then(m => m.PaymentResultPage) },
    ],
  },
];

export default routes;
