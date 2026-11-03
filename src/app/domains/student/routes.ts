import { Routes } from '@angular/router';
import { StudentLayout } from './layout/layout';
import { roleGuard } from '@/app/core/auth/guards/role.guard';

const routes: Routes = [
  {
    path: '',
    component: StudentLayout,
    canActivate: [roleGuard],
    data: { roles: ['Student'] },
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
      {
        path: 'dashboard',
        loadComponent: () => import('./modules/dashboard/dashboard.component'),
      },
      { path: ':org/report-cards/:termId', loadComponent: () => import('@/app/shared/components/report-card/report-card-page') },
    ],
  },
];

export default routes;
