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
