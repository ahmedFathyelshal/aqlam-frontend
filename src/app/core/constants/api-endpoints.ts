import { environment } from '../../../environments/environment';

const buildUrl = (path: string) => `${environment.apiUrl}${path}`;

export const ApiEndpoints = {
  Auth: {
    Login: buildUrl('/Auth/login'),
    Register: buildUrl('/Auth/register'),
    Refresh: buildUrl('/Auth/refresh'),
    Logout: buildUrl('/Auth/logout'),
    Me: buildUrl('/Auth/me'),
  },
  // Add other modules here
  // Academy: { ... }
};
