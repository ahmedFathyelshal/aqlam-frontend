import { isPlatformServer } from '@angular/common';
import { inject, PLATFORM_ID } from '@angular/core';
import { Route } from '@angular/router';

import { AuthService } from './core/auth/auth.service';
import { authenticatedGuard } from './core/auth/guards/authenticated.guard';
import { environment } from '@/environments/environment';

export const routes: Route[] = [
  { path: 'auth', loadChildren: () => import('./domains/auth/routes') },

  // Staff area: owners, admins, coordinators, teachers, assistants
  { path: 'teacher', loadChildren: () => import('./domains/teacher/routes') },

  // Students
  { path: 'student', loadChildren: () => import('./domains/student/routes') },

  // Parents
  { path: 'parent', loadChildren: () => import('./domains/parent/routes') },

  // Course player (students; staff preview)
  { path: 'learn', loadChildren: () => import('./domains/learn/routes') },

  // Temporary passwords must be replaced first
  {
    path: 'account/password',
    canActivate: [authenticatedGuard],
    loadComponent: () => import('./domains/auth/features/change-password'),
  },

  // Visitors see the public home page once it is switched on; signed-in users go to their home below.
  {
    path: '',
    pathMatch: 'full',
    canMatch: [() => environment.publicHome && !inject(AuthService).isAuthenticated()],
    loadComponent: () => import('./domains/public/landing.component'),
  },
  {
    path: '',
    pathMatch: 'full',
    redirectTo: () => {
      if (isPlatformServer(inject(PLATFORM_ID))) {
        return '/auth/sign-in'; // the browser re-routes once the session is known
      }
      return inject(AuthService).homeRoute();
    },
  },
  // Public marketplace: search, teacher and course pages, test prep; checkout and codes (signed in).
  { path: '', loadChildren: () => import('./domains/public/routes') },

  { path: '**', redirectTo: '' },
];
