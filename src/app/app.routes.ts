import { Route } from '@angular/router';
import { inject, PLATFORM_ID } from '@angular/core';
import { isPlatformServer } from '@angular/common';
import { AuthService } from './core/auth/auth.service';

export const routes: Route[] = [
  // Website routes
  {
    path: 'home',
    loadChildren: () => import('./domains/website/routes'),
  },

  // Auth
  {
    path: 'auth',
    loadChildren: () => import('./domains/auth/routes'),
  },

  // Teacher
  {
    path: 'teacher',
    loadChildren: () => import('./domains/teacher/routes'),
  },

  // Student
  {
    path: 'student',
    loadChildren: () => import('./domains/student/routes'),
  },

  {
    path: '',
    pathMatch: 'full',
    redirectTo: () => {
      const platformId = inject(PLATFORM_ID);
      if (isPlatformServer(platformId)) {
        // Fallback for SSR to prevent premature login redirects
        return '/student/dashboard';
      }

      const authService = inject(AuthService);
      const user = authService.user();
      
      if (user?.roles?.includes('Teacher')) {
        return '/teacher/dashboard';
      }
      if (user?.roles?.includes('Student')) {
        return '/student/dashboard';
      }
      
      return '/auth/sign-in';
    },
  },
  {
    path: 'admin',
    loadChildren: () => import('./domains/admin/routes'),
  },

  // Coming soon
  {
    path: 'coming-soon',
    loadChildren: () => import('./domains/coming-soon/routes'),
  },
];
