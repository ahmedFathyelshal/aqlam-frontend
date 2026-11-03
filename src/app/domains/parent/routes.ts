import { Routes } from '@angular/router';
import { authenticatedGuard } from '@/app/core/auth/guards/authenticated.guard';
import { ParentLayout } from './layout';

/** Parent portal. Any signed-in user can link a child; access to a child is checked by the API (children.view + link). */
const routes: Routes = [
  {
    path: '',
    component: ParentLayout,
    canActivate: [authenticatedGuard],
    children: [
      { path: '', loadComponent: () => import('./children.component') },
      { path: ':org/children/:childId', loadComponent: () => import('./child-overview.component') },
      { path: ':org/children/:childId/report-cards/:termId', loadComponent: () => import('@/app/shared/components/report-card/report-card-page') },
    ],
  },
];

export default routes;
