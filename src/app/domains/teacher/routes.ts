import { inject } from '@angular/core';
import { CanActivateFn, Router, Routes } from '@angular/router';
import { orgGuard, redirectToDefaultOrg, redirectToOrgHome, staffGuard } from '@/app/core/organizations/org.guard';
import { OrgContextService } from '@/app/core/organizations/org-context.service';
import { TeacherLayout } from './layout/layout';

/** The overview is for people who run a school or center; everyone else goes to their own home. */
const overviewGuard: CanActivateFn = () => {
  const orgContext = inject(OrgContextService);
  const org = orgContext.activeOrg();
  if (!org || orgContext.homePath(org).at(-1) === 'overview') return true;
  return inject(Router).createUrlTree(orgContext.homePath(org));
};

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
    canActivate: [staffGuard],
    children: [
      { path: '', pathMatch: 'full', redirectTo: redirectToDefaultOrg },
      {
        // The organization is part of the URL so each tab keeps its own context.
        path: ':org',
        canActivate: [orgGuard],
        children: [
          { path: '', pathMatch: 'full', redirectTo: redirectToOrgHome },
          {
            path: 'overview',
            canActivate: [overviewGuard],
            loadComponent: () => import('./modules/overview/overview.component'),
          },
          {
            path: 'dashboard',
            loadComponent: () => import('./modules/dashboard/dashboard.component'),
          },
          {
            path: 'courses/new',
            canActivate: [() => inject(OrgContextService).canCreateCourses() || inject(Router).createUrlTree(inject(OrgContextService).path('dashboard'))],
            loadComponent: () => import('./modules/courses/builder/builder-layout/builder-layout.component'),
            children: builderSteps(false),
          },
          {
            path: 'courses/:id/edit',
            loadComponent: () => import('./modules/courses/builder/builder-layout/builder-layout.component'),
            children: builderSteps(true),
          },
          {
            path: 'questions',
            loadComponent: () => import('./modules/assessments/question-bank/question-bank.component'),
          },
          {
            path: 'courses/:id/lessons/:lessonId/quiz',
            loadComponent: () => import('./modules/assessments/quiz-setup/quiz-setup.component'),
          },
          {
            path: 'courses/:id/lessons/:lessonId/assignment',
            loadComponent: () => import('./modules/assessments/assignment-setup/assignment-setup.component'),
          },
          {
            path: 'courses/:id/submissions',
            loadComponent: () => import('./modules/assessments/grading/grading.component'),
          },
          {
            path: 'courses/:id/curriculum',
            loadComponent: () => import('./modules/courses/curriculum-workspace/curriculum-workspace.component'),
          },
          // School & center operations
          { path: 'classes', loadComponent: () => import('./modules/school/classes/classes.component') },
          { path: 'classes/:classId', loadComponent: () => import('./modules/school/classes/class-detail.component') },
          { path: 'classes/:classId/attendance', loadComponent: () => import('./modules/school/attendance/attendance.component') },
          { path: 'classes/:classId/assignments/:assignmentId/gradebook', loadComponent: () => import('./modules/school/academics/gradebook.component') },
          { path: 'academic-years', loadComponent: () => import('./modules/school/academics/academic-years.component') },
          { path: 'report-cards/:studentId/:termId', data: { staff: true }, loadComponent: () => import('@/app/shared/components/report-card/report-card-page') },
          { path: 'announcements', loadComponent: () => import('./modules/school/announcements/announcements.component') },
          { path: 'members', loadComponent: () => import('./modules/school/members/members.component') },
          { path: 'settings', loadComponent: () => import('./modules/school/settings/settings.component') },
        ],
      },
    ],
  },
];

export default routes;
