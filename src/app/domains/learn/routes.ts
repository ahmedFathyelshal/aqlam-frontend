import { Routes } from '@angular/router';

import { authenticatedGuard } from '@/app/core/auth/guards/authenticated.guard';

/** Course player for students (and staff previews): /learn/:org/:courseId[/:lessonId]. */
const routes: Routes = [
  {
    path: ':org/:courseId',
    canActivate: [authenticatedGuard],
    children: [
      { path: '', loadComponent: () => import('./course-player/course-player.component') },
      { path: ':lessonId', loadComponent: () => import('./course-player/course-player.component') },
    ],
  },
];

export default routes;
