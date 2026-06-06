import { Routes } from '@angular/router';
import { TeacherLayout } from './layout/layout';
import { roleGuard } from '@/app/core/auth/guards/role.guard';

const routes: Routes = [
  {
    path: '',
    component: TeacherLayout,
    canActivate: [roleGuard],
    data: { roles: ['Teacher'] },
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
      {
        path: 'dashboard',
        loadComponent: () => import('./modules/dashboard/dashboard.component'),
      },
    ],
  },
];

export default routes;
