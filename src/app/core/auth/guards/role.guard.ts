import { inject, PLATFORM_ID } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';
import { AuthService } from '../auth.service';
import { MatSnackBar } from '@angular/material/snack-bar';
import { isPlatformServer } from '@angular/common';

export const roleGuard: CanActivateFn = (route, state) => {
  const authService = inject(AuthService);
  const router = inject(Router);
  const snackBar = inject(MatSnackBar);
  const platformId = inject(PLATFORM_ID);

  // During SSR, the server doesn't have the HttpOnly cookie context easily available.
  // We allow the route to render skeletons/loaders on the server.
  // The client will re-run the guard upon hydration and enforce the actual check.
  if (isPlatformServer(platformId)) {
    return true;
  }

  const expectedRoles = route.data['roles'] as Array<string>;
  const user = authService.user();

  if (!user || !user.roles || !expectedRoles) {
    router.navigateByUrl('/auth/sign-in');
    return false;
  }

  // Check if user has at least one of the expected roles
  const hasRole = expectedRoles.some(role => user.roles.includes(role));

  if (!hasRole) {
    snackBar.open('You do not have permission to access this area.', 'Close', {
      duration: 5000,
      panelClass: 'warning-toast',
    });
    
    // Redirect based on their actual role so they aren't stuck
    if (user.roles.includes('Student')) {
      router.navigateByUrl('/student');
    } else if (user.roles.includes('Teacher')) {
      router.navigateByUrl('/teacher');
    } else {
      router.navigateByUrl('/auth/sign-in');
    }
    return false;
  }

  return true;
};
