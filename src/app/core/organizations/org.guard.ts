import { isPlatformServer } from '@angular/common';
import { PLATFORM_ID } from '@angular/core';
import { AuthService } from '../auth/auth.service';
import { inject } from '@angular/core';
import { CanActivateFn, RedirectFunction, Router } from '@angular/router';
import { OrgContextService } from './org-context.service';

/**
 * The organization is part of the URL (/teacher/:org/...), so every tab keeps its own context.
 * Activates the organization from the URL, or redirects to the user's default organization
 * when the slug is not one of their staff memberships.
 */
export const orgGuard: CanActivateFn = (route) => {
  const orgContext = inject(OrgContextService);
  const router = inject(Router);
  const slug = route.paramMap.get('org');

  if (slug && orgContext.staffMemberships().some(m => m.slug === slug)) {
    orgContext.select(slug);
    return true;
  }

  const fallback = orgContext.staffMemberships()[0];
  return router.createUrlTree(fallback ? ['/teacher', fallback.slug, 'dashboard'] : ['/auth/sign-in']);
};

/** /teacher → /teacher/{default organization}/dashboard */
export const redirectToDefaultOrg: RedirectFunction = () => {
  const fallback = inject(OrgContextService).staffMemberships()[0];
  return fallback ? `/teacher/${fallback.slug}/dashboard` : '/auth/sign-in';
};

/** The staff area is for anyone with a staff membership (owner, admin, teacher, assistant…). */
export const staffGuard: CanActivateFn = () => {
  if (isPlatformServer(inject(PLATFORM_ID))) return true; // the client re-checks after hydration
  const orgContext = inject(OrgContextService);
  const router = inject(Router);
  if (orgContext.staffMemberships().length) return true;
  return router.createUrlTree([inject(AuthService).homeRoute()]);
};
