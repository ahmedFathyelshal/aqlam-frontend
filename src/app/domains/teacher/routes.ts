import { Routes } from '@angular/router';
import { TeacherLayout } from './layout/layout';
import { roleGuard } from '@/app/core/auth/guards/role.guard';
import { orgGuard, redirectToDefaultOrg } from '@/app/core/organizations/org.guard';

const builderSteps = (includeLaterSteps: boolean): Routes => [
  { path: 'step-1', loadComponent: () => import('./modules/courses/builder/step1-identity/step1-identity.component') },
  ...(includeLaterSteps
    ? [
        { path: 'step-2', loadComponent: () => import('./modules/courses/builder/step2-commercials/step2-commercials.component') },
        { path: 'step-3', loadComponent: () => import('./modules/courses/builder/step3-media/step3-media.component') },
        { path: 'step-4', loadComponent: () => import('./modules/courses/builder/step4-curriculum/step4-curriculum.component') },
      ]
    : []),
  { path: '', redirectTo: 'step-1', pathMatch: 'full' },
];

const routes: Routes = [
  {
    path: '',
    component: TeacherLayout,
    canActivate: [roleGuard],
    data: { roles: ['Teacher'] },
    children: [
      { path: '', pathMatch: 'full', redirectTo: redirectToDefaultOrg },
      {
        // The organization is part of the URL so each tab keeps its own context.
        path: ':org',
        canActivate: [orgGuard],
        children: [
          { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
          {
            path: 'dashboard',
            loadComponent: () => import('./modules/dashboard/dashboard.component'),
          },
          {
            path: 'courses/new',
            loadComponent: () => import('./modules/courses/builder/builder-layout/builder-layout.component'),
            children: builderSteps(false),
          },
          {
            path: 'courses/:id/edit',
            loadComponent: () => import('./modules/courses/builder/builder-layout/builder-layout.component'),
            children: builderSteps(true),
          },
          {
            path: 'courses/:id/curriculum',
            loadComponent: () => import('./modules/courses/curriculum-workspace/curriculum-workspace.component'),
          },
        ],
      },
    ],
  },
];

export default routes;
