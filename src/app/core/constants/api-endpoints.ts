import { environment } from '../../../environments/environment';

export const ApiEndpoints = {
  Auth: {
    Login: `${environment.apiUrl}/Auth/login`,
    Register: `${environment.apiUrl}/Auth/register`,
    Refresh: `${environment.apiUrl}/Auth/refresh`,
    Logout: `${environment.apiUrl}/Auth/logout`,
  },
  // Add other modules here
  // Academy: { ... }
};
