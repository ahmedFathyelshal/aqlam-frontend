import { isPlatformServer } from '@angular/common';
import { inject, PLATFORM_ID } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

import { AuthService } from '../auth.service';

/** Any signed-in user (students learn; staff use the same pages as a preview). */
export const authenticatedGuard: CanActivateFn = () => {
  if (isPlatformServer(inject(PLATFORM_ID))) {
    return true; // the client re-checks after hydration
  }
  return inject(AuthService).isAuthenticated() ? true : inject(Router).createUrlTree(['/auth/sign-in']);
};
