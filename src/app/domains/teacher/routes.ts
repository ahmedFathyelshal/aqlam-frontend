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
      {
        path: 'courses/new',
        loadComponent: () => import('./modules/courses/builder/builder-layout/builder-layout.component'),
        children: [
          { path: 'step-1', loadComponent: () => import('./modules/courses/builder/step1-identity/step1-identity.component') },
          { path: '', redirectTo: 'step-1', pathMatch: 'full' }
        ]
      },
      {
        path: 'courses/:id/edit',
        loadComponent: () => import('./modules/courses/builder/builder-layout/builder-layout.component'),
        children: [
          { path: 'step-1', loadComponent: () => import('./modules/courses/builder/step1-identity/step1-identity.component') },
          { path: 'step-2', loadComponent: () => import('./modules/courses/builder/step2-commercials/step2-commercials.component') },
          { path: 'step-3', loadComponent: () => import('./modules/courses/builder/step3-media/step3-media.component') },
          { path: 'step-4', loadComponent: () => import('./modules/courses/builder/step4-curriculum/step4-curriculum.component') },
          { path: '', redirectTo: 'step-1', pathMatch: 'full' }
        ]
      },
      {
        path: 'courses/:id/curriculum',
        loadComponent: () => import('./modules/courses/curriculum-workspace/curriculum-workspace.component')
      }
    ],
  },
];

export default routes;
